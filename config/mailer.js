const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "vsss12908@gmail.com",
    pass: "bygiuczokelhehdf", // App Password
  },
});

const sendOTP = async (email, otp) => {
  await transporter.sendMail({
    from: "vsss12908@gmail.com", 
    to: email,
    subject: "Your Login OTP",
    text: `Your OTP is: ${otp}`,
  });
};


module.exports = sendOTP;