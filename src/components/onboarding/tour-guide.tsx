"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

// ----------------------------------------------------------------
// ページごとのツアー定義
// ----------------------------------------------------------------
interface TourStep {
  element?: string;
  popover: {
    title: string;
    description: string;
    side?: "top" | "bottom" | "left" | "right";
  };
}

const TOURS: Record<string, TourStep[]> = {
  "/dashboard": [
    {
      popover: {
        title: "Ad Arch OS へようこそ！",
        description:
          "このツアーでは、OSの基本的な使い方をご案内します。1分ほどで完了します。",
      },
    },
    {
      element: "[data-tour='sidebar']",
      popover: {
        title: "サイドバー",
        description:
          "すべての機能はここからアクセスできます。営業・制作・経理など、カテゴリ別に整理されています。",
        side: "right",
      },
    },
    {
      element: "[data-tour='lead-ai']",
      popover: {
        title: "リード獲得AI",
        description:
          "エリアと業種を指定するだけで、AIが見込み顧客を自動検索・スコアリングします。",
        side: "bottom",
      },
    },
    {
      element: "[data-tour='digest']",
      popover: {
        title: "グループダイジェスト",
        description:
          "直近3日間のグループ全体の活動をAIが自動分析・要約します。毎日更新されます。",
        side: "bottom",
      },
    },
    {
      element: "[data-tour='guide-flow']",
      popover: {
        title: "基本の流れ",
        description:
          "① 顧客登録 → ② 商談管理 → ③ プロジェクト追加。この流れで案件を管理します。",
        side: "top",
      },
    },
    {
      element: "[data-tour='quick-actions']",
      popover: {
        title: "クイックアクション",
        description:
          "よく使う操作にすぐアクセスできます。まずは「顧客を登録」から始めてみましょう。",
        side: "top",
      },
    },
    {
      popover: {
        title: "ツアー完了！",
        description:
          "基本的な使い方は以上です。サイドバーから各機能を探索してみてください。もう一度見たい場合は、右下の「？」ボタンから再開できます。",
      },
    },
  ],
  "/dashboard/customers": [
    {
      popover: {
        title: "顧客管理（CRM）",
        description:
          "顧客情報を一元管理できます。先着優先ロック機能で、担当の重複を防ぎます。",
      },
    },
    {
      element: "[data-tour='customer-new']",
      popover: {
        title: "新規顧客登録",
        description: "ここから新しい顧客を登録します。会社名・担当者・連絡先を入力してください。",
        side: "bottom",
      },
    },
    {
      element: "[data-tour='customer-search']",
      popover: {
        title: "顧客検索",
        description: "会社名や担当者名で素早く検索できます。",
        side: "bottom",
      },
    },
  ],
  "/dashboard/estimates": [
    {
      popover: {
        title: "公式見積もり",
        description:
          "Ad Archグループ公式の見積書を作成・PDF出力できます。単価は本部で管理されています。",
      },
    },
    {
      element: "[data-tour='estimate-new']",
      popover: {
        title: "新規見積もり作成",
        description: "顧客を選択して、媒体・数量を入力するだけで見積書が完成します。",
        side: "bottom",
      },
    },
  ],
  "/dashboard/deals": [
    {
      popover: {
        title: "商談管理（SFA）",
        description:
          "商談の進捗をステージ別に管理します。受注確度や金額の分析もできます。",
      },
    },
  ],
  "/dashboard/projects": [
    {
      popover: {
        title: "プロジェクト管理",
        description:
          "受注後のプロジェクトを管理します。Google Driveフォルダが自動生成されます。",
      },
    },
  ],
};

// ----------------------------------------------------------------
// ツアー完了状態のlocalStorage管理
// ----------------------------------------------------------------
const STORAGE_KEY = "adarch-tour-completed";

function getCompletedTours(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function markTourCompleted(path: string) {
  const completed = getCompletedTours();
  if (!completed.includes(path)) {
    completed.push(path);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(completed));
  }
}

export function resetAllTours() {
  localStorage.removeItem(STORAGE_KEY);
}

// ----------------------------------------------------------------
// TourGuide コンポーネント
// ----------------------------------------------------------------
export function TourGuide() {
  const pathname = usePathname();
  const [hasRun, setHasRun] = useState(false);

  useEffect(() => {
    setHasRun(false);
  }, [pathname]);

  useEffect(() => {
    if (hasRun) return;

    const tourSteps = TOURS[pathname];
    if (!tourSteps) return;

    const completed = getCompletedTours();
    if (completed.includes(pathname)) return;

    // DOM要素が描画されるのを待つ
    const timer = setTimeout(() => {
      const d = driver({
        showProgress: true,
        animate: true,
        smoothScroll: true,
        stagePadding: 6,
        stageRadius: 8,
        popoverClass: "adarch-tour-popover",
        nextBtnText: "次へ",
        prevBtnText: "戻る",
        doneBtnText: "完了",
        progressText: "{{current}} / {{total}}",
        steps: tourSteps,
        onDestroyed: () => {
          markTourCompleted(pathname);
        },
      });
      d.drive();
      setHasRun(true);
    }, 800);

    return () => clearTimeout(timer);
  }, [pathname, hasRun]);

  return null;
}

// ----------------------------------------------------------------
// ヘルプボタン（右下に固定、ツアーを再起動）
// ----------------------------------------------------------------
export function TourHelpButton() {
  const pathname = usePathname();

  const startTour = () => {
    const tourSteps = TOURS[pathname];
    if (!tourSteps) return;

    const d = driver({
      showProgress: true,
      animate: true,
      smoothScroll: true,
      stagePadding: 6,
      stageRadius: 8,
      popoverClass: "adarch-tour-popover",
      nextBtnText: "次へ",
      prevBtnText: "戻る",
      doneBtnText: "完了",
      progressText: "{{current}} / {{total}}",
      steps: tourSteps,
    });
    d.drive();
  };

  if (!TOURS[pathname]) return null;

  return (
    <button
      onClick={startTour}
      className="fixed bottom-20 right-5 z-50 w-10 h-10 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center text-sm font-bold transition-all hover:scale-110"
      title="使い方ガイドを表示"
    >
      ?
    </button>
  );
}
