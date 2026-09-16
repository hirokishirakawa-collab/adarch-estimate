# 全メニューの配置対応表

基準: 本番3de0f22cの既存96遷移先を保持。共通操作・集約画面を追加。URL・権限は維持し、表示名と分類を共通化。

| 既存名称／追加 | 新しい入口 | 表示名 | 最小権限 | URL |
|---|---|---|---|---|
| ダッシュボード | ホーム → グループの動き | ホーム | USER | /dashboard |
| 稼働ステータス申告 | 手続き → 報告・請求 | 稼働ステータス申告 | MANAGER | /dashboard/partner-status |
| リード管理・営業報告 | 顧客・営業 → 相手・商談 | 見込み先 | USER | /dashboard/leads/list |
| LINE公式アカウント | 案件・申請 → 案件・広告の運用 | LINE公式アカウント | MANAGER | /dashboard/line |
| Meta広告（地域限定） | 案件・申請 → 案件・広告の運用 | Meta広告（地域限定） | MANAGER | /dashboard/meta-ads |
| GROUP LIVE（みんなの動き） | ホーム → グループの動き | GROUP LIVE | USER | /dashboard/live |
| 顧客管理（起点） | 顧客・営業 → 相手・商談 | 顧客 | USER | /dashboard/customers |
| 取引先マップ（実績・口コミ・傾向） | 顧客・営業 → 相手・商談 | 取引先マップ | USER | /dashboard/clients |
| ② 商談管理（SFA） | 顧客・営業 → 相手・商談 | 商談 | USER | /dashboard/deals |
| ③ プロジェクト登録 | 案件・申請 → 案件・広告の運用 | 案件の作成 | USER | /dashboard/projects/new |
| 営業フロー | 顧客・営業 → 結果から学ぶ | 営業フロー | USER | /dashboard/sales |
| レギュラー案件 | 案件・申請 → 案件・広告の運用 | レギュラー案件 | MANAGER | /dashboard/regulars |
| 公式見積もり | 顧客・営業 → 相手・商談 | 公式見積もり | USER | /dashboard/estimates |
| リード獲得AI | 顧客・営業 → 次の相手を探す | 新しい相手を探す | USER | /dashboard/leads |
| 補助金ファインダー（広告費の財源） | 顧客・営業 → 次の相手を探す | 補助金ファインダー（広告費の財源） | USER | /dashboard/subsidy-finder |
| 周年ファインダー（記念広告の商機） | 顧客・営業 → 次の相手を探す | 周年ファインダー（記念広告の商機） | USER | /dashboard/anniversary-finder |
| 広告出稿者ファインダー（広告費を払っている店） | 顧客・営業 → 次の相手を探す | 広告出稿者ファインダー（広告費を払っている店） | USER | /dashboard/ad-buyer-finder |
| 入札ファインダー（自治体の案件） | 顧客・営業 → 次の相手を探す | 入札ファインダー（自治体の案件） | USER | /dashboard/tender-finder |
| 広告賞ファインダー（クライアントとの会話のきっかけ） | 顧客・営業 → 次の相手を探す | 広告賞ファインダー（クライアントとの会話のきっかけ） | USER | /dashboard/award-finder |
| TVer広告 案件プール | 顧客・営業 → 次の相手を探す | TVer広告 案件プール | USER | /dashboard/leads/tvcm-pool |
| TVer広告 案件クロール（本部） | 本部 → 本部の管理 | TVer広告 案件クロール（本部） | ADMIN | /dashboard/leads/tvcm |
| TVer広告 案件履歴（本部） | 本部 → 本部の管理 | TVer広告 案件履歴（本部） | ADMIN | /dashboard/leads/tvcm-history |
| 競合実績スクレイピング（自動収集） | 顧客・営業 → 次の相手を探す | 他社の制作実績を探す | USER | /dashboard/video-achievements |
| 加盟リード獲得AI | 顧客・営業 → 結果から学ぶ | 加盟リード獲得AI | USER / franchise-leads | /dashboard/franchise-leads |
| クリエイター発掘AI | 本部 → 本部の管理 | クリエイター発掘AI | ADMIN | /dashboard/creator-leads |
| アウトリーチ | 顧客・営業 → 提案・連絡を準備する | アウトリーチ | MANAGER | /dashboard/outreach-pipeline |
| 送付済み企業（全社） | 顧客・営業 → 結果から学ぶ | 送付済み企業・履歴 | MANAGER | /dashboard/auto-sales/history |
| プロジェクト一覧 | 案件・申請 → 案件・広告の運用 | 案件一覧 | USER | /dashboard/projects |
| メンバー紹介 | 案件・申請 → TVer・協力者 | メンバー紹介 | USER | /dashboard/group-profiles |
| 提案戦略アドバイザー（AI） | 顧客・営業 → 提案・連絡を準備する | 提案戦略アドバイザー（AI） | USER | /dashboard/strategy-advisor |
| TVer広告シミュレーター | 資料・事例 → 商品・媒体 | TVer広告シミュレーター | USER | /dashboard/tver-simulator |
| タクシー広告（TOKYO PRIME） | 資料・事例 → 商品・媒体 | タクシー広告（TOKYO PRIME） | USER | /dashboard/taxi-ads-simulator |
| すかいらーくインストア | 資料・事例 → 商品・媒体 | すかいらーくインストア | USER | /dashboard/skylark-simulator |
| 大学生協広告 | 資料・事例 → 商品・媒体 | 大学生協広告 | USER | /dashboard/univ-coop-simulator |
| イオンシネマ | 資料・事例 → 商品・媒体 | イオンシネマ | USER | /dashboard/aeon-cinema-simulator |
| ゴルフカート（Golfcart Vision） | 資料・事例 → 商品・媒体 | ゴルフカート（Golfcart Vision） | USER | /dashboard/golfcart-simulator |
| おもチャンネル（アパホテル） | 資料・事例 → 商品・媒体 | おもチャンネル（アパホテル） | USER | /dashboard/omochannel-simulator |
| コンプライアンス相談 | 手続き → 本部への相談・共有 | コンプライアンス相談 | MANAGER | /dashboard/violation-report |
| 営業分析レポート | 顧客・営業 → 結果から学ぶ | 営業分析レポート | USER | /dashboard/sales-insights |
| グループの動き | ホーム → グループの動き | グループの動き | USER | /dashboard/group-moves |
| アプローチ事例集 | 資料・事例 → 事例・材料・使い方 | アプローチ事例集 | USER | /dashboard/sales-approaches |
| 送った営業文 | 顧客・営業 → 結果から学ぶ | 送った営業文 | USER | /dashboard/outreach-messages |
| 案件マッチング | 案件・申請 → TVer・協力者 | 案件マッチング | USER | /dashboard/project-matching |
| 営業プレイブック | 資料・事例 → 事例・材料・使い方 | 営業プレイブック | USER | /dashboard/playbook |
| パッケージ | 資料・事例 → 商品・媒体 | パッケージ | USER | /dashboard/packages |
| TVer申込リンク | 顧客・営業 → 提案・連絡を準備する | お客様に渡すTVer相談リンク | USER | /dashboard/tver-order-link |
| TVer配信実績 | 案件・申請 → TVer・協力者 | TVer配信実績 | USER | /dashboard/tver-reports |
| 請求依頼 | 手続き → 報告・請求 | 請求依頼 | USER | /dashboard/billing |
| 支払明細 | 手続き → 報告・請求 | 支払明細 | MANAGER | /dashboard/payments |
| ロイヤリティ | 手続き → 報告・請求 | ロイヤリティ | MANAGER | /dashboard/royalty |
| 経理情報の登録 | 手続き → 報告・請求 | 経理情報の登録 | MANAGER | /dashboard/billing/settings |
| 月次報告 | 手続き → 報告・請求 | 月次報告 | MANAGER | /dashboard/sales-report |
| 名刺管理 | 顧客・営業 → 相手・商談 | 名刺管理 | USER | /dashboard/business-cards |
| 社内Wiki | 資料・事例 → 事例・材料・使い方 | 社内Wiki | USER | /dashboard/wiki |
| 資料ライブラリ（OSの頭脳） | 資料・事例 → 事例・材料・使い方 | 資料ライブラリ | USER | /dashboard/knowledge |
| 実績フォルダ検索 | 資料・事例 → 事例・材料・使い方 | 実績フォルダ検索 | USER | /dashboard/portfolio |
| 実績フォルダ（Drive） | 資料・事例 → 事例・材料・使い方 | 実績フォルダ（Drive） | USER | https://drive.google.com/drive/folders/11CJPv-D_37Vn1zntRzI9Qqc2SV89fKPT?usp=drive_link |
| グループ運用データ（Drive） | 手続き → 本部への相談・共有 | グループ運用データ（Drive） | USER | https://drive.google.com/drive/folders/1p9QtqSbPrBAkof5-10jeusyG6T2y7cB8?usp=drive_link |
| TVer業態考査申請 | 案件・申請 → TVer・協力者 | TVer業態考査申請 | USER | /dashboard/tver-review |
| TVer配信申請 | 案件・申請 → TVer・協力者 | TVer配信申請 | USER | /dashboard/tver-campaign |
| TVer クリエイティブ考査申請 | 案件・申請 → TVer・協力者 | TVer クリエイティブ考査申請 | USER | /dashboard/tver-creative-review |
| 媒体依頼 | 案件・申請 → 案件・広告の運用 | 媒体依頼 | USER | /dashboard/media |
| TVerチラシ制作サポート | 案件・申請 → TVer・協力者 | TVerチラシ制作サポート | MANAGER | /dashboard/tver-flyer |
| 端末・動作状況 | 案件・申請 → 案件・広告の運用 | 端末・動作状況 | MANAGER | /dashboard/signage |
| プレイリスト（枠） | 案件・申請 → 案件・広告の運用 | プレイリスト（枠） | MANAGER | /dashboard/signage/playlists |
| 素材 | 案件・申請 → 案件・広告の運用 | 素材 | MANAGER | /dashboard/signage/assets |
| AdArch Vault（素材コピー） | 資料・事例 → 事例・材料・使い方 | AdArch Vault（素材コピー） | USER | /dashboard/vault |
| ブランドキット（資料の型・AI用材料） | 資料・事例 → 事例・材料・使い方 | ブランド・制作の材料 | USER | /dashboard/brand-kit |
| 本部打ち合わせ予約 | 手続き → 本部への相談・共有 | 本部打ち合わせ予約 | USER | https://calendar.app.google/pfFBZxmHbNFFp6cs5 |
| ラーニング | 資料・事例 → 事例・材料・使い方 | ラーニング | USER | /dashboard/learning |
| クリエイター検索 | 案件・申請 → TVer・協力者 | クリエイター検索 | USER | /dashboard/creators |
| 代表別 営業ダッシュボード | 本部 → 本部の管理 | 代表別 営業ダッシュボード | ADMIN | /dashboard/admin/sales-overview |
| 連携案件ハイライト | 本部 → 本部の管理 | 連携案件ハイライト | ADMIN | /dashboard/group-profiles/highlights |
| グループサポート | 本部 → 本部の管理 | グループサポート | ADMIN | /dashboard/group-support |
| パートナー稼働管理 | 本部 → 本部の管理 | パートナー稼働管理 | ADMIN | /dashboard/admin/partner-status |
| 面談予約管理 | 本部 → 本部の管理 | 面談予約管理 | ADMIN | /dashboard/admin/bookings |
| コンプライアンス相談管理 | 本部 → 本部の管理 | コンプライアンス相談管理 | ADMIN | /dashboard/admin/violation-reports |
| 支払明細管理 | 本部 → 本部の管理 | 支払明細管理 | ADMIN | /dashboard/admin/payments |
| グループ請求書 | 本部 → 本部の管理 | グループ請求書 | ADMIN | /dashboard/admin/group-invoices |
| ロイヤリティ状況 | 本部 → 本部の管理 | ロイヤリティ状況 | ADMIN | /dashboard/admin/royalty |
| ロイヤリティ入金チェック | 本部 → 本部の管理 | ロイヤリティ入金チェック | ADMIN | /dashboard/admin/royalty/check |
| TVer小口申込 | 本部 → 本部の管理 | TVer小口申込 | ADMIN | /dashboard/admin/tver-orders |
| TVer配信実績（取込・確認） | 本部 → 本部の管理 | TVer配信実績（取込・確認） | ADMIN | /dashboard/admin/tver-reports |
| パートナー経理管理 | 本部 → 本部の管理 | パートナー経理管理 | ADMIN | /dashboard/admin/partner-billing |
| メンバー管理 | 本部 → 本部の管理 | メンバー管理 | ADMIN | /dashboard/admin/users |
| ラーニング管理 | 本部 → 本部の管理 | ラーニング管理 | ADMIN | /dashboard/admin/learning |
| 操作ログ | 本部 → 本部の管理 | 操作ログ | ADMIN | /dashboard/login-logs |
| 操作ログ（詳細） | 本部 → 本部の管理 | 操作ログ（詳細） | ADMIN | /dashboard/admin/audit-logs |
| API利用状況 | 本部 → 本部の管理 | API利用状況 | ADMIN | /dashboard/admin/api-usage |
| AI活用度 | 本部 → 本部の管理 | AI活用度 | ADMIN | /dashboard/admin/ai-usage |
| チャットボット履歴 | 本部 → 本部の管理 | チャットボット履歴 | ADMIN | /dashboard/admin/chatbot-logs |
| クリエイター管理 | 本部 → 本部の管理 | クリエイター管理 | ADMIN | /dashboard/creators/admin |
| 返事待ち（結果入力） | 顧客・営業 → 相手・商談 | 返事待ち・結果の記録 | USER | /dashboard/leads/awaiting |
| 郵送DM（チラシDM） | 顧客・営業 → 提案・連絡を準備する | 郵送DM（チラシDM） | USER | /dashboard/leads/dm |
| セミナー録画ライブラリ（全社共有） | 資料・事例 → 事例・材料・使い方 | セミナー録画 | USER | /dashboard/seminars |
| 資料ライブラリの登録（本部） | 本部 → 本部の管理 | 資料ライブラリの登録（本部） | ADMIN | /dashboard/admin/knowledge |
| 追加 | AI・設定 → AI | AIで進める | USER | /dashboard/ai |
| 追加 | AI・設定 → AI | AI接続 | USER | /dashboard/ai-connect |
| 追加 | AI・設定 → 設定 | 通知・個人設定 | USER | /dashboard/settings |
| 追加 | 顧客・営業 → 結果から学ぶ | 活動の振り返り | USER | /dashboard/activity |
| 追加 | 案件・申請 → TVer・協力者 | TVerの進行状況 | USER | /dashboard/tver |
| 追加 | 資料・事例 → 探す | 資料・事例を横断検索 | USER | /dashboard/library |
| 追加 | 資料・事例 → 手順を確認する | AIとOSの使い方 | USER | /dashboard/guide |
| 追加 | ホーム → 振り返る | 更新履歴 | USER | /dashboard/updates |
| 追加 | ホーム → 仕事を進める | 今日の一手 | USER | /dashboard/next-actions |
| 追加 | 手続き → 確認する | 自社の提出・連絡 | USER | /dashboard/procedures |
| 追加 | 顧客・営業 → 入口 | 顧客・営業 | USER | /dashboard/work/sales |
| 追加 | 案件・申請 → 入口 | 案件・申請 | USER | /dashboard/work/projects |
| 追加 | 資料・事例 → 入口 | 資料・事例 | USER | /dashboard/work/library |
| 追加 | 手続き → 入口 | 手続き | USER | /dashboard/work/procedures |
| 追加 | 本部 → 入口 | 本部の対応待ち | ADMIN | /dashboard/admin/workspace |
