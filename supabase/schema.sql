-- =====================================================================
--  FitMapa — šema baze za Supabase
--  Pokreni JEDNOM na novom projektu: Supabase → SQL Editor → New query →
--  nalepi ceo ovaj fajl → Run.
-- =====================================================================

create extension if not exists btree_gist;   -- potrebno da trener ne može imati dva termina koji se preklapaju


-- ---------------------------------------------------------------------
-- 1. TABELE
-- ---------------------------------------------------------------------

-- Svaki korisnik (vežbač ili trener). Pravi se automatski pri registraciji.
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        text not null default 'client' check (role in ('client', 'trainer')),
  full_name   text not null default '',
  phone       text,
  created_at  timestamptz not null default now()
);

create table public.gyms (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 1),
  address     text,
  lat         double precision not null check (lat between -90 and 90),
  lng         double precision not null check (lng between -180 and 180),
  image_url   text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Javni profil trenera (dodatak na profiles).
create table public.trainers (
  id                 uuid primary key references public.profiles(id) on delete cascade,
  bio                text not null default '',
  specialties        text[] not null default '{}',
  years_experience   int check (years_experience between 0 and 70),
  certificates       text not null default '',
  price_per_session  numeric(10,2) check (price_per_session >= 0),
  price_note         text not null default '',
  avatar_url         text,
  photos             text[] not null default '{}',
  instagram          text,
  whatsapp           text,
  viber              text,
  contact_phone      text,
  contact_email      text,
  is_published       boolean not null default false,
  updated_at         timestamptz not null default now()
);

-- U kojim teretanama trener radi (više-na-više).
create table public.trainer_gyms (
  trainer_id  uuid not null references public.trainers(id) on delete cascade,
  gym_id      uuid not null references public.gyms(id) on delete cascade,
  primary key (trainer_id, gym_id)
);

-- Konkretni termini koje trener pravi. Svi ih vide, ali ne i KO je zakazao.
create table public.slots (
  id          uuid primary key default gen_random_uuid(),
  trainer_id  uuid not null references public.trainers(id) on delete cascade,
  gym_id      uuid not null references public.gyms(id) on delete cascade,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  status      text not null default 'open' check (status in ('open', 'booked', 'blocked')),
  created_at  timestamptz not null default now(),
  check (ends_at > starts_at),
  -- trener ne može imati dva termina koji se vremenski preklapaju
  constraint slots_no_overlap exclude using gist (
    trainer_id with =,
    tstzrange(starts_at, ends_at) with &&
  )
);
create index slots_trainer_time_idx on public.slots (trainer_id, starts_at);
create index slots_gym_time_idx     on public.slots (gym_id, starts_at);

-- Rezervacije. Vidi ih samo trener tog termina i vežbač koji je zakazao.
create table public.bookings (
  id            uuid primary key default gen_random_uuid(),
  slot_id       uuid not null references public.slots(id) on delete cascade,
  trainer_id    uuid not null references public.trainers(id) on delete cascade,
  client_id     uuid not null references public.profiles(id) on delete cascade,
  status        text not null default 'confirmed'
                check (status in ('confirmed', 'cancelled_by_client', 'cancelled_by_trainer')),
  note          text check (length(note) <= 500),
  created_at    timestamptz not null default now(),
  cancelled_at  timestamptz
);
-- Zaštita od duplog zakazivanja: najviše JEDNA aktivna rezervacija po terminu.
create unique index bookings_one_active_per_slot
  on public.bookings (slot_id) where status = 'confirmed';
create index bookings_client_idx  on public.bookings (client_id);
create index bookings_trainer_idx on public.bookings (trainer_id);

create table public.reviews (
  id           uuid primary key default gen_random_uuid(),
  booking_id   uuid not null unique references public.bookings(id) on delete cascade,
  trainer_id   uuid not null references public.trainers(id) on delete cascade,
  client_id    uuid not null references public.profiles(id) on delete cascade,
  client_name  text not null default '',
  rating       smallint not null check (rating between 1 and 5),
  comment      text check (length(comment) <= 1000),
  created_at   timestamptz not null default now()
);
create index reviews_trainer_idx on public.reviews (trainer_id);


-- ---------------------------------------------------------------------
-- 2. AUTOMATSKO PRAVLJENJE PROFILA PRI REGISTRACIJI
-- ---------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := coalesce(new.raw_user_meta_data ->> 'role', 'client');
begin
  if v_role not in ('client', 'trainer') then
    v_role := 'client';
  end if;

  insert into public.profiles (id, role, full_name, phone)
  values (
    new.id,
    v_role,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'phone'
  );

  if v_role = 'trainer' then
    insert into public.trainers (id, contact_phone)
    values (new.id, new.raw_user_meta_data ->> 'phone');
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trainers_touch before update on public.trainers
  for each row execute function public.touch_updated_at();

