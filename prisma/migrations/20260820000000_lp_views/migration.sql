-- 加盟開発LP（/intro/）の流入とコンバージョンを自社DBに記録する。
-- GA4やMeta広告のAPI認証を経ずに、毎朝のブリーフィングで数値を出せるようにするのが目的。
CREATE TABLE IF NOT EXISTS lp_views (
  id           TEXT PRIMARY KEY,
  path         TEXT NOT NULL,
  event        TEXT NOT NULL,
  "utmSource"   TEXT,
  "utmMedium"   TEXT,
  "utmCampaign" TEXT,
  "utmContent"  TEXT,
  referrer     TEXT,
  "visitorId"   TEXT,
  "isMobile"    BOOLEAN,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS lp_views_created_idx ON lp_views("createdAt");
CREATE INDEX IF NOT EXISTS lp_views_event_idx   ON lp_views(event);
CREATE INDEX IF NOT EXISTS lp_views_visitor_idx ON lp_views("visitorId");
