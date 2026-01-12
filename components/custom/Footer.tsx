"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import Link from "next/link";
import { MapPin, Phone, Clock, Facebook, Instagram, Twitter } from "lucide-react";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 15,
    },
  },
};

export default function Footer() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <footer className="bg-foreground text-background overflow-hidden" ref={ref}>
      <div className="container-custom py-12 sm:py-16 md:py-20">
        <motion.div
          className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10 lg:gap-12"
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          {/* Brand */}
          <motion.div variants={itemVariants} className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-3 mb-3 sm:mb-4">
              <motion.div
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden shadow-lg"
                initial={{ opacity: 0, scale: 0 }}
                animate={isInView ? { opacity: 1, scale: 1 } : {}}
                transition={{ delay: 0.1, type: "spring" }}
                whileHover={{ scale: 1.1, rotate: 5 }}
              >
                <img 
                  src="/assets/zoiro-logo.png" 
                  alt="ZOIRO Broast" 
                  className="w-full h-full object-cover"
                />
              </motion.div>
              <motion.h3
                className="text-3xl sm:text-4xl font-bebas text-primary"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={isInView ? { opacity: 1, scale: 1 } : {}}
                transition={{ delay: 0.1, type: "spring" }}
              >
                ZOIRO
              </motion.h3>
            </div>
            <p className="text-background/70 text-sm sm:text-base mb-4 sm:mb-6 leading-relaxed">
              Injected Broast - Premium fast food experience in Vehari City. 
              Crispy, juicy, and unforgettable taste.
            </p>
            <div className="flex gap-3 sm:gap-4">
              {[Facebook, Instagram, Twitter].map((Icon, index) => (
                <motion.a
                  key={index}
                  href="#"
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary/20 hover:bg-primary flex items-center justify-center transition-colors"
                  whileHover={{ scale: 1.2, rotate: 5 }}
                  whileTap={{ scale: 0.95 }}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={isInView ? { opacity: 1, scale: 1 } : {}}
                  transition={{ delay: 0.3 + index * 0.1 }}
                >
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                </motion.a>
              ))}
            </div>
          </motion.div>

          {/* Quick Links */}
          <motion.div variants={itemVariants}>
            <h4 className="text-lg sm:text-xl font-bebas mb-3 sm:mb-4">Quick Links</h4>
            <ul className="space-y-2 sm:space-y-3">
              {[
                { href: "/", label: "Home" },
                { href: "/menu", label: "Our Menu" },
                { href: "/contact", label: "Contact Us" },
                { href: "/cart", label: "My Cart" },
                { href: "/terms", label: "Terms & Conditions" },
                { href: "/privacy", label: "Privacy Policy" },
              ].map((link, index) => (
                <motion.li
                  key={link.href}
                  initial={{ opacity: 0, x: -20 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: 0.4 + index * 0.05 }}
                >
                  <Link
                    href={link.href}
                    className="text-background/70 hover:text-primary transition-colors inline-block text-sm sm:text-base"
                  >
                    <motion.span whileHover={{ x: 5 }} className="inline-block">
                      {link.label}
                    </motion.span>
                  </Link>
                </motion.li>
              ))}
            </ul>
          </motion.div>

          {/* Contact Info */}
          <motion.div variants={itemVariants}>
            <h4 className="text-lg sm:text-xl font-bebas mb-3 sm:mb-4">Contact Info</h4>
            <ul className="space-y-3 sm:space-y-4">
              {[
                { Icon: MapPin, text: "Near Baba G Kulfi, Faisal Town, Vehari" },
                { Icon: Phone, text: "+92 304 629 2822" },
                { Icon: Clock, text: "Daily: 11:00 AM - 11:00 PM" },
              ].map((item, index) => (
                <motion.li
                  key={index}
                  className="flex items-start gap-2 sm:gap-3"
                  initial={{ opacity: 0, x: -20 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  whileHover={{ x: 5 }}
                >
                  <motion.div whileHover={{ scale: 1.2, rotate: 10 }}>
                    <item.Icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0 mt-0.5" />
                  </motion.div>
                  <span className="text-background/70 text-sm sm:text-base">{item.text}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>

          {/* Opening Hours */}
          <motion.div variants={itemVariants}>
            <h4 className="text-lg sm:text-xl font-bebas mb-3 sm:mb-4">Opening Hours</h4>
            <ul className="space-y-2 sm:space-y-3 text-background/70 text-sm sm:text-base">
              {[
                { days: "Monday - Thursday", hours: "11AM - 10PM" },
                { days: "Friday - Saturday", hours: "11AM - 11PM" },
                { days: "Sunday", hours: "12PM - 10PM" },
              ].map((item, index) => (
                <motion.li
                  key={index}
                  className="flex justify-between gap-2"
                  initial={{ opacity: 0, y: 10 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 0.6 + index * 0.1 }}
                >
                  <span className="text-xs sm:text-sm">{item.days}</span>
                  <span className="text-xs sm:text-sm font-medium">{item.hours}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </motion.div>

        {/* Bottom Bar */}
        <motion.div
          className="border-t border-background/20 mt-8 sm:mt-12 pt-6 sm:pt-8 flex flex-col md:flex-row justify-between items-center gap-3 sm:gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.8 }}
        >
          <p className="text-background/50 text-xs sm:text-sm text-center md:text-left">
            © 2025 ZOIRO - Injected Broast. All rights reserved.
          </p>
          <motion.p
            className="text-background/50 text-xs sm:text-sm"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            Made with ❤️ in Vehari City
          </motion.p>
        </motion.div>
      </div>
    </footer>
  );
}
