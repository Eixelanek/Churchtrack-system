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
    z-index: 9999;
  `;
  indicator.innerHTML = '<div style="width: 20px; height: 20px; border: 2px solid #4CAF50; border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>';
  
  // Add spin animation
  const style = document.createElement('style');
  style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
  document.head.appendChild(style);
  
  document.body.appendChild(indicator);
  return indicator;
};

export const initPullToRefresh = () => {
  // Only enable on mobile
  if (window.innerWidth > 768) return;

  // Create refresh indicator
  refreshIndicator = createRefreshIndicator();

  const handleTouchStart = (e) => {
    // Only trigger if at top of page and not already pulling
    if (window.scrollY === 0 && !pulling) {
      startY = e.touches[0].pageY;
      pulling = true;
    }
  };

  const handleTouchMove = (e) => {
    if (!pulling) return;

    currentY = e.touches[0].pageY;
    const pullDistance = currentY - startY;

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
      if (refreshIndicator) {
        refreshIndicator.style.top = '10px';
      }
      
      // Reload after short delay to show animation
      setTimeout(() => {
        window.location.reload(true); // Force reload from server
      }, 300);
    } else {
      // Reset indicator
      if (refreshIndicator) {
        refreshIndicator.style.top = '-60px';
      }
    }

    // Always reset state after touch ends
    pulling = false;
    startY = 0;
    currentY = 0;
  };

  document.addEventListener('touchstart', handleTouchStart, { passive: true });
  document.addEventListener('touchmove', handleTouchMove, { passive: false });
  document.addEventListener('touchend', handleTouchEnd, { passive: true });

  return () => {
    document.removeEventListener('touchstart', handleTouchStart);
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', handleTouchEnd);
    if (refreshIndicator && refreshIndicator.parentNode) {
      refreshIndicator.parentNode.removeChild(refreshIndicator);
    }
  };
};
