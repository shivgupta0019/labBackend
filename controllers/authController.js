const pool = require("../config/db");
const bcrypt = require("bcryptjs");
const sendOTP = require("../config/mailer");
const jwt =  require("jsonwebtoken");
const crypto = require("crypto");

let otpStore = {}; // temp store

//  LOGIN
exports.login = async (req, res) => {
  console.log("LOGIN HIT 🔥");
  console.log(req.body);

  try {
    const { email, password } = req.body;

    const [rows] = await pool.query(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

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
      expiresAt: Date.now() + 5 * 60 * 1000 // 5 min
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

 const token = jwt.sign(
  { email },
  "secretKey",
  { expiresIn: "1h" }
);

res.json({
  message: "Login Successful",
  token: token
});
};


exports.resendOtp = async (req, res) => {
  const { email } = req.body;

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  otpStore[email] = {
    otp: otp,
    expiresAt: Date.now() + 5 * 60 * 1000
  };

  await sendOTP(email, otp);

  res.json({ message: "OTP resent to email" });
};






