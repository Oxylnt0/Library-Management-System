(() => {
let allAnnouncements = [];

function initAnnouncements() {
loadAnnouncements();

// Re-attach form listener when DOM is reloaded
const form = document.getElementById('announcement-form');
if (form) {
const newForm = form.cloneNode(true);
form.parentNode.replaceChild(newForm, form);

newForm.addEventListener('submit', async (e) => {
e.preventDefault();
const id = document.getElementById('ann-id').value;
const title = document.getElementById('ann-title').value;
const content = document.getElementById('ann-content').value;
const priority = document.getElementById('ann-priority').value;
const status = document.getElementById('ann-status').value;
const valid_until = document.getElementById('ann-valid-until').value;
const admin_id = localStorage.getItem('adminId');

const payload = { title, content, priority, status, valid_until, admin_id };
const url = id ? `http://localhost:3000/api/announcements/${id}` : 'http://localhost:3000/api/announcements';
const method = id ? 'PUT' : 'POST';

try {
const response = await fetch(url, {
method: method,
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(payload)
});
const result = await response.json();

if (result.success) {
closeAnnouncementModal();
loadAnnouncements();
} else {
alert("Error: " + result.message);
}
} catch (e) {
console.error(e);
alert("Failed to save announcement.");
}
});
}
}

window.initAnnouncements = initAnnouncements;

// Initialize immediately
initAnnouncements();

async function loadAnnouncements() {
const tbody = document.getElementById('announcement-table-body');
tbody.innerHTML = `<tr>
    <td colspan="6" class="p-4 text-center text-slate-500">Loading...</td>
</tr>`;

try {
const response = await fetch('http://localhost:3000/api/announcements');
const result = await response.json();

if (result.success) {
allAnnouncements = result.data;
renderTable(allAnnouncements);
} else {
tbody.innerHTML = `<tr>
    <td colspan="6" class="p-4 text-center text-red-500">Error: ${result.message}</td>
</tr>`;
}
} catch (error) {
console.error("Error loading announcements:", error);
tbody.innerHTML = `<tr>
    <td colspan="6" class="p-4 text-center text-red-500">Network Error</td>
</tr>`;
}
}

function renderTable(data) {
const tbody = document.getElementById('announcement-table-body');
tbody.innerHTML = '';

if (data.length === 0) {
tbody.innerHTML = `<tr>
    <td colspan="6" class="p-4 text-center text-slate-400 italic">No announcements found.</td>
</tr>`;
return;
}

data.forEach(item => {
const tr = document.createElement('tr');
tr.className = 'hover:bg-slate-50 transition-colors border-b border-slate-100';

// Priority Badge
let prioBadge = '';
if (item.priority === 'Urgent') prioBadge = `<span
    class="px-2 py-1 rounded text-xs font-bold bg-red-100 text-red-700 border border-red-200">Urgent</span>`;
else if (item.priority === 'High') prioBadge = `<span
    class="px-2 py-1 rounded text-xs font-bold bg-yellow-100 text-yellow-700 border border-yellow-200">High</span>`;
else prioBadge = `<span
    class="px-2 py-1 rounded text-xs font-bold bg-green-100 text-green-700 border border-green-200">Normal</span>`;

// Status Badge
let statusBadge = '';
if (item.status === 'Published') statusBadge = '<span class="text-green-600 font-bold text-xs">● Published</span>';
else if (item.status === 'Draft') statusBadge = '<span class="text-slate-400 font-bold text-xs">○ Draft</span>';
else statusBadge = '<span class="text-slate-400 font-bold text-xs decoration-line-through">Archived</span>';

// Valid Until
const validDate = item.valid_until ? new Date(item.valid_until).toLocaleString() : 'Indefinite';

// Escape for HTML attributes
const safeItem = JSON.stringify(item).replace(/"/g, '&quot;');

const isAssistant = localStorage.getItem('adminRole') === 'Assistant Librarian';

tr.innerHTML = `
<td class="p-4 font-bold text-slate-700">${item.title}</td>
<td class="p-4">${prioBadge}</td>
<td class="p-4">${statusBadge}</td>
<td class="p-4 text-xs text-slate-500 font-mono">${validDate}</td>
<td class="p-4 text-xs text-slate-600">${item.author}</td>
<td class="p-4 text-right flex justify-end gap-2">
    <button ${isAssistant ? 'disabled title="Restricted"' : 'title="Edit"'} onclick='openEditModal(${safeItem})'
        class="text-blue-600 p-1 rounded ${isAssistant ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-50 hover:text-blue-800 transition-colors'}">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z">
            </path>
        </svg>
    </button>
    <button ${isAssistant ? 'disabled title="Restricted"' : 'title="Archive"'} onclick="archiveAnnouncement(${item.announcement_id})"
        class="text-amber-600 p-1 rounded ${isAssistant ? 'opacity-50 cursor-not-allowed' : 'hover:bg-amber-50 hover:text-amber-700 transition-colors'}">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4">
            </path>
        </svg>
    </button>
</td>
`;
tbody.appendChild(tr);
});
}

// Modal Functions
window.openAnnouncementModal = function() {
document.getElementById('announcement-form').reset();
document.getElementById('ann-id').value = '';
document.getElementById('modal-title').innerText = 'New Announcement';
document.getElementById('announcement-modal').classList.remove('hidden');
}

window.openEditModal = function(item) {
document.getElementById('ann-id').value = item.announcement_id;
document.getElementById('ann-title').value = item.title;
document.getElementById('ann-content').value = item.content;
document.getElementById('ann-priority').value = item.priority;
document.getElementById('ann-status').value = item.status;

// Format datetime-local: YYYY-MM-DDTHH:MM
if (item.valid_until) {
const d = new Date(item.valid_until);
const iso = d.toISOString().slice(0, 16); // Cut off seconds/ms
document.getElementById('ann-valid-until').value = iso;
} else {
document.getElementById('ann-valid-until').value = '';
}

document.getElementById('modal-title').innerText = 'Edit Announcement';
document.getElementById('announcement-modal').classList.remove('hidden');
}

window.closeAnnouncementModal = function() {
document.getElementById('announcement-modal').classList.add('hidden');
}

window.archiveAnnouncement = async function(id) {
if (!confirm("Are you sure you want to archive this announcement?")) return;
try {
const response = await fetch(`http://localhost:3000/api/announcements/${id}`, { method: 'DELETE' });
const result = await response.json();
if (result.success) {
loadAnnouncements();
} else {
alert("Error: " + result.message);
}
} catch (e) { alert("Network Error"); }
}

})();