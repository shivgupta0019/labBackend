const oracledb = require("oracledb");
const { dbConfig } = require("../config/db");

// ========== Helper: Generate TRF Code ==========
async function generateTrfCode(connection) {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const result = await connection.execute(
    `SELECT COUNT(*) as cnt FROM trf_requests WHERE TRUNC(created_at) = TRUNC(SYSDATE)`,
  );
  const count = result.rows[0][0];
  const seq = String(count + 1).padStart(3, "0");
  return `TRF-${dateStr}-${seq}`;
}

// ========== 1. CREATE TRF (POST /api/trf) ==========
exports.adminTrf = async (req, res) => {
  const {
    companyId,
    requestName,
    labId,
    productId,
    lotNo,
    remark,
    createdBy,
    selectedTests,
  } = req.body;
  if (
    !companyId ||
    !requestName ||
    !labId ||
    !productId ||
    !selectedTests ||
    !selectedTests.length
  ) {
    return res
      .status(400)
      .json({ error: "Missing required fields or no tests selected" });
  }
  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig);
    const trfCode = await generateTrfCode(connection);
    const trfResult = await connection.execute(
      `INSERT INTO trf_requests 
       (trf_code, company_id, request_name, lab_id, product_id, lot_no, remark, status, created_by)
       VALUES (:trf_code, :company_id, :request_name, :lab_id, :product_id, :lot_no, :remark, 'not_filled', :created_by)
       RETURNING id INTO :trf_id`,
      {
        trf_code: trfCode,
        company_id: companyId,
        request_name: requestName,
        lab_id: labId,
        product_id: productId,
        lot_no: lotNo,
        remark: remark,
        created_by: createdBy,
        trf_id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      },
    );
    const trfId = trfResult.outBinds.trf_id[0];
    for (const test of selectedTests) {
      if (!test.testId)
        throw new Error("Each selected test must have a testId");
      const stResult = await connection.execute(
        `INSERT INTO trf_selected_tests (trf_id, test_id) VALUES (:trf_id, :test_id) RETURNING id INTO :selected_id`,
        {
          trf_id: trfId,
          test_id: test.testId,
          selected_id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        },
      );
      const selectedTestId = stResult.outBinds.selected_id[0];
      for (let i = 0; i < test.fields.length; i++) {
        const f = test.fields[i];
        // Store custom_label for both predefined and custom fields
        await connection.execute(
          `INSERT INTO trf_test_fields 
           (trf_selected_id, field_id, custom_label, placeholder, is_predefined, sort_order)
           VALUES (:selected_id, :field_id, :custom_label, :placeholder, :is_predefined, :sort_order)`,
          {
            selected_id: selectedTestId,
            field_id: f.isPredefined ? f.fieldId : null,
            custom_label: f.customLabel, // label from frontend (actual field name)
            placeholder: f.placeholder,
            is_predefined: f.isPredefined ? 1 : 0,
            sort_order: i,
          },
        );
      }
    }
    // await connection.execute("COMMIT");
    await connection.commit();
    res.status(201).json({ success: true, trfCode, trfId });
  } catch (err) {
    // if (connection) await connection.execute("ROLLBACK");
    if (connection) await connection.rollback();
    console.error("TRF Creation Error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
};

// ========== 2. GET ALL TRFs (for admin table & user list) ==========

exports.allTrf = async (req, res) => {
  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig);
    const trfRows = await connection.execute(
      `SELECT 
         tr.id, tr.trf_code, tr.request_name, tr.lot_no, tr.remark,
         tr.status, tr.created_at, tr.updated_at,
         c.company_name,
         p.product_name, p.product_id AS sample_code,
         l.lab_name, l.lab_code, l.lab_type
       FROM trf_requests tr
       JOIN company c ON c.id = tr.company_id
       JOIN product p ON p.id = tr.product_id
       JOIN lab l ON l.id = tr.lab_id
       ORDER BY tr.created_at DESC`,
    );
    const trfList = [];
    for (const row of trfRows.rows) {
      const trfId = row[0];
      // Fetch test names (for quick display)
      const testNamesResult = await connection.execute(
        `SELECT DISTINCT ts.test_name
         FROM trf_selected_tests st
         JOIN tests ts ON ts.id = st.test_id
         WHERE st.trf_id = :trfId
         ORDER BY ts.test_name`,
        { trfId },
      );
      const testNames = testNamesResult.rows.map((r) => r[0]);

      // Fetch fields with priority to custom_label
      const fieldsResult = await connection.execute(
        `SELECT st.test_id, 
                tf.custom_label,
                tf.placeholder,
                tf.is_predefined,
                tf.field_id,
                tfl.label AS predefined_label
         FROM trf_selected_tests st
         JOIN trf_test_fields tf ON tf.trf_selected_id = st.id
         LEFT JOIN test_fields tfl ON tfl.id = tf.field_id
         WHERE st.trf_id = :trfId
         ORDER BY st.id, tf.sort_order`,
        { trfId },
      );

      const testMap = new Map();
      for (const f of fieldsResult.rows) {
        const testId = f[0];
        const customLabel = f[1]; // stored from frontend (actual field name)
        const placeholder = f[2];
        const isPredefined = f[3] === 1;
        const fieldId = f[4];
        const predefinedLabel = f[5];

        // 🔥 PRIORITY: customLabel (frontend name) first, then predefinedLabel from join
        let label = null;
        if (isPredefined) {
          label = customLabel || predefinedLabel || null;
        } else {
          label = customLabel; // custom fields store the name directly
        }

        if (!testMap.has(testId)) testMap.set(testId, { testId, fields: [] });
        testMap.get(testId).fields.push({
          customLabel: null, // not needed in response
          placeholder,
          isPredefined,
          fieldId: isPredefined ? fieldId : null,
          label, // ✅ correct label now
        });
      }
      trfList.push({
        id: trfId,
        trfCode: row[1],
        requestName: row[2],
        lotNo: row[3],
        remark: row[4],
        status: row[5],
        createdAt: row[6],
        updatedAt: row[7],
        companyName: row[8],
        productName: row[9],
        sampleCode: row[10],
        labName: row[11],
        labCode: row[12],
        labType: row[13],
        testNames,
        selectedTests: Array.from(testMap.values()),
      });
    }
    res.json(trfList);
  } catch (err) {
    console.error("Error fetching TRF list:", err);
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
};

