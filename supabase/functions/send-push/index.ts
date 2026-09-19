// CACommute — delivers one queued notification (a row of public.notifications)
// as a Web Push message to every device the user has subscribed.
//
// Called by the database (pg_net) from the notifications_dispatch trigger —
// never by browsers — so it is deployed with --no-verify-jwt and instead
// checks a shared secret header.
//
// Secrets (supabase secrets set …):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (https URL or mailto:), PUSH_WEBHOOK_SECRET
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

interface NotificationRow {
  id: string;
  user_id: string;
  title: string;
  body: string;
  url: string;
  tag: string | null;
}

// .trim(): values pasted into the dashboard easily pick up a trailing newline
const WEBHOOK_SECRET = (Deno.env.get("PUSH_WEBHOOK_SECRET") ?? "").trim();
const VAPID_PUBLIC_KEY = (Deno.env.get("VAPID_PUBLIC_KEY") ?? "").trim();
const VAPID_PRIVATE_KEY = (Deno.env.get("VAPID_PRIVATE_KEY") ?? "").trim();

// setVapidDetails throws on empty keys, so only call it once they're set —
// otherwise the function would fail to boot at all.
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    (Deno.env.get("VAPID_SUBJECT") ?? "https://cacommute.com").trim(),
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
  );
}

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!WEBHOOK_SECRET || req.headers.get("x-push-secret")?.trim() !== WEBHOOK_SECRET) {
    return new Response("Forbidden", { status: 403 });
  }
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return Response.json({ error: "VAPID keys are not configured" }, { status: 500 });
  }

  let record: NotificationRow;
  try {
    ({ record } = await req.json());
    if (!record?.user_id) throw new Error("missing record");
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const { data: subs, error } = await db
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", record.user_id);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const payload = JSON.stringify({
    title: record.title,
    body: record.body,
    url: record.url,
    tag: record.tag,
  });

  let delivered = 0;
  const expired: string[] = [];
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: 60 * 60 * 12, urgency: "high" },
        );
        delivered++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // 404/410: the browser dropped this subscription (uninstalled, cleared
        // site data, revoked permission) — stop sending to it.
        if (status === 404 || status === 410) expired.push(s.id);
        else console.error("push failed", status, (err as Error).message);
      }
    }),
  );

  if (expired.length) await db.from("push_subscriptions").delete().in("id", expired);
  await db.from("notifications").update({ sent_at: new Date().toISOString() }).eq("id", record.id);

  return Response.json({ delivered, expired: expired.length });
});
