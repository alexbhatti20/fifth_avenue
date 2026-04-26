"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu, ShoppingBag, LogIn, UserPlus, ArrowRight, Zap
} from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const navLinks = [
  { name: "HOME", path: "/" },
  { name: "MENU", path: "/menu" },
  { name: "OFFERS", path: "/offers" },
  { name: "REVIEWS", path: "/reviews" },
  { name: "CONTACT", path: "/contact" },
];

interface NavbarProps {
  bookingEnabled?: boolean;
}

const Navbar: React.FC<NavbarProps> = ({ bookingEnabled = true }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { totalItems } = useCart();
  const { user, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = async () => {
    setIsOpen(false);
    await signOut();
    router.push("/");
    router.refresh();
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex justify-center pointer-events-none p-2 md:p-4 transition-all duration-300">
      <nav
        className={cn(
          "w-full max-w-[1400px] pointer-events-auto flex items-center justify-between px-6 py-2 transition-all duration-500 relative overflow-hidden",
          isScrolled 
            ? "bg-white/90 backdrop-blur-md border-2 border-black shadow-[4px_4px_0_0_rgba(0,0,0,1)] rounded-none" 
            : "bg-[#FFD200] border-b-4 border-black shadow-2xl"
        )}
      >
        {/* Animated Gloss Overlay */}
        <div className={cn(
          "absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transition-opacity duration-1000 animate-pulse pointer-events-none",
          isScrolled ? "opacity-0" : "opacity-100"
        )} />

        {/* Logo Section */}
        <Link
          href="/"
          className={cn(
            "flex items-center gap-3 group transition-all duration-500 relative z-10",
            !isScrolled && (pathname === "/" || pathname === "/menu") && "opacity-0 pointer-events-none -translate-x-4"
          )}
        >
          <div className={cn(
            "px-3 py-0.5 border-2 transition-all rotate-[-2deg] group-hover:rotate-0",
            isScrolled ? "bg-black border-white" : "bg-white border-black shadow-[2px_2px_0_0_rgba(0,0,0,1)]"
          )}>
            <span className={cn(
              "font-bebas text-xl md:text-2xl tracking-tighter leading-none whitespace-nowrap",
              isScrolled ? "text-white" : "text-black"
            )}>
              FIFTH AVENUE
            </span>
          </div>
          <span className={cn(
            "font-caveat text-base mt-1 hidden sm:block font-bold",
            isScrolled ? "text-[#ED1C24]" : "text-[#ED1C24]"
          )}>Chasing Flavours</span>
        </Link>

        {/* Desktop Links */}
        <div className="hidden lg:flex items-center gap-1 relative z-10">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              href={link.path}
              className={cn(
                "font-bebas text-lg tracking-widest px-3 py-1 transition-all relative group",
                isScrolled
                  ? (pathname === link.path ? "text-[#ED1C24]" : "text-black hover:text-[#008A45]")
                  : "text-white hover:text-[#FFD200]"
              )}
            >
              <span className="relative z-10">{link.name}</span>
              <div className={cn(
                "absolute bottom-0 left-0 w-full h-0.5 transform transition-transform duration-300 origin-left scale-x-0 group-hover:scale-x-100",
                isScrolled ? "bg-[#ED1C24]" : "bg-white"
              )} />
            </Link>
          ))}
        </div>

        {/* Actions Center */}
        <div className="flex items-center gap-1.5 md:gap-3 relative z-10">

          {/* Auth Buttons - Desktop Only */}
          <div className="hidden lg:flex items-center gap-2">
            {user ? (
              <button
                className={cn(
                  "font-bebas text-lg tracking-widest px-2 transition-colors",
                  isScrolled ? "text-black hover:text-[#ED1C24]" : "text-white hover:text-[#FFD200]"
                )}
                onClick={handleLogout}
              >
                LOGOUT
              </button>
            ) : (
              <>
                <Link href="/auth?tab=login">
                  <Button
                    variant="ghost"
                    className={cn(
                      "font-bebas text-lg tracking-widest h-9 px-3",
                      isScrolled ? "text-black hover:bg-black/5" : "text-white hover:bg-white/10"
                    )}
                  >
                    LOGIN
                  </Button>
                </Link>
                <Link href="/auth?tab=register">
                  <Button
                    className={cn(
                      "rounded-none h-9 px-4 font-bebas text-lg tracking-widest border-2 transition-all",
                      isScrolled
                        ? "bg-black text-white border-black shadow-[3px_3px_0_0_rgba(255,210,0,1)] hover:shadow-none"
                        : "bg-white text-black border-white shadow-[3px_3px_0_0_rgba(0,0,0,0.2)] hover:shadow-none"
                    )}
                  >
                    JOIN
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Cart & Menu Actions */}
          <div className="flex items-center gap-1.5 md:gap-2">
            <Link href="/cart" className="relative group">
              <div className={cn(
                "p-1.5 md:p-2 border-2 transition-all",
                "bg-white border-black shadow-[3px_3px_0_0_rgba(0,0,0,1)]"
              )}>
                <ShoppingBag className="w-5 h-5 text-black" />
                {totalItems > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-[#ED1C24] text-white text-[10px] w-5 h-5 flex items-center justify-center font-bebas border-2 border-black">
                    {totalItems}
                  </span>
                )}
              </div>
            </Link>

            <Link href="/menu" className="hidden lg:block">
              <Button className={cn(
                "rounded-none px-6 h-9 font-bebas text-xl tracking-widest border-2 border-black transition-all",
                isScrolled
                  ? "bg-[#FFD200] text-black shadow-[3px_3px_0_0_rgba(0,0,0,1)] hover:shadow-none"
                  : "bg-black text-white border-white shadow-[3px_3px_0_0_rgba(255,210,0,1)] hover:shadow-none"
              )}>
                ORDER
              </Button>
            </Link>

            {/* Mobile Toggle - Improved Professional Design */}
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden w-10 h-10 border-2 border-black bg-white shadow-[2px_2px_0_0_rgba(0,0,0,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
                >
                  <Menu className="w-6 h-6 text-black" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="bg-[#FFD200] border-l-8 border-black w-full sm:w-[400px] p-0 overflow-hidden">
                <SheetTitle className="sr-only">Main Navigation</SheetTitle>
                <div className="flex flex-col h-full relative">
                  {/* Decorative Background Text */}
                  <div className="absolute inset-0 opacity-[0.03] pointer-events-none select-none flex items-center justify-center overflow-hidden">
                    <span className="font-bebas text-[30vw] leading-none rotate-90 whitespace-nowrap">AVENUE STYLE</span>
                  </div>

                  <div className="p-8 border-b-4 border-black bg-white relative z-10 flex justify-between items-end">
                    <div>
                      <span className="font-bebas text-4xl text-black leading-none block uppercase">Fifth Avenue</span>
                      <span className="font-caveat text-xl text-[#ED1C24] font-bold">Chasing Flavours</span>
                    </div>
                    <div className="bg-black text-white p-2 border-2 border-black shadow-[4px_4px_0_0_rgba(255,210,0,1)]">
                      <Zap className="w-6 h-6 fill-[#FFD200]" />
                    </div>
                  </div>

                  <div className="flex-1 p-8 flex flex-col justify-center gap-4 relative z-10">
                    {navLinks.map((link, i) => (
                      <motion.div
                        key={link.path}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                      >
                        <Link
                          href={link.path}
                          onClick={() => setIsOpen(false)}
                          className={cn(
                            "font-bebas text-5xl sm:text-6xl tracking-tighter transition-all flex items-center justify-between group",
                            pathname === link.path ? "text-white" : "text-black hover:text-white"
                          )}
                        >
                          <span className="relative">
                            {link.name}
                            {pathname === link.path && <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-2 h-2 bg-black rounded-full" />}
                          </span>
                          <ArrowRight className="w-10 h-10 opacity-0 group-hover:opacity-100 transition-all -translate-x-4 group-hover:translate-x-0" />
                        </Link>
                      </motion.div>
                    ))}
                  </div>

                  <div className="p-8 border-t-8 border-black bg-white relative z-10 space-y-4">
                    <Link href="/menu" onClick={() => setIsOpen(false)}>
                      <Button className="w-full h-20 rounded-none bg-[#ED1C24] text-white font-bebas text-4xl tracking-widest border-4 border-black shadow-[8px_8px_0_0_rgba(0,0,0,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all">
                        ORDER NOW
                      </Button>
                    </Link>

                    {!user ? (
                      <div className="grid grid-cols-2 gap-4">
                        <Link href="/auth?tab=login" className="w-full" onClick={() => setIsOpen(false)}>
                          <Button className="w-full h-14 rounded-none bg-black text-white font-bebas text-2xl border-2 border-black hover:bg-[#008A45] transition-colors">LOGIN</Button>
                        </Link>
                        <Link href="/auth?tab=register" className="w-full" onClick={() => setIsOpen(false)}>
                          <Button className="w-full h-14 rounded-none bg-[#FFD200] text-black font-bebas text-2xl border-2 border-black hover:bg-white transition-colors">JOIN</Button>
                        </Link>
                      </div>
                    ) : (
                      <Button
                        onClick={handleLogout}
                        className="w-full h-14 rounded-none bg-black text-white font-bebas text-2xl border-2 border-black"
                      >
                        LOGOUT
                      </Button>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </nav>
    </header>
  );
}
export default Navbar;
