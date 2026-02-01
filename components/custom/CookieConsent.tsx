"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cookie, Shield, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const COOKIE_CONSENT_KEY = "zoiro_cookie_consent";

export default function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const consent = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consent) {
      const timer = setTimeout(() => setShowBanner(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, new Date().toISOString());
    document.cookie = `cookie_consent=true; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    setShowBanner(false);
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
            <div className="bg-background/95 backdrop-blur-xl border border-primary/20 rounded-2xl shadow-2xl shadow-primary/10 p-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                {/* Cookie Icon */}
                <div className="p-3 bg-gradient-to-br from-primary/20 to-orange-500/20 rounded-xl shrink-0">
                  <Cookie className="w-6 h-6 text-primary" />
                </div>
                
                <div className="flex-1">
                  <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
                    <span className="tracking-wider bg-gradient-to-r from-primary to-orange-500 bg-clip-text text-transparent">
                      We Use Cookies
                    </span>
                    🍪
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    We use cookies to keep you logged in and remember your preferences.{" "}
                    <Link href="/privacy" className="text-primary hover:underline">
                      Learn more
                    </Link>
                  </p>
                </div>

                {/* Action Button */}
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button 
                    onClick={handleAccept}
                    className="flex-1 sm:flex-none bg-gradient-to-r from-primary to-orange-500 hover:from-primary/90 hover:to-orange-500/90 text-white rounded-full h-10 px-6 font-semibold shadow-lg shadow-primary/25"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Accept
                  </Button>
                </div>
              </div>
              
              {/* Trust Badge */}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                <Shield className="w-4 h-4 text-green-500" />
                <span className="text-xs text-muted-foreground">
                  Your data stays safe. We only use essential cookies.
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
