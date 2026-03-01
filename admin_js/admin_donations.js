(() => {
    async function fetchPendingDonations() {
    try {
        const response = await fetch('http://localhost:3000/api/donations/pending');
        const result = await response.json();

        const list = document.getElementById('pending-donations-list');
        if (!list) return;

        list.innerHTML = '';

        if (result.success && result.data.length > 0) {
            result.data.forEach(donation => {
                const row = document.createElement('tr');
                row.className = 'hover:bg-slate-50 transition-colors';
                
                // Generate initials for avatar
                const donorName = donation.donor_name || 'Anonymous';
                const initials = donorName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

                row.innerHTML = `
                    <td class="p-4">
                        <div class="flex items-center gap-2">
                            <div class="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">${initials}</div>
                            <div>
                                <div class="font-bold text-slate-800">${donorName}</div>
                                <div class="text-xs text-slate-500">ID: ${donation.donation_id}</div>
                            </div>
                        </div>
                    </td>
                    <td class="p-4">
                        <div class="font-medium text-slate-800">${donation.book_title}</div>
                        <div class="text-xs text-slate-500">${donation.category}</div>
                    </td>
                    <td class="p-4 text-slate-600">${new Date(donation.donation_date).toLocaleDateString()}</td>
                    <td class="p-4 text-right">
                        <button onclick="window.location.href='admin_add_books.html?donation_id=${donation.donation_id}&title=${encodeURIComponent(donation.book_title)}&category=${donation.category}&quantity=${donation.quantity}'" 
                            class="px-3 py-1.5 bg-[#183B5B] text-white text-xs font-bold rounded hover:bg-[#2E5F87] transition shadow-sm">
                            Catalog Item
                        </button>
                    </td>
                `;
                list.appendChild(row);
            });
        }
    } catch (error) {
        console.error("Error fetching donations:", error);
    }
}

    async function fetchDonationStats() {
    try {
        const response = await fetch('http://localhost:3000/api/donations/stats');
        const result = await response.json();

        if (result.success) {
            // Update Counts
            document.getElementById('stat-total-donations').innerText = result.totalBooks;
            document.getElementById('stat-pending-catalog').innerText = result.pendingCount;

            // Update Top Donors
            const donorsList = document.getElementById('top-donors-list');
            if (donorsList) {
                donorsList.innerHTML = '';
                result.topDonors.forEach((donor, index) => {
                    const row = `
                        <div class="flex items-center justify-between">
                            <div class="flex items-center">
                                <div class="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-[10px] mr-2 font-bold text-slate-600">
                                    ${index + 1}
                                </div>
                                <span class="text-sm font-medium text-slate-700 truncate max-w-[120px]" title="${donor.donor_name}">
                                    ${donor.donor_name}
                                </span>
                            </div>
                            <span class="text-xs font-bold text-blue-600">${donor.total_donated} Books</span>
                        </div>
                    `;
                    donorsList.insertAdjacentHTML('beforeend', row);
                });
            }
        }
    } catch (error) {
        console.error("Error fetching donation stats:", error);
    }
}

    // Initialize with a small delay to ensure DOM elements are ready
    setTimeout(() => {
        fetchPendingDonations();
        fetchDonationStats();
    }, 100);
})();