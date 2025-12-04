(function () {
  // Modelux Widget Loader
  const SCRIPT_ID = 'modelux-widget-script';
  const CONTAINER_CLASS = 'modelux-widget-container';
  // Hardcoded URL for stability
  const BASE_URL = 'https://modelux-tryon-api.onrender.com';

  function loadWidget(container) {
    if (container.dataset.loaded) return;

    const productUrl = container.dataset.productImage;
    if (!productUrl) return;

    console.log('Modelux: Initializing widget for product', productUrl);

    // Create Iframe
    const iframe = document.createElement('iframe');
    const appUrl = new URL(BASE_URL);
    appUrl.searchParams.set('product_image', productUrl);
    // Add timestamp to force cache refresh
    appUrl.searchParams.set('t', Date.now().toString());

    iframe.src = appUrl.toString();
    iframe.style.width = '100%';
    iframe.style.border = 'none';
    iframe.style.overflow = 'hidden';
    iframe.style.minHeight = '800px';
    iframe.scrolling = 'no';

    // Clear loading text
    container.innerHTML = '';
    container.appendChild(iframe);
    container.dataset.loaded = 'true';
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