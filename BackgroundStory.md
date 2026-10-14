Travel Replay — Your life, mapped.
Bayanginnya kayak:
Google Maps Timeline × Spotify Wrapped × Strava × Travel Journal
Jadi lu upload Google Maps Timeline / Location History JSON, terus web lu ngubah data yang tadinya boring banget jadi cinematic interactive timeline perjalanan hidup lu.
Core experience-nya
Misalnya satu hari data lu:
🏠 Depok → 💼 Kantor → ☕ Senopati → 🛍️ Central Park → 🏠 Depok

Di map bakal ada animated route:
1 → 2 → 3 → 4 → 5
Terus user bisa pencet Play dan map-nya literally replay perjalanan mereka.
Ada:
- animated route / moving trail
- auto pan & zoom
- timeline scrubber kayak video
- speed 1× / 2× / 5×
- pause / rewind
- marker per tempat
- durasi berada di tempat
- transportation/movement segment kalau datanya ada
Dan kemarin lu maunya default-nya bisa replay entire timeline, bukan cuma pilih satu tanggal.
Filter timeline
User bisa lihat:
Whole Timeline → Year → Month → Day → Trip
Contohnya:
2026
→ September
→ 21 September
→ Bandung Trip
Jadi terasa kayak exploring your own life history.
Bagian yang menurut gua bikin project ini keren banget: Story Mode
Web otomatis bikin chapter:
Morning
Started the day in Depok

Work
Spent 8h 12m at Rockstar Academy

Evening
Travelled 14.3 km to Senopati

Night
Visited Central Park before heading home

Terus dimainkan seperti little documentary.
Bisa jadi:
“September 2026”

dengan cinematic map animation.
Ada juga dashboard ala Spotify Wrapped
Contoh:
Your 2026 in motion
8,421 km travelled
17 cities visited
482 places visited
1,394 hours outside home  
Most visited:
1. Office
2. Central Park
3. Senopati
4. Plaza Senayan
5. Kota Kasablanka
Kemudian:
Most travelled route
Depok → South Jakarta
Most active month
August
Longest trip
Bandung — 186 km
dan sebagainya.
Geography Passport
Ini konsep yang kemarin juga menurut gua seru.
Kayak passport:
Indonesia
🇮🇩 West Java
Depok ✅
Bandung ✅
Bogor ✅
Bekasi ✅
Jakarta
South Jakarta ✅
Central Jakarta ✅
West Jakarta ✅
Bisa divisualisasikan province/city map yang gradually ke-unlock.
Jadi ada unsur gamification.
Heatmap
Ada layer:
“Where have I spent my life?”
Map berubah jadi heatmap.
Misalnya:
🔥 Depok
🔥🔥 TB Simatupang
🔥🔥🔥 Senopati / SCBD
🔥 Central Park
Semakin sering tempat dikunjungi → semakin intense.
Place detail
Klik suatu tempat misalnya:
Central Park Mall
Visited: 19×
First visit: 12 Jan 2024
Last visit: 28 Sep 2026
Total time: 61h 21m
Most common visit:
Saturday • 16:00–21:00
Terus ada:
View on Google Maps


========================================== PHASES
Phase 1 — Ingestion & Core Replay Engine:
Client-side parser for Google Takeout Semantic JSON.
Built-in realistic Demo Dataset.
Interactive map with moving trail, scrubber bar, play/pause, speed controls, and auto-following camera.

Phase 2 — Spotify Wrapped & Place Analytics:
Annual & monthly summary cards (Total km, places visited, top routes).
Clickable Place Detail modal with temporal distribution (e.g., "Most visited on Saturday 16:00–21:00").

Phase 3 — Story Mode & Geography Passport:
Auto-generated chaptered documentary playback.
Province and city unlocking checklist with interactive badges.
Lifetime heatmap toggle.

Phase 4 — Social Export:
Generate downloadable 9:16 story cards (PNG / Canvas video) for Instagram and TikTok sharing.
.