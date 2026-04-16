const pool = require("../config/db");

const bcrypt = require("bcryptjs");
// const sendOTP = require("../config/mailer");
const jwt = require("jsonwebtoken");
const { sendOTP, sendMail } = require("../config/mailer");
const crypto = require("crypto");

let otpStore = {}; // temp store

//  LOGIN
exports.login = async (req, res) => {
  console.log("LOGIN HIT 🔥");
  console.log(req.body);

  try {
    const { email, password } = req.body;

    const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [
      email,
    ]);

    if (rows.length === 0) {
      return res.status(400).json({ message: "User not found" });
    }

    const user = rows[0];

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Wrong password" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    otpStore[email] = {
      otp: otp,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 min
    };

    await sendOTP(email, otp);

    res.json({ message: "OTP sent to your email" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.verifyOtp = (req, res) => {
  const { email, otp } = req.body;

  const record = otpStore[email];

  if (!record) {
    return res.status(400).json({ message: "OTP not found" });
  }

  if (Date.now() > record.expiresAt) {
    delete otpStore[email];
    return res.status(400).json({ message: "OTP expired" });
  }

  if (record.otp !== otp) {
    return res.status(400).json({ message: "Invalid OTP" });
  }

  delete otpStore[email];

  const token = jwt.sign({ email }, "secretKey", { expiresIn: "1h" });

  res.json({
    message: "Login Successful",
    token: token,
  });
};

exports.resendOtp = async (req, res) => {
  const { email } = req.body;

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  otpStore[email] = {
    otp: otp,
    expiresAt: Date.now() + 5 * 60 * 1000,
  };

  await sendOTP(email, otp);

  res.json({ message: "OTP resent to email" });
};

////////////////////////// FORGOT PASSWORD
// exports.forgotPassword = async (req, res) => {
//   try {
//     const { email } = req.body;

//     const [rows] = await pool.query(
//       "SELECT * FROM users WHERE email=?",
//       [email]
//     );

//     if (rows.length === 0) {
//       return res.status(400).json({ message: "Email not registered" });
//     }

//     const token = crypto.randomBytes(32).toString("hex");

//     const expires = Date.now() + 15 * 60 * 1000;

//     await pool.query(
//       "UPDATE users SET reset_token=?, reset_expires=? WHERE email=?",
//       [token, expires, email]
//     );

//     const link = `http://localhost:5173/reset-password`;

//     await sendMail(email, link);

//     res.json({ message: "Reset link sent" });

//   } catch (err) {
//     console.log(err);
//     res.status(500).json({ message: "Server error" });
//   }
// };
let resetStore = {}; // temp memory

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  const token = crypto.randomBytes(32).toString("hex");

  // 🔥 token ko email se map kar diya
  resetStore[token] = email;

  // 🔥 CLEAN URL (NO TOKEN)
  const link = `http://localhost:5173/reset-password`;

  // 🔥 mail me hidden token (query me nahi dikh raha user ko)
  await sendMail(email, `${link}?session=${token}`);

  res.json({ message: "Reset link sent 📩" });
};
////////////////////////////// RESET PASSWORD
// exports.resetPassword = async (req, res) => {
//   try {
//     const { token } = req.params;
//     const { newPassword } = req.body;

//     const [rows] = await pool.query(
//       "SELECT * FROM users WHERE reset_token=?",
//       [token]
//     );

//     if (rows.length === 0) {
//       return res.status(400).json({ message: "Invalid link" });
//     }

//     const user = rows[0];

//     if (Date.now() > user.reset_expires) {
//       return res.status(400).json({ message: "Link expired" });
//     }

//     const hashedPassword = await bcrypt.hash(newPassword, 10);

//     await pool.query(
//       "UPDATE users SET password=?, reset_token=NULL, reset_expires=NULL WHERE id=?",
//       [hashedPassword, user.id]
//     );

//     res.json({ message: "Password updated" });

//   } catch (err) {
//     console.log(err);
//     res.status(500).json({ message: "Server error" });
//   }
// };

exports.resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  const email = resetStore[token];

  if (!email) {
    return res.status(400).json({ message: "Invalid link ❌" });
  }

  const hashed = await bcrypt.hash(newPassword, 10);

  await pool.query("UPDATE users SET password = ? WHERE email = ?", [
    hashed,
    email,
  ]);

  delete resetStore[token];

  res.json({ message: "Password updated successfully " });
};

exports.getAllLocations = async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM location");
    console.log("hi..");

    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};
