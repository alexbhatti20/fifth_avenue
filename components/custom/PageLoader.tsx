'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

export default function PageLoader() {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    // Hide loader instantly when page is ready
    const hideLoader = () => {
      setVisible(false)
    }

    // Check if page is already loaded
    if (document.readyState === 'complete') {
      hideLoader()
    } else {
      // Wait for page to load
      window.addEventListener('load', hideLoader)
      return () => window.removeEventListener('load', hideLoader)
    }
  }, [])

  if (!visible) return null

  const letters = ['Z', 'O', 'I', 'R', 'O']

  return (
    <>
      <style>{`
        @keyframes zoiroSpin {
          0%   { transform: rotateY(0deg); }
          100% { transform: rotateY(360deg); }
        }
        @keyframes circleRotate {
          0%   { transform: rotate(-90deg); }
          100% { transform: rotate(270deg); }
        }
        @keyframes progressDash {
          0%   { stroke-dasharray: 1, 400; stroke-dashoffset: 0; }
          50%  { stroke-dasharray: 300, 400; stroke-dashoffset: -100; }
          100% { stroke-dasharray: 300, 400; stroke-dashoffset: -400; }
        }
        .zl-letter {
          display: inline-block;
          background: linear-gradient(
            135deg,
            #dc2626 0%,
            #ff6b6b 50%,
            #dc2626 100%
          );
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: zoiroSpin 2s ease-in-out infinite;
          transform-origin: center;
        }
        .zl-letter:nth-child(1) { animation-delay: 0s;   }
        .zl-letter:nth-child(2) { animation-delay: 0.2s; }
        .zl-letter:nth-child(3) { animation-delay: 0.4s; }
        .zl-letter:nth-child(4) { animation-delay: 0.6s; }
        .zl-letter:nth-child(5) { animation-delay: 0.8s; }
        .loading-circle { animation: circleRotate 1.5s linear infinite; }
        .loading-circle circle { animation: progressDash 1.5s ease-in-out infinite; }
      `}</style>

      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #fff5f5 0%, #ffe5e5 50%, #ffd9d9 100%)',
          transition: 'opacity 0.3s ease',
        }}
      >
        {/* Logo with circular progress around it */}
        <div style={{ position: 'relative', marginBottom: 32 }}>
          {/* Circular Progress Bar */}
          <svg 
            className="loading-circle" 
            width="180" 
            height="180" 
            viewBox="0 0 180 180"
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          >
            <circle
              cx="90"
              cy="90"
              r="85"
              fill="none"
              stroke="#dc2626"
              strokeWidth="6"
              strokeLinecap="round"
            />
          </svg>
          
          {/* Logo in center */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            <Image
              src="/assets/zoiro-logo.png"
              alt="Zoiro"
              width={140}
              height={140}
              priority
              style={{ borderRadius: '50%', boxShadow: '0 8px 32px rgba(220,38,38,0.5)' }}
            />
          </div>
        </div>

        {/* Spinning Letters "ZOIRO" */}
        <div
          style={{
            fontFamily: 'var(--font-bebas, "Bebas Neue", sans-serif)',
            fontSize: 'clamp(2.8rem, 8vw, 5rem)',
            letterSpacing: '0.22em',
            lineHeight: 1,
          }}
        >
          {letters.map((letter, index) => (
            <span key={index} className="zl-letter">
              {letter}
            </span>
          ))}
        </div>
      </div>
    </>
  )
}
