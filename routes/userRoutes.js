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
  logout,
} = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");
const {
  adminTrf,
  allTrf,
  getTrfById,
  updateTrf,
  deleteTrf,
  getTrfForUserFill,
  fillTrfValues,
  getFilledTrfs,
} = require("../controllers/useTrf");


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
const { getProfile, updateProfile } = require("../controllers/profileController");
const profileMiddleware = require("../middleware/profileMiddleware");
const upload = require("../middleware/upload");

router.post("/signup", signup);
router.post("/login", login);

router.post("/verify-otp", verifyOtp);
router.post("/resend-otp", resendOtp);

router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

router.get("/users", authMiddleware, getUsers);
router.put("/users/:id/role", authMiddleware, updateUserRole);
router.post("/toggle-admin", authMiddleware, toggleAdmin);

router.get("/profile",profileMiddleware,getProfile);
router.put("/profile",profileMiddleware,upload.single("photo"),updateProfile);

router.post("/logout", authMiddleware, logout);


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

//trf
router.post("/trf", adminTrf);
router.get("/trf", allTrf);
router.get("/trf/filled", getFilledTrfs);

// ⚠️ Yeh line PEHLE honi chahiye
router.get("/trf/user/:id", getTrfForUserFill);
router.patch("/trf/:id/fill", fillTrfValues);

// Yeh lines BAAD MEIN
router.get("/trf/:id", getTrfById);
router.put("/trf/:id", updateTrf);
router.delete("/trf/:id", deleteTrf);

module.exports = router;
