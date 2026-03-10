document.addEventListener('DOMContentLoaded', () => {
    // Set initial state for history. This allows the back button to work on the first navigation.
    const currentPath = window.location.pathname.substring(window.location.pathname.lastIndexOf('/') + 1) || 'public_view.html';
    window.history.replaceState({ path: currentPath }, document.title, window.location.href);

    // Attach navigation handlers to initial links
    attachNavHandlers(document.body);
});

function attachNavHandlers(scope) {
    scope.querySelectorAll('a.nav-link').forEach(link => {
        // Prevent adding multiple listeners to the same link
        if (link.dataset.navAttached) return;
        link.dataset.navAttached = 'true';

        link.addEventListener('click', (event) => {
            // Allow opening in new tab with Ctrl/Cmd+Click or middle-click
            if (event.metaKey || event.ctrlKey || event.button === 1) {
                return;
            }
            event.preventDefault();
            const url = link.getAttribute('href');
            // Don't navigate if we are already on the page
            if (url && url !== (window.location.pathname.split('/').pop() || 'public_view.html')) {
                navigateTo(url);
            }
        });
    });
}

async function navigateTo(url) {
    const pageContainer = document.getElementById('page-container');
    if (!pageContainer) {
        window.location.href = url; // Fallback for safety
        return;
    }

    pageContainer.style.opacity = '0';

    try {
        const response = await fetch(url);
        if (!response.ok) {
            window.location.href = url;
            return;
        }
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const newPageContainer = doc.getElementById('page-container');
        const newTitle = doc.querySelector('title').innerText;
        const newStyles = doc.querySelectorAll('head style');
        const newBodyClass = doc.body.className;

        setTimeout(() => {
            if (newPageContainer) {
                pageContainer.innerHTML = newPageContainer.innerHTML;
                pageContainer.className = newPageContainer.className;
                document.body.className = newBodyClass;
                document.title = newTitle;
                window.history.pushState({ path: url }, newTitle, url);

                // Remove previously injected styles
                document.querySelectorAll('style[data-loader-injected="true"]').forEach(el => el.remove());

                // Inject new styles
                newStyles.forEach(style => {
                    const newStyle = document.createElement('style');
                    newStyle.textContent = style.textContent;
                    newStyle.setAttribute('data-loader-injected', 'true');
                    document.head.appendChild(newStyle);
                });

                // Re-run scripts from the new content to initialize animations/logic
                Array.from(pageContainer.querySelectorAll('script')).forEach(oldScript => {
                    const newScript = document.createElement('script');
                    Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                    newScript.appendChild(document.createTextNode(oldScript.innerHTML));
                    oldScript.parentNode.replaceChild(newScript, oldScript);
                });

                attachNavHandlers(pageContainer);
            } else {
                window.location.href = url;
            }
            pageContainer.style.opacity = '1';
        }, 500); // This duration should match the CSS transition duration
    } catch (error) {
        console.error('Navigation failed:', error);
        window.location.href = url;
    }
}

// Handle Back/Forward browser buttons using a simple reload for consistency
window.addEventListener('popstate', () => {
    window.location.reload();
});