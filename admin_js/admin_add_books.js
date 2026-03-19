// --- 1. DOM ELEMENTS ---
// Make sure these IDs perfectly match the `id="..."` attributes in your admin_add_books.html
const inpDonationId = document.getElementById('inp-donation-id'); // Make sure this is a <input type="hidden">

// Common Fields
const inpTitle = document.getElementById('inp-title');
const inpPublisher = document.getElementById('inp-publisher');
const inpGenre = document.getElementById('inp-genre');
const inpDewey = document.getElementById('inp-dewey');
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
const fieldGroupVolume = document.getElementById('field-group-volume');
const fieldGroupEdition = document.getElementById('field-group-edition');
const fieldGroupCategory = document.getElementById('field-group-category');
const fieldGroupIssn = document.getElementById('field-group-issn');
const fieldGroupPubDate = document.getElementById('field-group-pub-date');
const fieldGroupVolumeNo = document.getElementById('field-group-volume-no');
const fieldGroupIssueNo = document.getElementById('field-group-issue-no');
const fieldGroupPeriodicalType = document.getElementById('field-group-periodical-type');

// Controls
const btnSave = document.getElementById('btn-save');
const btnPreview = document.getElementById('btn-preview');
const btnApplyAll = document.getElementById('btn-apply-all');

// Preview Elements
const previewTitle = document.getElementById('preview-title');
const previewAuthor = document.getElementById('preview-author');
const previewPeriodicalDetails = document.getElementById('preview-periodical-details');
const previewGenre = document.getElementById('preview-genre');
const imgPreview = document.getElementById('img-preview');
const imgPlaceholder = document.getElementById('img-placeholder');


