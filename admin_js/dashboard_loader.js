// Keep track of loaded external scripts to prevent redeclaration errors
window.loadedScripts = window.loadedScripts || new Set();

// Function to load HTML components
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
        
        // Execute scripts in the loaded component
        const scripts = Array.from(element.querySelectorAll('script'));
        
        scripts.forEach((oldScript) => {
            const src = oldScript.getAttribute('src');
            if (src) {
                // Skip external scripts if they have already been loaded once
                if (window.loadedScripts.has(src)) {
                    oldScript.parentNode.removeChild(oldScript);
                    return;
                }
                window.loadedScripts.add(src);
            }

            const newScript = document.createElement('script');
            Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
            
            // Wrap inline scripts in an IIFE to prevent global scope pollution
            if (!src && oldScript.innerHTML.trim()) {
                newScript.appendChild(document.createTextNode(`(() => { ${oldScript.innerHTML} })();`));
            } else {
                newScript.appendChild(document.createTextNode(oldScript.innerHTML));
            }
            
            oldScript.parentNode.replaceChild(newScript, oldScript);
        });
        
        if (elementId === 'sidebar-container') {
            highlightActiveLink();
            setupSidebarNavigation();
        }

    } catch (error) {
        console.error(`FAILED to load component:`, error);
        element.innerHTML = `<div class="p-4 bg-red-100 text-red-700 border border-red-400">Error loading ${filePath}: ${error.message}</div>`;
    }
}

// Function to highlight the current page in Sidebar
function highlightActiveLink() {
    const currentPage = window.location.pathname.split("/").pop() || "admin_dashboard.html"; // Default to dashboard
    const links = document.querySelectorAll('.nav-link');

    links.forEach(link => {
        const linkPage = link.getAttribute('href');
        
        let isActive = currentPage === linkPage;
        if (linkPage === 'admin_donations.html' && (currentPage === 'inbound.html' || currentPage === 'outbound.html')) {
            isActive = true;
        }

        if (isActive) {
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
                
                // Re-execute scripts in the new content
                const scripts = Array.from(contentWrapper.querySelectorAll('script'));
                
                scripts.forEach((oldScript) => {
                    const src = oldScript.getAttribute('src');
                    if (src) {
                        if (window.loadedScripts.has(src)) {
                            oldScript.parentNode.removeChild(oldScript);
                            return;
                        }
                        window.loadedScripts.add(src);
                    }

                    const newScript = document.createElement('script');
                    Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                    
                    // Wrap inline scripts in an IIFE
                    if (!src && oldScript.innerHTML.trim()) {
                        newScript.appendChild(document.createTextNode(`(() => { ${oldScript.innerHTML} })();`));
                    } else {
                        newScript.appendChild(document.createTextNode(oldScript.innerHTML));
                    }
                    
                    oldScript.parentNode.replaceChild(newScript, oldScript);
                });

                // 5. Update URL and State
                window.history.pushState({}, '', url);
                highlightActiveLink();
                
            } else {
                // Fallback if new page doesn't have content-wrapper
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

// Handle Back/Forward browser buttons
window.addEventListener('popstate', () => {
    window.location.reload();
});

document.addEventListener("DOMContentLoaded", () => {
    loadComponent('sidebar-container', '../components/sidebar.html');
    loadComponent('topbar-container', '../components/topbar.html');
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

window.showCustomConfirm = function(message, onConfirm) {
    let confirmBox = document.getElementById('custom-confirm');
    if (!confirmBox) {
        const confirmHtml = `
            <div id="custom-confirm" class="fixed inset-0 z-[100] hidden flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300">
                <div class="bg-[#fdfbf7] border-2 border-[#D6A84A] rounded-lg p-8 max-w-sm w-full shadow-2xl transform scale-100 transition-transform duration-300 relative overflow-hidden">
                    <div class="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 border-[#183B5B]/20 rounded-tl-lg"></div>
                    <div class="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 border-[#183B5B]/20 rounded-br-lg"></div>
                    <h3 class="text-xl font-bold text-[#183B5B] font-cinzel mb-4 text-center">Confirmation</h3>
                    <p id="custom-confirm-msg" class="text-slate-700 text-center mb-6 font-inter"></p>
                    <div class="flex justify-center gap-4">
                        <button id="custom-confirm-cancel" class="px-4 py-2 bg-slate-200 text-slate-700 font-bold font-cinzel rounded hover:bg-slate-300 transition-colors shadow-sm">
                            Cancel
                        </button>
                        <button id="custom-confirm-ok" class="px-4 py-2 bg-[#183B5B] text-[#D6A84A] font-bold font-cinzel rounded hover:bg-[#244D75] transition-colors shadow-sm">
                            Confirm
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', confirmHtml);
        confirmBox = document.getElementById('custom-confirm');
    }

    document.getElementById('custom-confirm-msg').textContent = message;
    confirmBox.classList.remove('hidden');

    const okBtn = document.getElementById('custom-confirm-ok');
    const cancelBtn = document.getElementById('custom-confirm-cancel');
    
    const newOkBtn = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);
    const newCancelBtn = cancelBtn.cloneNode(true);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    newOkBtn.onclick = function() { confirmBox.classList.add('hidden'); if (onConfirm) onConfirm(); };
    newCancelBtn.onclick = function() { confirmBox.classList.add('hidden'); };
};