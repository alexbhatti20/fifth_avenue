"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { UtensilsCrossed, Zap, Trophy, Heart } from "lucide-react";

const ABOUT_IMAGE = "https://images.unsplash.com/photo-1556742044-3c52d6e88c62?auto=format&fit=crop&q=80&w=800";

const features = [
  {
    icon: Zap,
    title: "Urban Speed",
    description: "Fast-paced service for the city life. We don't just serve; we deliver at urban speed.",
  },
  {
    icon: UtensilsCrossed,
    title: "Bold Flavours",
    description: "No boring bites here. Every dish is a chase for the ultimate flavour experience.",
  },
  {
    icon: Trophy,
    title: "Fresh Quality",
    description: "The street's finest ingredients, prepared fresh daily in our urban kitchen.",
  },
  {
    icon: Heart,
    title: "Made in Vehari",
    description: "Proudly serving the heart of Vehari with our signature Fifth Avenue vibe.",
  },
];

export default function About() {
  return (
    <section id="about" className="py-32 bg-[#008A45] relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/black-linen.png')]" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-20 items-center">
          
          {/* Image Side */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative"
          >
            {/* Bold Frame */}
            <div className="relative border-[12px] border-black shadow-[20px_20px_0px_0px_rgba(255,210,0,1)]">
              <Image
                src={ABOUT_IMAGE}
                alt="Fifth Avenue Kitchen"
                width={800}
                height={1000}
                className="w-full object-cover grayscale-[0.2] hover:grayscale-0 transition-all duration-700"
              />
              
              {/* Overlay Text */}
              <div className="absolute bottom-10 left-10 bg-black text-[#FFD200] p-6 max-w-xs">
                <span className="font-bebas text-4xl leading-none">THE URBAN KITCHEN REVOLUTION</span>
              </div>
            </div>
          </motion.div>

          {/* Content Side */}
          <div className="flex flex-col text-white">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <span className="font-caveat text-4xl text-[#FFD200] mb-4 block">Chasing the dream...</span>
              <h2 className="font-bebas text-6xl md:text-8xl leading-none mb-8">
                STREET FOOD <br />
                <span className="text-black">REDEFINED</span>
              </h2>
              <p className="font-source-sans text-xl font-medium leading-tight mb-12 max-w-xl opacity-90 border-l-4 border-[#FFD200] pl-6">
                Fifth Avenue isn't just a name; it's a destination for flavor hunters. We've brought the energy of the urban streets to Vehari, creating a menu that's as bold and vibrant as the city itself.
              </p>
            </motion.div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
              {features.map((feature, index) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="flex flex-col gap-4 group"
                >
                  <div className="w-16 h-16 bg-[#FFD200] border-4 border-black flex items-center justify-center text-black group-hover:scale-110 transition-transform shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <feature.icon className="w-8 h-8" strokeWidth={2.5} />
                  </div>
                  <div>
                    <h4 className="font-bebas text-3xl mb-2 tracking-wide text-white group-hover:text-[#FFD200] transition-colors">
                      {feature.title}
                    </h4>
                    <p className="font-source-sans text-sm opacity-80 leading-snug">
                      {feature.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
