"use client";

import { PREFECTURES } from "@/lib/constants/crm";
import {
  BTOB_INDUSTRY_OPTIONS,
  CAPITAL_RANGE_OPTIONS,
  EMPLOYEE_RANGE_OPTIONS,
  LEAD_COUNT_OPTIONS,
} from "@/lib/constants/leads";
import { Button } from "@/components/ui/button";
import { Search, Loader2 } from "lucide-react";
import { useState } from "react";

interface BtoBSearchFormProps {
  onSubmit: (params: {
    prefecture: string;
    city: string;
    businessItem: string;
    companyName: string;
    capitalFrom?: number;
    capitalTo?: number;
    employeeFrom?: number;
    employeeTo?: number;
    limit: number;
  }) => void;
  loading: boolean;
}

export function BtoBSearchForm({ onSubmit, loading }: BtoBSearchFormProps) {
  const [capitalIdx, setCapitalIdx] = useState(0);
  const [employeeIdx, setEmployeeIdx] = useState(0);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const capOpt = CAPITAL_RANGE_OPTIONS[capitalIdx];
    const empOpt = EMPLOYEE_RANGE_OPTIONS[employeeIdx];
    onSubmit({
      prefecture: fd.get("prefecture") as string,
      city: fd.get("city") as string,
      businessItem: fd.get("businessItem") as string,
      companyName: fd.get("companyName") as string,
      capitalFrom: capOpt.from ?? undefined,
      capitalTo: capOpt.to ?? undefined,
      employeeFrom: empOpt.from ?? undefined,
      employeeTo: empOpt.to ?? undefined,
      limit: Number(fd.get("count")) || 20,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* 都道府県 */}
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">
            都道府県
          </label>
          <select
            name="prefecture"
            required
            className="w-full h-9 px-3 rounded-md border border-zinc-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">選択してください</option>
            {PREFECTURES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        {/* 市区町村 */}
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">
            市区町村（任意）
          </label>
          <input
            name="city"
            type="text"
            placeholder="例: 渋谷区"
            className="w-full h-9 px-3 rounded-md border border-zinc-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 業種 */}
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">
            業種
          </label>
          <select
            name="businessItem"
            required
            className="w-full h-9 px-3 rounded-md border border-zinc-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">選択してください</option>
            {BTOB_INDUSTRY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* 企業名 */}
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">
            企業名（任意）
          </label>
          <input
            name="companyName"
            type="text"
            placeholder="例: 株式会社〇〇"
            className="w-full h-9 px-3 rounded-md border border-zinc-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 資本金 */}
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">
            資本金
          </label>
          <select
            value={capitalIdx}
            onChange={(e) => setCapitalIdx(Number(e.target.value))}
            className="w-full h-9 px-3 rounded-md border border-zinc-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {CAPITAL_RANGE_OPTIONS.map((o, i) => (
              <option key={i} value={i}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* 従業員数 */}
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">
            従業員数
          </label>
          <select
            value={employeeIdx}
            onChange={(e) => setEmployeeIdx(Number(e.target.value))}
            className="w-full h-9 px-3 rounded-md border border-zinc-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {EMPLOYEE_RANGE_OPTIONS.map((o, i) => (
              <option key={i} value={i}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* 取得件数 */}
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">
            取得件数
          </label>
          <select
            name="count"
            className="w-full h-9 px-3 rounded-md border border-zinc-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            defaultValue={20}
          >
            {LEAD_COUNT_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}件
              </option>
            ))}
          </select>
        </div>
      </div>

      <Button type="submit" disabled={loading} className="w-full sm:w-auto">
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Search className="w-4 h-4" />
        )}
        {loading ? "検索中..." : "BtoB企業を検索"}
      </Button>
    </form>
  );
}
