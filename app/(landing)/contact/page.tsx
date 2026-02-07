"use client";

import { useRef, useState } from "react";
import { motion, useInView, useScroll, useTransform } from "framer-motion";
import Image from "next/image";
import { MapPin, Phone, Clock, Mail, Send, MessageSquare, Loader2, CheckCircle, AlertCircle, Sparkles, Star, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

// Brand contact info
const BRAND_INFO = {
  phone: "+92 304 629 2822",
  email: "zorobroast@gmail.com",
  address: "Near Baba G Kulfi, Faisal Town, Vehari",
  whatsapp: "+92 304 629 2822",
  hours: "Daily: 11:00 AM - 11:00 PM",
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, x: -30 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      type: "spring" as const,
      stiffness: 100,
      damping: 15,
    },
  },
};

export default function ContactPage() {
  const ref = useRef(null);
  const containerRef = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  const mapY = useTransform(scrollYProgress, [0, 1], [80, -80]);
  const contentY = useTransform(scrollYProgress, [0, 1], [60, -60]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      setSubmitStatus('success');
      toast({
        title: "Message Sent! ✨",
        description: data.message || "We'll get back to you within 24 hours.",
      });

      setFormData({ name: "", email: "", phone: "", subject: "", message: "" });
      setTimeout(() => setSubmitStatus('idle'), 5000);

    } catch (error: any) {
      setSubmitStatus('error');
      toast({
        title: "Failed to send",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pt-20">
        {/* Enhanced Hero Section */}
        <section className="relative py-24 md:py-32 bg-gradient-to-br from-zinc-950 via-zinc-900 to-black text-white overflow-hidden">
          {/* Animated Background Elements */}
          <div className="absolute inset-0 pointer-events-none">
            <motion.div 
              className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-red-600/20 to-red-900/10 rounded-full blur-3xl"
              animate={{
                x: [0, 50, 0],
                y: [0, 30, 0],
                scale: [1, 1.1, 1],
              }}
              transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div 
              className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-red-800/15 to-orange-600/10 rounded-full blur-3xl"
              animate={{
                x: [0, -30, 0],
                y: [0, -20, 0],
                scale: [1, 1.15, 1],
              }}
              transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
            />
            {/* Grid Pattern */}
            <div 
              className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage: `linear-gradient(rgba(239,68,68,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(239,68,68,0.5) 1px, transparent 1px)`,
                backgroundSize: '60px 60px',
              }}
            />
          </div>

          {/* Floating Food Images */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <motion.div
              className="absolute top-[10%] right-[5%] w-32 md:w-48"
              animate={{ y: [0, -15, 0], rotate: [0, 5, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            >
              <Image
                src="https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=300&h=300&fit=crop&q=80"
                alt="Broast"
                width={200}
                height={200}
                className="rounded-full opacity-60 shadow-2xl"
              />
            </motion.div>
            <motion.div
              className="absolute bottom-[15%] left-[3%] w-24 md:w-36"
              animate={{ y: [0, 10, 0], rotate: [0, -5, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            >
              <Image
                src="https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&h=300&fit=crop&q=80"
                alt="Burger"
                width={150}
                height={150}
                className="rounded-full opacity-50 shadow-2xl"
              />
            </motion.div>
          </div>

          <div className="container mx-auto px-4 relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="text-center max-w-4xl mx-auto"
            >
              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-full px-5 py-2 mb-6"
              >
                <Sparkles className="w-4 h-4 text-red-500" />
                <span className="text-red-400 text-sm font-semibold">We're Here to Help</span>
              </motion.div>

              <h1 className="text-5xl sm:text-6xl md:text-7xl font-bebas mb-6">
                Get In <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-red-400">Touch</span>
              </h1>
              
              <p className="text-zinc-400 text-lg md:text-xl max-w-2xl mx-auto mb-10">
                Have a question, feedback, or want to place a bulk order? 
                We'd love to hear from you! Reach out and our team will respond within 24 hours.
              </p>

              {/* Quick Contact Badges */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="flex flex-wrap justify-center gap-4"
              >
                <a 
                  href={`tel:${BRAND_INFO.phone}`}
                  className="flex items-center gap-2 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 rounded-full px-5 py-2.5 transition-all hover:scale-105"
                >
                  <Phone className="w-4 h-4 text-red-500" />
                  <span className="text-white text-sm font-medium">{BRAND_INFO.phone}</span>
                </a>
                <a 
                  href={`https://wa.me/${BRAND_INFO.whatsapp.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 rounded-full px-5 py-2.5 transition-all hover:scale-105"
                >
                  <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  <span className="text-green-400 text-sm font-medium">WhatsApp Us</span>
                </a>
              </motion.div>
            </motion.div>
          </div>

          {/* Bottom Wave */}
          <div className="absolute bottom-0 left-0 right-0">
            <svg className="w-full h-16 text-background" viewBox="0 0 1440 100" fill="currentColor" preserveAspectRatio="none">
              <path d="M0,50 C360,100 1080,0 1440,50 L1440,100 L0,100 Z" />
            </svg>
          </div>
        </section>

        {/* Main Content */}
        <section className="py-16 overflow-hidden relative" ref={containerRef}>
          <div className="container mx-auto px-4 relative z-10" ref={ref}>
            <div className="grid lg:grid-cols-2 gap-12 items-start">
              {/* Contact Info & Map */}
              <motion.div
                initial={{ opacity: 0, x: -80 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
              >
                {/* Map */}
                <motion.div
                  className="relative rounded-3xl overflow-hidden h-72 bg-muted mb-8 shadow-2xl"
                  style={{ y: mapY }}
                  whileHover={{ scale: 1.02 }}
                >
                  <iframe
                    src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d27522.57!2d72.345!3d30.045!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3922f5e4e4e4e4e5%3A0x1a1a1a1a1a1a1a1a!2sFaisal%20Town%2C%20Vehari%2C%20Punjab%2C%20Pakistan!5e0!3m2!1sen!2s!4v1700000000000!5m2!1sen!2s"
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title="ZOIRO Location - Faisal Town, Vehari"
                  />
                  {/* Map Overlay Card */}
                  <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-red-500 flex items-center justify-center">
                        <MapPin className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="font-bold text-zinc-900">ZOIRO Injected Broast</p>
                        <p className="text-sm text-zinc-600">{BRAND_INFO.address}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Contact Cards */}
                <motion.div
                  className="space-y-4"
                  variants={containerVariants}
                  initial="hidden"
                  animate={isInView ? "visible" : "hidden"}
                >
                  <motion.a
                    href={`tel:${BRAND_INFO.phone}`}
                    variants={cardVariants}
                    className="flex items-center gap-4 p-5 bg-gradient-to-r from-red-500/5 to-transparent border border-red-500/10 rounded-2xl hover:border-red-500/30 transition-all group"
                    whileHover={{ x: 10, scale: 1.02 }}
                  >
                    <motion.div
                      className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center group-hover:bg-red-500 transition-colors"
                      whileHover={{ rotate: 10, scale: 1.1 }}
                    >
                      <Phone className="h-6 w-6 text-red-500 group-hover:text-white transition-colors" />
                    </motion.div>
                    <div>
                      <p className="font-bold text-lg">Call Us</p>
                      <p className="text-muted-foreground">{BRAND_INFO.phone}</p>
                    </div>
                  </motion.a>

                  <motion.a
                    href={`mailto:${BRAND_INFO.email}`}
                    variants={cardVariants}
                    className="flex items-center gap-4 p-5 bg-gradient-to-r from-blue-500/5 to-transparent border border-blue-500/10 rounded-2xl hover:border-blue-500/30 transition-all group"
                    whileHover={{ x: 10, scale: 1.02 }}
                  >
                    <motion.div
                      className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500 transition-colors"
                      whileHover={{ rotate: 10, scale: 1.1 }}
                    >
                      <Mail className="h-6 w-6 text-blue-500 group-hover:text-white transition-colors" />
                    </motion.div>
                    <div>
                      <p className="font-bold text-lg">Email Us</p>
                      <p className="text-muted-foreground">{BRAND_INFO.email}</p>
                    </div>
                  </motion.a>

                  <motion.div
                    variants={cardVariants}
                    className="flex items-center gap-4 p-5 bg-gradient-to-r from-green-500/5 to-transparent border border-green-500/10 rounded-2xl"
                  >
                    <motion.div
                      className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center"
                      whileHover={{ rotate: 10, scale: 1.1 }}
                    >
                      <Clock className="h-6 w-6 text-green-500" />
                    </motion.div>
                    <div>
                      <p className="font-bold text-lg">Opening Hours</p>
                      <p className="text-muted-foreground">{BRAND_INFO.hours}</p>
                    </div>
                  </motion.div>

                  <motion.div
                    variants={cardVariants}
                    className="flex items-center gap-4 p-5 bg-gradient-to-r from-amber-500/5 to-transparent border border-amber-500/10 rounded-2xl"
                  >
                    <motion.div
                      className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center"
                      whileHover={{ rotate: 10, scale: 1.1 }}
                    >
                      <Truck className="h-6 w-6 text-amber-500" />
                    </motion.div>
                    <div>
                      <p className="font-bold text-lg">Free Delivery</p>
                      <p className="text-muted-foreground">On orders above Rs. 500</p>
                    </div>
                  </motion.div>
                </motion.div>
              </motion.div>

              {/* Contact Form */}
              <motion.div
                initial={{ opacity: 0, x: 80 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
                style={{ y: contentY }}
              >
                <div className="bg-card rounded-3xl p-8 shadow-2xl border">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-lg shadow-red-500/30">
                      <MessageSquare className="h-7 w-7 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bebas">Send us a Message</h2>
                      <p className="text-muted-foreground text-sm">We'll respond within 24 hours</p>
                    </div>
                  </div>

                  {/* Success/Error Banner */}
                  {submitStatus === 'success' && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-xl mb-6"
                    >
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <p className="text-green-600 dark:text-green-400 text-sm font-medium">
                        Message sent successfully! We'll get back to you soon.
                      </p>
                    </motion.div>
                  )}

                  {submitStatus === 'error' && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl mb-6"
                    >
                      <AlertCircle className="w-5 h-5 text-red-500" />
                      <p className="text-red-600 dark:text-red-400 text-sm font-medium">
                        Failed to send. Please try again or contact us directly.
                      </p>
                    </motion.div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-sm font-semibold">Your Name *</Label>
                      <Input
                        id="name"
                        type="text"
                        placeholder="Enter your full name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        minLength={2}
                        className="h-12 rounded-xl"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-sm font-semibold">Email *</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="your@email.com"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          required
                          className="h-12 rounded-xl"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone" className="text-sm font-semibold">Phone (Optional)</Label>
                        <Input
                          id="phone"
                          type="tel"
                          placeholder="+92 3XX XXXXXXX"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="h-12 rounded-xl"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="subject" className="text-sm font-semibold">Subject (Optional)</Label>
                      <Input
                        id="subject"
                        type="text"
                        placeholder="What's your message about?"
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        maxLength={255}
                        className="h-12 rounded-xl"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="message" className="text-sm font-semibold">Message *</Label>
                      <Textarea
                        id="message"
                        placeholder="How can we help you? Tell us about your query, feedback, or bulk order requirements..."
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        required
                        minLength={10}
                        maxLength={2000}
                        rows={5}
                        className="resize-none rounded-xl"
                      />
                      <p className="text-xs text-muted-foreground text-right">
                        {formData.message.length}/2000
                      </p>
                    </div>

                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full h-14 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white font-bold text-lg rounded-xl shadow-lg shadow-red-500/30 transition-all hover:scale-[1.02]"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          Send Message
                          <Send className="w-5 h-5 ml-2" />
                        </>
                      )}
                    </Button>
                  </form>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-20 bg-zinc-50 dark:bg-zinc-900/50">
          <div className="container mx-auto px-4">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-12"
            >
              <span className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-full px-4 py-2 mb-4">
                <Star className="w-4 h-4 text-red-500" />
                <span className="text-red-500 text-sm font-medium">FAQ</span>
              </span>
              <h2 className="text-4xl font-bebas">
                Frequently Asked Questions
              </h2>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {[
                {
                  q: "What are your delivery hours?",
                  a: "We deliver from 11:00 AM to 11:00 PM, 7 days a week across Vehari city.",
                },
                {
                  q: "Do you offer catering services?",
                  a: "Yes! We offer catering for events, parties, and corporate gatherings. Contact us for bulk orders.",
                },
                {
                  q: "What payment methods do you accept?",
                  a: "We accept Cash on Delivery, Bank Transfer, EasyPaisa, and JazzCash.",
                },
                {
                  q: "Is delivery free?",
                  a: "Yes! Delivery is FREE for all orders above Rs. 500 within Vehari city limits.",
                },
              ].map((faq, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-card p-6 rounded-2xl shadow-sm border hover:shadow-md transition-shadow"
                >
                  <h3 className="font-bold text-lg mb-2">{faq.q}</h3>
                  <p className="text-muted-foreground">{faq.a}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </div>
  );
}
