const express = require("express");
const cors = require("cors");
const userRoutes = require("./routes/userRoutes");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
require("./config/db");

const app = express();

//  MIDDLEWARES
// app.use(cors({
//   origin: "http://localhost:5173",
//   credentials: true
// }));
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));

app.use("/uploads", express.static("uploads"));

//  ROUTES
app.use("/api", userRoutes);

//  SERVER
app.listen(5000, () => {
  console.log("🚀 Server running on port 5000");
});
