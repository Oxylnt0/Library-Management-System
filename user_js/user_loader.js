async function loadComponent(elementId, filePath) {
    const element = document.getElementById(elementId);
    if (!element) {
        console.error(`ERROR: Element with ID '${elementId}' not found in HTML.`);
        return;
    }

    try {
        const response = await fetch(filePath);
        
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
        }

        const html = await response.text();
        element.innerHTML = html;
        console.log(`Success: Loaded ${filePath}`); // Debug Log 2
        
        if (elementId === 'sidebar-container') {
            highlightActiveLink();
            setupSidebarNavigation();
        } else if (elementId === 'topbar-container') {
            // Initialize rune particles whenever topbar is loaded
            initParticles();
            updateTopbarUserInfo();
        }

    } catch (error) {
        console.error(`FAILED to load component:`, error);
        // Visual fallback so you know it failed
        element.innerHTML = `<div class="p-4 bg-red-100 text-red-700 border border-red-400">Error loading ${filePath}: ${error.message}</div>`;
    }
}

function highlightActiveLink() {
    const currentPage = window.location.pathname.split("/").pop() || "index.html";
    const links = document.querySelectorAll('.nav-link');

    links.forEach(link => {
        const linkPage = link.getAttribute('href');
        if (currentPage === linkPage) {
            link.classList.add('active-book');
        } else {
            link.classList.remove('active-book');
        }
    });
}

function setupSidebarNavigation() {
    const sidebar = document.getElementById('sidebar-container');
    if (!sidebar) return;

    const links = sidebar.querySelectorAll('.nav-link');
    links.forEach(link => {
        link.addEventListener('click', async (e) => {
            e.preventDefault();
            const url = link.getAttribute('href');
            
            if (url && url !== '#' && url !== window.location.pathname.split('/').pop()) {
                await navigateTo(url);
            }
        });
    });
}

async function navigateTo(url) {
    const contentWrapper = document.getElementById('content-wrapper');
    if (!contentWrapper) {
        window.location.href = url; // Fallback if wrapper missing
        return;
    }

    // 1. Start Transition (Fade Out)
    contentWrapper.style.opacity = '0';

    try {
        // 2. Fetch new page content
        const response = await fetch(url);
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const newContent = doc.getElementById('content-wrapper');

        // 3. Wait for fade out to finish (approx 300ms matches duration-300)
        setTimeout(() => {
            if (newContent) {
                // 4. Swap Content
                contentWrapper.innerHTML = newContent.innerHTML;
                
                // Execute scripts in the new content
                const scripts = contentWrapper.querySelectorAll("script");
                scripts.forEach((script) => {
                    const newScript = document.createElement("script");
                    Array.from(script.attributes).forEach((attr) => newScript.setAttribute(attr.name, attr.value));
                    
                    // Wrap inline scripts in an IIFE to prevent global scope pollution and redeclaration errors
                    if (!script.src && script.innerHTML.trim()) {
                        newScript.appendChild(document.createTextNode(`(() => { ${script.innerHTML} })();`));
                    } else {
                        newScript.appendChild(document.createTextNode(script.innerHTML));
                    }
                    
                    script.parentNode.replaceChild(newScript, script);
                });

                // 5. Update URL and State
                window.history.pushState({}, '', url);
                highlightActiveLink();
            } else {
                window.location.href = url;
                return;
            }
            // 7. End Transition (Fade In)
            contentWrapper.style.opacity = '1';
        }, 300);

    } catch (error) {
        console.error('Navigation failed:', error);
        window.location.href = url; // Fallback
    }
}

function initParticles() {
    const container = document.getElementById('particles-container');
    if (!container) return;

    const particleCount = 40;
    const runes = ['ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ', 'ᚲ', 'ᚷ', 'ᚹ', 'ᚺ', 'ᚾ', 'ᛁ', 'ᛃ', 'ᛈ', 'ᛇ', 'ᛉ', 'ᛊ', 'ᛏ', 'ᛒ', 'ᛖ', 'ᛗ', 'ᛚ', 'ᛜ', 'ᛞ', 'ᛟ'];

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'enchant-particle';
        particle.textContent = runes[Math.floor(Math.random() * runes.length)];
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 5 + 's';
        particle.style.fontSize = (Math.random() * 10 + 10) + 'px';
        container.appendChild(particle);
    }
}

