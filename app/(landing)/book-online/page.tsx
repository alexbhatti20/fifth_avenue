// =============================================
// BOOK ONLINE PAGE - SERVER COMPONENT (SSR)
// Table data + booking setting fetched server-side — hidden from browser
// =============================================

import { Suspense } from "react";
import { Metadata } from "next";
import { getTablesForBookingServer } from "@/lib/server-queries";
import BookOnlineClient from "./BookOnlineClient";

export const metadata: Metadata = {
  title: "Book a Table | Fifth Avenue",
  description:
    "Reserve your table at Fifth Avenue. View real-time table availability, pick a date and time, and even pre-order your meal.",
  keywords: [
    "zoiro broast table booking",
    "book a table vehari",
    "restaurant reservation vehari",
    "zoiro reservation",
    "online table booking",
  ],
  openGraph: {
    title: "Book a Table | Fifth Avenue",
    description:
      "Reserve your table at Fifth Avenue. Real-time availability and instant confirmation.",
    type: "website",
  },
};

export default async function BookOnlinePage() {
  // Fetch on server — hidden from browser Network tab; also auto-releases expired reservations
  const { tables: initialTables, booking_enabled } = await getTablesForBookingServer();

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400 text-lg animate-pulse">Loading table availability…</div>
      </div>
    }>
      <BookOnlineClient
        initialTables={initialTables}
        bookingEnabled={booking_enabled}
      />
    </Suspense>
  );
}
