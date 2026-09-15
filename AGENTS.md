# Codexでの変更履歴

- 2026-09-15 01:45 src/app/dashboard/page.tsx・src/components/live/{live-board.tsx,live-board.module.css,live-view.ts,map-points.ts}・src/components/office/group-chat.tsx・public/live/／代表が承認した暗い背景・オレンジの発光・AI稼働ログのGROUP LIVEを実装。先頭配置・実データの新着だけ演出・チャット常設。既存API/DB/権限判定は変更なし。隔離worktreeでビルド/型/画面確認済／本番反映していない（対象提示後の了承待ち）

- 2026-09-15 02:05 src/app/dashboard/page.tsx・src/components/live/・src/components/office/group-chat.tsx・public/live/／代表の本番反映了承後に722faf7を公開。詳細パネルの閉じるボタンがヘッダーに隠れる問題をCSSで修正（1c3a106）。Railway成功、実データの地図・活動/AIログ・在席表示・詳細開閉・全画面遷移を確認／本番反映した（1c3a106）

- 2026-09-15 02:21 src/app/api/live/feed/route.ts・src/lib/live/summary.ts・src/components/live/{live-board.tsx,live-board.module.css,live-view.ts}・src/app/dashboard/page.tsx／代表選択の「直近3日間を大きく・うち今日を小さく」をJSTの今日/昨日/一昨日で実装。受注は緑、反響/アポ/面談予約は金で状態に基づき表示し地図も連動。既存の集計対象/権限/DB取得条件は維持。隔離worktreeでビルド・型・日付境界・PC/スマホ画面確認済／本番反映していない（今回の対象提示後の了承待ち）

- 2026-09-15 02:31 src/app/api/live/feed/route.ts・src/lib/live/summary.ts・src/components/live/{live-board.tsx,live-board.module.css,live-view.ts}・src/app/dashboard/page.tsx・AGENTS.md／代表が対象7ファイルを本番反映承認。43183eaをmainへpushしRailway成功（02:28 JST）。実データで直近3日間のアプローチ45・受注1、うち今日は各0、受注の緑・地図連動・詳細開閉・全画面を確認。ダッシュボードの$RS描画例外はコンソールに残るため確認記録へ記載（今回の表示/操作は動作、原因未確定）／本番反映した（43183ea）

- 2026-09-15 02:45 src/components/live/live-board.module.css／代表指示のACTIVITY FEED下の黒い余白を解消。PC/タブレットでは地図・在席表示の高さに合わせてスクロール枠を伸縮。1440px/768pxで下端の余白0、390pxで420pxスクロール枠、最後の記録の表示・詳細開閉・全画面・本番ビルド確認済／本番反映していない（CSSと履歴の2ファイルを対象提示）

- 2026-09-15 03:05 src/components/live/live-board.module.css・AGENTS.md／代表のOKを受け8293fb9をmainへpush。Railway成功（03:03:27 JST）。本番PCでリスト高さ420px→608.5px、下の余白188.5px→0を確認。14行の実ログを末尾までスクロールし、詳細の開閉も確認。確認用サーバー停止／本番反映した（8293fb9）

- 2026-09-15 13:51 public/live/japan-map.svg・src/components/live/{map-points.ts,live-board.tsx}／代表指示で沖縄の表示を改善。「沖縄（別枠）」を廃止し左上に島々の拡大図と沖縄の名前を常設。地図と同じ投影で沖縄本島に活動点/在席アイコンを配置。101島ポリゴンと他46県の輪郭を保持。PC/スマホ/全画面・他県選択時の常設表示・型/ESLint/本番ビルド確認済／本番反映していない（対象4ファイルの了承待ち）