async function updateTopbarUserInfo() {
    const userId = localStorage.getItem('userId');
    const userRole = localStorage.getItem('userRole');
    if (!userId) return;

    try {
        const response = await fetch(`http://localhost:3000/api/user/${userId}?role=${userRole}`);
        const result = await response.json();

        if (result.success) {
            const user = result.data;
            localStorage.setItem('userStatus', user.status);
            const topName = document.getElementById('topbar-user-name');
            const topId = document.getElementById('topbar-user-id');
            const topInit = document.getElementById('topbar-user-initials');

            if (topName) topName.textContent = `${user.first_name} ${user.last_name}`;
            if (topId) {
                topId.textContent = userRole === 'guardian' ? `Guardian ID: ${user.user_id}` : `User ID: ${user.user_id}`;
            }
            if (topInit) topInit.textContent = ((user.first_name?.[0] || '') + (user.last_name?.[0] || '')).toUpperCase();

            // Inject Switch Profile Button Globally
            if (localStorage.getItem('guardianSession') && topName) {
                // Inject Active Profile Badge next to the name
                let profileBadge = document.getElementById('global-profile-badge');
                if (!profileBadge) {
                    profileBadge = document.createElement('span');
                    profileBadge.id = 'global-profile-badge';
                    profileBadge.className = 'ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold uppercase rounded border border-green-200 align-middle tracking-wider shadow-sm';
                    topName.appendChild(profileBadge);
                }
                const session = JSON.parse(localStorage.getItem('guardianSession'));
                if (userRole === 'guardian') {
                    profileBadge.innerText = 'Guardian';
                } else {
                    const cIndex = session.children.findIndex(c => c.user_id == userId);
                    profileBadge.innerText = cIndex !== -1 ? `Child ${cIndex + 1}` : 'Child';
                }

                // Automatically unhide the Switch Profile button in the sidebar if it exists on the page
                const switchContainer = document.getElementById('switch-profile-container');
                if (switchContainer) switchContainer.classList.remove('hidden');
            }
        }
    } catch (error) {
        console.error('Error updating topbar:', error);
    }
}

// Handle Back/Forward browser buttons
window.addEventListener('popstate', () => {
    // Reload the page to ensure correct state if user goes back
    window.location.reload();
});

document.addEventListener("DOMContentLoaded", () => {
    loadComponent('sidebar-container', '../components/user_sidebar.html');
    loadComponent('topbar-container', '../components/user_topbar.html');
    
    // Start the idle timeout timer when the page loads
    resetIdleTimeout();
});