// --- DYNAMIC COPIES LOGIC ---
function renderCopyRows() {
    const container = document.getElementById('copies-container');
    if (!container) return;
    const count = parseInt(inpCopies.value) || 1;
    const currentRows = container.children.length;
    
    const isDonation = inpDonationId && inpDonationId.value;

    if (count > currentRows) {
        for (let i = currentRows + 1; i <= count; i++) {
            const row = document.createElement('div');
            row.className = 'copy-row grid grid-cols-12 gap-2 bg-white p-2 rounded-lg border border-slate-200 items-center shadow-sm';
            row.innerHTML = `
                <div class="col-span-2 text-xs font-bold text-slate-500 text-center uppercase">Copy ${i}</div>
                <div class="col-span-3">
                    <select class="copy-condition w-full p-1.5 rounded bg-slate-50 border border-slate-200 text-xs outline-none focus:border-[#3E2723]">
                        <option value="New">New</option>
                        <option value="Moderate Damage">Moderate Damage</option>
                        <option value="Severe Damage">Severe Damage</option>
                    </select>
                </div>
                <div class="col-span-4">
                    <select class="copy-location w-full p-1.5 rounded bg-slate-50 border border-slate-200 text-[10px] outline-none focus:border-[#3E2723]">
                        <optgroup label="Specialized">
                            <option value="Front Desk">Front Desk</option>
                            <option value="REF-1: General Reference">REF-1: General Reference</option>
                            <option value="PER-1: Periodicals & News">PER-1: Periodicals & News</option>
                        </optgroup>
                        <optgroup label="Non-Fiction & Textbooks">
                            <option value="Shelf NF-1: (000-099) Computer Science, Information & General Works">Shelf NF-1: (000-099) Comp Sci & Info</option>
                            <option value="Shelf NF-2: (100-199) Philosophy & Psychology">Shelf NF-2: (100-199) Philosophy & Psych</option>
                            <option value="Shelf NF-3: (200-299) Religion">Shelf NF-3: (200-299) Religion</option>
                            <option value="Shelf NF-4: (300-399) Social Sciences">Shelf NF-4: (300-399) Social Sciences</option>
                            <option value="Shelf NF-5: (400-499) Language">Shelf NF-5: (400-499) Language</option>
                            <option value="Shelf NF-6: (500-599) Science">Shelf NF-6: (500-599) Science</option>
                            <option value="Shelf NF-7: (600-699) Technology & Medicine">Shelf NF-7: (600-699) Tech & Med</option>
                            <option value="Shelf NF-8: (700-799) Arts & Recreation">Shelf NF-8: (700-799) Arts & Rec</option>
                            <option value="Shelf NF-9: (800-899) Literature">Shelf NF-9: (800-899) Literature</option>
                            <option value="Shelf NF-10: (900-999) History & Geography">Shelf NF-10: (900-999) History & Geo</option>
                        </optgroup>
                        <optgroup label="Fiction">
                            <option value="Shelf FIC-A: Fiction (A-H)">Shelf FIC-A: Fiction (A-H)</option>
                            <option value="Shelf FIC-B: Fiction (I-P)">Shelf FIC-B: Fiction (I-P)</option>
                            <option value="Shelf FIC-C: Fiction (Q-Z)">Shelf FIC-C: Fiction (Q-Z)</option>
                        </optgroup>
                    </select>
                </div>
                <div class="col-span-3">
                    <select class="copy-source w-full p-1.5 rounded bg-slate-50 border border-slate-200 text-xs outline-none focus:border-[#3E2723]" ${isDonation ? 'disabled' : ''}>
                        ${isDonation ? '<option value="Donated">Donated</option>' : '<option value="Purchased">Purchased</option>'}
                    </select>
                </div>
            `;
            container.appendChild(row);
        }
    } else if (count < currentRows) {
        for (let i = currentRows; i > count; i--) {
            container.removeChild(container.lastChild);
        }
    }

    if (btnApplyAll) {
        btnApplyAll.classList.toggle('hidden', count <= 1);
    }
}

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

    // Retain previous material type selection if present in URL
    if (params.has('type') && inpType) {
        inpType.value = params.get('type');
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
    
    // Dynamic Copies Listener
    if (inpCopies) inpCopies.addEventListener('input', renderCopyRows);

    // Check if we arrived here from the "Catalog" button on the Donations page
    if (params.has('donation_id')) {
        console.log("Donation data detected. Auto-filling form...");

        if (inpDonationId) inpDonationId.value = params.get('donation_id');
        if (inpTitle) inpTitle.value = params.get('title') || '';
        if (inpCategory) inpCategory.value = params.get('category') || 'Fiction';
        if (inpCopies) inpCopies.value = params.get('quantity') || 1;
        
        renderCopyRows();
        
        updateFormVisibility(); // Ensure correct fields are shown for donated item
    } else {
        renderCopyRows(); // Initial render for 1 copy
    }

    // Set initial preview state
    updatePreview();
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
    toggle(fieldGroupVolume, isBook);
    toggle(fieldGroupEdition, isBook);
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

// --- DUPLICATE 1ST COPY LOGIC ---
if (btnApplyAll) {
    btnApplyAll.addEventListener('click', () => {
        const copyRows = document.querySelectorAll('.copy-row');
        if (copyRows.length <= 1) return;

        const firstCondition = copyRows[0].querySelector('.copy-condition').value;
        const firstLocation = copyRows[0].querySelector('.copy-location').value;
        const firstSource = copyRows[0].querySelector('.copy-source').value;

        for (let i = 1; i < copyRows.length; i++) {
            copyRows[i].querySelector('.copy-condition').value = firstCondition;
            copyRows[i].querySelector('.copy-location').value = firstLocation;
            copyRows[i].querySelector('.copy-source').value = firstSource;
        }
    });
}

// --- 4. SAVE LOGIC ---
if (btnSave) {
    btnSave.addEventListener('click', async (event) => {
        event.preventDefault(); // Stop the page from refreshing when clicking submit

        try {
            const materialType = inpType.value;

            // Gather Copy Rows Data
            const copyRows = document.querySelectorAll('.copy-row');
            const copiesData = [];
            copyRows.forEach(row => {
                copiesData.push({
                    condition: row.querySelector('.copy-condition').value,
                    location: row.querySelector('.copy-location').value,
                    source: row.querySelector('.copy-source').value
                });
            });

            if (copiesData.length === 0) {
                window.showCustomAlert("⚠️ Please add at least one copy in the Physical Inventory section.");
                return;
            }

            // Step A: Gather all the data from the form
            const data = {
                // Common Fields
                donation_id: (inpDonationId && inpDonationId.value) ? inpDonationId.value : null,
                title: inpTitle.value,
                publisher: inpPublisher.value,
                genre: inpGenre.value,
                image_url: inpImage.value,
                material_type: materialType,
                copiesData: copiesData,
                page_count: inpPages.value ? parseInt(inpPages.value) : 0,
                age_restriction: inpAge.value ? parseInt(inpAge.value) : 0
            };

            // Add type-specific fields
            if (materialType === 'Book') {
                data.author = inpAuthor.value;
                data.isbn = inpIsbn.value;
                data.dewey_decimal = inpDewey.value;
                data.publication_year = inpYear.value ? parseInt(inpYear.value) : null;
                data.volume = inpVolume.value;
                data.edition = inpEdition.value;
                data.book_category = inpCategory.value;
            } else if (materialType === 'Periodical') {
                data.issn = inpIssn.value;
                data.publication_date = inpPublicationDate.value;
                data.volume_no = inpVolumeNo.value;
                data.issue_no = inpIssueNo.value;
                data.type = inpPeriodicalType.value; // e.g., 'Magazine', 'Journal'
            }

            // Basic Validation Check
            if (!data.title) {
                window.showCustomAlert("⚠️ Material Title is a required field!");
                return;
            }
            if (materialType === 'Book' && !data.author) {
                window.showCustomAlert("⚠️ Author is required for Books!");
                return;
            }
            if (materialType === 'Periodical' && !data.issue_no) {
                window.showCustomAlert("⚠️ Issue No. is required for Periodicals!");
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
                window.showCustomAlert(`✅ ${materialType} Added Successfully!`, () => {
                    // Smart Redirect
                    if (data.donation_id) {
                        window.location.href = 'admin_donations.html';
                    } else {
                        window.location.href = `admin_add_books.html?type=${materialType}`;
                    }
                });
            } else {
                throw new Error(result.message || "Server rejected the request.");
            }

        } catch (error) {
            console.error("Save Failed:", error);
            window.showCustomAlert("❌ Error: " + error.message);
        }
    });
}