-- =====================================================================
--  FitMapa — izmena 010: PROČITANA OBAVEŠTENJA + BROJ NA IKONICI
--  Pokreni JEDNOM u Supabase → SQL Editor → New query (posle 009).
--
--  • Pamti kad je trener poslednji put otvorio zvonce, u bazi, pa važi za
--    sve njegove uređaje: otvoriš na računaru → brojka nestaje i na telefonu.
--  • Broj nepročitanih se šalje uz svako push obaveštenje, pa telefon
--    stavi taj broj na ikonicu aplikacije (kao Instagram).
--  • Ne broje se trenerove sopstvene radnje (otkazao si / odbio si).
-- =====================================================================

create table if not exists public.notif_state (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  seen_at    timestamptz not null default now()
);
alter table public.notif_state enable row level security;
-- direktno čitanje/pisanje nije dozvoljeno nikome; ide samo preko funkcija ispod

-- broj nepročitanih za datog korisnika (koristi ga i push funkcija)
create or replace function public.unseen_count(p_user uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  with s as (
    select coalesce((select seen_at from public.notif_state where user_id = p_user), '-infinity'::timestamptz) as seen_at
  )
  select (
    (select count(*) from public.bookings b, s
      where b.trainer_id = p_user
        and b.status not in ('cancelled_by_trainer', 'declined')
        and coalesce(b.cancelled_at, b.created_at) > s.seen_at)
    +
    (select count(*) from public.trainer_clients tc, s
      where tc.trainer_id = p_user
        and tc.status = 'pending'
        and tc.created_at > s.seen_at)
  )::int;
$$;
revoke execute on function public.unseen_count(uuid) from public, anon, authenticated;
grant  execute on function public.unseen_count(uuid) to service_role;

-- za aplikaciju: kad sam poslednji put otvorio zvonce + koliko je nepročitanih
create or replace function public.my_notif_state()
returns table (seen_at timestamptz, unseen int)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select n.seen_at from public.notif_state n where n.user_id = auth.uid()), '-infinity'::timestamptz),
         public.unseen_count(auth.uid());
$$;
revoke execute on function public.my_notif_state() from public, anon;
grant  execute on function public.my_notif_state() to authenticated;

-- za aplikaciju: otvorio sam zvonce → sve je pročitano
create or replace function public.mark_notifications_seen()
returns timestamptz
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.notif_state (user_id, seen_at) values (auth.uid(), now())
  on conflict (user_id) do update set seen_at = excluded.seen_at
  returning seen_at;
$$;
revoke execute on function public.mark_notifications_seen() from public, anon;
grant  execute on function public.mark_notifications_seen() to authenticated;
