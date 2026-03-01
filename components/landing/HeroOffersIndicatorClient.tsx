"use client";

import { useEffect, useState } from "react";
import { motion, useAnimation } from "framer-motion";
import { Flame, Tag } from "lucide-react";
import Link from "next/link";

/**
 * Floating offers indicator — top-right corner, below the navbar.
 * Receives count from SSR parent (HeroOffersIndicator server component).
 */
export default function HeroOffersIndicatorClient({ count }: { count: number }) {
  const shakeControls = useAnimation();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Hide when mobile nav drawer opens
  useEffect(() => {
    const handler = (e: Event) => setIsDrawerOpen((e as CustomEvent<boolean>).detail);
    window.addEventListener('zoiro:drawer', handler);
    return () => window.removeEventListener('zoiro:drawer', handler);
  }, []);

  // Vibrate / shake loop every 5 seconds
  useEffect(() => {
    if (count === 0) return;

    const runShake = async () => {
      await shakeControls.start({
        x: [0, -5, 5, -4, 4, -2, 2, 0],
        transition: { duration: 0.5, ease: "easeInOut" },
      });
    };

    runShake(); // immediate first shake
    const id = setInterval(runShake, 5000);
    return () => clearInterval(id);
  }, [count, shakeControls]);

  if (count === 0 || isDrawerOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -30, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.9, type: "spring", stiffness: 220, damping: 16 }}
      // Fixed: top-right, just below the navbar (top-20 = 80px)
      className="fixed top-20 right-3 z-[60] sm:top-[88px] sm:right-5"
    >
      <Link href="/offers" className="group block">
        {/* Outer glow ring — pulsing */}
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          animate={{
            boxShadow: [
              "0 0 0 0 rgba(220,38,38,0)",
              "0 0 0 8px rgba(220,38,38,0.35)",
              "0 0 0 0 rgba(220,38,38,0)",
            ],
          }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        />

        <motion.div
          animate={shakeControls}
          whileHover={{ scale: 1.06, y: -1 }}
          whileTap={{ scale: 0.95 }}
          className="relative overflow-hidden rounded-2xl border border-orange-500/40"
          style={{
            background: "linear-gradient(145deg, #dc2626 0%, #991b1b 45%, #7c2d12 100%)",
            boxShadow: "0 4px 20px rgba(220,38,38,0.55), inset 0 1px 0 rgba(255,255,255,0.12)",
          }}
        >
          {/* Lava blob top-left */}
          <motion.div
            className="absolute -top-8 -left-8 w-20 h-20 rounded-full blur-2xl opacity-60 pointer-events-none"
            style={{ background: "radial-gradient(circle, #f97316 0%, transparent 70%)" }}
            animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0.75, 0.4] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Shimmer sweep */}
          <motion.div
            className="absolute inset-0 pointer-events-none opacity-25"
            style={{
              background: "linear-gradient(105deg, transparent 30%, rgba(255,200,100,0.5) 50%, transparent 70%)",
            }}
            animate={{ x: ["-100%", "100%"] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "linear", repeatDelay: 1.5 }}
          />

          {/* Content row */}
          <div className="relative flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5">
            {/* Flame stack */}
            <div className="relative flex-shrink-0">
              <motion.div
                animate={{ y: [0, -2, 0], scale: [1, 1.12, 1] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              >
                <Flame className="h-5 w-5 text-yellow-300 drop-shadow-[0_0_8px_rgba(253,224,71,1)]" />
              </motion.div>
              {/* Live ping dot */}
              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-300 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-300" />
              </span>
            </div>

            {/* Text */}
            <div className="flex flex-col leading-none min-w-0">
              <span className="text-[9px] font-semibold uppercase tracking-widest text-orange-200/80">
                🔥 Hot
              </span>
              <span className="text-white font-bold text-[13px] whitespace-nowrap">
                {count} Offer{count !== 1 ? "s" : ""} Live
              </span>
            </div>

            {/* Badge count */}
            <motion.span
              className="bg-yellow-400 text-red-900 text-[10px] font-extrabold rounded-full px-1.5 py-0.5 leading-none flex-shrink-0"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            >
              {count}
            </motion.span>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
}
