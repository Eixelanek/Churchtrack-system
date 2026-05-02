// Pull-to-refresh: works when the scrollable area under the finger is at its top
// (nested overflow containers, not just window scroll).

const TOP_TOLERANCE_PX = 12;
const TRIGGER_PULL_PX = 80;
const OVERSCROLL_PREVENT_PX = 50;

let startY = 0;
let currentY = 0;
let pulling = false;
let refreshIndicator = null;
let pullStartTime = 0;

function isEditableTarget(target) {
  if (!target || !(target instanceof Element)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

function isAtTopOfScrollChain(target) {
  if (!target || !(target instanceof Element)) {
    return false;
  }
  if (isEditableTarget(target)) {
    return false;
  }

  let el = target;
  while (el && el !== document.documentElement) {
    const style = window.getComputedStyle(el);
    const oy = style.overflowY;
    const canScrollY =
      (oy === 'auto' || oy === 'scroll' || oy === 'overlay') &&
      el.scrollHeight > el.clientHeight + 1;
    if (canScrollY) {
      return el.scrollTop <= TOP_TOLERANCE_PX;
    }
    el = el.parentElement;
  }

  const root = document.scrollingElement || document.documentElement;
  return (root.scrollTop || 0) <= TOP_TOLERANCE_PX;
}

const createRefreshIndicator = () => {
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
  indicator.innerHTML =
    '<div style="width: 20px; height: 20px; border: 2px solid #4CAF50; border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>';

  if (!document.getElementById('pull-refresh-spin-style')) {
    const style = document.createElement('style');
    style.id = 'pull-refresh-spin-style';
    style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
    document.head.appendChild(style);
  }

  document.body.appendChild(indicator);
  return indicator;
};

const resetIndicatorPosition = () => {
  if (refreshIndicator) {
    refreshIndicator.style.top = '-60px';
  }
};

export const initPullToRefresh = () => {
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (!hasTouch) {
    return () => {};
  }

  const handleTouchStart = (e) => {
    // Avoid fighting multi-touch / second finger mid-gesture
    if (e.touches.length !== 1) return;

    const target = e.target;
    if (!isAtTopOfScrollChain(target)) {
      pulling = false;
      return;
    }

    startY = e.touches[0].clientY;
    currentY = startY;
    pullStartTime = Date.now();
    pulling = true;

    if (!refreshIndicator || !document.body.contains(refreshIndicator)) {
      refreshIndicator = createRefreshIndicator();
    }
  };

  const handleTouchMove = (e) => {
    if (!pulling) return;

    currentY = e.touches[0].clientY;
    const pullDistance = currentY - startY;

    if (pullDistance < 0) {
      pulling = false;
      resetIndicatorPosition();
      return;
    }

    if (pullDistance > 0) {
      const progress = Math.min(pullDistance / 80, 1);
      if (refreshIndicator) {
        refreshIndicator.style.top = `${-60 + progress * 70}px`;
      }
      if (pullDistance > OVERSCROLL_PREVENT_PX) {
        e.preventDefault();
      }
    }
  };

  const finishGesture = (e) => {
    if (!pulling) return;

    const endTouch = e.changedTouches && e.changedTouches[0];
    const endY = endTouch ? endTouch.clientY : currentY;
    const pullDistance = endY - startY;
    const pullDuration = Date.now() - pullStartTime;

    if (pullDistance > TRIGGER_PULL_PX && pullDuration < 20000) {
      if (refreshIndicator) {
        refreshIndicator.style.top = '10px';
      }
      setTimeout(() => {
        window.location.reload();
      }, 200);
    } else {
      resetIndicatorPosition();
    }

    pulling = false;
    startY = 0;
    currentY = 0;
    pullStartTime = 0;
  };

  const handleTouchCancel = () => {
    pulling = false;
    startY = 0;
    currentY = 0;
    pullStartTime = 0;
    resetIndicatorPosition();
  };

  const opts = { passive: true };
  const moveOpts = { passive: false };

  window.addEventListener('touchstart', handleTouchStart, opts);
  window.addEventListener('touchmove', handleTouchMove, moveOpts);
  window.addEventListener('touchend', finishGesture, opts);
  window.addEventListener('touchcancel', handleTouchCancel, opts);

  return () => {
    window.removeEventListener('touchstart', handleTouchStart, opts);
    window.removeEventListener('touchmove', handleTouchMove, moveOpts);
    window.removeEventListener('touchend', finishGesture, opts);
    window.removeEventListener('touchcancel', handleTouchCancel, opts);
    if (refreshIndicator?.parentNode) {
      refreshIndicator.parentNode.removeChild(refreshIndicator);
    }
  };
};
