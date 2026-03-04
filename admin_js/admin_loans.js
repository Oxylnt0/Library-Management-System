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
                        sql: `SELECT bt.borrow_id, bt.book_id, bt.due_date, b.title, b.author, b.image_url 
                              FROM BORROW_TRANSACTION bt 
                              JOIN BOOK b ON bt.book_id = b.book_id 
                              WHERE bt.user_id = ? AND bt.status IN ('Borrowed', 'Overdue')`,
                        args: [scannedUserId]
                    });
                    await renderReturnModal(user, scannedUserId, loanResult.rows);
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

        async function renderReturnModal(user, userId, loans) {
            const modal = document.getElementById('loan-modal');
            const content = document.getElementById('modal-content');
            
            // Set Header
            document.getElementById('modal-user-name').innerText = `${user.first_name} ${user.last_name}`;
            document.getElementById('modal-user-id').innerText = `User ID: ${userId}`;

            content.innerHTML = '<div class="flex justify-center py-10"><div class="spinner text-[#183B5B]"></div></div>';
            modal.classList.remove('hidden');

            // Fetch Fine Settings
            let settings = [];
            try {
                const settingsRes = await db.execute("SELECT * FROM FINE_SETTINGS");
                settings = settingsRes.rows;
            } catch (e) {
                console.warn("Fine settings not found, using defaults");
                settings = [
                    { fine_type: 'Overdue (Daily)', fine_amount: 5.00 },
                    { fine_type: 'Minor Damage', fine_amount: 30.00 },
                    { fine_type: 'Moderate Damage', fine_amount: 150.00 }
                ];
            }
            
            const overdueSetting = settings.find(s => s.fine_type === 'Overdue (Daily)') || { fine_amount: 5.00 };
            const damageSettings = settings.filter(s => s.fine_type !== 'Overdue (Daily)');

            content.innerHTML = '';

            const section = document.createElement('div');
            section.className = 'bg-slate-50 rounded-xl p-4 border border-slate-200';
            section.innerHTML = `<h4 class="font-bold text-slate-700 mb-3 flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-amber-500"></span> Active Loans (Return)</h4>`;

            if (loans.length === 0) {
                section.innerHTML += `<p class="text-sm text-slate-400 italic text-center py-4">No active loans.</p>`;
            } else {
                let html = '<div class="space-y-4">';
                loans.forEach(borrow => {
                    const dueDate = new Date(borrow.due_date);
                    const today = new Date();
                    dueDate.setHours(0,0,0,0);
                    today.setHours(0,0,0,0);
                    
                    const diffTime = today - dueDate;
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                    const isOverdue = diffDays > 0;
                    const overdueFee = isOverdue ? (diffDays * overdueSetting.fine_amount) : 0;

                    let damageOptionsHtml = `
                        <div class="mt-3 bg-white p-3 rounded-lg border border-slate-200">
                            <p class="text-xs font-bold text-slate-700 uppercase mb-2">Condition Assessment</p>
                            <div class="space-y-2">
                                <label class="flex items-center justify-between cursor-pointer hover:bg-slate-50 p-1 rounded">
                                    <div class="flex items-center">
                                        <input type="radio" name="damage_${borrow.borrow_id}" value="0|None" checked 
                                            class="accent-[#183B5B] w-4 h-4" onchange="updateTotal(${borrow.borrow_id}, 0)">
                                        <span class="ml-2 text-sm text-slate-700">No Damage</span>
                                    </div>
                                    <span class="text-xs font-bold text-slate-500">₱0.00</span>
                                </label>
                    `;

                    damageSettings.forEach(ds => {
                        damageOptionsHtml += `
                            <label class="flex items-center justify-between cursor-pointer hover:bg-slate-50 p-1 rounded">
                                <div class="flex items-center">
                                    <input type="radio" name="damage_${borrow.borrow_id}" value="${ds.fine_amount}|${ds.fine_type}" 
                                        class="accent-[#183B5B] w-4 h-4" onchange="updateTotal(${borrow.borrow_id}, ${ds.fine_amount})">
                                    <span class="ml-2 text-sm text-slate-700">${ds.fine_type}</span>
                                </div>
                                <span class="text-xs font-bold text-amber-600">+₱${ds.fine_amount.toFixed(2)}</span>
                            </label>
                        `;
                    });
                    damageOptionsHtml += `</div></div>`;

                    html += `
                        <div class="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-4">
                            <div class="w-20 h-28 bg-slate-200 rounded-md shrink-0 overflow-hidden">
                                ${borrow.image_url ? `<img src="${borrow.image_url}" class="w-full h-full object-cover">` : '<div class="w-full h-full flex items-center justify-center text-xs text-slate-400">No Cover</div>'}
                            </div>
                            <div class="flex-1">
                                <h4 class="font-bold text-[#183B5B] text-lg">${borrow.title}</h4>
                                <p class="text-sm text-slate-600 mb-2">${borrow.author || 'Unknown Author'}</p>
                                <div class="flex gap-4 text-xs mb-3">
                                    <div class="px-2 py-1 rounded bg-slate-100 border border-slate-200">
                                        <span class="text-slate-500">Due:</span> 
                                        <span class="font-bold ${isOverdue ? 'text-red-600' : 'text-slate-700'}">${new Date(borrow.due_date).toLocaleDateString()}</span>
                                    </div>
                                    ${isOverdue ? `<div class="px-2 py-1 rounded bg-red-100 border border-red-200 text-red-700 font-bold">${diffDays} Days Overdue</div>` : ''}
                                </div>
                                ${damageOptionsHtml}
                                <div class="mt-4 flex justify-between items-center border-t pt-3">
                                    <div>
                                        <p class="text-xs text-slate-500">Total Fines</p>
                                        <p class="text-xl font-bold text-red-600" id="total-fine-${borrow.borrow_id}">₱${overdueFee.toFixed(2)}</p>
                                        <input type="hidden" id="base-overdue-${borrow.borrow_id}" value="${overdueFee}">
                                    </div>
                                    <button onclick="processReturn(${borrow.borrow_id}, ${borrow.book_id}, ${userId})" 
                                        class="bg-[#183B5B] hover:bg-[#2E5F87] text-white px-6 py-2 rounded-lg font-bold shadow-md transition-colors">
                                        Confirm Return
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                });
                html += '</div>';
                section.innerHTML += html;
            }
            content.appendChild(section);

            modal.classList.remove('hidden');
        }

        function updateTotal(borrowId, damageAmount) {
            const baseOverdue = parseFloat(document.getElementById(`base-overdue-${borrowId}`).value);
            const total = baseOverdue + parseFloat(damageAmount);
            document.getElementById(`total-fine-${borrowId}`).innerText = `₱${total.toFixed(2)}`;
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
            if (!confirm("Are you sure you want to return this book?")) return;
            try {
                // Check for damage selection
                const radios = document.getElementsByName(`damage_${borrowId}`);
                let damageAmount = 0;
                let damageType = null;

                if (radios.length > 0) {
                    for (const r of radios) {
                        if (r.checked) {
                            const parts = r.value.split('|');
                            damageAmount = parseFloat(parts[0]);
                            damageType = parts[1];
                            break;
                        }
                    }
                }
                
                const baseOverdueEl = document.getElementById(`base-overdue-${borrowId}`);
                const overdueAmount = baseOverdueEl ? parseFloat(baseOverdueEl.value) : 0;

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

                // Insert Fines
                if (overdueAmount > 0) {
                    await db.execute({ sql: "INSERT INTO FINE (borrow_id, amount, fine_type, status) VALUES (?, ?, 'Overdue', 'Unpaid')", args: [borrowId, overdueAmount] });
                }
                if (damageAmount > 0) {
                    await db.execute({ sql: "INSERT INTO FINE (borrow_id, amount, fine_type, status) VALUES (?, ?, ?, 'Unpaid')", args: [borrowId, damageAmount, damageType] });
                }

                alert("Book returned successfully.");
                onUserQrScanned(userId, 'return'); 
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
        window.updateTotal = updateTotal;
    } catch (error) {
        console.error("Failed to initialize admin_loans.js:", error);
        alert("System Error: Failed to load loans module. " + error.message);
    }
})();