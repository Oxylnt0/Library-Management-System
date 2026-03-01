(() => {
    try {
        const path = require('path');
        const { db } = require(path.join(process.cwd(), 'db_config.js'));

        // Function called when a user QR code is scanned
        async function onUserQrScanned(scannedUserId, scanType) {
            try {
                if (scanType === 'borrow') {
                    console.log(`Fetching reservations for User ID: ${scannedUserId}`);
                    
                    const result = await db.execute({
                        sql: `
                            SELECT r.reservation_id, r.book_id, r.user_id, r.reservation_date, b.title 
                            FROM RESERVATION r 
                            JOIN BOOK b ON r.book_id = b.book_id 
                            WHERE r.user_id = ? AND r.status = 'Pending'
                        `,
                        args: [scannedUserId]
                    });

                    renderReservationsTable(result.rows);
                } else if (scanType === 'return') {
                    console.log(`Fetching active loans for User ID: ${scannedUserId}`);
                    
                    const result = await db.execute({
                        sql: `
                            SELECT bt.borrow_id, bt.book_id, bt.due_date, b.title 
                            FROM BORROW_TRANSACTION bt 
                            JOIN BOOK b ON bt.book_id = b.book_id 
                            WHERE bt.user_id = ? AND bt.status IN ('Borrowed', 'Overdue')
                        `,
                        args: [scannedUserId]
                    });

                    renderReturnsTable(result.rows, scannedUserId);
                }

            } catch (error) {
                console.error("Error:", error);
                alert("Failed to fetch reservations: " + error.message);
            }
        }

        function renderReservationsTable(reservations) {
            const modal = document.getElementById('reservations-modal');
            const list = document.getElementById('reservations-list');
            const noMsg = document.getElementById('no-reservations-msg');

            if (!modal || !list) return;

            list.innerHTML = '';
            
            if (reservations.length === 0) {
                noMsg.classList.remove('hidden');
            } else {
                noMsg.classList.add('hidden');
                reservations.forEach(res => {
                    const row = document.createElement('tr');
                    row.className = 'group hover:bg-slate-50 transition-colors';
                    row.innerHTML = `
                        <td class="py-3 font-medium text-slate-800">${res.title}</td>
                        <td class="py-3 text-slate-500">${new Date(res.reservation_date).toLocaleDateString()}</td>
                        <td class="py-3 text-right flex justify-end gap-2">
                            <button onclick="approveCheckout(${res.reservation_id}, ${res.user_id}, ${res.book_id})" 
                                class="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded hover:bg-emerald-700 transition shadow-sm">
                                Approve
                            </button>
                            <button onclick="declineBorrow(${res.reservation_id}, ${res.user_id})" 
                                class="px-3 py-1.5 bg-white border border-slate-300 text-slate-600 text-xs font-bold rounded hover:bg-slate-50 transition shadow-sm">
                                Decline
                            </button>
                        </td>
                    `;
                    list.appendChild(row);
                });
            }

            modal.classList.remove('hidden');
        }

        function renderReturnsTable(loans, userId) {
            const modal = document.getElementById('returns-modal');
            const list = document.getElementById('returns-list');
            const noMsg = document.getElementById('no-returns-msg');

            if (!modal || !list) return;

            list.innerHTML = '';
            
            if (loans.length === 0) {
                noMsg.classList.remove('hidden');
            } else {
                noMsg.classList.add('hidden');
                loans.forEach(loan => {
                    const row = document.createElement('tr');
                    row.className = 'group hover:bg-slate-50 transition-colors';
                    row.innerHTML = `
                        <td class="py-3 font-medium text-slate-800">${loan.title}</td>
                        <td class="py-3 text-slate-500">${new Date(loan.due_date).toLocaleDateString()}</td>
                        <td class="py-3 text-right">
                            <button onclick="processReturn(${loan.borrow_id}, ${loan.book_id}, ${userId})" 
                                class="px-3 py-1.5 bg-[#183B5B] text-white text-xs font-bold rounded hover:bg-[#2E5F87] transition shadow-sm">
                                Return
                            </button>
                        </td>
                    `;
                    list.appendChild(row);
                });
            }

            modal.classList.remove('hidden');
        }

        function closeReservationsModal() {
            const modal = document.getElementById('reservations-modal');
            if (modal) modal.classList.add('hidden');
        }

        function closeReturnsModal() {
            const modal = document.getElementById('returns-modal');
            if (modal) modal.classList.add('hidden');
        }

        // Function to approve a checkout from a reservation
        async function approveCheckout(reservationId, userId, bookId) {
            try {
                // Step 1: Mark Reservation as Fulfilled
                await db.execute({
                    sql: "UPDATE RESERVATION SET status = 'Fulfilled' WHERE reservation_id = ?",
                    args: [reservationId]
                });

                // Step 2: Create Borrow Transaction
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

                alert("Checkout Approved! Book is now borrowed.");
                onUserQrScanned(userId, 'borrow'); // Refresh the table to show updated status

            } catch (error) {
                console.error("Checkout error:", error);
                alert("Failed to process checkout: " + error.message);
            }
        }

        // Function to decline a reservation
        async function declineBorrow(reservationId, userId) {
            if(!confirm("Are you sure you want to decline this reservation?")) return;

            try {
                await db.execute({
                    sql: "UPDATE RESERVATION SET status = 'Cancelled' WHERE reservation_id = ?",
                    args: [reservationId]
                });
                
                // Refresh list
                onUserQrScanned(userId, 'borrow');
                
            } catch (error) {
                console.error("Decline error:", error);
                alert("Failed to decline: " + error.message);
            }
        }

        async function processReturn(borrowId, bookId, userId) {
            try {
                // Update Borrow Transaction
                await db.execute({
                    sql: "UPDATE BORROW_TRANSACTION SET status = 'Returned', return_date = DATE('now') WHERE borrow_id = ?",
                    args: [borrowId]
                });

                // Update Book Status
                await db.execute({
                    sql: "UPDATE BOOK SET status = 'Available' WHERE book_id = ?",
                    args: [bookId]
                });

                alert("Book returned successfully.");
                onUserQrScanned(userId, 'return'); // Refresh list

            } catch (error) {
                console.error("Return error:", error);
                alert("Failed to process return: " + error.message);
            }
        }

        // Expose functions to the global window object for HTML access
        window.onUserQrScanned = onUserQrScanned;
        window.approveCheckout = approveCheckout;
        window.declineBorrow = declineBorrow;
        window.closeReservationsModal = closeReservationsModal;
        window.processReturn = processReturn;
        window.closeReturnsModal = closeReturnsModal;
    } catch (error) {
        console.error("Failed to initialize admin_loans.js:", error);
        alert("System Error: Failed to load loans module. " + error.message);
    }
})();