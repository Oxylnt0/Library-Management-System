async function initUserDonations() {
    const listContainer = document.getElementById('donations-list');
    if (!listContainer) return; // Safety check to prevent errors if element is missing
    
    // 1. Get User ID from Local Storage
    // Check for direct userId first (consistent with catalog), then fallback to object
    let userId = sessionStorage.getItem('userId') || localStorage.getItem('userId');
    const userRole = localStorage.getItem('userRole');

    if (!userId) {
        const userStr = localStorage.getItem('library_user') || sessionStorage.getItem('library_user') || localStorage.getItem('user') || sessionStorage.getItem('user');
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                userId = user.user_id;
            } catch (e) { console.error(e); }
        }
    }

    try {
        // 2. Fetch Donations
        const response = await fetch(`http://localhost:3000/api/donations/user/${userId}?role=${userRole}`);
        const result = await response.json();

        if (result.success) {
            renderDonations(result.data);
        } else {
            listContainer.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-red-500">Error: ${result.message}</td></tr>`;
        }

    } catch (error) {
        console.error("Error fetching donations:", error);
        listContainer.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-red-500">Failed to load donations. Server might be down.</td></tr>`;
    }

    function renderDonations(donations) {
        if (donations.length === 0) {
            listContainer.innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-slate-500 italic">You haven't made any donations yet.</td></tr>`;
            return;
        }

        listContainer.innerHTML = donations.map(d => `
            <tr class="hover:bg-white/40 transition-colors group">
                <td class="px-6 py-4 font-bold text-[#1A202C]">${d.book_title}</td>
                <td class="px-6 py-4 text-[#2E5F87]">
                    <span class="px-2 py-1 bg-white/50 rounded text-xs font-bold border border-white/30">${d.category}</span>
                </td>
                <td class="px-6 py-4 text-center font-bold text-[#1A202C]">${d.quantity}</td>
                <td class="px-6 py-4 text-center">
                    <span class="px-2 py-1 rounded-full text-[10px] font-bold ${d.status === 'Cataloged' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}">${d.status}</span>
                </td>
                <td class="px-6 py-4 text-right text-[#1A202C] font-medium">${new Date(d.donation_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
            </tr>
        `).join('');
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUserDonations);
} else {
    initUserDonations();
}