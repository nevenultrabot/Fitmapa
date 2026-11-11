-- =====================================================================
--  FitMapa — izmena 004: CENOVNIK TERETANE, ADMINISTRATOR, STATISTIKA TRENERA
--  Pokreni JEDNOM u Supabase → SQL Editor → New query → nalepi ceo fajl → Run.
--  Na dnu fajla je red kojim sebe postavljaš za administratora.
-- =====================================================================


-- 1. Slika cenovnika za svaku teretanu
alter table public.gyms add column if not exists price_list_url text;


-- 2. Administrator (ti) — sme da uređuje sve teretane
alter table public.profiles add column if not exists is_admin boolean not null default false;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

drop policy if exists gyms_update on public.gyms;
create policy gyms_update on public.gyms for update to authenticated
  using (
    public.is_admin()
    or created_by = auth.uid()
    or (created_by is null and exists (
          select 1 from public.trainer_gyms tg where tg.gym_id = gyms.id and tg.trainer_id = auth.uid()))
  )
  with check (
    public.is_admin()
    or created_by = auth.uid()
    or (created_by is null and exists (
          select 1 from public.trainer_gyms tg where tg.gym_id = gyms.id and tg.trainer_id = auth.uid()))
  );

drop policy if exists gyms_insert on public.gyms;
create policy gyms_insert on public.gyms for insert to authenticated
  with check ((public.is_trainer() or public.is_admin()) and created_by = auth.uid());

revoke update on public.gyms from anon, authenticated;
grant update (name, address, lat, lng, image_url, opening_hours, membership, price_list_url)
  on public.gyms to authenticated;


-- 3. Odrađeni treninzi se više ne brišu (potrebni su za statistiku trenera).
--    Brišu se samo stari slobodni i blokirani termini.
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
   where s.status <> 'booked'
     and (s.starts_at < v_start or s.starts_at >= v_end);

  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;
revoke execute on function public.weekly_cleanup() from public, anon, authenticated;


-- 4. Statistika trenera (javna): broj klijenata i odrađenih treninga
create or replace function public.trainer_stats(p_ids uuid[])
returns table (trainer_id uuid, clients int, sessions int)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id,
         count(distinct b.client_id)::int,
         count(b.id)::int
    from public.trainers t
    left join public.bookings b
      on b.trainer_id = t.id
     and b.status = 'confirmed'
     and exists (select 1 from public.slots s where s.id = b.slot_id and s.ends_at < now())
   where t.id = any (p_ids)
     and t.is_published
   group by t.id;
$$;
grant execute on function public.trainer_stats(uuid[]) to anon, authenticated;


-- 5. POSTAVI SEBE ZA ADMINISTRATORA
--    Zameni TVOJ@EMAIL.COM emailom sa kojim se prijavljuješ u FitMapu, pa pokreni.
update public.profiles
   set is_admin = true
 where id = (select id from auth.users where email = 'TVOJ@EMAIL.COM');
