const oracledb = require("../config/db");
const { dbConfig } = require("../config/db");
const bcrypt = require("bcryptjs");
// const sendOTP = require("../config/mailer");
const jwt = require("jsonwebtoken");
const { sendOTP, sendMail } = require("../config/mailer");
const crypto = require("crypto");
const { blacklistedTokens } = require("../utils/tokenStore");

exports.login = async (req, res) => {
  let connection;

  try {
    const { email, password } = req.body;

    connection = await oracledb.getConnection(dbConfig);

    const result = await connection.execute(
      "SELECT * FROM users WHERE email = :1",
      [email],
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );

    const rows = result.rows || [];

    if (rows.length === 0) {
      return res.status(400).json({ message: "User not found" });
    }

    const user = rows[0];

    const isMatch = await bcrypt.compare(password, user.PASSWORD);

    if (!isMatch) {
      return res.status(400).json({ message: "Wrong password" });
    }

    // 🔥 STEP 1: TRUSTED DEVICE CHECK
    const userAgent = req.headers["user-agent"];
    const deviceToken = req.cookies.deviceToken;

    const deviceCheck = await connection.execute(
      `SELECT * FROM trusted_devices 
       WHERE user_email = :1 
       AND user_agent = :2 
       AND expires_at > SYSDATE`,
      [email, userAgent],
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );

    // ✅ TRUSTED → OTP SKIP
    if (deviceCheck.rows.length > 0) {
      const token = jwt.sign(
        { email: user.EMAIL, role: user.ROLE },
        "super_secret_key_123",
        { expiresIn: "1h" },
      );

      return res.json({
        accessToken: token,
        otpRequired: false,
      });
    }

    // ❌ NOT TRUSTED → OTP SEND
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 5 * 60 * 1000);

    await connection.execute(
      `UPDATE users 
       SET otp = :1, otp_expires = :2 
       WHERE email = :3`,
      [otp, expires, email],
      { autoCommit: true },
    );

    await sendOTP(email, otp);

    return res.json({
      message: "OTP sent",
      otpRequired: true,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) await connection.close();
  }
};

exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  const userAgent = req.headers["user-agent"];

  let connection;

  try {
    connection = await oracledb.getConnection(dbConfig);

    const result = await connection.execute(
      `SELECT otp, otp_expires, role 
       FROM users WHERE email = :1`,
      [email],
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );

    const user = result.rows[0];

    if (!user) return res.status(400).json({ message: "User not found" });

    if (user.OTP !== otp)
      return res.status(400).json({ message: "Invalid OTP" });

    if (new Date() > new Date(user.OTP_EXPIRES))
      return res.status(400).json({ message: "OTP expired" });

    // ✅ clear OTP
    await connection.execute(
      `UPDATE users SET otp = NULL, otp_expires = NULL WHERE email = :1`,
      [email],
      { autoCommit: true },
    );

    // 🔥 SAVE TRUSTED DEVICE
    const deviceToken = crypto.randomBytes(32).toString("hex");

    await connection.execute(
      `INSERT INTO trusted_devices 
       (user_email, device_token, user_agent, expires_at)
       VALUES (:1, :2, :3, :4)`,
      [
        email,
        deviceToken,
        userAgent,
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      ],
      { autoCommit: true },
    );

    res.cookie("deviceToken", deviceToken, {
      httpOnly: true,
      sameSite: "strict",
    });

    const token = jwt.sign({ email, role: user.ROLE }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.json({ token, message: "Login successful" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) await connection.close();
  }
};
///////////////
exports.resendOtp = async (req, res) => {
  const { email } = req.body;
  let connection;

  try {
    connection = await oracledb.getConnection(dbConfig);

    // 🔥 new OTP generate
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 5 * 60 * 1000);

    // 🔥 DB update (IMPORTANT)
    await connection.execute(
      `UPDATE users 
       SET otp = :1, otp_expires = :2 
       WHERE email = :3`,
      [otp, expires, email],
      { autoCommit: true },
    );

    // 🔥 send mail
    await sendOTP(email, otp);

    res.json({ message: "OTP resent successfully" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) await connection.close();
  }
};

////////////////////////// FORGOT PASSWORD

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  let connection;

  try {
    connection = await oracledb.getConnection(dbConfig);

    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    await connection.execute(
      `UPDATE users 
       SET reset_token = :1, reset_expires = :2 
       WHERE email = :3`,
      [token, expires, email],
      { autoCommit: true },
    );

    const link = `http://localhost:5173/reset-password?session=${token}`;

    await sendMail(email, link);

    res.json({ message: "Reset link sent " });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) await connection.close();
  }
};
///////////////////////////////////
exports.resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;
  let connection;

  try {
    connection = await oracledb.getConnection(dbConfig);

    // 🔥 token + expiry check
    const result = await connection.execute(
      `SELECT email FROM users 
       WHERE reset_token = :1 
       AND reset_expires > SYSDATE`,
      [token],
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: "Token expired or invalid ❌" });
    }

    const email = result.rows[0].EMAIL;

    const hashed = await bcrypt.hash(newPassword, 10);

    await connection.execute(
      `UPDATE users 
       SET password = :1, reset_token = NULL, reset_expires = NULL 
       WHERE email = :2`,
      [hashed, email],
      { autoCommit: true },
    );

    res.json({ message: "Password updated successfully " });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) await connection.close();
  }
};

