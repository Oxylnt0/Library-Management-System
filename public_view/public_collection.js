document.addEventListener('DOMContentLoaded', () => {
    const btnLatest = document.getElementById('btn-latest');
    const btnPopular = document.getElementById('btn-popular');
    
    // Initial Load
    fetchBooks('latest');

    btnLatest.addEventListener('click', () => {
        setActiveTab(btnLatest, btnPopular);
        fetchBooks('latest');
    });

    btnPopular.addEventListener('click', () => {
        setActiveTab(btnPopular, btnLatest);
        fetchBooks('popular');
    });
});

function setActiveTab(activeBtn, inactiveBtn) {
    // Active Styles
    activeBtn.className = "px-4 py-2 bg-[#183B5B] text-[#D6A84A] rounded-full text-sm font-bold shadow-md hover:bg-[#2E5F87] transition-colors";
    
    // Inactive Styles
    inactiveBtn.className = "px-4 py-2 border border-[#D6A84A]/50 bg-white/50 rounded-full text-sm font-bold text-[#183B5B] hover:bg-white transition-colors";
}

async function fetchBooks(sortType) {
    const grid = document.getElementById('collection-grid');
    
    // Show loading skeleton or opacity
    grid.style.opacity = '0.5';

    try {
        const response = await fetch(`http://localhost:3000/api/books/public?sort=${sortType}`);
        const result = await response.json();

        if (result.success) {
            renderBooks(result.data);
        }
    } catch (error) {
        console.error('Error fetching books:', error);
        grid.innerHTML = '<p class="col-span-4 text-center text-red-500">Failed to load collection.</p>';
    } finally {
        grid.style.opacity = '1';
    }
}

function renderBooks(books) {
    const grid = document.getElementById('collection-grid');
    grid.innerHTML = '';

    if (books.length === 0) {
        grid.innerHTML = '<p class="col-span-4 text-center text-slate-500">No books found.</p>';
        return;
    }

    books.forEach(book => {
        const imageUrl = book.image_url || '../assets/book_placeholder.png'; // Fallback image
        
        const card = document.createElement('div');
        card.className = 'group cursor-pointer';
        card.innerHTML = `
            <div class="rounded-xl aspect-[2/3] overflow-hidden shadow-md group-hover:shadow-xl group-hover:-translate-y-1 transition-all bg-slate-200">
                <img src="${imageUrl}" 
                     alt="${book.title}"
                     onerror="this.src='https://placehold.co/200x300?text=No+Cover'"
                     class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
            </div>
            <p class="font-bold text-sm mt-2 text-[#1A202C] group-hover:text-[#D6A84A] transition-colors truncate">${book.title}</p>
        `;
        grid.appendChild(card);
    });
}