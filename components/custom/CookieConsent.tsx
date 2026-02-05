"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cookie, Shield, Check, X, Settings, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import Link from "next/link";

const COOKIE_CONSENT_KEY = "zoiro_cookie_consent";
const COOKIE_PREFERENCES_KEY = "zoiro_cookie_preferences";

interface CookiePreferences {
  necessary: boolean;    // Always true - required for the site to work
  functional: boolean;   // Login, preferences, cart
  analytics: boolean;    // Usage tracking (optional)
  marketing: boolean;    // Ads and marketing (optional)
}

const DEFAULT_PREFERENCES: CookiePreferences = {
  necessary: true,
  functional: true,
  analytics: false,
  marketing: false,
};

export default function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    setMounted(true);
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      const timer = setTimeout(() => setShowBanner(true), 1500);
      return () => clearTimeout(timer);
    } else {
      // Load saved preferences
      try {
        const saved = localStorage.getItem(COOKIE_PREFERENCES_KEY);
        if (saved) {
          setPreferences(JSON.parse(saved));
        }
      } catch {}
    }
  }, []);

  const savePreferences = (prefs: CookiePreferences) => {
    localStorage.setItem(COOKIE_CONSENT_KEY, new Date().toISOString());
    localStorage.setItem(COOKIE_PREFERENCES_KEY, JSON.stringify(prefs));
    
    // Set cookie for server-side reading
    const cookieValue = encodeURIComponent(JSON.stringify(prefs));
    document.cookie = `cookie_consent=true; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    document.cookie = `cookie_preferences=${cookieValue}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    
    setShowBanner(false);
    setShowSettings(false);
  };

  const handleAcceptAll = () => {
    const allAccepted: CookiePreferences = {
      necessary: true,
      functional: true,
      analytics: true,
      marketing: true,
    };
    setPreferences(allAccepted);
    savePreferences(allAccepted);
  };

  const handleRejectNonEssential = () => {
    const essentialOnly: CookiePreferences = {
      necessary: true,
      functional: true, // Keep functional for login to work
      analytics: false,
      marketing: false,
    };
    setPreferences(essentialOnly);
    savePreferences(essentialOnly);
  };

  const handleSavePreferences = () => {
    savePreferences(preferences);
  };

  const updatePreference = (key: keyof CookiePreferences, value: boolean) => {
    if (key === 'necessary') return; // Can't disable necessary cookies
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  if (!mounted || !showBanner) return null;

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-0 left-0 right-0 z-[9999] p-4"
        >
          <div className="max-w-2xl mx-auto">
            <div className="bg-background/95 backdrop-blur-xl border border-primary/20 rounded-2xl shadow-2xl shadow-primary/10 overflow-hidden">
              {/* Main Banner */}
              <div className="p-5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  {/* Cookie Icon */}
                  <div className="p-3 bg-gradient-to-br from-primary/20 to-orange-500/20 rounded-xl shrink-0">
                    <Cookie className="w-6 h-6 text-primary" />
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
                      <span className="tracking-wider bg-gradient-to-r from-primary to-orange-500 bg-clip-text text-transparent">
                        Cookie Preferences
                      </span>
                      🍪
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      We use cookies to enhance your experience. Essential cookies keep you logged in, 
                      while optional cookies help us improve our service.{" "}
                      <Link href="/privacy" className="text-primary hover:underline font-medium">
                        Privacy Policy
                      </Link>
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-2 mt-4">
                  <Button 
                    onClick={handleAcceptAll}
                    className="flex-1 bg-gradient-to-r from-primary to-orange-500 hover:from-primary/90 hover:to-orange-500/90 text-white rounded-full h-10 font-semibold shadow-lg shadow-primary/25"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Accept All
                  </Button>
                  <Button 
                    onClick={handleRejectNonEssential}
                    variant="outline"
                    className="flex-1 rounded-full h-10 font-semibold border-muted-foreground/30 hover:bg-muted"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Essential Only
                  </Button>
                  <Button 
                    onClick={() => setShowSettings(!showSettings)}
                    variant="ghost"
                    className="flex-1 sm:flex-none rounded-full h-10 font-medium text-muted-foreground hover:text-foreground"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Manage
                    {showSettings ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
                  </Button>
                </div>
              </div>

              {/* Settings Panel */}
              <AnimatePresence>
                {showSettings && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 border-t border-border/50">
                      <div className="space-y-3 pt-4">
                        {/* Necessary Cookies */}
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">Essential Cookies</span>
                              <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">Required</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Required for the website to function. Cannot be disabled.
                            </p>
                          </div>
                          <Switch checked={true} disabled className="opacity-50" />
                        </div>

                        {/* Functional Cookies */}
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">Functional Cookies</span>
                              <span className="text-xs bg-blue-500/20 text-blue-500 px-2 py-0.5 rounded-full">Recommended</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Remember your login, preferences, and shopping cart.
                            </p>
                          </div>
                          <Switch 
                            checked={preferences.functional} 
                            onCheckedChange={(v) => updatePreference('functional', v)}
                          />
                        </div>

                        {/* Analytics Cookies */}
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex-1">
                            <span className="font-medium text-sm">Analytics Cookies</span>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Help us understand how visitors use our website.
                            </p>
                          </div>
                          <Switch 
                            checked={preferences.analytics} 
                            onCheckedChange={(v) => updatePreference('analytics', v)}
                          />
                        </div>

                        {/* Marketing Cookies */}
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex-1">
                            <span className="font-medium text-sm">Marketing Cookies</span>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Used to show relevant ads and measure campaign effectiveness.
                            </p>
                          </div>
                          <Switch 
                            checked={preferences.marketing} 
                            onCheckedChange={(v) => updatePreference('marketing', v)}
                          />
                        </div>
                      </div>

                      <Button 
                        onClick={handleSavePreferences}
                        className="w-full mt-4 bg-foreground text-background hover:bg-foreground/90 rounded-full h-10 font-semibold"
                      >
                        Save My Preferences
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              
              {/* Trust Badge */}
              <div className="flex items-center gap-2 px-5 py-3 border-t border-border/50 bg-muted/30">
                <Shield className="w-4 h-4 text-green-500" />
                <span className="text-xs text-muted-foreground">
                  Your privacy matters. We never sell your personal data.
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
