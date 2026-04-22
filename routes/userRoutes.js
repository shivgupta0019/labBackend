const express = require("express");
const router = express.Router();
const { signup } = require("../controllers/userController");
const { login, verifyOtp, resendOtp, forgotPassword, resetPassword, getUsers, updateUserRole, toggleAdmin, logout, } = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");
const rateLimit = require("express-rate-limit");

const otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 min
  max: 20, // max 5 attempts
  message: "Too many attempts, try again after 5 minutes",
});


router.post("/signup", signup);
router.post("/login", login);

router.post("/verify-otp", verifyOtp);
router.post("/resend-otp",otpLimiter, resendOtp);

router.post("/forgot-password",forgotPassword);
router.post("/reset-password", resetPassword);

router.get("/users",authMiddleware,getUsers );
router.put("/users/:id/role",authMiddleware,updateUserRole);
router.post("/toggle-admin",authMiddleware, toggleAdmin);

router.post("/logout", authMiddleware, logout);

module.exports = router;