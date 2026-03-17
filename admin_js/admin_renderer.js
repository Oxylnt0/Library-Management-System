console.log("Admin Dashboard Loaded Successfully");

// --- Auto Logout on Inactivity (15 Minutes) ---
let inactivityTimer;
const INACTIVITY_LIMIT = 15 * 60 * 1000; // 15 minutes in milliseconds

function logoutDueToInactivity() {
    alert("Your session has expired due to 15 minutes of inactivity. Please log in again.");
    localStorage.clear(); // Clear admin session data (adminId, etc.)
    window.location.href = 'admin_login.html';
}

function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(logoutDueToInactivity, INACTIVITY_LIMIT);
}

// Attach listeners to common user interactions to reset the timer
['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(event => 
    document.addEventListener(event, resetInactivityTimer, true)
);

// Initialize the timer immediately on script load
resetInactivityTimer();

// Future logic for charts and data loading will go here

// Global Modal Functions for Admin Pages
window.openEditModal = function(button) {
    // In a real app, you would populate the form with data from the row
    const modal = document.getElementById('edit-modal');
    if (modal) modal.classList.remove('hidden');
}

window.openDetailsModal = function(button) {
    const modal = document.getElementById('details-modal');
    
    // Populate data from data attributes
    if (button.dataset.title) document.getElementById('detail-title').innerText = button.dataset.title;
    if (button.dataset.bookId) document.getElementById('detail-book-id').innerText = button.dataset.bookId;
    if (button.dataset.materialId) document.getElementById('detail-material-id').innerText = button.dataset.materialId;
    if (button.dataset.isbn) document.getElementById('detail-isbn').innerText = button.dataset.isbn;
    if (button.dataset.author) document.getElementById('detail-author').innerText = button.dataset.author;
    if (button.dataset.publisher) document.getElementById('detail-publisher').innerText = button.dataset.publisher;
    if (button.dataset.year) document.getElementById('detail-year').innerText = button.dataset.year;
    if (button.dataset.genre) document.getElementById('detail-genre').innerText = button.dataset.genre;
    if (button.dataset.dewey) document.getElementById('detail-dewey').innerText = button.dataset.dewey;
    if (button.dataset.status) document.getElementById('detail-status').innerText = button.dataset.status;
    if (button.dataset.location) document.getElementById('detail-location').innerText = button.dataset.location;
    if (button.dataset.pages) document.getElementById('detail-pages').innerText = button.dataset.pages;
    if (button.dataset.age) document.getElementById('detail-age').innerText = button.dataset.age;
    if (button.dataset.copies) document.getElementById('detail-copies').innerText = button.dataset.copies;
    if (button.dataset.date) document.getElementById('detail-date').innerText = button.dataset.date;

    if (modal) modal.classList.remove('hidden');
}

window.openDeleteModal = function(button) {
    let title = 'this item';
    
    // Try table row (legacy support)
    const row = button.closest('tr');
    if (row) {
        const titleElement = row.querySelector('td:nth-child(2) .font-bold');
        if (titleElement) title = titleElement.innerText;
    } else {
        // Try card (new grid layout)
        const card = button.closest('.bg-white');
        if (card) {
            const titleElement = card.querySelector('h3');
            if (titleElement) title = titleElement.innerText;
        }
    }
    
    const titleDisplay = document.getElementById('delete-book-title');
    if (titleDisplay) titleDisplay.innerText = title;
    
    const modal = document.getElementById('delete-modal');
    if (modal) modal.classList.remove('hidden');
}

window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('hidden');
}