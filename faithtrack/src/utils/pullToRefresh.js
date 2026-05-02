// Pull-to-refresh functionality for mobile
let startY = 0;
let currentY = 0;
let pulling = false;
let refreshIndicator = null;
let pullStartTime = 0;

const createRefreshIndicator = () => {
  // Remove existing indicator if any
  const existing = document.getElementById('pull-refresh-indicator');
  if (existing) {
    existing.remove();
  }

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
    z-index: 999999;
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

export const initPullToRefresh = () => {
  // Only enable on mobile/touch devices
  if (!('ontouchstart' in window)) {
    console.log('Pull-to-refresh: Not a touch device, skipping');
    return () => {};
  }

  console.log('Pull-to-refresh: Initializing...');

  const handleTouchStart = (e) => {
    // Reset state
    pulling = false;
    startY = 0;
    currentY = 0;
    
    // Check if we're at the top of the page
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    
    if (scrollTop <= 10) { // 10px tolerance
      startY = e.touches[0].clientY;
      pullStartTime = Date.now();
      pulling = true;
      
      // Create indicator if not exists
      if (!refreshIndicator || !document.body.contains(refreshIndicator)) {
        refreshIndicator = createRefreshIndicator();
      }
      
      console.log('Pull-to-refresh: Ready to pull, scrollTop:', scrollTop);
    }
  };

  const handleTouchMove = (e) => {
    if (!pulling) return;

    currentY = e.touches[0].clientY;
    const pullDistance = currentY - startY;

    // Only handle downward pulls
    if (pullDistance < 0) {
      pulling = false;
      if (refreshIndicator) {
        refreshIndicator.style.top = '-60px';
      }
      return;
    }

    // Show indicator when pulled down
    if (pullDistance > 0) {
      const progress = Math.min(pullDistance / 80, 1);
      if (refreshIndicator) {
        refreshIndicator.style.top = `${-60 + (progress * 70)}px`;
      }
      
      // Prevent default scroll if pulled enough
      if (pullDistance > 50) {
        e.preventDefault();
      }
    }
  };

  const handleTouchEnd = (e) => {
    if (!pulling) return;

    const pullDistance = currentY - startY;
    const pullDuration = Date.now() - pullStartTime;

    console.log('Pull-to-refresh: Touch end, distance:', pullDistance, 'duration:', pullDuration);

    // If pulled down more than 80px, trigger refresh
    if (pullDistance > 80) {
      console.log('Pull-to-refresh: Triggering reload!');
      if (refreshIndicator) {
        refreshIndicator.style.top = '10px';
      }
      
      // Reload after short delay
      setTimeout(() => {
        window.location.reload();
      }, 200);
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
    pullStartTime = 0;
  };

  // Add event listeners
  window.addEventListener('touchstart', handleTouchStart, { passive: true });
  window.addEventListener('touchmove', handleTouchMove, { passive: false });
  window.addEventListener('touchend', handleTouchEnd, { passive: true });

  console.log('Pull-to-refresh: Event listeners attached');

  return () => {
    window.removeEventListener('touchstart', handleTouchStart);
    window.removeEventListener('touchmove', handleTouchMove);
    window.removeEventListener('touchend', handleTouchEnd);
    if (refreshIndicator && refreshIndicator.parentNode) {
      refreshIndicator.parentNode.removeChild(refreshIndicator);
    }
    console.log('Pull-to-refresh: Cleaned up');
  };
};
