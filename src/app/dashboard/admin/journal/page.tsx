import { redirect } from "next/navigation";
import { viewer } from "@/lib/journal/http";
import JournalDesk from "@/components/journal/desk";
export const dynamic="force-dynamic";
export default async function Page(){const v=await viewer().catch(()=>null);if(!v || v.role!=="ADMIN")redirect("/dashboard");return <JournalDesk admin/>;}
