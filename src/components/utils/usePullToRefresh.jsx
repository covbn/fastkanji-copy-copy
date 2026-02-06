import { useEffect, useRef, useState } from 'react';

export function usePullToRefresh(onRefresh) {
  const [isPulling, setIsPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const scrollContainerRef = useRef(null);

  useEffect(() => {
    const container = document.querySelector('main > div');
    if (!container) return;

    scrollContainerRef.current = container;
    let touchStartY = 0;
    let isTouchActive = false;

    const handleTouchStart = (e) => {
      if (container.scrollTop === 0) {
        touchStartY = e.touches[0].clientY;
        startY.current = touchStartY;
        isTouchActive = true;
      }
    };

    const handleTouchMove = (e) => {
      if (!isTouchActive || container.scrollTop > 0) return;

      const currentY = e.touches[0].clientY;
      const diff = currentY - touchStartY;

      if (diff > 0 && container.scrollTop === 0) {
        e.preventDefault();
        const distance = Math.min(diff * 0.5, 100); // Max 100px pull
        setPullDistance(distance);
        setIsPulling(distance > 60);
      }
    };

    const handleTouchEnd = async () => {
      if (isPulling && pullDistance > 60) {
        await onRefresh();
      }
      
      isTouchActive = false;
      setPullDistance(0);
      setIsPulling(false);
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isPulling, pullDistance, onRefresh]);

  return { isPulling, pullDistance };
}