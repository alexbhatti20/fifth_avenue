'use client';

/**
 * PageProgressLoader
 *
 * Shows the Zoiro pan WebM loader:
 *  1. On page refresh / initial mount (auto-hides after 1.5 s or when content is ready)
 *  2. On every client-side navigation (pathname change)
 */

import { useEffect, useRef, useState } from 'react';

const RED      = '#d4163c';
const RED_DARK = '#8b0e26';

export function PageProgressLoader() {
  const [show, setShow]         = useState(false);
  const [fading, setFading]     = useState(false);
  const [progress, setProgress] = useState(0);

  /** Run a full start→finish cycle. Returns cleanup fn. */
  function runCycle(durationMs: number) {
    setFading(false);
    setShow(true);
    setProgress(0);

    const steps = [
      { to: 25, after: 80  },
      { to: 50, after: 200 },
      { to: 72, after: 380 },
      { to: 88, after: 600 },
    ];

    const allTimers: ReturnType<typeof setTimeout>[] = [];
    let acc = 0;
    for (const s of steps) {
      if (acc + s.after > durationMs) break;
      acc += s.after;
      allTimers.push(setTimeout(() => setProgress(s.to), acc));
    }

    // Finish: reach 100 → fade → hide
    const finishAt = durationMs;
    const hideAt   = durationMs + 440;
    allTimers.push(setTimeout(() => { setProgress(100); setFading(true); }, finishAt));
    allTimers.push(setTimeout(() => { setShow(false); setFading(false); setProgress(0); }, hideAt));

    return () => allTimers.forEach(clearTimeout);
  }

  // ── Page refresh / initial mount ────────────────────────────────────
  useEffect(() => {
    const stepTimers = runCycle(2000); // max cap — real finish fires earlier

    function finish() {
      // runCycle may already be near 100 — just trigger fade+hide
      setProgress(100);
      setFading(true);
      setTimeout(() => { setShow(false); setFading(false); setProgress(0); }, 280);
    }

    if (document.readyState === 'complete') {
      // Already loaded — short delay so animation is visible at least briefly
      const t = setTimeout(finish, 300);
      return () => { stepTimers(); clearTimeout(t); };
    }

    window.addEventListener('load', finish, { once: true });
    return () => {
      stepTimers();
      window.removeEventListener('load', finish);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!show) return null;

  return (
    <>
      {/* ── Top progress sweep bar ──────────────────────────────────── */}
      <div
        className="fixed top-0 left-0 right-0 z-[9999] h-[3px] pointer-events-none"
        style={{ opacity: fading ? 0 : 1, transition: 'opacity 420ms ease' }}
      >
        <div
          className="absolute inset-y-0 left-0"
          style={{
            width: `${progress}%`,
            background: `linear-gradient(90deg, ${RED}, ${RED_DARK}, #141414)`,
            backgroundSize: '200% 100%',
            animation: 'pageBarShimmer 1.2s linear infinite',
            transition: 'width 500ms cubic-bezier(.4,0,.2,1)',
          }}
        />
        {/* glowing head dot */}
        <div
          className="absolute top-[-3px] h-[9px] w-[9px] rounded-full -translate-x-1/2"
          style={{
            left: `${progress}%`,
            background: RED,
            boxShadow: `0 0 8px 3px ${RED}99`,
            transition: 'left 500ms cubic-bezier(.4,0,.2,1)',
          }}
        />
      </div>

      {/* ── Video with light blur backdrop ──────────────────────────── */}
      <div
        className="fixed inset-0 z-[9998] flex items-center justify-center"
        style={{
          opacity: fading ? 0 : 1,
          transition: 'opacity 420ms ease',
          background: 'rgba(10,10,10,0.35)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
        }}
      >
        <video
          src="/pan-loading.webm"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          style={{ width: 180, height: 180, background: 'transparent', mixBlendMode: 'multiply' }}
        />
      </div>

      <style>{`
        @keyframes pageBarShimmer {
          0%   { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
      `}</style>
    </>
  );
}
