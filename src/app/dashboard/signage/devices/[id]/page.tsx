import Link from "next/link";
import { SignageHeader, SignageNav } from "@/components/signage/shared";
import { DeviceDetail } from "@/components/signage/device-detail";

export const dynamic = "force-dynamic";

export default async function SignageDevicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="px-6 py-6 max-w-screen-xl mx-auto w-full">
      <SignageHeader title="端末" desc="放映スケジュール・端末情報・動作状況" right={<Link href="/dashboard/signage" className="text-xs text-zinc-500 hover:text-zinc-800">← 端末一覧へ</Link>} />
      <SignageNav active="devices" />
      <DeviceDetail deviceId={id} />
    </div>
  );
}
