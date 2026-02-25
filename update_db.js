import { db } from "./db_config.js";

async function createCirculationTables() {
  console.log("🛠️ Creating Circulation and Reservation tables...");

  try {
    // 1. The RESERVATION Table (From your ERD)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS RESERVATION (
        reservation_id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INT NOT NULL,
        book_id INT NOT NULL,
        reservation_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        expiration_date DATETIME,
        status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Fulfilled', 'Cancelled', 'Expired')),
        priority_no INT DEFAULT 1,
        FOREIGN KEY (user_id) REFERENCES USER(user_id) ON DELETE CASCADE,
        FOREIGN KEY (book_id) REFERENCES BOOK(book_id) ON DELETE CASCADE
      );
    `);
    console.log("✅ SUCCESS: RESERVATION table created.");

    // 2. Your BORROW_TRANSACTION Table 
    await db.execute(`
      CREATE TABLE IF NOT EXISTS BORROW_TRANSACTION (
        borrow_id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INT NOT NULL,
        book_id INT,
        material_id INT,
        borrow_date DATE DEFAULT CURRENT_DATE,
        due_date DATE,
        return_date DATE,
        borrow_type VARCHAR(20) CHECK (borrow_type IN ('Inside Library', 'Outside Library')),
        status VARCHAR(20) DEFAULT 'Borrowed' CHECK (status IN ('Borrowed', 'Returned', 'Overdue', 'Lost')),
        extension_count INT DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES USER(user_id),
        FOREIGN KEY (book_id) REFERENCES BOOK(book_id),
        FOREIGN KEY (material_id) REFERENCES MATERIAL(material_id)
      );
    `);
    console.log("✅ SUCCESS: BORROW_TRANSACTION table verified/created.");

  } catch (error) {
    console.error("❌ CREATE FAILED:", error.message);
  }
}

createCirculationTables();