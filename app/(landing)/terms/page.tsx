"use client";

import { motion } from "framer-motion";
import { Shield, FileText, Clock, Phone, Mail, MapPin } from "lucide-react";

const termsData = [
  {
    title: "1. Acceptance of Terms",
    content: "By accessing and using the ZOIRO Injected Broast website and services, you agree to be bound by these Terms and Conditions. If you do not agree with any part of these terms, please do not use our services."
  },
  {
    title: "2. Services",
    content: "ZOIRO Injected Broast provides online food ordering and delivery services within Vehari city. We reserve the right to modify, suspend, or discontinue any service at any time without prior notice."
  },
  {
    title: "3. User Accounts",
    content: "To place orders, you may need to create an account. You are responsible for maintaining the confidentiality of your account credentials. You agree to provide accurate and complete information during registration."
  },
  {
    title: "4. Orders and Payments",
    content: "All orders are subject to availability and confirmation. Prices displayed are in Pakistani Rupees (PKR) and include applicable taxes. Payment methods accepted include Cash on Delivery (COD), Bank Transfer, and EasyPaisa/JazzCash."
  },
  {
    title: "5. Delivery",
    content: "We aim to deliver orders within 30-45 minutes within our delivery area. Delivery times may vary due to weather conditions, traffic, or high order volumes. Free delivery is available for orders above Rs. 500."
  },
  {
    title: "6. Cancellations and Refunds",
    content: "Orders can be cancelled within 5 minutes of placement. After food preparation begins, cancellations may not be possible. Refunds for quality issues will be processed within 3-5 business days."
  },
  {
    title: "7. Quality Assurance",
    content: "We are committed to providing fresh, high-quality food. If you receive an order that does not meet our quality standards, please contact us immediately for a replacement or refund."
  },
  {
    title: "8. Liability",
    content: "ZOIRO Injected Broast is not liable for any indirect, incidental, or consequential damages arising from the use of our services. Our total liability shall not exceed the value of your order."
  },
  {
    title: "9. Intellectual Property",
    content: "All content on this website, including logos, images, and text, is the property of ZOIRO Injected Broast and protected by copyright laws. Unauthorized use is prohibited."
  },
  {
    title: "10. Changes to Terms",
    content: "We reserve the right to modify these terms at any time. Continued use of our services after changes constitutes acceptance of the new terms."
  }
];

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-black pt-20">
      
      {/* Hero Section */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-red-950/20 to-black" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(220,38,38,0.1),transparent_70%)]" />
        
        <div className="container mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-full px-4 py-2 mb-6">
              <FileText className="w-4 h-4 text-red-500" />
              <span className="text-red-400 text-sm font-medium">Legal</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bebas text-white mb-4">
              Terms & <span className="text-red-500">Conditions</span>
            </h1>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
              Please read these terms carefully before using our services
            </p>
            <p className="text-zinc-500 text-sm mt-4">
              Last Updated: January 2024
            </p>
          </motion.div>
        </div>
      </section>

      {/* Terms Content */}
      <section className="py-16">
        <div className="container mx-auto px-4 max-w-4xl">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-8"
          >
            {termsData.map((term, index) => (
              <motion.div
                key={term.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 * index }}
                className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 hover:border-red-500/30 transition-colors"
              >
                <h2 className="text-xl font-semibold text-white mb-3 flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-red-500" />
                  </span>
                  {term.title}
                </h2>
                <p className="text-zinc-400 leading-relaxed pl-11">
                  {term.content}
                </p>
              </motion.div>
            ))}
          </motion.div>

          {/* Contact Section */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-16 bg-gradient-to-br from-red-500/10 to-zinc-900/50 border border-red-500/20 rounded-3xl p-8"
          >
            <h3 className="text-2xl font-bebas text-white mb-6 text-center">
              Questions About Our Terms?
            </h3>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="flex items-center gap-4 justify-center">
                <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <p className="text-zinc-500 text-sm">Email</p>
                  <p className="text-white">zorobroast@gmail.com</p>
                </div>
              </div>
              <div className="flex items-center gap-4 justify-center">
                <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <Phone className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <p className="text-zinc-500 text-sm">Phone</p>
                  <p className="text-white">+92 304 629 2822</p>
                </div>
              </div>
              <div className="flex items-center gap-4 justify-center">
                <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <p className="text-zinc-500 text-sm">Address</p>
                  <p className="text-white">Faisal Town, Vehari</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
