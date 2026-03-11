// --- CONTENT DATA ---
const topbarContent = {
    about: `<div class="space-y-8 text-slate-700 leading-relaxed"><div class="bg-white p-8 rounded-2xl shadow-md border border-slate-100"><h3 class="text-xl font-bold text-[#3E2723] mb-3 font-cinzel">About Puerto Palabra</h3><p>Welcome to Puerto Palabra, which translates to the "Port of Words". Developed at San Sebastian College-Recoletos de Cavite by the Information Technology Department, Puerto Palabra is an Integrated Library Management System designed to modernize public library operations.</p></div><div class="bg-white p-8 rounded-2xl shadow-md border border-slate-100"><h3 class="text-xl font-bold text-[#3E2723] mb-3 font-cinzel">Our Mission</h3><p>Libraries remain vital community institutions that provide the public with access to information, knowledge, and cultural resources. Because traditional operating methods are often fragmented, Puerto Palabra was created to enhance the efficiency, accuracy, and accessibility of library services. By making services more efficient and user-friendly, the system reinforces the role of public libraries as inclusive learning centers and supports equitable access to information.</p></div><div class="bg-white p-8 rounded-2xl shadow-md border border-slate-100"><h3 class="text-xl font-bold text-[#3E2723] mb-3 font-cinzel">What We Offer</h3><ul class="space-y-3 list-disc pl-5"><li><strong class="text-[#D4AF37]">Online Public Access Catalog (OPAC):</strong> Our digital platform allows users to easily search, browse, and check the real-time availability of library materials.</li><li><strong class="text-[#D4AF37]">Structured Organization:</strong> All library resources are organized using the Dewey Decimal System to guarantee accurate cataloging and efficient retrieval.</li><li><strong class="text-[#D4AF37]">Smart QR Transactions:</strong> We utilize QR code technology to ensure quick, secure, and efficient borrowing and returning of library materials.</li><li><strong class="text-[#D4AF37]">Automated Notifications:</strong> The system delivers reliable email notifications for transaction confirmations, due date reminders, and overdue notices.</li><li><strong class="text-[#D4AF37]">Two-Way Donation Program:</strong> We promote the responsible redistribution of resources through a system that accepts book donations from users, while also systematically sending outdated books to other organizations.</li></ul></div></div>`,
    contact: `<div class="grid grid-cols-1 md:grid-cols-3 gap-8 text-center"><div class="bg-white p-8 rounded-2xl shadow-md border border-slate-100"><div class="w-12 h-12 mx-auto bg-[#3E2723]/10 rounded-full flex items-center justify-center mb-4 text-[#3E2723]"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg></div><h3 class="font-bold text-lg text-[#3E2723] mb-2">Address</h3><p class="text-slate-600">123 Library Lane,<br>Puerto Palabra City,<br>Philippines</p></div><div class="bg-white p-8 rounded-2xl shadow-md border border-slate-100"><div class="w-12 h-12 mx-auto bg-[#3E2723]/10 rounded-full flex items-center justify-center mb-4 text-[#3E2723]"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 12.284 3 6V5z" /></svg></div><h3 class="font-bold text-lg text-[#3E2723] mb-2">Phone</h3><p class="text-slate-600">+63 900 000 0000<br>(02) 8123 4567</p></div><div class="bg-white p-8 rounded-2xl shadow-md border border-slate-100"><div class="w-12 h-12 mx-auto bg-[#3E2723]/10 rounded-full flex items-center justify-center mb-4 text-[#3E2723]"><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg></div><h3 class="font-bold text-lg text-[#3E2723] mb-2">Email</h3><p class="text-slate-600">info@puertopalabra.lib<br>support@puertopalabra.lib</p></div></div>`,
    faq: `<div class="space-y-4"><div class="bg-white rounded-xl shadow-sm border border-slate-100 p-6"><h3 class="font-bold text-[#3E2723] text-lg mb-2">What is Puerto Palabra?</h3><p class="text-slate-600 text-sm leading-relaxed">Puerto Palabra, which translates to "Port of Words", is an Integrated Library Management System designed to modernize public library operations. It features an Online Public Access Catalog (OPAC) that allows you to easily search, browse, and check the real-time availability of library materials.</p></div><div class="bg-white rounded-xl shadow-sm border border-slate-100 p-6"><h3 class="font-bold text-[#3E2723] text-lg mb-2">How do I borrow and return books?</h3><p class="text-slate-600 text-sm leading-relaxed">Borrowing and returning materials is fast and easy. Our system utilizes a smart QR code-based transaction module. This technology facilitates accurate and efficient transactions, ensuring secure verification for both borrowing and returning activities.</p></div><div class="bg-white rounded-xl shadow-sm border border-slate-100 p-6"><h3 class="font-bold text-[#3E2723] text-lg mb-2">Can I reserve a book or extend my borrowing time?</h3><p class="text-slate-600 text-sm leading-relaxed">Yes. The system includes a reservation management module that allows users to reserve materials that are currently available or already borrowed. You can also submit requests to extend your borrowing period. Please note that both reservations and extensions are subject to librarian approval.</p></div><div class="bg-white rounded-xl shadow-sm border border-slate-100 p-6"><h3 class="font-bold text-[#3E2723] text-lg mb-2">Will I be reminded when my book is due?</h3><p class="text-slate-600 text-sm leading-relaxed">Yes, you will never have to guess when your materials are due. Puerto Palabra features an automated email notification system. It automatically delivers transaction confirmations, due date reminders, and overdue notices directly to your registered email.</p></div><div class="bg-white rounded-xl shadow-sm border border-slate-100 p-6"><h3 class="font-bold text-[#3E2723] text-lg mb-2">What happens if I return a library material late?</h3><p class="text-slate-600 text-sm leading-relaxed">If a material is not returned on or before its assigned due date, it is marked as overdue. The system has an automated fine management module that automatically calculates penalties for overdue materials based on predefined library policies.</p></div><div class="bg-white rounded-xl shadow-sm border border-slate-100 p-6"><h3 class="font-bold text-[#3E2723] text-lg mb-2">Does the library accept book donations?</h3><p class="text-slate-600 text-sm leading-relaxed">Yes, we strongly encourage community sharing! The library features a Two-Way Donation Management module. We accept inbound donations from users, accommodating both registered users via QR scan and non-registered donors via manual entry.</p></div><div class="bg-white rounded-xl shadow-sm border border-slate-100 p-6"><h3 class="font-bold text-[#3E2723] text-lg mb-2">What happens to old or outdated books in the library?</h3><p class="text-slate-600 text-sm leading-relaxed">To keep our collection fresh and manage our inventory systematically, our Two-Way Donation module also handles outbound donations. Books that have remained in the library collection for five years or older are identified and donated to other libraries or organizations.</p></div></div>`
};

