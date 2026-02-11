import { db } from "./db_config.js";

async function optimizeDatabase() {
  console.log("⚠️  OPTIMIZING DATABASE (Removing QR_CODE Table)...");

  try {
    // ---------------------------------------------------------
    // STEP 1: DROP OLD TABLES
    // ---------------------------------------------------------
    await db.execute("DROP TABLE IF EXISTS USER");
    await db.execute("DROP TABLE IF EXISTS GUARDIAN_NAME");
    await db.execute("DROP TABLE IF EXISTS QR_CODE"); // 🗑️ Deleting the unnecessary table
    console.log("✅ Dropped old tables (USER, GUARDIAN, QR_CODE).");

    // ---------------------------------------------------------
    // STEP 2: CREATE GUARDIAN TABLE
    // Removed: qr_id
    // ---------------------------------------------------------
    await db.execute(`
      CREATE TABLE GUARDIAN_NAME (
        guardian_id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name VARCHAR(50) NOT NULL,
        last_name VARCHAR(50) NOT NULL,
        middle_initial VARCHAR(5),
        relationship VARCHAR(50),
        email VARCHAR(255),
        contact_number VARCHAR(20),
        address VARCHAR(255),
        password VARCHAR(255)
      );
    `);
    console.log("✅ Created GUARDIAN_NAME table (Clean).");

    // ---------------------------------------------------------
    // STEP 3: CREATE USER TABLE
    // Removed: qr_id, age
    // ---------------------------------------------------------
    await db.execute(`
      CREATE TABLE USER (
        user_id INTEGER PRIMARY KEY AUTOINCREMENT,
        guardian_id INT,
        first_name VARCHAR(50) NOT NULL,
        last_name VARCHAR(50) NOT NULL,
        middle_initial VARCHAR(5),
        email VARCHAR(255),
        contact_number VARCHAR(20),
        address VARCHAR(255),
        birth_date DATE,
        password VARCHAR(255),
        FOREIGN KEY (guardian_id) REFERENCES GUARDIAN_NAME(guardian_id)
      );
    `);
    console.log("✅ Created USER table (Clean).");

  } catch (error) {
    console.error("❌ ERROR:", error.message);
  }

  // ---------------------------------------------------------
  // STEP 4: VERIFICATION
  // ---------------------------------------------------------
  try {
    const tables = await db.execute("SELECT name FROM sqlite_schema WHERE type='table' AND name='QR_CODE'");
    
    console.log("\n🔍 Verification Results:");
    if (tables.rows.length === 0) {
        console.log("✅ SUCCESS: 'QR_CODE' table is gone.");
    } else {
        console.error("❌ ERROR: 'QR_CODE' table still exists.");
    }

    const userCols = (await db.execute("PRAGMA table_info(USER)")).rows.map(c => c.name);
    if (!userCols.includes("qr_id")) {
        console.log("✅ SUCCESS: 'qr_id' column removed from USER.");
    }

  } catch (err) {
    console.error("❌ Verification Failed:", err.message);
  }
}

optimizeDatabase();