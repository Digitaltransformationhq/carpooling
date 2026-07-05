-- ============================================================
-- CACommute — store each ride's driving route for corridor matching.
-- When a ride is published, the app computes the shortest driving
-- route (OSRM) and stores it here as a GeoJSON [lng,lat] polyline.
-- Riders are then matched if their pickup + drop fall within 500m
-- of this route (computed client-side). Run ONCE in Supabase
-- SQL Editor. Idempotent.
-- ============================================================

alter table public.rides add column if not exists route_geom jsonb;
