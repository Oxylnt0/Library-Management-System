const { db } = require('./db_config.js');

async function addEmailVerifiedColumn() {
    console.log("🛠️  Adding 'email_verified' flags to tables...");

    try {
        // 1. Update GUARDIAN_NAME (The Login Account)
        await db.execute("ALTER TABLE GUARDIAN_NAME ADD COLUMN email_verified INTEGER DEFAULT 0;");
        console.log("✅ Added email_verified to GUARDIAN_NAME.");

        // 2. Update USER (The Student Profile)
        await db.execute("ALTER TABLE USER ADD COLUMN email_verified INTEGER DEFAULT 0;");
        console.log("✅ Added email_verified to USER.");

        console.log("🎉 SUCCESS: Verification flags are now active.");

    } catch (error) {
        if (error.message.includes("duplicate column name")) {
            console.log("ℹ️  Notice: email_verified column already exists. Skipping...");
        } else {
            console.error("❌ UPDATE FAILED:", error.message);
        }
    }
}

addEmailVerifiedColumn();