// リッチメニューのサンプル定義（画像は public/line/）
export type SampleArea = { type: "uri" | "message"; value: string; label: string; tags: string[] };
export type RichMenuSample = {
  key: string;
  name: string;
  layout: string;
  file: string;
  chatBarText: string;
  forHq?: boolean; // 本部アカウント向け
  note: string;
  areas: SampleArea[];
};

export const RICH_MENU_SAMPLES: RichMenuSample[] = [
  {
    key: "hq3",
    name: "加盟促進（サンプル）",
    layout: "L3",
    file: "richmenu-sample-hq.jpg",
    chatBarText: "メニュー",
    forHq: true,
    note: "本部の加盟促進用（予約／資料／質問）",
    areas: [
      { type: "uri", value: "https://adarch-estimate-production.up.railway.app/book/group", label: "面談を予約", tags: ["予約クリック"] },
      { type: "uri", value: "https://adarch.co.jp/intro/", label: "資料を見る", tags: ["資料希望"] },
      { type: "message", value: "質問があります", label: "質問する", tags: [] },
    ],
  },
  {
    key: "client3",
    name: "クライアント向け・3分割（ネイビー）",
    layout: "L3",
    file: "richmenu-sample-client.jpg",
    chatBarText: "メニュー",
    note: "ご相談・お見積り／事例を見る／担当に連絡",
    areas: [
      { type: "message", value: "ご相談・お見積りをお願いします", label: "ご相談・お見積り", tags: ["相談"] },
      { type: "uri", value: "https://adarch.co.jp/", label: "事例を見る", tags: [] },
      { type: "message", value: "担当者に連絡したいです", label: "担当に連絡", tags: [] },
    ],
  },
  {
    key: "client3_light",
    name: "クライアント向け・3分割（白×オレンジ）",
    layout: "L3",
    file: "richmenu-sample-client-light.jpg",
    chatBarText: "メニュー",
    note: "同じ構成の明るい配色版",
    areas: [
      { type: "message", value: "ご相談・お見積りをお願いします", label: "ご相談・お見積り", tags: ["相談"] },
      { type: "uri", value: "https://adarch.co.jp/", label: "事例を見る", tags: [] },
      { type: "message", value: "担当者に連絡したいです", label: "担当に連絡", tags: [] },
    ],
  },
  {
    key: "client6",
    name: "クライアント向け・6分割",
    layout: "L6",
    file: "richmenu-sample-client6.jpg",
    chatBarText: "メニュー",
    note: "ご相談／事例／サービス一覧／会社案内／電話／アクセス",
    areas: [
      { type: "message", value: "ご相談・お見積りをお願いします", label: "ご相談・お見積り", tags: ["相談"] },
      { type: "uri", value: "https://adarch.co.jp/", label: "事例を見る", tags: [] },
      { type: "uri", value: "https://adarch.co.jp/", label: "サービス一覧", tags: [] },
      { type: "uri", value: "https://adarch.co.jp/", label: "会社案内", tags: [] },
      { type: "uri", value: "tel:0300000000", label: "電話する", tags: [] },
      { type: "uri", value: "https://maps.google.com/", label: "アクセス", tags: [] },
    ],
  },
  {
    key: "existing4",
    name: "既存クライアント向け・4分割",
    layout: "L4",
    file: "richmenu-sample-existing4.jpg",
    chatBarText: "メニュー",
    note: "進行中の案件／請求・お支払い／追加のご依頼／担当に連絡（タグ「既存客」で自動切替に向く）",
    areas: [
      { type: "message", value: "進行中の案件について確認したいです", label: "進行中の案件", tags: [] },
      { type: "message", value: "請求・お支払いについて確認したいです", label: "請求・お支払い", tags: [] },
      { type: "message", value: "追加でご依頼したいです", label: "追加のご依頼", tags: ["追加依頼"] },
      { type: "message", value: "担当者に連絡したいです", label: "担当に連絡", tags: [] },
    ],
  },
  {
    key: "seminar3",
    name: "セミナー参加者向け・小3分割",
    layout: "S3",
    file: "richmenu-sample-seminar.jpg",
    chatBarText: "メニュー",
    note: "資料を受け取る／次回セミナー／質問する（セミナー枠のタグで自動切替に向く）",
    areas: [
      { type: "message", value: "セミナー資料を受け取りたいです", label: "資料を受け取る", tags: ["資料希望"] },
      { type: "uri", value: "https://adarch.co.jp/", label: "次回セミナー", tags: [] },
      { type: "message", value: "質問があります", label: "質問する", tags: [] },
    ],
  },
];
