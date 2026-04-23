const oracledb = require("../config/db");
const { dbConfig } = require("../config/db");



exports.getProfile = async (req, res) => {
  let connection;

  try {
    const email = req.user.email;

    connection = await oracledb.getConnection(dbConfig);

    const result = await connection.execute(
      `
      SELECT 
        u.email,
        u.phone,
        p.full_name,
        p.dob,
        p.gender,
        p.city,
        p.state,
        p.address,
        p.bio,
        p.photo
      FROM users u
      LEFT JOIN user_profiles p
      ON u.email = p.user_email
      WHERE u.email = :1
      `,
      [email],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    res.json(result.rows[0]);

  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) await connection.close();
  }
};

//////////////////////
exports.updateProfile = async (req, res) => {
  let connection;

  try {
    const email = req.user.email;

    const {
      full_name,
      dob,
      gender,
      city,
      state,
      address,
      bio,
      photo
    } = req.body;

    connection = await oracledb.getConnection(dbConfig);

    await connection.execute(
      `
      MERGE INTO user_profiles p
      USING (SELECT :1 user_email FROM dual) d
      ON (p.user_email = d.user_email)

      WHEN MATCHED THEN UPDATE SET
        full_name = :2,
        dob = :3,
        gender = :4,
        city = :5,
        state = :6,
        address = :7,
        bio = :8,
        photo = :9,
        updated_at = SYSDATE

      WHEN NOT MATCHED THEN INSERT
        (user_email, full_name, dob, gender, city, state, address, bio, photo)
      VALUES
        (:1,:2,:3,:4,:5,:6,:7,:8,:9)
      `,
      [
        email,
        full_name,
        dob,
        gender,
        city,
        state,
        address,
        bio,
        photo
      ],
      { autoCommit: true }
    );

    res.json({ message: "Profile updated" });

  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  } finally {
    if (connection) await connection.close();
  }
};