"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { toggleBusinessCardFlag } from "@/lib/actions/business-card";

type FlagName = "isCompetitor" | "isOrdered" | "wantsCollab" | "isCreator";

interface FlagDef {
  key: FlagName;
  label: string;
  onClass: string;
  offClass: string;
}

const FLAGS: FlagDef[] = [
  {
    key: "isCompetitor",
    label: "競合",
    onClass: "bg-red-50 text-red-600 border-red-100",
    offClass: "bg-zinc-50 text-zinc-400 border-dashed border-zinc-200",
  },
  {
    key: "wantsCollab",
    label: "コラボ希望",
    onClass: "bg-emerald-50 text-emerald-600 border-emerald-100",
    offClass: "bg-zinc-50 text-zinc-400 border-dashed border-zinc-200",
  },
  {
    key: "isOrdered",
    label: "受注済み",
    onClass: "bg-blue-50 text-blue-600 border-blue-100",
    offClass: "bg-zinc-50 text-zinc-400 border-dashed border-zinc-200",
  },
  {
    key: "isCreator",
    label: "クリエイター",
    onClass: "bg-violet-50 text-violet-600 border-violet-100",
    offClass: "bg-zinc-50 text-zinc-400 border-dashed border-zinc-200",
  },
];

type FlagValues = Record<FlagName, boolean>;

export function FlagToggles({
  cardId,
  initialFlags,
  canEdit,
}: {
  cardId: string;
  initialFlags: FlagValues;
  canEdit: boolean;
}) {
  const [flags, setFlags] = useState(initialFlags);
  const [pending, startTransition] = useTransition();

  function handleToggle(flag: FlagName) {
    if (!canEdit || pending) return;
    const newValue = !flags[flag];

    // 楽観的に即反映
    setFlags((prev) => ({ ...prev, [flag]: newValue }));

    startTransition(async () => {
      const result = await toggleBusinessCardFlag(cardId, flag, newValue);
      if (result.error) {
        // 失敗時は戻す
        setFlags((prev) => ({ ...prev, [flag]: !newValue }));
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {FLAGS.map((f) => {
        const isOn = flags[f.key];

        // 編集不可かつ OFF のフラグは非表示
        if (!canEdit && !isOn) return null;

        return (
          <button
            key={f.key}
            type="button"
            onClick={() => handleToggle(f.key)}
            disabled={!canEdit}
            className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${
              isOn ? f.onClass : f.offClass
            } ${canEdit ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );
}
