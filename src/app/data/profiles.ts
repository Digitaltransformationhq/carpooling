import { supabase } from "../lib/supabase";

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  membership_id: string | null;
  bio: string | null;
  avatar_url: string | null;
  points: number;
  is_admin: boolean;
  created_at: string;
}

export interface ProfileUpdate {
  full_name?: string;
  phone?: string;
  membership_id?: string;
  bio?: string;
  avatar_url?: string;
}

/** A member as shown in the Peer Connect directory — never includes is_admin. */
export type DirectoryProfile = Omit<Profile, "is_admin">;

// Only the columns the directory actually displays (no is_admin — don't leak
// who the admins are to every signed-in member).
const DIRECTORY_COLUMNS = "id, full_name, email, phone, membership_id, bio, avatar_url, points, created_at";

/**
 * Search the member directory (Peer Connect). Empty query returns recent
 * members; a query matches on name (case-insensitive). Skips `excludeId`
 * (typically the current user) and rows without a name.
 */
export async function searchProfiles(query = "", excludeId?: string): Promise<DirectoryProfile[]> {
  if (!supabase) return [];
  let q = supabase.from("profiles").select(DIRECTORY_COLUMNS).not("full_name", "is", null);
  // Strip characters that are meaningful in PostgREST filter syntax so the
  // search term can't break out of / inject into the .or() expression.
  const term = query.trim().replace(/[,()*%:\\]/g, "").slice(0, 80);
  // match on name OR membership ID
  if (term) q = q.or(`full_name.ilike.%${term}%,membership_id.ilike.%${term}%`);
  const { data, error } = await q.order("full_name", { ascending: true }).limit(100);
  if (error) throw error;
  let list = (data as unknown as DirectoryProfile[]) ?? [];
  if (excludeId) list = list.filter((p) => p.id !== excludeId);
  return list;
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as Profile) ?? null;
}

/** Upsert so it works whether or not a profile row already exists. */
export async function updateProfile(userId: string, fields: ProfileUpdate): Promise<Profile> {
  if (!supabase) throw new Error("Supabase isn't connected.");
  const { data, error } = await supabase
    .from("profiles")
    .upsert({ id: userId, ...fields })
    .select()
    .single();
  if (error) throw error;

  // Keep the denormalized driver info on this user's rides in sync,
  // so name/photo changes show everywhere they appear as the driver.
  const ridePatch: Record<string, string> = {};
  if (fields.full_name !== undefined) ridePatch.driver_name = fields.full_name;
  if (fields.avatar_url !== undefined) ridePatch.driver_avatar = fields.avatar_url;
  if (Object.keys(ridePatch).length > 0) {
    await supabase.from("rides").update(ridePatch).eq("user_id", userId);
  }

  return data as Profile;
}

/** Uploads a new avatar to Storage, saves the URL on the profile, returns the URL. */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  if (!supabase) throw new Error("Supabase isn't connected.");
  const path = `${userId}/avatar`;
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  // cache-bust so the new image shows immediately
  const url = `${data.publicUrl}?t=${Date.now()}`;
  await updateProfile(userId, { avatar_url: url });
  return url;
}
