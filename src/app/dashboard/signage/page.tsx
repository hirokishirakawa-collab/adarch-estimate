import { headers } from "next/headers";
import { db } from "@/lib/db";
import { getSessionInfo } from "@/lib/session";
import { SignageHeader, SignageNav } from "@/components/signage/shared";
import { DeviceList } from "@/components/signage/device-list";

export const dynamic = "force-dynamic";

export default async function SignagePage() {
  const info = await getSessionInfo();
  if (!info) return null;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const playerUrl = `${proto}://${host}/signage/player`;
  const branches = info.role === "ADMIN" ? await db.branch.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : [];

  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full">
      <SignageHeader title="サイネージ" desc="設置先に置いた端末へ、拠点の素材と広告枠をクラウドから配信します（無償設置＋広告枠販売）" />
      <SignageNav active="devices" />
      <DeviceList role={info.role} playerUrl={playerUrl} branches={branches} />
    </div>
  );
}
