-- =====================================================================
--  FitMapa — izmena 002: NEDELJNI RASPORED
--  Pokreni JEDNOM u Supabase → SQL Editor (posle schema.sql).
--
--  Kako radi:
--  • Važi samo tekuća nedelja: ponedeljak–nedelja.
--  • U nedelju u 22:00 (po beogradskom vremenu) počinje nova nedelja.
--    Stari termini se brišu, a trener mora da napravi novi raspored.
--    Dok ga ne napravi, nema slobodnih termina.
--  • Zakazani (odrađeni) termini čuvaju se još 14 dana da bi klijent mogao
--    da ostavi ocenu. Same ocene ostaju zauvek.
-- =====================================================================


-- 1. Koja nedelja je trenutno aktivna (od nedelje u 22h već je sledeća)
create or replace function public.active_week()
returns table (week_start timestamptz, week_end timestamptz, first_day date)
language sql
stable
set search_path = ''
as $$
  with d as (
    select date_trunc('week', (now() at time zone 'Europe/Belgrade') + interval '2 hours')::date as monday
  )
  select
    (monday::timestamp at time zone 'Europe/Belgrade'),
    ((monday + 7)::timestamp at time zone 'Europe/Belgrade'),
    monday
  from d;
$$;
grant execute on function public.active_week() to anon, authenticated;


-- 2. Ocene ostaju i kad se stari termini obrišu
alter table public.reviews alter column booking_id drop not null;
alter table public.reviews drop constraint if exists reviews_booking_id_fkey;
alter table public.reviews
  add constraint reviews_booking_id_fkey
  foreign key (booking_id) references public.bookings(id) on delete set null;


-- 3. Pravljenje termina — samo za dane tekuće nedelje
drop function if exists public.create_slots(uuid, date, date, int[], time, time, int);

create or replace function public.create_slots(
  p_gym_id uuid,
  p_weekdays int[],          -- 1 = ponedeljak ... 7 = nedelja
  p_start time,
  p_end time,
  p_minutes int default 60
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_monday date := (select first_day from public.active_week());
  v_day date;
  v_min int;
  v_start_min int := extract(hour from p_start) * 60 + extract(minute from p_start);
  v_end_min   int := extract(hour from p_end) * 60 + extract(minute from p_end);
  v_starts timestamptz;
  v_rows int;
  v_count int := 0;
begin
  if v_uid is null or not public.is_trainer() then
    raise exception 'Samo treneri mogu da prave termine.';
  end if;
  if not exists (select 1 from public.trainer_gyms where trainer_id = v_uid and gym_id = p_gym_id) then
    raise exception 'Prvo u profilu dodaj ovu teretanu kao mesto gde radiš.';
  end if;
  if p_weekdays is null or cardinality(p_weekdays) = 0 then
    raise exception 'Izaberi bar jedan dan.';
  end if;
  if p_minutes is null or p_minutes < 15 or p_minutes > 240 then
    raise exception 'Trajanje termina mora biti između 15 i 240 minuta.';
  end if;
  if v_end_min <= v_start_min then
    raise exception 'Kraj radnog vremena mora biti posle početka.';
  end if;

  for i in 0..6 loop
    v_day := v_monday + i;
    if (i + 1) = any (p_weekdays) then
      v_min := v_start_min;
      while v_min + p_minutes <= v_end_min loop
        v_starts := (v_day::timestamp + make_interval(mins => v_min)) at time zone 'Europe/Belgrade';
        if v_starts > now() then
          insert into public.slots (trainer_id, gym_id, starts_at, ends_at)
          values (v_uid, p_gym_id, v_starts, v_starts + make_interval(mins => p_minutes))
          on conflict do nothing;          -- preskoči termine koji se preklapaju sa postojećim
          get diagnostics v_rows = row_count;
          v_count := v_count + v_rows;
        end if;
        v_min := v_min + p_minutes;
      end loop;
    end if;
  end loop;

  return v_count;
end;
$$;
revoke execute on function public.create_slots(uuid, int[], time, time, int) from public, anon;
grant  execute on function public.create_slots(uuid, int[], time, time, int) to authenticated;


-- 4. Zakazivanje — samo termini iz tekuće nedelje
create or replace function public.book_slot(p_slot_id uuid, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_slot public.slots;
  v_booking_id uuid;
begin
  if v_uid is null then
    raise exception 'Morate biti prijavljeni da biste zakazali termin.';
  end if;

  if (select count(*) from public.bookings b join public.slots s on s.id = b.slot_id
      where b.client_id = v_uid and b.status = 'confirmed' and s.starts_at > now()) >= 10 then
    raise exception 'Imate previše zakazanih termina. Otkažite neki pre nego što zakažete novi.';
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

  insert into public.bookings (slot_id, trainer_id, client_id, note)
  values (v_slot.id, v_slot.trainer_id, v_uid, nullif(trim(p_note), ''))
  returning id into v_booking_id;

  return v_booking_id;
end;
$$;


-- 5. Brisanje starih termina (pokreće se automatski svakog sata)
create or replace function public.weekly_cleanup()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start timestamptz;
  v_end timestamptz;
  v_rows int;
begin
  select week_start, week_end into v_start, v_end from public.active_week();

  delete from public.slots s
   where (s.starts_at < v_start
          and (s.status <> 'booked' or s.ends_at < now() - interval '14 days'))
      or (s.starts_at >= v_end and s.status <> 'booked');

  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;
revoke execute on function public.weekly_cleanup() from public, anon, authenticated;


-- 6. Automatsko pokretanje (pg_cron). Ako ovo javi grešku, uključi
--    Supabase → Integrations → Cron, pa pokreni samo ovaj deo ponovo.
do $$
begin
  create extension if not exists pg_cron with schema pg_catalog;
  perform cron.schedule('fitmapa-weekly-cleanup', '5 * * * *', 'select public.weekly_cleanup()');
  raise notice 'Automatsko brisanje je uključeno.';
exception when others then
  raise notice 'pg_cron nije dostupan (%). Uključi Integrations → Cron i pokreni ovaj blok ponovo.', sqlerrm;
end;
$$;


-- 7. Odmah počisti stare probne termine
select public.weekly_cleanup() as obrisano_starih_termina;
