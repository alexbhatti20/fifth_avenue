"use client";

import { motion } from "framer-motion";
import { MapPin, Phone, Clock, Send, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LocationSection() {
  return (
    <section className="py-32 bg-[#FFD200] border-y-8 border-black overflow-hidden">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-20 items-center">
          
          {/* Content Side */}
          <div className="order-2 lg:order-1">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="bg-black text-white px-6 py-2 inline-block mb-6 shadow-[6px_6px_0px_0px_rgba(0,138,69,1)]">
                <span className="font-bebas text-2xl tracking-widest uppercase">THE URBAN HUB</span>
              </div>
              
              <h2 className="font-bebas text-6xl md:text-8xl text-black leading-[0.85] mb-8">
                FIND US ON <br />
                <span className="text-white drop-shadow-[4px_4px_0px_rgba(0,0,0,1)]">FIFTH AVENUE</span>
              </h2>
              
              <p className="font-source-sans text-xl font-bold text-black/80 leading-tight mb-12 border-l-4 border-black pl-6">
                The chase for flavour starts here. Visit our flagship hub in the heart of Vehari and join the urban squad.
              </p>
            </motion.div>

            {/* Contact Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {[
                { icon: MapPin, title: "STREET ADDRESS", detail: "Main Bazaar, Vehari City" },
                { icon: Phone, title: "HOTLINE", detail: "+92 300 1234567" },
                { icon: Clock, title: "OPENING TIMES", detail: "DAILY 11AM - 11PM" },
                { icon: Zap, title: "FAST DELIVERY", detail: "WITHIN 30 MINS" }
              ].map((item, index) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white border-4 border-black p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
                >
                  <div className="w-12 h-12 bg-[#008A45] border-2 border-black flex items-center justify-center text-white mb-4">
                    <item.icon className="w-6 h-6" strokeWidth={2.5} />
                  </div>
                  <h4 className="font-bebas text-2xl text-black leading-none mb-1">{item.title}</h4>
                  <p className="font-source-sans text-sm font-bold text-black/60">{item.detail}</p>
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mt-12"
            >
              <Button className="rounded-none bg-black text-white px-10 py-8 text-2xl font-bebas tracking-widest hover:bg-[#ED1C24] transition-all shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]">
                GET DIRECTIONS
                <Send className="ml-3 w-6 h-6" strokeWidth={2.5} />
              </Button>
            </motion.div>
          </div>

          {/* Map Side */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="order-1 lg:order-2"
          >
            <div className="relative mx-auto w-full aspect-square border-[12px] border-black shadow-[20px_20px_0px_0px_rgba(0,138,69,1)] bg-white">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d110094.32834645576!2d72.27752705!3d30.02969975!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3922f5e4e4e4e4e5%3A0x1a1a1a1a1a1a1a1a!2sVehari%2C%20Punjab%2C%20Pakistan!5e0!3m2!1sen!2s!4v1700000000000!5m2!1sen!2s"
                width="100%"
                height="100%"
                style={{ border: 0, filter: 'grayscale(1) invert(0.1)' }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer"
                title="Fifth Avenue Location"
              />
              {/* Spinning Overlay Badge */}
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                className="absolute -top-12 -right-12 w-32 h-32 bg-[#ED1C24] border-4 border-black rounded-full flex items-center justify-center p-4"
              >
                <span className="font-bebas text-lg text-white text-center leading-tight">WE ARE <br /> HERE!</span>
              </motion.div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
}
