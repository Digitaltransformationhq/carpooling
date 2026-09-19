-- ============================================================
-- CACommute — browser push notifications for rides.
--
-- How it works:
--   1. The browser subscribes to push (Web Push / VAPID) and stores its
--      subscription here via save_push_subscription().
--   2. Triggers on bookings/rides (and a 5-minute reminder job) write a row
--      into public.notifications for whoever should hear about the change.
--   3. Each new notifications row is POSTed (pg_net) to the `send-push` Edge
--      Function, which delivers it to every device the user subscribed.
--
-- Events:
--   driver: new seat request · request withdrawn · booking cancelled
--   rider : request accepted · declined · removed · ride started ·
--           ride cancelled · ride completed
--   both  : reminder ~30 minutes before departure
--
-- Run ONCE in Supabase → SQL Editor, AFTER the other migrations. Idempotent.
-- Then store the two vault secrets (see the bottom of this file).
-- ============================================================

create extension if not exists pg_net;
create extension if not exists pg_cron with schema pg_catalog;

-- ------------------------------------------------------------
-- 1) Push subscriptions (one row per browser/device)
-- ------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;
drop policy if exists "push subs read own" on public.push_subscriptions;
create policy "push subs read own" on public.push_subscriptions for select
  using (auth.uid() = user_id);
-- no insert/update/delete policies: writes go through the RPCs below, which
-- let a browser move its subscription to whoever is signed in on it now.

create or replace function public.save_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in to enable notifications.'; end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 200))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh,
        auth = excluded.auth, user_agent = excluded.user_agent;
end; $$;

create or replace function public.delete_push_subscription(p_endpoint text)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
end; $$;

revoke execute on function public.save_push_subscription(text, text, text, text) from public, anon;
revoke execute on function public.delete_push_subscription(text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;
grant execute on function public.delete_push_subscription(text) to authenticated;

-- ------------------------------------------------------------
-- 2) Notifications outbox
-- ------------------------------------------------------------
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  body        text not null,
  url         text not null default '/',
  tag         text,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);

alter table public.notifications enable row level security;
drop policy if exists "notifications read own" on public.notifications;
create policy "notifications read own" on public.notifications for select
  using (auth.uid() = user_id);

-- Queue a notification. Internal only — never callable from the browser,
-- otherwise anyone could push messages to anyone.
create or replace function public.notify(
  p_user uuid, p_title text, p_body text, p_url text default '/', p_tag text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_user is null then return; end if;
  insert into public.notifications (user_id, title, body, url, tag)
  values (p_user, p_title, p_body, coalesce(p_url, '/'), p_tag);
end; $$;
revoke execute on function public.notify(uuid, text, text, text, text) from public, anon, authenticated;

-- Hand each new notification to the send-push Edge Function. The URL and the
-- shared secret live in Supabase Vault (see bottom). Any failure here is
-- swallowed: a missed alert must never block a booking or ride change.
create or replace function public.notifications_dispatch()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_url text; v_secret text;
begin
  select decrypted_secret into v_url    from vault.decrypted_secrets where name = 'push_function_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_webhook_secret';
  if v_url is null or v_secret is null then return new; end if;

  perform net.http_post(
    url     := v_url,
    body    := jsonb_build_object('record', to_jsonb(new)),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
    timeout_milliseconds := 10000
  );
  return new;
exception when others then
  return new;
end; $$;
drop trigger if exists trg_notifications_dispatch on public.notifications;
create trigger trg_notifications_dispatch after insert on public.notifications
  for each row execute function public.notifications_dispatch();

-- ------------------------------------------------------------
-- 3) Text helpers
-- ------------------------------------------------------------
-- Departure moment of a ride. departure_time is "7:05 PM" (older rows may be
-- "19:05"); times are local to India. Null if it can't be parsed.
create or replace function public.ride_departs_at(p_date date, p_time text)
returns timestamptz language plpgsql stable set search_path = public as $$
begin
  return (p_date + p_time::time) at time zone 'Asia/Kolkata';
exception when others then
  return null;
end; $$;

-- "Alkapuri → Akota"
create or replace function public.ride_route_label(r public.rides)
returns text language sql stable as $$
  select btrim(split_part(r.from_location, ',', 1)) || ' → ' || btrim(split_part(r.to_location, ',', 1));
$$;

-- "Sat 20 Sep, 7:05 PM"
create or replace function public.ride_when_label(r public.rides)
returns text language plpgsql stable set search_path = public as $$
begin
  return to_char(r.travel_date, 'Dy FMDD Mon') || ', ' || to_char(r.departure_time::time, 'FMHH12:MI AM');
