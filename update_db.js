const { db } = require('./db_config.js');

async function updateAnnouncementTable() {
    console.log("📢 Updating ANNOUNCEMENT table structure...");

    try {
        // 1. Disable foreign keys to allow dropping the table safely
        await db.execute("PRAGMA foreign_keys = OFF;");

        // 2. Drop the existing table
        await db.execute("DROP TABLE IF EXISTS ANNOUNCEMENT;");
        console.log("✅ Old ANNOUNCEMENT table dropped.");

        // 3. Create the new table with your updated schema
        const createTableSQL = `
            CREATE TABLE ANNOUNCEMENT (
                announcement_id INTEGER PRIMARY KEY AUTOINCREMENT,
                admin_id INT NOT NULL,
                title VARCHAR(255) NOT NULL,
                content TEXT NOT NULL,
                priority VARCHAR(20) DEFAULT 'Normal' CHECK (priority IN ('Normal', 'High', 'Urgent')),
                status VARCHAR(20) DEFAULT 'Published' CHECK (status IN ('Draft', 'Published', 'Archived')),
                date_posted DATETIME DEFAULT CURRENT_TIMESTAMP,
                valid_until DATETIME,
                FOREIGN KEY (admin_id) REFERENCES ADMIN(admin_id)
            );
        `;

        await db.execute(createTableSQL);
        console.log("✅ New ANNOUNCEMENT table created successfully.");

        // 4. Re-enable foreign keys
        await db.execute("PRAGMA foreign_keys = ON;");

        console.log("🎉 SUCCESS: Announcement system is ready for priority-based posting.");

    } catch (error) {
        console.error("❌ FAILED to update table:", error.message);
        // Ensure keys are turned back on even if it fails
        await db.execute("PRAGMA foreign_keys = ON;");
    }
}

updateAnnouncementTable();