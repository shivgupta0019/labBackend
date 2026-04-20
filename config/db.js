const oracledb = require("oracledb");
require("dotenv").config();

// Configure thin client (no native Oracle Client libraries needed for remote connections)
oracledb.connectionClass = "NODEJS";

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectString: process.env.DB_CONNECT_STRING,
};

// Test connection
(async () => {
  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig);
    console.log("✅ Oracle DB Connected");
  } catch (err) {
    console.log("❌ DB Error:", err.message);
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.log("❌ Close Error:", err.message);
      }
    }
  }
})();

module.exports = oracledb;
module.exports.dbConfig = dbConfig;