window.showCustomAlert = function(message, callback) {
    let alertBox = document.getElementById('custom-alert');
    if (!alertBox) {
        const alertHtml = `
            <div id="custom-alert" class="fixed inset-0 z-[100] hidden flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300">
                <div class="bg-[#fdfbf7] border-2 border-[#D6A84A] rounded-lg p-8 max-w-sm w-full shadow-2xl transform scale-100 transition-transform duration-300 relative overflow-hidden">
                    <div class="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 border-[#183B5B]/20 rounded-tl-lg"></div>
                    <div class="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 border-[#183B5B]/20 rounded-br-lg"></div>
                    <h3 class="text-xl font-bold text-[#183B5B] font-cinzel mb-4 text-center">Notification</h3>
                    <p id="custom-alert-msg" class="text-slate-700 text-center mb-6 font-inter"></p>
                    <div class="flex justify-center">
                        <button id="custom-alert-btn" class="px-6 py-2 bg-[#183B5B] text-[#D6A84A] font-bold font-cinzel rounded hover:bg-[#244D75] transition-colors">
                            Acknowledge
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', alertHtml);
        alertBox = document.getElementById('custom-alert');
    }

    const alertMsg = document.getElementById('custom-alert-msg');
    const alertBtn = document.getElementById('custom-alert-btn');
    
    alertMsg.textContent = message;
    alertBox.classList.remove('hidden');
    
    const newBtn = alertBtn.cloneNode(true);
    alertBtn.parentNode.replaceChild(newBtn, alertBtn);
    
    newBtn.onclick = function() {
        alertBox.classList.add('hidden');
        if (callback) callback();
    }
};

// --- GLOBAL PROFILE SWITCHER LOGIC ---
window.openProfileSwitcher = function() {
    const sessionRaw = localStorage.getItem('guardianSession');
    if (!sessionRaw) return;
    
    const session = JSON.parse(sessionRaw);
    
    let modal = document.getElementById('dashboard-profile-modal');
    if (!modal) {
        const modalHtml = `
            <div id="dashboard-profile-modal" style="z-index: 120;" class="fixed inset-0 hidden flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-300">
                <div class="bg-[#fdfbf7] border-2 border-[#D6A84A] rounded-xl shadow-2xl w-full max-w-md p-8 relative">
                    <h3 class="text-2xl font-bold text-[#183B5B] font-cinzel mb-2 text-center">Switch Profile</h3>
                    <p class="text-slate-600 text-sm text-center mb-6">Who is using the library right now?</p>
                    <div id="dashboard-profile-list" class="max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar"></div>
                    <button onclick="document.getElementById('dashboard-profile-modal').classList.add('hidden')" class="w-full mt-6 py-2 text-slate-500 hover:text-[#183B5B] font-bold rounded transition-colors border border-transparent hover:border-[#183B5B]">Cancel / Go Back</button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        modal = document.getElementById('dashboard-profile-modal');
    }

    const list = document.getElementById('dashboard-profile-list');
    list.innerHTML = '';
    const currentUserId = localStorage.getItem('userId');
    const currentUserRole = localStorage.getItem('userRole');

    // Guardian
    const g = session.profile;
    const gInitials = ((g.first_name?.[0] || '') + (g.last_name?.[0] || '')).toUpperCase();
    const gIsActive = (currentUserId == g.guardian_id && currentUserRole === 'guardian');

    list.innerHTML += `
        <div onclick="switchDashboardProfile(${g.guardian_id}, 'guardian', '${(g.first_name || '').replace(/'/g, "\\'")}')" class="flex items-center p-3 rounded-xl border ${gIsActive ? 'border-[#D6A84A] bg-[#D6A84A]/10' : 'border-slate-200 hover:border-[#D6A84A] hover:bg-slate-50 cursor-pointer'} transition-all group mb-3">
            <div class="w-12 h-12 rounded-full bg-[#183B5B] text-[#D6A84A] flex items-center justify-center font-bold text-lg mr-4 ${!gIsActive ? 'group-hover:scale-105 transition-transform' : ''}">${gInitials}</div>
            <div class="flex-1">
                <div class="font-bold text-slate-800">${g.first_name} ${g.last_name} ${gIsActive ? '<span class="text-[10px] text-green-600 bg-green-100 px-2 py-0.5 rounded ml-2">Active</span>' : ''}</div>
                <div class="text-xs text-slate-500 font-mono uppercase tracking-wider">Guardian Account</div>
            </div>
        </div>
    `;

    // Children
    if (session.children && session.children.length > 0) {
        session.children.forEach((child, index) => {
            const cInitials = ((child.first_name?.[0] || '') + (child.last_name?.[0] || '')).toUpperCase();
            const cIsActive = (currentUserId == child.user_id && currentUserRole === 'user');
            list.innerHTML += `
                <div onclick="switchDashboardProfile(${child.user_id}, 'user', '${(child.first_name || '').replace(/'/g, "\\'")}')" class="flex items-center p-3 rounded-xl border ${cIsActive ? 'border-[#D6A84A] bg-[#D6A84A]/10' : 'border-slate-200 hover:border-[#D6A84A] hover:bg-slate-50 cursor-pointer'} transition-all group mb-3">
                    <div class="w-12 h-12 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-lg mr-4 ${!cIsActive ? 'group-hover:scale-105 transition-transform' : ''}">${cInitials}</div>
                    <div class="flex-1">
                        <div class="font-bold text-slate-800">${child.first_name} ${child.last_name} ${cIsActive ? '<span class="text-[10px] text-green-600 bg-green-100 px-2 py-0.5 rounded ml-2">Active</span>' : ''}</div>
                        <div class="text-xs text-slate-500 font-mono uppercase tracking-wider">Child Account ${index + 1}</div>
                    </div>
                </div>
            `;
        });
    }
    modal.classList.remove('hidden');
}

window.switchDashboardProfile = function(id, role, name) {
    localStorage.setItem('userId', id);
    localStorage.setItem('userRole', role);
    localStorage.setItem('userName', name);
    window.location.reload();
}

// --- Session Idle Timeout (3 Minutes) ---
let idleTimeout;
function resetIdleTimeout() {
    const userId = localStorage.getItem('userId');
    if (!userId) return; // Do not apply timeout to guests
    
    clearTimeout(idleTimeout);
    idleTimeout = setTimeout(() => {
        if (window.showCustomAlert) {
            window.showCustomAlert("Your session has expired due to inactivity. Please log in again.", () => {
                localStorage.clear();
                sessionStorage.clear();
                window.location.href = '../public_view/login.html';
            });
        } else {
            alert("Your session has expired due to inactivity. Please log in again.");
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = '../public_view/login.html';
        }
    }, 3 * 60 * 1000); // 3 minutes in milliseconds
}

// Attach activity listeners to reset the timer
['mousemove', 'keydown', 'scroll', 'click', 'touchstart'].forEach(evt => {
    document.addEventListener(evt, resetIdleTimeout, true);
});