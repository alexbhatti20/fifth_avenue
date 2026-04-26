"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { 
  Facebook, Instagram, Twitter, Mail, Phone, MapPin, ArrowRight 
} from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-black text-white py-24 relative overflow-hidden">
      {/* Decorative Texture */}
      <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-16">
          
          {/* Brand Column */}
          <div className="col-span-1 md:col-span-2 lg:col-span-1">
            <Link href="/" className="flex flex-col items-start group mb-8">
              <div className="relative">
                 <span className="font-bebas text-4xl tracking-tight leading-none text-white">
                  FIFTH AVENUE
                </span>
                {/* The Golden Arc from the logo image */}
                <div className="absolute -bottom-2 left-0 w-full h-[2px] bg-[#FFD200]" />
                <div className="absolute -bottom-4 right-0 bg-[#FFD200] px-1.5 py-0.5 border border-black transform rotate-[-2deg]">
                  <span className="font-bebas text-[10px] text-black">PIZZA CO.</span>
                </div>
              </div>
              <div className="mt-6 flex items-center gap-2">
                <span className="font-caveat text-3xl text-[#ED1C24]">Chasing Flavours</span>
              </div>
            </Link>
            <p className="font-source-sans text-lg font-medium opacity-70 mb-10 leading-snug">
              Redefining the urban street food experience in Vehari. Bold bites, fast pace, and flavors you'll keep chasing.
            </p>
            <div className="flex gap-4">
              {[Facebook, Instagram, Twitter].map((Icon, i) => (
                <Link 
                  key={i} 
                  href="#" 
                  className="w-12 h-12 bg-white text-black flex items-center justify-center border-2 border-white hover:bg-[#FFD200] hover:text-black transition-all shadow-[4px_4px_0px_0px_rgba(0,138,69,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
                >
                  <Icon className="w-6 h-6" strokeWidth={2.5} />
                </Link>
              ))}
            </div>
          </div>

          {/* Nav Links */}
          <div>
            <h4 className="font-bebas text-3xl text-[#FFD200] mb-8 tracking-widest border-b-2 border-[#FFD200] pb-2 inline-block">THE SQUAD</h4>
            <ul className="flex flex-col gap-4">
              {[
                { name: "HOME", href: "/" },
                { name: "URBAN MENU", href: "/menu" },
                { name: "OUR STORY", href: "/#about" },
                { name: "HOT OFFERS", href: "/offers" },
                { name: "CONTACT HUB", href: "/contact" }
              ].map((link) => (
                <li key={link.name}>
                  <Link href={link.href} className="font-bebas text-xl hover:text-[#FFD200] flex items-center gap-2 group transition-all">
                    <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Hub */}
          <div>
            <h4 className="font-bebas text-3xl text-[#FFD200] mb-8 tracking-widest border-b-2 border-[#FFD200] pb-2 inline-block">THE HUB</h4>
            <ul className="flex flex-col gap-6">
              <li className="flex items-start gap-4">
                <div className="bg-[#FFD200] p-2 border border-black">
                  <MapPin className="w-5 h-5 text-black" />
                </div>
                <span className="font-source-sans font-bold text-lg opacity-80 uppercase tracking-tight">Main Bazaar, Vehari City</span>
              </li>
              <li className="flex items-start gap-4">
                <div className="bg-[#FFD200] p-2 border border-black">
                  <Phone className="w-5 h-5 text-black" />
                </div>
                <span className="font-source-sans font-bold text-lg opacity-80">+92 304 629 2822</span>
              </li>
              <li className="flex items-start gap-4">
                <div className="bg-[#FFD200] p-2 border border-black">
                  <Mail className="w-5 h-5 text-black" />
                </div>
                <span className="font-source-sans font-bold text-lg opacity-80">zorobroast@gmail.com</span>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="mt-24 pt-12 border-t-2 border-white/20 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex gap-8">
            <Link href="/privacy" className="font-bebas text-lg tracking-widest hover:text-[#FFD200] transition-colors">PRIVACY</Link>
            <Link href="/terms" className="font-bebas text-lg tracking-widest hover:text-[#FFD200] transition-colors">TERMS</Link>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bebas text-lg tracking-widest opacity-50">CRAFTED IN VEHARI WITH</span>
            <div className="bg-[#ED1C24] p-1.5 animate-pulse">
              <Link href="https://waqarx.me" className="text-white">W</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
