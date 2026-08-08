"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Fingerprint, Trash2, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  listPasskeys,
  registerPasskey,
  removePasskey,
  supportsBiometricSignIn,
  type WebAuthnCredentialSummary,
} from "@/lib/webauthn-client";

/**
 * "Sign in with Face ID / Touch ID / Windows Hello" management — lets the
 * signed-in user register this device's biometric authenticator as a
 * passkey, so future sign-ins on it can skip the password entirely (see
 * the login page's "Sign in with biometrics" button).
 */
export function PasskeysCard() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [credentials, setCredentials] = useState<WebAuthnCredentialSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const getAccessToken = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) throw new Error("Supabase client not initialized");
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("No authenticated session");
    return session.access_token;
  }, []);

  const refresh = useCallback(async () => {
    try {
      const token = await getAccessToken();
      setCredentials(await listPasskeys(token));
    } catch (err: any) {
      toast.error(err?.message || "Unable to load passkeys");
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    supportsBiometricSignIn().then(setSupported);
    refresh();
  }, [refresh]);

  const handleRegister = async () => {
    setRegistering(true);
    try {
      const token = await getAccessToken();
      await registerPasskey(token);
      toast.success("Passkey added", { description: "You can now sign in on this device with biometrics." });
      await refresh();
    } catch (err: any) {
      toast.error(err?.message || "Unable to add passkey");
    } finally {
      setRegistering(false);
    }
  };

  const handleRemove = async (id: string) => {
    setRemovingId(id);
    try {
      const token = await getAccessToken();
      await removePasskey(token, id);
      setCredentials((current) => current.filter((c) => c.id !== id));
      toast.success("Passkey removed");
    } catch (err: any) {
      toast.error(err?.message || "Unable to remove passkey");
    } finally {
      setRemovingId(null);
    }
  };

  // Nothing to offer on a browser/device with no biometric authenticator —
  // hide the whole card rather than showing a button that would just fail.
  if (supported === false) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Fingerprint className="h-4 w-4" /> Biometric sign-in
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Register this device&apos;s Face ID, Touch ID, Windows Hello, or fingerprint as a passkey — sign in on it going forward without typing your password.
        </p>

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full rounded-2xl" />
          </div>
        ) : credentials.length > 0 ? (
          <div className="space-y-2">
            {credentials.map((credential) => (
              <div
                key={credential.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-background/70 p-3.5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{credential.device_name}</p>
                    <p className="text-xs text-muted-foreground">
                      Added {new Date(credential.created_at).toLocaleDateString()}
                      {credential.last_used_at ? ` · Last used ${new Date(credential.last_used_at).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-rose-500"
                  isLoading={removingId === credential.id}
                  onClick={() => handleRemove(credential.id)}
                  aria-label={`Remove ${credential.device_name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-border bg-background/70 p-4 text-sm text-muted-foreground">
            No passkeys yet — add one below to skip the password on this device next time.
          </p>
        )}

        <Button onClick={handleRegister} isLoading={registering} loadingText="Setting up…" className="gap-2">
          <Fingerprint className="h-4 w-4" />
          Add this device
        </Button>
      </CardContent>
    </Card>
  );
}
