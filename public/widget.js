(function () {
  // Modelux Widget Loader
  const SCRIPT_ID = 'modelux-widget-script';
  console.log('Modelux Widget v3.3 - Bottom Sheet Mode');
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
    @keyframes modelux-slide-up {
      from { transform: translateY(100%); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
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

    const getProductDescription = () => {
      const selectors = [
        '.product-description',
        '#description',
        '[itemprop="description"]',
        '.description',
        '.user-content', // Common in Nuvemshop
        'meta[name="description"]'
      ];

      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el) {
          const text = selector.startsWith('meta') ? el.content : el.innerText;
          // Clean up and truncate to avoid overloading
          return text.replace(/\s+/g, ' ').trim().substring(0, 2000);
        }
      }
      return '';
    };

    const getAppUrl = (productUrl) => {
      const appUrl = new URL(BASE_URL);
      appUrl.searchParams.set('product_image', productUrl);
      appUrl.searchParams.set('t', Date.now().toString());
      return appUrl.toString();
    };

    const renderIframe = () => {
      const productUrl = container.dataset.productImage;
      if (!productUrl) return;

      const isMobile = window.innerWidth < 768;

      if (isMobile) {
        // --- MOBILE FLOATING MODE (BOTTOM SHEET) ---
        if (document.getElementById('modelux-mobile-btn')) return; // Prevent duplicates

        // 1. Create Floating Button
        const btn = document.createElement('div');
        btn.id = 'modelux-mobile-btn';
        btn.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 20px;">👕</span>
            <span style="font-weight: bold;">Provador Virtual</span>
          </div>
        `;
        btn.style.cssText = `
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: #4f46e5;
          color: white;
          padding: 12px 20px;
          border-radius: 50px;
          box-shadow: 0 4px 15px rgba(79, 70, 229, 0.4);
          z-index: 2147483646;
          cursor: pointer;
          font-family: sans-serif;
          animation: modelux-slide-up 0.5s ease-out;
        `;
        document.body.appendChild(btn);

        // 2. Create Modal Backdrop
        const backdrop = document.createElement('div');
        backdrop.id = 'modelux-mobile-backdrop';
        backdrop.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0,0,0,0.5);
          z-index: 2147483647;
          display: none;
          align-items: flex-end; /* Align to bottom */
          backdrop-filter: blur(2px);
        `;
        document.body.appendChild(backdrop);

        // 3. Create Bottom Sheet Container
        const sheet = document.createElement('div');
        sheet.style.cssText = `
          width: 100%;
          height: 85vh; /* Leave top 15% visible */
          background: white;
          border-radius: 20px 20px 0 0;
          box-shadow: 0 -10px 40px rgba(0,0,0,0.2);
          display: flex;
          flex-direction: column;
          position: relative;
          animation: modelux-slide-up 0.3s ease-out;
        `;
        backdrop.appendChild(sheet);

        // Close Button (Inside Sheet)
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '✕';
        closeBtn.style.cssText = `
          position: absolute;
          top: 15px;
          right: 15px;
          background: #f1f5f9;
          border: none;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          font-weight: bold;
          color: #475569;
          z-index: 2;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        `;
        closeBtn.onclick = () => {
          backdrop.style.display = 'none';
          document.body.style.overflow = 'auto';
        };
        sheet.appendChild(closeBtn);

        // Drag Handle (Visual cue)
        const handle = document.createElement('div');
        handle.style.cssText = `
          width: 40px;
          height: 4px;
          background: #e2e8f0;
          border-radius: 2px;
          margin: 12px auto 0;
          flex-shrink: 0;
        `;
        sheet.appendChild(handle);

        // Iframe Container inside Sheet
        const iframeContainer = document.createElement('div');
        iframeContainer.style.cssText = 'width: 100%; flex: 1; -webkit-overflow-scrolling: touch; overflow-y: auto; border-radius: 20px 20px 0 0;';
        sheet.appendChild(iframeContainer);

        // 4. Button Click Handler
        btn.onclick = () => {
          backdrop.style.display = 'flex';
          document.body.style.overflow = 'hidden'; // Lock scroll

          // Load iframe only when opened
          if (!iframeContainer.querySelector('iframe')) {
            const iframe = document.createElement('iframe');
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.style.border = 'none';
            iframe.src = getAppUrl(productUrl);
            iframeContainer.appendChild(iframe);

            iframe.onload = () => {
              const description = getProductDescription();
              iframe.contentWindow.postMessage({
                type: 'PRODUCT_DETAILS',
                payload: { image: productUrl, description: description }
              }, '*');
            };
          }
        };

      } else {
        // --- DESKTOP EMBEDDED MODE ---
        let iframe = container.querySelector('iframe');
        if (!iframe) {
          // Force container to take full width available
          container.style.width = '100%';
          container.style.display = 'block';

          iframe = document.createElement('iframe');
          iframe.style.width = '100%';
          iframe.style.minWidth = '380px';
          iframe.style.border = 'none';
          iframe.style.overflow = 'hidden';
          iframe.style.minHeight = '1200px';
          iframe.scrolling = 'no';
          container.appendChild(iframe);

          iframe.onload = () => {
            const description = getProductDescription();
            iframe.contentWindow.postMessage({
              type: 'PRODUCT_DETAILS',
              payload: { image: productUrl, description: description }
            }, '*');
          };
        }
        iframe.src = getAppUrl(productUrl);
      }
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

        // Mobile: Hide modal to allow selection
        const backdrop = document.getElementById('modelux-mobile-backdrop');
        if (backdrop) {
          backdrop.style.display = 'none';
          document.body.style.overflow = 'auto';
        }

        showToast('👆 Clique na foto do produto na loja');

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
              // Check inside modal container too
              const modalIframe = document.querySelector('#modelux-mobile-modal iframe') ||
                (backdrop && backdrop.querySelector('iframe'));

              const targetIframe = iframe || modalIframe;

              if (targetIframe && targetIframe.contentWindow) {
                targetIframe.contentWindow.postMessage({
                  type: 'PRODUCT_IMAGE',
                  payload: newSrc
                }, '*');
              }

              showToast('✅ Imagem atualizada!');

              // Mobile: Re-open modal
              if (backdrop) {
                setTimeout(() => {
                  backdrop.style.display = 'flex';
                  document.body.style.overflow = 'hidden';
                }, 500); // Small delay for visual feedback
              }
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