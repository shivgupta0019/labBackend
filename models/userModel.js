const oracledb = require("../config/db");
const { dbConfig } = require("../config/db");

// create user
async function createUser(user) {
  const { name, email, phone, password } = user;
  let connection;

  try {
    connection = await oracledb.getConnection(dbConfig);

    const result = await connection.execute(
      "INSERT INTO users (name, email, phone, password) VALUES (:1, :2, :3, :4)",
      [name, email, phone, password],
      { autoCommit: true },
    );

    return result;
  } catch (err) {
    console.error("❌ Error creating user:", err.message);
    throw err;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error("❌ Error closing connection:", err.message);
      }
    }
  }
}

// 🔥 find user by email
async function findUserByEmail(email) {
  let connection;

  try {
    connection = await oracledb.getConnection(dbConfig);

    const result = await connection.execute(
      "SELECT * FROM users WHERE email = :1",
      [email],
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );

    return result.rows || [];
  } catch (err) {
    console.error("❌ Error finding user:", err.message);
    throw err;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error("❌ Error closing connection:", err.message);
      }
    }
  }
}

// 🔥 IMPORTANT EXPORT
module.exports = {
  createUser,
  findUserByEmail,
};
