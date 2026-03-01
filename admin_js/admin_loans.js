(() => {
    try {
        const path = require('path');
        const { db } = require(path.join(process.cwd(), 'db_config.js'));

        // Initialize
        let borrowedData = [];
        let returnedData = [];
        let sortState = { borrowed: 'desc', returned: 'desc' };

        fetchRecentActivity();
        fetchLoanStats();

        // Function called when a user QR code is scanned
        async function onUserQrScanned(scannedUserId, scanType) {
            try {
                console.log(`Fetching data for User ID: ${scannedUserId} (Action: ${scanType})`);
                
                // 1. Fetch User Details
                const userRes = await db.execute({
                    sql: "SELECT first_name, last_name FROM USER WHERE user_id = ?",
                    args: [scannedUserId]
                });

                if (userRes.rows.length === 0) {
                    alert("User not found!");
                    return;
                }
                const user = userRes.rows[0];

                if (scanType === 'borrow') {
                    // A. Fetch Pending Holds (Kiosk Requests)
                    const holdsRes = await db.execute({
                        sql: `SELECT bt.borrow_id, bt.book_id, bt.expires_at, b.title 
                              FROM BORROW_TRANSACTION bt
                              JOIN BOOK b ON bt.book_id = b.book_id
                              WHERE bt.user_id = ? AND bt.status = 'Pending'`,
                        args: [scannedUserId]
                    });

                    renderBorrowModal(user, scannedUserId, holdsRes.rows);
                } else if (scanType === 'return') {
                    // Fetch Active Loans
                    const loanResult = await db.execute({
                        sql: `SELECT bt.borrow_id, bt.book_id, bt.due_date, b.title 
                              FROM BORROW_TRANSACTION bt 
                              JOIN BOOK b ON bt.book_id = b.book_id 
                              WHERE bt.user_id = ? AND bt.status IN ('Borrowed', 'Overdue')`,
                        args: [scannedUserId]
                    });
                    renderReturnModal(user, scannedUserId, loanResult.rows);
                }
            } catch (error) {
                console.error("Error:", error);
                alert("Failed to fetch user data: " + error.message);
            }
        }

        function renderBorrowModal(user, userId, holds) {
            const modal = document.getElementById('loan-modal');
            const content = document.getElementById('modal-content');
            
            // Set Header
            document.getElementById('modal-user-name').innerText = `${user.first_name} ${user.last_name}`;
            document.getElementById('modal-user-id').innerText = `User ID: ${userId}`;

            content.innerHTML = '';

            // 1. Render Kiosk Holds
            const holdsSection = document.createElement('div');
            holdsSection.className = 'bg-slate-50 rounded-xl p-4 border border-slate-200 mb-4';
            holdsSection.innerHTML = `<h4 class="font-bold text-slate-700 mb-3 flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-blue-500"></span> On Hold (Kiosk)</h4>`;
            
            if (holds.length === 0) {
                holdsSection.innerHTML += `<p class="text-sm text-slate-400 italic text-center py-2">No pending holds.</p>`;
            } else {
                const list = document.createElement('div');
                list.className = 'space-y-2';
                holds.forEach(h => {
                    list.innerHTML += `
                        <div class="bg-white p-3 rounded-lg border border-slate-100 shadow-sm flex justify-between items-center">
                            <div>
                                <p class="font-bold text-slate-800 text-sm">${h.title}</p>
                                <p class="text-xs text-slate-500">Expires: ${new Date(h.expires_at).toLocaleTimeString()}</p>
                            </div>
                            <button onclick="confirmBorrow(${h.borrow_id}, ${userId})" class="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 transition shadow-sm">Accept</button>
                        </div>`;
                });
                holdsSection.appendChild(list);
            }
            content.appendChild(holdsSection);

            modal.classList.remove('hidden');
        }

        function renderReturnModal(user, userId, loans) {
            const modal = document.getElementById('loan-modal');
            const content = document.getElementById('modal-content');
            
            // Set Header
            document.getElementById('modal-user-name').innerText = `${user.first_name} ${user.last_name}`;
            document.getElementById('modal-user-id').innerText = `User ID: ${userId}`;

            content.innerHTML = '';

            const section = document.createElement('div');
            section.className = 'bg-slate-50 rounded-xl p-4 border border-slate-200';
            section.innerHTML = `<h4 class="font-bold text-slate-700 mb-3 flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-amber-500"></span> Active Loans (Return)</h4>`;

            if (loans.length === 0) {
                section.innerHTML += `<p class="text-sm text-slate-400 italic text-center py-4">No active loans.</p>`;
            } else {
                const list = document.createElement('div');
                list.className = 'space-y-2';
                loans.forEach(loan => {
                    list.innerHTML += `
                        <div class="bg-white p-3 rounded-lg border border-slate-100 shadow-sm flex justify-between items-center">
                            <div>
                                <p class="font-bold text-slate-800 text-sm">${loan.title}</p>
                                <p class="text-xs text-slate-500">Due: ${new Date(loan.due_date).toLocaleDateString()}</p>
                            </div>
                            <button onclick="processReturn(${loan.borrow_id}, ${loan.book_id}, ${userId})" class="px-3 py-1.5 bg-[#183B5B] text-white text-xs font-bold rounded hover:bg-[#2E5F87] transition shadow-sm">Return</button>
                        </div>`;
                });
                section.appendChild(list);
            }
            content.appendChild(section);

            modal.classList.remove('hidden');
        }

        function closeLoanModal() {
            const modal = document.getElementById('loan-modal');
            if (modal) modal.classList.add('hidden');
        }

        // Function to approve a checkout from a reservation
        async function approveCheckout(reservationId, userId, bookId) {
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

                alert("Checkout Approved! Book is now borrowed.");
                onUserQrScanned(userId); // Refresh the modal
                fetchRecentActivity(); // Refresh sidebar
                fetchLoanStats(); // Refresh stats

            } catch (error) {
                console.error("Checkout error:", error);
                alert("Failed to process checkout: " + error.message);
            }
        }

        // Function to confirm a Kiosk Hold (Pending Borrow Transaction)
        async function confirmBorrow(borrowId, userId) {
            try {
                await db.execute({
                    sql: `UPDATE BORROW_TRANSACTION 
                          SET status = 'Borrowed', borrow_date = DATE('now', '+8 hours'), due_date = DATE('now', '+8 hours', '+7 days'), expires_at = NULL 
                          WHERE borrow_id = ?`,
                    args: [borrowId]
                });

                alert("Book successfully borrowed!");
                onUserQrScanned(userId, 'borrow'); // Refresh modal
                fetchRecentActivity();
                fetchLoanStats();
            } catch (error) {
                console.error("Confirm Borrow Error:", error);
                alert("Failed to confirm borrow: " + error.message);
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
                    sql: "UPDATE BORROW_TRANSACTION SET status = 'Returned', return_date = DATE('now', '+8 hours') WHERE borrow_id = ?",
                    args: [borrowId]
                });

                // Update Book Status
                await db.execute({
                    sql: "UPDATE BOOK SET status = 'Available', available_copies = available_copies + 1 WHERE book_id = ?",
                    args: [bookId]
                });

                alert("Book returned successfully.");
                onUserQrScanned(userId, 'return'); // Refresh modal
                fetchRecentActivity(); // Refresh sidebar
                fetchLoanStats(); // Refresh stats

            } catch (error) {
                console.error("Return error:", error);
                alert("Failed to process return: " + error.message);
            }
        }

        async function fetchRecentActivity() {
            try {
                // Fetch Recently Borrowed
                const borrowedRes = await db.execute({
                    sql: `SELECT bt.borrow_date, b.title, u.first_name, u.last_name 
                          FROM BORROW_TRANSACTION bt 
                          JOIN BOOK b ON bt.book_id = b.book_id 
                          JOIN USER u ON bt.user_id = u.user_id 
                          WHERE bt.status = 'Borrowed' 
                          ORDER BY bt.borrow_date DESC LIMIT 50`
                });
                borrowedData = borrowedRes.rows;
                renderActivityTable('tbody-borrowed', borrowedData, 'borrow_date');

                // Fetch Recently Returned
                const returnedRes = await db.execute({
                    sql: `SELECT bt.return_date, b.title, u.first_name, u.last_name 
                          FROM BORROW_TRANSACTION bt 
                          JOIN BOOK b ON bt.book_id = b.book_id 
                          JOIN USER u ON bt.user_id = u.user_id 
                          WHERE bt.status = 'Returned' 
                          ORDER BY bt.return_date DESC LIMIT 50`
                });
                returnedData = returnedRes.rows;
                renderActivityTable('tbody-returned', returnedData, 'return_date');

            } catch (error) {
                console.error("Error fetching recent activity:", error);
            }
        }

        function renderActivityTable(tbodyId, data, dateField) {
            const tbody = document.getElementById(tbodyId);
            if (!tbody) return;
            tbody.innerHTML = '';

            data.forEach(item => {
                const row = document.createElement('tr');
                row.className = 'hover:bg-slate-50 transition-colors';
                row.innerHTML = `
                    <td class="p-4 font-medium text-slate-800">${item.first_name} ${item.last_name}</td>
                    <td class="p-4 text-slate-600">${item.title}</td>
                    <td class="p-4 text-slate-500">${new Date(item[dateField]).toLocaleDateString()}</td>
                `;
                tbody.appendChild(row);
            });
        }

        function sortActivity(type) {
            const field = type === 'borrowed' ? 'borrow_date' : 'return_date';
            const data = type === 'borrowed' ? borrowedData : returnedData;
            const tbodyId = type === 'borrowed' ? 'tbody-borrowed' : 'tbody-returned';
            
            // Toggle sort
            sortState[type] = sortState[type] === 'desc' ? 'asc' : 'desc';
            const direction = sortState[type];

            // Sort data
            data.sort((a, b) => {
                const dateA = new Date(a[field]);
                const dateB = new Date(b[field]);
                return direction === 'asc' ? dateA - dateB : dateB - dateA;
            });

            // Update Icon
            const icon = document.getElementById(`sort-icon-${type}`);
            if(icon) icon.innerText = direction === 'asc' ? '▲' : '▼';

            renderActivityTable(tbodyId, data, field);
        }

        async function fetchLoanStats() {
            try {
                // 1. Borrowed Today
                const borrowedRes = await db.execute({
                    sql: "SELECT COUNT(*) as count FROM BORROW_TRANSACTION WHERE borrow_date = DATE('now', '+8 hours')"
                });
                const borrowedCount = borrowedRes.rows[0]?.count || 0;
                document.getElementById('stat-borrowed-today').innerText = borrowedCount;

                // 2. Overdue (Status is Overdue OR (Borrowed AND Due Date < Today))
                const overdueRes = await db.execute({
                    sql: "SELECT COUNT(*) as count FROM BORROW_TRANSACTION WHERE status = 'Overdue' OR (status = 'Borrowed' AND due_date < DATE('now', '+8 hours'))"
                });
                const overdueCount = overdueRes.rows[0]?.count || 0;
                document.getElementById('stat-overdue').innerText = overdueCount;

                // 3. Returned Today
                const returnedRes = await db.execute({
                    sql: "SELECT COUNT(*) as count FROM BORROW_TRANSACTION WHERE status = 'Returned' AND return_date = DATE('now', '+8 hours')"
                });
                const returnedCount = returnedRes.rows[0]?.count || 0;
                document.getElementById('stat-returned-today').innerText = returnedCount;

            } catch (error) {
                console.error("Error fetching loan stats:", error);
            }
        }

        // Expose functions to the global window object for HTML access
        window.onUserQrScanned = onUserQrScanned;
        window.approveCheckout = approveCheckout;
        window.declineBorrow = declineBorrow;
        window.confirmBorrow = confirmBorrow;
        window.processReturn = processReturn;
        window.closeLoanModal = closeLoanModal;
        window.sortActivity = sortActivity;
    } catch (error) {
        console.error("Failed to initialize admin_loans.js:", error);
        alert("System Error: Failed to load loans module. " + error.message);
    }
})();