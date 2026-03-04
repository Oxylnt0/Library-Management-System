let allFines = [];
let fineSettings = [];
let showUnpaidOnly = false;

function initFinesPage() {
    console.log("Admin Fines: Initializing...");
    loadFines();
    loadStats();

    // Search Listener
    const searchInput = document.querySelector('input[placeholder="Search user or transaction..."]');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            filterFines(e.target.value);
        });
    }

    // Filter Button Listener
    const filterBtn = document.getElementById('btn-filter-unpaid');
    if (filterBtn) {
        filterBtn.addEventListener('click', () => {
            toggleUnpaidFilter(filterBtn);
        });
    }
}

// Run initialization immediately if DOM is ready, otherwise wait
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFinesPage);
} else {
    initFinesPage();
}

async function loadFines() {
    const tableBody = document.getElementById('fines-table-body');
    tableBody.innerHTML = '<tr><td colspan="8" class="p-4 text-center text-slate-500">Loading fines...</td></tr>';

    try {
        const [finesRes, settingsRes] = await Promise.all([
            fetch('http://localhost:3000/api/fines'),
            fetch('http://localhost:3000/api/settings/fines')
        ]);

        const result = await finesRes.json();
        const settingsResult = await settingsRes.json();

        if (result.success) {
            allFines = result.data;
            fineSettings = settingsResult.success ? settingsResult.data : [];
            renderFines(allFines);
        } else {
            tableBody.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-red-500">${result.message}</td></tr>`;
        }
    } catch (error) {
        console.error('Error loading fines:', error);
        tableBody.innerHTML = '<tr><td colspan="8" class="p-4 text-center text-red-500">Failed to load data. Ensure server is running.</td></tr>';
    }
}

function renderFines(fines) {
    const tableBody = document.getElementById('fines-table-body');
    tableBody.innerHTML = '';

    let filtered = fines;
    
    // Apply Unpaid Filter
    if (showUnpaidOnly) {
        filtered = filtered.filter(f => f.fine_status === 'Unpaid');
    }

    // Apply Search Filter (if search text exists)
    const searchInput = document.querySelector('input[placeholder="Search user or transaction..."]');
    const term = searchInput ? searchInput.value.toLowerCase() : '';
    
    if (term) {
        filtered = filtered.filter(f => 
            (f.first_name + ' ' + f.last_name).toLowerCase().includes(term) ||
            f.email.toLowerCase().includes(term) ||
            (f.book_title || '').toLowerCase().includes(term) ||
            f.borrow_id.toString().includes(term)
        );
    }

    if (filtered.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" class="p-4 text-center text-slate-500">No records found.</td></tr>';
        return;
    }

    filtered.forEach(fine => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-slate-50 transition-colors border-b border-slate-100';
        
        const statusColor = fine.fine_status === 'Paid' 
            ? 'bg-green-100 text-green-700 border-green-200' 
            : 'bg-red-100 text-red-700 border-red-200';

        const actionBtn = fine.fine_status === 'Unpaid'
            ? `<button onclick="payFine(${fine.fine_id}, ${fine.amount})" class="text-xs font-bold text-white bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded shadow-sm transition-colors">Mark Paid</button>`
            : `<span class="text-xs text-slate-400 font-mono">PAID</span>`;

        let reason = fine.fine_type;
        if (!reason) {
            // Fallback: Check if amount matches a known damage fee in settings (ignoring Overdue types)
            // Using loose equality (==) to handle potential string/number mismatch from DB
            const match = fineSettings.find(s => s.fine_amount == fine.amount && !s.fine_type.toLowerCase().includes('overdue'));
            reason = match ? match.fine_type : 'Overdue Fine';
        }

        const displayDate = fine.return_date || fine.due_date;

        row.innerHTML = `
            <td class="p-4"><input type="checkbox" class="form-checkbox h-4 w-4 text-[#183B5B] rounded border-slate-300"></td>
            <td class="p-4 font-mono text-slate-600">#${fine.borrow_id}</td>
            <td class="p-4">
                <div class="font-bold text-slate-700">${fine.first_name} ${fine.last_name}</div>
                <div class="text-xs text-slate-400">${fine.email}</div>
            </td>
            <td class="p-4 font-bold text-slate-700">₱${fine.amount.toFixed(2)}</td>
            <td class="p-4 text-slate-600 text-xs max-w-[200px] truncate" title="${fine.book_title || 'N/A'}">
                <div class="font-medium text-slate-700">${reason}</div>
                ${fine.book_title ? `<div class="text-[10px] text-slate-400">${fine.book_title}</div>` : ''}
            </td>
            <td class="p-4 text-slate-600">${new Date(displayDate).toLocaleDateString()}</td>
            <td class="p-4">
                <span class="px-2 py-1 rounded-full text-[10px] font-bold uppercase border ${statusColor}">
                    ${fine.fine_status}
                </span>
            </td>
            <td class="p-4 text-right">
                ${actionBtn}
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function filterFines(term) {
    renderFines(allFines);
}

function toggleUnpaidFilter(btn) {
    showUnpaidOnly = !showUnpaidOnly;
    
    // Update Button Visuals
    const span = btn.querySelector('span');
    if (showUnpaidOnly) {
        btn.classList.add('bg-slate-100', 'border-slate-400');
        if(span) span.innerText = '✓';
    } else {
        btn.classList.remove('bg-slate-100', 'border-slate-400');
        if(span) span.innerText = '';
    }
    
    renderFines(allFines);
}

async function payFine(fineId, amount) {
    if (!confirm(`Confirm payment of ₱${amount.toFixed(2)}?`)) return;

    try {
        const response = await fetch('http://localhost:3000/api/fines/pay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fine_id: fineId, amount: amount })
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('Payment recorded successfully!');
            loadFines(); // Refresh table
            loadStats(); // Refresh sidebar
        } else {
            alert('Error: ' + result.message);
        }
    } catch (error) {
        console.error('Payment error:', error);
        alert('Failed to process payment.');
    }
}
window.payFine = payFine; // Expose to global scope for onclick

async function loadStats() {
    try {
        const response = await fetch('http://localhost:3000/api/fines/stats');
        const result = await response.json();

        if (result.success) {
            document.getElementById('unpaid-amount').innerText = `₱${result.unpaidTotal.toFixed(2)}`;
            document.getElementById('unpaid-count').innerText = `${result.unpaidUsers} Users Outstanding`;
            
            document.getElementById('collected-today-amount').innerText = `₱${result.collectedToday.toFixed(2)}`;
            document.getElementById('collected-today-count').innerText = `${result.collectedCount} Transactions`;

            const recentList = document.getElementById('recent-payments-list');
            if (result.recentPayments.length > 0) {
                recentList.innerHTML = result.recentPayments.map(p => `
                    <div class="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <div>
                            <div class="font-bold text-slate-700 text-xs">${p.first_name} ${p.last_name}</div>
                            <div class="text-[10px] text-slate-400">Paid via Cash</div>
                        </div>
                        <div class="font-bold text-green-600 text-sm">+₱${p.fine_amount.toFixed(2)}</div>
                    </div>
                `).join('');
            } else {
                recentList.innerHTML = '<div class="text-xs text-slate-400 italic">No recent payments.</div>';
            }
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}