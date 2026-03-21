const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const { db } = require('./db_config.js');
const { sendAdminWelcomeEmail, sendOtpEmail, sendAccountStatusEmail, sendLibraryCard, sendDueSoonEmail, sendAnnouncementEmail } = require('./email_service.js');
const { registerUser, registerGuardian, checkEmailExists, verifyRegistrationOTP, generateAndSendRegistrationOTP } = require('./auth.js');
const { logUserAction, logAdminAction } = require('./audit_service.js');

const app = express();
const PORT = 3000;

// Ensure schema is updated for email reminders (Silently fails if already added)
db.execute("ALTER TABLE BORROW_TRANSACTION ADD COLUMN reminder_sent INTEGER DEFAULT 0").catch(() => {});

// Middleware
app.use(cors());
app.use(express.json());

// --- NEW REGISTRATION API ENDPOINTS ---

// Endpoint to verify OTP
app.post('/api/register/verify-otp', async (req, res) => {
    const { email, otp } = req.body;
    try {
        const result = await verifyRegistrationOTP(email, otp);
        res.json(result);
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// Endpoint to resend OTP
app.post('/api/register/resend-otp', async (req, res) => {
    const { email } = req.body;
    try {
        await generateAndSendRegistrationOTP(email);
        res.json({ success: true, message: "OTP sent." });
    } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// Endpoint to check if email exists
app.post('/api/register/check-email', async (req, res) => {
    const { email } = req.body;
    try {
        const result = await checkEmailExists(email);
        res.json({ success: true, ...result });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Endpoint to register a standard user
app.post('/api/register/user', async (req, res) => {
    const userData = req.body;
    try {
        const result = await registerUser(userData);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Endpoint to register a guardian and child
app.post('/api/register/guardian', async (req, res) => {
    const { guardianData, childrenData } = req.body;
    try {
        const result = await registerGuardian(guardianData, childrenData);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

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
                SELECT r.reservation_id, bc.book_id as item_id, 'Book' as material_type, b.title, DATETIME(r.reservation_date, '+8 hours') as reservation_date, r.status, r.priority_no
                FROM RESERVATION r 
                JOIN BOOK_COPY bc ON r.material_id = bc.material_id
                JOIN BOOK b ON bc.book_id = b.book_id 
                WHERE r.user_id = ? AND r.status = 'Pending'
                UNION ALL
                SELECT r.reservation_id, pc.periodical_id as item_id, 'Periodical' as material_type, p.title, DATETIME(r.reservation_date, '+8 hours') as reservation_date, r.status, r.priority_no
                FROM RESERVATION r 
                JOIN PERIODICAL_COPY pc ON r.material_id = pc.material_id
                JOIN PERIODICAL p ON pc.periodical_id = p.periodical_id 
                WHERE r.user_id = ? AND r.status = 'Pending'
            `,
            args: [userId, userId]
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
        // Array 1: Ready to Process
        const readyRes = await db.execute({
            sql: `SELECT r.reservation_id, r.user_id, bc.book_id as item_id, 'Book' as material_type, DATETIME(r.reservation_date, '+8 hours') as reservation_date, r.status, r.priority_no,
                         u.first_name, u.last_name, b.title, bc.status as material_status 
                  FROM RESERVATION r
                  JOIN BOOK_COPY bc ON r.material_id = bc.material_id
                  JOIN BOOK b ON bc.book_id = b.book_id
                  JOIN USER u ON r.user_id = u.user_id
                  WHERE r.status IN ('Pending', 'Approved') 
                  AND bc.status = 'Available'
                  UNION ALL
                  SELECT r.reservation_id, r.user_id, pc.periodical_id as item_id, 'Periodical' as material_type, DATETIME(r.reservation_date, '+8 hours') as reservation_date, r.status, r.priority_no,
                         u.first_name, u.last_name, p.title, pc.status as material_status 
                  FROM RESERVATION r
                  JOIN PERIODICAL_COPY pc ON r.material_id = pc.material_id
                  JOIN PERIODICAL p ON pc.periodical_id = p.periodical_id
                  JOIN USER u ON r.user_id = u.user_id
                  WHERE r.status IN ('Pending', 'Approved') 
                  AND pc.status = 'Available'
                  ORDER BY reservation_date ASC`
        });

        // Array 2: Waitlist
        const waitlistRes = await db.execute({
            sql: `SELECT r.reservation_id, r.user_id, bc.book_id as item_id, 'Book' as material_type, DATETIME(r.reservation_date, '+8 hours') as reservation_date, r.priority_no,
                         u.first_name, u.last_name, b.title, bc.status as book_status 
                  FROM RESERVATION r
                  JOIN BOOK_COPY bc ON r.material_id = bc.material_id
                  JOIN BOOK b ON bc.book_id = b.book_id
                  JOIN USER u ON r.user_id = u.user_id
                  WHERE r.status = 'Pending' 
                  AND bc.status != 'Available'
                  UNION ALL
                  SELECT r.reservation_id, r.user_id, pc.periodical_id as item_id, 'Periodical' as material_type, DATETIME(r.reservation_date, '+8 hours') as reservation_date, r.priority_no,
                         u.first_name, u.last_name, p.title, pc.status as book_status 
                  FROM RESERVATION r
                  JOIN PERIODICAL_COPY pc ON r.material_id = pc.material_id
                  JOIN PERIODICAL p ON pc.periodical_id = p.periodical_id
                  JOIN USER u ON r.user_id = u.user_id
                  WHERE r.status = 'Pending' 
                  AND pc.status != 'Available' 
                  ORDER BY reservation_date ASC`
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
        const copyRes = await db.execute({
            sql: "SELECT material_id, location FROM BOOK_COPY WHERE book_id = ? AND status = 'Available' LIMIT 1",
            args: [bookId]
        });
        if (copyRes.rows.length === 0) return res.status(400).json({ success: false, message: "No copies available." });

        const materialId = copyRes.rows[0].material_id;
        const isFrontDesk = copyRes.rows[0].location === 'Front Desk';
        const bType = isFrontDesk ? 'Inside Library' : 'Outside Library';
        const dueSql = isFrontDesk ? "DATE('now', '+8 hours')" : "DATE('now', '+8 hours', '+7 days')";

        // Step 1: Mark Reservation as Fulfilled
        await db.execute({
            sql: "UPDATE RESERVATION SET status = 'Fulfilled' WHERE reservation_id = ?",
            args: [reservationId]
        });

        // Step 2: Create Borrow Transaction
        await db.execute({
            sql: `INSERT INTO BORROW_TRANSACTION 
                  (user_id, book_id, material_id, borrow_date, due_date, status, borrow_type) 
                  VALUES (?, ?, ?, DATE('now', '+8 hours'), ${dueSql}, 'Borrowed', ?)`,
            args: [userId, bookId, materialId, bType]
        });

        // Step 3: Update Book Status
        await db.execute({
            sql: "UPDATE BOOK_COPY SET status = 'Borrowed' WHERE material_id = ?",
            args: [materialId]
        });

        res.json({ success: true, message: "Checkout processed successfully." });
    } catch (error) {
        console.error("Checkout Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// POST /api/reservations/cancel
app.post('/api/reservations/cancel', async (req, res) => {
    const { reservation_id } = req.body;
    
    try {
        const resResult = await db.execute({
            sql: `SELECT r.material_id, r.user_id, r.priority_no FROM RESERVATION r WHERE r.reservation_id = ?`,
            args: [reservation_id]
        });

        if (resResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: "Reservation not found." });
        }
        const { material_id, user_id, priority_no } = resResult.rows[0];

        await db.execute({
            sql: "DELETE FROM RESERVATION WHERE reservation_id = ?",
            args: [reservation_id]
        });

        if (priority_no) {
            await db.execute({
                sql: "UPDATE RESERVATION SET priority_no = priority_no - 1 WHERE material_id = ? AND priority_no > ?",
                args: [material_id, priority_no]
            });
        }

        await logUserAction(user_id, 'CANCEL_RESERVATION', `User cancelled reservation`);

        res.json({ success: true, message: "Reservation cancelled." });
    } catch (error) {
        console.error("Cancel Reservation Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 4. POST /api/donations/inbound
app.post('/api/donations/inbound', async (req, res) => {
    const { user_id, donor_name, book_title, category, quantity, adminId } = req.body;

    try {
        await db.execute({
            sql: `INSERT INTO DONATION (donation_type, user_id, donor_name, book_title, category, quantity, donation_date, status) 
                  VALUES ('Inbound', ?, ?, ?, ?, ?, DATE('now', '+8 hours'), 'Pending')`,
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
            sql: `SELECT b.book_id as item_id, 'Book' as material_type, b.title, b.book_category as category, c.book_condition as condition, c.date_added, c.status 
                  FROM BOOK b
                  JOIN BOOK_COPY c ON b.book_id = c.book_id
                  WHERE c.book_condition IN ('Outdated', 'Obsolete') 
                  AND c.status IN ('Available', 'Archived')
                  GROUP BY b.book_id
                  UNION ALL
                  SELECT p.periodical_id as item_id, 'Periodical' as material_type, p.title, p.type as category, pc.periodical_condition as condition, pc.publication_date as date_added, pc.status 
                  FROM PERIODICAL p
                  JOIN PERIODICAL_COPY pc ON p.periodical_id = p.periodical_id
                  WHERE pc.periodical_condition IN ('Outdated', 'Obsolete') 
                  AND pc.status IN ('Available', 'Archived')
                  GROUP BY p.periodical_id`
        });

        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error("Fetch Eligible Books Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 6. POST /api/donations/outbound
app.post('/api/donations/outbound', async (req, res) => {
    const { item_id, material_type, book_title, category, recipient_organization, adminId } = req.body;

    try {
        if (material_type === 'Book') {
            await db.execute({
                sql: `UPDATE BOOK_COPY 
                      SET status = 'Donated Outbound', book_condition = 'Outdated' 
                      WHERE copy_id = (
                          SELECT copy_id FROM BOOK_COPY WHERE book_id = ? AND book_condition IN ('Outdated', 'Obsolete') LIMIT 1
                      )`,
                args: [item_id]
            });
            await db.execute({
                sql: `INSERT INTO DONATION (donation_type, recipient_organization, book_id, book_title, category, quantity, donation_date, status) 
                      VALUES ('Outbound', ?, ?, ?, ?, 1, DATE('now', '+8 hours'), 'Completed')`,
                args: [recipient_organization, item_id, book_title, category]
            });
        } else {
            await db.execute({
                sql: `UPDATE PERIODICAL_COPY 
                      SET status = 'Donated Outbound', periodical_condition = 'Outdated' 
                      WHERE p_copy_id = (
                          SELECT p_copy_id FROM PERIODICAL_COPY WHERE periodical_id = ? AND periodical_condition IN ('Outdated', 'Obsolete') LIMIT 1
                      )`,
                args: [item_id]
            });
            await db.execute({
                sql: `INSERT INTO DONATION (donation_type, recipient_organization, periodical_id, book_title, category, quantity, donation_date, status) 
                      VALUES ('Outbound', ?, ?, ?, ?, 1, DATE('now', '+8 hours'), 'Completed')`,
                args: [recipient_organization, item_id, book_title, category]
            });
        }

        if (adminId) {
            await logAdminAction(adminId, 'OUTBOUND_DONATION', 'DONATION', null, `Donated ${material_type} '${book_title}' to ${recipient_organization}`);
        }

        res.json({ success: true, message: "Outbound donation processed successfully." });
    } catch (error) {
        console.error("Outbound Donation Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 6.5 POST /api/donations/outbound/bulk
app.post('/api/donations/outbound/bulk', async (req, res) => {
    const { books, recipient_organization, adminId } = req.body; // books is array of { item_id, material_type, book_title, category }

    try {
        for (const book of books) {
            if (book.material_type === 'Book') {
                await db.execute({
                    sql: `UPDATE BOOK_COPY 
                          SET status = 'Donated Outbound', book_condition = 'Outdated' 
                          WHERE copy_id = (
                              SELECT copy_id FROM BOOK_COPY WHERE book_id = ? AND book_condition IN ('Outdated', 'Obsolete') LIMIT 1
                          )`,
                    args: [book.item_id]
                });
                await db.execute({
                    sql: `INSERT INTO DONATION (donation_type, recipient_organization, book_id, book_title, category, quantity, donation_date, status) 
                          VALUES ('Outbound', ?, ?, ?, ?, 1, DATE('now', '+8 hours'), 'Completed')`,
                    args: [recipient_organization, book.item_id, book.book_title, book.category]
                });
            } else {
                await db.execute({
                    sql: `UPDATE PERIODICAL_COPY 
                          SET status = 'Donated Outbound', periodical_condition = 'Outdated' 
                          WHERE p_copy_id = (
                              SELECT p_copy_id FROM PERIODICAL_COPY WHERE periodical_id = ? AND periodical_condition IN ('Outdated', 'Obsolete') LIMIT 1
                          )`,
                    args: [book.item_id]
                });
                await db.execute({
                    sql: `INSERT INTO DONATION (donation_type, recipient_organization, periodical_id, book_title, category, quantity, donation_date, status) 
                          VALUES ('Outbound', ?, ?, ?, ?, 1, DATE('now', '+8 hours'), 'Completed')`,
                    args: [recipient_organization, book.item_id, book.book_title, book.category]
                });
            }
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
            sql: `SELECT 
                    CASE WHEN book_id IS NOT NULL THEN 'Book' ELSE 'Periodical' END as material_type,
                    COALESCE(book_id, periodical_id, 0) as item_id,
                    book_title as title, category, 'Outdated' as condition,
                    recipient_organization, donation_date
                  FROM DONATION
                  WHERE donation_type = 'Outbound'
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
                  WHERE donation_type = 'Inbound' AND status = 'Pending'`
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
        const materialType = data.material_type || 'Book';
        const copiesData = data.copiesData || [];
        
        if (copiesData.length === 0) {
            throw new Error("No physical inventory copies provided.");
        }
        
        let newBookId = null;

        if (materialType === 'Book') {
            // 1. Insert into BOOK (Parent Table)
            const bookResult = await db.execute({
                sql: `INSERT INTO BOOK (
                    isbn, title, author, publisher, publication_year, 
                    volume, edition, dewey_decimal, genre, book_category, image_url, page_count, age_restriction
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING book_id`,
                args: [
                    data.isbn || null, 
                    data.title, 
                    data.author, 
                    data.publisher || null, 
                    data.publication_year || data.year || null, 
                    data.volume || null,
                    data.edition || null,
                    data.dewey_decimal || data.dewey || null, 
                    data.genre || null, 
                    data.book_category || data.category, 
                    data.image_url || data.image || null,
                    data.page_count || 0,
                    data.age_restriction || 0
                ]
            });
            newBookId = bookResult.rows[0].book_id;

            // 2. Create physical copies
            for (const copy of copiesData) {
                const matResult = await db.execute({
                    sql: "INSERT INTO MATERIAL (material_type) VALUES ('Book') RETURNING material_id"
                });
                const materialId = matResult.rows[0].material_id;

                await db.execute({
                    sql: `INSERT INTO BOOK_COPY (
                        book_id, material_id, book_source, book_condition, status, location
                    ) VALUES (?, ?, ?, ?, ?, ?)`,
                    args: [
                        newBookId,
                        materialId,
                        copy.source || 'Purchased',
                        copy.condition || 'New',
                        'Available',
                        copy.location || null
                    ]
                });
            }

        } else if (materialType === 'Periodical') {
            // 1. Insert into PERIODICAL (Parent Table)
            const periodicalResult = await db.execute({
                sql: `INSERT INTO PERIODICAL (
                    issn, title, publisher, type, genre, image_url, page_count, age_restriction
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING periodical_id`,
                args: [
                    data.issn || null,
                    data.title,
                    data.publisher || null,
                    data.type, 
                    data.genre || null,
                    data.image_url || data.image || null,
                    data.page_count || 0,
                    data.age_restriction || 0
                ]
            });
            const newPeriodicalId = periodicalResult.rows[0].periodical_id;

            // 2. Create physical copies
            for (const copy of copiesData) {
                const matResult = await db.execute({
                    sql: "INSERT INTO MATERIAL (material_type) VALUES ('Periodical') RETURNING material_id"
                });
                const materialId = matResult.rows[0].material_id;

                await db.execute({
                    sql: `INSERT INTO PERIODICAL_COPY (
                        periodical_id, material_id, publication_date, issue_no, volume_no,
                        periodical_source, periodical_condition, status, location
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    args: [
                        newPeriodicalId,
                        materialId,
                        data.publication_date || null,
                        data.issue_no,
                        data.volume_no || null,
                        copy.source || 'Purchased',
                        copy.condition || 'New',
                        'Available',
                        copy.location || null
                    ]
                });
            }
        }

        if (data.donation_id && newBookId) {
            await db.execute({
                sql: "UPDATE DONATION SET book_id = ?, status = 'Cataloged' WHERE donation_id = ?",
                args: [newBookId, data.donation_id]
            });
        } else if (data.donation_id && newPeriodicalId) {
            await db.execute({
                sql: "UPDATE DONATION SET periodical_id = ?, status = 'Cataloged' WHERE donation_id = ?",
                args: [newPeriodicalId, data.donation_id]
            });
        }

        if (data.admin_id) {
            await logAdminAction(data.admin_id, 'ADD_MATERIAL', 'MATERIAL', null, `Added new ${materialType}: ${data.title}`);
        }

        res.json({ success: true, message: "Item added successfully." });
    } catch (error) {
        console.error("Add Book Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 8.5 POST /api/books/copies/add (Add physical copies to existing title)
app.post('/api/books/copies/add', async (req, res) => {
    const { item_id, material_type, copies, adminId } = req.body;

    try {
        let parentTitle = 'Unknown Material', parentCategory = 'General';
        if (material_type === 'Book') {
            const pRes = await db.execute({ sql: "SELECT title, book_category FROM BOOK WHERE book_id = ?", args: [item_id] });
            if (pRes.rows.length > 0) { parentTitle = pRes.rows[0].title; parentCategory = pRes.rows[0].book_category; }
        } else {
            const pRes = await db.execute({ sql: "SELECT title, type FROM PERIODICAL WHERE periodical_id = ?", args: [item_id] });
            if (pRes.rows.length > 0) { parentTitle = pRes.rows[0].title; parentCategory = pRes.rows[0].type; }
        }

        // Fetch latest issue/vol for periodicals to inherit automatically
        let issueNo = 'N/A', volNo = null, pubDate = null;
        if (material_type === 'Periodical') {
            const latest = await db.execute({ sql: "SELECT issue_no, volume_no, publication_date FROM PERIODICAL_COPY WHERE periodical_id = ? LIMIT 1", args: [item_id] });
            if (latest.rows.length > 0) {
                issueNo = latest.rows[0].issue_no; volNo = latest.rows[0].volume_no; pubDate = latest.rows[0].publication_date;
            }
        }

        for (const copy of copies) {
            const mRes = await db.execute("INSERT INTO MATERIAL (material_type) VALUES (?) RETURNING material_id", [material_type]);
            const matId = mRes.rows[0].material_id;

            if (material_type === 'Book') {
                await db.execute({
                    sql: "INSERT INTO BOOK_COPY (book_id, material_id, book_source, book_condition, status, location) VALUES (?, ?, ?, ?, 'Available', ?)",
                    args: [item_id, matId, copy.source, copy.condition, copy.location]
                });
            } else {
                await db.execute({
                    sql: "INSERT INTO PERIODICAL_COPY (periodical_id, material_id, publication_date, issue_no, volume_no, periodical_source, periodical_condition, status, location) VALUES (?, ?, ?, ?, ?, ?, ?, 'Available', ?)",
                    args: [item_id, matId, pubDate, issueNo, volNo, copy.source, copy.condition, copy.location]
                });
            }

            if (copy.source === 'Donated') {
                await db.execute({
                    sql: "INSERT INTO DONATION (donation_type, user_id, donor_name, book_id, periodical_id, book_title, category, quantity, status, donation_date) VALUES ('Inbound', ?, ?, ?, ?, ?, ?, 1, 'Cataloged', DATE('now', '+8 hours'))",
                    args: [copy.user_id || null, copy.donor_name || null, material_type === 'Book' ? item_id : null, material_type === 'Periodical' ? item_id : null, parentTitle, parentCategory]
                });
            }
        }

        if (adminId) await logAdminAction(adminId, 'ADD_COPIES', 'MATERIAL', item_id, `Added ${copies.length} new physical copies for ${material_type} ID ${item_id}`);
        res.json({ success: true, message: "Successfully added physical copies to the catalog." });
    } catch (error) {
        console.error("Add Copies Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 8.6 PUT /api/books/copies/update (Update physical copies)
app.put('/api/books/copies/update', async (req, res) => {
    const { material_type, updates, adminId } = req.body; // updates: [{ material_id, condition, location }]

    try {
        const table = material_type === 'Book' ? 'BOOK_COPY' : 'PERIODICAL_COPY';
        const condField = material_type === 'Book' ? 'book_condition' : 'periodical_condition';

        for (const update of updates) {
            await db.execute({
                sql: `UPDATE ${table} SET ${condField} = ?, location = ? WHERE material_id = ?`,
                args: [update.condition, update.location, update.material_id]
            });
        }

        if (adminId) {
            await logAdminAction(adminId, 'UPDATE_COPIES', 'MATERIAL', null, `Updated ${updates.length} physical copies for ${material_type}`);
        }

        res.json({ success: true, message: "Copies updated successfully." });
    } catch (error) {
        console.error("Update Copies Error:", error);
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
            sql: "SELECT COUNT(*) as count FROM DONATION WHERE donation_type = 'Inbound' AND status = 'Pending'"
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

// 9.5 GET /api/books/:id/copies (Fetch Available Physical Copies for User Modal)
app.get('/api/books/:id/copies', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.execute({
            sql: "SELECT material_id, book_condition as condition, location FROM BOOK_COPY WHERE book_id = ? AND status = 'Available' AND book_condition NOT IN ('Outdated', 'Obsolete')",
            args: [id]
        });
        res.json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 10. POST /api/borrow/kiosk
app.post('/api/borrow/kiosk', async (req, res) => {
    const { material_id, user_id, borrow_type } = req.body;
    const bType = borrow_type || 'Outside Library';
    
    try {
        const userCheck = await db.execute({
            sql: "SELECT status FROM USER WHERE user_id = ? UNION ALL SELECT status FROM GUARDIAN_NAME WHERE guardian_id = ?",
            args: [user_id, user_id]
        });
        if (userCheck.rows.length > 0 && userCheck.rows[0].status === 'Suspended') {
            return res.status(403).json({ success: false, message: "Your account is suspended. Please settle your fines." });
        }

        const copyRes = await db.execute({
            sql: "SELECT bc.material_id, b.title, b.book_id FROM BOOK_COPY bc JOIN BOOK b ON bc.book_id = b.book_id WHERE bc.material_id = ? AND bc.status = 'Available'",
            args: [material_id]
        });

        if (copyRes.rows.length === 0) return res.status(400).json({ success: false, message: "This specific copy is no longer available." });
        
        const bookTitle = copyRes.rows[0].title;
        const bookId = copyRes.rows[0].book_id;

        // 2. Create Pending Transaction
        const transRes = await db.execute({
            sql: `INSERT INTO BORROW_TRANSACTION (user_id, book_id, material_id, borrow_date, borrow_time, status, borrow_type) 
                  VALUES (?, ?, ?, DATE('now', '+8 hours'), TIME('now', '+8 hours'), 'Pending', ?) RETURNING borrow_id`,
            args: [user_id, bookId, material_id, bType]
        });

        const borrowId = transRes.rows[0].borrow_id;

        // 3. Update Book Inventory
        await db.execute({ sql: "UPDATE BOOK_COPY SET status = 'Borrowed' WHERE material_id = ?", args: [material_id] });

        await logUserAction(user_id, 'BORROW_HOLD', 'BORROW_TRANSACTION', borrowId, `User placed 30-min hold on '${bookTitle}' (Material ID: ${material_id})`);

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
        const transRes = await db.execute({
            sql: `SELECT bt.user_id, bt.material_id, m.material_type FROM BORROW_TRANSACTION bt JOIN MATERIAL m ON bt.material_id = m.material_id WHERE bt.borrow_id = ? AND bt.status = 'Pending'`,
            args: [borrow_id]
        });
        
        if (transRes.rows.length === 0) {
            return res.status(400).json({ success: false, message: "Transaction not found or not pending." });
        }
        const { user_id, material_id, material_type } = transRes.rows[0];

        // Update Transaction to Cancelled
        await db.execute({
            sql: "UPDATE BORROW_TRANSACTION SET status = 'Cancelled' WHERE borrow_id = ?",
            args: [borrow_id]
        });

        // Update Book Inventory (Make available again)
        let title = "Material";
        if (material_type === 'Book') {
            await db.execute({ sql: "UPDATE BOOK_COPY SET status = 'Available' WHERE material_id = ?", args: [material_id] });
            const titleRes = await db.execute({ sql: "SELECT b.title FROM BOOK b JOIN BOOK_COPY c ON b.book_id = c.book_id WHERE c.material_id = ?", args: [material_id] });
            title = titleRes.rows[0]?.title || title;
        } else {
            await db.execute({ sql: "UPDATE PERIODICAL_COPY SET status = 'Available' WHERE material_id = ?", args: [material_id] });
            const titleRes = await db.execute({ sql: "SELECT p.title FROM PERIODICAL p JOIN PERIODICAL_COPY c ON p.periodical_id = c.periodical_id WHERE c.material_id = ?", args: [material_id] });
            title = titleRes.rows[0]?.title || title;
        }

        await logUserAction(user_id, 'CANCEL_HOLD', 'BORROW_TRANSACTION', borrow_id, `User cancelled hold for '${title}'`);

        res.json({ success: true, message: "Hold cancelled successfully." });
    } catch (error) {
        console.error("Cancel Hold Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 10.6 POST /api/borrow/extend
app.post('/api/borrow/extend', async (req, res) => {
    const { borrow_id } = req.body;
    try {
        const resTx = await db.execute({
            sql: "SELECT due_date, extension_count, user_id FROM BORROW_TRANSACTION WHERE borrow_id = ?",
            args: [borrow_id]
        });

        if (resTx.rows.length === 0) return res.status(404).json({ success: false, message: "Transaction not found." });

        const tx = resTx.rows[0];
        const currentCount = tx.extension_count || 0;
        
        const userCheck = await db.execute({
            sql: "SELECT status FROM USER WHERE user_id = ?",
            args: [tx.user_id]
        });
        if (userCheck.rows.length > 0 && userCheck.rows[0].status === 'Suspended') {
            return res.status(403).json({ success: false, message: "Your account is suspended. You cannot extend loans." });
        }

        if (currentCount >= 2) return res.status(400).json({ success: false, message: "Maximum extension limit (2) reached." });

        const daysToAdd = currentCount === 0 ? 4 : 2;

        await db.execute({
            sql: `UPDATE BORROW_TRANSACTION SET due_date = DATE(due_date, '+${daysToAdd} days'), extension_count = extension_count + 1 WHERE borrow_id = ?`,
            args: [borrow_id]
        });

        await logUserAction(tx.user_id, 'EXTEND_LOAN', 'BORROW_TRANSACTION', borrow_id, `Extended loan by ${daysToAdd} days (Extension #${currentCount + 1})`);
        res.json({ success: true, message: `Loan extended by ${daysToAdd} days.` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// 11. POST /api/waitlist
app.post('/api/waitlist', async (req, res) => {
    const { book_id, material_type, user_id } = req.body;

    try {
        const userCheck = await db.execute({
            sql: "SELECT status FROM USER WHERE user_id = ? UNION ALL SELECT status FROM GUARDIAN_NAME WHERE guardian_id = ?",
            args: [user_id, user_id]
        });
        if (userCheck.rows.length > 0 && userCheck.rows[0].status === 'Suspended') {
            return res.status(403).json({ success: false, message: "Your account is suspended. Please settle your fines." });
        }

        let matRes;
        let bookTitle;
        if (material_type === 'Book') {
            matRes = await db.execute({ sql: "SELECT material_id FROM BOOK_COPY WHERE book_id = ? LIMIT 1", args: [book_id] });
            const titleRes = await db.execute({ sql: "SELECT title FROM BOOK WHERE book_id = ?", args: [book_id] });
            bookTitle = titleRes.rows[0]?.title || 'Book';
        } else {
            matRes = await db.execute({ sql: "SELECT material_id FROM PERIODICAL_COPY WHERE periodical_id = ? LIMIT 1", args: [book_id] });
            const titleRes = await db.execute({ sql: "SELECT title FROM PERIODICAL WHERE periodical_id = ?", args: [book_id] });
            bookTitle = titleRes.rows[0]?.title || 'Periodical';
        }

        if (matRes.rows.length === 0) return res.status(404).json({ success: false, message: "Material not found." });
        const targetMaterialId = matRes.rows[0].material_id;

        // Determine Priority Logic
        const prioRes = await db.execute({
            sql: "SELECT MAX(priority_no) as max_p FROM RESERVATION WHERE material_id = ? AND status IN ('Pending', 'Approved')",
            args: [targetMaterialId]
        });
        const nextPriority = (prioRes.rows[0]?.max_p || 0) + 1;

        // 2. Insert Reservation
        const resResult = await db.execute({
            sql: "INSERT INTO RESERVATION (user_id, material_id, status, priority_no) VALUES (?, ?, 'Pending', ?) RETURNING reservation_id",
            args: [user_id, targetMaterialId, nextPriority]
        });

        await logUserAction(user_id, 'JOIN_WAITLIST', 'RESERVATION', resResult.rows[0].reservation_id, `User joined waitlist for '${bookTitle}'`);

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
        let sql = `
            SELECT b.book_id as item_id, 'Book' as material_type, b.title, b.author, b.isbn, b.publisher, b.publication_year as year, b.volume, b.edition, b.genre, b.dewey_decimal, b.book_category as category, b.image_url, b.page_count, b.age_restriction, MIN(m.date_added) as date_added,
                   SUM(CASE WHEN c.status = 'Available' THEN 1 ELSE 0 END) as available_copies,
                   COUNT(c.copy_id) as total_copies
            FROM BOOK b
            JOIN BOOK_COPY c ON b.book_id = c.book_id
            JOIN MATERIAL m ON c.material_id = m.material_id
            WHERE c.book_condition NOT IN ('Outdated', 'Obsolete') 
            AND c.status NOT IN ('Archived', 'Donated Outbound', 'Lost')
            GROUP BY b.book_id
            UNION ALL
            SELECT p.periodical_id as item_id, 'Periodical' as material_type, p.title, p.publisher as author, p.issn as isbn, p.publisher, NULL as year, MAX(c.volume_no) as volume, MAX(c.issue_no) as edition, p.genre, NULL as dewey_decimal, p.type as category, p.image_url, p.page_count, p.age_restriction, MIN(m.date_added) as date_added,
                   SUM(CASE WHEN c.status = 'Available' THEN 1 ELSE 0 END) as available_copies,
                   COUNT(c.p_copy_id) as total_copies
            FROM PERIODICAL p
            JOIN PERIODICAL_COPY c ON p.periodical_id = c.periodical_id
            JOIN MATERIAL m ON c.material_id = m.material_id
            WHERE c.periodical_condition NOT IN ('Outdated', 'Obsolete') 
            AND c.status NOT IN ('Archived', 'Donated Outbound', 'Lost')
            GROUP BY p.periodical_id
        `;
        let args = [];

        if (userId) {
            let uCond = "bt.user_id = ?";
            let rCond = "r.user_id = ?";
            if (req.query.role === 'guardian') {
                uCond = "bt.user_id IN (SELECT user_id FROM USER WHERE guardian_id = ?)";
                rCond = "r.user_id IN (SELECT user_id FROM USER WHERE guardian_id = ?)";
            }
            sql = `
                SELECT b.book_id as item_id, 'Book' as material_type, b.title, b.author, b.isbn, b.publisher, b.publication_year as year, b.volume, b.edition, b.genre, b.dewey_decimal, b.book_category as category, b.image_url, b.page_count, b.age_restriction, MIN(m.date_added) as date_added,
                SUM(CASE WHEN c.status = 'Available' THEN 1 ELSE 0 END) as available_copies,
                COUNT(c.copy_id) as total_copies,
                (SELECT COUNT(*) FROM BORROW_TRANSACTION bt 
                 JOIN BOOK_COPY bc_bt ON bt.material_id = bc_bt.material_id
                 WHERE bc_bt.book_id = b.book_id 
                 AND ${uCond} 
                 AND bt.status IN ('Pending', 'Borrowed')) as user_already_has_it,
                (SELECT bt.status FROM BORROW_TRANSACTION bt 
                 JOIN BOOK_COPY bc_bt ON bt.material_id = bc_bt.material_id
                 WHERE bc_bt.book_id = b.book_id 
                 AND ${uCond} 
                 AND bt.status IN ('Pending', 'Borrowed') LIMIT 1) as user_transaction_status,
                (SELECT COUNT(*) FROM RESERVATION r 
                 JOIN BOOK_COPY bc_r ON r.material_id = bc_r.material_id
                 WHERE bc_r.book_id = b.book_id 
                 AND ${rCond} 
                 AND r.status = 'Pending') as user_is_waitlisted
                FROM BOOK b
                JOIN BOOK_COPY c ON b.book_id = c.book_id
                JOIN MATERIAL m ON c.material_id = m.material_id
                WHERE c.book_condition NOT IN ('Outdated', 'Obsolete') 
                AND c.status NOT IN ('Archived', 'Donated Outbound', 'Lost')
                GROUP BY b.book_id
                UNION ALL
                SELECT p.periodical_id as item_id, 'Periodical' as material_type, p.title, p.publisher as author, p.issn as isbn, p.publisher, NULL as year, MAX(c.volume_no) as volume, MAX(c.issue_no) as edition, p.genre, NULL as dewey_decimal, p.type as category, p.image_url, p.page_count, p.age_restriction, MIN(m.date_added) as date_added,
                SUM(CASE WHEN c.status = 'Available' THEN 1 ELSE 0 END) as available_copies,
                COUNT(c.p_copy_id) as total_copies,
                (SELECT COUNT(*) FROM BORROW_TRANSACTION bt 
                 JOIN PERIODICAL_COPY pc_bt ON bt.material_id = pc_bt.material_id
                 WHERE pc_bt.periodical_id = p.periodical_id 
                 AND ${uCond} 
                 AND bt.status IN ('Pending', 'Borrowed')) as user_already_has_it,
                (SELECT bt.status FROM BORROW_TRANSACTION bt 
                 JOIN PERIODICAL_COPY pc_bt ON bt.material_id = pc_bt.material_id
                 WHERE pc_bt.periodical_id = p.periodical_id 
                 AND ${uCond} 
                 AND bt.status IN ('Pending', 'Borrowed') LIMIT 1) as user_transaction_status,
                (SELECT COUNT(*) FROM RESERVATION r 
                 JOIN PERIODICAL_COPY pc_r ON r.material_id = pc_r.material_id
                 WHERE pc_r.periodical_id = p.periodical_id 
                 AND ${rCond} 
                 AND r.status = 'Pending') as user_is_waitlisted
                FROM PERIODICAL p
                JOIN PERIODICAL_COPY c ON p.periodical_id = c.periodical_id
                JOIN MATERIAL m ON c.material_id = m.material_id
                WHERE c.periodical_condition NOT IN ('Outdated', 'Obsolete') 
                AND c.status NOT IN ('Archived', 'Donated Outbound', 'Lost')
                GROUP BY p.periodical_id
            `;
            args = [userId, userId, userId, userId, userId, userId];
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
        // Automatic Suspension Logic: Run before fetching fines
        // Find users with Unpaid fines who are not yet Suspended/Banned
        const candidates = await db.execute(`
            SELECT DISTINCT u.user_id, COALESCE(u.email, g.email) as email, u.first_name 
            FROM FINE f 
            JOIN BORROW_TRANSACTION b ON f.borrow_id = b.borrow_id 
            JOIN USER u ON b.user_id = u.user_id 
            LEFT JOIN GUARDIAN_NAME g ON u.guardian_id = g.guardian_id
            WHERE f.status = 'Unpaid' AND u.status NOT IN ('Suspended', 'Banned')
        `);

        if (candidates.rows.length > 0) {
            const ids = candidates.rows.map(r => r.user_id);
            const placeholders = ids.map(() => '?').join(',');

            // 1. Update Status to Suspended
            await db.execute({
                sql: `UPDATE USER SET status = 'Suspended' WHERE user_id IN (${placeholders})`,
                args: ids
            });

            // 2. Insert Ban Records
            for (const row of candidates.rows) {
                await db.execute({
                    sql: "INSERT INTO BAN_TERMINATION (user_id, reason, ban_date, end_date) VALUES (?, 'Automatic Suspension: Unpaid Fines', DATE('now', '+8 hours'), NULL)",
                    args: [row.user_id]
                });
                if (row.email) {
                    sendAccountStatusEmail(row.email, row.first_name, 'Suspended', 'Automatic Suspension: Unpaid Fines. Please settle your balance to reactivate your account.').catch(e => console.error("Auto Suspend Email Error:", e));
                }
            }
        }

        // Automatic Ban Logic: Find users with materials borrowed > 3 months ago
        const banCandidates = await db.execute(`
            SELECT DISTINCT u.user_id, COALESCE(u.email, g.email) as email, u.first_name 
            FROM BORROW_TRANSACTION b 
            JOIN USER u ON b.user_id = u.user_id 
            LEFT JOIN GUARDIAN_NAME g ON u.guardian_id = g.guardian_id
            WHERE b.status IN ('Borrowed', 'Overdue') 
              AND b.borrow_date <= date('now', '+8 hours', '-3 months')
              AND u.status != 'Banned'
        `);

        if (banCandidates.rows.length > 0) {
            const banIds = banCandidates.rows.map(r => r.user_id);
            const banPlaceholders = banIds.map(() => '?').join(',');

            await db.execute({
                sql: `UPDATE USER SET status = 'Banned' WHERE user_id IN (${banPlaceholders})`,
                args: banIds
            });

            for (const row of banCandidates.rows) {
                await db.execute({
                    sql: "INSERT INTO BAN_TERMINATION (user_id, reason, ban_date, end_date) VALUES (?, 'Automatic Ban: Material unreturned for over 3 months', DATE('now', '+8 hours'), NULL)",
                    args: [row.user_id]
                });
                if (row.email) {
                    sendAccountStatusEmail(row.email, row.first_name, 'Banned', 'Automatic Ban: Material unreturned for over 3 months.').catch(e => console.error("Auto Ban Email Error:", e));
                }
            }
        }

        // Automatic Suspension Logic: Unreturned "Inside Library" materials past closing time
        const insideCandidates = await db.execute(`
            SELECT DISTINCT u.user_id, COALESCE(u.email, g.email) as email, u.first_name 
            FROM BORROW_TRANSACTION b 
            JOIN USER u ON b.user_id = u.user_id 
            LEFT JOIN GUARDIAN_NAME g ON u.guardian_id = g.guardian_id
            WHERE b.status IN ('Borrowed', 'Overdue') 
              AND b.borrow_type = 'Inside Library'
              AND u.status NOT IN ('Suspended', 'Banned')
              AND (
                  b.due_date < date('now', '+8 hours')
                  OR (
                      b.due_date = date('now', '+8 hours') AND 
                      time('now', '+8 hours') >= CASE 
                          WHEN strftime('%w', b.due_date) = '6' THEN '16:00:00'
                          ELSE '18:00:00'
                      END
                  )
              )
        `);

        if (insideCandidates.rows.length > 0) {
            const insideIds = insideCandidates.rows.map(r => r.user_id);
            const insidePlaceholders = insideIds.map(() => '?').join(',');

            await db.execute({
                sql: `UPDATE USER SET status = 'Suspended' WHERE user_id IN (${insidePlaceholders})`,
                args: insideIds
            });

            for (const row of insideCandidates.rows) {
                await db.execute({
                    sql: "INSERT INTO BAN_TERMINATION (user_id, reason, ban_date, end_date) VALUES (?, 'Automatic Suspension: Unreturned Library Use Only Material', DATE('now', '+8 hours'), NULL)",
                    args: [row.user_id]
                });
                if (row.email) {
                    sendAccountStatusEmail(row.email, row.first_name, 'Suspended', 'Automatic Suspension: Unreturned "Inside Library" material past closing time. Please return the material immediately to the front desk.').catch(e => console.error("Auto Suspend Email Error:", e));
                }
            }
        }

        // Automatic Due Soon Reminders (<= 3 days)
        const reminderCandidates = await db.execute(`
            SELECT b.borrow_id, COALESCE(u.email, g.email) as email, u.first_name, bk.title as book_title, b.due_date 
            FROM BORROW_TRANSACTION b 
            JOIN USER u ON b.user_id = u.user_id 
            LEFT JOIN GUARDIAN_NAME g ON u.guardian_id = g.guardian_id
            JOIN BOOK_COPY bc ON b.material_id = bc.material_id
            JOIN BOOK bk ON bc.book_id = bk.book_id
            WHERE b.status = 'Borrowed' 
              AND b.due_date <= date('now', '+8 hours', '+3 days')
              AND b.due_date >= date('now', '+8 hours')
              AND b.reminder_sent = 0
              AND b.borrow_type != 'Inside Library'
            UNION ALL
            SELECT b.borrow_id, COALESCE(u.email, g.email) as email, u.first_name, p.title as book_title, b.due_date 
            FROM BORROW_TRANSACTION b 
            JOIN USER u ON b.user_id = u.user_id 
            LEFT JOIN GUARDIAN_NAME g ON u.guardian_id = g.guardian_id
            JOIN PERIODICAL_COPY pc ON b.material_id = pc.material_id
            JOIN PERIODICAL p ON pc.periodical_id = p.periodical_id
            WHERE b.status = 'Borrowed' 
              AND b.due_date <= date('now', '+8 hours', '+3 days')
              AND b.due_date >= date('now', '+8 hours')
              AND b.reminder_sent = 0
              AND b.borrow_type != 'Inside Library'
        `);

        if (reminderCandidates.rows.length > 0) {
            const remIds = reminderCandidates.rows.map(r => r.borrow_id);
            const remPlaceholders = remIds.map(() => '?').join(',');

            await db.execute({
                sql: `UPDATE BORROW_TRANSACTION SET reminder_sent = 1 WHERE borrow_id IN (${remPlaceholders})`,
                args: remIds
            });

            for (const row of reminderCandidates.rows) {
                if (row.email) {
                    const dueDateStr = new Date(row.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    sendDueSoonEmail(row.email, row.first_name, row.book_title, dueDateStr).catch(e => console.error("Due Soon Email Error:", e));
                }
            }
        }

        const result = await db.execute({
            sql: `
                SELECT 
                    f.fine_id,
                    f.fine_amount as amount,
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
                LEFT JOIN BOOK_COPY bc ON b.material_id = bc.material_id
                LEFT JOIN BOOK bk ON bc.book_id = bk.book_id
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
                sql: `INSERT INTO PAYMENT (fine_id, fine_amount, payment_date, payment_method, or_number, remarks) 
                      VALUES (?, ?, DATE('now', '+8 hours'), ?, ?, ?)`,
                args: [fine_id, amount, payment_method || 'Cash', reference_number || null, remarks || null]
            });
        }

        // 4. Check if user is fully paid (Reactivation Logic)
        if (borrowId) {
            const userRes = await db.execute({
                sql: "SELECT user_id FROM BORROW_TRANSACTION WHERE borrow_id = ?",
                args: [borrowId]
            });

            if (userRes.rows.length > 0) {
                const userId = userRes.rows[0].user_id;
                
                // Check remaining unpaid fines
                const countRes = await db.execute({
                    sql: `SELECT COUNT(*) as count FROM FINE f 
                          JOIN BORROW_TRANSACTION b ON f.borrow_id = b.borrow_id 
                          WHERE b.user_id = ? AND f.status = 'Unpaid'`,
                    args: [userId]
                });

                if (countRes.rows[0].count === 0) {
                    // Reactivate User if currently Suspended
                    await db.execute({
                        sql: "UPDATE USER SET status = 'Active' WHERE user_id = ? AND status = 'Suspended'",
                        args: [userId]
                    });
                    // Close Ban Record
                    await db.execute({
                        sql: "UPDATE BAN_TERMINATION SET end_date = DATE('now', '+8 hours') WHERE user_id = ? AND end_date IS NULL",
                        args: [userId]
                    });
                }
            }
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
        const unpaidRes = await db.execute("SELECT SUM(fine_amount) as total FROM FINE WHERE status = 'Unpaid'");
        
        // Unpaid Users Count
        const usersRes = await db.execute("SELECT COUNT(DISTINCT b.user_id) as count FROM FINE f JOIN BORROW_TRANSACTION b ON f.borrow_id = b.borrow_id WHERE f.status = 'Unpaid'");
        
        // Collected Today
        const collectedRes = await db.execute("SELECT SUM(fine_amount) as total, COUNT(*) as count FROM PAYMENT WHERE payment_date = DATE('now', '+8 hours')");
        
        // Recent Payments
        const recentRes = await db.execute(`
            SELECT p.fine_amount, u.first_name, u.last_name 
            FROM PAYMENT p 
            JOIN FINE f ON p.fine_id = f.fine_id
            JOIN BORROW_TRANSACTION b ON f.borrow_id = b.borrow_id 
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
                    f.fine_amount as amount,
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
                LEFT JOIN BOOK_COPY bc ON b.material_id = bc.material_id
                LEFT JOIN BOOK bk ON bc.book_id = bk.book_id
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
    const { role } = req.query;
    try {
        let sql = "SELECT user_id, first_name, last_name, email, contact_number, address, status FROM USER WHERE user_id = ?";
        if (role === 'guardian') {
            sql = "SELECT guardian_id as user_id, first_name, last_name, email, contact_number, address, status FROM GUARDIAN_NAME WHERE guardian_id = ?";
        }
        const result = await db.execute({ sql, args: [id] });

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
    const { first_name, last_name, email, contact_number, address, role } = req.body;

    try {
        const table = role === 'guardian' ? 'GUARDIAN_NAME' : 'USER';
        const idField = role === 'guardian' ? 'guardian_id' : 'user_id';
        await db.execute({
            sql: `UPDATE ${table} SET first_name = ?, last_name = ?, email = ?, contact_number = ?, address = ? WHERE ${idField} = ?`,
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
    const { newPassword, role } = req.body;

    try {
        const table = role === 'guardian' ? 'GUARDIAN_NAME' : 'USER';
        const idField = role === 'guardian' ? 'guardian_id' : 'user_id';
        await db.execute({
            sql: `UPDATE ${table} SET password = ? WHERE ${idField} = ?`,
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
                SELECT b.book_id as item_id, 'Book' as material_type, b.title, b.author, b.image_url, b.age_restriction, COUNT(bt.borrow_id) as borrow_count
                FROM BOOK b
                JOIN BOOK_COPY c ON b.book_id = c.book_id
                LEFT JOIN BORROW_TRANSACTION bt ON c.material_id = bt.material_id
                WHERE c.book_condition NOT IN ('Outdated', 'Obsolete') 
                AND c.status NOT IN ('Archived', 'Donated Outbound', 'Lost')
                GROUP BY b.book_id
                UNION ALL
                SELECT p.periodical_id as item_id, 'Periodical' as material_type, p.title, p.publisher as author, p.image_url, p.age_restriction, COUNT(bt.borrow_id) as borrow_count
                FROM PERIODICAL p
                JOIN PERIODICAL_COPY c ON p.periodical_id = c.periodical_id
                LEFT JOIN BORROW_TRANSACTION bt ON c.material_id = bt.material_id
                WHERE c.periodical_condition NOT IN ('Outdated', 'Obsolete') 
                AND c.status NOT IN ('Archived', 'Donated Outbound', 'Lost')
                GROUP BY p.periodical_id
                ORDER BY borrow_count DESC, title ASC
                LIMIT 4
            `;
        } else {
            // Default to latest
            sql = `SELECT b.book_id as item_id, 'Book' as material_type, b.title, b.author, b.image_url, b.age_restriction, MIN(m.date_added) as date_added 
                   FROM BOOK b
                   JOIN BOOK_COPY c ON b.book_id = c.book_id
                   JOIN MATERIAL m ON c.material_id = m.material_id
                   WHERE c.book_condition NOT IN ('Outdated', 'Obsolete') 
                   AND c.status NOT IN ('Archived', 'Donated Outbound', 'Lost')
                   GROUP BY b.book_id
                   UNION ALL
                   SELECT p.periodical_id as item_id, 'Periodical' as material_type, p.title, p.publisher as author, p.image_url, p.age_restriction, MIN(m.date_added) as date_added 
                   FROM PERIODICAL p
                   JOIN PERIODICAL_COPY c ON p.periodical_id = c.periodical_id
                   JOIN MATERIAL m ON c.material_id = m.material_id
                   WHERE c.periodical_condition NOT IN ('Outdated', 'Obsolete') 
                   AND c.status NOT IN ('Archived', 'Donated Outbound', 'Lost')
                   GROUP BY p.periodical_id
                   ORDER BY date_added DESC, item_id DESC LIMIT 4`;
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
        const currentYearStr = "CAST(strftime('%Y', 'now', '+8 hours') AS INTEGER)";

        // Helper to format IN clause and escape single quotes
        const formatIn = (arr) => '(' + arr.map(g => `'${g.replace(/'/g, "''")}'`).join(', ') + ')';

        // --- 0. RESET PREVIOUS WEEDING TAGS ---
        // Clear out old tags so books are freshly re-evaluated against the current rules
        await db.execute(`
            UPDATE BOOK_COPY 
            SET book_condition = 'New' 
            WHERE book_condition IN ('Outdated', 'Obsolete') AND status = 'Available'
        `);
        await db.execute(`
            UPDATE PERIODICAL_COPY 
            SET periodical_condition = 'New' 
            WHERE periodical_condition IN ('Outdated', 'Obsolete') AND status = 'Available'
        `);

        // --- 1. MARK OBSOLETE BOOKS ---
        const obsoleteRules = [
            { years: 2, genres: ['Almanac'] },
            { years: 8, genres: ['Computer Science & Technology', 'Computer Science'] },
            { years: 10, genres: ['Medicine & Health', 'Medicine', 'Law & Politics', 'Law', 'Travel & Tourism', 'Business & Economics', 'Accounting & Business', 'Atlas & Maps', 'Geography'] },
            { years: 12, genres: ['Engineering', 'Environmental Science'] },
            { years: 15, genres: ['Education & Teaching', 'Astronomy & Space', 'Biology & Life Sciences', 'Chemistry & Physics', 'Self-Help & Motivation', 'Self-Help', 'Encyclopedia'] },
            { years: 20, genres: ['Sports & Recreation', 'Thesis / Dissertation'] },
            { years: 25, genres: ['Mathematics', 'Cookery & Gastronomy', 'Dictionary', 'Thesaurus'] },
            { years: 30, genres: ['History & Geography', 'History'] },
            { years: 40, genres: ['Philosophy & Psychology', 'Philosophy'] }
        ];

        for (const rule of obsoleteRules) {
            await db.execute(`
                UPDATE BOOK_COPY 
                SET book_condition = 'Obsolete'
                WHERE status = 'Available' AND book_condition NOT IN ('Moderate Damage', 'Severe Damage') AND book_id IN (
                    SELECT book_id FROM BOOK 
                    WHERE genre IN ${formatIn(rule.genres)}
                    AND (${currentYearStr} - publication_year) >= ${rule.years}
                )
            `);
        }

        // --- 2. MARK OUTDATED BOOKS ---
        const outdatedRules = [
            { years: 1, genres: ['Almanac'] },
            { years: 3, genres: ['Computer Science & Technology', 'Computer Science'] },
            { years: 5, genres: ['Medicine & Health', 'Medicine', 'Law & Politics', 'Law', 'Travel & Tourism', 'Business & Economics', 'Accounting & Business', 'Atlas & Maps', 'Geography'] },
            { years: 7, genres: ['Engineering', 'Environmental Science'] },
            { years: 8, genres: ['Education & Teaching'] },
            { years: 10, genres: ['Astronomy & Space', 'Biology & Life Sciences', 'Chemistry & Physics', 'Sports & Recreation', 'Self-Help & Motivation', 'Self-Help', 'Thesis / Dissertation', 'Encyclopedia'] },
            { years: 15, genres: ['Mathematics', 'Cookery & Gastronomy', 'History & Geography', 'History', 'True Crime', 'Dictionary', 'Thesaurus'] },
            { years: 20, genres: ['Philosophy & Psychology', 'Philosophy', 'Religion & Theology', 'Biography & Autobiography', 'Biography', 'Arts & Music', 'Filipiniana'] }
        ];

        for (const rule of outdatedRules) {
            await db.execute(`
                UPDATE BOOK_COPY 
                SET book_condition = 'Outdated'
                WHERE status = 'Available' AND book_condition NOT IN ('Obsolete', 'Outdated', 'Moderate Damage', 'Severe Damage') AND book_id IN (
                    SELECT book_id FROM BOOK 
                    WHERE genre IN ${formatIn(rule.genres)}
                    AND (${currentYearStr} - publication_year) >= ${rule.years}
                )
            `);
        }

        // --- 3. PERIODICALS ---
        // Obsolete (2 Years)
        await db.execute(`
            UPDATE PERIODICAL_COPY 
            SET periodical_condition = 'Obsolete' 
            WHERE status = 'Available' 
            AND periodical_condition != 'Obsolete'
            AND publication_date <= DATE('now', '+8 hours', '-2 years')
        `);

        // Outdated (6 Months)
        await db.execute(`
            UPDATE PERIODICAL_COPY 
            SET periodical_condition = 'Outdated' 
            WHERE status = 'Available' 
            AND periodical_condition NOT IN ('Obsolete', 'Outdated')
            AND publication_date <= DATE('now', '+8 hours', '-6 months')
        `);

        res.json({ success: true, message: "Weeding scan completed. Items tagged as Outdated/Obsolete based on updated criteria." });
    } catch (error) {
        console.error("Weeding Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 22. POST /api/admin/weeding/archive-all (Bulk Archive)
app.post('/api/admin/weeding/archive-all', async (req, res) => {
    try {
        await db.execute(`
            UPDATE BOOK_COPY SET status = 'Archived' 
            WHERE book_condition IN ('Outdated', 'Obsolete') AND status = 'Available'
        `);
        await db.execute(`
            UPDATE PERIODICAL_COPY SET status = 'Archived' 
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
            queries.push(`SELECT 'Admin' as role, COALESCE(a.full_name, 'Unknown Admin') as actor_name, l.action, l.details, DATETIME(l.date_time, '+8 hours') as date_time FROM ADMIN_AUDIT_LOG l LEFT JOIN ADMIN a ON l.admin_id = a.admin_id`);
        }
        if (filter === 'all' || filter === 'user') {
            queries.push(`SELECT 'User' as role, COALESCE(u.first_name || ' ' || u.last_name, 'Unknown User') as actor_name, l.action, l.details, DATETIME(l.date_time, '+8 hours') as date_time FROM USER_AUDIT_LOG l LEFT JOIN USER u ON l.user_id = u.user_id`);
        }
        if (filter === 'all' || filter === 'guardian') {
            queries.push(`SELECT 'Guardian' as role, COALESCE(g.first_name || ' ' || g.last_name, 'Unknown Guardian') as actor_name, l.action, l.details, DATETIME(l.date_time, '+8 hours') as date_time FROM GUARDIAN_AUDIT_LOG l LEFT JOIN GUARDIAN_NAME g ON l.guardian_id = g.guardian_id`);
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

// 45. GET /api/admin/users (Fetch Users with Suspension Info)
app.get('/api/admin/users', async (req, res) => {
    try {
        const result = await db.execute(`
            SELECT u.user_id, u.first_name, u.last_name, u.email, u.contact_number, u.status, u.date_created, u.email_verified, u.address, u.birth_date,
                   'User' as account_type,
                   b.reason as ban_reason, b.end_date as ban_end_date
            FROM USER u
            LEFT JOIN BAN_TERMINATION b ON u.user_id = b.user_id AND b.ban_id = (SELECT MAX(ban_id) FROM BAN_TERMINATION WHERE user_id = u.user_id)
            WHERE u.guardian_id IS NULL AND (u.email_verified = 1 OR u.email IS NULL OR u.email = '' OR u.status != 'Pending')
            
            UNION ALL
            
            SELECT g.guardian_id as user_id, g.first_name, g.last_name, g.email, g.contact_number, g.status, g.date_created, g.email_verified, g.address, g.birth_date,
                   'Guardian' as account_type,
                   NULL as ban_reason, NULL as ban_end_date
            FROM GUARDIAN_NAME g
            WHERE (g.email_verified = 1 OR g.email IS NULL OR g.email = '' OR g.status != 'Pending')
            ORDER BY date_created DESC
        `);
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error("Fetch Users Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Endpoint to get Guardian's linked children
app.get('/api/admin/guardian/:id/children', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.execute({
            sql: "SELECT first_name, last_name, middle_initial, birth_date, relationship FROM USER WHERE guardian_id = ?",
            args: [id]
        });
        res.json({ success: true, data: result.rows });
    } catch (error) {
        console.error("Fetch Users Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// 46. POST /api/admin/users/suspend (Suspend User)
app.post('/api/admin/users/suspend', async (req, res) => {
    const { userId, reason, duration, adminId } = req.body;
    
    try {
        // 1. Update User Status
        await db.execute({
            sql: "UPDATE USER SET status = 'Suspended' WHERE user_id = ?",
            args: [userId]
        });

        // 2. Insert Ban Record
        // If duration is provided, calculate end_date. If not (financial), leave NULL (Indefinite).
        const endDateExpr = duration ? `DATE('now', '+${duration} days')` : "NULL";
        
        await db.execute({
            sql: `INSERT INTO BAN_TERMINATION (user_id, reason, ban_date, end_date) VALUES (?, ?, DATE('now', '+8 hours'), ${endDateExpr})`,
            args: [userId, reason]
        });

        await logAdminAction(adminId, 'SUSPEND_USER', 'USER', userId, `Suspended user. Reason: ${reason}`);
        res.json({ success: true, message: "User suspended successfully." });
    } catch (error) {
        console.error("Suspend User Error:", error);
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
    const { userId, accountType, status, reason, adminId } = req.body;
    try {
        const table = accountType === 'Guardian' ? 'GUARDIAN_NAME' : 'USER';
        const idField = accountType === 'Guardian' ? 'guardian_id' : 'user_id';

        const userRes = await db.execute({
            sql: `SELECT * FROM ${table} WHERE ${idField} = ?`,
            args: [userId]
        });
        
        if (userRes.rows.length === 0) return res.status(404).json({ success: false, message: "User not found." });
        const user = userRes.rows[0];
        
        await db.execute({
            sql: `UPDATE ${table} SET status = ?, status_note = ? WHERE ${idField} = ?`,
            args: [status, status === 'Rejected' ? reason : null, userId]
        });

        if (accountType === 'Guardian') {
            await db.execute({
                sql: "UPDATE USER SET status = ?, status_note = ? WHERE guardian_id = ?",
                args: [status, status === 'Rejected' ? reason : null, userId]
            });
        }

        if (user.email) {
            if (status === 'Active') {
                await sendLibraryCard(user.email, `${accountType.charAt(0)}-${userId}`, user.first_name);
            } else if (status === 'Rejected') {
                await sendAccountStatusEmail(user.email, user.first_name, status, reason);
            }
        }

        if (adminId) {
            await logAdminAction(adminId, 'UPDATE_USER_STATUS', table, userId, `Status updated to ${status}`);
        }

        res.json({ success: true, message: `Account status updated to ${status}.` });
    } catch (e) {
        console.error("Update Status Error:", e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// 37. POST /api/user/:id/resend-qr
app.post('/api/user/:id/resend-qr', async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;
    try {
        const table = role === 'guardian' ? 'GUARDIAN_NAME' : 'USER';
        const idField = role === 'guardian' ? 'guardian_id' : 'user_id';
        const userRes = await db.execute({
            sql: `SELECT email, first_name FROM ${table} WHERE ${idField} = ?`,
            args: [id]
        });

        if (userRes.rows.length === 0) return res.status(404).json({ success: false, message: "User not found." });
        
        const user = userRes.rows[0];
        const prefix = role === 'guardian' ? 'G' : 'U';
        const sent = await sendLibraryCard(user.email, `${prefix}-${id}`, user.first_name);

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
    const { role } = req.query;
    try {
        let uCond = "user_id = ?";
        if (role === 'guardian') uCond = "user_id IN (SELECT user_id FROM USER WHERE guardian_id = ?)";
        const result = await db.execute({
            sql: `SELECT book_title, category, quantity, donation_date, status 
                  FROM DONATION 
                  WHERE ${uCond} AND donation_type = 'Inbound'
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
        const lostRes = await db.execute("SELECT COUNT(*) as count FROM BOOK_COPY WHERE status = 'Lost'");

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
            const res = await db.execute("SELECT b.title, b.author, c.book_condition FROM BOOK b JOIN BOOK_COPY c ON b.book_id = c.book_id WHERE c.book_condition IN ('Minor Damage', 'Moderate Damage', 'Severe Damage')");
            results.damaged = res.rows;
        }
        if (reportTypes.includes('outdated')) {
            const res = await db.execute("SELECT b.title, b.author, b.publication_year FROM BOOK b JOIN BOOK_COPY c ON b.book_id = c.book_id WHERE c.book_condition = 'Outdated'");
            results.outdated = res.rows;
        }
        if (reportTypes.includes('obsolete')) {
            const res = await db.execute("SELECT b.title, b.author, b.publication_year FROM BOOK b JOIN BOOK_COPY c ON b.book_id = c.book_id WHERE c.book_condition = 'Obsolete'");
            results.obsolete = res.rows;
        }
        if (reportTypes.includes('archived')) {
            const res = await db.execute("SELECT b.title, b.author, c.date_added FROM BOOK b JOIN BOOK_COPY c ON b.book_id = c.book_id WHERE c.status = 'Archived'");
            results.archived = res.rows;
        }
        if (reportTypes.includes('purchased_vs_donated')) {
            const res = await db.execute("SELECT book_source, COUNT(*) as count FROM BOOK_COPY GROUP BY book_source");
            results.purchased_vs_donated = res.rows;
        }
        if (reportTypes.includes('fines')) {
            const res = await db.execute("SELECT payment_method, SUM(fine_amount) as total, COUNT(*) as count FROM PAYMENT GROUP BY payment_method");
            results.fines = res.rows;
        }
        if (reportTypes.includes('unreturned')) {
            const res = await db.execute(`
                SELECT bk.title, u.first_name, u.last_name, bt.due_date 
                FROM BORROW_TRANSACTION bt
                JOIN BOOK_COPY bc ON bt.material_id = bc.material_id
                JOIN BOOK bk ON bc.book_id = bk.book_id
                JOIN USER u ON bt.user_id = u.user_id
                WHERE bt.status IN ('Borrowed', 'Overdue')
            `);
            results.unreturned = res.rows;
        }
        if (reportTypes.includes('borrowed_history')) {
             const res = await db.execute(`
                SELECT bk.title, u.first_name, u.last_name, bt.borrow_date, bt.return_date
                FROM BORROW_TRANSACTION bt
                JOIN BOOK_COPY bc ON bt.material_id = bc.material_id
                JOIN BOOK bk ON bc.book_id = bk.book_id
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
                SELECT status, COUNT(*) as count FROM BOOK_COPY GROUP BY status
                UNION ALL
                SELECT 'Total Books', COUNT(*) FROM BOOK_COPY
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
                sql = `SELECT bk.title, u.first_name || ' ' || u.last_name as borrower, bt.borrow_date, bt.due_date 
                       FROM BORROW_TRANSACTION bt 
                       JOIN BOOK_COPY bc ON bt.material_id = bc.material_id
                       JOIN BOOK bk ON bc.book_id = bk.book_id 
                       JOIN USER u ON bt.user_id = u.user_id 
                       WHERE bt.status = 'Borrowed' ORDER BY bt.due_date ASC`;
                args = []; // No date filter for current status
                break;
            case 'overdue':
                sql = `SELECT bk.title, u.first_name || ' ' || u.last_name as borrower, bt.due_date, 
                       (julianday('now') - julianday(bt.due_date)) as days_overdue
                       FROM BORROW_TRANSACTION bt 
                       JOIN BOOK_COPY bc ON bt.material_id = bc.material_id
                       JOIN BOOK bk ON bc.book_id = bk.book_id 
                       JOIN USER u ON bt.user_id = u.user_id 
                       WHERE bt.status IN ('Borrowed', 'Overdue') AND bt.due_date < DATE('now', '+8 hours')`;
                args = [];
                break;
            case 'top_borrowed':
                sql = `SELECT bk.title, bk.genre, COUNT(bt.borrow_id) as borrow_count 
                       FROM BORROW_TRANSACTION bt 
                       JOIN BOOK_COPY bc ON bt.material_id = bc.material_id
                       JOIN BOOK bk ON bc.book_id = bk.book_id 
                       WHERE 1=1 ${dateFilter('bt.borrow_date')}
                       GROUP BY bk.book_id ORDER BY borrow_count DESC LIMIT 50`;
                break;

            // 2. Inventory
            case 'inventory_summary':
                sql = `SELECT status, COUNT(*) as count FROM BOOK_COPY GROUP BY status`;
                args = [];
                break;
            case 'weeding':
                sql = `SELECT b.title, b.author, b.publication_year, c.book_condition, c.location 
                       FROM BOOK b JOIN BOOK_COPY c ON b.book_id = c.book_id 
                       WHERE c.book_condition IN ('Outdated', 'Obsolete') AND c.status = 'Available'`;
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
                sql = `SELECT u.first_name || ' ' || u.last_name as user, f.fine_amount as amount, f.fine_type, f.status 
                       FROM FINE f 
                       JOIN BORROW_TRANSACTION bt ON f.borrow_id = bt.borrow_id 
                       JOIN USER u ON bt.user_id = u.user_id 
                       WHERE f.status = 'Unpaid'`;
                args = [];
                break;

            // 4. Users
            case 'registration_queue':
                sql = `SELECT * FROM (
                           SELECT 'User' as type, first_name || ' ' || last_name as name, email, date_created FROM USER WHERE status = 'Pending'
                           UNION ALL
                           SELECT 'Guardian' as type, first_name || ' ' || last_name as name, email, date_created FROM GUARDIAN_NAME WHERE status = 'Pending'
                       ) WHERE 1=1 ${dateFilter('date_created')}`;
                break;
            case 'disciplinary':
                sql = `SELECT u.first_name || ' ' || u.last_name as user, b.reason, b.ban_date, b.end_date 
                       FROM BAN_TERMINATION b JOIN USER u ON b.user_id = u.user_id
                       WHERE 1=1 ${dateFilter('b.ban_date')}`;
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
            const total = await db.execute("SELECT COUNT(*) as c FROM BOOK_COPY");
            const lost = await db.execute("SELECT COUNT(*) as c FROM BOOK_COPY WHERE status = 'Lost'");
            const archived = await db.execute("SELECT COUNT(*) as c FROM BOOK_COPY WHERE status = 'Archived'");
            stats = [
                { label: 'Total Books', value: total.rows[0].c, color: 'blue' },
                { label: 'Lost Books', value: lost.rows[0].c, color: 'red' },
                { label: 'Archived', value: archived.rows[0].c, color: 'amber' }
            ];
        } else if (domain === 'financials') {
            const revenue = await db.execute("SELECT SUM(fine_amount) as s FROM PAYMENT");
            const unpaid = await db.execute("SELECT SUM(fine_amount) as s FROM FINE WHERE status = 'Unpaid'");
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
            SELECT title, content, date_posted 
            FROM ANNOUNCEMENT 
            ORDER BY date_posted DESC
            LIMIT 5
        `);
        const mapped = result.rows.map(r => ({...r, priority: 'Normal'}));
        res.json({ success: true, data: mapped });
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
            args: [admin_id, title, content, priority || 'Normal', status || 'Published', valid_until || null]
        });

        // Send Email if Published
        if (status === 'Published') {
            const usersRes = await db.execute(`
                SELECT email, first_name FROM USER WHERE status = 'Active' AND email IS NOT NULL AND email != ''
                UNION ALL
                SELECT email, first_name FROM GUARDIAN_NAME WHERE status = 'Active' AND email IS NOT NULL AND email != ''
            `);
            
            usersRes.rows.forEach(user => {
                sendAnnouncementEmail(user.email, user.first_name, title, content, priority || 'Normal').catch(() => {});
            });
        }

        res.json({ success: true, message: "Announcement created successfully." });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// PUT /api/announcements/:id (Update)
app.put('/api/announcements/:id', async (req, res) => {
    const { id } = req.params;
    const { title, content, priority, status, valid_until } = req.body;
    try {
        const oldRes = await db.execute({ sql: "SELECT status FROM ANNOUNCEMENT WHERE announcement_id = ?", args: [id] });
        const oldStatus = oldRes.rows[0]?.status;

        await db.execute({
            sql: "UPDATE ANNOUNCEMENT SET title = ?, content = ?, priority = ?, status = ?, valid_until = ? WHERE announcement_id = ?",
            args: [title, content, priority || 'Normal', status || 'Published', valid_until || null, id]
        });

        // Send Email if it was just changed to Published from Draft
        if (status === 'Published' && oldStatus !== 'Published') {
            const usersRes = await db.execute(`
                SELECT email, first_name FROM USER WHERE status = 'Active' AND email IS NOT NULL AND email != ''
                UNION ALL
                SELECT email, first_name FROM GUARDIAN_NAME WHERE status = 'Active' AND email IS NOT NULL AND email != ''
            `);
            
            usersRes.rows.forEach(user => {
                sendAnnouncementEmail(user.email, user.first_name, title, content, priority || 'Normal').catch(() => {});
            });
        }

        res.json({ success: true, message: "Announcement updated successfully." });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// DELETE /api/announcements/:id (Archive/Soft Delete)
app.delete('/api/announcements/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await db.execute({ sql: "DELETE FROM ANNOUNCEMENT WHERE announcement_id = ?", args: [id] });
        res.json({ success: true, message: "Announcement archived." });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// 44. POST /api/admin/process-suspensions
app.post('/api/admin/process-suspensions', async (req, res) => {
    try {
        const candidates = await db.execute(`
            SELECT DISTINCT u.user_id, COALESCE(u.email, g.email) as email, u.first_name 
            FROM FINE f 
            JOIN BORROW_TRANSACTION b ON f.borrow_id = b.borrow_id 
            JOIN USER u ON b.user_id = u.user_id 
            LEFT JOIN GUARDIAN_NAME g ON u.guardian_id = g.guardian_id
            WHERE f.status = 'Unpaid' AND u.status NOT IN ('Suspended', 'Banned')
        `);

        if (candidates.rows.length > 0) {
            const ids = candidates.rows.map(r => r.user_id);
            const placeholders = ids.map(() => '?').join(',');

            await db.execute({
                sql: `UPDATE USER SET status = 'Suspended' WHERE user_id IN (${placeholders})`,
                args: ids
            });

            for (const row of candidates.rows) {
                await db.execute({
                    sql: "INSERT INTO BAN_TERMINATION (user_id, reason, ban_date, end_date) VALUES (?, 'Automatic Suspension: Unpaid Fines', DATE('now', '+8 hours'), NULL)",
                    args: [row.user_id]
                });
                if (row.email) {
                    sendAccountStatusEmail(row.email, row.first_name, 'Suspended', 'Automatic Suspension: Unpaid Fines. Please settle your balance to reactivate your account.').catch(e => console.error("Auto Suspend Email Error:", e));
                }
            }
        }

        const banCandidates = await db.execute(`
            SELECT DISTINCT u.user_id, COALESCE(u.email, g.email) as email, u.first_name 
            FROM BORROW_TRANSACTION b 
            JOIN USER u ON b.user_id = u.user_id 
            LEFT JOIN GUARDIAN_NAME g ON u.guardian_id = g.guardian_id
            WHERE b.status IN ('Borrowed', 'Overdue') 
              AND b.borrow_date <= date('now', '+8 hours', '-3 months')
              AND u.status != 'Banned'
        `);

        if (banCandidates.rows.length > 0) {
            const banIds = banCandidates.rows.map(r => r.user_id);
            const banPlaceholders = banIds.map(() => '?').join(',');

            await db.execute({
                sql: `UPDATE USER SET status = 'Banned' WHERE user_id IN (${banPlaceholders})`,
                args: banIds
            });

            for (const row of banCandidates.rows) {
                await db.execute({
                    sql: "INSERT INTO BAN_TERMINATION (user_id, reason, ban_date, end_date) VALUES (?, 'Automatic Ban: Material unreturned for over 3 months', DATE('now', '+8 hours'), NULL)",
                    args: [row.user_id]
                });
                if (row.email) {
                    sendAccountStatusEmail(row.email, row.first_name, 'Banned', 'Automatic Ban: Material unreturned for over 3 months.').catch(e => console.error("Auto Ban Email Error:", e));
                }
            }
        }

        // Automatic Suspension Logic: Unreturned "Inside Library" materials past closing time
        const insideCandidates = await db.execute(`
            SELECT DISTINCT u.user_id, COALESCE(u.email, g.email) as email, u.first_name 
            FROM BORROW_TRANSACTION b 
            JOIN USER u ON b.user_id = u.user_id 
            LEFT JOIN GUARDIAN_NAME g ON u.guardian_id = g.guardian_id
            WHERE b.status IN ('Borrowed', 'Overdue') 
              AND b.borrow_type = 'Inside Library'
              AND u.status NOT IN ('Suspended', 'Banned')
              AND (
                  b.due_date < date('now', '+8 hours')
                  OR (
                      b.due_date = date('now', '+8 hours') AND 
                      time('now', '+8 hours') >= CASE 
                          WHEN strftime('%w', b.due_date) = '6' THEN '16:00:00'
                          ELSE '18:00:00'
                      END
                  )
              )
        `);

        if (insideCandidates.rows.length > 0) {
            const insideIds = insideCandidates.rows.map(r => r.user_id);
            const insidePlaceholders = insideIds.map(() => '?').join(',');

            await db.execute({
                sql: `UPDATE USER SET status = 'Suspended' WHERE user_id IN (${insidePlaceholders})`,
                args: insideIds
            });

            for (const row of insideCandidates.rows) {
                await db.execute({
                    sql: "INSERT INTO BAN_TERMINATION (user_id, reason, ban_date, end_date) VALUES (?, 'Automatic Suspension: Unreturned Library Use Only Material', DATE('now', '+8 hours'), NULL)",
                    args: [row.user_id]
                });
                if (row.email) {
                    sendAccountStatusEmail(row.email, row.first_name, 'Suspended', 'Automatic Suspension: Unreturned "Inside Library" material past closing time. Please return the material immediately to the front desk.').catch(e => console.error("Auto Suspend Email Error:", e));
                }
            }
        }

        // Automatic Due Soon Reminders (<= 3 days)
        const reminderCandidates = await db.execute(`
            SELECT b.borrow_id, COALESCE(u.email, g.email) as email, u.first_name, bk.title as book_title, b.due_date 
            FROM BORROW_TRANSACTION b 
            JOIN USER u ON b.user_id = u.user_id 
            LEFT JOIN GUARDIAN_NAME g ON u.guardian_id = g.guardian_id
            JOIN BOOK_COPY bc ON b.material_id = bc.material_id
            JOIN BOOK bk ON bc.book_id = bk.book_id
            WHERE b.status = 'Borrowed' 
              AND b.due_date <= date('now', '+8 hours', '+3 days')
              AND b.due_date >= date('now', '+8 hours')
              AND b.reminder_sent = 0
              AND b.borrow_type != 'Inside Library'
            UNION ALL
            SELECT b.borrow_id, COALESCE(u.email, g.email) as email, u.first_name, p.title as book_title, b.due_date 
            FROM BORROW_TRANSACTION b 
            JOIN USER u ON b.user_id = u.user_id 
            LEFT JOIN GUARDIAN_NAME g ON u.guardian_id = g.guardian_id
            JOIN PERIODICAL_COPY pc ON b.material_id = pc.material_id
            JOIN PERIODICAL p ON pc.periodical_id = p.periodical_id
            WHERE b.status = 'Borrowed' 
              AND b.due_date <= date('now', '+8 hours', '+3 days')
              AND b.due_date >= date('now', '+8 hours')
              AND b.reminder_sent = 0
              AND b.borrow_type != 'Inside Library'
        `);

        if (reminderCandidates.rows.length > 0) {
            const remIds = reminderCandidates.rows.map(r => r.borrow_id);
            const remPlaceholders = remIds.map(() => '?').join(',');

            await db.execute({
                sql: `UPDATE BORROW_TRANSACTION SET reminder_sent = 1 WHERE borrow_id IN (${remPlaceholders})`,
                args: remIds
            });

            for (const row of reminderCandidates.rows) {
                if (row.email) {
                    const dueDateStr = new Date(row.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    sendDueSoonEmail(row.email, row.first_name, row.book_title, dueDateStr).catch(e => console.error("Due Soon Email Error:", e));
                }
            }
        }

        res.json({ success: true, count: candidates.rows.length + banCandidates.rows.length + insideCandidates.rows.length });
    } catch (error) {
        console.error("Auto Suspend Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});