-- =====================================================================
--  FitMapa — izmena 008: ODOBRAVANJE TRENERA I NOVIH TERETANA
--  Pokreni JEDNOM u Supabase → SQL Editor → New query (posle 007).
--
--  • Novi trener može da napravi i sredi profil, ali ga klijenti vide tek kad ga
--    administrator odobri (stranica "Administracija" u meniju sa avatarom).
--  • Isto važi za teretanu koju doda trener: na mapi je tek kad je odobriš.
--  • Svi treneri koji su SADA javni i sve postojeće teretane ostaju odobreni.
-- =====================================================================


-- 1. Kolone ------------------------------------------------------------
alter table public.trainers add column if not exists is_approved boolean not null default false;
alter table public.trainers add column if not exists approved_at timestamptz;
update public.trainers set is_approved = true, approved_at = coalesce(approved_at, now())
 where is_published and not is_approved;

alter table public.gyms add column if not exists is_approved boolean not null default true;  -- postojeće = odobrene
alter table public.gyms alter column is_approved set default false;                         -- nove čekaju

-- trener NE sme sam sebi da uključi odobrenje: menja samo svoja polja profila
revoke update on public.trainers from anon, authenticated;
grant update (bio, specialties, years_experience, certificates, price_per_session, price_note, avatar_url, photos,
              instagram, whatsapp, viber, contact_phone, contact_email, is_published)
  on public.trainers to authenticated;

-- teretana koju doda administrator odobrena je odmah, ostale čekaju
create or replace function public.gyms_set_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.is_approved := public.is_admin();
  return new;
end;
$$;
drop trigger if exists gyms_set_approval on public.gyms;
create trigger gyms_set_approval before insert on public.gyms
  for each row execute function public.gyms_set_approval();


-- 2. Ko šta vidi -------------------------------------------------------
drop policy if exists trainers_select on public.trainers;
create policy trainers_select on public.trainers for select
  using ((is_published and is_approved) or id = auth.uid() or public.is_admin());

drop policy if exists gyms_select on public.gyms;
create policy gyms_select on public.gyms for select
  using (is_approved or created_by = auth.uid() or public.is_admin());


-- 3. Administrator odobrava -------------------------------------------
create or replace function public.approve_trainer(p_trainer_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Samo administrator može da odobrava trenere.';
  end if;
  update public.trainers
     set is_approved = p_approve,
         approved_at = case when p_approve then now() else null end
   where id = p_trainer_id;
  -- uz trenera se odobravaju i teretane koje je on dodao
  if p_approve then
    update public.gyms set is_approved = true where created_by = p_trainer_id and not is_approved;
  end if;
end;
$$;
revoke execute on function public.approve_trainer(uuid, boolean) from public, anon;
grant  execute on function public.approve_trainer(uuid, boolean) to authenticated;

create or replace function public.approve_gym(p_gym_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Samo administrator može da odobrava teretane.';
  end if;
  update public.gyms set is_approved = p_approve where id = p_gym_id;
end;
$$;
revoke execute on function public.approve_gym(uuid, boolean) from public, anon;
grant  execute on function public.approve_gym(uuid, boolean) to authenticated;

-- spisak trenera za administratora (sa emailom, da možeš da ih kontaktiraš)
create or replace function public.admin_trainers()
returns table (
  id uuid, full_name text, email text, phone text, avatar_url text, bio text,
  is_published boolean, is_approved boolean, created_at timestamptz, gyms text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, p.full_name, u.email::text, coalesce(t.contact_phone, p.phone), t.avatar_url, t.bio,
         t.is_published, t.is_approved, p.created_at,
         coalesce((select array_agg(g.name order by g.name) from public.trainer_gyms tg
                     join public.gyms g on g.id = tg.gym_id where tg.trainer_id = t.id), '{}')
    from public.trainers t
    join public.profiles p on p.id = t.id
    left join auth.users u on u.id = t.id
   where public.is_admin()
   order by t.is_approved, t.is_published desc, p.created_at desc;
$$;
revoke execute on function public.admin_trainers() from public, anon;
grant  execute on function public.admin_trainers() to authenticated;

-- broj stvari koje čekaju odobrenje (za crveni brojčić u meniju)
create or replace function public.admin_pending_count()
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select case when public.is_admin() then
    (select count(*) from public.trainers where is_published and not is_approved)::int
    + (select count(*) from public.gyms where not is_approved)::int
  else 0 end;
$$;
revoke execute on function public.admin_pending_count() from public, anon;
grant  execute on function public.admin_pending_count() to authenticated;


-- 4. Neodobreni trener ne prima rezervacije, zahteve i automatski raspored
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
  if not exists (select 1 from public.trainers where id = v_slot.trainer_id and is_published and is_approved) then
    raise exception 'Ovaj trener trenutno ne prima rezervacije.';
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

create or replace function public.request_trainer(p_trainer_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
begin
  if v_uid is null then
    raise exception 'Morate biti prijavljeni.';
  end if;
  if v_uid = p_trainer_id or exists (select 1 from public.profiles where id = v_uid and role = 'trainer') then
    raise exception 'Samo vežbači mogu da dodaju trenera.';
  end if;
  if not exists (select 1 from public.trainers where id = p_trainer_id and is_published and is_approved) then
    raise exception 'Trener nije pronađen.';
  end if;

  select status into v_status from public.trainer_clients where trainer_id = p_trainer_id and client_id = v_uid;
  if found then
    return v_status;
  end if;

  insert into public.trainer_clients (trainer_id, client_id) values (p_trainer_id, v_uid);
  return 'pending';
end;
$$;
revoke execute on function public.request_trainer(uuid) from public, anon;
grant  execute on function public.request_trainer(uuid) to authenticated;

create or replace function public.trainer_client_list(p_trainer_id uuid)
returns table (client_id uuid, full_name text, since timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select tc.client_id, coalesce(nullif(p.full_name, ''), 'Vežbač'), tc.accepted_at
    from public.trainer_clients tc
    join public.profiles p on p.id = tc.client_id
    join public.trainers t on t.id = tc.trainer_id
   where tc.trainer_id = p_trainer_id
     and tc.status = 'accepted'
     and ((t.is_published and t.is_approved) or tc.trainer_id = auth.uid() or public.is_admin())
   order by tc.accepted_at desc nulls last;
$$;
grant execute on function public.trainer_client_list(uuid) to anon, authenticated;

create or replace function public.trainer_stats(p_ids uuid[])
returns table (trainer_id uuid, clients int, sessions int)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id,
         (select count(*) from public.trainer_clients tc where tc.trainer_id = t.id and tc.status = 'accepted')::int,
         (select count(*) from public.bookings b join public.slots s on s.id = b.slot_id
           where b.trainer_id = t.id and b.status = 'confirmed' and s.ends_at < now())::int
    from public.trainers t
   where t.id = any (p_ids)
     and t.is_published and t.is_approved;
$$;
grant execute on function public.trainer_stats(uuid[]) to anon, authenticated;

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
     where t.is_published and t.is_approved
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
