/**
 * Fire-and-forget call to record a "New sign-in" notification right after a
 * successful password or passkey sign-in. Deliberately swallows every
 * failure — this is a nice-to-have security log, never allowed to block or
 * fail the sign-in flow that triggered it.
 */
export function logSignIn(accessToken: string, method: "password" | "passkey" = "password") {
  fetch("/api/auth/log-sign-in", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ method }),
    keepalive: true,
  }).catch(() => {});
}
