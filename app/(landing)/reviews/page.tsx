import { getPublicReviewsServer } from "@/lib/server-queries";
import PublicReviewsClient from "./PublicReviewsClient";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The Squad Reckoning | Customer Reviews | Fifth Avenue",
  description: "Real stories from the streets. Read what the squad has to say about the boldest pizza and fast food in Vehari.",
  openGraph: {
    title: "The Squad Reckoning | Fifth Avenue Reviews",
    description: "Real talk. Real flavours. See why Vehari is chasing Fifth Avenue.",
    type: "website",
  },
};

export default async function PublicReviewsPage() {
  // Fetch initial data server-side (hidden from browser Network tab)
  const initialData = await getPublicReviewsServer();

  return <PublicReviewsClient initialData={initialData} />;
}
