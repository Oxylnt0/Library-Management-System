(() => {
    const path = require('path');
    const { db } = require(path.join(__dirname, '../db_config.js'));

    let allBooks = [];

    // Initialize
    function initCatalog() {
        loadBooks();

        // Refresh Button
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            // Remove old listeners to prevent duplicates if re-initialized
            const newBtn = refreshBtn.cloneNode(true);
            refreshBtn.parentNode.replaceChild(newBtn, refreshBtn);
            
            newBtn.addEventListener('click', () => {
                newBtn.classList.add('animate-spin');
                loadBooks().then(() => {
                    setTimeout(() => newBtn.classList.remove('animate-spin'), 500);
                });
            });
        }

        // Search
        const searchBtn = document.getElementById('search-btn');
        const searchInput = document.getElementById('search-input');
        
        if (searchBtn && searchInput) {
            // Clone to remove old listeners
            const newSearchBtn = searchBtn.cloneNode(true);
            searchBtn.parentNode.replaceChild(newSearchBtn, searchBtn);
            
            const newSearchInput = searchInput.cloneNode(true);
            searchInput.parentNode.replaceChild(newSearchInput, searchInput);

            newSearchBtn.addEventListener('click', performSearch);
            newSearchInput.addEventListener('keyup', (e) => {
                if (e.key === 'Enter') performSearch();
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCatalog);
    } else {
        initCatalog();
    }

    async function loadBooks() {
        try {
            console.log("Fetching books from database...");
            const result = await db.execute("SELECT * FROM BOOK");
            allBooks = result.rows;
            console.log(`Loaded ${allBooks.length} books.`);
            
            renderBooks(allBooks);
            updateResultCount(allBooks.length);
        } catch (error) {
            console.error("Error loading books:", error);
            const grid = document.getElementById('book-grid');
            if (grid) {
                grid.innerHTML = `
                    <div class="col-span-full text-center py-10">
                        <p class="text-red-500 font-medium">Failed to load books. Please check your connection.</p>
                        <p class="text-xs text-slate-400 mt-2">${error.message}</p>
                    </div>
                `;
            }
        }
    }

    function renderBooks(books) {
        const grid = document.getElementById('book-grid');
        if (!grid) return;
        
        grid.innerHTML = '';

        if (books.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full text-center py-20">
                    <p class="text-slate-400 text-lg">No books found matching your criteria.</p>
                </div>
            `;
            return;
        }

        books.forEach(book => {
            const card = document.createElement('div');
            card.className = 'bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-all duration-300 group flex flex-col h-full';
            
            // Status color logic
            let statusColor = 'bg-emerald-100 text-emerald-700 ring-emerald-600/20';
            if (book.status === 'Borrowed') statusColor = 'bg-amber-100 text-amber-700 ring-amber-600/20';
            if (book.status === 'Lost' || book.status === 'Archived') statusColor = 'bg-slate-100 text-slate-600 ring-slate-500/10';

            // Reserve Button Logic
            const currentUserId = localStorage.getItem('userId');
            let reserveBtn = '';
            if (!currentUserId) {
                reserveBtn = `<button onclick="alert('Please log in to reserve books.')" class="w-full mt-2 py-2.5 rounded-lg bg-slate-200 text-slate-500 text-sm font-semibold hover:bg-slate-300 transition-all shadow-sm">Login to Reserve</button>`;
            } else if (book.status === 'Available') {
                reserveBtn = `<button onclick="reserveBook('${currentUserId}', ${book.book_id}, '${book.status}')" class="w-full mt-2 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-all shadow-sm">Reserve Book</button>`;
            } else if (book.status === 'Borrowed') {
                reserveBtn = `<button onclick="reserveBook('${currentUserId}', ${book.book_id}, '${book.status}')" class="w-full mt-2 py-2.5 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-all shadow-sm">Join Waitlist</button>`;
            }

            card.innerHTML = `
                <div class="relative aspect-[2/3] overflow-hidden bg-slate-100">
                    <img src="${book.image_url || '../assets/default_book.png'}" 
                        alt="${book.title}" 
                        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onerror="this.src='https://via.placeholder.com/150x220?text=No+Cover'">
                    <div class="absolute top-3 right-3">
                        <span class="px-2 py-1 text-xs font-bold rounded-full ${statusColor} backdrop-blur-md bg-opacity-90 shadow-sm ring-1 ring-inset">
                            ${book.status}
                        </span>
                    </div>
                </div>
                <div class="p-5 flex flex-col flex-1">
                    <div class="mb-auto">
                        <h3 class="font-bold text-slate-800 leading-tight mb-1 line-clamp-2 font-cinzel text-lg">${book.title}</h3>
                        <p class="text-sm text-[#2E5F87] font-medium mb-2">${book.author}</p>
                        <div class="flex items-center gap-2 text-xs text-slate-500 mb-4">
                            <span class="bg-slate-100 px-2 py-0.5 rounded">${book.publication_year}</span>
                            <span>•</span>
                            <span class="truncate max-w-[100px]">${book.genre}</span>
                        </div>
                    </div>
                    <button onclick="openBookDetails(${book.book_id})" 
                            class="w-full py-2.5 rounded-lg border border-[#183B5B] text-[#183B5B] text-sm font-semibold hover:bg-[#183B5B] hover:text-white transition-all active:scale-95 shadow-sm">
                        View Details
                    </button>
                    ${reserveBtn}
                </div>
            `;
            grid.appendChild(card);
        });
    }

    function performSearch() {
        const input = document.getElementById('search-input');
        if (!input) return;
        const query = input.value.toLowerCase();
        
        const filtered = allBooks.filter(book => {
            const titleMatch = book.title && book.title.toLowerCase().includes(query);
            const authorMatch = book.author && book.author.toLowerCase().includes(query);
            const isbnMatch = book.isbn && book.isbn.includes(query);
            return titleMatch || authorMatch || isbnMatch;
        });
        
        renderBooks(filtered);
        updateResultCount(filtered.length);
    }

    function updateResultCount(count) {
        const el = document.getElementById('result-count');
        if (el) el.innerText = count;
    }

    function setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.innerText = value || 'N/A';
    }

    // Modal Functions attached to window for HTML access
    window.openBookDetails = function(bookId) {
        console.log("Opening details for book ID:", bookId);
        // Use loose equality (==) to handle string/number mismatches
        const book = allBooks.find(b => b.book_id == bookId);
        
        if (!book) {
            console.error("Book not found in local cache for ID:", bookId);
            return;
        }

        // Populate Text
        setText('modal-title', book.title);
        setText('modal-author', book.author);
        setText('modal-isbn', book.isbn);
        setText('modal-publisher', book.publisher);
        setText('modal-year', book.publication_year);
        setText('modal-genre', book.genre);
        setText('modal-category', book.book_category);
        setText('modal-location', book.location);
        setText('modal-dewey', book.dewey_decimal);
        setText('modal-pages', book.page_count ? `${book.page_count} pages` : 'N/A');

        // Image
        const img = document.getElementById('modal-image');
        if (img) {
            img.src = book.image_url || 'https://via.placeholder.com/300x450?text=No+Cover';
            img.onerror = function() { this.src = 'https://via.placeholder.com/300x450?text=No+Cover'; };
        }

        // Status Badge
        const statusBadge = document.getElementById('modal-status-badge');
        if (statusBadge) {
            statusBadge.innerText = book.status;
            statusBadge.className = 'inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset';
            
            if (book.status === 'Available') {
                statusBadge.classList.add('bg-green-50', 'text-green-700', 'ring-green-600/20');
            } else if (book.status === 'Borrowed') {
                statusBadge.classList.add('bg-yellow-50', 'text-yellow-800', 'ring-yellow-600/20');
            } else {
                statusBadge.classList.add('bg-gray-50', 'text-gray-600', 'ring-gray-500/10');
            }
        }

        // Show Modal
        const modal = document.getElementById('book-modal');
        if (modal) modal.classList.remove('hidden');
    }

    window.closeModal = function() {
        const modal = document.getElementById('book-modal');
        if (modal) modal.classList.add('hidden');
    }

    // Reserve Book Function
    window.reserveBook = async function(userId, bookId, bookStatus) {
        try {
            let priorityNo = 1;

            // Logic: If borrowed, queue up (max + 1). If available, priority is 1.
            if (bookStatus === 'Borrowed') {
                const result = await db.execute({
                    sql: "SELECT MAX(priority_no) as max_p FROM RESERVATION WHERE book_id = ?",
                    args: [bookId]
                });
                const maxP = result.rows[0]?.max_p || 0;
                priorityNo = maxP + 1;
            }

            await db.execute({
                sql: "INSERT INTO RESERVATION (user_id, book_id, status, priority_no) VALUES (?, ?, 'Pending', ?)",
                args: [userId, bookId, priorityNo]
            });
            
            alert("Book successfully reserved! Please show your QR code to the librarian.");
        } catch (error) {
            console.error("Reservation error:", error);
            if (error.message.includes("FOREIGN KEY constraint failed")) {
                alert("Reservation Failed: User ID not found. Please log out and log in again.");
            } else {
                alert("Reservation Failed: " + error.message);
            }
        }
    }
})();