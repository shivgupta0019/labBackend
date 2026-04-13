const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "Vishal@630696",
  database: "centraldb",
  waitForConnections: true,
  connectionLimit: 10
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