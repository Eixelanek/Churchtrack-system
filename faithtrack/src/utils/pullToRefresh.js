// Pull-to-refresh functionality for mobile
let startY = 0;
let currentY = 0;
let pulling = false;
let refreshIndicator = null;

const createRefreshIndicator = () => {
  const indicator = document.createElement('div');
  indicator.id = 'pull-refresh-indicator';
  indicator.style.cssText = `
    position: fixed;
    top: -60px;
    left: 50%;
    transform: translateX(-50%);
    width: 40px;
    height: 40px;
    background: white;
    border-radius: 50%;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: top 0.3s ease;
    z-index: 99999;
    pointer-events: none;
  `;
  indicator.innerHTML = '<div style="width: 20px; height: 20px; border: 2px solid #4CAF50; border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>';
  
  // Add spin animation if not already added
  if (!document.getElementById('pull-refresh-spin-style')) {
    const style = document.createElement('style');
    style.id = 'pull-refresh-spin-style';
    style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
    document.head.appendChild(style);
  }
  
  document.body.appendChild(indicator);
  return indicator;
};

const getScrollTop = () => {
  // Check multiple scroll containers
  const scrollableElements = [
    window,
    document.documentElement,
    document.body,
    ...Array.from(document.querySelectorAll('.scrollable, .content, main, [style*="overflow"]'))
  ];
  
  for (const el of scrollableElements) {
    const scrollTop = el === window ? window.scrollY : el.scrollTop;
    if (scrollTop > 0) {
      return scrollTop;
    }
  }
  return 0;
};

export const initPullToRefresh = () => {
  // Only enable on mobile
  if (window.innerWidth > 768) return () => {};

  // Create refresh indicator
  refreshIndicator = createRefreshIndicator();

  const handleTouchStart = (e) => {
    // Check if at top of any scrollable container
    const scrollTop = getScrollTop();
    
    if (scrollTop <= 5 && !pulling) { // Allow small tolerance (5px)
      startY = e.touches[0].pageY;
      pulling = true;
      console.log('Pull-to-refresh: Started pulling');
    }
  };

  const handleTouchMove = (e) => {
    if (!pulling) return;

    currentY = e.touches[0].pageY;
    const pullDistance = currentY - startY;

    // Only handle downward pulls
    if (pullDistance < 0) {
      pulling = false;
      startY = 0;
      currentY = 0;
      if (refreshIndicator) {
        refreshIndicator.style.top = '-60px';
      }
      return;
    }

    // Show indicator when pulled down
    if (pullDistance > 0 && pullDistance <= 120) {
      if (refreshIndicator) {
        const progress = Math.min(pullDistance / 80, 1);
        refreshIndicator.style.top = `${-60 + (progress * 70)}px`;
      }
    }

    // If pulled down more than 80px, prevent default scroll
    if (pullDistance > 80) {
      e.preventDefault();
    }
  };

  const handleTouchEnd = () => {
    if (!pulling) return;

    const pullDistance = currentY - startY;

    // If pulled down more than 80px, trigger refresh
    if (pullDistance > 80) {
      console.log('Pull-to-refresh: Triggering reload');
      if (refreshIndicator) {
        refreshIndicator.style.top = '10px';
      }
      
      // Reload after short delay to show animation
      setTimeout(() => {
        window.location.reload();
      }, 300);
    } else {
      // Reset indicator
      if (refreshIndicator) {
        refreshIndicator.style.top = '-60px';
      }
    }
    
    // Always reset state
    pulling = false;
    startY = 0;
    currentY = 0;
  };

  // Use capture phase to ensure we catch events first
  document.addEventListener('touchstart', handleTouchStart, { passive: true, capture: true });
  document.addEventListener('touchmove', handleTouchMove, { passive: false, capture: true });
  document.addEventListener('touchend', handleTouchEnd, { passive: true, capture: true });

  return () => {
    document.removeEventListener('touchstart', handleTouchStart, { capture: true });
    document.removeEventListener('touchmove', handleTouchMove, { capture: true });
    document.removeEventListener('touchend', handleTouchEnd, { capture: true });
    if (refreshIndicator && refreshIndicator.parentNode) {
      refreshIndicator.parentNode.removeChild(refreshIndicator);
    }
  };
};
