import { getLoyaltyPageDataServer, getServerCustomer } from "@/lib/server-queries";
import LoyaltyClient from "./LoyaltyClient";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Loyalty Program | Fifth Avenue",
  description: "Earn points, unlock rewards, and enjoy exclusive deals with the Fifth Avenue loyalty program",
};

export default async function LoyaltyPage() {
  // Get customer from server-side session
  const customer = await getServerCustomer();

  // Redirect unauthenticated users immediately on the server
  if (!customer) {
    redirect("/auth");
  }

  const data = await getLoyaltyPageDataServer(customer.id);

  return (
    <LoyaltyClient
      initialLoyalty={data.loyalty}
      initialPromoCodes={data.promoCodes}
      initialPointsHistory={data.pointsHistory}
    />
  );
}
