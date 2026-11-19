-- =====================================================================
--  FitMapa — izmena 005: PRIMARNA TERETANA, ZAHTEVI, AUTOMATSKI RASPORED, PUSH
--  Pokreni JEDNOM u Supabase → SQL Editor → New query (posle 004).
--
--  • Trener označi jednu teretanu kao primarnu (zvezdica u Profilu).
--  • Zakazivanje u teretani u kojoj je termin = potvrđeno odmah.
--    Zakazivanje u nekoj drugoj teretani tog trenera = ZAHTEV koji trener
--    prihvata ili odbija. Ako ne odgovori za 12h (ili do 2h pre treninga),
--    zahtev sam istekne i termin se oslobodi.
--  • U nedelju u 22h, kad počne nova nedelja, svaki objavljeni trener koji
--    nema nijedan termin dobija raspored: svaki dan 8–20h, termini od 75 min,
--    u primarnoj teretani (ili jedinoj, ako radi samo u jednoj).
--  • Push obaveštenja treneru: novi trening, novi zahtev, klijent otkazao.
-- =====================================================================


-- 1. Primarna teretana -------------------------------------------------
alter table public.trainer_gyms add column if not exists is_primary boolean not null default false;
create unique index if not exists trainer_gyms_one_primary
  on public.trainer_gyms (trainer_id) where is_primary;

create or replace function public.set_primary_gym(p_gym_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.trainer_gyms where trainer_id = auth.uid() and gym_id = p_gym_id) then
    raise exception 'Prvo dodaj ovu teretanu u svoje teretane.';
  end if;
  update public.trainer_gyms set is_primary = false where trainer_id = auth.uid() and is_primary;
  update public.trainer_gyms set is_primary = true  where trainer_id = auth.uid() and gym_id = p_gym_id;
end;
$$;
revoke execute on function public.set_primary_gym(uuid) from public, anon;
grant  execute on function public.set_primary_gym(uuid) to authenticated;


-- 2. Rezervacije: teretana, zahtevi, istek ------------------------------
alter table public.bookings add column if not exists gym_id uuid references public.gyms(id) on delete set null;
alter table public.bookings add column if not exists expires_at timestamptz;
update public.bookings b set gym_id = s.gym_id from public.slots s where s.id = b.slot_id and b.gym_id is null;

alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check
  check (status in ('confirmed', 'pending', 'declined', 'expired', 'cancelled_by_client', 'cancelled_by_trainer'));

-- najviše jedna aktivna (potvrđena ili zahtev na čekanju) rezervacija po terminu
drop index if exists public.bookings_one_active_per_slot;
create unique index bookings_one_active_per_slot
  on public.bookings (slot_id) where status in ('confirmed', 'pending');


-- 3. Zakazivanje sa izborom teretane -----------------------------------
drop function if exists public.book_slot(uuid, text);

