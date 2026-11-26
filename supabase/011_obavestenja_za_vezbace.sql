-- =====================================================================
--  FitMapa — izmena 011: OBAVEŠTENJA ZA VEŽBAČE
--  Pokreni JEDNOM u Supabase → SQL Editor → New query (posle 010).
--
--  • Vežbač dobija obaveštenje (zvonce + push na telefon) kad trener
--    otkaže njegov trening. To je jedino obaveštenje za vežbače.
--  • Broj nepročitanih (brojka na zvoncetu i na ikonici) sada važi i za vežbače.
-- =====================================================================

-- broj nepročitanih: trener (rezervacije, zahtevi) + vežbač (otkazao trener)
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
    -- trener: nove rezervacije, zahtevi, otkazivanja klijenata
    (select count(*) from public.bookings b, s
      where b.trainer_id = p_user
        and b.status not in ('cancelled_by_trainer', 'declined')
        and coalesce(b.cancelled_at, b.created_at) > s.seen_at)
    +
    (select count(*) from public.trainer_clients tc, s
      where tc.trainer_id = p_user
        and tc.status = 'pending'
        and tc.created_at > s.seen_at)
    +
    -- vežbač: trener je otkazao trening
    (select count(*) from public.bookings b, s
      where b.client_id = p_user
        and b.status = 'cancelled_by_trainer'
        and coalesce(b.cancelled_at, b.created_at) > s.seen_at)
  )::int;
$$;
revoke execute on function public.unseen_count(uuid) from public, anon, authenticated;
grant  execute on function public.unseen_count(uuid) to service_role;

-- push: treneru za nove/otkazane rezervacije, vežbaču kad trener otkaže
create or replace function public.bookings_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text;
  v_to   uuid;
  v_id   bigint;
begin
  if tg_op = 'INSERT' then
    v_kind := case when new.status = 'pending' then 'request' else 'booked' end;
    v_to   := new.trainer_id;
  elsif new.status = 'cancelled_by_client' and old.status in ('confirmed', 'pending') then
    v_kind := 'client_cancelled';
    v_to   := new.trainer_id;
  elsif new.status = 'cancelled_by_trainer' and old.status in ('confirmed', 'pending') then
    v_kind := 'trainer_cancelled';
    v_to   := new.client_id;
  else
    return new;
  end if;

  if not exists (select 1 from public.push_subscriptions where user_id = v_to) then
    return new;
  end if;

  insert into public.push_events (booking_id, kind) values (new.id, v_kind) returning id into v_id;
  perform net.http_post(
    url  := 'https://hrafyliyiwzfybutucwx.supabase.co/functions/v1/push-notify',
    body := jsonb_build_object('event_id', v_id)
  );
  return new;
exception when others then
  return new;   -- obaveštenje nikad ne sme da pokvari zakazivanje
end;
$$;
