import { getSupabase } from './supabase';

const TRAINER_FIELDS =
  'id, avatar_url, specialties, price_per_session, years_experience, bio, profiles!trainers_id_fkey(full_name), trainer_gyms(gyms(id, name))';

// Učitava objavljene trenere (svi ili samo iz jedne teretane) + prvi slobodan termin
export async function loadTrainers({ gymId } = {}) {
  const supabase = getSupabase();
  let list;
  if (gymId) {
    const { data } = await supabase.from('trainer_gyms').select(`trainers(${TRAINER_FIELDS})`).eq('gym_id', gymId);
    list = (data || []).map((r) => r.trainers).filter(Boolean);
  } else {
    const { data } = await supabase.from('trainers').select(TRAINER_FIELDS).eq('is_published', true);
    list = data || [];
  }
  if (list.length === 0) return [];

  let q = supabase
    .from('slots')
    .select('trainer_id, starts_at')
    .in('trainer_id', list.map((t) => t.id))
    .eq('status', 'open')
    .gt('starts_at', new Date().toISOString())
    .order('starts_at')
    .limit(500);
  if (gymId) q = q.eq('gym_id', gymId);
  const { data: slots } = await q;

  return list
    .map((t) => ({
      ...t,
      name: t.profiles?.full_name || 'Trener',
      gyms: (t.trainer_gyms || []).map((tg) => tg.gyms).filter(Boolean),
      nextSlot: (slots || []).find((s) => s.trainer_id === t.id)?.starts_at || null,
      freeCount: (slots || []).filter((s) => s.trainer_id === t.id).length,
    }))
    .sort((a, b) => (b.freeCount > 0) - (a.freeCount > 0) || a.name.localeCompare(b.name, 'sr'));
}

export const GYM_FIELDS = 'id, name, address, lat, lng, image_url, opening_hours, membership, price_list_url, created_by';