/////////get users///////////
exports.getUsers = async (req, res) => {
  // 🔐 ADMIN CHECK
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied" });
  }

  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig);

    const result = await connection.execute(
      `SELECT 
     id as "id",
     name as "name",
     email as "email",
     phone as "phone",
     role as "role"
   FROM users`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    res.json(result.rows || []);
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error("❌ Error closing connection:", err.message);
      }
    }
  }
};

////////////////////////update role///////
exports.updateUserRole = async (req, res) => {
  let connection;

  try {
    const userId = req.params.id;
    const { role } = req.body;

    connection = await oracledb.getConnection(dbConfig);

    // 🔹 target user nikaal
    const result = await connection.execute(
      "SELECT email FROM users WHERE id = :id",
      [userId],
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );

    const targetUser = result.rows[0];

    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // 🔥 IMPORTANT: self role change block
    if (req.user.email === targetUser.EMAIL) {
      return res.status(400).json({
        message: "You can't change your own role",
      });
    }

    // 🔹 role update karo
    await connection.execute(
      "UPDATE users SET role = :role WHERE id = :id",
      [role, userId],
      { autoCommit: true },
    );

    res.json({ message: "Role updated successfully" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) await connection.close();
  }
};

//////////////////////////////////
exports.toggleAdmin = async (req, res) => {
  let connection;
  try {
    const { id } = req.body;

    connection = await oracledb.getConnection(dbConfig);

    const result = await connection.execute(
      "SELECT id, name, email, phone, role FROM users WHERE id = :1",
      [id],
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );

    const rows = result.rows || [];

    if (rows.length === 0) {
      return res.status(400).json({ message: "User not found" });
    }

    const currentRole = rows[0].ROLE;

    const newRole = currentRole === "admin" ? "user" : "admin";

    await connection.execute(
      "UPDATE users SET role = :1 WHERE id = :2",
      [newRole, id],
      { autoCommit: true },
    );

    res.json({ message: "Role updated", role: newRole });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error("❌ Error closing connection:", err.message);
      }
    }
  }
};

////////////////////////////////////
exports.logout = async (req, res) => {
  res.clearCookie("deviceToken"); // optional

  res.json({ message: "Logged out" });
};

///////////////refresh token

exports.refreshToken = async (req, res) => {
  const token = req.cookies.refreshToken;

  if (!token) {
    return res.status(401).json({ message: "No refresh token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);

    const accessToken = jwt.sign(
      { email: decoded.email },
      process.env.JWT_SECRET,
      { expiresIn: "15m" },
    );

    res.json({ accessToken });
  } catch {
    res.status(401).json({ message: "Invalid refresh token" });
  }
};
