'use client';

/**
 * PageProgressLoader
 *
 * Shows the Zoiro pan WebM loader:
 *  1. On page refresh / initial mount (auto-hides after 1.5 s or when content is ready)
 *  2. On every client-side navigation (pathname change)
 */

import { useEffect, useRef, useState, useMemo } from 'react';

const RED      = '#d4163c';
const RED_DARK = '#8b0e26';

export function PageProgressLoader() {
  const [show, setShow]         = useState(false);
  const [fading, setFading]     = useState(false);
  const [progress, setProgress] = useState(0);

  // Generate floating particles for mobile
  const particles = useMemo(() => 
    Array.from({ length: 8 }, (_, i) => ({
      id: i,
      size: Math.random() * 6 + 3,
      x: Math.random() * 100,
      y: Math.random() * 100,
      duration: Math.random() * 2 + 1.5,
      delay: Math.random() * 1,
    })), []
  );

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
        className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none"
        style={{ 
          height: 'clamp(3px, 0.8vw, 5px)',
          opacity: fading ? 0 : 1, 
          transition: 'opacity 420ms ease' 
        }}
      >
        {/* Background track */}
        <div
          className="absolute inset-0"
          style={{
            background: 'rgba(212,22,60,0.15)',
          }}
        />
        {/* Animated progress bar */}
        <div
          className="absolute inset-y-0 left-0"
          style={{
            width: `${progress}%`,
            background: `linear-gradient(90deg, ${RED}, ${RED_DARK}, ${RED})`,
            backgroundSize: '200% 100%',
            animation: 'pageBarShimmer 1.2s linear infinite',
            transition: 'width 500ms cubic-bezier(.4,0,.2,1)',
            boxShadow: `0 0 10px ${RED}80, 0 0 20px ${RED}40`,
          }}
        />
        {/* glowing head dot */}
        <div
          className="absolute -translate-x-1/2"
          style={{
            top: '-4px',
            height: 'clamp(8px, 2vw, 12px)',
            width: 'clamp(8px, 2vw, 12px)',
            borderRadius: '50%',
            left: `${progress}%`,
            background: `radial-gradient(circle, ${RED} 0%, ${RED_DARK} 100%)`,
            boxShadow: `0 0 12px 4px ${RED}aa, 0 0 24px 8px ${RED}55`,
            transition: 'left 500ms cubic-bezier(.4,0,.2,1)',
          }}
        />
      </div>

      {/* ── Video with advanced blur backdrop ──────────────────────────── */}
      <div
        className="fixed inset-0 z-[9998] flex flex-col items-center justify-center gap-4"
        style={{
          opacity: fading ? 0 : 1,
          transition: 'opacity 420ms ease',
          background: 'radial-gradient(circle at center, rgba(30,10,15,0.5) 0%, rgba(10,10,10,0.6) 100%)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      >
        {/* Floating Particles */}
        {particles.map((particle) => (
          <div
            key={particle.id}
            className="progress-particle"
            style={{
              position: 'absolute',
              width: particle.size,
              height: particle.size,
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${RED}cc 0%, ${RED}00 70%)`,
              animation: `progressFloat ${particle.duration}s ease-in-out ${particle.delay}s infinite`,
              pointerEvents: 'none',
            }}
          />
        ))}

        {/* Video Container with glow effect */}
        <div
          className="relative"
          style={{
            width: 'clamp(120px, 35vw, 200px)',
            height: 'clamp(120px, 35vw, 200px)',
          }}
        >
          {/* Outer glow ring */}
          <div
            className="absolute inset-0"
            style={{
              borderRadius: '50%',
              border: `2px solid ${RED}40`,
              animation: 'progressRingPulse 2s ease-in-out infinite',
              boxShadow: `0 0 30px ${RED}30, inset 0 0 20px ${RED}20`,
            }}
          />
          
          {/* Orbiting dot */}
          <div
            className="absolute"
            style={{
              width: '100%',
              height: '100%',
              animation: 'progressOrbit 3s linear infinite',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '-4px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: 'clamp(6px, 1.5vw, 10px)',
                height: 'clamp(6px, 1.5vw, 10px)',
                borderRadius: '50%',
                background: RED,
                boxShadow: `0 0 10px ${RED}`,
              }}
            />
          </div>
          
          {/* Video */}
          <video
            src="/pan-loading.webm"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            style={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'contain',
              background: 'transparent', 
              mixBlendMode: 'multiply',
              filter: 'drop-shadow(0 4px 20px rgba(212,22,60,0.3))',
            }}
          />
        </div>

        {/* Loading text */}
        <div
          style={{
            fontSize: 'clamp(0.65rem, 2.5vw, 0.85rem)',
            color: 'rgba(255,255,255,0.7)',
            letterSpacing: '0.25em',
            textTransform: 'uppercase',
            fontWeight: 500,
            animation: 'progressTextPulse 1.5s ease-in-out infinite',
          }}
        >
          Loading
          <span className="progress-dots" style={{ display: 'inline-block', width: '1.5em' }}>
            <span style={{ animation: 'progressDot 1.4s infinite', animationDelay: '0s' }}>.</span>
            <span style={{ animation: 'progressDot 1.4s infinite', animationDelay: '0.2s' }}>.</span>
            <span style={{ animation: 'progressDot 1.4s infinite', animationDelay: '0.4s' }}>.</span>
          </span>
        </div>

        {/* Progress percentage */}
        <div
          style={{
            fontSize: 'clamp(0.55rem, 2vw, 0.7rem)',
            color: `${RED}cc`,
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {Math.round(progress)}%
        </div>
      </div>

      <style>{`
        @keyframes pageBarShimmer {
          0%   { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
        @keyframes progressFloat {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.3; }
          50% { transform: translateY(-15px) scale(1.2); opacity: 0.7; }
        }
        @keyframes progressRingPulse {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.05); opacity: 1; }
        }
        @keyframes progressOrbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes progressTextPulse {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
        @keyframes progressDot {
          0%, 20% { opacity: 0; }
          40% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </>
  );
}
