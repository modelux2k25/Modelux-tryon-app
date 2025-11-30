(function () {
    // Modelux Widget Loader
    const SCRIPT_ID = 'modelux-widget-script';
    const CONTAINER_CLASS = 'modelux-widget-container';

    function init() {
        // Find all containers
        const containers = document.querySelectorAll('.' + CONTAINER_CLASS);

        containers.forEach(container => {
            if (container.dataset.loaded) return;

            const productUrl = container.dataset.productImage;
            if (!productUrl) return;

            // Determine the base URL (where this script is hosted)
            // If hosted on Render, this will be the Render URL.
            // For now, we assume the script is loaded from the same origin or we can hardcode it.
            // Ideally, the script src tells us the origin.
            let baseUrl = '';
            const scriptTag = document.getElementById(SCRIPT_ID) || document.currentScript;
            if (scriptTag && scriptTag.src) {
                const url = new URL(scriptTag.src);
                baseUrl = url.origin;
            }

            // Create Iframe
            const iframe = document.createElement('iframe');
            // Append product_image param to the URL
            const appUrl = new URL(baseUrl);
            appUrl.searchParams.set('product_image', productUrl);

            iframe.src = appUrl.toString();
            iframe.style.width = '100%';
            iframe.style.border = 'none';
            iframe.style.overflow = 'hidden';
            iframe.style.minHeight = '600px'; // Default height
            iframe.scrolling = 'no';

            container.appendChild(iframe);
            container.dataset.loaded = 'true';

            // Listen for height messages from the app to resize iframe
            // (Requires app to send height messages, which we haven't implemented yet in App.tsx, 
            // but this is standard practice. For now, fixed height.)
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();