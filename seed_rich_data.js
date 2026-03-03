const { db } = require('./db_config.js');

async function seedRichData() {
    console.log("🌱 Injecting Rich Test Data...");

    try {
        // ==========================================
        // 1. ADMINS
        // ==========================================
        console.log("  -> Adding Admins...");
        await db.execute(`INSERT INTO ADMIN (full_name, role, status, email, password) VALUES 
            ('Alice Admin', 'Librarian', 'Active', 'librarian@library.com', 'password123'),
            ('Bob Helper', 'Assistant Librarian', 'Active', 'assistant@library.com', 'password123')`);

        // ==========================================
        // 2. GUARDIAN & CHILD PAIR (1 Pair)
        // ==========================================
        console.log("  -> Adding 1 Guardian and their Child...");
        let userIds = [];
        
        const gRes = await db.execute({
            sql: `INSERT INTO GUARDIAN_NAME (first_name, last_name, relationship, email, contact_number, password) VALUES (?, ?, ?, ?, '09123456789', 'password123')`, 
            args: ['Maria', 'Santos', 'Mother', 'maria.santos@mail.com']
        });
        const guardianId = Number(gRes.lastInsertRowid);
        
        const uRes1 = await db.execute({
            sql: `INSERT INTO USER (guardian_id, first_name, last_name, email, contact_number, birth_date, password) VALUES (?, ?, ?, ?, '09987654321', '2010-01-01', 'password123')`, 
            args: [guardianId, 'Juan', 'Santos', 'juan.santos@mail.com']
        });
        userIds.push(Number(uRes1.lastInsertRowid));

        // ==========================================
        // 3. NORMAL USERS (5 Independent Users)
        // ==========================================
        console.log("  -> Adding 5 Normal Users (No Guardian)...");
        const normalUsers = [
            ['Anna', 'Reyes', 'anna.reyes@mail.com'],
            ['Mark', 'Cruz', 'mark.cruz@mail.com'],
            ['Sofia', 'Lim', 'sofia.lim@mail.com'],
            ['Luis', 'Gomez', 'luis.gomez@mail.com'],
            ['Chloe', 'Tan', 'chloe.tan@mail.com']
        ];

        for (const u of normalUsers) {
            const uRes = await db.execute({
                sql: `INSERT INTO USER (guardian_id, first_name, last_name, email, contact_number, birth_date, password) VALUES (NULL, ?, ?, ?, '09987654321', '2000-05-15', 'password123')`, 
                args: u
            });
            userIds.push(Number(uRes.lastInsertRowid));
        }

        // ==========================================
        // 4. BOOKS (With Outdated & Obsolete testing)
        // ==========================================
        console.log("  -> Adding Books (including Outdated/Obsolete)...");
        const books = [
            { t: 'Harry Potter & The Sorcerers Stone', dd: '823.9', cat: 'Fiction', src: 'Purchased', loc: 'Shelf FIC-B: Fiction (I-P)', year: 2023, cond: 'New' },
            { t: 'Introduction to Algorithms', dd: '005.1', cat: 'Textbook', src: 'Purchased', loc: 'TXT-1: Textbook Reserve', year: 2018, cond: 'Outdated' }, // > 5 years old
            { t: 'World History: Modern Era', dd: '909.8', cat: 'Non-Fiction', src: 'Donated', loc: 'Shelf NF-10: History & Geo', year: 2022, cond: 'Good' },
            { t: 'Encyclopedia Britannica', dd: '031.0', cat: 'Reference', src: 'Purchased', loc: 'REF-1: General Reference', year: 2024, cond: 'New' },
            { t: 'The Great Gatsby', dd: '813.5', cat: 'Fiction', src: 'Donated', loc: 'Shelf FIC-A: Fiction (A-H)', year: 2021, cond: 'Good' },
            { t: 'Medical Anatomy 101', dd: '610.0', cat: 'Textbook', src: 'Donated', loc: 'Shelf NF-7: Technology & Med', year: 2005, cond: 'Obsolete' } // Very old
        ];

        let bookIds = [];
        for (const b of books) {
            const mRes = await db.execute({
                sql: `INSERT INTO MATERIAL (title, material_type, dewey_decimal, publication_year, status) VALUES (?, 'Book', ?, ?, 'Available')`, 
                args: [b.t, b.dd, b.year]
            });
            const matId = Number(mRes.lastInsertRowid);
            
            const bRes = await db.execute({
                sql: `INSERT INTO BOOK (isbn, title, material_id, author, publisher, publication_year, dewey_decimal, book_category, book_source, book_condition, status, location) VALUES ('1234567890', ?, ?, 'Various Authors', 'Global Press', ?, ?, ?, ?, ?, 'Available', ?)`, 
                args: [b.t, matId, b.year, b.dd, b.cat, b.src, b.cond, b.loc]
            });
            bookIds.push(Number(bRes.lastInsertRowid));
        }

        // ==========================================
        // 5. PERIODICALS
        // ==========================================
        console.log("  -> Adding Periodicals...");
        const periodicals = [
            { t: 'TIME Magazine', type: 'Magazine', gen: 'News', loc: 'PER-1: Periodicals & News' },
            { t: 'National Geographic', type: 'Magazine', gen: 'Science & Nature', loc: 'PER-1: Periodicals & News' },
            { t: 'Philippine Daily Inquirer', type: 'Newspaper', gen: 'News', loc: 'PER-1: Periodicals & News' },
            { t: 'Nature Journal', type: 'Journal', gen: 'Science', loc: 'PER-1: Periodicals & News' },
            { t: 'Vogue', type: 'Magazine', gen: 'Lifestyle', loc: 'PER-1: Periodicals & News' }
        ];

        for (const p of periodicals) {
            const mRes = await db.execute({
                sql: `INSERT INTO MATERIAL (title, material_type, dewey_decimal, publication_year, status) VALUES (?, 'Periodical', '050', 2025, 'Available')`, 
                args: [p.t]
            });
            const matId = Number(mRes.lastInsertRowid);
            
            await db.execute({
                sql: `INSERT INTO PERIODICAL (issn, title, material_id, publisher, issue_no, type, genre, periodical_source, status, location) VALUES ('1122-3344', ?, ?, 'Publishers Inc', 'Issue 1', ?, ?, 'Purchased', 'Available', ?)`, 
                args: [p.t, matId, p.type, p.gen, p.loc]
            });
        }

        // ==========================================
        // 6. TRANSACTIONS & FINES 
        // ==========================================
        console.log("  -> Adding Borrow Transactions and Fines...");
        
        // Scenario 1: Juan (Child User) returned ON TIME
        await db.execute({
            sql: `INSERT INTO BORROW_TRANSACTION (user_id, book_id, borrow_date, due_date, return_date, borrow_type, status) VALUES (?, ?, '2026-01-01', '2026-01-07', '2026-01-05', 'Outside Library', 'Returned')`, 
            args: [userIds[0], bookIds[0]]
        });

        // Scenario 2: Anna (Normal User) returned LATE
        const t2 = await db.execute({
            sql: `INSERT INTO BORROW_TRANSACTION (user_id, book_id, borrow_date, due_date, return_date, borrow_type, status) VALUES (?, ?, '2026-02-01', '2026-02-07', '2026-02-10', 'Outside Library', 'Returned')`, 
            args: [userIds[1], bookIds[1]]
        });
        await db.execute({ sql: `INSERT INTO FINE (borrow_id, amount, status) VALUES (?, 15.00, 'Unpaid')`, args: [Number(t2.lastInsertRowid)] });

        // Scenario 3: Mark (Normal User) OVERDUE
        const t3 = await db.execute({
            sql: `INSERT INTO BORROW_TRANSACTION (user_id, book_id, borrow_date, due_date, borrow_type, status) VALUES (?, ?, '2026-03-01', '2026-03-07', 'Outside Library', 'Overdue')`, 
            args: [userIds[2], bookIds[2]]
        });
        await db.execute({ sql: `INSERT INTO FINE (borrow_id, amount, status) VALUES (?, 25.00, 'Unpaid')`, args: [Number(t3.lastInsertRowid)] });
        
        // Update Book 3 status to Borrowed
        await db.execute(`UPDATE MATERIAL SET status = 'Borrowed' WHERE title = 'World History: Modern Era'`);
        await db.execute(`UPDATE BOOK SET status = 'Borrowed' WHERE title = 'World History: Modern Era'`);

        // Scenario 4: Sofia (Normal User) MINOR DAMAGE
        const t4 = await db.execute({
            sql: `INSERT INTO BORROW_TRANSACTION (user_id, book_id, borrow_date, due_date, return_date, borrow_type, status) VALUES (?, ?, '2026-04-01', '2026-04-07', '2026-04-06', 'Outside Library', 'Returned')`, 
            args: [userIds[3], bookIds[3]]
        });
        await db.execute({ sql: `INSERT INTO FINE (borrow_id, amount, status) VALUES (?, 30.00, 'Unpaid')`, args: [Number(t4.lastInsertRowid)] });

        // Scenario 5: Luis (Normal User) LOST Book
        const t5 = await db.execute({
            sql: `INSERT INTO BORROW_TRANSACTION (user_id, book_id, borrow_date, due_date, borrow_type, status) VALUES (?, ?, '2026-05-01', '2026-05-07', 'Outside Library', 'Lost')`, 
            args: [userIds[4], bookIds[4]]
        });
        await db.execute({ sql: `INSERT INTO FINE (borrow_id, amount, status) VALUES (?, 500.00, 'Unpaid')`, args: [Number(t5.lastInsertRowid)] });
        
        // Update Book 5 to Lost
        await db.execute(`UPDATE MATERIAL SET status = 'Lost' WHERE title = 'The Great Gatsby'`);
        await db.execute(`UPDATE BOOK SET status = 'Lost' WHERE title = 'The Great Gatsby'`);

        console.log("✅ SUCCESS: Rich data injected successfully!");

    } catch (error) {
        console.error("❌ ERROR SEEDING DATA:", error);
    }
}

seedRichData();