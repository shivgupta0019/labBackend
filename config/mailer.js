const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "vsss12908@gmail.com",
    pass: "bygiuczokelhehdf", // App Password
  },
});

//  OTP MAIL
const sendOTP = async (email, otp) => {
  await transporter.sendMail({
    from: "vsss12908@gmail.com",
    to: email,
    subject: "Your Login OTP",
    text: `Your OTP is: ${otp}`,
  });
};

//  RESET PASSWORD MAIL
const sendMail = async (email, resetLink) => {
  await transporter.sendMail({
    from: "vsss12908@gmail.com",
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