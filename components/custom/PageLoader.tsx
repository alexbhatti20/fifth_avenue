'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

export default function PageLoader() {
  const [visible, setVisible] = useState(true)
  const [fadeOut, setFadeOut] = useState(false)

  useEffect(() => {
    const hideLoader = () => {
      setFadeOut(true)
      setTimeout(() => setVisible(false), 300)
    }

    if (document.readyState === 'complete') {
      hideLoader()
    } else {
      window.addEventListener('load', hideLoader)
      return () => window.removeEventListener('load', hideLoader)
    }
  }, [])

  if (!visible) return null

  return (
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
        backgroundColor: '#fef2f2',
        transition: 'opacity 0.3s ease',
        opacity: fadeOut ? 0 : 1,
      }}
    >
      {/* Logo with spinner */}
      <div style={{ position: 'relative', width: 100, height: 100 }}>
        {/* Spinner ring */}
        <svg
          viewBox="0 0 100 100"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            animation: 'spin 1s linear infinite',
          }}
        >
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="#fee2e2"
            strokeWidth="4"
          />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="#dc2626"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="70 213"
          />
        </svg>

        {/* Logo */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 60,
            height: 60,
          }}
        >
          <Image
            src="/assets/zoiro-logo.png"
            alt="Zoiro"
            fill
            sizes="60px"
            style={{ objectFit: 'contain' }}
            priority
          />
        </div>
      </div>

      {/* Loading text */}
      <p
        style={{
          marginTop: 16,
          fontSize: 14,
          color: '#dc2626',
          fontWeight: 500,
        }}
      >
        Loading...
      </p>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