exports.getTrfById = async (req, res) => {
  const trfId = parseInt(req.params.id, 10);
  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig);
    const mainResult = await connection.execute(
      `SELECT company_id, request_name, lab_id, product_id, lot_no, remark, created_by
       FROM trf_requests WHERE id = :id`,
      { id: trfId },
    );
    if (mainResult.rows.length === 0)
      return res.status(404).json({ error: "TRF not found" });
    const row = mainResult.rows[0];
    const trfData = {
      companyId: row[0],
      requestName: row[1],
      labId: row[2],
      productId: row[3],
      lotNo: row[4],
      remark: row[5],
      createdBy: row[6],
    };
    const fieldsResult = await connection.execute(
      `SELECT st.test_id, tf.custom_label, tf.placeholder, tf.is_predefined, tf.field_id
       FROM trf_selected_tests st
       JOIN trf_test_fields tf ON tf.trf_selected_id = st.id
       WHERE st.trf_id = :trfId
       ORDER BY st.id, tf.sort_order`,
      { trfId },
    );
    const testMap = new Map();
    for (const f of fieldsResult.rows) {
      const testId = f[0];
      const label = f[1];
      const placeholder = f[2];
      const isPredefined = f[3] === 1;
      const fieldId = f[4];
      if (!testMap.has(testId)) testMap.set(testId, { testId, fields: [] });
      testMap.get(testId).fields.push({
        customLabel: isPredefined ? null : label, // for custom fields, label is the custom name
        placeholder,
        isPredefined,
        fieldId: isPredefined ? fieldId : null,
        label: isPredefined ? label : null, // for predefined, label is the field name
      });
    }
    trfData.selectedTests = Array.from(testMap.values());
    res.json(trfData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
};

