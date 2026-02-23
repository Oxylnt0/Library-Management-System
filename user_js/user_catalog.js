const path = require('path');
const { db } = require(path.join(__dirname, '../db_config.js'));

// State to track current filter values
let currentFilters = {
    search: '',
    categories: [], // e.g., ['000', '100']
    status: 'All',  // 'All', 'Available', 'Borrowed'
    yearFrom: null,
    yearTo: null,
    sortBy: 'Relevance'
};

function initCatalog() {
    console.log("📖 User Catalog Script Initialized");
    initializeFilters();
    loadBooks();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCatalog);
} else {
    initCatalog();
}

function initializeFilters() {
    // --- Search ---
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    
    if (searchBtn && searchInput) {
        searchBtn.addEventListener('click', () => {
            currentFilters.search = searchInput.value;
            loadBooks();
        });
        
        searchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                currentFilters.search = searchInput.value;
                loadBooks();
            }
        });
    }

    // --- Categories (Dewey Decimal) ---
    const categoryCheckboxes = document.querySelectorAll('.category-filter');
    categoryCheckboxes.forEach(cb => {
        cb.addEventListener('change', () => {
            currentFilters.categories = Array.from(categoryCheckboxes)
                .filter(c => c.checked)
                .map(c => c.value);
            loadBooks();
        });
    });

    // --- Availability ---
    const statusRadios = document.getElementsByName('status');
    statusRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            currentFilters.status = e.target.value;
            loadBooks();
        });
    });

    // --- Publication Year ---
    const yearFrom = document.getElementById('year-from');
    const yearTo = document.getElementById('year-to');
    
    const handleYearChange = () => {
        currentFilters.yearFrom = yearFrom.value ? parseInt(yearFrom.value) : null;
        currentFilters.yearTo = yearTo.value ? parseInt(yearTo.value) : null;
        loadBooks();
    };

    if (yearFrom) yearFrom.addEventListener('change', handleYearChange);
    if (yearTo) yearTo.addEventListener('change', handleYearChange);

    // --- Sort ---
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            currentFilters.sortBy = e.target.value;
            loadBooks();
        });
    }
    
    // --- Clear Filters ---
    const clearBtn = document.getElementById('clear-filters-btn');
    if(clearBtn) {
        clearBtn.addEventListener('click', () => {
            // Reset UI
            if(searchInput) searchInput.value = '';
            categoryCheckboxes.forEach(c => c.checked = false);
            const allStatus = document.querySelector('input[name="status"][value="All"]');
            if(allStatus) allStatus.checked = true;
            if(yearFrom) yearFrom.value = '';
            if(yearTo) yearTo.value = '';
            if(sortSelect) sortSelect.selectedIndex = 0;
            
            // Reset State
            currentFilters = {
                search: '',
                categories: [],
                status: 'All',
                yearFrom: null,
                yearTo: null,
                sortBy: 'Relevance'
            };
            loadBooks();
        });
    }
}

