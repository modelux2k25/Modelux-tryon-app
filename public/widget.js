(function () {
  // Modelux Widget Loader
  const SCRIPT_ID = 'modelux-widget-script';
  const CONTAINER_CLASS = 'modelux-widget-container';
  // Hardcoded URL for stability
  const BASE_URL = 'https://modelux-tryon-api.onrender.com';

  function loadWidget(container) {
    // Prevent double initialization
    if (container.dataset.widgetInitialized) return;
    container.dataset.widgetInitialized = 'true';

    const renderIframe = () => {
      const productUrl = container.dataset.productImage;
      if (!productUrl) return;

      console.log('Modelux: Loading/Updating widget for product', productUrl);

      let iframe = container.querySelector('iframe');
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.style.width = '100%';
        iframe.style.border = 'none';
        iframe.style.overflow = 'hidden';
        iframe.style.minHeight = '800px';
        iframe.scrolling = 'no';
        container.appendChild(iframe);
      }

      const appUrl = new URL(BASE_URL);
      appUrl.searchParams.set('product_image', productUrl);
      // Add timestamp to force cache refresh and ensure unique load
      appUrl.searchParams.set('t', Date.now().toString());

      iframe.src = appUrl.toString();
    };

    // Initial render
    renderIframe();

    // Watch for changes in data-product-image attribute
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-product-image') {
          renderIframe();
        }
      });
    });

    observer.observe(container, { attributes: true });
  }

  function init() {
    // 1. Load existing containers
    document.querySelectorAll('.' + CONTAINER_CLASS).forEach(loadWidget);

    // 2. Watch for new containers (MutationObserver)
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) { // Element node
            if (node.classList && node.classList.contains(CONTAINER_CLASS)) {
              loadWidget(node);
            } else if (node.querySelector) {
              // Check children
              node.querySelectorAll('.' + CONTAINER_CLASS).forEach(loadWidget);
            }
          }
        });
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();