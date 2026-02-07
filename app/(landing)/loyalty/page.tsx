import { getLoyaltyPageDataServer, getServerCustomer } from "@/lib/server-queries";
import LoyaltyClient from "./LoyaltyClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Loyalty Program | ZOIRO Injected Broast",
  description: "Earn points, unlock rewards, and enjoy exclusive deals with ZOIRO Injected Broast loyalty program",
};

export default async function LoyaltyPage() {
  // Get customer from server-side session
  const customer = await getServerCustomer();
  
  let initialLoyalty = null;
  let initialPromoCodes: any[] = [];
  let initialPointsHistory: any[] = [];
  
  if (customer) {
    const data = await getLoyaltyPageDataServer(customer.id);
    initialLoyalty = data.loyalty;
    initialPromoCodes = data.promoCodes;
    initialPointsHistory = data.pointsHistory;
  }

  return (
    <LoyaltyClient
      initialLoyalty={initialLoyalty}
      initialPromoCodes={initialPromoCodes}
      initialPointsHistory={initialPointsHistory}
    />
  );
}
