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
                    newScript.appendChild(document.createTextNode(script.innerHTML));
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

// Handle Back/Forward browser buttons
window.addEventListener('popstate', () => {
    // Reload the page to ensure correct state if user goes back
    window.location.reload();
});

document.addEventListener("DOMContentLoaded", () => {
    loadComponent('sidebar-container', '../components/user_sidebar.html');
    loadComponent('topbar-container', '../components/user_topbar.html');
});