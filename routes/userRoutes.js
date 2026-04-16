const express = require("express");
const router = express.Router();
const { signup } = require("../controllers/userController");
const {
  login,
  verifyOtp,
  resendOtp,
  forgotPassword,
  resetPassword,
  getAllLocations,
} = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/signup", signup);
router.post("/login", login);
router.post("/verify-otp", verifyOtp);
router.post("/resend-otp", resendOtp);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.get("/", (req, res) => {
  res.send("<h1>Hello</h1>");
});
router.get("/locations", getAllLocations);
// router.get("/dashboard", authMiddleware, (req, res) => {
//   res.json({ message: "Welcome Vishal" });
// });

module.exports = router;
