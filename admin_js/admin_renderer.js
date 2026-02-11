console.log("Admin Dashboard Loaded Successfully");

// Future logic for charts and data loading will go here

// Global Modal Functions for Admin Pages
window.openEditModal = function(button) {
    // In a real app, you would populate the form with data from the row
    const modal = document.getElementById('edit-modal');
    if (modal) modal.classList.remove('hidden');
}

window.openDeleteModal = function(button) {
    const row = button.closest('tr');
    const titleElement = row.querySelector('td:nth-child(2) .font-bold');
    const title = titleElement ? titleElement.innerText : 'this item';
    
    const titleDisplay = document.getElementById('delete-book-title');
    if (titleDisplay) titleDisplay.innerText = title;
    
    const modal = document.getElementById('delete-modal');
    if (modal) modal.classList.remove('hidden');
}

window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('hidden');
}