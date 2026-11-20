-- =====================================================================
--  FitMapa — izmena 009: NOVE TERETANE DODAJE SAMO ADMINISTRATOR
--  Pokreni JEDNOM u Supabase → SQL Editor → New query (posle 008).
--
--  Treneri biraju teretanu sa postojeće liste; novu teretanu dodaje samo
--  administrator (Teretane → "Dodaj teretanu").
-- =====================================================================

drop policy if exists gyms_insert on public.gyms;
create policy gyms_insert on public.gyms for insert to authenticated
  with check (public.is_admin() and created_by = auth.uid());
