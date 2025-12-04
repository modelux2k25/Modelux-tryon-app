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

    // --- VISUAL RADAR: Auto-detect main product image ---
    let currentMainImageSrc = container.dataset.productImage;

    setInterval(() => {
      // Find all images on the page
      const images = Array.from(document.images);
      let bestCandidate = null;
      let maxArea = 0;

      images.forEach(img => {
        // Ignore images inside the widget itself
        if (container.contains(img)) return;

        // Check visibility and size
        const rect = img.getBoundingClientRect();
        if (rect.width < 200 || rect.height < 200) return; // Too small
        if (rect.top > window.innerHeight || rect.bottom < 0) return; // Not in viewport (optional, maybe we want top of page)

        // Calculate area
        const area = rect.width * rect.height;

        // Simple heuristic: The largest image in the top part of the page is usually the product
        if (area > maxArea) {
          maxArea = area;
          bestCandidate = img;
        }
      });

      if (bestCandidate) {
        // Check if src changed (ignoring query params might be safer, but let's compare full src first)
        // We need to be careful not to trigger on zoom lenses or hidden images
        if (bestCandidate.src !== currentMainImageSrc) {
          // Update!
          console.log('Modelux Radar: Detected new main image:', bestCandidate.src);
          currentMainImageSrc = bestCandidate.src;
          container.dataset.productImage = bestCandidate.src; // This triggers the MutationObserver above!
        }
      }
    }, 1000); // Check every second
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