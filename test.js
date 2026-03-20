const { db } = require('./db_config.js');

async function purgeGuardian(targetId) {
    console.log(`🔐 Initiating Secure Purge for Guardian ID: ${targetId}...`);

    try {
        // 1. Disable Foreign Keys to prevent "Constraint Failed" interruptions
        await db.execute("PRAGMA foreign_keys = OFF;");

        // 2. Fetch the Email first (Required to find related OTPs)
        const guardianResult = await db.execute(
            "SELECT email FROM GUARDIAN_NAME WHERE guardian_id = ?;", 
            [targetId]
        );

        if (!guardianResult.rows || guardianResult.rows.length === 0) {
            console.log("❌ Guardian not found. Deletion aborted.");
            return;
        }

        const guardianEmail = guardianResult.rows[0].email;

        // 3. Sequential Deletion
        
        // Clear Audit Logs for this specific Guardian
        await db.execute("DELETE FROM GUARDIAN_AUDIT_LOG WHERE guardian_id = ?;", [targetId]);
        console.log("✅ Cleared: GUARDIAN_AUDIT_LOG");

        // Clear Security Questions linked to this Guardian
        await db.execute("DELETE FROM SECURITY_QUESTIONS WHERE guardian_id = ?;", [targetId]);
        console.log("✅ Cleared: SECURITY_QUESTIONS");

        // Clear OTP tokens associated with this Guardian's email
        await db.execute("DELETE FROM OTP_VERIFICATION WHERE email = ?;", [guardianEmail]);
        console.log("✅ Cleared: OTP_VERIFICATION");

        // Clear any linked Users (Children/Nephews) first to prevent dangling references
        await db.execute("DELETE FROM USER WHERE guardian_id = ?;", [targetId]);
        console.log("✅ Cleared: Linked USER profiles");

        // 4. Finally, Delete the Guardian Record
        await db.execute("DELETE FROM GUARDIAN_NAME WHERE guardian_id = ?;", [targetId]);
        console.log(`✅ SUCCESS: Guardian ${targetId} and all security data removed.`);

        // 5. Re-enable Foreign Keys
        await db.execute("PRAGMA foreign_keys = ON;");

    } catch (error) {
        console.error("❌ CRITICAL ERROR during purge:", error.message);
        await db.execute("PRAGMA foreign_keys = ON;");
    }
}

// Execute for ID 1
purgeGuardian(1);