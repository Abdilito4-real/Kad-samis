-- 019_webauthn_credentials.sql
-- Passkeys (WebAuthn/FIDO2) for "biometric" sign-in — one row per
-- device/authenticator a user has enrolled (Face ID, Touch ID, Windows
-- Hello, Android fingerprint, or a hardware security key).
--
-- The authentication flow's first step (src/app/api/auth/webauthn/
-- authenticate-options) is deliberately usernameless/discoverable — it has
-- to look up a credential by credential_id alone, before anyone is signed
-- in, which is a cross-user lookup the same way push_subscriptions'
-- delivery path is (014_push_subscriptions.sql). That step goes through
-- the service-role client for the same reason: "own row" RLS would
-- otherwise hide every credential from an unauthenticated caller. Everything
-- else (listing/naming/removing your own passkeys in Settings) runs as the
-- signed-in user and is covered by the policies below.

CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- Base64url-encoded credential ID the authenticator returns on every
  -- assertion — how a login attempt is matched back to a row/user before
  -- any session exists.
  credential_id TEXT NOT NULL UNIQUE,
  -- Base64url-encoded COSE public key, used to verify each assertion's
  -- signature. Never a secret — only the private key (which never leaves
  -- the authenticator) can sign with it.
  public_key TEXT NOT NULL,
  -- Signature counter for clone detection, per the WebAuthn spec. Stays 0
  -- for authenticators that don't implement counters (most platform
  -- authenticators using passkey sync) rather than being optional.
  counter BIGINT NOT NULL DEFAULT 0,
  device_type TEXT,
  backed_up BOOLEAN NOT NULL DEFAULT false,
  transports TEXT[],
  -- User-editable label shown in Settings, e.g. "iPhone · Safari" —
  -- defaulted from the User-Agent at registration time.
  device_name TEXT NOT NULL DEFAULT 'Passkey',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_user ON webauthn_credentials(user_id);

ALTER TABLE webauthn_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS webauthn_credentials_select_own ON webauthn_credentials;
CREATE POLICY webauthn_credentials_select_own ON webauthn_credentials
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS webauthn_credentials_insert_own ON webauthn_credentials;
CREATE POLICY webauthn_credentials_insert_own ON webauthn_credentials
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS webauthn_credentials_update_own ON webauthn_credentials;
CREATE POLICY webauthn_credentials_update_own ON webauthn_credentials
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS webauthn_credentials_delete_own ON webauthn_credentials;
CREATE POLICY webauthn_credentials_delete_own ON webauthn_credentials
  FOR DELETE
  USING (user_id = auth.uid());
