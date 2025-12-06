(function () {
  // Modelux Widget Loader
  const SCRIPT_ID = 'modelux-widget-script';
  console.log('Modelux Widget v3.0 - Click Select Mode');
  const CONTAINER_CLASS = 'modelux-widget-container';
  const BASE_URL = 'https://modelux-tryon-api.onrender.com';

  // Inject CSS for selection mode
  const style = document.createElement('style');
  style.textContent = `
    .modelux-selecting {
      cursor: crosshair !important;
    }
    .modelux-selecting img {
      cursor: pointer !important;
      transition: outline 0.2s;
    }
    .modelux-selecting img:hover {
      outline: 4px solid #4f46e5 !important;
      z-index: 9999;
    }
    .modelux-toast {
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #1e1b4b;
      color: white;
      padding: 12px 24px;
      border-radius: 50px;
      font-family: sans-serif;
      font-weight: bold;
      z-index: 2147483647;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
      animation: modelux-slide-down 0.3s ease-out;
    }
    @keyframes modelux-slide-down {
      from { transform: translate(-50%, -100%); opacity: 0; }
      to { transform: translate(-50%, 0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);

  function showToast(message, duration = 3000) {
    const toast = document.createElement('div');
    toast.className = 'modelux-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.5s';
      setTimeout(() => toast.remove(), 500);
    }, duration);
  }

  function loadWidget(container) {
    if (container.dataset.widgetInitialized) return;
    container.dataset.widgetInitialized = 'true';

    const renderIframe = () => {
      const productUrl = container.dataset.productImage;
      if (!productUrl) return;

      let iframe = container.querySelector('iframe');
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.style.width = '100%';
        iframe.style.border = 'none';
        iframe.style.overflow = 'hidden';
        iframe.style.minHeight = '950px';
        iframe.scrolling = 'no';
        container.appendChild(iframe);
      }

      const appUrl = new URL(BASE_URL);
      appUrl.searchParams.set('product_image', productUrl);
      appUrl.searchParams.set('t', Date.now().toString());
      iframe.src = appUrl.toString();
    };

    renderIframe();

    // Auto-Radar (Keep it simple as fallback/background)
    let currentMainImageSrc = container.dataset.productImage;
    setInterval(() => {
      // Simple check: if we find a NEW image that is clearly the main one (by size), update.
      // But don't be too aggressive to avoid flipping back and forth.
      // For now, let's rely on the Manual Click for reliable switching if this fails.
    }, 2000);

    // Listen for messages
    window.addEventListener('message', (event) => {
      if (event.data === 'START_IMAGE_SELECTION') {
        console.log('Modelux: Starting selection mode');
        showToast('👆 Clique na foto do produto para selecionar');

        document.body.classList.add('modelux-selecting');

        const clickHandler = (e) => {
          if (e.target.tagName === 'IMG') {
            e.preventDefault();
            e.stopPropagation();

            const newSrc = e.target.currentSrc || e.target.src;
            console.log('Modelux: User selected image:', newSrc);

            if (newSrc) {
              currentMainImageSrc = newSrc;
              container.dataset.productImage = newSrc;

              const iframe = container.querySelector('iframe');
              if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage({
                  type: 'PRODUCT_IMAGE',
                  payload: newSrc
                }, '*');
              }
              showToast('✅ Imagem atualizada!');
            }

            // Cleanup
            document.body.classList.remove('modelux-selecting');
            document.removeEventListener('click', clickHandler, true);
          }
        };

        document.addEventListener('click', clickHandler, true);
      }
    });
  }

  function init() {
    document.querySelectorAll('.' + CONTAINER_CLASS).forEach(loadWidget);
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            if (node.classList && node.classList.contains(CONTAINER_CLASS)) {
              loadWidget(node);
            } else if (node.querySelector) {
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