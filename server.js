const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
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

// 2.5 GET /api/admin/reservations (Two-Table Approach)
app.get('/api/admin/reservations', async (req, res) => {
    try {
        // Array 1: Ready to Process (Pending OR Approved Reservation + Available Book)
        const readyRes = await db.execute({
            sql: `SELECT r.reservation_id, r.user_id, r.book_id, r.reservation_date, r.status, 
                         u.first_name, u.last_name, b.title 
                  FROM RESERVATION r
                  JOIN BOOK b ON r.book_id = b.book_id
                  JOIN USER u ON r.user_id = u.user_id
                  WHERE r.status IN ('Pending', 'Approved') AND b.status = 'Available'
                  ORDER BY r.status ASC, r.reservation_date ASC`
        });

        // Array 2: Waitlist (Pending Reservation + Book NOT Available)
        const waitlistRes = await db.execute({
            sql: `SELECT r.reservation_id, r.user_id, r.book_id, r.reservation_date, r.priority_no,
                         u.first_name, u.last_name, b.title, b.status as book_status
                  FROM RESERVATION r
                  JOIN BOOK b ON r.book_id = b.book_id
                  JOIN USER u ON r.user_id = u.user_id
                  WHERE r.status = 'Pending' AND b.status != 'Available'
                  ORDER BY r.priority_no ASC, r.reservation_date ASC`
        });

        res.json({ success: true, readyToProcess: readyRes.rows, waitlist: waitlistRes.rows });
    } catch (error) {
        console.error("Admin Reservations Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 3. POST /api/checkout
app.post('/api/checkout', async (req, res) => {
    const { reservationId, userId, bookId } = req.body;

    try {
        // Fetch material_id
        const bookRes = await db.execute({
            sql: "SELECT material_id FROM BOOK WHERE book_id = ?",
            args: [bookId]
        });
        const materialId = bookRes.rows[0]?.material_id;

        // Step 1: Mark Reservation as Fulfilled
        await db.execute({
            sql: "UPDATE RESERVATION SET status = 'Fulfilled' WHERE reservation_id = ?",
            args: [reservationId]
        });

        // Step 2: Create Borrow Transaction
        // Using SQLite's DATE('now') for current date and DATE('now', '+7 days') for due date
        await db.execute({
            sql: `INSERT INTO BORROW_TRANSACTION 
                  (user_id, book_id, material_id, borrow_date, due_date, status, borrow_type) 
                  VALUES (?, ?, ?, DATE('now', '+8 hours'), DATE('now', '+8 hours', '+7 days'), 'Borrowed', 'Outside Library')`,
            args: [userId, bookId, materialId]
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
                  VALUES ('Inbound', ?, ?, ?, ?, ?, DATE('now', '+8 hours'))`,
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
                  WHERE date_added <= date('now', '+8 hours', '-5 years') 
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
                  VALUES ('Outbound', ?, ?, ?, ?, 1, DATE('now', '+8 hours'))`,
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
        // Frontend sends 'material_type' (Book/Periodical).
        const materialType = data.material_type || 'Book';

        // Extract common fields for MATERIAL table
        const deweyDecimal = data.dewey_decimal || data.dewey || null;
        let pubYear = data.publication_year || data.year || null;

        // If Periodical, try to extract year from publication_date if pubYear is missing
        if (!pubYear && data.publication_date) {
            pubYear = parseInt(data.publication_date.split('-')[0]) || null;
        }

        const matResult = await db.execute({
            sql: "INSERT INTO MATERIAL (title, material_type, dewey_decimal, publication_year, status) VALUES (?, ?, ?, ?, ?) RETURNING material_id",
            args: [data.title, materialType, deweyDecimal, pubYear, data.status || 'Available']
        });

        const materialId = matResult.rows[0].material_id;
        let newBookId = null;

        if (materialType === 'Book') {
            // 2a. Insert into BOOK (Child Table)
            const bookResult = await db.execute({
                sql: `INSERT INTO BOOK (
                    title, author, isbn, material_id, 
                    publisher, publication_year, page_count, 
                    genre, dewey_decimal, location, age_restriction, 
                    status, image_url, available_copies, total_copies,
                    book_category, book_source, book_condition,
                    volume, edition
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING book_id`,
                args: [
                    data.title, 
                    data.author, 
                    data.isbn || null, 
                    materialId,
                    data.publisher || null, 
                    data.publication_year || data.year || null, 
                    data.page_count || data.pages || null,
                    data.genre || null, 
                    data.dewey_decimal || data.dewey || null, 
                    data.location || null, 
                    data.age_restriction || data.age || 0,
                    data.status || 'Available', 
                    data.image_url || data.image || null, 
                    data.available_copies || data.copies || 1, 
                    data.total_copies || data.copies || 1,
                    data.book_category || data.category, 
                    data.book_source || data.source, 
                    data.book_condition || data.condition || 'New',
                    data.volume || null,
                    data.edition || null
                ]
            });
            newBookId = bookResult.rows[0].book_id;

        } else if (materialType === 'Periodical') {
            // 2b. Insert into PERIODICAL
            await db.execute({
                sql: `INSERT INTO PERIODICAL (
                    title, issn, material_id,
                    publisher, publication_date, volume_no, issue_no,
                    type, genre, periodical_source, periodical_condition,
                    status, location, available_copies, total_copies,
                    image_url
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                args: [
                    data.title,
                    data.issn || null,
                    materialId,
                    data.publisher || null,
                    data.publication_date || null,
                    data.volume_no || null,
                    data.issue_no,
                    data.type, // Magazine, Journal, Newspaper
                    data.genre || null,
                    data.periodical_source || data.source,
                    data.periodical_condition || data.condition || 'New',
                    data.status || 'Available',
                    data.location || null,
                    data.available_copies || data.copies || 1,
                    data.total_copies || data.copies || 1,
                    data.image_url || data.image || null
                ]
            });
        }

        // 3. Update Donation Record if donation_id exists AND it was a book
        // (Currently DONATION table only links to BOOK via book_id)
        if (data.donation_id && newBookId) {
            await db.execute({
                sql: "UPDATE DONATION SET book_id = ? WHERE donation_id = ?",
                args: [newBookId, data.donation_id]
            });
        }

        res.json({ success: true, message: "Item added successfully." });
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
            sql: "SELECT SUM(quantity) as total FROM DONATION WHERE donation_type = 'Inbound' AND strftime('%Y', donation_date) = strftime('%Y', 'now', '+8 hours')"
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

// 10. POST /api/borrow/kiosk
app.post('/api/borrow/kiosk', async (req, res) => {
    const { book_id, user_id } = req.body;
    
    try {
        // 1. Check availability
        const bookRes = await db.execute({
            sql: "SELECT available_copies, status, material_id FROM BOOK WHERE book_id = ?",
            args: [book_id]
        });

        if (bookRes.rows.length === 0) return res.status(404).json({ success: false, message: "Book not found." });
        
        const book = bookRes.rows[0];
        if (book.available_copies <= 0) return res.status(400).json({ success: false, message: "Book is currently unavailable." });

        // 2. Create Pending Transaction (Hold expires in 30 mins)
        await db.execute({
            sql: `INSERT INTO BORROW_TRANSACTION (user_id, book_id, material_id, borrow_date, status, expires_at, borrow_type) 
                  VALUES (?, ?, ?, DATE('now', '+8 hours'), 'Pending', DATETIME('now', '+8 hours', '+30 minutes'), 'Outside Library')`,
            args: [user_id, book_id, book.material_id]
        });

        // 3. Update Book Inventory
        const newStatus = (book.available_copies - 1 === 0) ? 'Borrowed' : 'Available';
        await db.execute({
            sql: "UPDATE BOOK SET available_copies = available_copies - 1, status = ? WHERE book_id = ?",
            args: [newStatus, book_id]
        });

        res.json({ success: true, message: "Hold placed successfully." });
    } catch (error) {
        console.error("Kiosk Borrow Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 10.5 POST /api/borrow/cancel
app.post('/api/borrow/cancel', async (req, res) => {
    const { borrow_id } = req.body;
    try {
        // Get book_id from transaction to update inventory
        const transRes = await db.execute({
            sql: "SELECT book_id FROM BORROW_TRANSACTION WHERE borrow_id = ? AND status = 'Pending'",
            args: [borrow_id]
        });
        
        if (transRes.rows.length === 0) {
            return res.status(400).json({ success: false, message: "Transaction not found or not pending." });
        }
        const bookId = transRes.rows[0].book_id;

        // Update Transaction to Cancelled
        await db.execute({
            sql: "UPDATE BORROW_TRANSACTION SET status = 'Cancelled' WHERE borrow_id = ?",
            args: [borrow_id]
        });

        // Update Book Inventory (Make available again)
        await db.execute({
            sql: "UPDATE BOOK SET status = 'Available', available_copies = available_copies + 1 WHERE book_id = ?",
            args: [bookId]
        });

        res.json({ success: true, message: "Hold cancelled successfully." });
    } catch (error) {
        console.error("Cancel Hold Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 11. POST /api/waitlist
app.post('/api/waitlist', async (req, res) => {
    const { book_id, user_id } = req.body;

    try {
        // 1. Calculate Priority
        const prioRes = await db.execute({
            sql: "SELECT MAX(priority_no) as max_p FROM RESERVATION WHERE book_id = ?",
            args: [book_id]
        });
        const nextPriority = (prioRes.rows[0]?.max_p || 0) + 1;

        // 2. Insert Reservation
        await db.execute({
            sql: "INSERT INTO RESERVATION (user_id, book_id, status, priority_no) VALUES (?, ?, 'Pending', ?)",
            args: [user_id, book_id, nextPriority]
        });

        res.json({ success: true, message: "Added to waitlist." });
    } catch (error) {
        console.error("Waitlist Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 12. GET /api/books (Catalog with User Context)
app.get('/api/books', async (req, res) => {
    const userId = req.query.user_id;

    try {
        let sql = "SELECT * FROM BOOK";
        let args = [];

        if (userId) {
            sql = `
                SELECT b.*,
                (SELECT COUNT(*) FROM BORROW_TRANSACTION bt 
                 WHERE bt.book_id = b.book_id 
                 AND bt.user_id = ? 
                 AND bt.status IN ('Pending', 'Borrowed')) as user_already_has_it
                FROM BOOK b
            `;
            args = [userId];
        }

        const result = await db.execute({ sql, args });
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error("Fetch Books Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 13. GET /api/fines
app.get('/api/fines', async (req, res) => {
    try {
        const result = await db.execute({
            sql: `
                SELECT 
                    f.fine_id,
                    f.amount,
                    f.fine_type,
                    f.status as fine_status,
                    b.borrow_id,
                    b.due_date,
                    b.return_date,
                    b.status as borrow_status,
                    u.first_name,
                    u.last_name,
                    u.email,
                    bk.title as book_title
                FROM FINE f
                JOIN BORROW_TRANSACTION b ON f.borrow_id = b.borrow_id
                JOIN USER u ON b.user_id = u.user_id
                LEFT JOIN BOOK bk ON b.book_id = bk.book_id
                ORDER BY f.status DESC, b.due_date ASC
            `
        });
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error("Fetch Fines Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 13.1 POST /api/payment/paymongo/link (Create Payment Link)
app.post('/api/payment/paymongo/link', async (req, res) => {
    const { amount, description } = req.body;

    if (amount < 100) {
        return res.status(400).json({ success: false, message: "Amount must be at least ₱100.00 for PayMongo links." });
    }

    try {
        const options = {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
                authorization: 'Basic ' + Buffer.from(process.env.PAYMONGO_SECRET_KEY || '').toString('base64')
            },
            body: JSON.stringify({
                data: {
                    attributes: {
                        amount: Math.round(amount * 100), // Convert to centavos
                        description: description,
                        remarks: 'Library Fine Payment'
                    }
                }
            })
        };

        const response = await fetch('https://api.paymongo.com/v1/links', options);
        const data = await response.json();
        
        if (data.errors) {
            throw new Error(data.errors[0].detail);
        }

        res.json({ success: true, checkout_url: data.data.attributes.checkout_url, link_id: data.data.id });
    } catch (error) {
        console.error("Paymongo Link Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 13.2 GET /api/payment/paymongo/link/:id (Check Status)
app.get('/api/payment/paymongo/link/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const options = {
            method: 'GET',
            headers: {
                accept: 'application/json',
                authorization: 'Basic ' + Buffer.from(process.env.PAYMONGO_SECRET_KEY || '').toString('base64')
            }
        };

        const response = await fetch(`https://api.paymongo.com/v1/links/${id}`, options);
        const data = await response.json();

        if (data.errors) throw new Error(data.errors[0].detail);

        const status = data.data.attributes.status; // 'unpaid' or 'paid'
        const payments = data.data.attributes.payments || [];
        const reference_number = payments.length > 0 ? payments[0].data.id : null;

        res.json({ success: true, status, reference_number });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 13.5 GET /api/settings/fines
app.get('/api/settings/fines', async (req, res) => {
    try {
        const result = await db.execute("SELECT * FROM FINE_SETTINGS");
        res.json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 14. POST /api/fines/pay
app.post('/api/fines/pay', async (req, res) => {
    const { fine_id, amount, payment_method, reference_number, remarks } = req.body;
    try {
        // 1. Get borrow_id associated with this fine
        const fineRes = await db.execute({
            sql: "SELECT borrow_id FROM FINE WHERE fine_id = ?",
            args: [fine_id]
        });
        const borrowId = fineRes.rows[0]?.borrow_id;

        // 2. Update Fine Status
        await db.execute({
            sql: "UPDATE FINE SET status = 'Paid' WHERE fine_id = ?",
            args: [fine_id]
        });

        // 3. Insert into PAYMENT table for audit/daily stats
        if (borrowId) {
            await db.execute({
                sql: `INSERT INTO PAYMENT (borrow_id, fine_id, fine_amount, payment_status, payment_date, payment_method, or_number, remarks) 
                      VALUES (?, ?, ?, 'Paid', DATE('now', '+8 hours'), ?, ?, ?)`,
                args: [borrowId, fine_id, amount, payment_method || 'Cash', reference_number || null, remarks || null]
            });
        }

        res.json({ success: true, message: "Fine paid successfully." });
    } catch (error) {
        console.error("Pay Fine Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 15. GET /api/fines/stats
app.get('/api/fines/stats', async (req, res) => {
    try {
        // Unpaid Fines Total
        const unpaidRes = await db.execute("SELECT SUM(amount) as total FROM FINE WHERE status = 'Unpaid'");
        
        // Unpaid Users Count
        const usersRes = await db.execute("SELECT COUNT(DISTINCT b.user_id) as count FROM FINE f JOIN BORROW_TRANSACTION b ON f.borrow_id = b.borrow_id WHERE f.status = 'Unpaid'");
        
        // Collected Today
        const collectedRes = await db.execute("SELECT SUM(fine_amount) as total, COUNT(*) as count FROM PAYMENT WHERE payment_date = DATE('now', '+8 hours')");
        
        // Recent Payments
        const recentRes = await db.execute(`
            SELECT p.fine_amount, u.first_name, u.last_name 
            FROM PAYMENT p 
            JOIN BORROW_TRANSACTION b ON p.borrow_id = b.borrow_id 
            JOIN USER u ON b.user_id = u.user_id 
            ORDER BY p.payment_id DESC LIMIT 3
        `);

        res.json({
            success: true,
            unpaidTotal: unpaidRes.rows[0].total || 0,
            unpaidUsers: usersRes.rows[0].count || 0,
            collectedToday: collectedRes.rows[0].total || 0,
            collectedCount: collectedRes.rows[0].count || 0,
            recentPayments: recentRes.rows
        });
    } catch (error) {
        console.error("Fine Stats Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 15.5 GET /api/fines/user/:userId
app.get('/api/fines/user/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const result = await db.execute({
            sql: `
                SELECT 
                    f.fine_id,
                    f.amount,
                    f.fine_type,
                    f.status,
                    b.borrow_id,
                    b.due_date,
                    b.return_date,
                    bk.title as book_title,
                    u.first_name,
                    u.last_name
                FROM FINE f
                JOIN BORROW_TRANSACTION b ON f.borrow_id = b.borrow_id
                JOIN USER u ON b.user_id = u.user_id
                LEFT JOIN BOOK bk ON b.book_id = bk.book_id
                WHERE b.user_id = ?
                ORDER BY f.status DESC, b.return_date DESC
            `,
            args: [userId]
        });

        const fines = result.rows.map(row => ({
            ...row,
            fine_date: row.return_date || row.due_date,
            reason: row.fine_type || (row.amount % 5 === 0 ? 'Overdue Fine' : 'Damage/Loss Fee')
        }));

        res.json({ success: true, data: fines });
    } catch (error) {
        console.error("Fetch User Fines Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 16. GET /api/user/:id
app.get('/api/user/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.execute({
            sql: "SELECT user_id, first_name, last_name, email, contact_number, address FROM USER WHERE user_id = ?",
            args: [id]
        });

        if (result.rows.length > 0) {
            res.json({ success: true, data: result.rows[0] });
        } else {
            res.status(404).json({ success: false, message: "User not found." });
        }
    } catch (error) {
        console.error("Fetch User Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});


// 19. PUT /api/user/:id (Update Profile)
app.put('/api/user/:id', async (req, res) => {
    const { id } = req.params;
    const { first_name, last_name, email, contact_number, address } = req.body;

    try {
        await db.execute({
            sql: "UPDATE USER SET first_name = ?, last_name = ?, email = ?, contact_number = ?, address = ? WHERE user_id = ?",
            args: [first_name, last_name, email, contact_number, address, id]
        });
        res.json({ success: true, message: "Profile updated successfully." });
    } catch (error) {
        console.error("Update Profile Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 20. PUT /api/user/:id/password (Update Password)
app.put('/api/user/:id/password', async (req, res) => {
    const { id } = req.params;
    const { currentPassword, newPassword } = req.body;

    try {
        // 1. Verify current password
        const userRes = await db.execute({
            sql: "SELECT password FROM USER WHERE user_id = ?",
            args: [id]
        });

        if (userRes.rows.length === 0) return res.status(404).json({ success: false, message: "User not found." });
        
        if (userRes.rows[0].password !== currentPassword) {
            return res.status(400).json({ success: false, message: "Incorrect current password." });
        }

        // 2. Update password
        await db.execute({
            sql: "UPDATE USER SET password = ? WHERE user_id = ?",
            args: [newPassword, id]
        });

        res.json({ success: true, message: "Password updated successfully." });
    } catch (error) {
        console.error("Update Password Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 17. GET /api/books/public (For Landing Page)
app.get('/api/books/public', async (req, res) => {
    const { sort } = req.query; // 'latest' or 'popular'

    try {
        let sql = "";
        
        if (sort === 'popular') {
            sql = `
                SELECT b.book_id, b.title, b.image_url, COUNT(bt.borrow_id) as borrow_count
                FROM BOOK b
                LEFT JOIN BORROW_TRANSACTION bt ON b.book_id = bt.book_id
                GROUP BY b.book_id
                ORDER BY borrow_count DESC, b.title ASC
                LIMIT 4
            `;
        } else {
            // Default to latest
            sql = "SELECT book_id, title, image_url, date_added FROM BOOK ORDER BY date_added DESC, book_id DESC LIMIT 4";
        }

        const result = await db.execute(sql);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error("Fetch Public Books Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// 18. GET /api/donations/user/:userId
app.get('/api/donations/user/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const result = await db.execute({
            sql: `SELECT book_title, category, quantity, donation_date 
                  FROM DONATION 
                  WHERE user_id = ? AND donation_type = 'Inbound'
                  ORDER BY donation_date DESC`,
            args: [userId]
        });
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error("Fetch User Donations Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});