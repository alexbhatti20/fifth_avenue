import { ReactNode, Suspense } from "react";
import dynamic from "next/dynamic";
import { getOnlineBookingSettingServer } from "@/lib/server-queries";

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
