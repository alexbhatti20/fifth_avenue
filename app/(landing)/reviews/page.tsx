import { getPublicReviewsServer } from "@/lib/server-queries";
import PublicReviewsClient from "./PublicReviewsClient";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Customer Reviews | ZOIRO Broast",
  description: "Read authentic reviews from our customers. See what people are saying about ZOIRO Broast's delicious broasted chicken and exceptional service.",
  openGraph: {
    title: "Customer Reviews | ZOIRO Broast",
    description: "Read authentic reviews from our customers. See what people are saying about ZOIRO Broast.",
    type: "website",
  },
};

export default async function PublicReviewsPage() {
  // Fetch initial data server-side (hidden from browser Network tab)
  const initialData = await getPublicReviewsServer();

  return <PublicReviewsClient initialData={initialData} />;
}
