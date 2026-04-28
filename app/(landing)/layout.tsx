import { ReactNode, Suspense } from "react";
import dynamic from "next/dynamic";
import { getOnlineBookingSettingServer } from "@/lib/server-queries";
import Navbar from "@/components/custom/Navbar";
import MobileBottomNav from "@/components/custom/MobileBottomNav";

const Footer = dynamic(() => import("@/components/custom/Footer"), {
  ssr: true,
  loading: () => (
    <footer className="bg-foreground text-background py-12 sm:py-16 md:py-20" />
  ),
});

// SSR offer popup - fetches offers on server
import OfferPopupServer from "@/components/landing/OfferPopupServer";

interface LandingLayoutProps {
  children: ReactNode;
}

export default async function LandingLayout({ children }: LandingLayoutProps) {
  const bookingSetting = await getOnlineBookingSettingServer();

  return (
    <div className="fa-landing-theme">
      <Navbar bookingEnabled={bookingSetting.enabled} />
      <div className="pb-28 md:pb-0 relative">
        {children}
        <Footer />
      </div>
      <MobileBottomNav />
      <Suspense fallback={null}>
        <OfferPopupServer />
      </Suspense>
    </div>
  );
}
