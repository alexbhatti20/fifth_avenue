"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

const COOKIE_PREFERENCES_KEY = "zoiro_cookie_preferences";

interface CookiePreferences {
  necessary: boolean;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
}

// Replace these with your actual tracking IDs
const GOOGLE_ANALYTICS_ID = process.env.NEXT_PUBLIC_GA_ID || "G-XXXXXXXXXX";
const FACEBOOK_PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID || "XXXXXXXXXX";
const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || "AW-XXXXXXXXXX";

export default function TrackingScripts() {
  const [preferences, setPreferences] = useState<CookiePreferences | null>(null);

  useEffect(() => {
    // Check cookie preferences
    const savedPrefs = localStorage.getItem(COOKIE_PREFERENCES_KEY);
    if (savedPrefs) {
      try {
        setPreferences(JSON.parse(savedPrefs));
      } catch {
        setPreferences(null);
      }
    }

    // Listen for preference changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === COOKIE_PREFERENCES_KEY && e.newValue) {
        try {
          setPreferences(JSON.parse(e.newValue));
        } catch {}
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Don't render any scripts if no consent given
  if (!preferences) return null;

  return (
    <>
      {/* ========== ANALYTICS COOKIES ========== */}
      {preferences.analytics && (
        <>
          {/* Google Analytics 4 */}
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_ID}`}
            strategy="afterInteractive"
          />
          <Script id="google-analytics" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GOOGLE_ANALYTICS_ID}', {
                page_path: window.location.pathname,
                anonymize_ip: true
              });
            `}
          </Script>

          {/* Microsoft Clarity (Optional - uncomment if you use it) */}
          {/* 
          <Script id="microsoft-clarity" strategy="afterInteractive">
            {`
              (function(c,l,a,r,i,t,y){
                c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
              })(window, document, "clarity", "script", "YOUR_CLARITY_ID");
            `}
          </Script>
          */}
        </>
      )}

      {/* ========== MARKETING COOKIES ========== */}
      {preferences.marketing && (
        <>
          {/* Facebook Pixel */}
          <Script id="facebook-pixel" strategy="afterInteractive">
            {`
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${FACEBOOK_PIXEL_ID}');
              fbq('track', 'PageView');
            `}
          </Script>
          <noscript>
            <img
              height="1"
              width="1"
              style={{ display: "none" }}
              src={`https://www.facebook.com/tr?id=${FACEBOOK_PIXEL_ID}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>

          {/* Google Ads Conversion Tracking (Optional) */}
          {/*
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`}
            strategy="afterInteractive"
          />
          <Script id="google-ads" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GOOGLE_ADS_ID}');
            `}
          </Script>
          */}
        </>
      )}
    </>
  );
}

// ========== HELPER FUNCTIONS FOR TRACKING EVENTS ==========

/**
 * Check if analytics cookies are enabled
 */
export function hasAnalyticsConsent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const prefs = localStorage.getItem(COOKIE_PREFERENCES_KEY);
    if (prefs) {
      const parsed = JSON.parse(prefs);
      return parsed.analytics === true;
    }
  } catch {}
  return false;
}

/**
 * Check if marketing cookies are enabled
 */
export function hasMarketingConsent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const prefs = localStorage.getItem(COOKIE_PREFERENCES_KEY);
    if (prefs) {
      const parsed = JSON.parse(prefs);
      return parsed.marketing === true;
    }
  } catch {}
  return false;
}

/**
 * Track a custom event with Google Analytics
 * Usage: trackEvent('button_click', 'engagement', 'add_to_cart')
 */
export function trackEvent(
  action: string,
  category: string,
  label?: string,
  value?: number
) {
  if (!hasAnalyticsConsent()) return;
  
  if (typeof window !== "undefined" && (window as any).gtag) {
    (window as any).gtag("event", action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  }
}

/**
 * Track page view with Google Analytics
 * Usage: trackPageView('/menu')
 */
export function trackPageView(path: string) {
  if (!hasAnalyticsConsent()) return;
  
  if (typeof window !== "undefined" && (window as any).gtag) {
    (window as any).gtag("config", GOOGLE_ANALYTICS_ID, {
      page_path: path,
    });
  }
}

/**
 * Track Facebook Pixel event
 * Usage: trackFBEvent('AddToCart', { value: 29.99, currency: 'PKR' })
 */
export function trackFBEvent(
  eventName: string,
  params?: Record<string, any>
) {
  if (!hasMarketingConsent()) return;
  
  if (typeof window !== "undefined" && (window as any).fbq) {
    (window as any).fbq("track", eventName, params);
  }
}

/**
 * Track purchase for both Analytics and Marketing
 * Usage: trackPurchase('ORDER123', 299.99, [{ id: 'item1', name: 'Zinger' }])
 */
export function trackPurchase(
  orderId: string,
  total: number,
  items: Array<{ id: string; name: string; price?: number; quantity?: number }>
) {
  // Google Analytics
  if (hasAnalyticsConsent() && (window as any).gtag) {
    (window as any).gtag("event", "purchase", {
      transaction_id: orderId,
      value: total,
      currency: "PKR",
      items: items.map((item) => ({
        item_id: item.id,
        item_name: item.name,
        price: item.price,
        quantity: item.quantity || 1,
      })),
    });
  }

  // Facebook Pixel
  if (hasMarketingConsent() && (window as any).fbq) {
    (window as any).fbq("track", "Purchase", {
      value: total,
      currency: "PKR",
      content_ids: items.map((item) => item.id),
      content_type: "product",
    });
  }
}

/**
 * Track add to cart
 * Usage: trackAddToCart('item123', 'Zinger Burger', 299)
 */
export function trackAddToCart(
  itemId: string,
  itemName: string,
  price: number
) {
  // Google Analytics
  if (hasAnalyticsConsent() && (window as any).gtag) {
    (window as any).gtag("event", "add_to_cart", {
      currency: "PKR",
      value: price,
      items: [{ item_id: itemId, item_name: itemName, price }],
    });
  }

  // Facebook Pixel
  if (hasMarketingConsent() && (window as any).fbq) {
    (window as any).fbq("track", "AddToCart", {
      value: price,
      currency: "PKR",
      content_ids: [itemId],
      content_name: itemName,
    });
  }
}
