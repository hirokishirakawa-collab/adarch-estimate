import { getMyCustomersForApproach } from "@/lib/actions/sales-approach";
import { ApproachForm } from "./approach-form";

export default async function NewSalesApproachPage() {
  const customers = await getMyCustomersForApproach();

  return <ApproachForm customers={customers} />;
}
