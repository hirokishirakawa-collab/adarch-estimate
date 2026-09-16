# Codexでの変更履歴

- 2026-09-15 01:45 src/app/dashboard/page.tsx・src/components/live/{live-board.tsx,live-board.module.css,live-view.ts,map-points.ts}・src/components/office/group-chat.tsx・public/live/／代表が承認した暗い背景・オレンジの発光・AI稼働ログのGROUP LIVEを実装。先頭配置・実データの新着だけ演出・チャット常設。既存API/DB/権限判定は変更なし。隔離worktreeでビルド/型/画面確認済／本番反映していない（対象提示後の了承待ち）

- 2026-09-15 02:05 src/app/dashboard/page.tsx・src/components/live/・src/components/office/group-chat.tsx・public/live/／代表の本番反映了承後に722faf7を公開。詳細パネルの閉じるボタンがヘッダーに隠れる問題をCSSで修正（1c3a106）。Railway成功、実データの地図・活動/AIログ・在席表示・詳細開閉・全画面遷移を確認／本番反映した（1c3a106）

- 2026-09-15 02:21 src/app/api/live/feed/route.ts・src/lib/live/summary.ts・src/components/live/{live-board.tsx,live-board.module.css,live-view.ts}・src/app/dashboard/page.tsx／代表選択の「直近3日間を大きく・うち今日を小さく」をJSTの今日/昨日/一昨日で実装。受注は緑、反響/アポ/面談予約は金で状態に基づき表示し地図も連動。既存の集計対象/権限/DB取得条件は維持。隔離worktreeでビルド・型・日付境界・PC/スマホ画面確認済／本番反映していない（今回の対象提示後の了承待ち）

- 2026-09-15 02:31 src/app/api/live/feed/route.ts・src/lib/live/summary.ts・src/components/live/{live-board.tsx,live-board.module.css,live-view.ts}・src/app/dashboard/page.tsx・AGENTS.md／代表が対象7ファイルを本番反映承認。43183eaをmainへpushしRailway成功（02:28 JST）。実データで直近3日間のアプローチ45・受注1、うち今日は各0、受注の緑・地図連動・詳細開閉・全画面を確認。ダッシュボードの$RS描画例外はコンソールに残るため確認記録へ記載（今回の表示/操作は動作、原因未確定）／本番反映した（43183ea）

- 2026-09-15 02:45 src/components/live/live-board.module.css／代表指示のACTIVITY FEED下の黒い余白を解消。PC/タブレットでは地図・在席表示の高さに合わせてスクロール枠を伸縮。1440px/768pxで下端の余白0、390pxで420pxスクロール枠、最後の記録の表示・詳細開閉・全画面・本番ビルド確認済／本番反映していない（CSSと履歴の2ファイルを対象提示）

- 2026-09-15 03:05 src/components/live/live-board.module.css・AGENTS.md／代表のOKを受け8293fb9をmainへpush。Railway成功（03:03:27 JST）。本番PCでリスト高さ420px→608.5px、下の余白188.5px→0を確認。14行の実ログを末尾までスクロールし、詳細の開閉も確認。確認用サーバー停止／本番反映した（8293fb9）

- 2026-09-15 13:51 public/live/japan-map.svg・src/components/live/{map-points.ts,live-board.tsx}／代表指示で沖縄の表示を改善。「沖縄（別枠）」を廃止し左上に島々の拡大図と沖縄の名前を常設。地図と同じ投影で沖縄本島に活動点/在席アイコンを配置。101島ポリゴンと他46県の輪郭を保持。PC/スマホ/全画面・他県選択時の常設表示・型/ESLint/本番ビルド確認済／本番反映していない（対象4ファイルの了承待ち）

- 2026-09-15 14:02 public/live/japan-map.svg・src/components/live/{map-points.ts,live-board.tsx}・AGENTS.md／代表が対象4ファイルの本番反映を明示承認。他の最新更新82532d7へ同一差分を統合し25eec23をmainへpush。統合後ビルド通過、Railway成功（14:00:43 JST）。本番ダッシュボード/全画面で「沖縄」「拡大図」と拡大した地形、沖縄本島の活動点座標、別枠表記なし・横はみ出しなしを確認。沖縄代表の在席アイコンはローカル確認用データで検証済み。本番の在席/活動は作成せず／本番反映した（25eec23）

- 2026-09-16 13:23 共通ナビ・ホーム・顧客導線・AI引き継ぎ・TVer・資料検索・本部画面と関連テスト（一覧: docs/release-files-20260916.txt）／代表の全8項目実装承認と確認画面後の「これでデプロイしましょう」を受けた本番反映。GROUP LIVE・沖縄・集計を保持。別作業の未公開5a862c9cを含めず本番3de0f22cへ統合。10テスト・型・ビルド・PC/スマホ表示確認済／本番反映作業中（完了結果は確認記録へ追記）

- 2026-09-16 13:29 OS全体整理57ファイル（docs/release-files-20260916.txt）／代表が確認画面を了承し本番反映を明示承認。abfbab4dをGitHub mainへpush、Railway SUCCESS（2026-09-16 13:26:35 JST、deployment 51b0664b-0ea7-417d-9777-33b3d2d43699）。本番ホーム・4仕事入口・TVer・資料・本部・AIの表示、実データ検索、AI依頼文、390px表示と沖縄地図を確認。DB変更・業務送信なし。元フォルダの別作業5a862c9cは未公開のまま保持（次回fetch後に本番との分岐を確認、force pushしない）／本番反映した（abfbab4d）

- 2026-09-16 13:33 月次報告と新ナビ/検索の閲覧権限確認／認証・月次報告処理は前本番と差分なし。本人限定の一覧・他人IDの閲覧/更新/削除拒否・USER/未ログイン拒否の隔離テスト7件通過。本部ADMIN制限・月次報告を共通検索へ含めないことを確認／追加の本番変更なし（abfbab4dを検証）

- 2026-09-16 13:46 src/components/workspace/{workspace-hub.tsx,hub-visuals.tsx}・src/app/dashboard/workspace.css・src/app/dashboard/work/[group]/page.tsx／代表の「分類は良いが文字ばかりで業務的」の指摘を受け4分類に専用イラスト・大きな入口・機能アイコン・控えめな動きを追加。既存の分類とサーバーの権限フィルタを維持。PC/390px・検索・USERの月次報告リンク非表示・ADMIN画面維持、型/ESLint/ナビ10テスト確認済／本番反映していない（確認画面でレビュー待ち）

- 2026-09-16 13:46 月次報告の閲覧方針／代表が「本部以外は自分の報告以外見れないようにして」と明示。全員分を見られるのはADMINのみ。代表MANAGERの一覧はcreatedById本人に限定、他人IDの直接閲覧/更新/削除を拒否。USERの既存アクセス不可を維持。現行の本番反映コードで要件を満たし隔離テスト7件再通過、AIの全件照会もADMIN限定を確認／権限コードの追加変更・本番変更なし

- 2026-09-16 13:49 src/components/workspace/{workspace-hub.tsx,hub-visuals.tsx}・src/app/dashboard/workspace.css・src/app/dashboard/work/[group]/page.tsx・src/lib/workspace/update-history.json・AGENTS.md／代表が確認画面後に「本番反映して」と明示承認。4分類のイラスト・主要入口・アイコン・軽い動きと更新案内を反映。認証/月次報告/DB処理は差分なし。型・ESLint・本番ビルド・ナビ10件/月次権限7件・PC/390px確認済／本番反映作業中（結果は追記）
