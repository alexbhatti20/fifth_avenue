"use client";

import { motion } from "framer-motion";
import { Star, Quote, MessageCircle } from "lucide-react";

const reviews = [
  {
    id: "r1",
    customer: "Asif Malik",
    initial: "A",
    rating: 5,
    comment: "The pizza is next level! That Fifth Avenue sauce is something I've been chasing for years. Finally found it in Vehari!",
  },
  {
    id: "r2",
    customer: "Saira Banu",
    initial: "S",
    rating: 5,
    comment: "Fast, fresh, and full of flavour. The vibe at Fifth Avenue is so energetic, it's my favorite spot now.",
  },
  {
    id: "r3",
    customer: "Hamza Sheikh",
    initial: "H",
    rating: 5,
    comment: "Best street food in town. The beef burgers are juicy and the loaded fries are a must-try!",
  },
];

export default function Reviews() {
  return (
    <section id="reviews" className="py-32 bg-white relative">
      <div className="max-w-7xl mx-auto px-6">
        
        {/* Header */}
        <div className="text-center mb-24">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="inline-block bg-[#ED1C24] text-white px-6 py-2 mb-6 border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
          >
            <span className="font-bebas text-2xl tracking-widest uppercase">VOICES FROM THE STREET</span>
          </motion.div>
          
          <h2 className="font-bebas text-6xl md:text-8xl text-black leading-none">
            WHAT OUR <span className="text-[#008A45]">SQUAD</span> SAYS
          </h2>
          <p className="font-caveat text-4xl text-[#ED1C24] mt-4">They're chasing flavours too...</p>
        </div>

        {/* Reviews Grid */}
        <div className="grid md:grid-cols-3 gap-10">
          {reviews.map((review, index) => (
            <motion.div
              key={review.id}
              initial={{ opacity: 0, rotate: -5 }}
              whileInView={{ opacity: 1, rotate: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="bg-[#FFD200] border-4 border-black p-10 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] relative group hover:translate-x-[4px] hover:translate-y-[4px] hover:shadow-none transition-all"
            >
              <div className="absolute -top-6 -left-6 bg-black text-white p-4 border-4 border-[#ED1C24] rotate-[-5deg]">
                <Quote className="w-8 h-8" />
              </div>

              {/* Rating */}
              <div className="flex gap-1 mb-6 mt-4">
                {[...Array(review.rating)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-black text-black" />
                ))}
              </div>

              {/* Comment */}
              <p className="font-source-sans text-xl font-black text-black leading-tight italic mb-8">
                "{review.comment}"
              </p>

              {/* Author */}
              <div className="flex items-center gap-4 pt-6 border-t-4 border-black/10">
                <div className="w-14 h-14 bg-black text-white flex items-center justify-center font-bebas text-3xl shadow-[4px_4px_0px_0px_rgba(237,28,36,1)]">
                  {review.initial}
                </div>
                <div>
                  <p className="font-bebas text-2xl text-black leading-none">{review.customer}</p>
                  <p className="font-source-sans text-xs font-bold uppercase tracking-widest text-[#008A45]">Verified Fan</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Stats Section */}
        <div className="mt-32 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { label: "STREET REVIEWS", value: "5K+" },
            { label: "FLAVOUR RATING", value: "4.9" },
            { label: "URBAN FANS", value: "10K" },
            { label: "FLAVOURS CHASED", value: "∞" },
          ].map((stat, i) => (
            <motion.div
              key={i}
              className="flex flex-col items-center justify-center p-8 border-4 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,138,69,1)]"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <span className="font-bebas text-6xl md:text-7xl text-black leading-none">{stat.value}</span>
              <span className="font-bebas text-xl text-[#008A45] tracking-widest mt-2">{stat.label}</span>
            </motion.div>
          ))}
        </div>
        
        {/* View All Button */}
        <div className="mt-20 text-center">
          <motion.a
            href="/reviews"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="inline-flex items-center gap-4 bg-black text-white px-12 py-6 font-bebas text-3xl tracking-widest border-4 border-white shadow-[10px_10px_0px_0px_rgba(255,210,0,1)] hover:shadow-none transition-all group"
          >
            VIEW ALL REVIEWS
            <MessageCircle className="w-8 h-8 group-hover:rotate-12 transition-transform" />
          </motion.a>
        </div>

      </div>
    </section>
  );
}
