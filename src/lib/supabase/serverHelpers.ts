import { createServerSideClient } from './server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT;
const pushConfigured = Boolean(vapidPublicKey && vapidPrivateKey && vapidSubject);

if (pushConfigured) {
  webpush.setVapidDetails(vapidSubject as string, vapidPublicKey as string, vapidPrivateKey as string);
}

const isAuthDebug = process.env.DEBUG_SUPABASE_AUTH === 'true';

function getBearerToken(request?: Request): string | null {
  const authHeader = request?.headers.get('authorization') ?? request?.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.replace(/^Bearer\s+/i, '').trim();
}

async function getAuthenticatedUser(supabase: any, request?: Request) {
  const accessToken = (supabase as any).__bearerToken || getBearerToken(request);

  if (accessToken) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    const supabaseKey = anonKey || serviceKey;
    const decoded = decodeJWT(accessToken);
    const tokenUserId = decoded?.sub ?? decoded?.user_id ?? decoded?.id;

    if (isAuthDebug) {
      console.debug('getAuthenticatedUser: bearer token present', {
        hasRequestAuth: !!getBearerToken(request),
        tokenUserId,
        tokenClientKey: supabaseKey ? (supabaseKey === serviceKey ? 'service' : 'anon') : 'none',
      });
    }

    if (supabaseUrl && supabaseKey) {
      const tokenClient = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      });

      try {
        const { data: tokenUserData, error: tokenUserError } = await tokenClient.auth.getUser(accessToken);
        if (!tokenUserError && tokenUserData?.user) {
          return { user: tokenUserData.user, client: tokenClient };
        }

        const { data: tokenSessionData, error: tokenSessionError } = await tokenClient.auth.getSession();
        if (!tokenSessionError && tokenSessionData?.session?.user) {
          return { user: tokenSessionData.session.user, client: tokenClient };
        }

        if (isAuthDebug) {
          console.warn(
            'Token-based auth lookup failed',
            tokenUserError?.message ?? tokenSessionError?.message ?? tokenUserError ?? tokenSessionError
          );
        }

        if (anonKey && serviceKey && supabaseKey === serviceKey) {
          const retryClient = createClient(supabaseUrl, anonKey, {
            auth: {
              persistSession: false,
              autoRefreshToken: false,
            },
            global: {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            },
          });

          const { data: retryUserData, error: retryUserError } = await retryClient.auth.getUser(accessToken);
          if (!retryUserError && retryUserData?.user) {
            return { user: retryUserData.user, client: retryClient };
          }

          const { data: retrySessionData, error: retrySessionError } = await retryClient.auth.getSession();
          if (!retrySessionError && retrySessionData?.session?.user) {
            return { user: retrySessionData.session.user, client: retryClient };
          }

          if (isAuthDebug) {
            console.warn(
              'Retry token-based auth lookup with anon key failed',
              retryUserError?.message ?? retrySessionError?.message ?? retryUserError ?? retrySessionError
            );
          }
        }
      } catch (error) {
        if (isAuthDebug) {
          console.warn('Token-based auth lookup threw an error', error);
        }
      }
    }
  }

    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError && isAuthDebug) {
      console.warn('Session-based user lookup failed', authError.message);
    }

    if (!authUser) {
      if (isAuthDebug) {
        console.warn('No authenticated user found in session');
      }
      return null;
    }

    return { user: authUser, client: supabase };
  }

export async function getProfile(supabase: any, request?: Request) {
  try {
    const authResult = await getAuthenticatedUser(supabase, request);
    if (!authResult?.user) {
      if (isAuthDebug) {
        console.warn('getProfile: no authenticated user result', {
          requestAuthHeader: !!request?.headers.get('Authorization') || !!request?.headers.get('authorization'),
        });
      }
      return null;
    }

    const { user, client } = authResult;

    const { data: profile, error } = await client
      .from('profiles')
      .select('id, organization_id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Profile fetch error:', error.message);
      return null;
    }

    if (!profile) {
      console.warn('Profile not found for user:', user.id);
      return null;
    }

    return { user, profile };
  } catch (err) {
    console.error('getProfile error:', err);
    return null;
  }
}

export async function createSupabase() {
  return await createServerSideClient();
}