-- Pomoćna funkcija: da li je prijavljeni korisnik trener?
create or replace function public.is_trainer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.trainers where id = auth.uid());
$$;


-- ---------------------------------------------------------------------
-- 3. PRAVILA PRISTUPA (Row Level Security)
-- ---------------------------------------------------------------------

alter table public.profiles     enable row level security;
alter table public.gyms         enable row level security;
alter table public.trainers     enable row level security;
alter table public.trainer_gyms enable row level security;
alter table public.slots        enable row level security;
alter table public.bookings     enable row level security;
alter table public.reviews      enable row level security;

-- PROFILES: imena trenera su javna; svoj profil vidiš uvek;
-- trener vidi ime i telefon vežbača koji je kod njega zakazao.
create policy profiles_select on public.profiles for select
  using (
    role = 'trainer'
    or id = auth.uid()
    or exists (
      select 1 from public.bookings b
      where b.trainer_id = auth.uid() and b.client_id = profiles.id
    )
  );
create policy profiles_update_own on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
-- Korisnik sme da menja samo ime i telefon (ne i ulogu).
revoke update on public.profiles from anon, authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

-- GYMS: svi vide; trener može da doda teretanu i da menja one koje je dodao.
create policy gyms_select on public.gyms for select using (true);
create policy gyms_insert on public.gyms for insert to authenticated
  with check (public.is_trainer() and created_by = auth.uid());
create policy gyms_update on public.gyms for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());

-- TRAINERS: objavljeni profili su javni; trener uvek vidi i menja svoj.
create policy trainers_select on public.trainers for select
  using (is_published or id = auth.uid());
create policy trainers_update_own on public.trainers for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- TRAINER_GYMS: javno; trener upravlja samo svojim vezama.
create policy trainer_gyms_select on public.trainer_gyms for select using (true);
create policy trainer_gyms_insert on public.trainer_gyms for insert to authenticated
  with check (trainer_id = auth.uid() and public.is_trainer());
create policy trainer_gyms_delete on public.trainer_gyms for delete to authenticated
  using (trainer_id = auth.uid());

-- SLOTS: svi vide status termina (slobodan / zauzet), ali ne i ko je zakazao.
-- Pravljenje i menjanje ide kroz funkcije ispod; trener sme da obriše svoj nezauzet termin.
create policy slots_select on public.slots for select using (true);
create policy slots_delete_own on public.slots for delete to authenticated
  using (trainer_id = auth.uid() and status <> 'booked');

-- BOOKINGS: samo vežbač koji je zakazao i trener tog termina.
create policy bookings_select on public.bookings for select
  using (client_id = auth.uid() or trainer_id = auth.uid());

-- REVIEWS: javne; pišu se kroz funkciju add_review.
create policy reviews_select on public.reviews for select using (true);


-- ---------------------------------------------------------------------
-- 4. FUNKCIJE (zakazivanje, otkazivanje, raspored, ocene)
-- ---------------------------------------------------------------------

-- Zakazivanje. Atomski: ako dvoje klikne istovremeno, uspeva samo prvi.
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

-- Otkazivanje. Vežbač: termin se oslobađa. Trener: bira da li da ga oslobodi ili blokira.
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

  if not found or v_b.status <> 'confirmed'
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
    update public.bookings set status = 'cancelled_by_trainer', cancelled_at = now() where id = v_b.id;
    update public.slots
       set status = case when p_reopen then 'open' else 'blocked' end
     where id = v_b.slot_id and status = 'booked';
  end if;
end;
$$;

