"use client";

import { useEffect, useState, useCallback } from "react";
import { Activity, ArrowRight } from "lucide-react";
import Link from "next/link";
import { ActivityForm } from "@/components/proposals/activity-form";
import { ActivityList } from "@/components/proposals/activity-list";

interface ActivityData {
  id: string;
  companyName: string;
  type: string;
  note: string | null;
  date: string;
  createdAt: string;
}

export default function SalesActivitiesPage() {
  const [activities, setActivities] = useState<ActivityData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/sales-activities");
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/sales-activities/${id}`, { method: "DELETE" });
    if (res.ok) fetchData();
  };

  if (loading) {
    return (
      <div className="px-6 py-6 max-w-screen-2xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-zinc-100 rounded w-48" />
          <div className="h-32 bg-zinc-100 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-6 space-y-5 max-w-screen-2xl mx-auto w-full">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
            <Activity className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900">営業アクティビティ</h2>
            <p className="text-xs text-zinc-500">
              商談・アプローチ等の営業活動を記録
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/proposals"
          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
        >
          提案書AIへ <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <ActivityForm onSuccess={fetchData} />

      <ActivityList activities={activities} onDelete={handleDelete} />
    </div>
  );
}
