const { db } = require('./db_config.js');

async function createAllTables() {
    console.log("🚀 Starting Database Setup (Preserving Admin Data)...");

    const dropSchema = `
        DROP TABLE IF EXISTS LENDING_POLICIES;
        DROP TABLE IF EXISTS FINE_SETTINGS;
        DROP TABLE IF EXISTS DONATION;
        DROP TABLE IF EXISTS RESERVATION;
        DROP TABLE IF EXISTS SECURITY_QUESTIONS;
        DROP TABLE IF EXISTS GUARDIAN_AUDIT_LOG;
        DROP TABLE IF EXISTS BAN_TERMINATION;
        DROP TABLE IF EXISTS PAYMENT;
        DROP TABLE IF EXISTS FINE;
        DROP TABLE IF EXISTS BORROW_TRANSACTION;
        DROP TABLE IF EXISTS BOARD_GAME;
        DROP TABLE IF EXISTS AUDIO_VISUAL;
        DROP TABLE IF EXISTS PERIODICAL;
        DROP TABLE IF EXISTS BOOK;
        DROP TABLE IF EXISTS USER_AUDIT_LOG;
        DROP TABLE IF EXISTS USER;
        DROP TABLE IF EXISTS GUARDIAN_NAME;
        DROP TABLE IF EXISTS MATERIAL;
        DROP TABLE IF EXISTS ADMIN_AUDIT_LOG;
        DROP TABLE IF EXISTS OTP_VERIFICATION;
    `;

    const createSchema = `
        CREATE TABLE IF NOT EXISTS ADMIN (
            admin_id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name VARCHAR(100) NOT NULL,
            role VARCHAR(50) CHECK (role IN ('Administrator', 'Librarian', 'Assistant Librarian')),
            status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
            email VARCHAR(100) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL
        );

        CREATE TABLE IF NOT EXISTS OTP_VERIFICATION (
            otp_id INTEGER PRIMARY KEY AUTOINCREMENT,
            email VARCHAR(255) NOT NULL,
            otp_code VARCHAR(6) NOT NULL,
            expires_at DATETIME NOT NULL,
            is_used INTEGER DEFAULT 0 CHECK (is_used IN (0, 1)),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE ADMIN_AUDIT_LOG (
            log_id INTEGER PRIMARY KEY AUTOINCREMENT,
            admin_id INT NOT NULL,
            action VARCHAR(100) NOT NULL,
            date_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (admin_id) REFERENCES ADMIN(admin_id)
        );

        CREATE TABLE MATERIAL (
            material_id INTEGER PRIMARY KEY AUTOINCREMENT,
            title VARCHAR(150) NOT NULL,
            material_type VARCHAR(30) CHECK (material_type IN ('Book', 'Periodical')),
            dewey_decimal VARCHAR(20),
            publication_year INT,
            status VARCHAR(20) DEFAULT 'Available' CHECK (status IN ('Available', 'Borrowed', 'Archived', 'Lost'))
        );

        -- UPDATED: Added status column with 'Pending' default
        CREATE TABLE GUARDIAN_NAME (
            guardian_id INTEGER PRIMARY KEY AUTOINCREMENT,
            first_name VARCHAR(50) NOT NULL,
            last_name VARCHAR(50) NOT NULL,
            middle_initial VARCHAR(5),
            relationship VARCHAR(50),
            email VARCHAR(255),
            contact_number VARCHAR(20),
            address VARCHAR(255),
            password VARCHAR(255),
            status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Active', 'Rejected', 'Suspended')),
            date_created DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- UPDATED: Added status column with 'Pending' default
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
            status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Active', 'Rejected', 'Suspended')),
            date_created DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (guardian_id) REFERENCES GUARDIAN_NAME(guardian_id)
        );

        CREATE TABLE USER_AUDIT_LOG (
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
            volume VARCHAR(50),
            edition VARCHAR(50),
            dewey_decimal VARCHAR(20),
            genre VARCHAR(100),
            book_category VARCHAR(50) NOT NULL CHECK (book_category IN ('Fiction', 'Non-Fiction', 'Reference', 'Textbook')),
            book_source VARCHAR(50) NOT NULL CHECK (book_source IN ('Purchased', 'Donated')),
            book_condition VARCHAR(50) DEFAULT 'New' CHECK (book_condition IN ('New', 'Minor Damage', 'Moderate Damage', 'Severe Damage', 'Outdated', 'Obsolete')),
            status VARCHAR(20) DEFAULT 'Available' CHECK (status IN ('Available', 'Borrowed', 'Archived', 'Lost', 'Donated Outbound')),
            location VARCHAR(100),
            page_count INT,
            age_restriction INT,
            available_copies INT DEFAULT 1,
            total_copies INT DEFAULT 1,
            image_url TEXT,
            date_added DATE DEFAULT CURRENT_DATE, 
            FOREIGN KEY (material_id) REFERENCES MATERIAL(material_id)
        );

        CREATE TABLE PERIODICAL (
            periodical_id INTEGER PRIMARY KEY AUTOINCREMENT,
            issn VARCHAR(20),
            title VARCHAR(255) NOT NULL,
            material_id INT NOT NULL,
            publisher VARCHAR(150),
            publication_date DATE,
            volume_no VARCHAR(50),
            issue_no VARCHAR(50) NOT NULL,
            type VARCHAR(30) CHECK (type IN ('Magazine', 'Journal', 'Newspaper')),
            genre VARCHAR(100),
            periodical_source VARCHAR(50) NOT NULL CHECK (periodical_source IN ('Purchased', 'Donated')),
            periodical_condition VARCHAR(50) DEFAULT 'New' CHECK (periodical_condition IN ('New', 'Minor Damage', 'Moderate Damage', 'Severe Damage', 'Outdated', 'Obsolete')),
            status VARCHAR(20) DEFAULT 'Available' CHECK (status IN ('Available', 'Borrowed', 'Archived', 'Lost', 'Donated Outbound')),
            location VARCHAR(100),
            available_copies INT DEFAULT 1,
            total_copies INT DEFAULT 1,
            image_url TEXT,
            date_added DATE DEFAULT CURRENT_DATE,
            FOREIGN KEY (material_id) REFERENCES MATERIAL(material_id)
        );

        CREATE TABLE BORROW_TRANSACTION (
            borrow_id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INT NOT NULL,
            book_id INT,
            material_id INT,
            borrow_date DATE,
            borrow_time TIME,
            due_date DATE,
            return_date DATE,
            expires_at DATETIME,
            borrow_type VARCHAR(20) CHECK (borrow_type IN ('Inside Library', 'Outside Library')),
            status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Borrowed', 'Returned', 'Overdue', 'Lost', 'Cancelled')),
            extension_count INT DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES USER(user_id),
            FOREIGN KEY (book_id) REFERENCES BOOK(book_id),
            FOREIGN KEY (material_id) REFERENCES MATERIAL(material_id)
        );

        CREATE TABLE FINE_SETTINGS (
            setting_id INTEGER PRIMARY KEY AUTOINCREMENT,
            fine_type VARCHAR(50) NOT NULL UNIQUE,
            fine_amount DECIMAL(10,2) NOT NULL,
            description VARCHAR(255)
        );
        
        CREATE TABLE LENDING_POLICIES (
            policy_id INTEGER PRIMARY KEY AUTOINCREMENT,
            policy_name VARCHAR(50) NOT NULL UNIQUE,
            policy_value INT NOT NULL,
            description VARCHAR(255)
        );

        CREATE TABLE FINE (
            fine_id INTEGER PRIMARY KEY AUTOINCREMENT,
            borrow_id INT NOT NULL,
            amount DECIMAL(10,2) NOT NULL,
            fine_type VARCHAR(50),
            status VARCHAR(20) DEFAULT 'Unpaid' CHECK (status IN ('Paid', 'Unpaid')),
            FOREIGN KEY (borrow_id) REFERENCES BORROW_TRANSACTION(borrow_id)
        );

        CREATE TABLE PAYMENT (
            payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
            borrow_id INT,
            fine_id INT,
            fine_amount DECIMAL(10,2),
            payment_status VARCHAR(20) CHECK (payment_status IN ('Paid', 'Unpaid')),
            payment_date DATE DEFAULT CURRENT_DATE,
            payment_method VARCHAR(30),
            or_number VARCHAR(50),      
            remarks VARCHAR(255),       
            FOREIGN KEY (borrow_id) REFERENCES BORROW_TRANSACTION(borrow_id),
            FOREIGN KEY (fine_id) REFERENCES FINE(fine_id)
        );

        CREATE TABLE BAN_TERMINATION (
            ban_id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INT NOT NULL,
            reason VARCHAR(255),
            ban_date DATE DEFAULT CURRENT_DATE,
            end_date DATE,
            FOREIGN KEY (user_id) REFERENCES USER(user_id)
        );

        CREATE TABLE GUARDIAN_AUDIT_LOG (
            log_id INTEGER PRIMARY KEY AUTOINCREMENT,
            guardian_id INT NOT NULL,
            action VARCHAR(100) NOT NULL,
            date_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (guardian_id) REFERENCES GUARDIAN_NAME(guardian_id)
        );

        CREATE TABLE SECURITY_QUESTIONS (
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
        );

        CREATE TABLE RESERVATION (
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

        CREATE TABLE IF NOT EXISTS DONATION (
            donation_id INTEGER PRIMARY KEY AUTOINCREMENT,
            donation_type VARCHAR(20) NOT NULL CHECK (donation_type IN ('Inbound', 'Outbound')),
            user_id INT,
            donor_name VARCHAR(150),
            recipient_organization VARCHAR(200),
            book_id INT,
            book_title VARCHAR(255),
            category VARCHAR(50),
            quantity INT DEFAULT 1,
            donation_date DATE DEFAULT CURRENT_DATE,
            FOREIGN KEY (user_id) REFERENCES USER(user_id) ON DELETE SET NULL,
            FOREIGN KEY (book_id) REFERENCES BOOK(book_id) ON DELETE SET NULL
        );
    `;

    const seedSettings = `
        INSERT INTO FINE_SETTINGS (fine_type, fine_amount, description) VALUES 
        ('Minor Damage', 30.00, 'Folded pages, small tear (1-2 pages), pencil marks'),
        ('Moderate Damage', 150.00, 'Multiple torn pages, ink or highlighter marks, loose binding'),
        ('Severe Damage', 500.00, 'Missing pages or heavy water damage'),
        ('Overdue (Daily)', 5.00, 'Daily fine per day overdue');
        
        INSERT INTO LENDING_POLICIES (policy_name, policy_value, description) VALUES
        ('Max Books Per Student', 3, 'Maximum number of books a student can borrow at the same time'),
        ('Standard Loan Period', 7, 'Number of days a student can keep a borrowed book before it is overdue');
    `;

    try {
        console.log("🧹 Wiping old tables (Admin data is safe)...");
        const dropStatements = dropSchema.split(';').filter(stmt => stmt.trim() !== '');
        for (const statement of dropStatements) {
            await db.execute(statement);
        }

        console.log("🏗️ Creating fresh tables with Registration Statuses...");
        const createStatements = createSchema.split(';').filter(stmt => stmt.trim() !== '');
        for (const statement of createStatements) {
            await db.execute(statement);
        }
        
        console.log("⚙️ Inserting default fine and lending settings...");
        const seedStatements = seedSettings.split(';').filter(stmt => stmt.trim() !== '');
        for (const statement of seedStatements) {
            await db.execute(statement);
        }

        console.log("✅ SUCCESS: Setup complete! Status columns added.");

    } catch (error) {
        console.error("❌ SETUP FAILED:", error);
    }
}

createAllTables();