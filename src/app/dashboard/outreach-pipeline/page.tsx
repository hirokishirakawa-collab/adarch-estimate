import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Send } from "lucide-react";
import type { UserRole } from "@/types/roles";
import { getOutreachLeads } from "@/lib/actions/outreach";
import { OutreachBoard } from "./outreach-board";

export default async function OutreachPipelinePage() {
  const session = await auth();
  const role = (session?.user?.role ?? "USER") as UserRole;
  if (role !== "ADMIN") redirect("/dashboard");

  const leads = await getOutreachLeads();
  const rows = leads.map((l) => ({
    id: l.id,
    companyName: l.companyName,
    contactName: l.contactName,
    email: l.email,
    website: l.website,
    businessNote: l.businessNote,
    draftSubject: l.draftSubject,
    draftBody: l.draftBody,
    status: l.status,
    ownerName: l.ownerName,
    createdAt: l.createdAt.toISOString(),
  }));

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-9 h-9 bg-sky-50 rounded-xl flex items-center justify-center">
          <Send className="text-sky-600" style={{ width: "1.125rem", height: "1.125rem" }} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-zinc-900">アウトリーチ・パイプライン</h2>
          <p className="text-xs text-zinc-500 mt-0.5">TVer/映像制作の一般企業向け。AIが下書き→ご自身でGmail確認のうえ送信（自動送信はしません）</p>
        </div>
      </div>
      <OutreachBoard initialRows={rows} isAdmin={role === "ADMIN"} />
    </div>
  );
}
