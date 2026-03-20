const { db } = require('./db_config.js');

async function resetSpecificTables() {
    console.log("🧹 Initializing Data Purge for Security and User tables...");

    try {
        // 1. Disable Foreign Key checks to prevent "Constraint Failed" errors
        await db.execute("PRAGMA foreign_keys = OFF;");

        // 2. Define the target tables
        const tables = [
            'USER_AUDIT_LOG',
            'SECURITY_QUESTIONS',
            'OTP_VERIFICATION',
            'USER'
        ];

        for (const table of tables) {
            try {
                // Delete all data from the table
                await db.execute(`DELETE FROM ${table};`);
                
                // Reset the auto-increment counter (sqlite_sequence)
                // This makes sure the next ID inserted is #1
                await db.execute(`DELETE FROM sqlite_sequence WHERE name='${table}';`);
                
                console.log(`✅ Cleared and Reset: ${table}`);
            } catch (err) {
                // If a table doesn't exist yet or was renamed, skip it
                console.log(`⚠️  Skipping ${table}: ${err.message}`);
            }
        }

        // 3. Re-enable Foreign Key checks
        await db.execute("PRAGMA foreign_keys = ON;");

        console.log("\n✨ SUCCESS: Your Security and User data has been wiped.");
        console.log("The database is now in a 'Clean Slate' state for testing.");

    } catch (error) {
        console.error("❌ CRITICAL ERROR during reset:", error.message);
        // Ensure keys are turned back on even if the script crashes
        await db.execute("PRAGMA foreign_keys = ON;");
    }
}

resetSpecificTables();