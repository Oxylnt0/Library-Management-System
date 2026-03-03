// --- 1. DOM ELEMENTS ---
// Make sure these IDs perfectly match the `id="..."` attributes in your admin_add_books.html
const inpDonationId = document.getElementById('inp-donation-id'); // Make sure this is a <input type="hidden">

// Common Fields
const inpTitle = document.getElementById('inp-title');
const inpPublisher = document.getElementById('inp-publisher');
const inpGenre = document.getElementById('inp-genre');
const inpDewey = document.getElementById('inp-dewey');
const inpLocation = document.getElementById('inp-location');
const inpSource = document.getElementById('inp-source');
const inpCondition = document.getElementById('inp-condition');
const inpCopies = document.getElementById('inp-copies');
const inpImage = document.getElementById('inp-image');
const inpType = document.getElementById('inp-type');

// Book-Specific Fields
const inpAuthor = document.getElementById('inp-author');
const inpIsbn = document.getElementById('inp-isbn');
const inpYear = document.getElementById('inp-year');
const inpPages = document.getElementById('inp-pages');
const inpVolume = document.getElementById('inp-volume');
const inpEdition = document.getElementById('inp-edition');
const inpAge = document.getElementById('inp-age');
const inpCategory = document.getElementById('inp-category');

// Periodical-Specific Fields
const inpIssn = document.getElementById('inp-issn');
const inpPublicationDate = document.getElementById('inp-publication-date');
const inpVolumeNo = document.getElementById('inp-volume-no');
const inpIssueNo = document.getElementById('inp-issue-no');
const inpPeriodicalType = document.getElementById('inp-periodical-type');

// Field Group Wrappers for Toggling
const fieldGroupAuthor = document.getElementById('field-group-author');
const fieldGroupIsbn = document.getElementById('field-group-isbn');
const fieldGroupDewey = document.getElementById('field-group-dewey');
const fieldGroupYear = document.getElementById('field-group-year');
const fieldGroupPages = document.getElementById('field-group-pages');
const fieldGroupVolume = document.getElementById('field-group-volume');
const fieldGroupEdition = document.getElementById('field-group-edition');
const fieldGroupAge = document.getElementById('field-group-age');
const fieldGroupCategory = document.getElementById('field-group-category');
const fieldGroupIssn = document.getElementById('field-group-issn');
const fieldGroupPubDate = document.getElementById('field-group-pub-date');
const fieldGroupVolumeNo = document.getElementById('field-group-volume-no');
const fieldGroupIssueNo = document.getElementById('field-group-issue-no');
const fieldGroupPeriodicalType = document.getElementById('field-group-periodical-type');

// Controls
const btnSave = document.getElementById('btn-save');
const btnPreview = document.getElementById('btn-preview');

// Preview Elements
const previewTitle = document.getElementById('preview-title');
const previewAuthor = document.getElementById('preview-author');
const previewPeriodicalDetails = document.getElementById('preview-periodical-details');
const previewGenre = document.getElementById('preview-genre');
const imgPreview = document.getElementById('img-preview');
const imgPlaceholder = document.getElementById('img-placeholder');

// Map Elements
const mapModal = document.getElementById('map-modal');
const btnOpenMap = document.getElementById('open-map-btn');
const btnCloseMap = document.getElementById('close-map-btn');

// --- 2. AUTO-FILL LOGIC (FROM URL) ---
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    
    // Populate Year Dropdown (Current Year down to 1800)
    if (inpYear) {
        const currentYear = new Date().getFullYear();
        for (let i = currentYear; i >= 1800; i--) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = i;
            inpYear.appendChild(option);
        }
    }

    // Initial form state based on material type
    updateFormVisibility();
    if (inpType) {
        inpType.addEventListener('change', () => {
            updateFormVisibility();
            updatePreview();
        });
    }

    // Add live preview listeners to all relevant fields
    const fieldsForPreview = [
        inpTitle, inpAuthor, inpGenre, inpImage, 
        inpVolumeNo, inpIssueNo
    ];
    fieldsForPreview.forEach(field => {
        if (field) field.addEventListener('input', updatePreview);
    });

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

        updateFormVisibility(); // Ensure correct fields are shown for donated item
    }

    // Set initial preview state
    updatePreview();

    // --- MAP LOGIC ---
    if (btnOpenMap && mapModal) {
        // Open Modal
        btnOpenMap.addEventListener('click', () => {
            mapModal.classList.remove('hidden');
        });

        // Close Modal
        if (btnCloseMap) {
            btnCloseMap.addEventListener('click', () => {
                mapModal.classList.add('hidden');
            });
        }

        // Handle Shelf Clicks
        const shelves = document.querySelectorAll('.shelf');
        shelves.forEach(shelf => {
            shelf.addEventListener('click', () => {
                const locationValue = shelf.getAttribute('data-loc');
                if (inpLocation) inpLocation.value = locationValue;
                mapModal.classList.add('hidden');
            });
        });
    }
});

