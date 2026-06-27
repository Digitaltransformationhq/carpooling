import { supabase } from "../lib/supabase";

export interface EventItem {
  id: string;
  title: string;
  /** YYYY-MM-DD */
  date: string;
  time: string | null;
  location: string | null;
  description: string | null;
}

/** Local YYYY-MM-DD for today. */
function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function mapRow(e: any): EventItem {
  return {
    id: e.id,
    title: e.title,
    date: e.event_date,
    time: e.event_time ?? null,
    location: e.location ?? null,
    description: e.description ?? null,
  };
}

/** Upcoming events (today onward), soonest first. Empty when Supabase isn't connected. */
export async function fetchEvents(): Promise<EventItem[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("events")
    .select("id, title, event_date, event_time, location, description")
    .gte("event_date", todayLocal())
    .order("event_date", { ascending: true });
  if (error) throw error;
  return ((data as any[]) ?? []).map(mapRow);
}

/** All events (incl. past), soonest first — for the admin panel. */
export async function fetchAllEvents(): Promise<EventItem[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("events")
    .select("id, title, event_date, event_time, location, description")
    .order("event_date", { ascending: true });
  if (error) throw error;
  return ((data as any[]) ?? []).map(mapRow);
}

export interface NewEvent {
  title: string;
  date: string; // YYYY-MM-DD
  time?: string;
  location?: string;
  description?: string;
}

/** Create an event (admin only — enforced by RLS). */
export async function createEvent(input: NewEvent): Promise<void> {
  if (!supabase) throw new Error("Supabase isn't connected.");
  const { error } = await supabase.from("events").insert({
    title: input.title,
    event_date: input.date,
    event_time: input.time || null,
    location: input.location || null,
    description: input.description || null,
  });
  if (error) throw error;
}

/** Delete an event (admin only — enforced by RLS). */
export async function deleteEvent(id: string): Promise<void> {
  if (!supabase) throw new Error("Supabase isn't connected.");
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) throw error;
}
