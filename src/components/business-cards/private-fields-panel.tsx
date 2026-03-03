"use client";

import { Lock, Mail, Phone, MapPin, FileText } from "lucide-react";

type PrivateFields = {
  email: string | null;
  directPhone: string | null;
  mobilePhone: string | null;
  fax: string | null;
  postalCode: string | null;
  address: string | null;
  sharedMemoTitle: string | null;
  exchangePlace: string | null;
  workHistory: string | null;
  personality: string | null;
  textMemo: string | null;
};

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string | null;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5 py-2 border-b border-zinc-50 last:border-0">
      <Icon className="w-3.5 h-3.5 text-zinc-400 mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-[10px] font-medium text-zinc-400 uppercase tracking-wide">
          {label}
        </p>
        <p className="text-xs text-zinc-700 mt-0.5 whitespace-pre-wrap">
          {value}
        </p>
      </div>
    </div>
  );
}

export function PrivateFieldsPanel({
  canView,
  fields,
}: {
  canView: boolean;
  fields: PrivateFields;
}) {
  if (!canView) {
    return (
      <div className="bg-amber-50 rounded-xl border border-amber-200 p-6 text-center">
        <Lock className="w-8 h-8 text-amber-400 mx-auto mb-2" />
        <p className="text-sm font-medium text-amber-700">
          秘匿情報はロックされています
        </p>
        <p className="text-xs text-amber-600 mt-1">
          所有者・管理者のみ閲覧可能です。開示を希望する場合は申請してください。
        </p>
      </div>
    );
  }

  const hasAnyField = Object.values(fields).some((v) => v);
  if (!hasAnyField) {
    return (
      <div className="bg-zinc-50 rounded-xl border border-zinc-200 p-4 text-center">
        <p className="text-xs text-zinc-400">秘匿情報はありません</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50/50">
        <div className="flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-zinc-500" />
          <h3 className="text-xs font-semibold text-zinc-700">秘匿情報</h3>
        </div>
      </div>
      <div className="px-4 py-2">
        <InfoRow icon={Mail} label="メールアドレス" value={fields.email} />
        <InfoRow icon={Phone} label="直通電話" value={fields.directPhone} />
        <InfoRow icon={Phone} label="携帯電話" value={fields.mobilePhone} />
        <InfoRow icon={Phone} label="FAX" value={fields.fax} />
        <InfoRow icon={MapPin} label="郵便番号" value={fields.postalCode} />
        <InfoRow icon={MapPin} label="住所" value={fields.address} />
        <InfoRow icon={FileText} label="共有メモ" value={fields.sharedMemoTitle} />
        <InfoRow icon={FileText} label="名刺交換場所" value={fields.exchangePlace} />
        <InfoRow icon={FileText} label="経歴" value={fields.workHistory} />
        <InfoRow icon={FileText} label="人柄" value={fields.personality} />
        <InfoRow icon={FileText} label="メモ" value={fields.textMemo} />
      </div>
    </div>
  );
}
