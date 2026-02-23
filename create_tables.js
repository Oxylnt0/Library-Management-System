const { db } = require('./db_config.js');

async function createAllTables() {
    console.log("🚀 Starting Table Creation...");

    const schema = `
        -- 1. ADMIN TABLE
        CREATE TABLE IF NOT EXISTS ADMIN (
            admin_id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name VARCHAR(100) NOT NULL,
            role VARCHAR(50) CHECK (role IN ('Librarian', 'Assistant Librarian')),
            status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
            email VARCHAR(100) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL
        );

        -- 2. ADMIN AUDIT LOG
        CREATE TABLE IF NOT EXISTS ADMIN_AUDIT_LOG (
            log_id INTEGER PRIMARY KEY AUTOINCREMENT,
            admin_id INT NOT NULL,
            action VARCHAR(100) NOT NULL,
            date_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (admin_id) REFERENCES ADMIN(admin_id)
        );

        -- 3. MATERIAL TABLE (Base table for items)
        CREATE TABLE IF NOT EXISTS MATERIAL (
            material_id INTEGER PRIMARY KEY AUTOINCREMENT,
            title VARCHAR(150) NOT NULL,
            material_type VARCHAR(30) CHECK (material_type IN ('Book', 'Periodical', 'AV', 'Board Game')),
            dewey_decimal VARCHAR(20),
            publication_year INT,
            status VARCHAR(20) DEFAULT 'Available' CHECK (status IN ('Available', 'Borrowed', 'Lost'))
        );

        CREATE TABLE GUARDIAN_NAME (
                guardian_id INTEGER PRIMARY KEY AUTOINCREMENT,
                first_name VARCHAR(50) NOT NULL,
                last_name VARCHAR(50) NOT NULL,
                middle_initial VARCHAR(5),
                relationship VARCHAR(50),
                email VARCHAR(255),
                contact_number VARCHAR(20),
                address VARCHAR(255),
                password VARCHAR(255)
            );

        CREATE TABLE USER (
                user_id INTEGER PRIMARY KEY AUTOINCREMENT,
                guardian_id INT,
                first_name VARCHAR(50) NOT NULL,
                last_name VARCHAR(50) NOT NULL,
                middle_initial VARCHAR(5),
                email VARCHAR(255),
                contact_number VARCHAR(20),
                address VARCHAR(255),
                birth_date DATE,
                password VARCHAR(255),
                FOREIGN KEY (guardian_id) REFERENCES GUARDIAN_NAME(guardian_id)
            );

        -- 7. USER AUDIT LOG
        CREATE TABLE IF NOT EXISTS USER_AUDIT_LOG (
            log_id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INT NOT NULL,
            action VARCHAR(100) NOT NULL,
            date_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES USER(user_id)
        );

        CREATE TABLE BOOK (
                book_id INTEGER PRIMARY KEY AUTOINCREMENT,
                isbn VARCHAR(20),
                title VARCHAR(255) NOT NULL,
                material_id INT NOT NULL,
                author VARCHAR(100) NOT NULL,
                publisher VARCHAR(150),
                publication_year INT,
                dewey_decimal VARCHAR(20),
                genre VARCHAR(100),
                
                /* NEW COLUMNS ADDED HERE */
                book_category VARCHAR(50) NOT NULL CHECK (book_category IN ('Fiction', 'Non-Fiction', 'Reference', 'Textbook')),
                book_source VARCHAR(50) NOT NULL CHECK (book_source IN ('Purchased', 'Donated')),
                book_condition VARCHAR(50) DEFAULT 'New' CHECK (book_condition IN ('New', 'Good', 'Damaged', 'Outdated', 'Obsolete')),
                
                /* STATUS CLEANED UP */
                status VARCHAR(20) DEFAULT 'Available' CHECK (status IN ('Available', 'Borrowed', 'Archived')),
                
                location VARCHAR(100),
                page_count INT,
                age_restriction INT,
                available_copies INT DEFAULT 1,
                total_copies INT DEFAULT 1,
                image_url TEXT,
                date_added DATE DEFAULT CURRENT_DATE, 
                FOREIGN KEY (material_id) REFERENCES MATERIAL(material_id)
            );

        -- 9. PERIODICAL TABLE
        CREATE TABLE IF NOT EXISTS PERIODICAL (
            periodical_id INTEGER PRIMARY KEY AUTOINCREMENT,
            material_id INT NOT NULL,
            issue_no VARCHAR(20) NOT NULL,
            type VARCHAR(30) CHECK (type IN ('Magazine', 'Journal', 'Newspaper')),
            FOREIGN KEY (material_id) REFERENCES MATERIAL(material_id)
        );

        -- 10. AUDIO_VISUAL TABLE
        CREATE TABLE IF NOT EXISTS AUDIO_VISUAL (
            av_id INTEGER PRIMARY KEY AUTOINCREMENT,
            material_id INT NOT NULL,
            format VARCHAR(20) CHECK (format IN ('CD', 'DVD', 'VHS')),
            FOREIGN KEY (material_id) REFERENCES MATERIAL(material_id)
        );

        -- 11. BOARD_GAME TABLE
        CREATE TABLE IF NOT EXISTS BOARD_GAME (
            game_id INTEGER PRIMARY KEY AUTOINCREMENT,
            material_id INT NOT NULL,
            players INT,
            FOREIGN KEY (material_id) REFERENCES MATERIAL(material_id)
        );

        -- 12. BORROW TRANSACTION TABLE
        CREATE TABLE IF NOT EXISTS BORROW_TRANSACTION (
            borrow_id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INT NOT NULL,
            book_id INT,
            material_id INT,
            borrow_date DATE DEFAULT CURRENT_DATE,
            due_date DATE,
            return_date DATE,
            borrow_type VARCHAR(20) CHECK (borrow_type IN ('Inside Library', 'Outside Library')),
            status VARCHAR(20) DEFAULT 'Borrowed' CHECK (status IN ('Borrowed', 'Returned', 'Overdue')),
            extension_count INT DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES USER(user_id),
            FOREIGN KEY (book_id) REFERENCES BOOK(book_id),
            FOREIGN KEY (material_id) REFERENCES MATERIAL(material_id)
        );

        -- 13. FINE TABLE
        CREATE TABLE IF NOT EXISTS FINE (
            fine_id INTEGER PRIMARY KEY AUTOINCREMENT,
            borrow_id INT NOT NULL,
            amount DECIMAL(10,2) NOT NULL,
            status VARCHAR(20) DEFAULT 'Unpaid' CHECK (status IN ('Paid', 'Unpaid')),
            FOREIGN KEY (borrow_id) REFERENCES BORROW_TRANSACTION(borrow_id)
        );

        -- 14. PAYMENT TABLE
        CREATE TABLE IF NOT EXISTS PAYMENT (
            payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
            borrow_id INT,
            fine_id INT,
            days_overdue INT,
            fine_amount DECIMAL(10,2),
            payment_status VARCHAR(20) CHECK (payment_status IN ('Paid', 'Unpaid')),
            payment_date DATE DEFAULT CURRENT_DATE,
            payment_method VARCHAR(30),
            FOREIGN KEY (borrow_id) REFERENCES BORROW_TRANSACTION(borrow_id),
            FOREIGN KEY (fine_id) REFERENCES FINE(fine_id)
        );

        -- 15. BAN TERMINATION TABLE
        CREATE TABLE IF NOT EXISTS BAN_TERMINATION (
            ban_id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INT NOT NULL,
            reason VARCHAR(255),
            ban_date DATE DEFAULT CURRENT_DATE,
            end_date DATE,
            FOREIGN KEY (user_id) REFERENCES USER(user_id)
        );

        -- 16. GUARDIAN AUDIT LOG
        CREATE TABLE IF NOT EXISTS GUARDIAN_AUDIT_LOG (
        log_id INTEGER PRIMARY KEY AUTOINCREMENT,
        guardian_id INT NOT NULL,
        action VARCHAR(100) NOT NULL,
        date_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (guardian_id) REFERENCES GUARDIAN_NAME(guardian_id)
      );

      CREATE TABLE IF NOT EXISTS SECURITY_QUESTIONS (
        security_id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INT,
        guardian_id INT,
        question_1 VARCHAR(255) NOT NULL,
        answer_1 VARCHAR(255) NOT NULL,
        question_2 VARCHAR(255) NOT NULL,
        answer_2 VARCHAR(255) NOT NULL,
        question_3 VARCHAR(255) NOT NULL,
        answer_3 VARCHAR(255) NOT NULL,
        FOREIGN KEY (user_id) REFERENCES USER(user_id) ON DELETE CASCADE,
        FOREIGN KEY (guardian_id) REFERENCES GUARDIAN_NAME(guardian_id) ON DELETE CASCADE,
        CHECK (
            (user_id IS NOT NULL AND guardian_id IS NULL) OR 
            (user_id IS NULL AND guardian_id IS NOT NULL)
        )
    `;

    try {
        const statements = schema.split(';').filter(stmt => stmt.trim() !== '');

        for (const statement of statements) {
            await db.execute(statement);
        }
        
        console.log("✅ SUCCESS: All tables created!");
        
        const check = await db.execute("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'");
        console.log("Tables found in DB:", check.rows.map(r => r.name));

    } catch (error) {
        console.error("❌ FAILED:", error);
    }
}

createAllTables();