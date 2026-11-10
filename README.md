# FitMapa

Mapa teretana u Novom Sadu → personalni treneri → zakazivanje termina.

- **Vežbač:** vidi mapu, bira teretanu, otvara profil trenera, zakazuje slobodan termin (odmah potvrđen), otkazuje, ocenjuje posle treninga.
- **Trener:** pravi profil (bio, slike, cena, WhatsApp/Viber/Instagram), bira teretane, pravi termine za više dana odjednom, blokira termine ili cele dane, vidi ko je zakazao, otkazuje.
- Svi vide da je termin **„Zauzeto”**, a ime i telefon klijenta vidi **samo trener**. To pravilo je u samoj bazi.
- Plaćanje je na licu mesta, nema ga u aplikaciji.

Tehnologije: Next.js (web aplikacija koja radi i na telefonu), Supabase (baza, nalozi, slike), MapLibre + OpenFreeMap (besplatne mape bez API ključa), Vercel (hosting).

---

## Postavljanje: 4 koraka

### 1. Baza (Supabase)
1. Na [supabase.com](https://supabase.com) otvori svoj projekat (ili napravi novi, region **Frankfurt (eu-central-1)**).
2. Levo izaberi **SQL Editor**, pa **New query**.
3. Otvori fajl `supabase/schema.sql`, kopiraj **ceo** sadržaj, nalepi ga i klikni **Run**.
   Treba da piše *Success. No rows returned*. Pokreće se **samo jednom**.
4. Levo izaberi **Authentication**, pa **URL Configuration**:
   - **Site URL:** za sada ostavi kako jeste. Posle koraka 3 tu upisuješ adresu sa Vercela (npr. `https://fitmapa.vercel.app`).
5. Za brže testiranje možeš privremeno isključiti potvrdu emaila:
   **Authentication → Sign In / Providers → Email →** isključi **Confirm email**.
   Pred pravo puštanje ga ponovo uključi.

### 2. Kod na GitHub
1. Na [github.com](https://github.com) klikni **New repository** i nazovi ga npr. `fitmapa` (Private je ok). Klikni **Create repository**.
2. Na stranici novog repozitorijuma klikni link **uploading an existing file**.
3. Raspakuj `fitmapa.zip` na računaru, otvori folder `fitmapa` i **prevuci sav njegov sadržaj** (foldere `app`, `components`, `lib`, `public`, `supabase` i ostale fajlove) u prozor pregledača.
4. Dole klikni **Commit changes**.

> Fajlovi `.gitignore` i `.env.example` počinju tačkom, pa su na Mac-u i Windows-u često sakriveni. Nisu obavezni za rad aplikacije.

### 3. Objava (Vercel)
1. Na [vercel.com](https://vercel.com) klikni **Add New… → Project** i izaberi repozitorijum `fitmapa` (**Import**).
2. Otvori **Environment Variables** i dodaj dve promenljive. Vrednosti nalaziš u Supabase: dugme **Connect** gore, ili **Project Settings → API Keys**.

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL, npr. `https://abcd1234.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_KEY` | **anon public** ili **publishable** ključ |

   ⚠️ **Nikad** ne stavljaj `service_role` ili `secret` ključ. On zaobilazi sva pravila privatnosti.
3. Klikni **Deploy** i sačekaj 1–2 minuta. Dobićeš adresu tipa `https://fitmapa-xxxx.vercel.app`.
4. Vrati se u Supabase (**Authentication → URL Configuration**), upiši tu adresu u **Site URL** i dodaj je i u **Redirect URLs**.

### 4. Probaj
1. Otvori adresu i izaberi **Prijava → Registracija → Personalni trener**.
2. U **Moj panel → Profil** štikliraj teretanu, popuni bio i kontakte, uključi **Profil je javan** i klikni **Sačuvaj**.
3. U **Dodaj termine** napravi npr. pon–pet 17–21h.
4. U drugom pregledaču (ili inkognito prozoru) napravi nalog kao **Vežbač**, klikni teretanu na mapi, pa trenera i slobodan termin.
5. Vrati se na trenerski nalog: u **Raspored** vidiš ime i telefon vežbača.

---

## Svakodnevne stvari

- **Prave teretane:** treneri ih sami dodaju (Profil → *Moje teretane nema na listi*, pa klik na mapu). Probne „Demo” teretane obriši ili preimenuj u Supabase → **Table Editor → gyms**.
- **Slika teretane:** u Table Editor → `gyms` upiši link slike u kolonu `image_url`.
- **Izmena koda:** svaka promena na GitHub-u automatski pravi novu verziju na Vercelu.
- **Lokacija:** mapa se otvara na Novom Sadu. Dugme „Teretane oko mene” traži dozvolu za lokaciju. Ako je korisnik odbije, ostaje Novi Sad.

## Struktura

```
supabase/schema.sql        baza: tabele, pravila privatnosti, funkcije za zakazivanje
app/page.js                mapa + lista teretana + treneri u teretani
app/trener/[id]/page.js    javni profil trenera + kalendar + rezervacija
app/prijava/page.js        prijava i registracija
app/moji-termini/page.js   termini vežbača, otkazivanje, ocene
app/panel/page.js          panel trenera (raspored, dodavanje termina, profil)
components/                mapa, delovi panela
lib/                       veza sa Supabase-om, formatiranje datuma i linkova
```

## Šta još nije urađeno (sledeći koraci)

- Obaveštenja (email/push) treneru kad neko zakaže, i klijentu kad trener otkaže.
- Pravilo do kada klijent sme da otkaže (npr. najkasnije 12h ranije).
- Politika privatnosti i uslovi korišćenja (čuvaju se imena i telefoni).
- Provera trenera pre objave (sada se trener sam objavljuje).
