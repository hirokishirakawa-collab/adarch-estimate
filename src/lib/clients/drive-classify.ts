// ==============================================================
// Google Drive 実績フォルダ（portfolio_items）の案件フォルダ名 → 会社名
//
// フォルダ名は「◯◯様」「〈会社名〉商品名」「会社名_案件名」「動画タイトル」が混在している。
// 会社名らしいものだけ拾い、動画タイトル・素材名は除外する（目視で決めた一覧を含む）。
// 表記ゆれは ALIAS で既存の顧客・アーカイブ名に寄せる。
// ==============================================================

/** 動画タイトル・素材名らしいもの（会社名ではない） */
const TITLE_RE =
  /聞く|に聞|[！!？?#]|ウォーク|自販機|おごり|修正版|Interview|総集編|について|お仕事|^cm$|^\d+FW$|^スマートフォン$|^ポッキー$|^福岡$|^岡山$|^\d+$|^[a-z]{1,3}$|movie|OP|LOGO|\.mp4|\.mov|\.pdf|タペストリー|パンフ|チラシ|ポスター|名刺|ロゴ|字幕|素材|テロップ|BGM|ナレーション|version|ver\.|v\d|final|draft|完成|納品|仮|テスト/i;

/** 目視で「会社名ではない」と判断したもの（動画タイトル・素材・企画名・地名・スポーツ種目） */
const EXCLUDE = new Set([
  "ポッキー", "イベント告知", "イベント報告", "国連NY", "天童先生", "神戸港ハンブルク港湾会議", "難民支援", "シネマバード", "ロンドンハーツ",
  "楽天イーグルス中継", "1inch", "KUROKOHAKU", "ThisIsEng", "ライスシロップ", "中南米事業紹介", "日本酒", "神戸港", "難民向け動画",
  "Bリーグスタジアムのスポンサー広告", "アイスホッケー", "サッカー", "ラクロス", "DontLaughAtMySong", "EscapeThePoliceDogs", "QuizConquest", "★Q",
  "イングリッシュトレーニング", "オムレツづくり", "お茶のトレーニング", "クッションの交換方法", "トラブル報告", "トラブル報告書", "修正TAKE", "完パケ",
  "岩手", "新しいカクテルの試作中", "松林図屏風・洛中洛外図屏風柿の種詰合せ", "N社", "スマ料理人", "姫スマ", "媛スマ", "アイメット", "クルム", "SHIMENAWA", "楽天証券",
]);

/** 同じ会社の別表記 → 登録名（既存の顧客・アーカイブ名に寄せる） */
const ALIAS: Record<string, string> = {
  amazon: "Amazon", AmazonNGO3: "Amazon", "Amazon fresh": "Amazon",
  "NTT DATA": "NTTデータ", Japanet: "ジャパネットたかた", JAPANET: "ジャパネットたかた",
  パーソル: "PERSOL", 本高砂屋: "本髙砂屋", 信玄: "信玄食品", MINDWIND: "マインドウインド",
  国立子ども図書館: "国立国際こども図書館", 国際子ども図書館オーゲモーラ: "国立国際こども図書館",
  井筒屋山口: "山口井筒屋", イノフィス: "Innophys", TV東京海外向け: "テレビ東京", 三越350周年: "三越伊勢丹",
  "3x3": "3×3.PREMIER EXE", 高山村メロディ花火: "群馬県高山村", うたメモリーLong: "うたメモリー", 坂下: "坂下国際税理士事務所",
  "VR-learning 髙田工業株式会社": "髙田工業", BENG: "ビジネスエンジニアリング", beng: "ビジネスエンジニアリング", FLOWIN: "Cuore",
  "Johnson and Johnson 新アンバサダー記者会見": "Johnson & Johnson", "SBC-湘南美容外科 北千住院-": "湘南美容クリニック 北千住院",
  "原田工房株式会社(茨城）": "原田工房株式会社", "PROLOGUE 北千住店": "PROLOGUE", "一社)茨城南青年会議所50周年記念": "茨城南青年会議所",
};

export interface DriveClientGuess {
  /** 会社名（読み取り結果）。空/隠しファイルなら null */
  client: string | null;
  /** 会社名ではないと判断した理由。undefined なら会社名として扱ってよい */
  reason?: string;
}

export function clientFromDriveFolder(rawName: string): DriveClientGuess {
  // Drive（macOS）由来のフォルダ名は濁点・半濁点が分解形（NFD）で入っていることがある＝先に正規化しないと照合が外れる
  const name = rawName.normalize("NFKC");
  let n = name.replace(/\.(mp4|mov|pdf|jpg|png|zip)$/i, "").replace(/\((1080p|4k|720p)\)/gi, "").trim();
  if (!n || n.startsWith(".")) return { client: null, reason: "空/隠しファイル" };
  const br = n.match(/^[〈<【\[（(]([^〉>】\]）)]+)[〉>】\]）)]/);
  if (br) n = br[1];
  n = n.replace(/様$|さま$|御中$/, "").replace(/[_＿].*$/, "").replace(/\s*\d{4}年?.*$/, "").replace(/\(.*?\)|（.*?）/g, "").trim();
  // 「北辰フーズ〉文鳥…」のように閉じ括弧だけ残った商品名は、括弧の前を会社名にする
  n = n.split(/[〉>】\]]/)[0].trim();
  if (!n) return { client: null, reason: "空" };
  if (/^従業員食堂/.test(n)) return { client: n, reason: "会社名ではない（目視）" };
  if (EXCLUDE.has(n)) return { client: n, reason: "会社名ではない（目視）" };
  if (ALIAS[n]) n = ALIAS[n];
  if (TITLE_RE.test(n) || TITLE_RE.test(name)) return { client: n, reason: "動画タイトル・素材名らしい" };
  if (n.length <= 1) return { client: n, reason: "短すぎる" };
  return { client: n };
}

/** portfolio_items の親フォルダ名（例 "002.ブランド広告_コンセプト"）→ 表示用カテゴリ */
export function driveCategoryLabel(parentName: string | null | undefined): string {
  return (parentName ?? "").replace(/^\d{3}\./, "").trim() || "その他";
}