// --- NEW: DYNAMIC FORM VISIBILITY ---
function updateFormVisibility() {
    if (!inpType) return; // Guard against missing element

    const type = inpType.value;
    const isBook = type === 'Book';
    const isPeriodical = type === 'Periodical';

    // Helper to toggle visibility using the 'hidden' Tailwind class
    const toggle = (element, isVisible) => {
        if (element) element.classList.toggle('hidden', !isVisible);
    };

    // Toggle Book fields
    toggle(fieldGroupAuthor, isBook);
    toggle(fieldGroupIsbn, isBook);
    toggle(fieldGroupDewey, isBook);
    toggle(fieldGroupYear, isBook);
    toggle(fieldGroupPages, isBook);
    toggle(fieldGroupVolume, isBook);
    toggle(fieldGroupEdition, isBook);
    toggle(fieldGroupAge, isBook);
    toggle(fieldGroupCategory, isBook);

    // Toggle Periodical fields
    toggle(fieldGroupIssn, isPeriodical);
    toggle(fieldGroupPubDate, isPeriodical);
    toggle(fieldGroupVolumeNo, isPeriodical);
    toggle(fieldGroupIssueNo, isPeriodical);
    toggle(fieldGroupPeriodicalType, isPeriodical);
}

// --- 3. PREVIEW LOGIC ---
function updatePreview() {
    // Common updates
    if (previewTitle) previewTitle.innerText = inpTitle.value || "Material Title";
    if (previewGenre) previewGenre.innerText = inpGenre.value;

    // Image Preview
    const url = inpImage.value.trim();
    if (imgPreview && imgPlaceholder) {
        if (url) {
            imgPreview.src = url;
            imgPreview.classList.remove('hidden');
            imgPlaceholder.classList.add('hidden');
        } else {
            imgPreview.src = "";
            imgPreview.classList.add('hidden');
            imgPlaceholder.classList.remove('hidden');
        }
    }

    // Type-specific updates
    const type = inpType.value;
    if (type === 'Book') {
        if (previewAuthor) previewAuthor.classList.remove('hidden');
        if (previewPeriodicalDetails) previewPeriodicalDetails.classList.add('hidden');
        if (previewAuthor) previewAuthor.innerText = inpAuthor.value || "Author Name";
        if (imgPlaceholder) imgPlaceholder.innerText = '📘';
    } else if (type === 'Periodical') {
        if (previewAuthor) previewAuthor.classList.add('hidden');
        if (previewPeriodicalDetails) previewPeriodicalDetails.classList.remove('hidden');
        
        const vol = inpVolumeNo.value;
        const iss = inpIssueNo.value;
        let detailsText = [];
        if (vol) detailsText.push(`Vol. ${vol}`);
        if (iss) detailsText.push(`No. ${iss}`);
        
        if (previewPeriodicalDetails) {
            previewPeriodicalDetails.innerText = detailsText.join(', ') || "Periodical Details";
        }
        if (imgPlaceholder) imgPlaceholder.innerText = '📰';
    }
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
            const materialType = inpType.value;

            // Step A: Gather all the data from the form
            // This payload is structured to match the database schema from `create_tables.js`
            const data = {
                // Common Fields
                donation_id: (inpDonationId && inpDonationId.value) ? inpDonationId.value : null,
                title: inpTitle.value,
                publisher: inpPublisher.value,
                genre: inpGenre.value,
                status: 'Available', // New items are always available
                location: inpLocation.value,
                total_copies: inpCopies.value ? parseInt(inpCopies.value) : 1,
                available_copies: inpCopies.value ? parseInt(inpCopies.value) : 1,
                image_url: inpImage.value,
                material_type: materialType
            };

            // Add type-specific fields
            if (materialType === 'Book') {
                data.author = inpAuthor.value;
                data.isbn = inpIsbn.value;
                data.dewey_decimal = inpDewey.value;
                data.publication_year = inpYear.value ? parseInt(inpYear.value) : null;
                data.page_count = inpPages.value ? parseInt(inpPages.value) : null;
                data.volume = inpVolume.value;
                data.edition = inpEdition.value;
                data.age_restriction = inpAge.value ? parseInt(inpAge.value) : 0;
                data.book_category = inpCategory.value;
                data.book_source = inpSource.value;
                data.book_condition = inpCondition.value;
            } else if (materialType === 'Periodical') {
                data.issn = inpIssn.value;
                data.publication_date = inpPublicationDate.value;
                data.volume_no = inpVolumeNo.value;
                data.issue_no = inpIssueNo.value;
                data.type = inpPeriodicalType.value; // e.g., 'Magazine', 'Journal'
                data.periodical_source = inpSource.value;
                data.periodical_condition = inpCondition.value;
            }

            // Basic Validation Check
            if (!data.title) {
                alert("⚠️ Material Title is a required field!");
                return;
            }
            if (materialType === 'Book' && !data.author) {
                alert("⚠️ Author is required for Books!");
                return;
            }
            if (materialType === 'Periodical' && !data.issue_no) {
                alert("⚠️ Issue No. is required for Periodicals!");
                return;
            }

            console.log("Saving Data Payload:", data);

            // NOTE: The backend endpoint '/api/books/add' currently only supports adding Books.
            // It will need to be updated to handle `material_type: 'Periodical'` and insert into the PERIODICAL table.
            // Step B: Send to Backend API
            const response = await fetch('http://localhost:3000/api/books/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            // Step C: Handle the Response
            if (result.success) {
                alert(`✅ ${materialType} Added Successfully!`);
                
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