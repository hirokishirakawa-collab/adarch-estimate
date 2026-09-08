-- ブランドキットMCP連携のOAuth（登録クライアント／認可コード／接続=リフレッシュトークン）
CREATE TABLE "oauth_clients" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "secretHash" TEXT,
    "redirectUris" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "oauth_clients_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "oauth_auth_codes" (
    "code" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "codeChallenge" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "oauth_auth_codes_pkey" PRIMARY KEY ("code")
);
CREATE INDEX "oauth_auth_codes_expiresAt_idx" ON "oauth_auth_codes"("expiresAt");

CREATE TABLE "oauth_grants" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientName" TEXT,
    "userEmail" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "oauth_grants_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "oauth_grants_tokenHash_key" ON "oauth_grants"("tokenHash");
CREATE INDEX "oauth_grants_userEmail_idx" ON "oauth_grants"("userEmail");
