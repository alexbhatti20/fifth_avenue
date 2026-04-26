"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface PageHeroProps {
  title: string;
  subtitle?: string;
  accentText?: string;
  image?: string;
  className?: string;
}

export default function PageHero({
  title,
  subtitle = "NOW SERVING IN",
  accentText = "Chasing Flavours",
  image = "/assets/hero-pizza.png",
  className,
}: PageHeroProps) {
  return (
    <section className={cn("relative h-[40vh] md:h-[50vh] flex items-center overflow-hidden bg-[#FFD200]", className)}>
      {/* Green Triangle Background */}
      <div 
        className="absolute top-0 right-0 h-full w-[40%] bg-[#008A45] z-0" 
        style={{ clipPath: "polygon(100% 0, 100% 100%, 0% 100%)" }} 
      />

      {/* Pattern Overlay */}
      <div className="absolute inset-0 z-0 opacity-10 pointer-events-none mix-blend-multiply bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />

      <div className="container-custom relative z-10 w-full">
        <div className="flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            className="flex flex-col items-start"
          >
            {/* Small Branding Header */}
            <div className="flex flex-col mb-4">
               <p className="font-bebas text-lg md:text-2xl text-black leading-none">FIFTH AVENUE</p>
               <div className="h-0.5 w-12 bg-black mt-1" />
            </div>

            {/* Main Headlines */}
            <div className="relative">
              <p className="font-bebas text-xl md:text-3xl text-black tracking-widest mb-1">{subtitle}</p>
              <h1 className="font-bebas text-7xl md:text-[9rem] text-black leading-[0.8] tracking-tighter uppercase">
                {title}
              </h1>
              
              {/* Red Handwritten Accent */}
              <motion.div
                initial={{ opacity: 0, rotate: -5, scale: 0.8 }}
                animate={{ opacity: 1, rotate: -2, scale: 1 }}
                transition={{ delay: 0.5, duration: 0.5 }}
                className="absolute -bottom-6 md:-bottom-10 right-0 md:-right-20 bg-[#ED1C24] px-4 py-1 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
              >
                <span className="font-caveat text-xl md:text-4xl text-white whitespace-nowrap">
                  {accentText}
                </span>
              </motion.div>
            </div>
          </motion.div>

          {/* Floating Image on the right */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, rotate: 10 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="hidden lg:block relative w-[400px] h-[400px]"
          >
            <div className="relative w-full h-full rounded-full border-[15px] border-black shadow-[20px_20px_0px_0px_rgba(0,0,0,0.2)] overflow-hidden bg-white">
              <Image
                src={image}
                alt="Branding Visual"
                fill
                priority
                className="object-cover"
              />
            </div>
          </motion.div>
        </div>
      </div>

      {/* Decorative Text */}
      <div className="absolute bottom-4 left-4 opacity-20 pointer-events-none">
        <p className="font-bebas text-sm md:text-base tracking-[0.4em] text-black">AVENUE OF TASTE / SINCE 2024 / VEHARI</p>
      </div>
    </section>
  );
}
