const express = require('express');
const cors = require('cors');
const path = require('path');
const { db } = require('./db_config.js');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// 1. POST /api/reserve
app.post('/api/reserve', async (req, res) => {
    const { userId, bookId, currentBookStatus } = req.body;

    try {
        let priorityNo = 1;

        // Logic: If borrowed, queue up (max + 1). If available, priority is 1.
        if (currentBookStatus === 'Borrowed') {
            const result = await db.execute({
                sql: "SELECT MAX(priority_no) as max_p FROM RESERVATION WHERE book_id = ?",
                args: [bookId]
            });
            const maxP = result.rows[0]?.max_p || 0;
            priorityNo = maxP + 1;
        }

        await db.execute({
            sql: "INSERT INTO RESERVATION (user_id, book_id, status, priority_no) VALUES (?, ?, 'Pending', ?)",
            args: [userId, bookId, priorityNo]
        });

        res.json({ success: true, message: "Reservation placed successfully." });
    } catch (error) {
        console.error("Reserve Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 2. GET /api/reservations/:userId
app.get('/api/reservations/:userId', async (req, res) => {
    const { userId } = req.params;

    try {
        const result = await db.execute({
            sql: `
                SELECT r.reservation_id, r.book_id, b.title 
                FROM RESERVATION r 
                JOIN BOOK b ON r.book_id = b.book_id 
                WHERE r.user_id = ? AND r.status = 'Pending'
            `,
            args: [userId]
        });

        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error("Fetch Reservations Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 3. POST /api/checkout
app.post('/api/checkout', async (req, res) => {
    const { reservationId, userId, bookId } = req.body;

    try {
        // Step 1: Mark Reservation as Fulfilled
        await db.execute({
            sql: "UPDATE RESERVATION SET status = 'Fulfilled' WHERE reservation_id = ?",
            args: [reservationId]
        });

        // Step 2: Create Borrow Transaction
        // Using SQLite's DATE('now') for current date and DATE('now', '+7 days') for due date
        await db.execute({
            sql: `INSERT INTO BORROW_TRANSACTION 
                  (user_id, book_id, borrow_date, due_date, status, borrow_type) 
                  VALUES (?, ?, DATE('now'), DATE('now', '+7 days'), 'Borrowed', 'Outside Library')`,
            args: [userId, bookId]
        });

        // Step 3: Update Book Status
        await db.execute({
            sql: "UPDATE BOOK SET status = 'Borrowed' WHERE book_id = ?",
            args: [bookId]
        });

        res.json({ success: true, message: "Checkout processed successfully." });
    } catch (error) {
        console.error("Checkout Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 4. POST /api/donations/inbound
app.post('/api/donations/inbound', async (req, res) => {
    const { user_id, donor_name, book_title, category, quantity } = req.body;

    try {
        await db.execute({
            sql: `INSERT INTO DONATION (donation_type, user_id, donor_name, book_title, category, quantity, donation_date) 
                  VALUES ('Inbound', ?, ?, ?, ?, ?, DATE('now'))`,
            args: [user_id || null, donor_name || null, book_title, category, quantity]
        });

        res.json({ success: true, message: "Donation recorded successfully." });
    } catch (error) {
        console.error("Inbound Donation Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 5. GET /api/donations/eligible
app.get('/api/donations/eligible', async (req, res) => {
    try {
        // Fetch books older than 5 years that are currently available
        const result = await db.execute({
            sql: `SELECT book_id, title, book_category, date_added 
                  FROM BOOK 
                  WHERE date_added <= date('now', '-5 years') 
                  AND status = 'Available'`
        });

        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error("Fetch Eligible Books Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 6. POST /api/donations/outbound
app.post('/api/donations/outbound', async (req, res) => {
    const { book_id, book_title, category, recipient_organization } = req.body;

    try {
        // 1. Update Book Status
        await db.execute({
            sql: "UPDATE BOOK SET status = 'Archived', book_condition = 'Outdated' WHERE book_id = ?",
            args: [book_id]
        });

        // 2. Insert Donation Record
        await db.execute({
            sql: `INSERT INTO DONATION (donation_type, recipient_organization, book_id, book_title, category, quantity, donation_date) 
                  VALUES ('Outbound', ?, ?, ?, ?, 1, DATE('now'))`,
            args: [recipient_organization, book_id, book_title, category]
        });

        res.json({ success: true, message: "Outbound donation processed successfully." });
    } catch (error) {
        console.error("Outbound Donation Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 7. GET /api/donations/pending
app.get('/api/donations/pending', async (req, res) => {
    try {
        const result = await db.execute({
            sql: `SELECT donation_id, donor_name, book_title, category, quantity, donation_date 
                  FROM DONATION 
                  WHERE donation_type = 'Inbound' AND book_id IS NULL`
        });
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error("Fetch Pending Donations Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 8. POST /api/books/add
app.post('/api/books/add', async (req, res) => {
    const data = req.body;

    try {
        // 1. Insert into MATERIAL (Parent Table)
        const matResult = await db.execute({
            sql: "INSERT INTO MATERIAL (title, material_type, status) VALUES (?, ?, ?) RETURNING material_id",
            args: [data.title, data.type, data.status]
        });

        const materialId = matResult.rows[0].material_id;

        // 2. Insert into BOOK (Child Table)
        const bookResult = await db.execute({
            sql: `INSERT INTO BOOK (
                title, author, isbn, material_id, 
                publisher, publication_year, page_count, 
                genre, dewey_decimal, location, age_restriction, 
                status, image_url, available_copies, total_copies,
                book_category, book_source, book_condition
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING book_id`,
            args: [
                data.title, data.author, data.isbn, materialId,
                data.publisher, data.year, data.pages,
                data.genre, data.dewey, data.location, data.age,
                data.status, data.image, data.copies, data.copies,
                data.category, data.source, data.condition
            ]
        });

        // 3. Update Donation Record if donation_id exists
        if (data.donation_id) {
            const newBookId = bookResult.rows[0].book_id;
            await db.execute({
                sql: "UPDATE DONATION SET book_id = ? WHERE donation_id = ?",
                args: [newBookId, data.donation_id]
            });
        }

        res.json({ success: true, message: "Book added successfully." });
    } catch (error) {
        console.error("Add Book Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 9. GET /api/donations/stats
app.get('/api/donations/stats', async (req, res) => {
    try {
        // 1. Total Books Acquired This Year (Inbound)
        const totalRes = await db.execute({
            sql: "SELECT SUM(quantity) as total FROM DONATION WHERE donation_type = 'Inbound' AND strftime('%Y', donation_date) = strftime('%Y', 'now')"
        });
        const totalBooks = totalRes.rows[0].total || 0;

        // 2. Pending Catalog Count
        const pendingRes = await db.execute({
            sql: "SELECT COUNT(*) as count FROM DONATION WHERE donation_type = 'Inbound' AND book_id IS NULL"
        });
        const pendingCount = pendingRes.rows[0].count || 0;

        // 3. Top 3 Donors
        const donorsRes = await db.execute({
            sql: "SELECT donor_name, SUM(quantity) as total_donated FROM DONATION WHERE donation_type = 'Inbound' AND donor_name IS NOT NULL GROUP BY donor_name ORDER BY total_donated DESC LIMIT 3"
        });

        res.json({ success: true, totalBooks, pendingCount, topDonors: donorsRes.rows });
    } catch (error) {
        console.error("Donation Stats Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});