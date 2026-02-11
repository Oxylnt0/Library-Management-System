// test_connection.js
import { db } from './db_config.js';

async function testConnection() {
    console.log("⏳ Attempting to connect to Turso...");

    try {
        // Run a simple query to ping the database
        // "SELECT 1" is the standard way to check if a DB is alive
        const result = await db.execute("SELECT 1");
        
        console.log("✅ SUCCESS! Connection established.");
        console.log("Database responded with:", result);

    } catch (error) {
        console.error("❌ FAILED. Could not connect.");
        console.error("Error details:", error.message);
        console.log("\n--- Troubleshooting ---");
        console.log("1. Check if your URL starts with 'libsql://'");
        console.log("2. Check if your Auth Token is copied correctly (no spaces).");
        console.log("3. Ensure you have internet access.");
    }
}

testConnection();