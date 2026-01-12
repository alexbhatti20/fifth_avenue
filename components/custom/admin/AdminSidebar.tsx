"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  UtensilsCrossed,
  ShoppingBag,
  Settings,
  LogOut,
  ChevronLeft,
  Menu,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/admin" },
  { icon: UtensilsCrossed, label: "Menu", path: "/admin/menu" },
  { icon: ShoppingBag, label: "Orders", path: "/admin/orders" },
  { icon: Settings, label: "Settings", path: "/admin/settings" },
];

export default function AdminSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-foreground z-50 flex items-center justify-between px-4">
        <Link href="/admin" className="text-2xl font-bebas text-primary">
          ZOIRO <span className="text-primary-foreground text-sm">Admin</span>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="text-primary-foreground"
          onClick={() => setCollapsed(!collapsed)}
        >
          <Menu className="h-6 w-6" />
        </Button>
      </div>

      {/* Mobile Overlay */}
      {!collapsed && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setCollapsed(true)}
        />
      )}

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 80 : 280 }}
        className={cn(
          "fixed left-0 top-0 h-screen bg-foreground text-primary-foreground z-50 flex flex-col transition-all duration-300",
          "lg:relative",
          collapsed ? "lg:w-20" : "lg:w-72",
          !collapsed ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-primary-foreground/10">
          {!collapsed && (
            <Link href="/admin" className="flex items-center gap-2">
              <span className="text-3xl font-bebas text-primary">ZOIRO</span>
              <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                Admin
              </span>
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="text-primary-foreground/70 hover:text-primary-foreground hidden lg:flex"
            onClick={() => setCollapsed(!collapsed)}
          >
            <ChevronLeft
              className={cn(
                "h-5 w-5 transition-transform",
                collapsed && "rotate-180"
              )}
            />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6 px-3">
          <ul className="space-y-2">
            {navItems.map((item) => {
              const isActive = pathname === item.path;
              return (
                <li key={item.path}>
                  <Link
                    href={item.path}
                    onClick={() => setCollapsed(true)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground"
                    )}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    {!collapsed && (
                      <span className="font-medium">{item.label}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Back to Site */}
        <div className="p-4 border-t border-primary-foreground/10">
          <Link
            href="/"
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground transition-all",
              collapsed && "justify-center"
            )}
          >
            <LogOut className="h-5 w-5" />
            {!collapsed && <span>Back to Site</span>}
          </Link>
        </div>
      </motion.aside>
    </>
  );
}
