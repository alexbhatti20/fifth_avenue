"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, House, ShoppingBag, Tag, UtensilsCrossed, type LucideIcon } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { cn } from "@/lib/utils";

const mobileLinks: Array<{ href: string; label: string; icon: LucideIcon; accent: string }> = [
  { href: "/", label: "HOME", icon: House, accent: "#ED1C24" },
  { href: "/menu", label: "MENU", icon: UtensilsCrossed, accent: "#F28C00" },
  { href: "/offers", label: "OFFERS", icon: Tag, accent: "#008A45" },
  { href: "/orders", label: "ORDERS", icon: ClipboardList, accent: "#FFF4CC" },
  { href: "/cart", label: "CART", icon: ShoppingBag, accent: "#ED1C24" },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { totalItems } = useCart();

  const isActiveLink = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <nav className="md:hidden fixed inset-x-0 bottom-0 z-[90] pointer-events-none">
      <div
        className="pointer-events-auto px-3"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      >
        <div className="relative border-4 border-black bg-[#FFD200] shadow-[0_-2px_0px_0px_rgba(0,0,0,1),8px_8px_0px_0px_rgba(0,0,0,1)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,#FFF4CC_0%,rgba(255,244,204,0.35)_40%,transparent_70%)]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5 bg-black" />
          <div className="pointer-events-none absolute left-3 right-3 top-[7px] h-[3px] bg-[repeating-linear-gradient(90deg,#FFD200_0_12px,#111111_12px_20px,#F28C00_20px_28px,#111111_28px_36px)]" />

          <div className="absolute -top-7 left-1/2 -translate-x-1/2 border-2 border-black bg-black px-4 py-0.5">
            <span className="font-bebas text-[10px] tracking-[0.2em] text-[#FFD200]">QUICK NAV</span>
          </div>

          <div className="grid grid-cols-5 pt-2">
            {mobileLinks.map((link, index) => {
              const Icon = link.icon;
              const isActive = isActiveLink(link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "group relative flex h-[4.75rem] flex-col items-center justify-center gap-1 border-r-2 border-black px-1 transition-colors duration-200 active:translate-y-[1px]",
                    index === mobileLinks.length - 1 && "border-r-0",
                    isActive
                      ? "bg-black text-[#FFD200]"
                      : "bg-transparent text-black hover:bg-[#FFF4CC]/80 active:bg-[#FFF4CC]/80"
                  )}
                >
                  {isActive && (
                    <span
                      className="absolute inset-x-4 top-0 h-1 border-x border-b border-black"
                      style={{ backgroundColor: link.accent }}
                    />
                  )}

                  <div
                    className={cn(
                      "relative flex h-7 w-7 items-center justify-center border-2 transition-all",
                      isActive
                        ? "border-[#FFD200] bg-[#FFD200] text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                        : "border-transparent text-black/85 group-hover:border-black/35"
                    )}
                  >
                    <Icon className={cn("h-4 w-4", isActive && "scale-110")} />
                  </div>

                  <span className="font-bebas text-[10px] leading-none tracking-[0.16em]">
                    {link.label}
                  </span>

                  {link.href === "/cart" && totalItems > 0 && (
                    <span className="absolute top-1.5 right-1 inline-flex h-5 min-w-5 items-center justify-center rounded-none border-2 border-black bg-[#ED1C24] px-1 text-[10px] font-bebas leading-none text-white shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                      {totalItems > 99 ? "99+" : totalItems}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
