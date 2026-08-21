document.addEventListener('DOMContentLoaded', () => {

  /* --- 1. Video Auto-Play/Pause Handling --- */
  const video = document.getElementById('aboutVideo');

  if (video) {
    // Intersection Observer: Trigger when ~50% visible
    const observerOptions = {
      root: null,
      threshold: 0.5
    };

    const videoObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !document.hidden) {
          video.play().catch(() => {
            // Autoplay prevention fallback
          });
        } else {
          video.pause();
        }
      });
    }, observerOptions);

    videoObserver.observe(video);

    // Page Visibility API handling
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        video.pause();
      } else {
        // Resume if still ~50% visible in view
        const rect = video.getBoundingClientRect();
        const windowHeight = window.innerHeight || document.documentElement.clientHeight;
        const visibleHeight = Math.max(0, Math.min(rect.bottom, windowHeight) - Math.max(rect.top, 0));
        if (visibleHeight / rect.height >= 0.5) {
          video.play().catch(() => {});
        }
      }
    });
  }

  /* --- 2. Top Goods Interactive Switcher --- */
  const topProductItems = document.querySelectorAll('.top-product-item');
  const topGoodsSourceLow = document.getElementById('topGoodsSourceLow');
  const topGoodsSourceHigh = document.getElementById('topGoodsSourceHigh');
  const topGoodsImg = document.getElementById('topGoodsImg');

  topProductItems.forEach(item => {
    item.addEventListener('click', () => {
      // Remove active class from all
      topProductItems.forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
      });

      // Set active to clicked item
      item.classList.add('active');
      item.setAttribute('aria-selected', 'true');

      // Update Preview Image
      const lowRes = item.getAttribute('data-low');
      const highRes = item.getAttribute('data-high');
      const altText = item.getAttribute('data-alt');

      if (topGoodsSourceLow) topGoodsSourceLow.srcset = lowRes;
      if (topGoodsSourceHigh) topGoodsSourceHigh.srcset = highRes;
      if (topGoodsImg) {
        topGoodsImg.src = highRes;
        topGoodsImg.alt = altText;
      }
    });
  });

  /* --- 3. Offline Mode & Service Worker Registration --- */
  const offlineBanner = document.getElementById('offline-banner');

  function updateOnlineStatus() {
    if (!navigator.onLine) {
      if (offlineBanner) offlineBanner.hidden = false;
      document.body.classList.add('is-offline');
    } else {
      if (offlineBanner) offlineBanner.hidden = true;
      document.body.classList.remove('is-offline');
    }
  }

  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus();

  // Register Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {
      // SW registration failed
    });
  }
});