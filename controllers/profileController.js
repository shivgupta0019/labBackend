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
      WHERE u.email = :email
      `,
      { email },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );

    const row = result.rows[0] || {};

    // ✅ PHOTO FIX (NO [object Object])
    let photo = "";
    if (row.PHOTO) {
      if (typeof row.PHOTO === "string") {
        photo = row.PHOTO;
      } else if (row.PHOTO.getData) {
        // 🔥 agar CLOB hai to proper read karo
        photo = await row.PHOTO.getData();
      }
    }

    // ✅ DOB FIX
    const dob = row.DOB ? row.DOB.toISOString() : "";

    res.json({
      email: row.EMAIL || "",
      phone: row.PHONE || "",
      full_name: row.FULL_NAME || "",
      dob: dob,
      gender: row.GENDER || "",
      city: row.CITY || "",
      state: row.STATE || "",
      address: row.ADDRESS || "",
      bio: row.BIO || "",
      photo: photo, // ✅ correct string
    });
  } catch (err) {
    console.log("❌ GET ERROR:", err);
    res.status(500).json({ message: err.message });
  } finally {
    if (connection) await connection.close();
  }
};
exports.getProfile1 = async (req, res) => {
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
      WHERE u.email = :email
      `,
      { email },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );

    const row = result.rows[0] || {};

    // 🔥 CLOB FIX
    let photo = null;
    if (row.PHOTO) {
      if (typeof row.PHOTO === "string") {
        photo = row.PHOTO;
      } else {
        photo = row.PHOTO.toString();
      }
    }

    // 🔥 DATE FIX
    let dob = "";
    if (row.DOB) {
      dob: row.DOB ? row.DOB.toISOString() : "";
    }

    res.json({
      email: row.EMAIL || "",
      phone: row.PHONE || "",
      full_name: row.FULL_NAME || "",
      dob: row.DOB ? row.DOB.toISOString() : "", // ✅ FIX
      gender: row.GENDER || "",
      city: row.CITY || "",
      state: row.STATE || "",
      address: row.ADDRESS || "",
      bio: row.BIO || "",
      photo: photo,
    });
  } catch (err) {
    console.log("❌ GET ERROR:", err);
    res.status(500).json({ message: err.message });
  } finally {
    if (connection) await connection.close();
  }
};
//////////////////////
exports.updateProfile = async (req, res) => {
  let connection;

  try {
    const user = req.user;

    const { full_name, dob, gender, city, state, address, bio } = req.body;

    // ✅ FILE HANDLE (IMPORTANT)
    const photo = req.file ? `/uploads/${req.file.filename}` : null;

    connection = await oracledb.getConnection(dbConfig);

    const query = `
MERGE INTO user_profiles p
USING (SELECT :user_email user_email FROM dual) d
ON (p.user_email = d.user_email)

WHEN MATCHED THEN UPDATE SET
  p.full_name = :full_name,
  p.dob = CASE 
            WHEN :dob IS NULL OR :dob = '' 
            THEN NULL 
            ELSE TO_DATE(:dob, 'YYYY-MM-DD') 
          END,
  p.gender = :gender,
  p.city = :city,
  p.state = :state,
  p.address = :address,
  p.bio = :bio,
  p.photo = NVL(:photo, p.photo), -- 🔥 old image preserve
  p.updated_at = SYSDATE

WHEN NOT MATCHED THEN INSERT
  (user_email, full_name, dob, gender, city, state, address, bio, photo)
VALUES
  (
    :user_email,
    :full_name,
    CASE 
      WHEN :dob IS NULL OR :dob = '' 
      THEN NULL 
      ELSE TO_DATE(:dob, 'YYYY-MM-DD') 
    END,
    :gender, :city, :state, :address, :bio, :photo
  )
`;

    const binds = {
      user_email: user.email,
      full_name: full_name || "",
      dob: dob || null,
      gender: gender || "",
      city: city || "",
      state: state || "",
      address: address || "",
      bio: bio || "",
      photo: photo, //  important
    };

    await connection.execute(query, binds, { autoCommit: true });

    res.json({ message: "Profile updated successfully" });
  } catch (err) {
    console.log("❌ ERROR FULL:", err); //  full error dekh
    res.status(500).json({ message: err.message }); //  real error show
  } finally {
    if (connection) await connection.close();
  }
};
