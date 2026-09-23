"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

// Installed as a standalone PWA (see manifest.json), so there's no browser
// chrome to provide the native pull-to-refresh gesture — this reimplements
// it by hand. Native touchmove listener (not React's, which is passive by
// default) so preventDefault actually stops the page from scrolling while
// mid-pull, instead of scrolling AND revealing the indicator at once.
const PULL_THRESHOLD = 70;
const MAX_PULL = 100;

export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function onTouchStart(e: TouchEvent) {
      if (refreshing) return;
      if (window.scrollY <= 0) startY.current = e.touches[0].clientY;
    }

    function onTouchMove(e: TouchEvent) {
      if (startY.current === null || refreshing) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta <= 0) {
        setPullDistance(0);
        return;
      }
      e.preventDefault();
      const resisted = delta < MAX_PULL ? delta : MAX_PULL + (delta - MAX_PULL) * 0.15;
      setPullDistance(resisted);
    }

    function onTouchEnd() {
      if (startY.current === null) return;
      startY.current = null;
      setPullDistance((current) => {
        if (current >= PULL_THRESHOLD) {
          setRefreshing(true);
          window.location.reload();
          return PULL_THRESHOLD;
        }
        return 0;
      });
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [refreshing]);

  return (
    <div ref={containerRef}>
      <div
        className="flex items-center justify-center overflow-hidden"
        style={{
          height: pullDistance,
          transition: pullDistance === 0 || refreshing ? "height 0.2s" : "none",
        }}
      >
        <RefreshCw
          className={`w-5 h-5 text-[var(--color-primary)] ${refreshing ? "animate-spin" : ""}`}
          style={
            refreshing
              ? undefined
              : { transform: `rotate(${Math.min((pullDistance / PULL_THRESHOLD) * 360, 360)}deg)` }
          }
        />
      </div>
      {children}
    </div>
  );
}
