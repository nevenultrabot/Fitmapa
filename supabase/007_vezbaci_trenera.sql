-- =====================================================================
--  FitMapa — izmena 007: VEŽBAČI TRENERA ("prijatelji")
--  Pokreni JEDNOM u Supabase → SQL Editor → New query (posle 005 i 006).
--
--  • Vežbač pošalje zahtev sa profila trenera, trener ga prihvati ili odbije.
--  • Čim vežbač odradi trening kod trenera, automatski postaje njegov vežbač
--    (proverava se svakog sata).
--  • Na profilu trenera svi vide broj i imena njegovih vežbača (bez telefona).
--  • Bilo ko od njih dvojice može da prekine vezu.
-- =====================================================================

create table if not exists public.trainer_clients (
  trainer_id  uuid not null references public.trainers(id) on delete cascade,
  client_id   uuid not null references public.profiles(id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending', 'accepted')),
  source      text not null default 'request' check (source in ('request', 'training')),
  created_at  timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (trainer_id, client_id),
  check (trainer_id <> client_id)
);
create index if not exists trainer_clients_client_idx on public.trainer_clients (client_id);

alter table public.trainer_clients enable row level security;
-- prihvaćene veze su javne (broj i imena se vide na profilu); zahteve vide samo njih dvojica
create policy trainer_clients_select on public.trainer_clients for select
  using (status = 'accepted' or trainer_id = auth.uid() or client_id = auth.uid());

-- koji odrađeni treninzi su već uračunati
alter table public.bookings add column if not exists counted boolean not null default false;


-- 1. Vežbač šalje zahtev treneru ---------------------------------------
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
  if not exists (select 1 from public.trainers where id = p_trainer_id and is_published) then
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


-- 2. Trener prihvata ili odbija zahtev ---------------------------------
create or replace function public.respond_client(p_client_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_accept then
    update public.trainer_clients
       set status = 'accepted', accepted_at = now()
     where trainer_id = auth.uid() and client_id = p_client_id and status = 'pending';
  else
    delete from public.trainer_clients
     where trainer_id = auth.uid() and client_id = p_client_id and status = 'pending';
  end if;
  if not found then
    raise exception 'Zahtev nije pronađen.';
  end if;
end;
$$;
revoke execute on function public.respond_client(uuid, boolean) from public, anon;
grant  execute on function public.respond_client(uuid, boolean) to authenticated;


-- 3. Prekid veze (ili povlačenje zahteva) — bilo ko od njih dvojice -----
create or replace function public.remove_trainer_client(p_other uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.trainer_clients
   where (trainer_id = auth.uid() and client_id = p_other)
      or (client_id = auth.uid() and trainer_id = p_other);
end;
$$;
revoke execute on function public.remove_trainer_client(uuid) from public, anon;
grant  execute on function public.remove_trainer_client(uuid) to authenticated;


-- 4. Automatski: posle odrađenog treninga vežbač postaje trenerov ------
create or replace function public.link_finished_trainings()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows int;
begin
  with done as (
    update public.bookings b
       set counted = true
      from public.slots s
     where s.id = b.slot_id
       and b.status = 'confirmed'
       and not b.counted
       and s.ends_at < now()
    returning b.trainer_id, b.client_id
  )
  insert into public.trainer_clients (trainer_id, client_id, status, source, accepted_at)
  select distinct d.trainer_id, d.client_id, 'accepted', 'training', now()
    from done d
   where d.trainer_id <> d.client_id
  on conflict (trainer_id, client_id)
    do update set status = 'accepted', accepted_at = coalesce(public.trainer_clients.accepted_at, now())
     where public.trainer_clients.status = 'pending';
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;
revoke execute on function public.link_finished_trainings() from public, anon, authenticated;

-- uračunaj sve dosadašnje odrađene treninge odmah
select public.link_finished_trainings() as dodato_vezbaca;


-- 5. Javni spisak vežbača jednog trenera (samo ime, bez telefona) -------
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
     and (t.is_published or tc.trainer_id = auth.uid())
   order by tc.accepted_at desc nulls last;
$$;
grant execute on function public.trainer_client_list(uuid) to anon, authenticated;

-- Zahtevi koje trener još nije rešio (ime i telefon vidi samo on)
create or replace function public.my_client_requests()
returns table (client_id uuid, full_name text, phone text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select tc.client_id, coalesce(nullif(p.full_name, ''), 'Vežbač'), p.phone, tc.created_at
    from public.trainer_clients tc
    join public.profiles p on p.id = tc.client_id
   where tc.trainer_id = auth.uid() and tc.status = 'pending'
   order by tc.created_at;
$$;
revoke execute on function public.my_client_requests() from public, anon;
grant  execute on function public.my_client_requests() to authenticated;


-- 6. Statistika trenera: "klijenata" = broj vežbača --------------------
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
     and t.is_published;
$$;
grant execute on function public.trainer_stats(uuid[]) to anon, authenticated;


-- 7. Automatsko pokretanje (svakog sata) -------------------------------
do $$
begin
  perform cron.schedule('fitmapa-link-trainings', '20 * * * *', 'select public.link_finished_trainings()');
exception when others then
  raise notice 'pg_cron nije dostupan (%).', sqlerrm;
end;
$$;
