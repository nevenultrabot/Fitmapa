-- =====================================================================
--  FitMapa — izmena 006: PODATKE O TERETANI MENJA SAMO ADMINISTRATOR
--  Pokreni JEDNOM u Supabase → SQL Editor → New query.
--
--  Treneri i dalje mogu da DODAJU teretanu koje nema na listi i da je
--  izaberu kao mesto gde rade, ali naziv, adresu, radno vreme, cene i
--  sliku posle toga menja samo administrator.
-- =====================================================================

drop policy if exists gyms_update on public.gyms;
create policy gyms_update on public.gyms for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