export function normalizeUuid(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function isValidUuid(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
}

/**
 * Write an audit log row using the service role client when available.
 * Captures IP and User-Agent from the incoming Request when provided.
 */
export async function writeAudit(
  supabaseClient: any,
  request: Request | undefined,
  payload: {
    action: string;
    table_name: string;
    record_id?: string | null;
    old_values?: any;
    new_values?: any;
    user_id?: string | null;
  }
) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    // Prefer a service-role client for writing audit rows so RLS won't block inserts
    let writer = supabaseClient;
    if (serviceKey && supabaseUrl) {
      writer = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }

    const ip = request?.headers.get('x-forwarded-for') || request?.headers.get('x-real-ip') || request?.headers.get('cf-connecting-ip') || null;
    const userAgent = request?.headers.get('user-agent') || null;

    let userId = payload.user_id ?? (supabaseClient as any)?.__decodedJWT?.sub ?? (supabaseClient as any)?.__decodedJWT?.user_id ?? null;
    if (typeof userId === 'string') {
      userId = userId.trim() || null;
    }

    let recordId = payload.record_id ?? null;
    if (typeof recordId === 'string') {
      recordId = recordId.trim() || null;
    }

    await writer.from('audit_logs').insert({
      user_id: userId,
      action: payload.action,
      table_name: payload.table_name,
      record_id: recordId,
      old_values: payload.old_values ?? null,
      new_values: payload.new_values ?? null,
      ip_address: ip,
      user_agent: userAgent,
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('writeAudit failed', err);
  }
}

/**
 * A service-role client for reads that legitimately need to see across the
 * `profiles` table — e.g. "who are the super admins" or "who admins this
 * other organization". The `profiles_select_own_or_super` RLS policy only
 * lets a caller see their own row (or every row, if they're already
 * super_admin), so an org admin or operational_manager client querying for
 * *other* users' profiles here would just get an empty result back, not an
 * error — the query looks like it worked and silently finds nobody to
 * notify. Falls back to the caller's own client if no service key is
 * configured (the query will then be subject to the same RLS restriction).
 */
// Return type is pinned explicitly rather than inferred: `fallback` is `any`
// (every caller's own client is typed inconsistently across this codebase),
// and inferring the return type from `createClient(...) | fallback` would
// let that `any` swallow the whole union — every `.from(...)` chained off
// this at every call site would silently lose type checking too.
export function getServiceRoleClient(fallback: any): ReturnType<typeof createClient> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (serviceKey && supabaseUrl) {
    return createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return fallback;
}

/**
 * Insert notification rows using the service role client when available.
 *
 * The `notifications_insert_*` RLS policy only allows super_admin/
 * operational_manager callers to insert — but plenty of legitimate flows
 * need to notify someone *other* than the caller (an org admin submitting a
 * request needs to notify super admins; that insert was previously done with
 * the org admin's own client and silently swallowed by the try/catch around
 * it, so those notifications never landed). Routing through the service
 * role here, the same way `writeAudit` already does for audit rows, fixes
 * that without loosening the RLS policy for direct/unprivileged inserts.
 */
export async function writeNotifications(
  supabaseClient: any,
  rows: Array<{
    user_id: string;
    type: string;
    title: string;
    message: string;
    related_request_id?: string | null;
    read?: boolean;
  }>
) {
  if (!rows.length) return;

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    let writer = supabaseClient;
    if (serviceKey && supabaseUrl) {
      writer = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }

    const { error } = await writer.from('notifications').insert(
      rows.map((row) => ({
        user_id: row.user_id,
        type: row.type,
        title: row.title,
        message: row.message,
        related_request_id: row.related_request_id ?? null,
        read: row.read ?? false,
      }))
    );

    if (error) {
      console.error('writeNotifications insert error', error);
    } else {
      // The in-app row is what matters most and has already saved — push
      // delivery is a best-effort bonus on top, so its failures must never
      // surface as a failure of the notification itself.
      await sendPushToUsers(writer, rows).catch((err) => console.error('sendPushToUsers failed', err));
    }
  } catch (err) {
    console.error('writeNotifications failed', err);
  }
}

/**
 * Delivers a Web Push notification (survives a closed tab/browser) for each
 * subscribed device belonging to the given notification rows' recipients.
 * `serviceClient` must already be the service-role client — same reasoning
 * as everywhere else in this file, the recipients are other users, and RLS
 * would otherwise hide their subscriptions from a non-service caller.
 */
async function sendPushToUsers(
  serviceClient: any,
  rows: Array<{ user_id: string; title: string; message: string; related_request_id?: string | null }>
) {
  if (!pushConfigured || !rows.length) return;

  const userIds = Array.from(new Set(rows.map((row) => row.user_id)));
  const { data: subscriptions, error } = await serviceClient
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .in('user_id', userIds);

  if (error || !subscriptions?.length) return;

  const staleIds: string[] = [];

  await Promise.all(
    rows.flatMap((row) =>
      subscriptions
        .filter((sub: any) => sub.user_id === row.user_id)
        .map(async (sub: any) => {
          const payload = JSON.stringify({
            title: row.title,
            message: row.message,
            url: row.related_request_id ? `/requests/${row.related_request_id}` : '/notifications',
          });

          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload
            );
          } catch (err: any) {
            // 404/410 means the browser/device unsubscribed or the push
            // service dropped it — prune it so we stop retrying forever.
            if (err?.statusCode === 404 || err?.statusCode === 410) {
              staleIds.push(sub.id);
            } else {
              console.warn('web-push send failed', err?.statusCode, err?.body || err?.message);
            }
          }
        })
    )
  );

  if (staleIds.length) {
    await serviceClient.from('push_subscriptions').delete().in('id', staleIds);
  }
}

/**
 * Decode JWT token and extract user ID
 */
function decodeJWT(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    const decoded = Buffer.from(padded, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch (err) {
    console.error('JWT decode error:', err);
    return null;
  }
}

/**
 * Get authenticated Supabase client from request headers (bearer token)
 */
export function getSupabaseFromRequest(request: Request) {
  const authHeader = request.headers.get('Authorization') ?? request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  const supabaseKey = anonKey || serviceKey;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  const decodedJWT = decodeJWT(token);

  const client = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  (client as any).__decodedJWT = decodedJWT;
  (client as any).__bearerToken = token;

  return client;
}