// ========== 4. UPDATE TRF (PUT /api/trf/:id) ==========
exports.updateTrf = async (req, res) => {
  const trfId = parseInt(req.params.id, 10);
  const { requestName, lotNo, remark, createdBy, selectedTests } = req.body;

  if (!requestName || !selectedTests || !selectedTests.length) {
    return res
      .status(400)
      .json({ error: "Missing required fields or no tests selected" });
  }
  // validate testId presence
  for (let i = 0; i < selectedTests.length; i++) {
    if (!selectedTests[i].testId) {
      return res
        .status(400)
        .json({ error: `selectedTests[${i}] missing testId` });
    }
  }

  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig);
    const existing = await connection.execute(
      `SELECT company_id, lab_id, product_id FROM trf_requests WHERE id = :id`,
      { id: trfId },
    );
    if (existing.rows.length === 0)
      return res.status(404).json({ error: "TRF not found" });
    const [companyId, labId, productId] = existing.rows[0];

    await connection.execute(
      `UPDATE trf_requests 
       SET company_id = :companyId, request_name = :requestName, lab_id = :labId,
           product_id = :productId, lot_no = :lotNo, remark = :remark,
           created_by = :createdBy, updated_at = CURRENT_TIMESTAMP
       WHERE id = :trfId`,
      {
        companyId,
        requestName,
        labId,
        productId,
        lotNo: lotNo || null,
        remark: remark || null,
        createdBy: createdBy || "admin@example.com",
        trfId,
      },
    );

    // Delete children
    await connection.execute(
      `DELETE FROM trf_test_fields WHERE trf_selected_id IN (SELECT id FROM trf_selected_tests WHERE trf_id = :trfId)`,
      { trfId },
    );
    await connection.execute(
      `DELETE FROM trf_selected_tests WHERE trf_id = :trfId`,
      { trfId },
    );

    // Re-insert all tests and fields (including custom fields with values)
    for (const test of selectedTests) {
      const stResult = await connection.execute(
        `INSERT INTO trf_selected_tests (trf_id, test_id) VALUES (:trfId, :testId) RETURNING id INTO :selectedId`,
        {
          trfId,
          testId: test.testId,
          selectedId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        },
      );
      const selectedTestId = stResult.outBinds.selectedId[0];
      for (let i = 0; i < test.fields.length; i++) {
        const f = test.fields[i];
        await connection.execute(
          `INSERT INTO trf_test_fields 
           (trf_selected_id, field_id, custom_label, placeholder,  is_predefined, sort_order, field_value)
           VALUES (:selectedId, :fieldId, :customLabel, :placeholder,  :isPredefined, :sortOrder, :fieldValue)`,
          {
            selectedId: selectedTestId,
            fieldId: f.isPredefined ? f.fieldId : null,
            customLabel: f.isPredefined
              ? f.customLabel
              : f.customLabel || f.fieldName,
            placeholder: f.placeholder,

            isPredefined: f.isPredefined ? 1 : 0,
            sortOrder: i,
            fieldValue: f.fieldValue !== undefined ? f.fieldValue : null,
          },
        );
      }
    }

    await connection.commit();
    res.json({ success: true, message: "TRF updated successfully" });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Update error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
};

