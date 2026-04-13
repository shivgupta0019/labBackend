const mysql = require("mysql2/promise");
require("dotenv").config();
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: process.env.DB_CONNECTION_LIMIT || 10
});

// test connection
(async () => {
  try {
    const conn = await pool.getConnection();
    console.log(" MySQL Connected");
    conn.release();
  } catch (err) {
    console.log("❌ DB Error:", err.message);
  }
})();

module.exports = pool;   //