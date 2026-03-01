// --- 1. DOM ELEMENTS ---
// Make sure these IDs perfectly match the `id="..."` attributes in your admin_add_books.html
const inpDonationId = document.getElementById('inp-donation-id'); // Make sure this is a <input type="hidden">
const inpTitle = document.getElementById('inp-title');
const inpAuthor = document.getElementById('inp-author');
const inpIsbn = document.getElementById('inp-isbn');
const inpCategory = document.getElementById('inp-category');
const inpCopies = document.getElementById('inp-copies');
const inpSource = document.getElementById('inp-source');
const inpImage = document.getElementById('inp-image');

// Controls
const btnSave = document.getElementById('btn-save');
const btnPreview = document.getElementById('btn-preview');

// Preview Image areas
const imgPreview = document.getElementById('img-preview');
const imgPlaceholder = document.getElementById('img-placeholder');


// --- 2. AUTO-FILL LOGIC (FROM URL) ---
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    
    // Check if we arrived here from the "Catalog" button on the Donations page
    if (params.has('donation_id')) {
        console.log("Donation data detected. Auto-filling form...");

        if (inpDonationId) inpDonationId.value = params.get('donation_id');
        if (inpTitle) inpTitle.value = params.get('title') || '';
        if (inpCategory) inpCategory.value = params.get('category') || 'Fiction';
        if (inpCopies) inpCopies.value = params.get('quantity') || 1;
        
        // Set Source to Donated and visually lock it
        if (inpSource) {
            inpSource.value = 'Donated';
            inpSource.disabled = true; // Prevents the librarian from changing it back to Purchased
        }

        updatePreview();
    }
});


// --- 3. PREVIEW LOGIC ---
function updatePreview() {
    // Optional: Add your logic here if you want to preview the book cover image
    console.log("Preview updated.");
}

if (btnPreview) {
    btnPreview.addEventListener('click', (e) => {
        e.preventDefault();
        updatePreview();
    });
}


// --- 4. SAVE LOGIC ---
if (btnSave) {
    btnSave.addEventListener('click', async (event) => {
        event.preventDefault(); // Stop the page from refreshing when clicking submit

        try {
            // Step A: Gather all the data from the form
            const data = {
                donation_id: inpDonationId ? inpDonationId.value : null,
                title: inpTitle.value,
                author: inpAuthor.value,
                isbn: inpIsbn.value,
                category: inpCategory.value,
                quantity: parseInt(inpCopies.value),
                // Because inpSource is disabled, we force it to grab the value directly
                source: inpSource ? inpSource.value : 'Purchased' 
            };

            // Basic Validation Check
            if (!data.title || !data.author) {
                alert("⚠️ Title and Author are required fields!");
                return;
            }

            console.log("Saving Data Payload:", data);

            // Step B: Send to Backend API
            const response = await fetch('http://localhost:3000/api/books/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            // Step C: Handle the Response
            if (result.success) {
                alert("✅ Book Added Successfully!");
                
                // Smart Redirect: 
                // If it was a donation, go back to the pending donations list.
                // If it was just a normal book add, refresh the page for the next book.
                if (data.donation_id) {
                    window.location.href = 'admin_donations.html';
                } else {
                    window.location.reload();
                }
            } else {
                throw new Error(result.message || "Server rejected the request.");
            }

        } catch (error) {
            console.error("Save Failed:", error);
            alert("❌ Error: " + error.message);
        }
    });
}