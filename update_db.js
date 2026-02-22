import { db } from "./db_config.js";

async function createSecurityTable() {
  console.log("🛠️ Creating SECURITY_QUESTIONS table...");

  try {
    // We use a CHECK constraint to ensure that a row belongs to 
    // EITHER a User OR a Guardian, never both, and never neither.
    await db.execute(`
      CREATE TABLE IF NOT EXISTS SECURITY_QUESTIONS (
        security_id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INT,
        guardian_id INT,
        question_1 VARCHAR(255) NOT NULL,
        answer_1 VARCHAR(255) NOT NULL,
        question_2 VARCHAR(255) NOT NULL,
        answer_2 VARCHAR(255) NOT NULL,
        question_3 VARCHAR(255) NOT NULL,
        answer_3 VARCHAR(255) NOT NULL,
        FOREIGN KEY (user_id) REFERENCES USER(user_id) ON DELETE CASCADE,
        FOREIGN KEY (guardian_id) REFERENCES GUARDIAN_NAME(guardian_id) ON DELETE CASCADE,
        CHECK (
            (user_id IS NOT NULL AND guardian_id IS NULL) OR 
            (user_id IS NULL AND guardian_id IS NOT NULL)
        )
      );
    `);
    console.log("✅ SUCCESS: SECURITY_QUESTIONS table created.");
    
  } catch (error) {
    console.error("❌ CREATE FAILED:", error.message);
  }

  // Verification
  try {
    const info = await db.execute("PRAGMA table_info(SECURITY_QUESTIONS)");
    if (info.rows.length > 0) {
        console.log("\n🔍 Table Structure Verified:");
        info.rows.forEach(col => console.log(`   - ${col.name} (${col.type})`));
    } else {
        console.error("❌ ERROR: Table was not created.");
    }
  } catch (err) {
    console.error("❌ Verification Failed:", err.message);
  }
}

createSecurityTable();