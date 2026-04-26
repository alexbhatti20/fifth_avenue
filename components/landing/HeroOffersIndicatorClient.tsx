"use client";

import { useEffect, useState } from "react";
import { motion, useAnimation } from "framer-motion";
import { Sparkles, Tag, Zap } from "lucide-react";
import Link from "next/link";

export default function HeroOffersIndicatorClient({ count }: { count: number }) {
  const shakeControls = useAnimation();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => setIsDrawerOpen((e as CustomEvent<boolean>).detail);
    window.addEventListener('zoiro:drawer', handler);
    return () => window.removeEventListener('zoiro:drawer', handler);
  }, []);

  useEffect(() => {
    if (count === 0) return;

    const runShake = async () => {
      await shakeControls.start({
        rotate: [0, -10, 10, -10, 10, 0],
        transition: { duration: 0.5, ease: "easeInOut" },
      });
    };

    runShake();
    const id = setInterval(runShake, 5000);
    return () => clearInterval(id);
  }, [count, shakeControls]);

  if (count === 0 || isDrawerOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 1.5, type: "spring" }}
      className="fixed top-24 right-6 z-[60]"
    >
      <Link href="/offers" className="group block">
        <motion.div
          animate={shakeControls}
          whileHover={{ scale: 1.1, rotate: 5 }}
          whileTap={{ scale: 0.9 }}
          className="bg-[#ED1C24] border-4 border-black px-4 py-2 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex items-center gap-3 group-hover:shadow-none group-hover:translate-x-[2px] group-hover:translate-y-[2px] transition-all"
        >
          <div className="bg-white p-1 border-2 border-black relative">
            <Zap className="w-5 h-5 text-black fill-black" />
            <span className="absolute -top-2 -right-2 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FFD200] opacity-75" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-[#FFD200] border border-black" />
            </span>
          </div>
          
          <div className="flex flex-col leading-none">
            <span className="font-bebas text-xs tracking-widest text-white">HOT DEALS</span>
            <span className="font-bebas text-xl text-black">
              {count} {count === 1 ? 'OFFER' : 'OFFERS'} LIVE
            </span>
          </div>
          
          <Sparkles className="w-5 h-5 text-[#FFD200]" fill="#FFD200" />
        </motion.div>
      </Link>
    </motion.div>
  );
}
