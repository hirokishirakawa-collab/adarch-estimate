// ==============================================================
// 媒体データ — golfcart（シミュレーターとブランドキットの共通の正本）
//   ここを直すと、シミュレーターの計算とAI用材料の両方に反映される。
// ==============================================================

export type RegularMenu = "none" | "video15" | "video30" | "still15";

export type FrontNavi   = "none" | "still"   | "video";

export const REGULAR_MENU: { id: RegularMenu; label: string; price: number; impressions: number }[] = [
  { id: "none",    label: "なし",       price: 0,         impressions: 0 },
  { id: "video15", label: "動画15秒",   price: 1_300_000, impressions: 580_000 },
  { id: "video30", label: "動画30秒",   price: 2_000_000, impressions: 580_000 },
  { id: "still15", label: "静止画15秒", price:   500_000, impressions: 580_000 },
];

export interface Course { key: string; name: string; carts: number; holes: number }

export interface PrefGroup { pref: string; courses: Course[] }

export const GOLF_COURSES: PrefGroup[] = [
  { pref: "東京", courses: [
    { key: "t0", name: "立川国際カントリー倶楽部",                carts: 100, holes: 36 },
    { key: "t1", name: "多摩カントリークラブ",                    carts: 60,  holes: 18 },
    { key: "t2", name: "東京相武カントリークラブ（アコーディア）", carts: 60,  holes: 18 },
  ]},
  { pref: "神奈川", courses: [
    { key: "ka0", name: "相模野カントリークラブ",                          carts: 90,  holes: 27 },
    { key: "ka1", name: "葉山国際カンツリー倶楽部",                        carts: 110, holes: 36 },
    { key: "ka2", name: "小田原ゴルフ倶楽部 松田コース（アコーディア）",   carts: 70,  holes: 18 },
    { key: "ka3", name: "大厚木カントリークラブ 桜コース（アコーディア）", carts: 75,  holes: 18 },
    { key: "ka4", name: "大厚木カントリークラブ 本コース（アコーディア）", carts: 98,  holes: 27 },
  ]},
  { pref: "埼玉", courses: [
    { key: "sa0", name: "大麻生ゴルフ場",                          carts: 65, holes: 18 },
    { key: "sa1", name: "岡部チサンCC岡部コース（PGM）",           carts: 58, holes: 18 },
    { key: "sa2", name: "上里ゴルフ場",                            carts: 60, holes: 18 },
    { key: "sa3", name: "富貴ゴルフ倶楽部（PGM）",                carts: 60, holes: 18 },
    { key: "sa4", name: "吉見ゴルフ場",                            carts: 90, holes: 27 },
    { key: "sa5", name: "川越カントリークラブ",                    carts: 85, holes: 27 },
    { key: "sa6", name: "秩父国際カントリークラブ（アコーディア）", carts: 95, holes: 18 },
  ]},
  { pref: "山梨", courses: [
    { key: "ya0", name: "大月カントリークラブ", carts: 55, holes: 18 },
    { key: "ya1", name: "西東京ゴルフ倶楽部",  carts: 56, holes: 18 },
  ]},
  { pref: "群馬", courses: [
    { key: "gu0", name: "赤城カントリー倶楽部",                     carts: 55,  holes: 18 },
    { key: "gu1", name: "赤城国際カントリークラブ",                  carts: 90,  holes: 27 },
    { key: "gu2", name: "伊香保ゴルフ倶楽部",                       carts: 80,  holes: 27 },
    { key: "gu3", name: "梅ノ郷ゴルフ倶楽部",                       carts: 57,  holes: 18 },
    { key: "gu4", name: "小幡郷ゴルフ倶楽部",                       carts: 60,  holes: 18 },
    { key: "gu5", name: "関越ハイランドゴルフクラブ（アコーディア）", carts: 101, holes: 27 },
    { key: "gu6", name: "藤岡ゴルフクラブ（アコーディア）",          carts: 125, holes: 36 },
    { key: "gu7", name: "新玉村ゴルフ場",                            carts: 70,  holes: 18 },
  ]},
  { pref: "千葉", courses: [
    { key: "ch0",  name: "ABCいずみゴルフコース",                       carts: 50,  holes: 18 },
    { key: "ch1",  name: "CPGカントリークラブ",                         carts: 60,  holes: 18 },
    { key: "ch2",  name: "市原京急カントリークラブ",                    carts: 55,  holes: 18 },
    { key: "ch3",  name: "大多喜城ゴルフ倶楽部",                       carts: 82,  holes: 27 },
    { key: "ch4",  name: "大原・御宿ゴルフコース",                     carts: 56,  holes: 18 },
    { key: "ch5",  name: "勝浦ゴルフ倶楽部",                           carts: 85,  holes: 27 },
    { key: "ch6",  name: "上総富士ゴルフクラブ",                       carts: 85,  holes: 27 },
    { key: "ch7",  name: "鎌ヶ谷カントリークラブ",                     carts: 75,  holes: 27 },
    { key: "ch8",  name: "木更津ゴルフクラブ",                         carts: 50,  holes: 18 },
    { key: "ch9",  name: "コスモクラシッククラブ",                     carts: 60,  holes: 18 },
    { key: "ch10", name: "ゴルフ5カントリーオークビレッヂ",            carts: 48,  holes: 18 },
    { key: "ch11", name: "ゴルフ倶楽部成田ハイツリー",                carts: 50,  holes: 18 },
    { key: "ch12", name: "山武グリーンカントリー倶楽部",              carts: 50,  holes: 18 },
    { key: "ch13", name: "東庄ゴルフ倶楽部",                          carts: 58,  holes: 18 },
    { key: "ch14", name: "成田ビルズカントリークラブ",                carts: 48,  holes: 18 },
    { key: "ch15", name: "南総カントリークラブ",                       carts: 101, holes: 36 },
    { key: "ch16", name: "船橋カントリークラブ",                       carts: 55,  holes: 18 },
    { key: "ch17", name: "ベルセルバ カントリークラブ 市原コース",    carts: 80,  holes: 27 },
    { key: "ch18", name: "丸の内倶楽部（PGM）",                        carts: 65,  holes: 18 },
    { key: "ch19", name: "四街道ゴルフ倶楽部（アコーディア）",        carts: 62,  holes: 18 },
    { key: "ch20", name: "千葉桜の里ゴルフクラブ（アコーディア）",    carts: 68,  holes: 18 },
    { key: "ch21", name: "東京湾カントリークラブ（アコーディア）",    carts: 105, holes: 27 },
    { key: "ch22", name: "成田東カントリークラブ（アコーディア）",    carts: 63,  holes: 18 },
    { key: "ch23", name: "鹿野山ゴルフ倶楽部",                        carts: 75,  holes: 27 },
    { key: "ch24", name: "カメリアヒルズカントリークラブ",            carts: 45,  holes: 18 },
    { key: "ch25", name: "ニュー南総ゴルフ倶楽部（アコーディア）",   carts: 60,  holes: 18 },
    { key: "ch26", name: "アクアラインゴルフクラブ（アコーディア）",  carts: 81,  holes: 18 },
  ]},
  { pref: "栃木", courses: [
    { key: "to0",  name: "G7カントリー倶楽部",                            carts: 60,  holes: 18 },
    { key: "to1",  name: "イーストウッドカントリークラブ",                carts: 42,  holes: 18 },
    { key: "to2",  name: "烏山城カントリークラブ",                        carts: 80,  holes: 27 },
    { key: "to3",  name: "鬼怒川カントリークラブ",                        carts: 52,  holes: 18 },
    { key: "to4",  name: "佐野ゴルフクラブ",                              carts: 130, holes: 36 },
    { key: "to5",  name: "塩原カントリークラブ",                          carts: 75,  holes: 27 },
    { key: "to6",  name: "東雲ゴルフクラブ",                              carts: 49,  holes: 18 },
    { key: "to7",  name: "新宇都宮カントリークラブ",                      carts: 80,  holes: 27 },
    { key: "to8",  name: "セブンハンドレッドクラブ",                      carts: 56,  holes: 18 },
    { key: "to9",  name: "千成ゴルフクラブ（PGM）",                       carts: 63,  holes: 18 },
    { key: "to10", name: "鷹ゴルフ倶楽部",                                carts: 50,  holes: 18 },
    { key: "to11", name: "東松苑ゴルフ倶楽部",                            carts: 48,  holes: 18 },
    { key: "to12", name: "栃木カントリークラブ",                          carts: 80,  holes: 27 },
    { key: "to13", name: "馬頭ゴルフ倶楽部",                              carts: 47,  holes: 18 },
    { key: "to14", name: "ビートダイゴルフクラブ VIPコース（PGM）",      carts: 64,  holes: 18 },
    { key: "to15", name: "ビートダイゴルフクラブ ロイヤルコース（PGM）", carts: 63,  holes: 18 },
    { key: "to16", name: "ひとどのやカントリー倶楽部（アコーディア）",   carts: 67,  holes: 18 },
    { key: "to17", name: "鳳月カントリー倶楽部",                          carts: 81,  holes: 27 },
    { key: "to18", name: "ベルセルバカントリークラブ さくらコース",      carts: 49,  holes: 18 },
    { key: "to19", name: "ロイヤルメドウゴルフ倶楽部",                   carts: 53,  holes: 18 },
    { key: "to20", name: "矢板カントリークラブ",                          carts: 80,  holes: 27 },
    { key: "to21", name: "関東国際カントリークラブ（アコーディア）",     carts: 95,  holes: 27 },
  ]},
  { pref: "茨城", courses: [
    { key: "ib0",  name: "阿見ゴルフクラブ（PGM）",                      carts: 60,  holes: 18 },
    { key: "ib1",  name: "浅見ゴルフ倶楽部",                             carts: 92,  holes: 27 },
    { key: "ib2",  name: "茨城パシフィックカントリークラブ",             carts: 40,  holes: 18 },
    { key: "ib3",  name: "茨城ロイヤルカントリークラブ",                 carts: 60,  holes: 18 },
    { key: "ib4",  name: "江戸崎カントリー倶楽部",                       carts: 75,  holes: 18 },
    { key: "ib5",  name: "オールドオーチャードゴルフクラブ（PGM）",     carts: 60,  holes: 18 },
    { key: "ib6",  name: "勝田ゴルフ倶楽部（PGM）",                      carts: 63,  holes: 18 },
    { key: "ib7",  name: "ゴルフ5カントリーかさまフォレスト",           carts: 53,  holes: 18 },
    { key: "ib8",  name: "ゴルフ5カントリーサニーフィールド",           carts: 50,  holes: 18 },
    { key: "ib9",  name: "ゴルフ倶楽部セブンレイクス",                  carts: 56,  holes: 18 },
    { key: "ib10", name: "ザ・オーシャンゴルフクラブ",                  carts: 55,  holes: 18 },
    { key: "ib11", name: "サザンヤードカントリークラブ",                carts: 50,  holes: 18 },
    { key: "ib12", name: "ジェイゴルフ霞ヶ浦",                          carts: 60,  holes: 18 },
    { key: "ib13", name: "スプリングフィルズゴルフクラブ（PGM）",      carts: 62,  holes: 18 },
    { key: "ib14", name: "ロックヒルゴルフクラブ",                      carts: 110, holes: 36 },
    { key: "ib15", name: "ワンウェイゴルフクラブ",                      carts: 52,  holes: 18 },
    { key: "ib16", name: "スターツ笠間ゴルフ倶楽部",                   carts: 40,  holes: 18 },
    { key: "ib17", name: "東筑波カントリークラブ（アコーディア）",     carts: 75,  holes: 27 },
    { key: "ib18", name: "土浦カントリー倶楽部（アコーディア）",       carts: 105, holes: 27 },
    { key: "ib19", name: "桜の宮ゴルフクラブ",                          carts: 63,  holes: 18 },
  ]},
  { pref: "その他", courses: [
    { key: "ot0", name: "五浦荘園カントリー倶楽部（福島）", carts: 50,  holes: 18 },
    { key: "ot1", name: "富士竜坂36ゴルフクラブ（静岡）",  carts: 100, holes: 36 },
  ]},
];