exception when others then
  return to_char(r.travel_date, 'Dy FMDD Mon') || ', ' || r.departure_time;
end; $$;

create or replace function public.seats_label(n int)
returns text language sql immutable as $$
  select n || case when n = 1 then ' seat' else ' seats' end;
$$;

-- ------------------------------------------------------------
-- 4) Booking events
-- ------------------------------------------------------------
create or replace function public.bookings_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  b        public.bookings;
  r        public.rides;
  v_actor  uuid := auth.uid();
  v_url    text;
  v_route  text;
  v_when   text;
  v_name   text;
begin
  if tg_op = 'DELETE' then b := old; else b := new; end if;

  -- The whole ride is being deleted: rides_notify_deleted already tells
  -- everyone once, so don't also send one message per booking.
  if tg_op = 'DELETE'
     and current_setting('cacommute.deleting_ride', true) is not distinct from b.ride_id::text then
    return null;
  end if;

  select * into r from public.rides where id = b.ride_id;
  if not found or r.completed then return null; end if;

  v_url   := '/ride/' || r.id;
  v_route := public.ride_route_label(r);
  v_when  := public.ride_when_label(r);
  v_name  := coalesce(nullif(btrim(b.passenger_name), ''), 'A rider');

  if tg_op = 'INSERT' then
    if b.status = 'pending' then
      perform public.notify(r.user_id, 'New seat request',
        v_name || ' wants ' || public.seats_label(b.seats) || ' · ' || v_route || ', ' || v_when,
        v_url, 'booking-' || b.id);
    end if;

  elsif tg_op = 'UPDATE' then
    if new.status = 'accepted' and old.status <> 'accepted' then
      perform public.notify(b.user_id, 'Seat confirmed 🎉',
        r.driver_name || ' accepted your request for ' || public.seats_label(b.seats)
          || ' · ' || v_route || ', ' || v_when,
        v_url, 'booking-' || b.id);
    elsif new.status = 'accepted' and old.status = 'accepted'
          and new.seats < old.seats and v_actor = b.user_id then
      perform public.notify(r.user_id, 'Seats cancelled',
        v_name || ' cancelled ' || public.seats_label(old.seats - new.seats)
          || ' (' || public.seats_label(new.seats) || ' still booked) · ' || v_route || ', ' || v_when,
        v_url, 'booking-' || b.id);
    end if;

  else -- DELETE
    if v_actor is not null and v_actor = b.user_id then
      -- the rider withdrew / cancelled → tell the driver
      if b.status = 'pending' then
        perform public.notify(r.user_id, 'Request withdrawn',
          v_name || ' withdrew their request · ' || v_route || ', ' || v_when,
          v_url, 'booking-' || b.id);
      else
        perform public.notify(r.user_id, 'Booking cancelled',
          v_name || ' cancelled ' || public.seats_label(b.seats) || ' · ' || v_route || ', ' || v_when,
          v_url, 'booking-' || b.id);
      end if;
    elsif v_actor is not null and v_actor = r.user_id then
      -- the driver declined / removed → tell the rider
      if b.status = 'pending' then
        perform public.notify(b.user_id, 'Request declined',
          r.driver_name || ' couldn''t take your request · ' || v_route || ', ' || v_when,
          '/search', 'booking-' || b.id);
      else
        perform public.notify(b.user_id, 'Removed from ride',
          r.driver_name || ' removed you from the ride · ' || v_route || ', ' || v_when,
          '/search', 'booking-' || b.id);
      end if;
    end if;
  end if;

  return null;
exception when others then
  return null; -- never let a notification break the booking itself
end; $$;

drop trigger if exists trg_bookings_notify on public.bookings;
create trigger trg_bookings_notify after insert or update or delete on public.bookings
  for each row execute function public.bookings_notify();

-- ------------------------------------------------------------
-- 5) Ride events: started / completed / cancelled
-- ------------------------------------------------------------
create or replace function public.rides_notify_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare u record; v_route text;
begin
  v_route := public.ride_route_label(new);

  if new.started and not coalesce(old.started, false) and not new.completed then
    for u in select distinct user_id from public.bookings
              where ride_id = new.id and status = 'accepted'
                and user_id is not null and user_id <> new.user_id loop
      perform public.notify(u.user_id, 'Your ride has started 🚗',
        new.driver_name || ' is on the way · ' || v_route,
        '/ride/' || new.id, 'ride-' || new.id);
    end loop;
  end if;

  if new.completed and not coalesce(old.completed, false) then
    for u in select distinct user_id from public.bookings
              where ride_id = new.id and status = 'accepted'
                and user_id is not null and user_id <> new.user_id loop
      perform public.notify(u.user_id, 'Ride completed ✅',
        'Thanks for carpooling with ' || new.driver_name || ' · ' || v_route || '. +1 reward point',
        '/profile', 'ride-' || new.id);
    end loop;
  end if;

  return null;
