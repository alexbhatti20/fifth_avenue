import { getCustomerPaymentsServer, getServerCustomer } from "@/lib/server-queries";
import PaymentsClient from "./PaymentsClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Payment History | Fifth Avenue",
  description: "View your payment history and transaction details at Fifth Avenue",
};

export default async function PaymentsPage() {
  // Get customer from server-side session
  const customer = await getServerCustomer();
  
  let initialPayments: any[] = [];
  
  if (customer) {
    initialPayments = await getCustomerPaymentsServer(customer.id);
  }

  return <PaymentsClient initialPayments={initialPayments} />;
}