-- Trener pravi termine za više dana odjednom (npr. pon/sre/pet 17–21h, po 60 min).
-- p_weekdays: 1 = ponedeljak ... 7 = nedelja. Vreme je po beogradskoj vremenskoj zoni.
create or replace function public.create_slots(
  p_gym_id uuid,
  p_from date,
  p_to date,
  p_weekdays int[],
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
  if p_to < p_from then
    raise exception 'Datum "do" mora biti posle datuma "od".';
  end if;
  if p_to - p_from > 92 then
    raise exception 'Možeš praviti termine najviše 3 meseca unapred odjednom.';
  end if;
  if p_minutes is null or p_minutes < 15 or p_minutes > 240 then
    raise exception 'Trajanje termina mora biti između 15 i 240 minuta.';
  end if;
  if v_end_min <= v_start_min then
    raise exception 'Kraj radnog vremena mora biti posle početka.';
  end if;

  for v_day in select d::date from generate_series(p_from, p_to, interval '1 day') d loop
    if extract(isodow from v_day)::int = any (p_weekdays) then
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

-- Trener jednim klikom blokira ili oslobađa jedan termin.
create or replace function public.set_slot_status(p_slot_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('open', 'blocked') then
    raise exception 'Nepoznat status.';
  end if;
  update public.slots
     set status = p_status
   where id = p_slot_id
     and trainer_id = auth.uid()
     and status in ('open', 'blocked');
  if not found then
    raise exception 'Termin nije pronađen ili je već zauzet.';
  end if;
end;
$$;

-- Trener blokira ili oslobađa ceo dan (zauzeti termini ostaju netaknuti).
create or replace function public.set_day_status(p_day date, p_status text)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows int;
begin
  if p_status not in ('open', 'blocked') then
    raise exception 'Nepoznat status.';
  end if;
  update public.slots
     set status = p_status
   where trainer_id = auth.uid()
     and status in ('open', 'blocked')
     and (starts_at at time zone 'Europe/Belgrade')::date = p_day;
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

-- Ocena trenera — samo posle odrađenog (prošlog, neotkazanog) treninga, jednom po rezervaciji.
create or replace function public.add_review(p_booking_id uuid, p_rating int, p_comment text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_b public.bookings;
  v_name text;
begin
  select b.* into v_b
    from public.bookings b
    join public.slots s on s.id = b.slot_id
   where b.id = p_booking_id
     and b.client_id = v_uid
     and b.status = 'confirmed'
     and s.ends_at < now();

  if not found then
    raise exception 'Možeš oceniti samo trening koji si odradio.';
  end if;
  if p_rating not between 1 and 5 then
    raise exception 'Ocena mora biti od 1 do 5.';
  end if;
  if exists (select 1 from public.reviews where booking_id = p_booking_id) then
    raise exception 'Ovaj trening si već ocenio.';
  end if;

  -- Prikazuje se samo ime i prvo slovo prezimena, npr. "Marko P."
  select trim(split_part(full_name, ' ', 1) || ' ' ||
              coalesce(nullif(left(split_part(full_name, ' ', 2), 1), '') || '.', ''))
    into v_name
    from public.profiles where id = v_uid;

  insert into public.reviews (booking_id, trainer_id, client_id, client_name, rating, comment)
  values (p_booking_id, v_b.trainer_id, v_uid, coalesce(v_name, ''), p_rating, nullif(trim(p_comment), ''));
end;
$$;

-- Funkcije za izmenu podataka smeju da pozivaju samo prijavljeni korisnici.
revoke execute on function public.book_slot(uuid, text)                                  from public, anon;
revoke execute on function public.cancel_booking(uuid, boolean)                          from public, anon;
revoke execute on function public.create_slots(uuid, date, date, int[], time, time, int) from public, anon;
revoke execute on function public.set_slot_status(uuid, text)                            from public, anon;
revoke execute on function public.set_day_status(date, text)                             from public, anon;
revoke execute on function public.add_review(uuid, int, text)                            from public, anon;
grant  execute on function public.book_slot(uuid, text)                                  to authenticated;
grant  execute on function public.cancel_booking(uuid, boolean)                          to authenticated;
grant  execute on function public.create_slots(uuid, date, date, int[], time, time, int) to authenticated;
grant  execute on function public.set_slot_status(uuid, text)                            to authenticated;
grant  execute on function public.set_day_status(date, text)                             to authenticated;
grant  execute on function public.add_review(uuid, int, text)                            to authenticated;


-- ---------------------------------------------------------------------
-- 5. REALTIME — kalendar se osvežava svima čim se termin zauzme
-- ---------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.slots;
  end if;
end;
$$;


-- ---------------------------------------------------------------------
-- 6. SKLADIŠTE ZA SLIKE (profilne slike trenera i galerija)
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Svako sme da otprema i briše samo u svom folderu: photos/<svoj-id>/...
create policy photos_select_own on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy photos_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy photos_update_own on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy photos_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);


-- ---------------------------------------------------------------------
-- 7. PROBNE TERETANE (preimenuj ih ili obriši u Table Editor-u kad dodaš prave)
-- ---------------------------------------------------------------------

insert into public.gyms (name, address, lat, lng) values
  ('Demo teretana Centar',   'Novi Sad, Centar',   45.2551, 19.8452),
  ('Demo teretana Liman',    'Novi Sad, Liman',    45.2440, 19.8440),
  ('Demo teretana Grbavica', 'Novi Sad, Grbavica', 45.2515, 19.8335);
