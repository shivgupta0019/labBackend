const express = require("express");
const cors = require("cors");
const userRoutes = require("./routes/userRoutes");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
// const rateLimit = require("express-rate-limit");

require("./config/db");

const app = express();

//  GLOBAL LIMITER (IMPORTANT)
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 min
//   max: 200, // max 100 request per IP
//   message: "Too many requests, try again later"
// });

//  MIDDLEWARES
app.use(cors({
  origin: "http://localhost:5174",
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));
// app.use(limiter); 


app.use("/uploads", express.static("uploads"));

//  ROUTES
app.use("/api", userRoutes);

//  SERVER
app.listen(5000, () => {
  console.log("🚀 Server running on port 5000");
});