exports.deleteTrf = async (req, res) => {
  const trfId = parseInt(req.params.id, 10);

  if (isNaN(trfId)) {
    return res.status(400).json({ success: false, error: "Invalid ID" });
  }

  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig);

    // Step 1: Check if TRF exists
    const checkResult = await connection.execute(
      `SELECT id FROM trf_requests WHERE id = :id`,
      { id: trfId },
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: "TRF not found" });
    }

    // Step 2: Delete child records first (FK constraint)
    await connection.execute(
      `DELETE FROM trf_test_fields 
       WHERE trf_selected_id IN (
         SELECT id FROM trf_selected_tests WHERE trf_id = :id
       )`,
      { id: trfId },
    );

    // Step 3: Delete selected tests
    await connection.execute(
      `DELETE FROM trf_selected_tests WHERE trf_id = :id`,
      { id: trfId },
    );

    // Step 4: Now delete the main TRF record
    await connection.execute(`DELETE FROM trf_requests WHERE id = :id`, {
      id: trfId,
    });

    await connection.commit();

    res
      .status(200)
      .json({ success: true, message: "TRF deleted successfully" });
  } catch (err) {
    console.error("Delete TRF error:", err);
    if (connection) {
      try {
        await connection.rollback();
      } catch (e) {
        console.error(e);
      }
    }
    res.status(500).json({ success: false, error: err.message });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (e) {
        console.error(e);
      }
    }
  }
};

// ========== 6. GET TRF FOR USER FILL (with fields grouped by test) ==========
exports.getTrfForUserFill = async (req, res) => {
  const trfId = parseInt(req.params.id, 10);
  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig);
    const mainResult = await connection.execute(
      `SELECT tr.id, tr.trf_code, tr.request_name, tr.lot_no, tr.remark, tr.status, tr.created_at, tr.updated_at,
              c.company_name, c.company_code,
              l.lab_name, l.lab_code, l.lab_type,
              p.product_name, p.product_id as sample_code
       FROM trf_requests tr
       JOIN company c ON c.id = tr.company_id
       JOIN lab l ON l.id = tr.lab_id
       JOIN product p ON p.id = tr.product_id
       WHERE tr.id = :id`,
      { id: trfId },
    );
    if (mainResult.rows.length === 0) {
      return res.status(404).json({ error: "TRF not found" });
    }
    const row = mainResult.rows[0];
    const trfInfo = {
      id: row[0],
      trfCode: row[1],
      requestName: row[2],
      lotNo: row[3],
      remark: row[4],
      status: row[5],
      createdAt: row[6],
      updatedAt: row[7],
      companyName: row[8],
      companyCode: row[9],
      labName: row[10],
      labCode: row[11],
      labType: row[12],
      productName: row[13],
      sampleCode: row[14],
    };

    // 🔥 Use stored custom_label as the label (it contains the actual field name from frontend)
    const fieldsResult = await connection.execute(
      `SELECT tf.id AS field_row_id, ts.test_name,
              tf.custom_label AS label,
              tf.placeholder, tf.field_value AS current_value, tf.is_predefined,
              tf.field_id
       FROM trf_test_fields tf
       JOIN trf_selected_tests st ON st.id = tf.trf_selected_id
       JOIN tests ts ON ts.id = st.test_id
       WHERE st.trf_id = :trfId
       ORDER BY st.id, tf.sort_order`,
      { trfId },
    );

    const fieldsByTest = {};
    for (const f of fieldsResult.rows) {
      const testName = f[1];
      let label = f[2] || "Unnamed Field"; // custom_label holds the actual name
      const placeholder = f[3] || "Enter value";
      const currentValue = f[4] || "";
      const isPredefined = f[5] === 1;
      const fieldId = f[6]; // may be test_id or field_id, keep as is

      if (!fieldsByTest[testName]) fieldsByTest[testName] = [];
      fieldsByTest[testName].push({
        fieldRowId: f[0],
        label,
        placeholder,
        currentValue,
        isPredefined,
        fieldId, // optional, for reference
      });
    }

    res.json({ trf: trfInfo, fieldsByTest });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
};

