"use client";

import { ReactNode, memo } from "react";
import dynamic from "next/dynamic";

// Dynamically import heavy components with loading states
const Navbar = dynamic(() => import("@/components/custom/Navbar"), {
  ssr: true,
  loading: () => (
    <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-primary via-primary to-orange-500 shadow-md h-16 md:h-20" />
  ),
});

const Footer = dynamic(() => import("@/components/custom/Footer"), {
  ssr: true,
  loading: () => (
    <footer className="bg-foreground text-background py-12 sm:py-16 md:py-20" />
  ),
});

// Offer popup - loads after page
const OfferPopup = dynamic(() => import("@/components/landing/OfferPopup"), {
  ssr: false,
});

interface LandingLayoutProps {
  children: ReactNode;
}

function LandingLayout({ children }: LandingLayoutProps) {
  return (
    <>
      <Navbar />
      {children}
      <Footer />
      <OfferPopup />
    </>
  );
}

// Memoize the layout to prevent re-renders on navigation
export default memo(LandingLayout);
