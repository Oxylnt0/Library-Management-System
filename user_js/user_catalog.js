(() => {
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

        // Sort
        const sortSelect = document.getElementById('sort-select');
        if (sortSelect) {
            const newSortSelect = sortSelect.cloneNode(true);
            sortSelect.parentNode.replaceChild(newSortSelect, sortSelect);
            newSortSelect.addEventListener('change', performSearch);
        }

        // Event Delegation for Dynamic Actions (Kiosk Mode)
        const grid = document.getElementById('book-grid');
        if (grid) {
            grid.addEventListener('click', handleCatalogAction);
        }

        // Add listeners for filters
        document.querySelectorAll('.genre-filter').forEach(cb => {
            cb.addEventListener('change', performSearch);
        });
        document.querySelectorAll('input[name="status"]').forEach(radio => {
            radio.addEventListener('change', performSearch);
        });
        
        const resetBtn = document.getElementById('reset-filters-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                document.querySelectorAll('.genre-filter').forEach(cb => cb.checked = false);
                document.querySelector('input[name="status"][value="All"]').checked = true;
                const searchInput = document.getElementById('search-input');
                if(searchInput) searchInput.value = '';
                performSearch();
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
            console.log("Fetching books from API...");
            const userId = sessionStorage.getItem('userId') || localStorage.getItem('userId');
            const response = await fetch(`http://localhost:3000/api/books?user_id=${userId}`);
            const result = await response.json();
            
            if (!result.success) throw new Error(result.message);
            
            allBooks = result.data;
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
            
            let cardBg = 'bg-white border-slate-200';
            if (book.material_type === 'Periodical') {
                cardBg = 'bg-purple-50 border-purple-200';
            }

            card.className = `${cardBg} rounded-xl shadow-sm border p-4 flex flex-col gap-4 hover:shadow-md transition-shadow group h-full`;

            // Dynamic Action Button Logic
            const available = book.available_copies || 0;
            const total = book.total_copies || 0;
            const userStatus = book.user_transaction_status;
            const userWaitlisted = book.user_is_waitlisted > 0;
            let btnHtml = '';
            
            let statusDotColor = 'bg-green-500';
            if (available === 0) statusDotColor = 'bg-red-500';
            else if (available < 3) statusDotColor = 'bg-amber-500';
            
            const displayStatus = available > 0 ? 'Available' : 'Borrowed';

            if (userStatus === 'Borrowed') {
                // STATE 1: User has actively borrowed the book
                btnHtml = `<button class="w-full py-2.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 text-sm font-semibold cursor-not-allowed shadow-sm" disabled><svg class="w-4 h-4 mr-2 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg> Currently Borrowed</button>`;
            } else if (userStatus === 'Pending') {
                // STATE 2: User has a pending hold (Go to Desk)
                btnHtml = `<button class="w-full py-2.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 text-sm font-semibold cursor-not-allowed shadow-sm" disabled><svg class="w-4 h-4 mr-2 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> Go to Desk</button>`;
            } else if (userWaitlisted) {
                // STATE 1.5: User is on waitlist
                btnHtml = `<button class="w-full py-2.5 rounded-full bg-slate-200 text-slate-500 text-sm font-semibold cursor-not-allowed shadow-sm" disabled><svg class="w-4 h-4 mr-2 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> Waitlisted</button>`;
            } else if (book.material_type === 'Periodical') {
                // STATE FOR PERIODICALS: No request needed, physical access only
                if (available > 0) {
                    btnHtml = `<button class="w-full py-2 rounded-lg bg-slate-50 text-slate-500 border border-slate-200 text-[10px] font-bold cursor-default shadow-sm uppercase tracking-wide leading-tight"><span class="text-[#183B5B]">Available on Shelf</span><br><span class="opacity-70 font-normal">No request needed</span></button>`;
                } else {
                    btnHtml = `<button class="w-full py-2.5 rounded-full bg-slate-200 text-slate-500 text-sm font-semibold cursor-not-allowed shadow-sm" disabled>Currently Unavailable</button>`;
                }
            } else if (available > 0) {
                // STATE 2: Available to borrow (Book)
                btnHtml = `<button onclick="openUserCopiesModal(${book.item_id}, '${book.title.replace(/'/g, "\\'")}')" class="w-full py-2.5 rounded-full bg-[#183B5B] text-[#D6A84A] text-sm font-bold hover:bg-[#2E5F87] transition-colors shadow-sm">See Available Copies</button>`;
            } else {
                // STATE 3: Unavailable, join waitlist
                btnHtml = `<button class="dynamic-action-btn w-full py-2.5 rounded-full bg-[#183B5B] text-[#D6A84A] text-sm font-bold hover:bg-[#2E5F87] transition-colors shadow-sm" data-action="waitlist" data-id="${book.item_id}" data-type="${book.material_type}">Join Waitlist</button>`;
            }

            const authorOrPub = book.material_type === 'Book' ? (book.author || 'Unknown Author') : (book.publisher || 'Unknown Publisher');
            const idLabel = book.isbn || 'No ID';
            const displayGenre = book.genre || 'General';
            const typeBadge = book.material_type === 'Periodical' 
                ? `<span class="bg-purple-50 text-purple-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border border-purple-100">${book.category || 'Periodical'}</span>`
                : `<span class="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border border-blue-100">${displayGenre}</span>`;

            let extraDetails = [];
            if (book.material_type === 'Book') {
                if (book.volume) extraDetails.push(book.volume.toLowerCase().includes('vol') || book.volume.toLowerCase().includes('book') ? book.volume : `Vol. ${book.volume}`);
                if (book.edition) extraDetails.push(book.edition);
            } else {
                if (book.volume) extraDetails.push(book.volume.toLowerCase().includes('vol') ? book.volume : `Vol. ${book.volume}`);
                if (book.edition) extraDetails.push(book.edition.toLowerCase().includes('issue') || book.edition.toLowerCase().includes('no') ? book.edition : `No. ${book.edition}`);
            }
            const extraInfoHtml = extraDetails.length > 0 ? `<p class="text-[11px] font-bold text-[#183B5B]/70 mt-1">${extraDetails.join(' • ')}</p>` : '';

            card.innerHTML = `
                <div class="flex gap-4 flex-1 cursor-pointer" onclick="openBookDetails(${book.item_id}, '${book.material_type}')">
                    <div class="w-24 h-36 bg-slate-200 rounded-lg border flex-shrink-0 flex items-center justify-center text-xs text-slate-400 overflow-hidden relative">
                        <img src="${book.image_url || '../assets/default_book.png'}" 
                            class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            onerror="this.src='https://placehold.co/200x300?text=No+Cover'">
                        ${book.age_restriction ? `<div class="absolute top-1 left-1 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm">${book.age_restriction}+</div>` : ''}
                    </div>
                    <div class="flex-1 min-w-0 flex flex-col">
                        <div class="flex justify-between items-start">
                            <h3 class="font-bold text-slate-800 text-lg leading-tight line-clamp-2 group-hover:text-[#D6A84A] transition-colors" title="${book.title}">${book.title}</h3>
                            <span class="w-2.5 h-2.5 rounded-full ${statusDotColor} shrink-0 mt-1.5 ml-2" title="${displayStatus}"></span>
                        </div>
                        ${extraInfoHtml}
                        <p class="text-sm text-slate-600 mt-1 truncate">${authorOrPub}</p>
                        <p class="text-xs text-slate-400 font-mono mt-0.5 truncate">${idLabel}</p>
                        
                        <div class="mt-auto pt-2 flex flex-wrap gap-2">
                            ${typeBadge}
                        </div>
                    </div>
                </div>
                
                <div class="pt-3 border-t border-slate-100 flex flex-col gap-3 mt-auto">
                    <div class="text-xs text-slate-500 flex items-center justify-between">
                        <span><span class="font-bold text-slate-700">${available}</span> / ${total} Copies Available</span>
                        <button onclick="openBookDetails(${book.item_id}, '${book.material_type}')"
                            class="text-xs font-bold text-[#183B5B] hover:underline">
                            View Details
                        </button>
                    </div>
                    ${btnHtml}
                </div>
            `;
            grid.appendChild(card);
        });
    }

    function performSearch() {
        const input = document.getElementById('search-input');
        const query = input ? input.value.toLowerCase() : '';
        
        // Get Filters
        const checkedGenres = Array.from(document.querySelectorAll('.genre-filter:checked')).map(cb => cb.value);
        const statusFilter = document.querySelector('input[name="status"]:checked')?.value || 'All';
        const sortValue = document.getElementById('sort-select')?.value || 'relevance';
        
        const filtered = allBooks.filter(book => {
            // Search
            const titleMatch = book.title && book.title.toLowerCase().includes(query);
            const authorMatch = book.author && book.author.toLowerCase().includes(query);
            const isbnMatch = book.isbn && book.isbn.includes(query);
            const matchesSearch = !query || titleMatch || authorMatch || isbnMatch;

            // Genre
            const matchesGenre = checkedGenres.length === 0 || checkedGenres.includes(book.genre);

            // Status
            const matchesStatus = statusFilter === 'All' || book.status === statusFilter;

            return matchesSearch && matchesGenre && matchesStatus;
        });

        // Sorting Logic
        if (sortValue === 'title_asc') {
            filtered.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        } else if (sortValue === 'newest') {
            filtered.sort((a, b) => new Date(b.date_added || 0) - new Date(a.date_added || 0));
        }
        
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
    window.openBookDetails = function(itemId, type) {
        console.log("Opening details for item ID:", itemId);
        // Use loose equality (==) to handle string/number mismatches
        const book = allBooks.find(b => b.item_id == itemId && b.material_type == type);
        
        if (!book) {
            console.error("Book not found in local cache");
            return;
        }

        // Populate Text
        setText('modal-title', book.title);
        setText('modal-isbn', book.isbn);
        setText('modal-publisher', book.publisher);
        setText('modal-genre', book.genre);
        setText('modal-category', book.category);
        setText('modal-location', book.location);

        if (type === 'Periodical') {
            setText('modal-author', book.publisher);
            setText('modal-year', 'N/A');
            setText('modal-dewey', 'N/A');
            setText('modal-pages', 'N/A');
        } else {
            setText('modal-author', book.author);
            setText('modal-year', book.year);
            setText('modal-dewey', book.dewey_decimal);
            setText('modal-pages', book.page_count ? `${book.page_count} pages` : 'N/A');
        }

        // Image
        const img = document.getElementById('modal-image');
        if (img) {
            img.src = book.image_url || 'https://via.placeholder.com/300x450?text=No+Cover';
            img.onerror = function() { this.src = 'https://via.placeholder.com/300x450?text=No+Cover'; };
        }

        // Status Badge
        const statusBadge = document.getElementById('modal-status-badge');
        if (statusBadge) {
            const isAvailable = (book.available_copies || 0) > 0;
            statusBadge.innerText = isAvailable ? 'Available' : 'Borrowed';
            statusBadge.className = 'inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset';
            
            if (isAvailable) {
                statusBadge.classList.add('bg-green-50', 'text-green-700', 'ring-green-600/20');
            } else {
                statusBadge.classList.add('bg-yellow-50', 'text-yellow-800', 'ring-yellow-600/20');
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

    // --- COPIES SELECTION LOGIC ---
    window.openUserCopiesModal = async function(bookId, title) {
        const modal = document.getElementById('user-copies-modal');
        const tbody = document.getElementById('user-copies-table-body');
        document.getElementById('user-copies-modal-title').innerText = title;
        
        tbody.innerHTML = '<tr><td colspan="4" class="p-6 text-center text-slate-500"><div class="animate-pulse">Fetching available copies...</div></td></tr>';
        modal.classList.remove('hidden');

        try {
            const response = await fetch(`http://localhost:3000/api/books/${bookId}/copies`);
            const result = await response.json();

            if (!result.success) throw new Error(result.message);

            tbody.innerHTML = '';
            if (result.data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="p-6 text-center text-slate-500 italic">No copies are currently available.</td></tr>';
                return;
            }

            result.data.forEach(copy => {
                tbody.innerHTML += `
                    <tr class="hover:bg-slate-50 transition-colors">
                        <td class="p-3 font-mono text-slate-600">${copy.material_id}</td>
                        <td class="p-3 text-slate-700 font-medium">${copy.condition}</td>
                        <td class="p-3 text-slate-700">${copy.location || 'N/A'}</td>
                        <td class="p-3 text-right">
                            <button onclick="borrowSpecificCopy(${copy.material_id}, this)" class="px-4 py-1.5 bg-[#183B5B] text-[#D6A84A] text-xs font-bold rounded-full hover:bg-[#2E5F87] transition-colors shadow-sm whitespace-nowrap">
                                Hold Copy
                            </button>
                        </td>
                    </tr>
                `;
            });
        } catch (error) {
            tbody.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-red-500">Failed to load copies: ${error.message}</td></tr>`;
        }
    }

    window.closeUserCopiesModal = function() {
        const modal = document.getElementById('user-copies-modal');
        if (modal) modal.classList.add('hidden');
    }

    window.borrowSpecificCopy = async function(materialId, btnElement) {
        const userId = sessionStorage.getItem('userId') || localStorage.getItem('userId');
        if (!userId) {
            alert("Please log in to perform this action.");
            return;
        }

        const originalText = btnElement.innerText;
        btnElement.innerText = "Processing...";
        btnElement.disabled = true;
        btnElement.classList.add('opacity-75', 'cursor-wait');

        try {
            const response = await fetch(`http://localhost:3000/api/borrow/kiosk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ material_id: materialId, user_id: userId })
            });
            
            const result = await response.json();
            
            if (result.success) {
                alert("Hold placed! Please proceed to the front desk within 30 minutes to claim your specific copy.");
                closeUserCopiesModal();
                loadBooks(); // Refresh UI to update counts
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            alert("Failed to hold copy: " + error.message);
            btnElement.innerText = originalText;
            btnElement.disabled = false;
            btnElement.classList.remove('opacity-75', 'cursor-wait');
        }
    }

    // Handle Dynamic Actions (Waitlist)
    async function handleCatalogAction(e) {
        if (!e.target.classList.contains('dynamic-action-btn')) return;

        const btn = e.target;
        const bookId = btn.dataset.id;
        const action = btn.dataset.action;
        const materialType = btn.dataset.type;
        const userId = sessionStorage.getItem('userId') || localStorage.getItem('userId');

        if (!userId) {
            alert("Please log in to perform this action.");
            return;
        }

        // UI Feedback
        const originalText = btn.innerText;
        btn.innerText = "Processing...";
        btn.disabled = true;
        btn.classList.add('opacity-75', 'cursor-wait');

        try {
            const response = await fetch(`http://localhost:3000/api/waitlist`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ book_id: bookId, material_type: materialType, user_id: userId })
            });

            const result = await response.json();

            if (result.success) {
                btn.innerText = "Waitlisted";
                btn.classList.remove('bg-[#183B5B]', 'hover:bg-[#2E5F87]', 'text-[#D6A84A]');
                btn.classList.add('bg-slate-200', 'text-slate-500', 'cursor-not-allowed');

                alert("You have been added to the waitlist.");
                loadBooks(); // Refresh UI
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error("Action error:", error);
            alert("Action failed: " + error.message);
            btn.innerText = originalText;
            btn.disabled = false;
            btn.classList.remove('opacity-75', 'cursor-wait');
        }
    }
})();