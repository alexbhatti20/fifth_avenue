"use client";

import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Phone, ArrowRight, Sparkles, Zap, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";

const HERO_PIZZA = "/assets/premium-hero-pizza.png";

export default function Hero() {
  const containerRef = useRef(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const springConfig = { stiffness: 100, damping: 30, restDelta: 0.001 };
  const y = useSpring(useTransform(scrollYProgress, [0, 1], [0, 300]), springConfig);
  const rotate = useSpring(useTransform(scrollYProgress, [0, 1], [0, 90]), springConfig);
  const scale = useSpring(useTransform(scrollYProgress, [0, 1], [1, 1.2]), springConfig);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({
        x: (e.clientX / window.innerWidth - 0.5) * 20,
        y: (e.clientY / window.innerHeight - 0.5) * 20,
      });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  return (
    <section ref={containerRef} className="relative min-h-[100vh] lg:min-h-[120vh] flex flex-col items-center justify-center overflow-hidden bg-[#111111]">

      {/* Dynamic Background Layer */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[#FFD200]" style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 85%)" }} />
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
      </div>

      <div className="container-custom relative z-10 w-full px-6 flex flex-col items-center justify-center pt-24 lg:pt-0">

        {/* Mobile-First Layout: Vertical Stack */}
        <div className="flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-20 w-full">

          {/* Main Visual Core */}
          <div className="relative order-1 lg:order-2">
            {/* The Vertical "Road" Strap - DESKTOP ONLY */}
            <motion.div
              style={{ y: y }}
              className="absolute top-[-100vh] bottom-[-100vh] left-1/2 -translate-x-1/2 w-32 md:w-48 lg:w-80 bg-[#111111] z-0 shadow-2xl hidden lg:block"
            />

            {/* Pizza Core with Kinetic Rotation */}
            <motion.div
              style={{ scale, x: mousePos.x, y: mousePos.y }}
              className="relative z-10 w-64 h-64 sm:w-80 sm:h-80 lg:w-[550px] lg:h-[550px]"
            >
              {/* Outer Decorative Rings - DESKTOP ONLY */}
              <div className="absolute inset-[-10px] lg:inset-[-20px] border-[5px] lg:border-[10px] border-black rounded-full z-0 hidden lg:block" />
              <div className="absolute inset-[-20px] lg:inset-[-40px] border-[1px] lg:border-[2px] border-dashed border-black/30 rounded-full animate-spin-slow hidden lg:block" />

              <div className="relative w-full h-full rounded-full border-[10px] lg:border-[30px] border-[#111111] shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5)] lg:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7)] overflow-hidden bg-white">
                <Image
                  src={HERO_PIZZA}
                  alt="Fifth Avenue Core"
                  fill
                  priority
                  className="object-cover"
                />
              </div>

              {/* Dynamic "Urban Craft" Badge - DESKTOP ONLY */}
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute top-0 right-[-10px] lg:top-[-20px] lg:right-[-30px] z-30 hidden lg:block"
              >
                <div className="relative group">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                    className="w-24 h-24 lg:w-36 lg:h-36 rounded-full border-2 border-dashed border-black/30 flex items-center justify-center p-2"
                  >
                    <svg viewBox="0 0 100 100" className="w-full h-full">
                      <path id="circlePath" d="M 50, 50 m -37, 0 a 37,37 0 1,1 74,0 a 37,37 0 1,1 -74,0" fill="none" />
                      <text className="font-bebas text-[12px] lg:text-[14px] uppercase tracking-[0.2em] fill-black">
                        <textPath xlinkHref="#circlePath">
                          • URBAN CRAFT • PREMIUM QUALITY • STREET STYLE •
                        </textPath>
                      </text>
                    </svg>
                  </motion.div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-black text-[#FFD200] p-3 lg:p-4 rounded-full shadow-xl border-2 border-white">
                      <Sparkles className="w-4 h-4 lg:w-6 lg:h-6 fill-[#FFD200]" />
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Branding Disc - DESKTOP ONLY */}
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                className="absolute -bottom-4 -left-4 lg:-bottom-10 lg:-left-10 w-24 h-24 lg:w-56 lg:h-56 bg-[#FFD200] rounded-full border-4 lg:border-8 border-black flex items-center justify-center shadow-2xl z-20 hidden lg:flex"
              >
                <div className="flex flex-col items-center p-2 lg:p-4 text-center">
                  <span className="font-bebas text-[10px] lg:text-3xl text-black leading-none">FIFTH AVENUE</span>
                  <div className="w-full h-0.5 bg-black my-1 lg:my-2" />
                  <span className="font-caveat text-[8px] lg:text-lg text-black font-bold uppercase">Chasing Flavours</span>
                </div>
              </motion.div>
            </motion.div>
          </div>

          {/* Typography Content */}
          <div className="flex flex-col items-center lg:items-start text-center lg:text-left order-2 lg:order-1 max-w-2xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-black text-[#FFD200] px-4 py-1 font-bebas text-sm md:text-xl mb-4 lg:mb-8 border-l-4 border-white inline-block"
            >
              PREMIUM STREET FOOD
            </motion.div>

            <div className="relative mb-8 lg:mb-12">
              <h1 className="font-bebas text-[5.5rem] sm:text-[7rem] lg:text-[10rem] leading-[0.75] text-black tracking-[0.05em] lg:tracking-tighter uppercase">
                FIFTH <br />
                <span className="text-white drop-shadow-[4px_4px_0px_rgba(0,0,0,1)] lg:drop-shadow-[8px_8px_0px_rgba(0,0,0,1)]">AVENUE</span>
              </h1>
              <motion.span
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="font-caveat text-4xl sm:text-5xl lg:text-7xl text-[#ED1C24] absolute bottom-[-64px] right-[-15px] lg:bottom-[-56px] lg:right-[-200px] whitespace-nowrap drop-shadow-lg z-20 rotate-[-5deg] lg:rotate-0"
              >
                Chasing Flavours
              </motion.span>
            </div>

            <p className="font-source-sans text-lg lg:text-2xl font-bold text-black/60 mb-8 lg:mb-12 uppercase tracking-tighter">
              Vehari's Original <span className="text-black">Pizza Watch</span> Engine.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-6 lg:gap-10 w-full sm:w-auto">
              <Link href="/menu" className="w-full sm:w-auto">
                <Button className="w-full sm:w-auto h-16 lg:h-24 px-10 lg:px-16 bg-black text-white rounded-none font-bebas text-2xl lg:text-4xl tracking-widest hover:bg-white hover:text-black transition-all border-4 border-black shadow-[10px_10px_0px_0px_rgba(255,210,0,1)] group">
                  ORDER NOW
                  <ArrowRight className="ml-3 lg:ml-4 w-6 lg:w-8 h-6 lg:h-8 group-hover:translate-x-2 transition-transform" />
                </Button>
              </Link>

              <div className="flex flex-col items-center lg:items-start">
                <span className="font-bebas text-xs lg:text-sm text-black/40 tracking-widest uppercase">The Squad Hotline</span>
                <div className="font-bebas text-xl lg:text-3xl text-black leading-tight">
                  0304-1116617 <br />
                  0330-2506617
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Decorative Branding Line - DESKTOP ONLY */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 opacity-10 hidden md:flex">
        <div className="h-px w-20 bg-black" />
        <p className="font-bebas text-xl tracking-[0.5em] text-black">FIFTH AVENUE PIZZA — CHASING FLAVOURS</p>
        <div className="h-px w-20 bg-black" />
      </div>
    </section>
  );
}