async function loadBooks() {
    const grid = document.getElementById('book-grid');
    const countEl = document.getElementById('result-count');
    
    if (!grid) return;
    
    grid.innerHTML = '<div class="col-span-full text-center py-10"><p class="text-slate-500">Loading books...</p></div>';

    try {
        let sql = `SELECT * FROM BOOK WHERE 1=1`;
        const args = [];

        // 1. Search Filter
        if (currentFilters.search) {
            sql += ` AND (title LIKE ? OR author LIKE ? OR isbn LIKE ?)`;
            const term = `%${currentFilters.search}%`;
            args.push(term, term, term);
        }

        // 2. Category Filter (Dewey Decimal Ranges)
        if (currentFilters.categories.length > 0) {
            const catConditions = currentFilters.categories.map(cat => {
                const start = parseInt(cat);
                const end = start + 99;
                return `(CAST(dewey_decimal AS INTEGER) BETWEEN ${start} AND ${end})`;
            }).join(' OR ');
            
            if (catConditions) {
                sql += ` AND (${catConditions})`;
            }
        }

        // 3. Status Filter
        if (currentFilters.status !== 'All') {
            if (currentFilters.status === 'Available') {
                sql += ` AND status = 'Available'`;
            } else if (currentFilters.status === 'Borrowed') {
                sql += ` AND status = 'Borrowed'`;
            }
        }

        // 4. Year Filter
        if (currentFilters.yearFrom) {
            sql += ` AND publication_year >= ?`;
            args.push(currentFilters.yearFrom);
        }
        if (currentFilters.yearTo) {
            sql += ` AND publication_year <= ?`;
            args.push(currentFilters.yearTo);
        }

        // 5. Sorting
        if (currentFilters.sortBy === 'Newest Arrivals') {
            sql += ` ORDER BY date_added DESC`;
        } else if (currentFilters.sortBy === 'Title (A-Z)') {
            sql += ` ORDER BY title ASC`;
        } else {
            sql += ` ORDER BY title ASC`;
        }

        console.log("Executing SQL:", sql);
        const result = await db.execute({ sql, args });
        const books = result.rows;
        
        console.log(`Found ${books.length} books`);

        if(countEl) countEl.innerText = books.length;
        renderBooks(books);

    } catch (error) {
        console.error("Error loading books:", error);
        grid.innerHTML = `<div class="col-span-full text-center py-10 text-red-500"><p>Error loading books: ${error.message}</p></div>`;
    }
}

function renderBooks(books) {
    const grid = document.getElementById('book-grid');
    if (!grid) return;
    
    grid.innerHTML = '';

    if (books.length === 0) {
        grid.innerHTML = '<div class="col-span-full text-center py-10"><p class="text-slate-500">No books found matching your criteria.</p></div>';
        return;
    }

    books.forEach(book => {
        const isAvailable = book.status === 'Available';
        const statusColor = isAvailable ? 'emerald' : (book.status === 'Borrowed' ? 'amber' : 'slate');
        const statusText = book.status;
        
        // Use genre or category for the tag
        let category = book.genre || book.book_category || 'General';
        let catColor = 'blue'; 
        
        const card = document.createElement('div');
        card.className = 'group bg-white rounded-2xl overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-slate-100 flex flex-col';
        
        // Image handling with fallback
        let imageHtml = '';
        if (book.image_url) {
            imageHtml = `<img src="${book.image_url}" alt="${book.title}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105">`;
        } else {
            imageHtml = `
                <div class="absolute inset-0 flex items-center justify-center text-slate-400 bg-slate-100">
                    <svg class="w-12 h-12 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                    </svg>
                </div>`;
        }

        card.innerHTML = `
            <div class="aspect-[2/3] bg-slate-200 relative overflow-hidden">
                ${imageHtml}
                <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                    <button class="w-full py-2 bg-[#183B5B] text-white text-xs font-bold rounded-lg shadow-lg hover:bg-[#2E5F87] transition-colors" onclick="viewBookDetails(${book.book_id})">
                        View Details
                    </button>
                </div>
            </div>
            <div class="p-5 flex-1 flex flex-col">
                <div class="mb-2 flex items-center justify-between">
                    <span class="text-[10px] font-bold text-${catColor}-600 uppercase tracking-wider bg-${catColor}-50 px-2 py-1 rounded-md truncate max-w-[120px]">${category}</span>
                </div>
                <h3 class="font-bold text-slate-800 mb-1 leading-tight group-hover:text-blue-600 transition-colors line-clamp-2" title="${book.title}">${book.title}</h3>
                <p class="text-sm text-slate-500 mb-4 truncate">${book.author}</p>

                <div class="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-${statusColor}-50 text-${statusColor}-700 border border-${statusColor}-100">
                        <span class="w-1.5 h-1.5 rounded-full bg-${statusColor}-500"></span>
                        ${statusText}
                    </span>
                    <span class="text-xs text-slate-400 font-medium">${book.publication_year || 'N/A'}</span>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// Global function for the onclick event in HTML
window.viewBookDetails = function(bookId) {
    console.log("View details for book:", bookId);
    alert("View details feature coming soon for book ID: " + bookId);
};