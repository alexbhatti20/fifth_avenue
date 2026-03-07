import { ReactNode, Suspense } from "react";
import dynamic from "next/dynamic";
import { getOnlineBookingSettingServer } from "@/lib/server-queries";
import Navbar from "@/components/custom/Navbar";

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
    <>
      <Navbar bookingEnabled={bookingSetting.enabled} />
      {children}
      <Footer />
      <Suspense fallback={null}>
        <OfferPopupServer />
      </Suspense>
    </>
  );
}
