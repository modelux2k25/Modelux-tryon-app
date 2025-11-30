// Embed Helper
// This script can be used to programmatically inject the widget
// Usage: Modelux.embed(selector, options);

window.Modelux = {
    embed: function (selector, options) {
        const container = document.querySelector(selector);
        if (!container) {
            console.error('Modelux: Container not found', selector);
            return;
        }

        const productUrl = options.productImage;
        if (!productUrl) {
            console.error('Modelux: productImage option is required');
            return;
        }

        // Assume the widget is hosted at the same origin as this script if loaded from it,
        // or allow passing a baseUrl.
        // For this demo, we'll try to detect the script source or default to current origin if running locally.
        let baseUrl = window.location.origin;

        // Create Iframe
        const iframe = document.createElement('iframe');
        const appUrl = new URL(baseUrl);
        appUrl.searchParams.set('product_image', productUrl);

        iframe.src = appUrl.toString();
        iframe.style.width = '100%';
        iframe.style.height = '600px';
        iframe.style.border = 'none';

        container.innerHTML = '';
        container.appendChild(iframe);
    }
};
