const { db } = require('./db_config.js');

async function addDateToPeriodicals() {
    console.log("📅 Adding 'date_added' column to PERIODICAL_COPY (Workaround)...");

    try {
        // STEP 1: Add the column WITHOUT the default constraint first
        await db.execute("ALTER TABLE PERIODICAL_COPY ADD COLUMN date_added DATE;");
        console.log("✅ Column added.");

        // STEP 2: Fill in the date for any existing rows so they aren't NULL
        await db.execute("UPDATE PERIODICAL_COPY SET date_added = CURRENT_DATE WHERE date_added IS NULL;");
        console.log("✅ Existing rows updated with today's date.");

        console.log("🎉 SUCCESS: PERIODICAL_COPY is now updated.");
    } catch (error) {
        if (error.message.includes("duplicate column name")) {
            console.log("ℹ️ Note: 'date_added' column already exists.");
        } else {
            console.error("❌ FAILED:", error.message);
        }
    }
}

addDateToPeriodicals();