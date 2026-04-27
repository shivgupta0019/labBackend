const bcrypt = require("bcrypt");
const userModel = require("../models/userModel");

async function signup(req, res) {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // duplicate check (email)
    const existing = await userModel.findUserByEmail(email);

    if (existing.length > 0) {
      return res.status(400).json({ message: "Email already registered" });
    }

    // hash password
    const hash = await bcrypt.hash(password, 10);

    // save user
    await userModel.createUser({
      name,
      email,
      phone,
      password: hash,
    });

    res.status(201).json({ message: "Signup Successful " });
  } catch (err) {
    console.log("ERROR ", err);
    res.status(500).json({ message: err.message });
  }
}

module.exports = { signup };
