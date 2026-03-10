"use client";

import { useState, useTransition } from "react";
import { updateCustomerBranch } from "@/lib/actions/customer";
import { MapPin } from "lucide-react";

type Branch = { id: string; name: string };

export function BranchSelector({
  customerId,
  currentBranchId,
  branches,
}: {
  customerId: string;
  currentBranchId: string;
  branches: Branch[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newBranchId = e.target.value;
    if (newBranchId === currentBranchId) return;
    setError(null);
    startTransition(async () => {
      const result = await updateCustomerBranch(customerId, newBranchId);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <MapPin className="w-3 h-3 text-zinc-400" />
      <select
        value={currentBranchId}
        onChange={handleChange}
        disabled={isPending}
        className="text-[11px] font-medium text-zinc-600 bg-zinc-50 border border-zinc-200 rounded-md px-2 py-0.5 hover:border-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-300 disabled:opacity-50 cursor-pointer"
      >
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
      {error && <span className="text-[10px] text-red-500">{error}</span>}
    </div>
  );
}
