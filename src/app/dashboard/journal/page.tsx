import { redirect } from "next/navigation";
import { viewer } from "@/lib/journal/http";
import JournalDesk from "@/components/journal/desk";
import { db } from "@/lib/db";
export const dynamic="force-dynamic";
export default async function Page(){
  const v=await viewer().catch(()=>null);if(!v)redirect("/login");
  const company=v.groupCompanyId?await db.groupCompany.findUnique({where:{id:v.groupCompanyId},select:{name:true,branchLabels:true}}):null;
  return <JournalDesk admin={false} defaults={{authorName:v.name??"",company:company?.name??(v.role==="ADMIN"?"Ad Arch株式会社":""),region:company?.branchLabels.join(" / ")||"全国"}}/>;
}