exception when others then
  return null;
end; $$;

drop trigger if exists trg_rides_notify_status on public.rides;
create trigger trg_rides_notify_status after update of started, completed on public.rides
  for each row execute function public.rides_notify_status();

-- BEFORE delete, while the ride's bookings still exist. Only when an app user
-- (the driver) removes an unfinished ride — not for SQL-editor cleanups.
create or replace function public.rides_notify_deleted()
returns trigger language plpgsql security definer set search_path = public as $$
declare u record; v_route text; v_when text;
begin
  if auth.uid() is null or old.completed then return old; end if;

  v_route := public.ride_route_label(old);
  v_when  := public.ride_when_label(old);
  for u in select distinct user_id from public.bookings
            where ride_id = old.id and user_id is not null and user_id <> old.user_id loop
    perform public.notify(u.user_id, 'Ride cancelled',
      old.driver_name || ' cancelled the ride · ' || v_route || ', ' || v_when,
      '/search', 'ride-' || old.id);
  end loop;
  return old;
exception when others then
  return old;
end; $$;

drop trigger if exists trg_rides_notify_deleted on public.rides;
create trigger trg_rides_notify_deleted before delete on public.rides
  for each row execute function public.rides_notify_deleted();

-- ------------------------------------------------------------
-- 6) Departure reminders (~30 minutes before), every 5 minutes
-- ------------------------------------------------------------
alter table public.rides add column if not exists reminder_sent boolean not null default false;

create or replace function public.send_ride_reminders()
returns void language plpgsql security definer set search_path = public as $$
declare
  r record; u record;
  v_mins int; v_accepted int; v_pending int; v_route text; v_time text; v_body text;
begin
  for r in
    select rd.*, public.ride_departs_at(rd.travel_date, rd.departure_time) as departs
      from public.rides rd
     where not rd.completed and not rd.started and not rd.reminder_sent
       and rd.travel_date between current_date - 1 and current_date + 1
       and public.ride_departs_at(rd.travel_date, rd.departure_time)
           between now() and now() + interval '30 minutes'
  loop
    update public.rides set reminder_sent = true where id = r.id;

    v_mins  := greatest(1, ceil(extract(epoch from (r.departs - now())) / 60)::int);
    v_route := btrim(split_part(r.from_location, ',', 1)) || ' → ' || btrim(split_part(r.to_location, ',', 1));
    v_time  := to_char(r.departs at time zone 'Asia/Kolkata', 'FMHH12:MI AM');

    select count(distinct user_id) filter (where status = 'accepted'),
           count(*)                filter (where status = 'pending')
      into v_accepted, v_pending
      from public.bookings where ride_id = r.id;

    -- driver: only worth a ping if someone is riding or waiting on them
    if v_accepted > 0 or v_pending > 0 then
      v_body := v_route || ' leaves at ' || v_time || '. ';
      if v_accepted > 0 then
        v_body := v_body || v_accepted || case when v_accepted = 1 then ' rider' else ' riders' end || ' confirmed';
      end if;
      if v_pending > 0 then
        v_body := v_body || case when v_accepted > 0 then ', ' else '' end
               || v_pending || case when v_pending = 1 then ' request' else ' requests' end || ' to review';
      end if;
      perform public.notify(r.user_id, 'Your ride leaves in ' || v_mins || ' min',
        v_body, '/ride/' || r.id, 'ride-' || r.id);
    end if;

    for u in select distinct user_id from public.bookings
              where ride_id = r.id and status = 'accepted'
                and user_id is not null and user_id <> r.user_id loop
      perform public.notify(u.user_id, 'Your ride leaves in ' || v_mins || ' min',
        r.driver_name || ' leaves at ' || v_time || ' · ' || v_route,
        '/ride/' || r.id, 'ride-' || r.id);
    end loop;
  end loop;
end; $$;
revoke execute on function public.send_ride_reminders() from public, anon, authenticated;

select cron.schedule('cacommute-ride-reminders', '*/5 * * * *', 'select public.send_ride_reminders()');

-- ------------------------------------------------------------
-- 7) ONE-TIME: tell the database where the send-push function lives.
--    Run these two lines separately (with your real values) after deploying
--    the function. They are NOT stored in git on purpose.
--
--   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/send-push', 'push_function_url');
--   select vault.create_secret('<same value as the PUSH_WEBHOOK_SECRET function secret>', 'push_webhook_secret');
-- ------------------------------------------------------------
