(function () {
  // Modelux Widget Loader
  const SCRIPT_ID = 'modelux-widget-script';
  console.log('Modelux Widget v2.2 Loaded');
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
        iframe.style.minHeight = '950px'; // Increased to fit new fields
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
      const images = Array.from(document.images);
      let bestCandidate = null;
      let maxScore = 0;

      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      images.forEach(img => {
        if (container.contains(img)) return; // Ignore widget images

        // Optimization: Skip getComputedStyle (expensive). Use rect dimensions to infer visibility.
        const rect = img.getBoundingClientRect();

        // Filter: Must be visible (width/height > 0) and at least 80px (to avoid icons)
        if (rect.width < 80 || rect.height < 80) return;

        // Calculate Score based on Area + Centrality
        const area = rect.width * rect.height;

        // Centrality bonus: closer to center of screen = higher score
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const distFromCenter = Math.sqrt(Math.pow(centerX - viewportWidth / 2, 2) + Math.pow(centerY - viewportHeight / 2, 2));

        // Score: Area divided by distance factor (closer is better)
        // We weight area heavily, but use centrality to break ties or ignore sidebars
        // Adding 1 to distance to avoid division by zero
        const score = area / (distFromCenter + 100);

        if (score > maxScore) {
          maxScore = score;
          bestCandidate = img;
        }
      });

      if (bestCandidate) {
        // Use currentSrc if available (for responsive images), otherwise src
        const newSrc = bestCandidate.currentSrc || bestCandidate.src;

        // Only update if it's a valid URL and different
        if (newSrc && newSrc !== currentMainImageSrc && !newSrc.startsWith('data:')) {
          console.log('Modelux Radar: Detected new main image:', newSrc);
          currentMainImageSrc = newSrc;
          container.dataset.productImage = newSrc;

          // Send message to iframe instead of reloading
          const iframe = container.querySelector('iframe');
          if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({
              type: 'PRODUCT_IMAGE',
              payload: newSrc
            }, '*');
          }
        }
      }
    }, 800);

    // Listen for manual update requests from the iframe
    window.addEventListener('message', (event) => {
      if (event.data === 'REQUEST_PRODUCT_UPDATE') {
        console.log('Modelux: Manual update requested');
        // Force a fresh scan immediately
        const images = Array.from(document.images);
        let bestCandidate = null;
        let maxScore = 0;
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;

        images.forEach(img => {
          if (container.contains(img)) return;
          const rect = img.getBoundingClientRect();
          if (rect.width < 80 || rect.height < 80) return;

          const area = rect.width * rect.height;
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const distFromCenter = Math.sqrt(Math.pow(centerX - viewportWidth / 2, 2) + Math.pow(centerY - viewportHeight / 2, 2));
          const score = area / (distFromCenter + 100);

          if (score > maxScore) {
            maxScore = score;
            bestCandidate = img;
          }
        });

        if (bestCandidate) {
          const newSrc = bestCandidate.currentSrc || bestCandidate.src;
          if (newSrc && !newSrc.startsWith('data:')) {
            console.log('Modelux: Manual scan found:', newSrc);
            currentMainImageSrc = newSrc; // Update cache
            container.dataset.productImage = newSrc;

            const iframe = container.querySelector('iframe');
            if (iframe && iframe.contentWindow) {
              iframe.contentWindow.postMessage({
                type: 'PRODUCT_IMAGE',
                payload: newSrc
              }, '*');
            }
          }
        }
      }
    });
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