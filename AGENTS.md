# Codexでの変更履歴

- 2026-09-15 01:45 src/app/dashboard/page.tsx・src/components/live/{live-board.tsx,live-board.module.css,live-view.ts,map-points.ts}・src/components/office/group-chat.tsx・public/live/／代表が承認した暗い背景・オレンジの発光・AI稼働ログのGROUP LIVEを実装。先頭配置・実データの新着だけ演出・チャット常設。既存API/DB/権限判定は変更なし。隔離worktreeでビルド/型/画面確認済／本番反映していない（対象提示後の了承待ち）

- 2026-09-15 02:05 src/app/dashboard/page.tsx・src/components/live/・src/components/office/group-chat.tsx・public/live/／代表の本番反映了承後に722faf7を公開。詳細パネルの閉じるボタンがヘッダーに隠れる問題をCSSで修正（1c3a106）。Railway成功、実データの地図・活動/AIログ・在席表示・詳細開閉・全画面遷移を確認／本番反映した（1c3a106）

- 2026-09-15 02:21 src/app/api/live/feed/route.ts・src/lib/live/summary.ts・src/components/live/{live-board.tsx,live-board.module.css,live-view.ts}・src/app/dashboard/page.tsx／代表選択の「直近3日間を大きく・うち今日を小さく」をJSTの今日/昨日/一昨日で実装。受注は緑、反響/アポ/面談予約は金で状態に基づき表示し地図も連動。既存の集計対象/権限/DB取得条件は維持。隔離worktreeでビルド・型・日付境界・PC/スマホ画面確認済／本番反映していない（今回の対象提示後の了承待ち）
