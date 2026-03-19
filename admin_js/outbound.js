document.addEventListener('DOMContentLoaded', () => {
    fetchEligibleBooks();

    const form = document.getElementById('outbound-form');
    if (form) {
        form.addEventListener('submit', handleOutboundSubmit);
    }
});

async function fetchEligibleBooks() {
    try {
        const response = await fetch('http://localhost:3000/api/donations/eligible');
        const result = await response.json();

        const list = document.getElementById('eligible-list');
        const noMsg = document.getElementById('no-eligible-msg');

        if (!list) return;

        list.innerHTML = '';

        if (result.success && result.data.length > 0) {
            noMsg.classList.add('hidden');
            result.data.forEach(book => {
                const row = document.createElement('tr');
                row.className = 'hover:bg-slate-50 transition-colors';
                row.innerHTML = `
                    <td class="p-4 font-medium text-slate-800">${book.title}</td>
                    <td class="p-4 text-slate-600">${book.book_category}</td>
                    <td class="p-4 text-slate-500">${new Date(book.date_added).toLocaleDateString()}</td>
                    <td class="p-4 text-right">
                        <button onclick="openOutboundModal(${book.book_id}, '${book.title.replace(/'/g, "\\'")}', '${book.book_category}')" 
                            class="px-3 py-1.5 bg-amber-600 text-white text-xs font-bold rounded hover:bg-amber-700 transition shadow-sm">
                            Donate
                        </button>
                    </td>
                `;
                list.appendChild(row);
            });
        } else {
            noMsg.classList.remove('hidden');
        }
    } catch (error) {
        console.error("Error fetching eligible books:", error);
    }
}

function openOutboundModal(bookId, title, category) {
    document.getElementById('out-book-id').value = bookId;
    document.getElementById('out-book-title').value = title;
    document.getElementById('out-category').value = category;
    document.getElementById('out-recipient').value = ''; // Reset input

    const modal = document.getElementById('outbound-modal');
    if (modal) modal.classList.remove('hidden');
}

function closeOutboundModal() {
    const modal = document.getElementById('outbound-modal');
    if (modal) modal.classList.add('hidden');
}

async function handleOutboundSubmit(e) {
    e.preventDefault();

    const bookId = document.getElementById('out-book-id').value;
    const title = document.getElementById('out-book-title').value;
    const category = document.getElementById('out-category').value;
    const recipient = document.getElementById('out-recipient').value;

    try {
        const response = await fetch('http://localhost:3000/api/donations/outbound', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                book_id: bookId,
                book_title: title,
                category: category,
                recipient_organization: recipient
            })
        });

        const result = await response.json();

        if (result.success) {
            window.showCustomAlert("Donation processed successfully!", () => {
                closeOutboundModal();
                fetchEligibleBooks(); // Refresh table
            });
        } else {
            window.showCustomAlert("Error: " + result.message);
        }
    } catch (error) {
        console.error("Submission error:", error);
        window.showCustomAlert("Failed to process donation.");
    }
}

// Expose functions to window for onclick events
window.openOutboundModal = openOutboundModal;
window.closeOutboundModal = closeOutboundModal;