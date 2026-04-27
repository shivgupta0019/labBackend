const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // App Password
  },
});

//  OTP MAIL
const sendOTP = async (email, otp) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your Login OTP",
      text: `Your OTP is: ${otp}`,
    });
    console.log("✅ OTP sent");
  } catch (err) {
    console.log("❌ MAIL ERROR:", err);
  }
};

//  RESET PASSWORD MAIL
const sendMail = async (email, resetLink) => {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Reset Password",
    html: `
      <h3>Click below to reset password:</h3>
      <a href="${resetLink}">Reset Password</a>
    `,
  });
};

//  EXPORT BOTH
module.exports = { sendOTP, sendMail };