create or replace function public.book_slot(p_slot_id uuid, p_note text default null, p_gym_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_slot public.slots;
  v_gym uuid;
  v_status text := 'confirmed';
  v_expires timestamptz;
  v_booking_id uuid;
begin
  if v_uid is null then
    raise exception 'Morate biti prijavljeni da biste zakazali termin.';
  end if;

  if (select count(*) from public.bookings b join public.slots s on s.id = b.slot_id
      where b.client_id = v_uid and b.status in ('confirmed', 'pending') and s.starts_at > now()) >= 10 then
    raise exception 'Imate previše zakazanih termina. Otkažite neki pre nego što zakažete novi.';
  end if;

  select * into v_slot from public.slots where id = p_slot_id;
  if not found then
    raise exception 'Ovaj termin više nije slobodan.';
  end if;

  v_gym := coalesce(p_gym_id, v_slot.gym_id);
  if v_gym <> v_slot.gym_id then
    if not exists (select 1 from public.trainer_gyms where trainer_id = v_slot.trainer_id and gym_id = v_gym) then
      raise exception 'Trener ne radi u toj teretani.';
    end if;
    v_status := 'pending';
    v_expires := least(now() + interval '12 hours', v_slot.starts_at - interval '2 hours');
    if v_expires <= now() + interval '15 minutes' then
      raise exception 'Trening u drugoj teretani može da se zatraži najkasnije 2 sata pre početka.';
    end if;
  end if;

  update public.slots
     set status = 'booked'
   where id = p_slot_id
     and status = 'open'
     and starts_at > now()
     and starts_at < (select week_end from public.active_week())
     and trainer_id <> v_uid
  returning * into v_slot;

  if not found then
    raise exception 'Ovaj termin više nije slobodan.';
  end if;

  insert into public.bookings (slot_id, trainer_id, client_id, note, gym_id, status, expires_at)
  values (v_slot.id, v_slot.trainer_id, v_uid, nullif(trim(p_note), ''), v_gym, v_status, v_expires)
  returning id into v_booking_id;

  return jsonb_build_object('id', v_booking_id, 'status', v_status, 'expires_at', v_expires);
end;
$$;
revoke execute on function public.book_slot(uuid, text, uuid) from public, anon;
grant  execute on function public.book_slot(uuid, text, uuid) to authenticated;


-- 4. Otkazivanje: klijent može da povuče i zahtev ----------------------
create or replace function public.cancel_booking(p_booking_id uuid, p_reopen boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_b public.bookings;
  v_starts timestamptz;
begin
  select * into v_b from public.bookings where id = p_booking_id for update;

  if not found or v_b.status not in ('confirmed', 'pending')
     or v_uid is null or v_uid not in (v_b.client_id, v_b.trainer_id) then
    raise exception 'Rezervacija nije pronađena ili je već otkazana.';
  end if;

  select starts_at into v_starts from public.slots where id = v_b.slot_id;
  if v_starts <= now() then
    raise exception 'Termin je već počeo ili prošao, ne može se otkazati.';
  end if;

  if v_uid = v_b.client_id then
    update public.bookings set status = 'cancelled_by_client', cancelled_at = now() where id = v_b.id;
    update public.slots set status = 'open' where id = v_b.slot_id and status = 'booked';
  else
    update public.bookings
       set status = case when v_b.status = 'pending' then 'declined' else 'cancelled_by_trainer' end,
           cancelled_at = now()
     where id = v_b.id;
    update public.slots
       set status = case when p_reopen then 'open' else 'blocked' end
     where id = v_b.slot_id and status = 'booked';
  end if;
end;
$$;


-- 5. Trener prihvata ili odbija zahtev ---------------------------------
create or replace function public.respond_booking(p_booking_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_b public.bookings;
begin
  select * into v_b from public.bookings where id = p_booking_id for update;
  if not found or v_b.trainer_id <> auth.uid() or v_b.status <> 'pending' then
    raise exception 'Zahtev nije pronađen ili je već rešen.';
  end if;
  if v_b.expires_at <= now() then
    raise exception 'Zahtev je istekao.';
  end if;

  if p_accept then
    update public.bookings set status = 'confirmed', expires_at = null where id = v_b.id;
  else
    update public.bookings set status = 'declined', cancelled_at = now() where id = v_b.id;
    update public.slots set status = 'open' where id = v_b.slot_id and status = 'booked';
  end if;
end;
$$;
revoke execute on function public.respond_booking(uuid, boolean) from public, anon;
grant  execute on function public.respond_booking(uuid, boolean) to authenticated;


-- 6. Istekli zahtevi (pokreće se automatski na 5 minuta) ---------------
create or replace function public.expire_requests()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows int;
begin
  with gone as (
    update public.bookings
       set status = 'expired', cancelled_at = now()
     where status = 'pending' and expires_at <= now()
    returning slot_id
  )
  update public.slots s set status = 'open'
    from gone
   where s.id = gone.slot_id and s.status = 'booked' and s.starts_at > now();
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;
revoke execute on function public.expire_requests() from public, anon, authenticated;


-- 7. Automatski raspored na početku nedelje ----------------------------
create table if not exists public.autofill_log (
  trainer_id uuid not null references public.trainers(id) on delete cascade,
  week       date not null,
  created    int  not null default 0,
  primary key (trainer_id, week)
);
alter table public.autofill_log enable row level security;

create or replace function public.auto_fill_week(p_force boolean default false)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_monday date := (select first_day from public.active_week());
  v_start timestamptz;
  v_end timestamptz;
  r record;
  v_min int;
  v_starts timestamptz;
  v_rows int;
  v_count int;
  v_total int := 0;
begin
  -- radi samo na početku nove nedelje (nedelja 22:00–23:59 po beogradskom vremenu)
  if not p_force and (now() at time zone 'Europe/Belgrade')::date <> v_monday - 1 then
    return 0;
  end if;
  select week_start, week_end into v_start, v_end from public.active_week();

  for r in
    select t.id as trainer_id,
           coalesce(
             (select tg.gym_id from public.trainer_gyms tg where tg.trainer_id = t.id and tg.is_primary),
             (select min(tg.gym_id::text)::uuid from public.trainer_gyms tg where tg.trainer_id = t.id
               having count(*) = 1)
           ) as gym_id
      from public.trainers t
     where t.is_published
       and not exists (select 1 from public.autofill_log l where l.trainer_id = t.id and l.week = v_monday)
  loop
    continue when r.gym_id is null;   -- više teretana, a nijedna nije primarna
    v_count := 0;
    if not exists (select 1 from public.slots s
                    where s.trainer_id = r.trainer_id and s.starts_at >= v_start and s.starts_at < v_end) then
      for i in 0..6 loop
        v_min := 8 * 60;
        while v_min + 75 <= 20 * 60 loop
          v_starts := ((v_monday + i)::timestamp + make_interval(mins => v_min)) at time zone 'Europe/Belgrade';
          if v_starts > now() then
            insert into public.slots (trainer_id, gym_id, starts_at, ends_at)
            values (r.trainer_id, r.gym_id, v_starts, v_starts + interval '75 minutes')
            on conflict do nothing;
            get diagnostics v_rows = row_count;
            v_count := v_count + v_rows;
          end if;
          v_min := v_min + 75;
        end loop;
      end loop;
    end if;
    insert into public.autofill_log (trainer_id, week, created) values (r.trainer_id, v_monday, v_count);
    v_total := v_total + v_count;
  end loop;

  return v_total;
end;
$$;
revoke execute on function public.auto_fill_week(boolean) from public, anon, authenticated;


-- 8. Push obaveštenja ---------------------------------------------------
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
create policy push_select_own on public.push_subscriptions for select to authenticated
  using (user_id = auth.uid());
create policy push_delete_own on public.push_subscriptions for delete to authenticated
  using (user_id = auth.uid());

-- čuva pretplatu ovog uređaja (ako je uređaj ranije koristio neko drugi, prepisuje)
create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Morate biti prijavljeni.';
  end if;
  delete from public.push_subscriptions where endpoint = p_endpoint;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth);
end;
$$;
revoke execute on function public.save_push_subscription(text, text, text) from public, anon;
grant  execute on function public.save_push_subscription(text, text, text) to authenticated;

-- dnevnik obaveštenja (svako se šalje najviše jednom)
create table if not exists public.push_events (
  id         bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings(id) on delete cascade,
  kind       text not null,
  created_at timestamptz not null default now(),
  sent_at    timestamptz
);
alter table public.push_events enable row level security;

create extension if not exists pg_net;

create or replace function public.bookings_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kind text;
  v_id bigint;
begin
  if tg_op = 'INSERT' then
    v_kind := case when new.status = 'pending' then 'request' else 'booked' end;
  elsif new.status = 'cancelled_by_client' and old.status in ('confirmed', 'pending') then
    v_kind := 'client_cancelled';
  else
    return new;
  end if;

  if not exists (select 1 from public.push_subscriptions where user_id = new.trainer_id) then
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

drop trigger if exists bookings_push on public.bookings;
create trigger bookings_push
  after insert or update of status on public.bookings
  for each row execute function public.bookings_push();


-- 9. Automatsko pokretanje ---------------------------------------------
do $$
begin
  perform cron.schedule('fitmapa-expire-requests', '*/5 * * * *', 'select public.expire_requests()');
  perform cron.schedule('fitmapa-auto-fill', '10 * * * *', 'select public.auto_fill_week()');
  raise notice 'Automatski poslovi su uključeni.';
exception when others then
  raise notice 'pg_cron nije dostupan (%).', sqlerrm;
end;
$$;
