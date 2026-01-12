"use client";

import { motion } from "framer-motion";
import { Lock, Eye, Database, Shield, UserCheck, Bell, Trash2, Baby, FileEdit, Phone, Mail, MapPin } from "lucide-react";
import Navbar from "@/components/custom/Navbar";
import Footer from "@/components/custom/Footer";

const privacyData = [
  {
    icon: Database,
    title: "1. Information We Collect",
    content: "We collect personal information that you provide when creating an account, placing orders, or contacting us. This includes: Name, Email address, Phone number, Delivery address, and Payment information."
  },
  {
    icon: Eye,
    title: "2. How We Use Your Information",
    content: "We use your information to: Process and deliver your orders, Send order confirmations and updates, Improve our services, Send promotional offers (with your consent), Provide customer support, and Comply with legal obligations."
  },
  {
    icon: UserCheck,
    title: "3. Information Sharing",
    content: "We do not sell or rent your personal information to third parties. We may share information with: Delivery personnel (name, address, phone for delivery), Payment processors for secure transactions, and Law enforcement when required by law."
  },
  {
    icon: Shield,
    title: "4. Data Security",
    content: "We implement appropriate security measures to protect your personal information from unauthorized access, alteration, disclosure, or destruction. This includes encryption, secure servers, and regular security audits."
  },
  {
    icon: Lock,
    title: "5. Cookies",
    content: "Our website uses cookies to enhance your browsing experience, remember your preferences, and analyze website traffic. You can disable cookies in your browser settings, but some features may not work properly."
  },
  {
    icon: Bell,
    title: "6. Your Rights",
    content: "You have the right to: Access your personal information, Request correction of inaccurate data, Request deletion of your data, Opt-out of marketing communications, and Withdraw consent at any time."
  },
  {
    icon: Trash2,
    title: "7. Data Retention",
    content: "We retain your personal information for as long as your account is active or as needed to provide services. Order history is retained for record-keeping purposes and legal compliance."
  },
  {
    icon: Baby,
    title: "8. Children's Privacy",
    content: "Our services are not intended for children under 13 years of age. We do not knowingly collect personal information from children."
  },
  {
    icon: FileEdit,
    title: "9. Changes to Privacy Policy",
    content: "We may update this privacy policy periodically. We will notify you of significant changes via email or website notification."
  }
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      
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
              <Lock className="w-4 h-4 text-red-500" />
              <span className="text-red-400 text-sm font-medium">Privacy</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bebas text-white mb-4">
              Privacy <span className="text-red-500">Policy</span>
            </h1>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
              Your privacy is important to us. Learn how we collect, use, and protect your information.
            </p>
            <p className="text-zinc-500 text-sm mt-4">
              Last Updated: January 2024
            </p>
          </motion.div>
        </div>
      </section>

      {/* Privacy Content */}
      <section className="py-16">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Quick Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-gradient-to-br from-green-500/10 to-zinc-900/50 border border-green-500/20 rounded-3xl p-8 mb-12"
          >
            <h2 className="text-2xl font-bebas text-white mb-4 flex items-center gap-3">
              <Shield className="w-6 h-6 text-green-500" />
              Privacy at a Glance
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <p className="text-zinc-300">We never sell your data</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <p className="text-zinc-300">Your data is encrypted</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <p className="text-zinc-300">You control your information</p>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <p className="text-zinc-300">Delete your data anytime</p>
              </div>
            </div>
          </motion.div>

          {/* Privacy Sections */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-6"
          >
            {privacyData.map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 * index }}
                className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 hover:border-red-500/30 transition-colors group"
              >
                <h2 className="text-xl font-semibold text-white mb-3 flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center group-hover:bg-red-500/20 transition-colors">
                    <item.icon className="w-5 h-5 text-red-500" />
                  </span>
                  {item.title}
                </h2>
                <p className="text-zinc-400 leading-relaxed pl-[52px]">
                  {item.content}
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
            <h3 className="text-2xl font-bebas text-white mb-2 text-center">
              Contact Us About Privacy
            </h3>
            <p className="text-zinc-400 text-center mb-8">
              For privacy-related inquiries or to exercise your rights, contact us:
            </p>
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

      <Footer />
    </div>
  );
}
