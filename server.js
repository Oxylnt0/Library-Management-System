const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const { db } = require('./db_config.js');
const { sendAdminWelcomeEmail, sendOtpEmail, sendAccountStatusEmail, sendLibraryCard } = require('./email_service.js');
const { logUserAction, logAdminAction } = require('./audit_service.js');

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
            sql: `SELECT r.reservation_id, r.user_id, r.book_id, r.reservation_date, r.status, r.priority_no,
                         u.first_name, u.last_name, b.title 
                  FROM RESERVATION r
                  JOIN BOOK b ON r.book_id = b.book_id
                  JOIN USER u ON r.user_id = u.user_id
                  WHERE r.status IN ('Pending', 'Approved') 
                  AND b.status = 'Available'
                  AND r.priority_no = (
                      SELECT MIN(priority_no) 
                      FROM RESERVATION r2 
                      WHERE r2.book_id = r.book_id 
                      AND r2.status IN ('Pending', 'Approved')
                  )
                  ORDER BY r.status ASC, r.reservation_date ASC`
        });

        // Array 2: Waitlist (Pending Reservation + Book NOT Available)
        const waitlistRes = await db.execute({
            sql: `SELECT r.reservation_id, r.user_id, r.book_id, r.reservation_date, r.priority_no,
                         u.first_name, u.last_name, b.title, b.status as book_status
                  FROM RESERVATION r
                  JOIN BOOK b ON r.book_id = b.book_id
                  JOIN USER u ON r.user_id = u.user_id
                  WHERE r.status = 'Pending' 
                  AND (
                      b.status != 'Available' 
                      OR 
                      r.priority_no > (
                          SELECT MIN(priority_no) 
                          FROM RESERVATION r2 
                          WHERE r2.book_id = r.book_id 
                          AND r2.status IN ('Pending', 'Approved')
                      )
                  )
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
            sql: "SELECT material_id, available_copies FROM BOOK WHERE book_id = ?",
            args: [bookId]
        });
        if (bookRes.rows.length === 0) return res.status(404).json({ success: false, message: "Book not found." });

        const materialId = bookRes.rows[0].material_id;
        const currentCopies = bookRes.rows[0].available_copies;

        if (currentCopies <= 0) return res.status(400).json({ success: false, message: "No copies available." });

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
        const newStatus = (currentCopies - 1 === 0) ? 'Borrowed' : 'Available';
        await db.execute({
            sql: "UPDATE BOOK SET available_copies = available_copies - 1, status = ? WHERE book_id = ?",
            args: [newStatus, bookId]
        });

        res.json({ success: true, message: "Checkout processed successfully." });
    } catch (error) {
        console.error("Checkout Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 4. POST /api/donations/inbound
app.post('/api/donations/inbound', async (req, res) => {
    const { user_id, donor_name, book_title, category, quantity, adminId } = req.body;

    try {
        await db.execute({
            sql: `INSERT INTO DONATION (donation_type, user_id, donor_name, book_title, category, quantity, donation_date) 
                  VALUES ('Inbound', ?, ?, ?, ?, ?, DATE('now', '+8 hours'))`,
            args: [user_id || null, donor_name || null, book_title, category, quantity]
        });

        if (adminId) {
            await logAdminAction(adminId, 'INBOUND_DONATION', 'DONATION', null, `Received donation: ${book_title} (x${quantity}) from ${donor_name || 'Anonymous'}`);
        }

        res.json({ success: true, message: "Donation recorded successfully." });
    } catch (error) {
        console.error("Inbound Donation Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 5. GET /api/donations/eligible
app.get('/api/donations/eligible', async (req, res) => {
    try {
        // Fetch books marked as Outdated or Obsolete
        const result = await db.execute({
            sql: `SELECT book_id, title, book_category, book_condition, date_added, status 
                  FROM BOOK 
                  WHERE book_condition IN ('Outdated', 'Obsolete') 
                  AND status IN ('Available', 'Archived')`
        });

        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error("Fetch Eligible Books Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 6. POST /api/donations/outbound
app.post('/api/donations/outbound', async (req, res) => {
    const { book_id, book_title, category, recipient_organization, adminId } = req.body;

    try {
        // 1. Update Book Status
        await db.execute({
            sql: "UPDATE BOOK SET status = 'Donated Outbound', book_condition = 'Outdated' WHERE book_id = ?",
            args: [book_id]
        });

        // 2. Insert Donation Record
        await db.execute({
            sql: `INSERT INTO DONATION (donation_type, recipient_organization, book_id, book_title, category, quantity, donation_date) 
                  VALUES ('Outbound', ?, ?, ?, ?, 1, DATE('now', '+8 hours'))`,
            args: [recipient_organization, book_id, book_title, category]
        });

        if (adminId) {
            await logAdminAction(adminId, 'OUTBOUND_DONATION', 'DONATION', null, `Donated book '${book_title}' to ${recipient_organization}`);
        }

        res.json({ success: true, message: "Outbound donation processed successfully." });
    } catch (error) {
        console.error("Outbound Donation Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 6.5 POST /api/donations/outbound/bulk
app.post('/api/donations/outbound/bulk', async (req, res) => {
    const { books, recipient_organization, adminId } = req.body; // books is array of { book_id, book_title, category }

    try {
        for (const book of books) {
             // 1. Update Book Status
            await db.execute({
                sql: "UPDATE BOOK SET status = 'Donated Outbound' WHERE book_id = ?",
                args: [book.book_id]
            });

            // 2. Insert Donation Record
            await db.execute({
                sql: `INSERT INTO DONATION (donation_type, recipient_organization, book_id, book_title, category, quantity, donation_date) 
                      VALUES ('Outbound', ?, ?, ?, ?, 1, DATE('now', '+8 hours'))`,
                args: [recipient_organization, book.book_id, book.book_title, book.category]
            });
        }
       
        if (adminId) {
            await logAdminAction(adminId, 'OUTBOUND_DONATION', 'DONATION', null, `Processed bulk donation of ${books.length} items to ${recipient_organization}`);
        }

        res.json({ success: true, message: `Successfully donated ${books.length} items.` });
    } catch (error) {
        console.error("Bulk Outbound Donation Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 6.6 GET /api/donations/outbound/history
app.get('/api/donations/outbound/history', async (req, res) => {
    try {
        const result = await db.execute({
            sql: `SELECT b.book_id, b.title, b.book_category, b.book_condition, b.status, d.donation_date, d.recipient_organization
                  FROM BOOK b
                  LEFT JOIN DONATION d ON b.book_id = d.book_id AND d.donation_type = 'Outbound'
                  WHERE b.status = 'Donated Outbound'
                  ORDER BY d.donation_date DESC`
        });
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error("Fetch Donated History Error:", error);
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

        if (data.admin_id) {
            await logAdminAction(data.admin_id, 'ADD_MATERIAL', 'MATERIAL', materialId, `Added new ${materialType}: ${data.title}`);
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
            sql: "SELECT available_copies, status, material_id, title FROM BOOK WHERE book_id = ?",
            args: [book_id]
        });

        if (bookRes.rows.length === 0) return res.status(404).json({ success: false, message: "Book not found." });
        
        const book = bookRes.rows[0];
        if (book.available_copies <= 0) return res.status(400).json({ success: false, message: "Book is currently unavailable." });

        // 2. Create Pending Transaction (Hold expires in 30 mins)
        const transRes = await db.execute({
            sql: `INSERT INTO BORROW_TRANSACTION (user_id, book_id, material_id, borrow_date, status, expires_at, borrow_type) 
                  VALUES (?, ?, ?, DATE('now', '+8 hours'), 'Pending', DATETIME('now', '+8 hours', '+30 minutes'), 'Outside Library') RETURNING borrow_id`,
            args: [user_id, book_id, book.material_id]
        });

        const borrowId = transRes.rows[0].borrow_id;

        // 3. Update Book Inventory
        const newStatus = (book.available_copies - 1 === 0) ? 'Borrowed' : 'Available';
        await db.execute({
            sql: "UPDATE BOOK SET available_copies = available_copies - 1, status = ? WHERE book_id = ?",
            args: [newStatus, book_id]
        });

        await logUserAction(user_id, 'BORROW_HOLD', 'BORROW_TRANSACTION', borrowId, `User placed 30-min hold on '${book.title}'`);

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
        // Get book_id and user_id from transaction to update inventory and log
        const transRes = await db.execute({
            sql: `SELECT bt.book_id, bt.user_id, b.title 
                  FROM BORROW_TRANSACTION bt
                  JOIN BOOK b ON bt.book_id = b.book_id
                  WHERE bt.borrow_id = ? AND bt.status = 'Pending'`,
            args: [borrow_id]
        });
        
        if (transRes.rows.length === 0) {
            return res.status(400).json({ success: false, message: "Transaction not found or not pending." });
        }
        const { book_id, user_id, title } = transRes.rows[0];

        // Update Transaction to Cancelled
        await db.execute({
            sql: "UPDATE BORROW_TRANSACTION SET status = 'Cancelled' WHERE borrow_id = ?",
            args: [borrow_id]
        });

        // Update Book Inventory (Make available again)
        await db.execute({
            sql: "UPDATE BOOK SET status = 'Available', available_copies = available_copies + 1 WHERE book_id = ?",
            args: [book_id]
        });

        await logUserAction(user_id, 'CANCEL_HOLD', 'BORROW_TRANSACTION', borrow_id, `User cancelled hold for '${title}'`);

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

        // Fetch title for log
        const bookRes = await db.execute({ sql: "SELECT title FROM BOOK WHERE book_id = ?", args: [book_id] });
        const bookTitle = bookRes.rows[0]?.title || 'Unknown Book';

        // 2. Insert Reservation
        const resResult = await db.execute({
            sql: "INSERT INTO RESERVATION (user_id, book_id, status, priority_no) VALUES (?, ?, 'Pending', ?) RETURNING reservation_id",
            args: [user_id, book_id, nextPriority]
        });

        await logUserAction(user_id, 'JOIN_WAITLIST', 'RESERVATION', resResult.rows[0].reservation_id, `User joined waitlist for '${bookTitle}' (Priority: ${nextPriority})`);

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
        let sql = `SELECT * FROM BOOK 
                   WHERE book_condition NOT IN ('Outdated', 'Obsolete') 
                   AND status NOT IN ('Archived', 'Donated Outbound', 'Lost')`;
        let args = [];

        if (userId) {
            sql = `
                SELECT b.*,
                (SELECT COUNT(*) FROM BORROW_TRANSACTION bt 
                 WHERE bt.book_id = b.book_id 
                 AND bt.user_id = ? 
                 AND bt.status IN ('Pending', 'Borrowed')) as user_already_has_it,
                (SELECT status FROM BORROW_TRANSACTION bt 
                 WHERE bt.book_id = b.book_id 
                 AND bt.user_id = ? 
                 AND bt.status IN ('Pending', 'Borrowed') LIMIT 1) as user_transaction_status,
                (SELECT COUNT(*) FROM RESERVATION r 
                 WHERE r.book_id = b.book_id 
                 AND r.user_id = ? 
                 AND r.status = 'Pending') as user_is_waitlisted
                FROM BOOK b
                WHERE b.book_condition NOT IN ('Outdated', 'Obsolete') 
                AND b.status NOT IN ('Archived', 'Donated Outbound', 'Lost')
            `;
            args = [userId, userId, userId];
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
    const { newPassword } = req.body;

    try {
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
                WHERE b.book_condition NOT IN ('Outdated', 'Obsolete') 
                AND b.status NOT IN ('Archived', 'Donated Outbound', 'Lost')
                GROUP BY b.book_id
                ORDER BY borrow_count DESC, b.title ASC
                LIMIT 4
            `;
        } else {
            // Default to latest
            sql = `SELECT book_id, title, image_url, date_added FROM BOOK 
                   WHERE book_condition NOT IN ('Outdated', 'Obsolete') 
                   AND status NOT IN ('Archived', 'Donated Outbound', 'Lost')
                   ORDER BY date_added DESC, book_id DESC LIMIT 4`;
        }

        const result = await db.execute(sql);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error("Fetch Public Books Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 21. POST /api/admin/weeding/process (CREW Method Automation)
app.post('/api/admin/weeding/process', async (req, res) => {
    try {
        // 1. Mark OBSOLETE (5 Years+)
        // Genres: Computer Science, Almanac, Medicine, Law
        const obsoleteSql = `
            UPDATE BOOK 
            SET book_condition = 'Obsolete'
            WHERE status = 'Available' AND (
                (genre IN ('Computer Science & Technology', 'Almanac', 'Medicine & Health', 'Law & Politics') 
                 AND (CAST(strftime('%Y', 'now', '+8 hours') AS INTEGER) - publication_year) >= 5)
            )`;
        await db.execute(obsoleteSql);

        // 2. Mark OUTDATED (3 to 4 Years Fast Moving)
                // Genres: Computer Science, Almanac
                // FIX: Added a strict ceiling (< 5) so it doesn't overwrite Obsolete books!
                const outdatedFastSql = `
                    UPDATE BOOK 
                    SET book_condition = 'Outdated'
                    WHERE status = 'Available' AND (
                        genre IN ('Computer Science & Technology', 'Almanac') 
                        AND (CAST(strftime('%Y', 'now', '+8 hours') AS INTEGER) - publication_year) >= 3
                        AND (CAST(strftime('%Y', 'now', '+8 hours') AS INTEGER) - publication_year) < 5
                    )`;
                await db.execute(outdatedFastSql);

        // 3. Mark OUTDATED (10 Years+ Medium Moving)
        const outdatedMedSql = `
            UPDATE BOOK 
            SET book_condition = 'Outdated'
            WHERE status = 'Available' AND book_condition != 'Obsolete' AND (
                (genre IN ('Business & Economics', 'Biology & Life Sciences', 'Chemistry & Physics', 
                           'Engineering', 'Education & Teaching', 'Atlas & Maps', 'Encyclopedia') 
                 AND (CAST(strftime('%Y', 'now', '+8 hours') AS INTEGER) - publication_year) >= 10)
            )`;
        await db.execute(outdatedMedSql);

        // 4. Mark OUTDATED (15 Years+ Slow Moving)
        const outdatedSlowSql = `
            UPDATE BOOK 
            SET book_condition = 'Outdated'
            WHERE status = 'Available' AND book_condition != 'Obsolete' AND (
                (genre IN ('History & Geography', 'Self-Help & Motivation') 
                 AND (CAST(strftime('%Y', 'now', '+8 hours') AS INTEGER) - publication_year) >= 15)
            )`;
        await db.execute(outdatedSlowSql);

        // 5. Apply similar logic to PERIODICALS (using publication_date)
        // Assuming Periodicals follow the 'Fast Moving' rule generally if they match the genre
        // or just general obsolescence for news/magazines > 5 years
        await db.execute(`UPDATE PERIODICAL SET periodical_condition = 'Obsolete' WHERE status = 'Available' AND (CAST(strftime('%Y', 'now', '+8 hours') AS INTEGER) - CAST(strftime('%Y', publication_date) AS INTEGER)) >= 5`);

        res.json({ success: true, message: "Weeding scan completed. Items tagged as Outdated/Obsolete." });
    } catch (error) {
        console.error("Weeding Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 22. POST /api/admin/weeding/archive-all (Bulk Archive)
app.post('/api/admin/weeding/archive-all', async (req, res) => {
    try {
        await db.execute(`
            UPDATE BOOK SET status = 'Archived' 
            WHERE book_condition IN ('Outdated', 'Obsolete') AND status = 'Available'
        `);
        await db.execute(`
            UPDATE PERIODICAL SET status = 'Archived' 
            WHERE periodical_condition IN ('Outdated', 'Obsolete') AND status = 'Available'
        `);
        res.json({ success: true, message: "All outdated and obsolete items have been archived." });
    } catch (error) {
        console.error("Bulk Archive Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 23. POST /api/admin/create
app.post('/api/admin/create', async (req, res) => {
    const { full_name, email, password, role, currentAdminId } = req.body;

    try {
        const result = await db.execute({
            sql: "INSERT INTO ADMIN (full_name, email, password, role, status) VALUES (?, ?, ?, ?, 'Active') RETURNING admin_id",
            args: [full_name, email, password, role]
        });

        const newAdminId = result.rows[0].admin_id;

        // Send Welcome Email
        await sendAdminWelcomeEmail(email, full_name, role);

        if (currentAdminId) {
            await logAdminAction(currentAdminId, 'CREATE_ADMIN', 'ADMIN', newAdminId, `Created new admin: ${full_name} (${role})`);
        }

        res.json({ success: true, message: "Admin created successfully." });
    } catch (error) {
        console.error("Create Admin Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 24. POST /api/admin/login
app.post('/api/admin/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await db.execute({
            sql: "SELECT * FROM ADMIN WHERE email = ? AND password = ? AND status = 'Active'",
            args: [email, password]
        });

        if (result.rows.length > 0) {
            const admin = result.rows[0];
            // Remove password from response
            await logAdminAction(admin.admin_id, 'LOGIN', 'ADMIN', admin.admin_id, 'Admin logged in successfully');
            delete admin.password;
            res.json({ success: true, admin });
        } else {
            res.status(401).json({ success: false, message: "Invalid credentials or inactive account." });
        }
    } catch (error) {
        console.error("Admin Login Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 38. GET /api/admin/audit-logs (Moved up to avoid conflict with /api/admin/:id)
app.get('/api/admin/audit-logs', async (req, res) => {
    const { filter } = req.query; // 'all', 'admin', 'user', 'guardian'
    
    try {
        let queries = [];

        if (filter === 'all' || filter === 'admin') {
            queries.push(`SELECT 'Admin' as role, admin_id as actor_id, action, target_table, target_id, details, date_time FROM ADMIN_AUDIT_LOG`);
        }
        if (filter === 'all' || filter === 'user') {
            queries.push(`SELECT 'User' as role, user_id as actor_id, action, target_table, target_id, details, date_time FROM USER_AUDIT_LOG`);
        }
        if (filter === 'all' || filter === 'guardian') {
            queries.push(`SELECT 'Guardian' as role, guardian_id as actor_id, action, target_table, target_id, details, date_time FROM GUARDIAN_AUDIT_LOG`);
        }

        if (queries.length === 0) {
             return res.json({ success: true, data: [] });
        }

        const sql = queries.join(" UNION ALL ") + " ORDER BY date_time DESC LIMIT 500";
        
        const result = await db.execute(sql);
        res.json({ success: true, data: result.rows });

    } catch (error) {
        console.error("Audit Log Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 25. GET /api/admin/:id
app.get('/api/admin/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.execute({
            sql: "SELECT admin_id, full_name, email, role, status FROM ADMIN WHERE admin_id = ?",
            args: [id]
        });

        if (result.rows.length > 0) {
            res.json({ success: true, data: result.rows[0] });
        } else {
            res.status(404).json({ success: false, message: "Admin not found." });
        }
    } catch (error) {
        console.error("Fetch Admin Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 26. PUT /api/admin/:id/password
app.put('/api/admin/:id/password', async (req, res) => {
    const { id } = req.params;
    const { password, adminId } = req.body;
    try {
        await db.execute({
            sql: "UPDATE ADMIN SET password = ? WHERE admin_id = ?",
            args: [password, id]
        });
        if (adminId) {
            await logAdminAction(adminId, 'CHANGE_PASSWORD', 'ADMIN', id, 'Updated own password');
        }
        res.json({ success: true, message: "Password updated successfully." });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 27. PUT /api/admin/:id (Update Profile Info)
app.put('/api/admin/:id', async (req, res) => {
    const { id } = req.params;
    const { full_name, email, role, currentAdminId, adminId } = req.body;
    const actorId = currentAdminId || adminId;

    try {
        if (role) {
            await db.execute({
                sql: "UPDATE ADMIN SET full_name = ?, email = ?, role = ? WHERE admin_id = ?",
                args: [full_name, email, role, id]
            });
        } else {
            await db.execute({
                sql: "UPDATE ADMIN SET full_name = ?, email = ? WHERE admin_id = ?",
                args: [full_name, email, id]
            });
        }

        if (actorId) {
            const action = (actorId == id) ? 'UPDATE_PROFILE' : 'EDIT_ADMIN';
            await logAdminAction(actorId, action, 'ADMIN', id, `Updated admin ${id} details`);
        }

        res.json({ success: true, message: "Admin profile updated successfully." });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 28. GET /api/admins (List all admins)
app.get('/api/admins', async (req, res) => {
    try {
        const result = await db.execute("SELECT admin_id, full_name, email, role, status FROM ADMIN ORDER BY admin_id ASC");
        res.json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 29. DELETE /api/admin/:id (Delete admin)
app.delete('/api/admin/:id', async (req, res) => {
    const { id } = req.params;
    const { currentAdminId } = req.body;
    try {
        await db.execute({
            sql: "DELETE FROM ADMIN WHERE admin_id = ?",
            args: [id]
        });
        if (currentAdminId) {
            await logAdminAction(currentAdminId, 'DELETE_ADMIN', 'ADMIN', id, `Deleted admin account ${id}`);
        }
        res.json({ success: true, message: "Admin deleted successfully." });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// --- AUTH RECOVERY ENDPOINTS ---

// 30. Forgot Email - Search User
app.post('/api/auth/forgot-email/search', async (req, res) => {
    const { firstName, lastName, birthDate } = req.body;
    try {
        const userRes = await db.execute({
            sql: "SELECT user_id FROM USER WHERE first_name = ? AND last_name = ? AND birth_date = ?",
            args: [firstName, lastName, birthDate]
        });
        
        if (userRes.rows.length === 0) {
            return res.json({ success: false, message: "No matching student found." });
        }
        
        const userId = userRes.rows[0].user_id;
        
        // Fetch Questions (Q1 & Q2)
        const qRes = await db.execute({
            sql: "SELECT question_1, question_2 FROM SECURITY_QUESTIONS WHERE user_id = ?",
            args: [userId]
        });
        
        if (qRes.rows.length === 0) {
            return res.json({ success: false, message: "Security questions not set for this user." });
        }
        
        res.json({ 
            success: true, 
            userId, 
            questions: [
                { key: 'answer_1', text: qRes.rows[0].question_1 },
                { key: 'answer_2', text: qRes.rows[0].question_2 }
            ]
        });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// 31. Forgot Email - Verify & Reveal
app.post('/api/auth/forgot-email/verify', async (req, res) => {
    const { userId, answers } = req.body;
    try {
        const qRes = await db.execute({
            sql: "SELECT answer_1, answer_2, u.email FROM SECURITY_QUESTIONS sq JOIN USER u ON sq.user_id = u.user_id WHERE sq.user_id = ?",
            args: [userId]
        });
        
        if (qRes.rows.length === 0) return res.json({ success: false, message: "User not found." });
        
        const row = qRes.rows[0];
        if (row.answer_1.toLowerCase().trim() === answers.answer_1.toLowerCase().trim() &&
            row.answer_2.toLowerCase().trim() === answers.answer_2.toLowerCase().trim()) {
            
            // Mask Email
            const email = row.email || "";
            const [local, domain] = email.split('@');
            const maskedLocal = local.length > 3 ? local.substring(0, 3) + '*'.repeat(local.length - 3) : local + '***';
            const maskedEmail = `${maskedLocal}@${domain}`;
            
            await logUserAction(userId, 'FORGOT_EMAIL_REVEAL', 'USER', userId, 'User recovered email via security questions');
            res.json({ success: true, email: maskedEmail });
        } else {
            res.json({ success: false, message: "Incorrect answers." });
        }
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// 32. Forgot Password - Init (OTP)
app.post('/api/auth/forgot-password/init', async (req, res) => {
    const { email } = req.body;
    try {
        const userRes = await db.execute({ sql: "SELECT user_id FROM USER WHERE email = ?", args: [email] });
        if (userRes.rows.length === 0) return res.json({ success: false, message: "Email not found." });
        
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        await db.execute({
            sql: "INSERT INTO OTP_VERIFICATION (email, otp_code, expires_at) VALUES (?, ?, DATETIME('now', '+10 minutes'))",
            args: [email, otp]
        });
        
        await sendOtpEmail(email, otp);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// 33. Forgot Password - Verify OTP
app.post('/api/auth/forgot-password/verify-otp', async (req, res) => {
    const { email, otp } = req.body;
    try {
        const resOtp = await db.execute({
            sql: "SELECT * FROM OTP_VERIFICATION WHERE email = ? AND otp_code = ? AND is_used = 0 AND expires_at > DATETIME('now') ORDER BY created_at DESC LIMIT 1",
            args: [email, otp]
        });
        
        if (resOtp.rows.length > 0) {
            await db.execute({ sql: "UPDATE OTP_VERIFICATION SET is_used = 1 WHERE otp_id = ?", args: [resOtp.rows[0].otp_id] });
            res.json({ success: true });
        } else {
            res.json({ success: false, message: "Invalid or expired OTP." });
        }
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// 34. Forgot Password - Get Questions (Fallback)
app.post('/api/auth/forgot-password/questions', async (req, res) => {
    const { email } = req.body;
    try {
        const qRes = await db.execute({
            sql: "SELECT question_1, question_2, answer_1, answer_2 FROM SECURITY_QUESTIONS sq JOIN USER u ON sq.user_id = u.user_id WHERE u.email = ?",
            args: [email]
        });
        
        if (qRes.rows.length === 0) return res.json({ success: false, message: "No security questions found." });
        
        res.json({ success: true, questions: [{ text: qRes.rows[0].question_1 }, { text: qRes.rows[0].question_2 }] });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// 35. Forgot Password - Verify Questions & Reset
app.post('/api/auth/reset-password', async (req, res) => {
    const { email, newPassword, answers } = req.body; // answers optional if OTP used
    try {
        // If answers provided, verify them first (Path B)
        if (answers) {
            const qRes = await db.execute({
                sql: "SELECT answer_1, answer_2 FROM SECURITY_QUESTIONS sq JOIN USER u ON sq.user_id = u.user_id WHERE u.email = ?",
                args: [email]
            });
            if (qRes.rows.length === 0) return res.json({ success: false, message: "User not found." });
            const row = qRes.rows[0];
            if (row.answer_1.toLowerCase().trim() !== answers.answer_1.toLowerCase().trim() ||
                row.answer_2.toLowerCase().trim() !== answers.answer_2.toLowerCase().trim()) {
                return res.json({ success: false, message: "Incorrect security answers." });
            }
        }
        // Update Password
        await db.execute({ sql: "UPDATE USER SET password = ? WHERE email = ?", args: [newPassword, email] });
        
        // Fetch ID for logging
        const userRes = await db.execute({ sql: "SELECT user_id FROM USER WHERE email = ?", args: [email] });
        if (userRes.rows.length > 0) {
            await logUserAction(userRes.rows[0].user_id, 'PASSWORD_RESET', 'USER', userRes.rows[0].user_id, 'Password reset successfully using Email OTP/Questions');
        }
        
        res.json({ success: true, message: "Password updated successfully." });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// 36. POST /api/admin/user/status
app.post('/api/admin/user/status', async (req, res) => {
    const { userId, status, adminId } = req.body; // status: 'Active' or 'Rejected'
    try {
        // 1. Fetch User to get email and guardian info
        const userRes = await db.execute({
            sql: "SELECT * FROM USER WHERE user_id = ?",
            args: [userId]
        });
        
        if (userRes.rows.length === 0) return res.status(404).json({ success: false, message: "User not found." });
        const user = userRes.rows[0];
        
        // 2. Update User Status
        await db.execute({
            sql: "UPDATE USER SET status = ? WHERE user_id = ?",
            args: [status, userId]
        });

        let emailToSend = user.email;
        let nameToSend = user.first_name;

        // 3. If Child (has guardian), update Guardian Status too
        if (user.guardian_id) {
            await db.execute({
                sql: "UPDATE GUARDIAN_NAME SET status = ? WHERE guardian_id = ?",
                args: [status, user.guardian_id]
            });
            
            // If user has no email (child), fetch guardian email
            if (!emailToSend) {
                const guardRes = await db.execute({
                    sql: "SELECT email FROM GUARDIAN_NAME WHERE guardian_id = ?",
                    args: [user.guardian_id]
                });
                if (guardRes.rows.length > 0) emailToSend = guardRes.rows[0].email;
            }
        }

        // 4. Send Email
        if (emailToSend) {
            await sendAccountStatusEmail(emailToSend, nameToSend, status);
        }

        if (adminId) {
            await logAdminAction(adminId, 'UPDATE_USER_STATUS', 'USER', userId, `User status updated to ${status}`);
        }

        res.json({ success: true, message: `User status updated to ${status}.` });
    } catch (e) {
        console.error("Update Status Error:", e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// 37. POST /api/user/:id/resend-qr
app.post('/api/user/:id/resend-qr', async (req, res) => {
    const { id } = req.params;
    try {
        const userRes = await db.execute({
            sql: "SELECT email, first_name FROM USER WHERE user_id = ?",
            args: [id]
        });

        if (userRes.rows.length === 0) return res.status(404).json({ success: false, message: "User not found." });
        
        const user = userRes.rows[0];
        const sent = await sendLibraryCard(user.email, id, user.first_name);

        if (sent) {
            res.json({ success: true, message: "QR Code sent to your email." });
        } else {
            res.status(500).json({ success: false, message: "Failed to send email." });
        }
    } catch (error) {
        console.error("Resend QR Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
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

// 39. GET /api/reports/dashboard
app.get('/api/reports/dashboard', async (req, res) => {
    try {
        // 1. Monthly Loans (Current Month)
        const loansRes = await db.execute("SELECT COUNT(*) as count FROM BORROW_TRANSACTION WHERE strftime('%Y-%m', borrow_date) = strftime('%Y-%m', 'now', '+8 hours')");
        
        // 2. New Users (Current Month)
        const usersRes = await db.execute("SELECT COUNT(*) as count FROM USER WHERE strftime('%Y-%m', date_created) = strftime('%Y-%m', 'now', '+8 hours')");
        
        // 3. Fines Collected (Current Month)
        const finesRes = await db.execute("SELECT SUM(fine_amount) as total FROM PAYMENT WHERE strftime('%Y-%m', payment_date) = strftime('%Y-%m', 'now', '+8 hours')");
        
        // 4. Lost Books (Total Active Lost)
        const lostRes = await db.execute("SELECT COUNT(*) as count FROM BOOK WHERE status = 'Lost'");

        // 5. Chart Data (Last 6 Months Borrowing)
        const chartRes = await db.execute(`
            SELECT strftime('%Y-%m', borrow_date) as month, COUNT(*) as count 
            FROM BORROW_TRANSACTION 
            WHERE borrow_date >= date('now', '-5 months', 'start of month')
            GROUP BY month 
            ORDER BY month ASC
        `);

        res.json({
            success: true,
            stats: {
                loans: loansRes.rows[0].count,
                newUsers: usersRes.rows[0].count,
                fines: finesRes.rows[0].total || 0,
                lostBooks: lostRes.rows[0].count
            },
            chart: chartRes.rows
        });
    } catch (error) {
        console.error("Report Dashboard Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 40. POST /api/reports/generate
app.post('/api/reports/generate', async (req, res) => {
    const { reportTypes } = req.body; // reportTypes is array of strings
    let results = {};

    try {
        if (reportTypes.includes('damaged')) {
            const res = await db.execute("SELECT title, author, book_condition FROM BOOK WHERE book_condition IN ('Minor Damage', 'Moderate Damage', 'Severe Damage')");
            results.damaged = res.rows;
        }
        if (reportTypes.includes('outdated')) {
            const res = await db.execute("SELECT title, author, publication_year FROM BOOK WHERE book_condition = 'Outdated'");
            results.outdated = res.rows;
        }
        if (reportTypes.includes('obsolete')) {
            const res = await db.execute("SELECT title, author, publication_year FROM BOOK WHERE book_condition = 'Obsolete'");
            results.obsolete = res.rows;
        }
        if (reportTypes.includes('archived')) {
            const res = await db.execute("SELECT title, author, date_added FROM BOOK WHERE status = 'Archived'");
            results.archived = res.rows;
        }
        if (reportTypes.includes('purchased_vs_donated')) {
            const res = await db.execute("SELECT book_source, COUNT(*) as count FROM BOOK GROUP BY book_source");
            results.purchased_vs_donated = res.rows;
        }
        if (reportTypes.includes('fines')) {
            const res = await db.execute("SELECT payment_method, SUM(fine_amount) as total, COUNT(*) as count FROM PAYMENT GROUP BY payment_method");
            results.fines = res.rows;
        }
        if (reportTypes.includes('unreturned')) {
            const res = await db.execute(`
                SELECT b.title, u.first_name, u.last_name, bt.due_date 
                FROM BORROW_TRANSACTION bt
                JOIN BOOK b ON bt.book_id = b.book_id
                JOIN USER u ON bt.user_id = u.user_id
                WHERE bt.status IN ('Borrowed', 'Overdue')
            `);
            results.unreturned = res.rows;
        }
        if (reportTypes.includes('borrowed_history')) {
             const res = await db.execute(`
                SELECT b.title, u.first_name, u.last_name, bt.borrow_date, bt.return_date
                FROM BORROW_TRANSACTION bt
                JOIN BOOK b ON bt.book_id = b.book_id
                JOIN USER u ON bt.user_id = u.user_id
                ORDER BY bt.borrow_date DESC LIMIT 1000
            `);
            results.borrowed_history = res.rows;
        }
        if (reportTypes.includes('donations')) {
            const res = await db.execute("SELECT donor_name, book_title, quantity, donation_date FROM DONATION WHERE donation_type = 'Inbound'");
            results.donations = res.rows;
        }
        if (reportTypes.includes('inventory_summary')) {
             const res = await db.execute(`
                SELECT status, COUNT(*) as count FROM BOOK GROUP BY status
                UNION ALL
                SELECT 'Total Books', COUNT(*) FROM BOOK
             `);
             results.inventory_summary = res.rows;
        }

        res.json({ success: true, data: results });

    } catch (error) {
        console.error("Generate Report Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 41. GET /api/reports/view (Table Data)
app.get('/api/reports/view', async (req, res) => {
    const { type, startDate, endDate } = req.query;
    
    try {
        let sql = "";
        let args = [];

        // Helper for date filtering
        const dateFilter = (col) => {
            if (startDate && endDate) return ` AND ${col} BETWEEN ? AND ?`;
            return "";
        };
        if (startDate && endDate) args.push(startDate, endDate);

        switch (type) {
            // 1. Circulation
            case 'active_loans':
                sql = `SELECT b.title, u.first_name || ' ' || u.last_name as borrower, bt.borrow_date, bt.due_date 
                       FROM BORROW_TRANSACTION bt 
                       JOIN BOOK b ON bt.book_id = b.book_id 
                       JOIN USER u ON bt.user_id = u.user_id 
                       WHERE bt.status = 'Borrowed' ORDER BY bt.due_date ASC`;
                args = []; // No date filter for current status
                break;
            case 'overdue':
                sql = `SELECT b.title, u.first_name || ' ' || u.last_name as borrower, bt.due_date, 
                       (julianday('now') - julianday(bt.due_date)) as days_overdue
                       FROM BORROW_TRANSACTION bt 
                       JOIN BOOK b ON bt.book_id = b.book_id 
                       JOIN USER u ON bt.user_id = u.user_id 
                       WHERE bt.status IN ('Borrowed', 'Overdue') AND bt.due_date < DATE('now', '+8 hours')`;
                args = [];
                break;
            case 'top_borrowed':
                sql = `SELECT b.title, b.genre, COUNT(bt.borrow_id) as borrow_count 
                       FROM BORROW_TRANSACTION bt 
                       JOIN BOOK b ON bt.book_id = b.book_id 
                       GROUP BY b.book_id ORDER BY borrow_count DESC LIMIT 50`;
                args = [];
                break;

            // 2. Inventory
            case 'inventory_summary':
                sql = `SELECT status, COUNT(*) as count FROM BOOK GROUP BY status`;
                args = [];
                break;
            case 'weeding':
                sql = `SELECT title, author, publication_year, book_condition, location 
                       FROM BOOK WHERE book_condition IN ('Outdated', 'Obsolete') AND status = 'Available'`;
                args = [];
                break;
            case 'donations':
                sql = `SELECT donation_type, donor_name, recipient_organization, book_title, quantity, donation_date 
                       FROM DONATION WHERE 1=1 ${dateFilter('donation_date')}`;
                break;

            // 3. Financials
            case 'revenue_collection':
                // Detailed list for table
                sql = `SELECT payment_id, payment_date, or_number, fine_amount, payment_method, remarks 
                       FROM PAYMENT WHERE 1=1 ${dateFilter('payment_date')} ORDER BY payment_date DESC`;
                break;
            case 'revenue_daily':
                // Grouped by date for analytics (Requested Output)
                sql = `SELECT payment_date, SUM(fine_amount) as total_revenue 
                       FROM PAYMENT WHERE 1=1 ${dateFilter('payment_date')} GROUP BY payment_date ORDER BY payment_date DESC`;
                break;
            case 'outstanding':
                sql = `SELECT u.first_name || ' ' || u.last_name as user, f.amount, f.fine_type, f.status 
                       FROM FINE f 
                       JOIN BORROW_TRANSACTION bt ON f.borrow_id = bt.borrow_id 
                       JOIN USER u ON bt.user_id = u.user_id 
                       WHERE f.status = 'Unpaid'`;
                args = [];
                break;

            // 4. Users
            case 'registration_queue':
                sql = `SELECT 'User' as type, first_name || ' ' || last_name as name, email, date_created FROM USER WHERE status = 'Pending'
                       UNION ALL
                       SELECT 'Guardian' as type, first_name || ' ' || last_name as name, email, date_created FROM GUARDIAN_NAME WHERE status = 'Pending'`;
                args = [];
                break;
            case 'disciplinary':
                sql = `SELECT u.first_name || ' ' || u.last_name as user, b.reason, b.ban_date, b.end_date 
                       FROM BAN_TERMINATION b JOIN USER u ON b.user_id = u.user_id`;
                args = [];
                break;
            
            // 5. Audits
            case 'audit_trail':
                // Handled by existing audit endpoint logic in frontend, or we can add a specific query here if needed.
                break;

            default:
                return res.json({ success: false, message: "Invalid report type" });
        }

        const result = await db.execute({ sql, args });
        res.json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 42. GET /api/reports/stats (Summary Cards)
app.get('/api/reports/stats', async (req, res) => {
    const { domain } = req.query;
    let stats = [];

    try {
        if (domain === 'circulation') {
            const active = await db.execute("SELECT COUNT(*) as c FROM BORROW_TRANSACTION WHERE status = 'Borrowed'");
            const overdue = await db.execute("SELECT COUNT(*) as c FROM BORROW_TRANSACTION WHERE status = 'Overdue' OR (status = 'Borrowed' AND due_date < DATE('now', '+8 hours'))");
            const total = await db.execute("SELECT COUNT(*) as c FROM BORROW_TRANSACTION");
            stats = [
                { label: 'Active Loans', value: active.rows[0].c, color: 'blue' },
                { label: 'Overdue Items', value: overdue.rows[0].c, color: 'red' },
                { label: 'Total Transactions', value: total.rows[0].c, color: 'slate' }
            ];
        } else if (domain === 'inventory') {
            const total = await db.execute("SELECT COUNT(*) as c FROM BOOK");
            const lost = await db.execute("SELECT COUNT(*) as c FROM BOOK WHERE status = 'Lost'");
            const archived = await db.execute("SELECT COUNT(*) as c FROM BOOK WHERE status = 'Archived'");
            stats = [
                { label: 'Total Books', value: total.rows[0].c, color: 'blue' },
                { label: 'Lost Books', value: lost.rows[0].c, color: 'red' },
                { label: 'Archived', value: archived.rows[0].c, color: 'amber' }
            ];
        } else if (domain === 'financials') {
            const revenue = await db.execute("SELECT SUM(fine_amount) as s FROM PAYMENT");
            const unpaid = await db.execute("SELECT SUM(amount) as s FROM FINE WHERE status = 'Unpaid'");
            stats = [
                { label: 'Total Revenue', value: `₱${(revenue.rows[0].s || 0).toFixed(2)}`, color: 'emerald' },
                { label: 'Outstanding Balance', value: `₱${(unpaid.rows[0].s || 0).toFixed(2)}`, color: 'red' }
            ];
        } else if (domain === 'users') {
            const pending = await db.execute("SELECT COUNT(*) as c FROM USER WHERE status = 'Pending'");
            const active = await db.execute("SELECT COUNT(*) as c FROM USER WHERE status = 'Active'");
            stats = [
                { label: 'Pending Approvals', value: pending.rows[0].c, color: 'amber' },
                { label: 'Active Users', value: active.rows[0].c, color: 'blue' }
            ];
        }
        res.json({ success: true, stats });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// 43. ANNOUNCEMENTS CRUD

// GET /api/announcements/public (Public View - Active Only)
app.get('/api/announcements/public', async (req, res) => {
    try {
        const result = await db.execute(`
            SELECT title, content, date_posted, priority 
            FROM ANNOUNCEMENT 
            WHERE status = 'Published' 
            AND (valid_until IS NULL OR valid_until > DATETIME('now', '+8 hours'))
            ORDER BY 
                CASE priority WHEN 'Urgent' THEN 1 WHEN 'High' THEN 2 ELSE 3 END, 
                date_posted DESC
            LIMIT 5
        `);
        res.json({ success: true, data: result.rows });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// GET /api/announcements (Admin View)
app.get('/api/announcements', async (req, res) => {
    try {
        const result = await db.execute(`
            SELECT a.*, ad.full_name as author 
            FROM ANNOUNCEMENT a 
            JOIN ADMIN ad ON a.admin_id = ad.admin_id 
            ORDER BY a.date_posted DESC
        `);
        res.json({ success: true, data: result.rows });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// POST /api/announcements (Create)
app.post('/api/announcements', async (req, res) => {
    const { admin_id, title, content, priority, status, valid_until } = req.body;
    try {
        await db.execute({
            sql: "INSERT INTO ANNOUNCEMENT (admin_id, title, content, priority, status, valid_until) VALUES (?, ?, ?, ?, ?, ?)",
            args: [admin_id, title, content, priority, status, valid_until || null]
        });
        res.json({ success: true, message: "Announcement created successfully." });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// PUT /api/announcements/:id (Update)
app.put('/api/announcements/:id', async (req, res) => {
    const { id } = req.params;
    const { title, content, priority, status, valid_until } = req.body;
    try {
        await db.execute({
            sql: "UPDATE ANNOUNCEMENT SET title = ?, content = ?, priority = ?, status = ?, valid_until = ? WHERE announcement_id = ?",
            args: [title, content, priority, status, valid_until || null, id]
        });
        res.json({ success: true, message: "Announcement updated successfully." });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// DELETE /api/announcements/:id (Archive/Soft Delete)
app.delete('/api/announcements/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.execute({ sql: "UPDATE ANNOUNCEMENT SET status = 'Archived' WHERE announcement_id = ?", args: [id] });
        res.json({ success: true, message: "Announcement archived." });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});