// --- MODAL FUNCTIONS ---
window.openTopbarModal = function(type) {
    const modal = document.getElementById('topbar-modal');
    const panel = document.getElementById('topbar-modal-panel');
    const title = document.getElementById('topbar-modal-title');
    const body = document.getElementById('topbar-modal-body');
    
    if (!modal || !panel || !title || !body) return;

    if (type === 'about') {
        title.textContent = 'About Us';
        body.innerHTML = topbarContent.about;
    } else if (type === 'contact') {
        title.textContent = 'Contact Us';
        body.innerHTML = topbarContent.contact;
    } else if (type === 'faq') {
        title.textContent = 'Frequently Asked Questions';
        body.innerHTML = topbarContent.faq;
    }

    modal.classList.remove('hidden');
    // Small delay for transition
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        panel.classList.remove('scale-95');
        panel.classList.add('scale-100');
    }, 10);
}

window.closeTopbarModal = function() {
    const modal = document.getElementById('topbar-modal');
    const panel = document.getElementById('topbar-modal-panel');
    
    if (!modal || !panel) return;

    modal.classList.add('opacity-0');
    panel.classList.remove('scale-100');
    panel.classList.add('scale-95');
    
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

// Close on click outside (Using document delegation because modal might be added dynamically)
document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'topbar-modal') {
        closeTopbarModal();
    }
});