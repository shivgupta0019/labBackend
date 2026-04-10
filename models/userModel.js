const pool = require("../config/db");

// create user
async function createUser(user) {
  const { name, email, phone, password } = user;

  const [result] = await pool.query(
    "INSERT INTO users (name, email, phone, password) VALUES (?, ?, ?, ?)",
    [name, email, phone, password]
  );

  return result;
}

// 🔥 find user by email
async function findUserByEmail(email) {
  const [rows] = await pool.query(
    "SELECT * FROM users WHERE email = ?",
    [email]
  );

  return rows;
}

// 🔥 IMPORTANT EXPORT
module.exports = {
  createUser,
  findUserByEmail
};