import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "./supabase";

/**
 * Browser push notifications for ride events (Web Push + VAPID).
 * The server side lives in supabase/push_notifications.sql and the
 * `send-push` Edge Function; the service worker half is public/push-sw.js.
 */

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
const DISMISS_KEY = "cacommute:push-nudge-dismissed";
const DISMISS_DAYS = 7;

export type PushState =
  | "loading"
  | "unsupported" // browser can't do push (or push isn't configured)
  | "needs-install" // iPhone/iPad: only works once added to the Home Screen
  | "denied" // user blocked notifications for this site
  | "off"
  | "on";

// ---------- tiny shared store so every toggle/nudge stays in sync ----------
let state: PushState = "loading";
let dismissed = readDismissed();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const setState = (s: PushState) => {
  state = s;
  emit();
};

function readDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return Boolean(at) && Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

// ---------- platform checks ----------
function isIOS(): boolean {
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function canPush(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** The active service worker, or null if none shows up (e.g. `vite dev`, where it's disabled). */
async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
  return Promise.race([navigator.serviceWorker.ready, timeout]);
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function sameKey(sub: PushSubscription, key: Uint8Array): boolean {
  const current = sub.options.applicationServerKey;
  if (!current) return false;
  const a = new Uint8Array(current);
  return a.length === key.length && a.every((v, i) => v === key[i]);
}

async function saveSubscription(sub: PushSubscription) {
  if (!supabase) throw new Error("Supabase isn't connected.");
  const json = sub.toJSON();
  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: sub.endpoint,
    p_p256dh: json.keys?.p256dh,
    p_auth: json.keys?.auth,
    p_user_agent: navigator.userAgent,
  });
  if (error) throw error;
}

// ---------- public API ----------
export async function refreshPushState(): Promise<PushState> {
  let next: PushState;
  if (!VAPID_PUBLIC_KEY || !supabase) next = "unsupported";
  else if (isIOS() && !isStandalone()) next = "needs-install";
  else if (!canPush()) next = "unsupported";
  else if (Notification.permission === "denied") next = "denied";
  else {
    const reg = await getRegistration();
    if (!reg) next = "unsupported";
    else {
      const sub = await reg.pushManager.getSubscription();
      next = sub && Notification.permission === "granted" ? "on" : "off";
    }
  }
  setState(next);
  return next;
}

/** Ask permission (must run from a click) and subscribe this device. */
export async function enablePush(): Promise<PushState> {
  if (!VAPID_PUBLIC_KEY || !canPush()) return refreshPushState();

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    setState(permission === "denied" ? "denied" : "off");
    return state;
  }

  const reg = await getRegistration();
  if (!reg) return refreshPushState();

  const key = keyBytes(VAPID_PUBLIC_KEY);
  let sub = await reg.pushManager.getSubscription();
  if (sub && !sameKey(sub, key)) {
    await sub.unsubscribe(); // made with an old key — can't be reused
    sub = null;
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });

  await saveSubscription(sub);
  setState("on");
  return "on";
}

/** Stop alerts on this device (also used on sign-out so the next person
 *  on this browser doesn't get the previous account's alerts). */
export async function disablePush(): Promise<void> {
  const reg = canPush() ? await getRegistration() : null;
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await supabase?.rpc("delete_push_subscription", { p_endpoint: sub.endpoint });
    await sub.unsubscribe().catch(() => {});
  }
  if (state === "on") setState("off");
}

/** Re-register an existing subscription with the signed-in account (endpoints
 *  can rotate; this keeps the server copy current). */
export async function syncPushSubscription(): Promise<void> {
  if ((await refreshPushState()) !== "on") return;
  const sub = await (await getRegistration())?.pushManager.getSubscription();
  if (sub) await saveSubscription(sub).catch(() => {});
}

export function dismissPushNudge() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* private mode — dismissal just won't persist */
  }
  dismissed = true;
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function usePushNotifications() {
  const current = useSyncExternalStore(subscribe, () => state);
  const nudgeDismissed = useSyncExternalStore(subscribe, () => dismissed);

  useEffect(() => {
    if (state === "loading") refreshPushState().catch(() => setState("unsupported"));
  }, []);

  return { state: current, nudgeDismissed };
}
