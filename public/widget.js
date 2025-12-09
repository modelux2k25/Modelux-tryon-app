(function () {
  // Modelux Widget Loader
  const SCRIPT_ID = 'modelux-widget-script';
  console.log('Modelux Widget v4.0 - Universal Floating Mode');
  const CONTAINER_CLASS = 'modelux-widget-container';
  const BASE_URL = 'https://modelux-tryon-api.onrender.com';

  // Inject CSS for selection mode and modal
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
    
    /* Modal Styles */
    #modelux-modal-sheet {
      background: white;
      box-shadow: 0 0 50px rgba(0,0,0,0.3);
      display: flex;
      flex-direction: column;
      position: relative;
      transition: all 0.3s ease-out;
    }

    /* Mobile: Bottom Sheet */
    @media (max-width: 768px) {
      #modelux-modal-sheet {
        width: 100%;
        height: 85vh;
        position: absolute;
        bottom: 0;
        left: 0;
        border-radius: 20px 20px 0 0;
        animation: modelux-slide-up 0.3s ease-out;
      }
    }

    /* Desktop: Centered Card */
    @media (min-width: 769px) {
      #modelux-modal-sheet {
        width: 450px;
        height: 85vh;
        max-height: 900px;
        border-radius: 20px;
        margin: auto; /* Center in flex container */
        animation: modelux-fade-in 0.3s ease-out;
      }
      #modelux-mobile-backdrop {
        display: none;
        align-items: center !important; /* Center vertically */
        justify-content: center !important; /* Center horizontally */
      }
    }

    @keyframes modelux-slide-down {
      from { transform: translate(-50%, -100%); opacity: 0; }
      to { transform: translate(-50%, 0); opacity: 1; }
    }
    @keyframes modelux-slide-up {
      from { transform: translateY(100%); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    @keyframes modelux-fade-in {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
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

    // Hide the original container to avoid layout issues
    container.style.display = 'none';

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

    const renderFloatingWidget = () => {
      const productUrl = container.dataset.productImage;
      if (!productUrl) return;

      if (document.getElementById('modelux-mobile-btn')) return; // Prevent duplicates

      // 1. Create Floating Button
      const btn = document.createElement('div');
      btn.id = 'modelux-mobile-btn';
      btn.innerHTML = `
        <img src="${BASE_URL}/modelux-button.webp" alt="Provador Virtual" style="width: 180px; height: auto; display: block;">
      `;
      btn.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: transparent;
        padding: 0;
        border: none;
        z-index: 2147483646;
        cursor: pointer;
        animation: modelux-slide-up 0.5s ease-out;
        transition: transform 0.2s;
        filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));
      `;
      btn.onmouseover = () => btn.style.transform = 'scale(1.05)';
      btn.onmouseout = () => btn.style.transform = 'scale(1)';
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
        backdrop-filter: blur(2px);
        /* Flex alignment handled by CSS media queries */
      `;
      // Default to mobile alignment (bottom)
      if (window.innerWidth < 769) {
        backdrop.style.alignItems = 'flex-end';
      } else {
        backdrop.style.alignItems = 'center';
        backdrop.style.justifyContent = 'center';
      }

      document.body.appendChild(backdrop);

      // 3. Create Modal Sheet/Card
      const sheet = document.createElement('div');
      sheet.id = 'modelux-modal-sheet';
      // Styles handled by CSS class injected above
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

      // Drag Handle (Visual cue - mainly for mobile)
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
        // Update alignment based on current width (in case of resize)
        if (window.innerWidth < 769) {
          backdrop.style.alignItems = 'flex-end';
          backdrop.style.justifyContent = 'normal';
        } else {
          backdrop.style.alignItems = 'center';
          backdrop.style.justifyContent = 'center';
        }

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

      // Listen for messages (Selection Mode)
      window.addEventListener('message', (event) => {
        if (event.data === 'START_IMAGE_SELECTION') {
          console.log('Modelux: Starting selection mode');

          // Hide modal to allow selection
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
                container.dataset.productImage = newSrc;

                const iframe = iframeContainer.querySelector('iframe');
                if (iframe && iframe.contentWindow) {
                  iframe.contentWindow.postMessage({
                    type: 'PRODUCT_IMAGE',
                    payload: newSrc
                  }, '*');
                }

                showToast('✅ Imagem atualizada!');

                // Re-open modal
                if (backdrop) {
                  setTimeout(() => {
                    backdrop.style.display = 'flex';
                    document.body.style.overflow = 'hidden';
                  }, 500);
                }
              }

              document.body.classList.remove('modelux-selecting');
              document.removeEventListener('click', clickHandler, true);
            }
          };

          document.addEventListener('click', clickHandler, true);
        }
      });
    };

    renderFloatingWidget();

    // Auto-Radar
    setInterval(() => { }, 2000);
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