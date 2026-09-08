"use client";

// 本部用: 案内元の拠点を選ぶ → URL の ?company= を書き換える（AreaPicker と同じ流儀）
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export function CompanyPicker({ companies, value }: { companies: { id: string; name: string; ownerName: string; prefecture: string | null }[]; value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  return (
    <label className="text-xs text-zinc-600">
      <span className="block mb-1 font-semibold">案内元（商談中の代表）</span>
      <select
        value={value}
        disabled={pending}
        onChange={(e) => {
          const q = new URLSearchParams(sp.toString());
          if (e.target.value) q.set("company", e.target.value); else q.delete("company");
          q.delete("pref"); q.delete("city");
          start(() => router.replace(`${pathname}?${q.toString()}`, { scroll: false }));
        }}
        className="px-3 py-2 text-sm bg-white border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F19834]/40 min-w-[220px]"
      >
        <option value="">本部（Ad Arch株式会社）</option>
        {companies.map((c) => (
          <option key={c.id} value={c.id}>{c.name}（{c.ownerName}{c.prefecture ? `・${c.prefecture}` : ""}）</option>
        ))}
      </select>
    </label>
  );
}
