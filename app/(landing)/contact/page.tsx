"use client";

import { useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { MapPin, Phone, Clock, Mail, MessageSquare, Flame, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import PageHero from "@/components/custom/PageHero";

// Brand contact info
const BRAND_INFO = {
  phone: "+92 304 629 2822",
  email: "zorobroast@gmail.com",
  address: "Near Baba G Kulfi, Faisal Town, Vehari",
  whatsapp: "+92 304 629 2822",
  hours: "DAILY: 11:00 AM - 11:00 PM",
};

export default function ContactPage() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send message');

      toast({
        title: "MESSAGE SENT! 🔥",
        description: "We'll get back to you within 24 hours.",
      });

      setFormData({ name: "", email: "", phone: "", subject: "", message: "" });
    } catch (error: any) {
      toast({
        title: "FAILED TO SEND",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white pt-[96px]">
      <PageHero 
        title="VEHARI" 
        subtitle="NOW SERVING IN" 
        accentText="Chase The Vibe" 
      />

      {/* Contact Grid */}
      <section className="py-24 bg-white relative">
        <div className="container-custom mx-auto px-6 max-w-7xl" ref={ref}>
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            
            {/* Info Cards - Left Side */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              className="space-y-8"
            >
              <div className="grid sm:grid-cols-2 gap-6">
                {[
                  { icon: Phone, title: "CALL US", value: BRAND_INFO.phone, color: "#ED1C24" },
                  { icon: Mail, title: "EMAIL US", value: BRAND_INFO.email, color: "#008A45" },
                  { icon: Clock, title: "HOURS", value: BRAND_INFO.hours, color: "#FFD200" },
                  { icon: Truck, title: "DELIVERY", value: "FREE OVER RS. 500", color: "#000000" },
                ].map((item, i) => (
                  <div key={i} className="bg-white border-4 border-black p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:-translate-y-1 transition-all">
                    <item.icon className="w-10 h-10 mb-4" style={{ color: item.color }} />
                    <h3 className="font-bebas text-2xl mb-1">{item.title}</h3>
                    <p className="font-black text-black/60 uppercase text-sm tracking-tighter">{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Map */}
              <div className="border-[8px] border-black shadow-[16px_16px_0px_0px_rgba(0,138,69,1)] relative h-96 overflow-hidden">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d27522.57!2d72.345!3d30.045!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3922f5e4e4e4e4e5%3A0x1a1a1a1a1a1a1a1a!2sFaisal%20Town%2C%20Vehari%2C%20Punjab%2C%20Pakistan!5e0!3m2!1sen!2s!4v1700000000000!5m2!1sen!2s"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  title="Fifth Avenue Location"
                />
              </div>
            </motion.div>

            {/* Form - Right Side */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              className="bg-white border-[10px] border-black p-8 md:p-12 shadow-[24px_24px_0px_0px_rgba(255,210,0,1)]"
            >
              <div className="flex items-center gap-4 mb-10 border-b-8 border-black pb-8">
                 <div className="bg-[#ED1C24] p-4 border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <MessageSquare className="w-8 h-8 text-white" />
                 </div>
                 <div>
                    <h2 className="font-bebas text-5xl leading-none">SEND A MESSAGE</h2>
                    <p className="font-caveat text-2xl text-[#ED1C24]">We don't leave people on read.</p>
                 </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label className="font-bebas text-2xl">YOUR NAME</Label>
                  <Input
                    placeholder="NAME ON THE STREET"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="h-14 border-4 border-black rounded-none font-bebas text-xl focus-visible:ring-0"
                    required
                  />
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="font-bebas text-2xl">EMAIL</Label>
                    <Input
                      type="email"
                      placeholder="WHERE TO REPLY"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="h-14 border-4 border-black rounded-none font-bebas text-xl focus-visible:ring-0"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bebas text-2xl">PHONE</Label>
                    <Input
                      placeholder="DIGITS"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="h-14 border-4 border-black rounded-none font-bebas text-xl focus-visible:ring-0"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="font-bebas text-2xl">MESSAGE</Label>
                  <Textarea
                    placeholder="WHATS ON YOUR MIND?"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="min-h-[150px] border-4 border-black rounded-none font-bebas text-xl focus-visible:ring-0 resize-none"
                    required
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-20 bg-black text-white rounded-none font-bebas text-4xl tracking-widest hover:bg-[#008A45] border-2 border-black shadow-[8px_8px_0px_0px_rgba(237,28,36,1)] hover:shadow-none transition-all"
                >
                  {isSubmitting ? "SENDING..." : "SEND IT"}
                </Button>
              </form>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 bg-[#008A45] border-y-8 border-black">
        <div className="container-custom mx-auto px-6 max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="font-bebas text-7xl text-white drop-shadow-[4px_4px_0px_rgba(0,0,0,1)]">FAQ</h2>
            <p className="font-caveat text-3xl text-[#FFD200]">Everything you need to know.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {[
              { q: "HOURS?", a: "11:00 AM - 11:00 PM. EVERY. SINGLE. DAY." },
              { q: "CATERING?", a: "YEAH! WE FEED THE WHOLE SQUAD. HIT US UP FOR BULK DEALS." },
              { q: "PAYMENT?", a: "CASH, BANK TRANSFER, EASYPAISA, JAZZCASH. WE TAKE IT ALL." },
              { q: "DELIVERY?", a: "FREE OVER RS. 500 IN VEHARI. FAST AS LIGHTNING." },
            ].map((faq, i) => (
              <div key={i} className="bg-white border-4 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                <h3 className="font-bebas text-3xl mb-3 text-[#ED1C24]">{faq.q}</h3>
                <p className="font-bold text-xl text-black/80 uppercase">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer Quote */}
      <section className="py-12 bg-black text-center">
          <p className="font-bebas text-2xl text-[#FFD200] tracking-[0.2em]">
            FIFTH AVENUE — CHASING FLAVOURS SINCE 2024
          </p>
      </section>
    </div>
  );
}
