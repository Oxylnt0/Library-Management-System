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