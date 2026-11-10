-- =====================================================================
--  FitMapa — izmena 003: PODACI O TERETANAMA + UKLANJANJE RECENZIJA
--  Pokreni JEDNOM u Supabase → SQL Editor → New query → Run.
--  (Linije koje počinju sa -- su komentari; nalepi ceo fajl.)
-- =====================================================================


-- 1. Nova polja za teretanu: radno vreme i članarina
alter table public.gyms add column if not exists opening_hours text not null default '';
alter table public.gyms add column if not exists membership    text not null default '';


-- 2. Ko sme da menja podatke o teretani:
--    • trener koji ju je dodao
--    • ili bilo koji trener koji u njoj radi, ako je teretanu dodao administrator (npr. demo teretane)
drop policy if exists gyms_update on public.gyms;
create policy gyms_update on public.gyms for update to authenticated
  using (
    created_by = auth.uid()
    or (created_by is null and exists (
          select 1 from public.trainer_gyms tg where tg.gym_id = gyms.id and tg.trainer_id = auth.uid()))
  )
  with check (
    created_by = auth.uid()
    or (created_by is null and exists (
          select 1 from public.trainer_gyms tg where tg.gym_id = gyms.id and tg.trainer_id = auth.uid()))
  );

-- Menjati se smeju samo ova polja (ne i ko je teretanu dodao)
revoke update on public.gyms from anon, authenticated;
grant update (name, address, lat, lng, image_url, opening_hours, membership) on public.gyms to authenticated;


-- 3. Recenzije se uklanjaju
drop function if exists public.add_review(uuid, int, text);
drop table if exists public.reviews;


-- 4. Probni podaci za demo teretane (zameni pravim podacima u panelu trenera
--    ili u Table Editor → gyms)
update public.gyms set
  address = 'Zmaj Jovina 10, Novi Sad',
  opening_hours = 'Pon–Pet 07–23h · Sub 09–21h · Ned 10–18h',
  membership = 'Mesečna 4.000 RSD · Dnevna 500 RSD'
where name = 'Demo teretana Centar';

update public.gyms set
  address = 'Bulevar despota Stefana 7, Novi Sad',
  opening_hours = 'Pon–Pet 06–24h · Vikend 08–22h',
  membership = 'Mesečna 3.500 RSD · Studentska 3.000 RSD'
where name = 'Demo teretana Liman';

update public.gyms set
  address = 'Rumenačka 15, Novi Sad',
  opening_hours = 'Svaki dan 08–22h',
  membership = 'Mesečna 3.200 RSD · 12 dolazaka 2.800 RSD'
where name = 'Demo teretana Grbavica';
