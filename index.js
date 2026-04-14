const express = require("express");
const cors = require("cors");
const userRoutes = require("./routes/userRoutes");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.use("/api", userRoutes);

app.listen(5000, () => {
  console.log(" Server running on port 5000");
});