exports.fillTrfValues = async (req, res) => {
  const trfId = parseInt(req.params.id, 10);
  const { fields } = req.body;

  if (!fields || !Array.isArray(fields)) {
    return res.status(400).json({ error: "Missing or invalid fields array" });
  }

  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig);

    // ✅ BEGIN hata do - Oracle auto transaction start karta hai

    for (const item of fields) {
      await connection.execute(
        `UPDATE trf_test_fields 
         SET field_value = :value, filled_at = CURRENT_TIMESTAMP 
         WHERE id = :fieldRowId`,
        { value: item.value || null, fieldRowId: item.fieldRowId },
      );
    }

    const checkResult = await connection.execute(
      `SELECT COUNT(*) as total, 
              SUM(CASE WHEN field_value IS NOT NULL THEN 1 ELSE 0 END) as filled_count
       FROM trf_test_fields 
       WHERE trf_selected_id IN (
         SELECT id FROM trf_selected_tests WHERE trf_id = :trfId
       )`,
      { trfId },
    );

    const total = checkResult.rows[0][0];
    const filledCount = checkResult.rows[0][1];
    const allFilled = total === filledCount;

    await connection.execute(
      `UPDATE trf_requests 
       SET status = :status, updated_at = CURRENT_TIMESTAMP 
       WHERE id = :trfId`,
      { status: allFilled ? "filled" : "not_filled", trfId },
    );

    // ✅ Ek hi commit - sab kuch ek saath commit hoga
    await connection.commit();

    res.json({
      success: true,
      status: allFilled ? "filled" : "not_filled",
      allFilled,
    });
  } catch (err) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (e) {
        console.error(e);
      }
    }
    console.error("Fill TRF error:", err);
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (e) {
        console.error(e);
      }
    }
  }
};

// ========== 8. GET ONLY FILLED TRFs (for reports) ==========
exports.getFilledTrfs = async (req, res) => {
  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig);
    const trfRows = await connection.execute(
      `SELECT 
         tr.id, tr.trf_code, tr.request_name, tr.lot_no, tr.remark,
         tr.status, tr.created_at, tr.updated_at,
         c.company_name,
         p.product_name, p.product_id AS sample_code,
         l.lab_name, l.lab_code, l.lab_type
       FROM trf_requests tr
       JOIN company c ON c.id = tr.company_id
       JOIN product p ON p.id = tr.product_id
       JOIN lab l ON l.id = tr.lab_id
       WHERE tr.status = 'filled'
       ORDER BY tr.created_at DESC`,
    );
    const trfList = [];
    for (const row of trfRows.rows) {
      const trfId = row[0];
      // Fetch test names (for quick display)
      const testNamesResult = await connection.execute(
        `SELECT DISTINCT ts.test_name
         FROM trf_selected_tests st
         JOIN tests ts ON ts.id = st.test_id
         WHERE st.trf_id = :trfId
         ORDER BY ts.test_name`,
        { trfId },
      );
      const testNames = testNamesResult.rows.map((r) => r[0]);
      // Fetch fields (label is stored in custom_label)
      const fieldsResult = await connection.execute(
        `SELECT st.test_id, tf.custom_label, tf.placeholder, tf.is_predefined, tf.field_id
         FROM trf_selected_tests st
         JOIN trf_test_fields tf ON tf.trf_selected_id = st.id
         WHERE st.trf_id = :trfId
         ORDER BY st.id, tf.sort_order`,
        { trfId },
      );
      const testMap = new Map();
      for (const f of fieldsResult.rows) {
        const testId = f[0];
        const label = f[1];
        const placeholder = f[2];
        const isPredefined = f[3] === 1;
        const fieldId = f[4];
        if (!testMap.has(testId)) testMap.set(testId, { testId, fields: [] });
        testMap.get(testId).fields.push({
          customLabel: null,
          placeholder,
          isPredefined,
          fieldId: isPredefined ? fieldId : null,
          label,
        });
      }
      trfList.push({
        id: trfId,
        trfCode: row[1],
        requestName: row[2],
        lotNo: row[3],
        remark: row[4],
        status: row[5],
        createdAt: row[6],
        updatedAt: row[7],
        companyName: row[8],
        productName: row[9],
        sampleCode: row[10],
        labName: row[11],
        labCode: row[12],
        labType: row[13],
        testNames,
        selectedTests: Array.from(testMap.values()),
      });
    }
    res.json(trfList);
  } catch (err) {
    console.error("Error fetching filled TRFs:", err);
    res.status(500).json({ error: err.message });
  } finally {
    if (connection) await connection.close();
  }
};
