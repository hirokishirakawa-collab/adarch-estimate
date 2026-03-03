"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { changeBusinessCardOwner } from "@/lib/actions/business-card";

export function OwnerSelect({
  cardId,
  currentOwnerId,
  users,
}: {
  cardId: string;
  currentOwnerId: string;
  users: { id: string; name: string }[];
}) {
  const [ownerId, setOwnerId] = useState(currentOwnerId);
  const [pending, startTransition] = useTransition();

  function handleChange(newOwnerId: string) {
    if (newOwnerId === ownerId) return;
    const prev = ownerId;
    setOwnerId(newOwnerId);

    startTransition(async () => {
      const result = await changeBusinessCardOwner(cardId, newOwnerId);
      if (result.error) {
        setOwnerId(prev);
        toast.error(result.error);
      } else {
        toast.success("所有者を変更しました");
      }
    });
  }

  return (
    <select
      value={ownerId}
      onChange={(e) => handleChange(e.target.value)}
      disabled={pending}
      className="text-xs font-medium text-zinc-700 bg-transparent border border-zinc-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-zinc-300 cursor-pointer"
    >
      {users.map((u) => (
        <option key={u.id} value={u.id}>
          {u.name}
        </option>
      ))}
    </select>
  );
}
