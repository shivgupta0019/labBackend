const express = require("express");
const router = express.Router();
const { signup } = require("../controllers/userController");
const {
  login,
  verifyOtp,
  resendOtp,
  forgotPassword,
  resetPassword,
  getUsers,
  updateUserRole,
  toggleAdmin,
} = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");
const {
  allCompanies,
  getAllCompanies,
  updateCompany,
  deleteCompany,
  allLabs,
  getAllLabs,
  updateLab,
  deleteLab,
  allProducts,
  deleteProduct,
  getAllProducts,
  getAllTest,
  createTest,
} = require("../controllers/useAdminLab");

router.post("/signup", signup);
router.post("/login", login);

router.post("/verify-otp", verifyOtp);
router.post("/resend-otp", resendOtp);

router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

router.get("/users", getUsers);
router.put("/users/:id/role", updateUserRole);
router.post("/toggle-admin", toggleAdmin);
//lab routes
router.post("/companies", allCompanies);
router.get("/getCompanies", getAllCompanies);
router.put("/companies/:id", updateCompany);
router.delete("/companies/:id", deleteCompany);
router.post("/labs", allLabs);
router.get("/labs", getAllLabs);
router.put("/labs/:id", updateLab);
router.delete("/labs/:id", deleteLab);
router.post("/products", allProducts);
router.get("/products", getAllProducts);
router.delete("/products/:id", deleteProduct);
router.get("/tests", getAllTest);
router.post("/create-test", createTest);
// router.get("/dashboard", authMiddleware, (req, res) => {
//   res.json({ message: "Welcome Vishal" });
// });

module.exports = router;
