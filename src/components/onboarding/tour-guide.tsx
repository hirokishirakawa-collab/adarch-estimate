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
  // ================================================================
  // メイン
  // ================================================================
  "/dashboard": [
    {
      popover: {
        title: "Ad Arch OS へようこそ！",
        description: "このツアーでは、OSの基本的な使い方をご案内します。1分ほどで完了します。",
      },
    },
    {
      element: "[data-tour='sidebar']",
      popover: {
        title: "サイドバー",
        description: "すべての機能はここからアクセスできます。営業・制作・経理など、カテゴリ別に整理されています。",
        side: "right",
      },
    },
    {
      element: "[data-tour='lead-ai']",
      popover: {
        title: "リード獲得AI",
        description: "エリアと業種を指定するだけで、AIが見込み顧客を自動検索・スコアリングします。",
        side: "bottom",
      },
    },
    {
      element: "[data-tour='digest']",
      popover: {
        title: "グループダイジェスト",
        description: "直近3日間のグループ全体の活動をAIが自動分析・要約します。毎日更新されます。",
        side: "bottom",
      },
    },
    {
      element: "[data-tour='guide-flow']",
      popover: {
        title: "基本の流れ",
        description: "① 顧客登録 → ② 商談管理 → ③ プロジェクト追加。この流れで案件を管理します。",
        side: "top",
      },
    },
    {
      element: "[data-tour='quick-actions']",
      popover: {
        title: "クイックアクション",
        description: "よく使う操作にすぐアクセスできます。まずは「顧客を登録」から始めてみましょう。",
        side: "top",
      },
    },
    {
      popover: {
        title: "ツアー完了！",
        description: "基本的な使い方は以上です。各ページにも個別ガイドがあります。右下の「？」ボタンからいつでも再開できます。",
      },
    },
  ],

  // ================================================================
  // 営業
  // ================================================================
  "/dashboard/customers": [
    {
      popover: {
        title: "顧客管理（CRM）",
        description: "全拠点の顧客データを一元管理します。先着優先ロック機能で、担当の重複を防ぎます。",
      },
    },
    {
      element: "[data-tour='customer-summary']",
      popover: {
        title: "サマリーカード",
        description: "総顧客数・取引中・ロック中など、現在の状況を一目で確認できます。",
        side: "bottom",
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
        title: "検索・フィルター",
        description: "会社名・担当者名で検索、ランク・都道府県・ステータスで絞り込めます。",
        side: "bottom",
      },
    },
    {
      element: "[data-tour='customer-table']",
      popover: {
        title: "顧客一覧",
        description: "顧客をクリックすると詳細ページへ。活動記録の入力やステータス変更ができます。",
        side: "top",
      },
    },
  ],
  "/dashboard/leads": [
    {
      popover: {
        title: "リード獲得AI",
        description: "エリア・業種を指定するだけで、AIが見込み顧客を自動検索・スコアリングします。",
      },
    },
    {
      element: "[data-tour='lead-guide']",
      popover: {
        title: "使い方ガイド",
        description: "① エリア・業種で検索 → ② AIスコアリング → ③ 有望リードを保存 → ④ リード管理で進捗追跡",
        side: "bottom",
      },
    },
    {
      element: "[data-tour='lead-search-panel']",
      popover: {
        title: "検索パネル",
        description: "エリアと業種を入力して検索ボタンを押すと、Google Places APIで候補企業を自動取得します。",
        side: "bottom",
      },
    },
  ],
  "/dashboard/leads/list": [
    {
      popover: {
        title: "リード管理",
        description: "リード獲得AIで取得した営業候補のステータスを管理します。",
      },
    },
    {
      element: "[data-tour='lead-list-summary']",
      popover: {
        title: "ステータスサマリー",
        description: "未着手・架電済み・アポ獲得・商談化・スキップ別に件数を確認できます。",
        side: "bottom",
      },
    },
    {
      element: "[data-tour='lead-list-filters']",
      popover: {
        title: "フィルター",
        description: "ステータス・担当者・業種・エリアで絞り込み。効率的にフォローできます。",
        side: "bottom",
      },
    },
    {
      element: "[data-tour='lead-list-table']",
      popover: {
        title: "リード一覧",
        description: "各リードのステータス変更、メモ追加、架電記録ができます。",
        side: "top",
      },
    },
    {
      element: "[data-tour='lead-list-import']",
      popover: {
        title: "CSVインポート・エクスポート",
        description: "外部リストのCSV一括取り込みや、現在のリードデータのエクスポートが可能です。",
        side: "bottom",
      },
    },
  ],
  "/dashboard/deals": [
    {
      popover: {
        title: "商談管理（SFA）",
        description: "商談の進捗をステージ別に管理します。パイプラインをカンバンで可視化。",
      },
    },
    {
      element: "[data-tour='deal-summary']",
      popover: {
        title: "商談サマリー",
        description: "商談総数・アクティブ・受注済み・受注率を一目で確認。",
        side: "bottom",
      },
    },
    {
      element: "[data-tour='deal-new']",
      popover: {
        title: "新規商談",
        description: "顧客を選択して新しい商談を作成します。金額・確度・ステージを設定。",
        side: "bottom",
      },
    },
    {
      element: "[data-tour='deal-view']",
      popover: {
        title: "ビュー切替",
        description: "カンバン・リスト・カレンダーなど、用途に合わせてビューを切り替えられます。",
        side: "bottom",
      },
    },
    {
      element: "[data-tour='deal-kanban']",
      popover: {
        title: "カンバンボード",
        description: "ドラッグ&ドロップで商談のステージを変更できます。",
        side: "top",
      },
    },
  ],
  "/dashboard/estimates": [
    {
      popover: {
        title: "公式見積もり",
        description: "Ad Archグループ公式の見積書を作成できます。標準単価マスタを使って素早く作成。",
      },
    },
    {
      element: "[data-tour='estimate-summary']",
      popover: {
        title: "ステータスサマリー",
        description: "見積もりの状態別（作成中・提出済み・受注・失注）の件数を確認。",
        side: "bottom",
      },
    },
    {
      element: "[data-tour='estimate-new']",
      popover: {
        title: "新規見積書作成",
        description: "顧客を選択 → 媒体・数量を入力するだけで見積書が完成します。",
        side: "bottom",
      },
    },
    {
      element: "[data-tour='estimate-table']",
      popover: {
        title: "見積もり一覧",
        description: "クリックで詳細表示。PDF出力やステータス変更もここから。",
        side: "top",
      },
    },
  ],
  "/dashboard/sales-insights": [
    {
      popover: {
        title: "営業インサイト共有",
        description: "各メンバーがClaudeで分析した営業結果をグループ全体で共有します。",
      },
    },
    {
      element: "[data-tour='insight-upload']",
      popover: {
        title: "インサイト投稿",
        description: "Claudeで生成した営業分析JSONをここに貼り付けて投稿します。",
        side: "bottom",
      },
    },
    {
      element: "[data-tour='insight-summary']",
      popover: {
        title: "全体サマリー",
        description: "レポート数・総送信数・返信率など、グループ全体の営業成績を俯瞰できます。",
        side: "bottom",
      },
    },
    {
      element: "[data-tour='insight-list']",
      popover: {
        title: "インサイト一覧",
        description: "各メンバーの分析結果を閲覧。HOT業種や返信傾向を確認できます。",
        side: "top",
      },
    },
  ],
  "/dashboard/video-achievements": [
    {
      popover: {
        title: "動画実績DB（自動収集）",
        description: "競合制作会社の実績をスクレイピングで自動収集。攻略ターゲットの発見に活用。",
      },
    },
    {
      element: "[data-tour='achievement-scrape']",
      popover: {
        title: "URLから取込",
        description: "競合サイトのURLを入力すると、実績情報を自動で取り込みます。",
        side: "bottom",
      },
    },
    {
      element: "[data-tour='achievement-tracker']",
      popover: {
        title: "実績一覧",
        description: "フィルターで業種・エリア・制作会社を絞り込み。営業先の発見に使えます。",
        side: "top",
      },
    },
  ],
  "/dashboard/proposals": [
    {
      popover: {
        title: "提案書AI",
        description: "企業情報を入力するだけで、AIが提案書を自動生成します。",
      },
    },
    {
      element: "[data-tour='proposal-form']",
      popover: {
        title: "提案書生成フォーム",
        description: "企業名・業種・課題を入力して生成ボタンを押すだけ。AIが最適な提案書を作成します。",
        side: "bottom",
      },
    },
    {
      element: "[data-tour='proposal-list']",
      popover: {
        title: "生成済み提案書一覧",
        description: "過去に生成した提案書を確認・再利用できます。Web公開リンクの共有も可能。",
        side: "top",
      },
    },
  ],

  "/dashboard/leads/btob": [
    {
      popover: {
        title: "BtoBリード獲得AI",
        description: "経産省の企業データベース（gBizINFO）から、広告予算がありそうなBtoB企業を検索・スコアリングします。",
      },
    },
    {
      element: "[data-tour='btob-guide']",
      popover: {
        title: "使い方",
        description: "① 条件を指定して検索 → ② YouTube・Webを自動分析 → ③ AIがスコアリング → ④ リード管理に保存",
        side: "bottom",
      },
    },
    {
      element: "[data-tour='btob-scoring']",
      popover: {
        title: "AIスコアリング基準",
        description: "業種適合度・企業規模・デジタル活用度・YouTube活用余地・成長性・接触しやすさの6軸で合計100点満点でスコアリングします。",
        side: "bottom",
      },
    },
    {
      element: "[data-tour='btob-search']",
      popover: {
        title: "検索パネル",
        description: "業種・エリア・従業員規模などの条件を入力して検索します。結果にAIスコアが付与されます。",
        side: "top",
      },
    },
  ],
  "/dashboard/leads/cinema": [
    {
      popover: {
        title: "イオンシネマ広告 リード獲得AI",
        description: "劇場周辺の対象企業をマップ付きで自動リスト化します。シネアド営業に最適。",
      },
    },
    {
      element: "[data-tour='cinema-guide']",
      popover: {
        title: "使い方",
        description: "① 劇場選択 → ② 半径・業種設定 → ③ マップ＋スコア確認 → ④ 選択して保存",
        side: "bottom",
      },
    },
    {
      element: "[data-tour='cinema-search']",
      popover: {
        title: "検索パネル",
        description: "劇場をエリアから選択し、検索半径（3〜20km）と対象業種を指定します。同心円マップ上に候補企業が表示されます。",
        side: "top",
      },
    },
  ],

  // ================================================================
  // 広告媒体シミュレーター
  // ================================================================
  "/dashboard/strategy-advisor": [
    {
      popover: {
        title: "提案戦略アドバイザー（AI）",
        description: "ターゲット・目的・予算を入力すると、AIが最適な媒体プランを提案します。どの媒体を使うべきか迷ったときに。",
      },
    },
    {
      element: "[data-tour='strategy-form']",
      popover: {
        title: "入力フォーム",
        description: "クライアントの業種・目的・予算・エリアを入力してください。AIが分析を開始します。",
        side: "right",
      },
    },
    {
      element: "[data-tour='strategy-result']",
      popover: {
        title: "AI提案結果",
        description: "最適な媒体ミックスと予算配分が表示されます。そのまま見積もり作成にも使えます。",
        side: "left",
      },
    },
  ],
  "/dashboard/tver-simulator": [
    {
      popover: {
        title: "TVer広告シミュレーター",
        description: "エリア・秒数・予算からTVer広告の配信コストとリーチを概算します。",
      },
    },
    {
      element: "[data-tour='simulator-form']",
      popover: {
        title: "条件入力",
        description: "配信エリア・広告秒数・月額予算を設定してください。リアルタイムで概算が表示されます。",
        side: "right",
      },
    },
    {
      element: "[data-tour='simulator-result']",
      popover: {
        title: "シミュレーション結果",
        description: "想定インプレッション・CPM・リーチ数が表示されます。提案資料にそのまま使えます。",
        side: "left",
      },
    },
  ],
  "/dashboard/taxi-ads-simulator": [
    {
      popover: {
        title: "タクシー広告シミュレーター（TOKYO PRIME）",
        description: "メニュー・週数・エリアを選択して、タクシー広告の掲載費と想定インプレッションを概算します。",
      },
    },
    {
      element: "[data-tour='simulator-form']",
      popover: {
        title: "条件入力",
        description: "広告メニュー・配信週数・エリアを選択してください。",
        side: "right",
      },
    },
  ],
  "/dashboard/skylark-simulator": [
    {
      popover: {
        title: "すかいらーくインストア広告シミュレーター",
        description: "エリア・ブランド・商品タイプから、媒体費・製作費・Ad-Arch提示価格を概算します。",
      },
    },
    {
      element: "[data-tour='simulator-form']",
      popover: {
        title: "条件入力",
        description: "ブランド（ガスト・バーミヤン等）・エリア・商品タイプを選択してください。",
        side: "right",
      },
    },
  ],
  "/dashboard/univ-coop-simulator": [
    {
      popover: {
        title: "大学生協広告シミュレーター",
        description: "食堂・枚数・月数から掲載費・印刷費・発送費・Ad-Arch提示価格を概算します。",
      },
    },
    {
      element: "[data-tour='simulator-form']",
      popover: {
        title: "条件入力",
        description: "対象大学・枚数・掲載期間を入力してください。",
        side: "right",
      },
    },
  ],
  "/dashboard/aeon-cinema-simulator": [
    {
      popover: {
        title: "イオンシネマ広告シミュレーター",
        description: "全98劇場のシネアド（15秒/30秒）・ロビープロモーション料金を概算します。",
      },
    },
    {
      element: "[data-tour='simulator-form']",
      popover: {
        title: "条件入力",
        description: "劇場・広告タイプ・期間を選択してください。",
        side: "right",
      },
    },
  ],
  "/dashboard/golfcart-simulator": [
    {
      popover: {
        title: "ゴルフカート広告シミュレーター（Golfcart Vision）",
        description: "メニュー・週数・ゴルフ場を選択して掲載費と想定インプレッションを概算します。",
      },
    },
    {
      element: "[data-tour='simulator-form']",
      popover: {
        title: "条件入力",
        description: "メニュー・ゴルフ場・配信週数を選択してください。",
        side: "right",
      },
    },
  ],
  "/dashboard/omochannel-simulator": [
    {
      popover: {
        title: "おもチャンネル（アパホテル）シミュレーター",
        description: "ターゲット・エリア・期間を選択して掲載費を概算します。全52,963室対応。",
      },
    },
    {
      element: "[data-tour='simulator-form']",
      popover: {
        title: "条件入力",
        description: "ターゲットエリア・配信期間・メニューを選択してください。",
        side: "right",
      },
    },
  ],

  // ================================================================
  // 制作・プロジェクト
  // ================================================================
  "/dashboard/projects": [
    {
      popover: {
        title: "プロジェクト管理",
        description: "受注後の案件を管理します。Google Driveフォルダが自動生成されます。",
      },
    },
    {
      element: "[data-tour='project-summary']",
      popover: {
        title: "ステータスサマリー",
        description: "進行中・完了・保留など、プロジェクトの状態別件数を確認できます。",
        side: "bottom",
      },
    },
    {
      element: "[data-tour='project-new']",
      popover: {
        title: "新規プロジェクト",
        description: "受注が決まったら、ここからプロジェクトを作成。Driveフォルダも自動で生成されます。",
        side: "bottom",
      },
    },
    {
      element: "[data-tour='project-search']",
      popover: {
        title: "検索・フィルター",
        description: "プロジェクト名・ステータス・期限超過で絞り込みできます。",
        side: "bottom",
      },
    },
    {
      element: "[data-tour='project-table']",
      popover: {
        title: "プロジェクト一覧",
        description: "クリックで詳細ページへ。進捗更新・Driveリンク・担当者変更が可能です。",
        side: "top",
      },
    },
  ],
  "/dashboard/project-matching": [
    {
      popover: {
        title: "案件マッチング",
        description: "グループ企業間で案件を紹介し合えるプラットフォームです。",
      },
    },
    {
      element: "[data-tour='matching-post']",
      popover: {
        title: "案件を投稿",
        description: "自社では対応しきれない案件を投稿すると、他の拠点から応募が来ます。",
        side: "bottom",
      },
    },
    {
      element: "[data-tour='matching-list']",
      popover: {
        title: "案件一覧",
        description: "現在募集中の案件が表示されます。対応可能なものがあれば応募できます。",
        side: "top",
      },
    },
  ],
  "/dashboard/cutsheet": [
    {
      popover: {
        title: "動画カット表ツール",
        description: "動画をアップロードすると、シーン検出・音声書き起こしを行い、Google Sheetsにカット表を自動生成します。",
      },
    },
    {
      element: "[data-tour='cutsheet-upload']",
      popover: {
        title: "動画アップロード",
        description: "MP4/MOV/WebM（500MB以下）をドラッグ&ドロップまたはクリックで選択します。",
        side: "bottom",
      },
    },
  ],
  "/dashboard/group-profiles": [
    {
      popover: {
        title: "メンバー紹介",
        description: "グループ各拠点のメンバープロフィールを閲覧・編集できます。案件マッチングの参考に。",
      },
    },
  ],

  // ================================================================
  // 経理
  // ================================================================
  "/dashboard/billing": [
    {
      popover: {
        title: "請求依頼",
        description: "本部宛の請求依頼を申請・管理します。承認ワークフロー付き。",
      },
    },
    {
      element: "[data-tour='billing-new']",
      popover: {
        title: "請求依頼を申請",
        description: "案件名・金額・請求先を入力して申請します。本部が承認するとステータスが更新されます。",
        side: "bottom",
      },
    },
    {
      element: "[data-tour='billing-list']",
      popover: {
        title: "請求依頼一覧",
        description: "過去の申請履歴とステータスを確認できます。",
        side: "top",
      },
    },
  ],
  "/dashboard/sales-report": [
    {
      popover: {
        title: "月次報告",
        description: "毎月の活動状況と売上を報告します。金額はすべて税抜で入力してください。",
      },
    },
    {
      element: "[data-tour='report-new']",
      popover: {
        title: "月次報告を作成",
        description: "月次の売上実績を入力して報告します。",
        side: "bottom",
      },
    },
    {
      element: "[data-tour='report-list']",
      popover: {
        title: "報告一覧",
        description: "過去の月次報告を確認・編集できます。",
        side: "top",
      },
    },
  ],

  // ================================================================
  // データベース
  // ================================================================
  "/dashboard/business-cards": [
    {
      popover: {
        title: "名刺管理",
        description: "Eightエクスポートデータの一元管理・検索・マッチングができます。",
      },
    },
    {
      element: "[data-tour='card-summary']",
      popover: {
        title: "サマリー",
        description: "全名刺数・コラボ希望・受注済み・競合の件数を一目で確認。",
        side: "bottom",
      },
    },
    {
      element: "[data-tour='card-new']",
      popover: {
        title: "新規登録",
        description: "名刺情報を手動で登録します。CSVインポートにも対応。",
        side: "bottom",
      },
    },
    {
      element: "[data-tour='card-search']",
      popover: {
        title: "検索・フィルター",
        description: "名前・会社名・業種・地域・コラボ/競合フラグで絞り込めます。",
        side: "bottom",
      },
    },
  ],
  "/dashboard/wiki": [
    {
      popover: {
        title: "社内Wiki",
        description: "グループ共有のナレッジベースです。ノウハウ・マニュアル・議事録などを蓄積。",
      },
    },
    {
      element: "[data-tour='wiki-new']",
      popover: {
        title: "新規記事作成",
        description: "マークダウンで記事を作成できます。画像・リンクの埋め込みも可能。",
        side: "bottom",
      },
    },
    {
      element: "[data-tour='wiki-search']",
      popover: {
        title: "記事検索",
        description: "キーワードで記事を素早く検索できます。",
        side: "bottom",
      },
    },
  ],
  "/dashboard/portfolio": [
    {
      popover: {
        title: "実績フォルダ検索",
        description: "Google Driveの実績フォルダを横断検索できます。過去の制作物を素早く探せます。",
      },
    },
    {
      element: "[data-tour='portfolio-search']",
      popover: {
        title: "検索",
        description: "クライアント名・案件名で検索。ファイルタイプやフォルダ階層での絞り込みも可能。",
        side: "bottom",
      },
    },
  ],

  // ================================================================
  // 広告申請
  // ================================================================
  "/dashboard/tver-review": [
    {
      popover: {
        title: "TVer広告主 業態考査",
        description: "TVer広告を出稿する前に、広告主の業態考査を本部に申請します。",
      },
    },
    {
      element: "[data-tour='review-new']",
      popover: {
        title: "新規申請",
        description: "広告主情報を入力して考査を申請します。承認されると配信申請に進めます。",
        side: "bottom",
      },
    },
  ],
  "/dashboard/tver-campaign": [
    {
      popover: {
        title: "TVer配信申請",
        description: "TVer広告の配信を申請します。業態考査が承認された広告主のみ申請可能です。",
      },
    },
    {
      element: "[data-tour='campaign-new']",
      popover: {
        title: "新規配信申請",
        description: "キャンペーン名・予算・配信期間を入力して申請します。",
        side: "bottom",
      },
    },
    {
      element: "[data-tour='campaign-table']",
      popover: {
        title: "申請一覧",
        description: "申請中・承認・配信中などのステータスを確認できます。",
        side: "top",
      },
    },
  ],
  "/dashboard/tver-creative-review": [
    {
      popover: {
        title: "TVer クリエイティブ考査申請",
        description: "TVer広告素材（動画クリエイティブ）の考査を申請します。",
      },
    },
    {
      element: "[data-tour='creative-new']",
      popover: {
        title: "新規申請",
        description: "プロジェクト・広告主・素材本数を入力して考査を申請します。",
        side: "bottom",
      },
    },
  ],
  "/dashboard/media": [
    {
      popover: {
        title: "媒体依頼",
        description: "広告媒体の掲載依頼を申請・管理します。外部発注の進捗も追跡できます。",
      },
    },
    {
      element: "[data-tour='media-new']",
      popover: {
        title: "新規依頼",
        description: "媒体名・掲載期間・予算を入力して依頼を作成します。",
        side: "bottom",
      },
    },
  ],

  // ================================================================
  // SNS簡易制作（Studio）
  // ================================================================
  "/dashboard/studio": [
    {
      popover: {
        title: "Ad Arch Studio",
        description: "SNS運用・制作ツールです。クライアントのSNS投稿プランを自動生成します。",
      },
    },
    {
      element: "[data-tour='studio-summary']",
      popover: {
        title: "運用状況",
        description: "運用中クライアント数・生成済みプラン数を確認できます。",
        side: "bottom",
      },
    },
    {
      element: "[data-tour='studio-generate']",
      popover: {
        title: "SNSプラン生成",
        description: "クライアントの業種・ターゲットを入力すると、月間投稿プランをAIが自動生成します。",
        side: "bottom",
      },
    },
    {
      element: "[data-tour='studio-clients']",
      popover: {
        title: "クライアント管理",
        description: "SNS運用クライアントの情報を登録・管理します。",
        side: "bottom",
      },
    },
  ],
  "/dashboard/studio/generate": [
    {
      popover: {
        title: "SNS運用プラン生成",
        description: "クライアント情報を入力すると、カレンダー・カット表・撮影指示書・キャプション・KPIを一括生成します。",
      },
    },
    {
      element: "[data-tour='generate-input']",
      popover: {
        title: "入力パネル",
        description: "クライアント選択（または手動入力）、対象月、投稿数を設定して生成ボタンを押します。",
        side: "right",
      },
    },
    {
      element: "[data-tour='generate-output']",
      popover: {
        title: "出力エリア",
        description: "生成結果がリアルタイムで表示されます。タブで切替、全文コピーも可能です。",
        side: "left",
      },
    },
  ],
  "/dashboard/studio/clients": [
    {
      popover: {
        title: "Studioクライアント管理",
        description: "SNS運用クライアントの情報を登録・管理します。",
      },
    },
    {
      element: "[data-tour='studio-client-new']",
      popover: {
        title: "新規登録",
        description: "クライアントの業種・エリア・ターゲット・強みを登録します。プラン生成時に自動で反映されます。",
        side: "bottom",
      },
    },
  ],
  "/dashboard/studio/sns-formats": [
    {
      popover: {
        title: "SNSフォーマット自動編集",
        description: "266種類のフォーマットから選んで、Adobe Premiere Proで自動編集。テロップ・BGM・構成がすべて自動で組み上がります。",
      },
    },
    {
      element: "[data-tour='sns-format-guide']",
      popover: {
        title: "使い方ガイド",
        description: "4ステップの流れを確認できます。初めての方はまずここを開いてください。",
        side: "bottom",
      },
    },
    {
      element: "[data-tour='sns-format-orders']",
      popover: {
        title: "最近の依頼",
        description: "過去の依頼と進捗状況（受付→編集中→完了）を確認できます。",
        side: "bottom",
      },
    },
    {
      element: "[data-tour='sns-format-filters']",
      popover: {
        title: "フィルター",
        description: "19業種・6テイスト・4配信先で絞り込み。クライアントの業種を選ぶと最適なフォーマットだけが表示されます。",
        side: "bottom",
      },
    },
    {
      element: "[data-tour='sns-format-grid']",
      popover: {
        title: "フォーマット一覧",
        description: "カードをクリックすると詳細が表示されます。スマホプレビュー・構成タイムライン・テロップスタイルを確認できます。",
        side: "top",
      },
    },
    {
      popover: {
        title: "依頼の流れ",
        description: "① フォーマットを選択 → ② テロップスタイルを選ぶ → ③ 撮影依頼書をクライアントに渡す → ④「この構成で依頼する」で自動編集がスタートします。API費用は一切かかりません。",
      },
    },
  ],

  // ================================================================
  // 管理者
  // ================================================================
  "/dashboard/group-support": [
    {
      popover: {
        title: "グループサポート",
        description: "グループ全社の週次ステータスを管理します。GREEN/YELLOW/REDで状態を可視化。",
      },
    },
    {
      element: "[data-tour='support-summary']",
      popover: {
        title: "ステータスサマリー",
        description: "今週のGREEN・YELLOW・RED・未設定の件数を一目で確認できます。",
        side: "bottom",
      },
    },
    {
      element: "[data-tour='support-table']",
      popover: {
        title: "企業一覧",
        description: "各社のステータス・最終コンタクト日・フェーズを確認。クリックで詳細ページへ。",
        side: "top",
      },
    },
    {
      element: "[data-tour='support-report']",
      popover: {
        title: "レポート生成",
        description: "AIが週次レポートを自動生成します。CEOダイジェストにも連携。",
        side: "bottom",
      },
    },
  ],
  "/dashboard/admin/users": [
    {
      popover: {
        title: "メンバー管理",
        description: "登録済みメンバーのロール（ADMIN/MANAGER/USER）を管理します。",
      },
    },
    {
      element: "[data-tour='user-summary']",
      popover: {
        title: "ロール別サマリー",
        description: "ADMIN（本部）・MANAGER（代表）・USER（一般）の人数を確認。",
        side: "bottom",
      },
    },
    {
      element: "[data-tour='user-register']",
      popover: {
        title: "メンバー招待",
        description: "メールアドレスとロールを指定して新メンバーを招待します。",
        side: "bottom",
      },
    },
    {
      element: "[data-tour='user-table']",
      popover: {
        title: "メンバー一覧",
        description: "ロール変更・所属企業変更・アカウント停止/削除が可能です。",
        side: "top",
      },
    },
  ],
  "/dashboard/login-logs": [
    {
      popover: {
        title: "操作ログ",
        description: "全メンバーのログイン・作成・更新・削除の操作履歴を閲覧できます。",
      },
    },
    {
      element: "[data-tour='log-search']",
      popover: {
        title: "検索・フィルター",
        description: "メールアドレスやカテゴリ（顧客/商談/見積もり等）で絞り込めます。",
        side: "bottom",
      },
    },
    {
      element: "[data-tour='log-table']",
      popover: {
        title: "ログ一覧",
        description: "誰が・いつ・何をしたかを時系列で確認できます。",
        side: "top",
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
