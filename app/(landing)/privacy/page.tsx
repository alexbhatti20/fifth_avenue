"use client";

import { motion } from "framer-motion";
import { Lock, Eye, Database, Shield, UserCheck, Bell, Trash2, Baby, FileEdit, Phone, Mail, MapPin } from "lucide-react";

const privacyData = [
  {
    icon: Database,
    title: "1. DATA WE SNATCH",
    content: "When you join the squad, we collect the basics: Name, Email, Phone, and that drop-off point you call Home. We also track your order history so we know which broast you're chasing."
  },
  {
    icon: Eye,
    title: "2. HOW WE USE THE INTEL",
    content: "Your info helps us drop the flavour on time. We use it to process orders, send you updates on your chase, and improve our secret sauce. We might hit you up with promotional deals too, but only if you're down."
  },
  {
    icon: UserCheck,
    title: "3. NO SNITCHING",
    content: "We don't sell your data to the competition. We only share it with the riders who bring you the food and the secure vaults (payment processors) that handle your cash. We're in this together."
  },
  {
    icon: Shield,
    title: "4. THE VAULT (SECURITY)",
    content: "We keep your details behind digital high-walls. Encrypted, secure, and monitored. We protect your data like we protect our secret seasoning recipe."
  },
  {
    icon: Lock,
    title: "5. COOKIE TRACES",
    content: "We use digital breadcrumbs (cookies) to remember your vibe. It makes the site faster and the chase smoother. You can turn them off in your browser, but the site might lose its kick."
  },
  {
    icon: Bell,
    title: "6. YOUR STREET RIGHTS",
    content: "You're in control. Access your data, fix what's wrong, or tell us to delete everything. You can opt-out of the hype at any time. Your squad, your choice."
  },
  {
    icon: Trash2,
    title: "7. HOLDING PERIOD",
    content: "We keep your info as long as you're part of the squad. If you go dark, we keep the history for the records, but your personal traces get wiped as per the law."
  },
  {
    icon: Baby,
    title: "8. YOUNG RECKONERS",
    content: "Our street food isn't meant for the little ones under 13 without supervision. We don't knowingly collect data from kids. Keep them safe, keep them fed."
  },
  {
    icon: FileEdit,
    title: "9. UPDATING THE SCRIPT",
    content: "The street evolves, and so does our policy. If we make a massive shift, we'll hit you up with a notification. Keep your eyes on the street."
  }
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white pt-[96px]">
      
      {/* Hero Section - Fifth Avenue Style */}
      <section className="relative min-h-[20vh] py-12 flex items-center overflow-hidden bg-[#008A45]">
        {/* Diagonal Split */}
        <div 
          className="absolute inset-0 z-0 bg-[#FFD200]"
          style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}
        />
        
        <div className="container-custom relative z-10 pt-4 px-6 mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-right"
          >
            <span className="font-caveat text-3xl text-white mb-1 block">Your privacy is sacred...</span>
            <h1 className="font-bebas text-5xl md:text-7xl text-black leading-none tracking-tighter">
              PRIVACY <span className="text-white drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]">POLICY</span>
            </h1>
          </motion.div>
        </div>

        {/* Floating Icon */}
        <div className="absolute left-[10%] top-1/2 -translate-y-1/2 hidden lg:block -rotate-12 opacity-20">
           <Shield className="w-48 h-48 text-black" strokeWidth={1} />
        </div>
      </section>

      {/* Privacy Content */}
      <section className="py-24">
        <div className="container-custom mx-auto px-6 max-w-5xl">
          
          {/* Quick Summary Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-black border-[8px] border-[#008A45] p-10 mb-20 shadow-[16px_16px_0px_0px_rgba(255,210,0,1)] rotate-1"
          >
            <h2 className="font-bebas text-5xl text-white mb-6 flex items-center gap-4">
              <Lock className="w-10 h-10 text-[#FFD200]" />
              THE SQUAD CODE
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {[
                "WE NEVER SELL YOUR STREET INTEL",
                "EVERY BYTE IS BEHIND HIGH WALLS",
                "YOU CONTROL YOUR FLAVOUR PROFILE",
                "WIPE YOUR TRACES ANYTIME"
              ].map((text, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-4 h-4 bg-[#ED1C24] border-2 border-white" />
                  <p className="font-bebas text-xl text-white/80 tracking-widest">{text}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Privacy Sections Grid */}
          <div className="grid md:grid-cols-2 gap-8">
            {privacyData.map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="bg-white border-4 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[4px] hover:translate-y-[4px] transition-all group"
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 bg-[#ED1C24] border-4 border-black flex items-center justify-center -rotate-6 group-hover:rotate-0 transition-transform">
                    <item.icon className="w-8 h-8 text-white" />
                  </div>
                  <h2 className="font-bebas text-3xl text-black leading-none uppercase">{item.title}</h2>
                </div>
                <p className="font-source-sans text-lg font-bold text-black/70 leading-tight uppercase tracking-tight">
                  {item.content}
                </p>
              </motion.div>
            ))}
          </div>

          {/* Contact Section */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-32 bg-[#FFD200] border-[12px] border-black p-12 relative"
          >
            <h3 className="font-bebas text-6xl text-black mb-4 text-center leading-none">
              DATA <span className="text-[#ED1C24]">DISCREPANCIES?</span>
            </h3>
            <p className="font-caveat text-3xl text-black/60 text-center mb-12">Talk to the head office, we'll fix it.</p>
            
            <div className="grid md:grid-cols-3 gap-10">
              <div className="flex flex-col items-center text-center space-y-4">
                <Mail className="w-12 h-12 text-[#ED1C24]" />
                <div>
                  <p className="font-bebas text-xl text-black">EMAIL</p>
                  <p className="font-source-sans text-lg font-black uppercase">PRIVACY@FIFTHAVENUE.PK</p>
                </div>
              </div>

              <div className="flex flex-col items-center text-center space-y-4">
                <Phone className="w-12 h-12 text-[#008A45]" />
                <div>
                  <p className="font-bebas text-xl text-black">PHONE</p>
                  <p className="font-source-sans text-lg font-black">+92 304 629 2822</p>
                </div>
              </div>

              <div className="flex flex-col items-center text-center space-y-4">
                <MapPin className="w-12 h-12 text-black" />
                <div>
                  <p className="font-bebas text-xl text-black">HUB</p>
                  <p className="font-source-sans text-lg font-black uppercase">VEHARI MAIN STREET</p>
                </div>
              </div>
            </div>
          </motion.div>

        </div>
      </section>
    </div>
  );
}
