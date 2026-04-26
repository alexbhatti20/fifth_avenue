"use client";

import { motion } from "framer-motion";
import { Scale, Mail, Phone, MapPin } from "lucide-react";
import Link from "next/link";

const termsData = [
  {
    title: "1. ACCEPTANCE OF TERMS",
    content: "By hitting the Fifth Avenue streets, you're agreeing to our rules. If you can't handle the heat, stay out of the kitchen. Continued use of our broast hub means you're down with everything listed here."
  },
  {
    title: "2. OUR SERVICES",
    content: "We provide high-octane broasts, burgers, and street food. We reserve the right to switch up the menu, adjust prices, or pause the chase at any time. We're all about quality, all the time."
  },
  {
    title: "3. YOUR SQUAD ACCOUNT",
    content: "To join the inner circle, you need an account. Keep your secret codes safe. You're responsible for everything that happens under your name on the street."
  },
  {
    title: "4. ORDERS & DAMAGE",
    content: "All orders are subject to the availability of our secret ingredients. Prices are in PKR and include the tax. We accept COD, Bank Transfer, and mobile wallets. No cash, no chase."
  },
  {
    title: "5. THE DROP (DELIVERY)",
    content: "We aim to drop the flavour in 30-45 minutes. Traffic, weather, or absolute chaos might slow us down, but we never stop. Free delivery on orders over Rs. 500."
  },
  {
    title: "6. CANCELLATIONS",
    content: "Changed your mind? You've got 5 minutes. Once the broast is in the fryer, there's no turning back. Quality issues? Reach out and we'll make it right."
  },
  {
    title: "7. STREET QUALITY",
    content: "Freshness is our religion. If your order isn't hitting the spot or seems off, drop us a line immediately. We don't settle for 'okay'."
  },
  {
    title: "8. LIABILITY LIMITS",
    content: "We're not responsible for your obsession with our sauce. Legally, our liability is capped at the value of your order. Keep it street."
  },
  {
    title: "9. INTELLECTUAL PROPERTY",
    content: "The Fifth Avenue logo, the 'Chasing Flavours' tagline, and every pixel on this site are ours. Don't bite our style without asking."
  },
  {
    title: "10. CHANGES TO THE RULES",
    content: "The street changes, and so do our terms. Check back often. Your continued presence in the squad means you're good with the updates."
  }
];

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white pt-[96px]">
      
      {/* Hero Section - Fifth Avenue Style */}
      <section className="relative min-h-[20vh] py-12 flex items-center overflow-hidden bg-[#FFD200]">
        {/* Diagonal Split */}
        <div 
          className="absolute inset-0 z-0 bg-[#ED1C24]"
          style={{ clipPath: 'polygon(100% 0, 0% 100%, 100% 100%)' }}
        />
        
        <div className="container-custom relative z-10 pt-4 px-6 mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <span className="font-caveat text-3xl text-[#008A45] mb-1 block">The rules of the chase...</span>
            <h1 className="font-bebas text-5xl md:text-7xl text-black leading-none tracking-tighter">
              TERMS & <span className="text-white drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]">CONDITIONS</span>
            </h1>
          </motion.div>
        </div>

        {/* Floating Icon */}
        <div className="absolute right-[10%] top-1/2 -translate-y-1/2 hidden lg:block rotate-12 opacity-20">
           <Scale className="w-48 h-48 text-black" strokeWidth={1} />
        </div>
      </section>

      {/* Terms Content */}
      <section className="py-24">
        <div className="container-custom mx-auto px-6 max-w-5xl">
          <div className="grid gap-12">
            {termsData.map((term, index) => (
              <motion.div
                key={term.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group"
              >
                <div className="flex flex-col md:flex-row gap-6 items-start">
                  <div className="flex-shrink-0 w-16 h-16 bg-black text-[#FFD200] flex items-center justify-center font-bebas text-3xl border-4 border-[#ED1C24] shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] group-hover:translate-x-[4px] group-hover:translate-y-[4px] group-hover:shadow-none transition-all">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <h2 className="font-bebas text-4xl text-black mb-4 tracking-tight group-hover:text-[#ED1C24] transition-colors">
                      {term.title}
                    </h2>
                    <div className="bg-white border-4 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] group-hover:shadow-[12px_12px_0px_0px_rgba(0,138,69,1)] transition-all">
                      <p className="font-source-sans text-xl font-bold text-black/80 leading-relaxed uppercase tracking-wide">
                        {term.content}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="mt-32 bg-black border-[12px] border-[#FFD200] p-12 relative overflow-hidden"
          >
            <div className="relative z-10">
              <h3 className="font-bebas text-6xl text-white mb-4 text-center leading-none">
                QUESTIONS ABOUT <span className="text-[#FFD200]">THE LAW?</span>
              </h3>
              <p className="font-caveat text-3xl text-[#ED1C24] text-center mb-12">Don't be a stranger, drop the line.</p>
              
              <div className="grid md:grid-cols-3 gap-10">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-20 h-20 bg-[#008A45] border-4 border-white flex items-center justify-center rotate-3">
                    <Mail className="w-10 h-10 text-white" />
                  </div>
                  <div>
                    <p className="font-bebas text-xl text-[#FFD200]">EMAIL US</p>
                    <p className="font-source-sans text-lg font-black text-white uppercase">CHASE@FIFTHAVENUE.PK</p>
                  </div>
                </div>

                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-20 h-20 bg-[#ED1C24] border-4 border-white flex items-center justify-center -rotate-3">
                    <Phone className="w-10 h-10 text-white" />
                  </div>
                  <div>
                    <p className="font-bebas text-xl text-[#FFD200]">CALL THE HUB</p>
                    <p className="font-source-sans text-lg font-black text-white">+92 304 629 2822</p>
                  </div>
                </div>

                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-20 h-20 bg-white border-4 border-[#FFD200] flex items-center justify-center rotate-6">
                    <MapPin className="w-10 h-10 text-black" />
                  </div>
                  <div>
                    <p className="font-bebas text-xl text-[#FFD200]">LOCATE US</p>
                    <p className="font-source-sans text-lg font-black text-white uppercase">STREET 5, VEHARI</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
