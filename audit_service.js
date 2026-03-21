const path = require('path');
const { db } = require('./db_config.js');

async function logUserAction(userId, action, targetTable, targetId, details) {
    try {
        await db.execute({
            sql: `INSERT INTO USER_AUDIT_LOG (user_id, action, details) 
                  VALUES (?, ?, ?)`,
            args: [userId, action, details]
        });
        console.log(`📝 User Audit: [${action}] User ${userId}`);
    } catch (error) {
        console.error("❌ User Audit Error:", error);
    }
}

async function logGuardianAction(guardianId, action, targetTable, targetId, details) {
    try {
        await db.execute({
            sql: `INSERT INTO GUARDIAN_AUDIT_LOG (guardian_id, action, details) 
                  VALUES (?, ?, ?)`,
            args: [guardianId, action, details]
        });
        console.log(`📝 Guardian Audit: [${action}] Guardian ${guardianId}`);
    } catch (error) {
        console.error("❌ Guardian Audit Error:", error);
    }
}

async function logAdminAction(adminId, action, targetTable, targetId, details) {
    try {
        await db.execute({
            sql: `INSERT INTO ADMIN_AUDIT_LOG (admin_id, action, details) 
                  VALUES (?, ?, ?)`,
            args: [adminId, action, details]
        });
        console.log(`📝 Admin Audit: [${action}] Admin ${adminId}`);
    } catch (error) {
        console.error("❌ Admin Audit Error:", error);
    }
}

module.exports = { logUserAction, logGuardianAction, logAdminAction };
