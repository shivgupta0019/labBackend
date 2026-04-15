const express = require("express");
const router = express.Router();
const { signup } = require("../controllers/userController");
const { login, verifyOtp, resendOtp, forgotPassword, resetPassword, getUsers, updateUserRole, toggleAdmin, } = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/signup", signup);
router.post("/login", login);

router.post("/verify-otp", verifyOtp);
router.post("/resend-otp", resendOtp);

router.post("/forgot-password",forgotPassword);
router.post("/reset-password", resetPassword);

router.get("/users",getUsers );
router.put("/users/:id/role",updateUserRole);
router.post("/toggle-admin", toggleAdmin);
// router.get("/dashboard", authMiddleware, (req, res) => {
//   res.json({ message: "Welcome Vishal" });
// });

module.exports = router;