(() => {
    try {
        const path = require('path');
        const { db } = require(path.join(process.cwd(), 'db_config.js'));
        const { logAdminAction } = require(path.join(process.cwd(), 'audit_service.js'));

        // Initialize
        let historyData = [];
        let overdueData = [];

        fetchHistory();
        fetchOverdueBooks();
        fetchLoanStats();

        // Function called when a user QR code is scanned
        async function onUserQrScanned(scannedUserId, scanType) {
            try {
                console.log(`Fetching data for User ID: ${scannedUserId} (Action: ${scanType})`);
                
                let isGuardian = false;
                let actualId = scannedUserId;
                const rawId = scannedUserId;
                
                if (typeof scannedUserId === 'string') {
                    if (scannedUserId.startsWith('G-')) {
                        isGuardian = true;
                        actualId = scannedUserId.substring(2);
                    } else if (scannedUserId.startsWith('U-')) {
                        actualId = scannedUserId.substring(2);
                    }
                }

                // 1. Fetch User Details
                let user;
                if (isGuardian) {
                    const userRes = await db.execute({
                        sql: "SELECT first_name, last_name FROM GUARDIAN_NAME WHERE guardian_id = ?",
                        args: [actualId]
                    });
                    if (userRes.rows.length === 0) {
                        window.showCustomAlert("Guardian not found!");
                        return;
                    }
                    user = userRes.rows[0];
                    user.isGuardian = true;
                } else {
                    const userRes = await db.execute({
                        sql: "SELECT first_name, last_name FROM USER WHERE user_id = ?",
                        args: [actualId]
                    });
                    if (userRes.rows.length === 0) {
                        window.showCustomAlert("User not found!");
                        return;
                    }
                    user = userRes.rows[0];
                }

                if (scanType === 'borrow') {
                    // A. Fetch Pending Holds (Kiosk Requests)
                    let holdsRes;
                    if (isGuardian) {
                        holdsRes = await db.execute({
                            sql: `SELECT bt.borrow_id, bc.book_id, DATETIME(bt.borrow_date || ' ' || bt.borrow_time, '+30 minutes') as expires_at, b.title, u.first_name as child_name
                                  FROM BORROW_TRANSACTION bt
                                  JOIN BOOK_COPY bc ON bt.material_id = bc.material_id
                                  JOIN BOOK b ON bc.book_id = b.book_id
                                  JOIN USER u ON bt.user_id = u.user_id
                                  WHERE u.guardian_id = ? AND bt.status = 'Pending'
                                  UNION ALL
                                  SELECT bt.borrow_id, pc.periodical_id as book_id, DATETIME(bt.borrow_date || ' ' || bt.borrow_time, '+30 minutes') as expires_at, p.title, u.first_name as child_name
                                  FROM BORROW_TRANSACTION bt
                                  JOIN PERIODICAL_COPY pc ON bt.material_id = pc.material_id
                                  JOIN PERIODICAL p ON pc.periodical_id = p.periodical_id
                                  JOIN USER u ON bt.user_id = u.user_id
                                  WHERE u.guardian_id = ? AND bt.status = 'Pending'`,
                            args: [actualId, actualId]
                        });
                    } else {
                        holdsRes = await db.execute({
                            sql: `SELECT bt.borrow_id, bc.book_id, DATETIME(bt.borrow_date || ' ' || bt.borrow_time, '+30 minutes') as expires_at, b.title, NULL as child_name 
                                  FROM BORROW_TRANSACTION bt
                                  JOIN BOOK_COPY bc ON bt.material_id = bc.material_id
                                  JOIN BOOK b ON bc.book_id = b.book_id
                                  WHERE bt.user_id = ? AND bt.status = 'Pending'
                                  UNION ALL
                                  SELECT bt.borrow_id, pc.periodical_id as book_id, DATETIME(bt.borrow_date || ' ' || bt.borrow_time, '+30 minutes') as expires_at, p.title, NULL as child_name
                                  FROM BORROW_TRANSACTION bt
                                  JOIN PERIODICAL_COPY pc ON bt.material_id = pc.material_id
                                  JOIN PERIODICAL p ON pc.periodical_id = p.periodical_id
                                  WHERE bt.user_id = ? AND bt.status = 'Pending'`,
                            args: [actualId, actualId]
                        });
                    }

                    renderBorrowModal(user, rawId, holdsRes.rows);
                } else if (scanType === 'return') {
                    // Fetch Active Loans
                    let loanResult;
                    if (isGuardian) {
                        loanResult = await db.execute({
                            sql: `SELECT bt.borrow_id, bt.material_id, bc.book_id, bt.borrow_date, bt.due_date, bt.borrow_type, b.title, b.author, b.image_url, u.first_name as child_name 
                                  FROM BORROW_TRANSACTION bt 
                                  JOIN BOOK_COPY bc ON bt.material_id = bc.material_id
                                  JOIN BOOK b ON bc.book_id = b.book_id 
                                  JOIN USER u ON bt.user_id = u.user_id
                                  WHERE u.guardian_id = ? AND bt.status IN ('Borrowed', 'Overdue')
                                  UNION ALL
                                  SELECT bt.borrow_id, bt.material_id, pc.periodical_id as book_id, bt.borrow_date, bt.due_date, bt.borrow_type, p.title, p.publisher as author, p.image_url, u.first_name as child_name
                                  FROM BORROW_TRANSACTION bt 
                                  JOIN PERIODICAL_COPY pc ON bt.material_id = pc.material_id
                                  JOIN PERIODICAL p ON pc.periodical_id = p.periodical_id 
                                  JOIN USER u ON bt.user_id = u.user_id
                                  WHERE u.guardian_id = ? AND bt.status IN ('Borrowed', 'Overdue')`,
                            args: [actualId, actualId]
                        });
                    } else {
                        loanResult = await db.execute({
                            sql: `SELECT bt.borrow_id, bt.material_id, bc.book_id, bt.borrow_date, bt.due_date, bt.borrow_type, b.title, b.author, b.image_url, NULL as child_name 
                                  FROM BORROW_TRANSACTION bt 
                                  JOIN BOOK_COPY bc ON bt.material_id = bc.material_id
                                  JOIN BOOK b ON bc.book_id = b.book_id 
                                  WHERE bt.user_id = ? AND bt.status IN ('Borrowed', 'Overdue')
                                  UNION ALL
                                  SELECT bt.borrow_id, bt.material_id, pc.periodical_id as book_id, bt.borrow_date, bt.due_date, bt.borrow_type, p.title, p.publisher as author, p.image_url, NULL as child_name
                                  FROM BORROW_TRANSACTION bt 
                                  JOIN PERIODICAL_COPY pc ON bt.material_id = pc.material_id
                                  JOIN PERIODICAL p ON pc.periodical_id = p.periodical_id 
                                  WHERE bt.user_id = ? AND bt.status IN ('Borrowed', 'Overdue')`,
                            args: [actualId, actualId]
                        });
                    }
                    await renderReturnModal(user, rawId, loanResult.rows);
                }
            } catch (error) {
                console.error("Error:", error);
                window.showCustomAlert("Failed to fetch user data: " + error.message);
            }
        }

        function renderBorrowModal(user, userId, holds) {
            const modal = document.getElementById('loan-modal');
            const content = document.getElementById('modal-content');
            
            // Set Header
            document.getElementById('modal-user-name').innerText = `${user.first_name} ${user.last_name} ${user.isGuardian ? '(Guardian)' : ''}`;
            document.getElementById('modal-user-id').innerText = `${user.isGuardian ? 'Guardian ID' : 'User ID'}: ${userId}`;

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
                                ${h.child_name ? `<p class="text-xs font-bold text-blue-600 mt-1">For: ${h.child_name}</p>` : ''}
                            </div>
                            <button onclick="confirmBorrow(${h.borrow_id}, '${userId}')" class="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 transition shadow-sm">Accept</button>
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
            document.getElementById('modal-user-name').innerText = `${user.first_name} ${user.last_name} ${user.isGuardian ? '(Guardian)' : ''}`;
            document.getElementById('modal-user-id').innerText = `${user.isGuardian ? 'Guardian ID' : 'User ID'}: ${userId}`;

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
                    { fine_type: 'Moderate Damage', fine_amount: 150.00 },
                    { fine_type: 'Severe Damage', fine_amount: 500.00 }
                ];
            }
            
            const overdueSetting = settings.find(s => s.fine_type === 'Overdue (Daily)') || { fine_amount: 5.00 };
            const damageSettings = settings.filter(s => s.fine_type !== 'Overdue (Daily)');

            // Fetch Loan Period
            const policyRes = await db.execute("SELECT policy_value FROM LENDING_POLICIES WHERE policy_name = 'Standard Loan Period'");
            const loanPeriod = policyRes.rows[0]?.policy_value || 7; // Default to 7 days

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
                    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)); 
                    const isOverdue = diffDays > 0;
                    const overdueFee = isOverdue ? (diffDays * overdueSetting.fine_amount) : 0;
                    
                    const dayOfWeek = dueDate.getDay();
                    const closeTime = dayOfWeek === 6 ? '4:00 PM' : '6:00 PM';
                    let loanPeriodText = borrow.borrow_type === 'Inside Library' ? 'Same Day' : `${loanPeriod} Days`;
                    let dueDisplay = borrow.borrow_type === 'Inside Library' ? `Today by ${closeTime}` : new Date(borrow.due_date).toLocaleDateString();

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
                                ${borrow.child_name ? `<p class="text-xs font-bold text-blue-600 mb-2 bg-blue-50 inline-block px-2 py-1 rounded">For: ${borrow.child_name}</p>` : ''}
                                <div class="flex flex-wrap gap-2 text-xs mb-3">
                                    <div class="px-2 py-1 rounded bg-slate-100 border border-slate-200">
                                        <span class="text-slate-500">Borrowed:</span> 
                                        <span class="font-bold text-slate-700">${new Date(borrow.borrow_date).toLocaleDateString()}</span>
                                    </div>
                                    <div class="px-2 py-1 rounded bg-slate-100 border border-slate-200">
                                        <span class="text-slate-500">Due:</span> 
                                        <span class="font-bold ${isOverdue ? 'text-red-600' : 'text-slate-700'}">${dueDisplay}</span>
                                    </div>
                                    <div class="px-2 py-1 rounded bg-slate-100 border border-slate-200">
                                        <span class="text-slate-500">Loan Period:</span> 
                                        <span class="font-bold text-slate-700">${loanPeriodText}</span>
                                    </div>
                                </div>
                                ${isOverdue ? `<div class="w-full text-center px-2 py-1 rounded bg-red-100 border border-red-200 text-red-700 font-bold text-xs mb-3">${diffDays} Days Overdue</div>` : ''}
                                ${damageOptionsHtml}
                                <div class="mt-4 flex justify-between items-center border-t pt-3">
                                    <div>
                                        <p class="text-xs text-slate-500">Total Fines</p>
                                        <p class="text-xl font-bold text-red-600" id="total-fine-${borrow.borrow_id}">₱${overdueFee.toFixed(2)}</p>
                                        <input type="hidden" id="base-overdue-${borrow.borrow_id}" value="${overdueFee}">
                                    </div>
                                    <button onclick="processReturn(${borrow.borrow_id}, ${borrow.material_id}, '${userId}')" 
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
                const copyRes = await db.execute({
                    sql: "SELECT material_id, location FROM BOOK_COPY WHERE book_id = ? AND status = 'Available' LIMIT 1",
                    args: [bookId]
                });
                if (copyRes.rows.length === 0) throw new Error("No copies available.");

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
                        (user_id, book_id, material_id, borrow_date, borrow_time, due_date, status, borrow_type)
                        VALUES (?, ?, ?, DATE('now', '+8 hours'), TIME('now', '+8 hours'), ${dueSql}, 'Borrowed', ?)`,
                    args: [userId, bookId, materialId, bType]
                });

                // Step 3: Update Book Status
                await db.execute({
                    sql: "UPDATE BOOK_COPY SET status = 'Borrowed' WHERE material_id = ?",
                    args: [materialId]
                });

                window.showCustomAlert("Checkout Approved! Book is now borrowed.", () => {
                    onUserQrScanned(userId); // Refresh the modal
                    fetchHistory(); // Refresh lists
                    fetchOverdueBooks();
                    fetchLoanStats(); // Refresh stats
                });

            } catch (error) {
                console.error("Checkout error:", error);
                window.showCustomAlert("Failed to process checkout: " + error.message);
            }
        }

        // Function to confirm a Kiosk Hold (Pending Borrow Transaction)
        async function confirmBorrow(borrowId, userId) {
            try {
                const txRes = await db.execute({
                    sql: "SELECT borrow_type FROM BORROW_TRANSACTION WHERE borrow_id = ?",
                    args: [borrowId]
                });
                const bType = txRes.rows[0]?.borrow_type || 'Outside Library';
                const dueSql = bType === 'Inside Library' ? "DATE('now', '+8 hours')" : "DATE('now', '+8 hours', '+7 days')";

                await db.execute({
                    sql: `UPDATE BORROW_TRANSACTION 
                          SET status = 'Borrowed', borrow_date = DATE('now', '+8 hours'), borrow_time = TIME('now', '+8 hours'), due_date = ${dueSql}, expires_at = NULL 
                          WHERE borrow_id = ?`,
                    args: [borrowId]
                });

                const adminId = localStorage.getItem('adminId');
                if (adminId) {
                    await logAdminAction(adminId, 'CONFIRM_BORROW', 'BORROW_TRANSACTION', borrowId, `Admin confirmed borrow for user ${userId}`);
                }

                window.showCustomAlert("Book successfully borrowed!", () => {
                    onUserQrScanned(userId, 'borrow'); // Refresh modal
                    fetchHistory();
                    fetchOverdueBooks();
                    fetchLoanStats();
                });
            } catch (error) {
                console.error("Confirm Borrow Error:", error);
                window.showCustomAlert("Failed to confirm borrow: " + error.message);
            }
        }

        // Function to decline a reservation
        async function declineBorrow(reservationId, userId) {
            window.showCustomConfirm("Are you sure you want to decline this reservation?", async () => {
                try {
                    await db.execute({
                        sql: "UPDATE RESERVATION SET status = 'Cancelled' WHERE reservation_id = ?",
                        args: [reservationId]
                    });
                    
                    // Refresh list
                    onUserQrScanned(userId, 'borrow');
                    
                } catch (error) {
                    console.error("Decline error:", error);
                    window.showCustomAlert("Failed to decline: " + error.message);
                }
            });
        }

        async function processReturn(borrowId, materialId, userId) {
            window.showCustomConfirm("Are you sure you want to return this book?", async () => {
                try {
                    // Check for damage selection
                    const radios = document.getElementsByName(`damage_${borrowId}`);
                    let damageAmount = 0;
                    let damageType = 'None';

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

                    // Update Book/Periodical Status and Condition
                    const matRes = await db.execute({
                        sql: "SELECT material_type FROM MATERIAL WHERE material_id = ?",
                        args: [materialId]
                    });
                    const matType = matRes.rows[0]?.material_type || 'Book';
                    const table = matType === 'Book' ? 'BOOK_COPY' : 'PERIODICAL_COPY';
                    const condField = matType === 'Book' ? 'book_condition' : 'periodical_condition';

                    if (damageType && damageType !== 'None') {
                        await db.execute({
                            sql: `UPDATE ${table} SET status = 'Available', ${condField} = ? WHERE material_id = ?`,
                            args: [damageType, materialId]
                        });
                    } else {
                        await db.execute({
                            sql: `UPDATE ${table} SET status = 'Available' WHERE material_id = ?`,
                            args: [materialId]
                        });
                    }

                    // Insert Fines
                    if (overdueAmount > 0) {
                        await db.execute({ sql: "INSERT INTO FINE (borrow_id, fine_amount, fine_type, status) VALUES (?, ?, 'Overdue', 'Unpaid')", args: [borrowId, overdueAmount] });
                    }
                    if (damageAmount > 0) {
                        await db.execute({ sql: "INSERT INTO FINE (borrow_id, fine_amount, fine_type, status) VALUES (?, ?, ?, 'Unpaid')", args: [borrowId, damageAmount, damageType] });
                    }

                    const adminId = localStorage.getItem('adminId');
                    if (adminId) {
                        await logAdminAction(adminId, 'RETURN_BOOK', 'BORROW_TRANSACTION', borrowId, `Admin processed return for ID ${userId}`);
                    }

                    window.showCustomAlert("Book returned successfully.", () => {
                        onUserQrScanned(userId, 'return'); 
                        fetchHistory();
                        fetchOverdueBooks();
                        fetchLoanStats(); // Refresh stats
                    });
                } catch (error) {
                    console.error("Return error:", error);
                    window.showCustomAlert("Failed to process return: " + error.message);
                }
            });
        }

        async function fetchOverdueBooks() {
            try {
                const overdueRes = await db.execute({
                    sql: `SELECT bt.due_date as date_field, b.title, u.first_name, u.last_name 
                          FROM BORROW_TRANSACTION bt 
                          JOIN BOOK_COPY bc ON bt.material_id = bc.material_id
                          JOIN BOOK b ON bc.book_id = b.book_id 
                          JOIN USER u ON bt.user_id = u.user_id 
                          WHERE bt.status = 'Overdue' OR (bt.status = 'Borrowed' AND bt.due_date < DATE('now', '+8 hours'))
                          UNION ALL
                          SELECT bt.due_date as date_field, p.title, u.first_name, u.last_name 
                          FROM BORROW_TRANSACTION bt 
                          JOIN PERIODICAL_COPY pc ON bt.material_id = pc.material_id
                          JOIN PERIODICAL p ON pc.periodical_id = p.periodical_id 
                          JOIN USER u ON bt.user_id = u.user_id 
                          WHERE bt.status = 'Overdue' OR (bt.status = 'Borrowed' AND bt.due_date < DATE('now', '+8 hours'))`
                });
                overdueData = overdueRes.rows;
                applyFilters();
            } catch (error) {
                console.error("Error fetching overdue books:", error);
            }
        }

        async function fetchHistory() {
            try {
                // Fetch History (Borrowed & Returned)
                const historyRes = await db.execute({
                    sql: `SELECT COALESCE(bt.return_date, bt.borrow_date) as date_field, bt.status, b.title, u.first_name, u.last_name 
                          FROM BORROW_TRANSACTION bt 
                          JOIN BOOK_COPY bc ON bt.material_id = bc.material_id
                          JOIN BOOK b ON bc.book_id = b.book_id 
                          JOIN USER u ON bt.user_id = u.user_id 
                          WHERE bt.status IN ('Borrowed', 'Returned')
                          UNION ALL
                          SELECT COALESCE(bt.return_date, bt.borrow_date) as date_field, bt.status, p.title, u.first_name, u.last_name 
                          FROM BORROW_TRANSACTION bt 
                          JOIN PERIODICAL_COPY pc ON bt.material_id = pc.material_id
                          JOIN PERIODICAL p ON pc.periodical_id = p.periodical_id 
                          JOIN USER u ON bt.user_id = u.user_id 
                          WHERE bt.status IN ('Borrowed', 'Returned')`
                });
                historyData = historyRes.rows;
                applyFilters();
            } catch (error) {
                console.error("Error fetching history:", error);
            }
        }

        function renderTable(tbodyId, data, isHistory) {
            const tbody = document.getElementById(tbodyId);
            if (!tbody) return;
            tbody.innerHTML = '';

            if (data.length === 0) {
                const cols = isHistory ? 4 : 3;
                tbody.innerHTML = `<tr><td colspan="${cols}" class="p-4 text-center text-slate-500 italic">No records found.</td></tr>`;
                return;
            }

            data.forEach(item => {
                const row = document.createElement('tr');
                row.className = 'hover:bg-slate-50 transition-colors';
                
                if (isHistory) {
                    const statusColor = item.status === 'Returned' ? 'bg-slate-100 text-slate-600' : 'bg-green-100 text-green-700';
                    row.innerHTML = `
                        <td class="p-4 font-medium text-slate-800">${item.first_name} ${item.last_name}</td>
                        <td class="p-4 text-slate-600">${item.title}</td>
                        <td class="p-4"><span class="px-2 py-1 rounded text-xs font-bold ${statusColor}">${item.status}</span></td>
                        <td class="p-4 text-slate-500">${new Date(item.date_field).toLocaleDateString()}</td>
                    `;
                } else {
                    row.innerHTML = `
                        <td class="p-4 font-medium text-slate-800">${item.first_name} ${item.last_name}</td>
                        <td class="p-4 text-slate-600">${item.title}</td>
                        <td class="p-4 text-red-600 font-bold">${new Date(item.date_field).toLocaleDateString()}</td>
                    `;
                }
                tbody.appendChild(row);
            });
        }

        window.applyFilters = function() {
            const startDate = document.getElementById('filter-start-date').value;
            const endDate = document.getElementById('filter-end-date').value;
            const sortOrder = document.getElementById('history-sort').value; // 'desc' or 'asc'
            
            const isHistory = (typeof window.currentActiveTab !== 'undefined' ? window.currentActiveTab : 'history') === 'history';
            const dataset = isHistory ? historyData : overdueData;
            const tbodyId = isHistory ? 'tbody-history' : 'tbody-overdue';

            let filtered = [...dataset];

            // Filter
            if (startDate || endDate) {
                const start = startDate ? new Date(startDate) : new Date('1900-01-01');
                start.setHours(0,0,0,0);
                const end = endDate ? new Date(endDate) : new Date('2100-01-01');
                end.setHours(23,59,59,999);

                filtered = filtered.filter(item => {
                    const itemDate = new Date(item.date_field);
                    return itemDate >= start && itemDate <= end;
                });
            }

            // Sort
            filtered.sort((a, b) => {
                const dateA = new Date(a.date_field);
                const dateB = new Date(b.date_field);
                return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
            });

            renderTable(tbodyId, filtered, isHistory);
        }

        window.clearFilters = function() {
            document.getElementById('filter-start-date').value = '';
            document.getElementById('filter-end-date').value = '';
            document.getElementById('history-sort').value = 'desc';
            applyFilters();
        }

        async function fetchLoanStats() {
            try {
                // 1. Borrowed Today
                const borrowedRes = await db.execute({
                    sql: "SELECT COUNT(*) as count FROM BORROW_TRANSACTION WHERE borrow_date = DATE('now', '+8 hours') AND status = 'Borrowed'"
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
        window.updateTotal = updateTotal;
    } catch (error) {
        console.error("Failed to initialize admin_loans.js:", error);
        window.showCustomAlert("System Error: Failed to load loans module. " + error.message);
    }
})();