const { db } = require('./db_config.js');

async function removeDaysOverdue() {
    console.log("🛠️ Removing 'days_overdue' from PAYMENT table...");

    try {
        // Execute the drop column command
        await db.execute("ALTER TABLE PAYMENT DROP COLUMN days_overdue;");
        
        console.log("✅ Successfully removed 'days_overdue' column!");
        console.log("🎉 PAYMENT table is now perfectly normalized without losing any data!");

    } catch (error) {
        // If you accidentally run this script twice, the database will throw an error 
        // saying the column doesn't exist. This catches it gracefully!
        if (error.message && error.message.includes("no such column")) {
            console.log("⚠️ The column 'days_overdue' has already been removed! Your table is good to go.");
        } else {
            console.error("❌ Error updating table:", error);
        }
    }
}

removeDaysOverdue();