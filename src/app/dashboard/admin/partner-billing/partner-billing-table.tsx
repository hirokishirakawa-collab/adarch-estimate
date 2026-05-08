"use client";

import { useState, useTransition } from "react";
import { Check, X, Pencil, Save, Loader2 } from "lucide-react";
import { updatePartnerBillingInfo } from "@/lib/actions/partner-billing";

type EntityType = "CORPORATION" | "SOLE_PROPRIETOR" | "UNKNOWN";
type BankAccountType = "SAVINGS" | "CHECKING" | null;

interface Company {
  id: string;
  name: string;
  ownerName: string;
  registeredName: string | null;
  entityType: EntityType;
  corporateNumber: string | null;
  invoiceNumber: string | null;
  invoiceRegistered: boolean;
  bankName: string | null;
  bankBranch: string | null;
  bankAccountType: BankAccountType;
  bankAccountNumber: string | null;
  bankAccountHolder: string | null;
  contractEndDate: Date | string | null;
  contractRenewed: boolean;
}

const ENTITY_LABELS: Record<EntityType, { label: string; cls: string }> = {
  CORPORATION: { label: "法人", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  SOLE_PROPRIETOR: { label: "個人事業主", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  UNKNOWN: { label: "未確認", cls: "bg-red-50 text-red-700 border-red-200" },
};

export function PartnerBillingTable({ companies }: { companies: Company[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200">
              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600">パートナー</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600">法人区分</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600">インボイス</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600">振込先口座</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600">源泉徴収</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600">契約満了</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-zinc-600 w-20">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {companies.map((c) =>
              editingId === c.id ? (
                <EditRow key={c.id} company={c} onDone={() => setEditingId(null)} />
              ) : (
                <ViewRow key={c.id} company={c} onEdit={() => setEditingId(c.id)} />
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ViewRow({ company: c, onEdit }: { company: Company; onEdit: () => void }) {
  const entity = ENTITY_LABELS[c.entityType];
  const hasBank = c.bankName && c.bankAccountNumber;
  const needsWithholding = c.entityType === "SOLE_PROPRIETOR";

  return (
    <tr className="hover:bg-zinc-50/50">
      <td className="px-4 py-3">
        <p className="font-medium text-zinc-900">{c.name}</p>
        <p className="text-[11px] text-zinc-400">{c.ownerName}</p>
        {c.registeredName && (
          <p className="text-[11px] text-indigo-500">{c.registeredName}</p>
        )}
      </td>
      <td className="px-4 py-3">
        <span className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded-full border ${entity.cls}`}>
          {entity.label}
        </span>
        {c.corporateNumber && (
          <p className="text-[11px] text-zinc-400 mt-0.5">{c.corporateNumber}</p>
        )}
      </td>
      <td className="px-4 py-3">
        {c.invoiceRegistered ? (
          <div className="flex items-center gap-1 text-emerald-600">
            <Check className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">登録済</span>
            {c.invoiceNumber && (
              <span className="text-[11px] text-zinc-400 ml-1">{c.invoiceNumber}</span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1 text-red-500">
            <X className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">未登録</span>
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        {hasBank ? (
          <div className="text-xs text-zinc-700">
            <p>{c.bankName} {c.bankBranch}</p>
            <p className="text-zinc-400">
              {c.bankAccountType === "SAVINGS" ? "普通" : c.bankAccountType === "CHECKING" ? "当座" : ""}{" "}
              {c.bankAccountNumber} / {c.bankAccountHolder}
            </p>
          </div>
        ) : (
          <span className="text-xs text-red-500 font-medium">未登録</span>
        )}
      </td>
      <td className="px-4 py-3">
        {needsWithholding ? (
          <div className="space-y-0.5">
            <span className="inline-block px-2 py-0.5 text-[11px] font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-200">
              要源泉
            </span>
            {!c.invoiceRegistered && (
              <span className="block text-[10px] text-red-500 font-medium">
                +控除不可消費税
              </span>
            )}
          </div>
        ) : c.entityType === "UNKNOWN" ? (
          <span className="text-xs text-zinc-400">要確認</span>
        ) : (
          <span className="text-xs text-zinc-400">不要</span>
        )}
      </td>
      <td className="px-4 py-3">
        <ContractCell endDate={c.contractEndDate} renewed={c.contractRenewed} />
      </td>
      <td className="px-4 py-3 text-center">
        <button
          onClick={onEdit}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-zinc-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
        >
          <Pencil className="w-3 h-3" />
          編集
        </button>
      </td>
    </tr>
  );
}

function EditRow({ company: c, onDone }: { company: Company; onDone: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [registeredName, setRegisteredName] = useState(c.registeredName ?? "");
  const [entityType, setEntityType] = useState<EntityType>(c.entityType);
  const [corporateNumber, setCorporateNumber] = useState(c.corporateNumber ?? "");
  const [isLookingUp, setIsLookingUp] = useState(false);

  // 法人番号13桁入力時に国税庁APIから法人名を自動取得
  async function lookupCorporateNumber(num: string) {
    if (num.length !== 13) return;
    setIsLookingUp(true);
    try {
      const res = await fetch(`/api/corporate-number/${num}`);
      if (res.ok) {
        const data = await res.json();
        if (data.name) setRegisteredName(data.name);
      }
    } catch {
      // ignore
    } finally {
      setIsLookingUp(false);
    }
  }
  const [invoiceNumber, setInvoiceNumber] = useState(c.invoiceNumber ?? "");
  const [invoiceRegistered, setInvoiceRegistered] = useState(c.invoiceRegistered);
  const [bankName, setBankName] = useState(c.bankName ?? "");
  const [bankBranch, setBankBranch] = useState(c.bankBranch ?? "");
  const [bankAccountType, setBankAccountType] = useState<string>(c.bankAccountType ?? "SAVINGS");
  const [bankAccountNumber, setBankAccountNumber] = useState(c.bankAccountNumber ?? "");
  const [bankAccountHolder, setBankAccountHolder] = useState(c.bankAccountHolder ?? "");
  const [contractEndDate, setContractEndDate] = useState(
    c.contractEndDate ? new Date(c.contractEndDate).toISOString().slice(0, 10) : ""
  );
  const [contractRenewed, setContractRenewed] = useState(c.contractRenewed);

  function handleSave() {
    startTransition(async () => {
      await updatePartnerBillingInfo(c.id, {
        registeredName: registeredName || null,
        entityType,
        corporateNumber: corporateNumber || null,
        invoiceNumber: invoiceNumber || null,
        invoiceRegistered,
        bankName: bankName || null,
        bankBranch: bankBranch || null,
        bankAccountType: (bankAccountType as "SAVINGS" | "CHECKING") || null,
        bankAccountNumber: bankAccountNumber || null,
        bankAccountHolder: bankAccountHolder || null,
        contractEndDate: contractEndDate || null,
        contractRenewed,
      });
      onDone();
    });
  }

  const inputCls =
    "w-full px-2 py-1 text-xs border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-300 bg-white";

  return (
    <tr className="bg-indigo-50/30">
      <td className="px-4 py-3">
        <p className="font-medium text-zinc-900">{c.name}</p>
        <p className="text-[11px] text-zinc-400">{c.ownerName}</p>
        <input
          type="text"
          value={registeredName}
          onChange={(e) => setRegisteredName(e.target.value)}
          placeholder="登記名（例: 合同会社○○）"
          className={`${inputCls} mt-1`}
        />
        {isLookingUp && <p className="text-[10px] text-indigo-500">法人名を取得中...</p>}
      </td>
      <td className="px-4 py-3 space-y-1.5">
        <select
          value={entityType}
          onChange={(e) => setEntityType(e.target.value as EntityType)}
          className={inputCls}
        >
          <option value="UNKNOWN">未確認</option>
          <option value="CORPORATION">法人</option>
          <option value="SOLE_PROPRIETOR">個人事業主</option>
        </select>
        {entityType === "CORPORATION" && (
          <input
            type="text"
            value={corporateNumber}
            onChange={(e) => {
              const v = e.target.value;
              setCorporateNumber(v);
              if (v.length === 13) lookupCorporateNumber(v);
            }}
            placeholder="法人番号（13桁）→自動取得"
            maxLength={13}
            className={inputCls}
          />
        )}
      </td>
      <td className="px-4 py-3 space-y-1.5">
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={invoiceRegistered}
            onChange={(e) => setInvoiceRegistered(e.target.checked)}
            className="rounded border-zinc-300"
          />
          登録済
        </label>
        {invoiceRegistered && (
          <input
            type="text"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            placeholder="T+13桁"
            maxLength={14}
            className={inputCls}
          />
        )}
      </td>
      <td className="px-4 py-3 space-y-1.5">
        <input
          type="text"
          value={bankName}
          onChange={(e) => setBankName(e.target.value)}
          placeholder="銀行名"
          className={inputCls}
        />
        <input
          type="text"
          value={bankBranch}
          onChange={(e) => setBankBranch(e.target.value)}
          placeholder="支店名"
          className={inputCls}
        />
        <div className="flex gap-1.5">
          <select
            value={bankAccountType}
            onChange={(e) => setBankAccountType(e.target.value)}
            className={`${inputCls} w-20`}
          >
            <option value="SAVINGS">普通</option>
            <option value="CHECKING">当座</option>
          </select>
          <input
            type="text"
            value={bankAccountNumber}
            onChange={(e) => setBankAccountNumber(e.target.value)}
            placeholder="口座番号"
            maxLength={8}
            className={inputCls}
          />
        </div>
        <input
          type="text"
          value={bankAccountHolder}
          onChange={(e) => setBankAccountHolder(e.target.value)}
          placeholder="口座名義（カナ）"
          className={inputCls}
        />
      </td>
      <td className="px-4 py-3 text-xs text-zinc-400">
        {entityType === "SOLE_PROPRIETOR" ? "要源泉" : entityType === "CORPORATION" ? "不要" : "要確認"}
      </td>
      <td className="px-4 py-3 space-y-1.5">
        <input
          type="date"
          value={contractEndDate}
          onChange={(e) => setContractEndDate(e.target.value)}
          className={inputCls}
        />
        <label className="flex items-center gap-1.5 text-[11px] text-zinc-600">
          <input
            type="checkbox"
            checked={contractRenewed}
            onChange={(e) => setContractRenewed(e.target.checked)}
            className="rounded border-zinc-300"
          />
          更新済
        </label>
      </td>
      <td className="px-4 py-3 text-center space-y-1">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-60"
        >
          {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          保存
        </button>
        <button
          onClick={onDone}
          disabled={isPending}
          className="block mx-auto text-[11px] text-zinc-400 hover:text-zinc-600"
        >
          取消
        </button>
      </td>
    </tr>
  );
}

function ContractCell({ endDate, renewed }: { endDate: Date | string | null; renewed: boolean }) {
  if (!endDate) return <span className="text-xs text-zinc-300">未設定</span>;

  const end = new Date(endDate);
  const now = new Date();
  const diff = end.getTime() - now.getTime();
  const daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
  const dateStr = end.toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });

  if (renewed) {
    return (
      <div>
        <span className="text-xs text-emerald-600 font-medium">更新済</span>
        <p className="text-[11px] text-zinc-400">{dateStr}</p>
      </div>
    );
  }

  if (daysLeft <= 0) {
    return (
      <div>
        <span className="inline-block px-2 py-0.5 text-[11px] font-semibold rounded-full bg-red-50 text-red-700 border border-red-200">満了</span>
        <p className="text-[11px] text-zinc-400">{dateStr}</p>
      </div>
    );
  }

  const cls = daysLeft <= 30
    ? "bg-red-50 text-red-700 border-red-200"
    : daysLeft <= 60
    ? "bg-orange-50 text-orange-700 border-orange-200"
    : daysLeft <= 90
    ? "bg-amber-50 text-amber-700 border-amber-200"
    : "bg-zinc-50 text-zinc-600 border-zinc-200";

  return (
    <div>
      <span className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded-full border ${cls}`}>
        残{daysLeft}日
      </span>
      <p className="text-[11px] text-zinc-400">{dateStr}</p>
    </div>
  );
}
