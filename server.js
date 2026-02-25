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

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});