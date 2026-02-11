import { db } from '../database/db_config.js';

// --- DOM ELEMENTS ---
// 1. Basic Info
const inpTitle = document.getElementById('inp-title');
const inpAuthor = document.getElementById('inp-author');
const inpIsbn = document.getElementById('inp-isbn');

// 2. Publishing
const inpPublisher = document.getElementById('inp-publisher');
const inpYear = document.getElementById('inp-year');
const inpPages = document.getElementById('inp-pages');

// 3. Library Details
const inpGenre = document.getElementById('inp-genre');
const inpDewey = document.getElementById('inp-dewey');
const inpLocation = document.getElementById('inp-location');
const inpAge = document.getElementById('inp-age');

// 4. Inventory
const inpType = document.getElementById('inp-type');
const inpCopies = document.getElementById('inp-copies');
const inpImage = document.getElementById('inp-image');

// Controls
const btnSave = document.getElementById('btn-save');
const btnPreview = document.getElementById('btn-preview');

// Preview Elements
const previewTitle = document.getElementById('preview-title');
const previewAuthor = document.getElementById('preview-author');
const previewGenre = document.getElementById('preview-genre');
const imgPreview = document.getElementById('img-preview');
const imgPlaceholder = document.getElementById('img-placeholder');


// --- PREVIEW LOGIC ---

function updatePreview() {
    previewTitle.innerText = inpTitle.value || "Book Title";
    previewAuthor.innerText = inpAuthor.value || "Author Name";
    previewGenre.innerText = inpGenre.value;

    const url = inpImage.value.trim();
    if (url) {
        imgPreview.src = url;
        imgPreview.classList.remove('hidden');
        imgPlaceholder.classList.add('hidden');
    } else {
        resetImage();
    }
}

function resetImage() {
    imgPreview.src = "";
    imgPreview.classList.add('hidden');
    imgPlaceholder.classList.remove('hidden');
}

imgPreview.addEventListener('error', () => {
    console.warn("Image load failed.");
    if (inpImage.value.trim() === "") resetImage();
});

// Listeners for Live Preview
[inpTitle, inpAuthor, inpGenre, inpImage].forEach(el => el?.addEventListener('input', updatePreview));

if (btnPreview) {
    btnPreview.addEventListener('click', (e) => {
        e.preventDefault();
        updatePreview();
    });
}


// --- SAVE TO DATABASE ---

btnSave.addEventListener('click', async () => {
    // 1. Validate Required Fields
    if (!inpTitle.value || !inpAuthor.value) {
        alert("⚠️ Title and Author are required!");
        return;
    }

    btnSave.innerText = "Saving...";
    btnSave.disabled = true;

    try {
        // 2. Gather Data
        const data = {
            title: inpTitle.value,
            author: inpAuthor.value,
            isbn: inpIsbn.value,
            publisher: inpPublisher.value,
            year: inpYear.value ? parseInt(inpYear.value) : null,
            pages: inpPages.value ? parseInt(inpPages.value) : null,
            genre: inpGenre.value,
            dewey: inpDewey.value,
            location: inpLocation.value,
            age: inpAge.value ? parseInt(inpAge.value) : 0,
            type: inpType.value,
            copies: parseInt(inpCopies.value) || 1,
            image: inpImage.value,
            status: 'Available'
        };

        console.log("Saving Data:", data);

        // 3. Insert into MATERIAL (Parent Table)
        const matResult = await db.execute({
            sql: "INSERT INTO MATERIAL (title, material_type, status) VALUES (?, ?, ?) RETURNING material_id",
            args: [data.title, data.type, data.status]
        });

        const materialId = matResult.rows[0].material_id;

        // 4. Insert into BOOK (Child Table) with ALL fields
        await db.execute({
            sql: `INSERT INTO BOOK (
                title, author, isbn, material_id, 
                publisher, publication_year, page_count, 
                genre, dewey_decimal, location, age_restriction, 
                status, image_url, available_copies, total_copies
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
                data.title, data.author, data.isbn, materialId,
                data.publisher, data.year, data.pages,
                data.genre, data.dewey, data.location, data.age,
                data.status, data.image, data.copies, data.copies
            ]
        });

        alert("✅ Book Added Successfully!");
        window.location.reload(); // Refresh to clear form

    } catch (error) {
        console.error("Save Failed:", error);
        alert("❌ Error saving book: " + error.message);
        btnSave.innerText = "💾 Save to Library";
        btnSave.disabled = false;
    }
});