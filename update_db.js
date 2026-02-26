const { db } = require('./db_config.js');

async function addDonationTable() {
    console.log("🛠️ Updating database schema...");

    const createDonationTableSQL = `
        CREATE TABLE IF NOT EXISTS DONATION (
            donation_id INTEGER PRIMARY KEY AUTOINCREMENT,
            donation_type VARCHAR(20) NOT NULL CHECK (donation_type IN ('Inbound', 'Outbound')),
            
            -- INBOUND FIELDS
            user_id INT,
            donor_name VARCHAR(150),
            
            -- OUTBOUND FIELDS
            recipient_organization VARCHAR(200),
            book_id INT,
            
            -- BOOK DETAILS
            book_title VARCHAR(255),
            category VARCHAR(50),
            quantity INT DEFAULT 1,
            
            donation_date DATE DEFAULT CURRENT_DATE,
            FOREIGN KEY (user_id) REFERENCES USER(user_id) ON DELETE SET NULL,
            FOREIGN KEY (book_id) REFERENCES BOOK(book_id) ON DELETE SET NULL
        );
    `;

    try {
        // Execute the creation query
        await db.execute(createDonationTableSQL);
        console.log("✅ SUCCESS: DONATION table has been added to the database!");

        // Verify the table exists
        const check = await db.execute("SELECT name FROM sqlite_schema WHERE type='table' AND name = 'DONATION'");
        if (check.rows.length > 0) {
            console.log("📋 Verified: DONATION table is now live and ready to use.");
        }

    } catch (error) {
        console.error("❌ ERROR adding DONATION table:", error);
    }
}

addDonationTable();