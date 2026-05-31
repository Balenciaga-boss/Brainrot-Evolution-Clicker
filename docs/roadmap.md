# Roadmap

## v1.0 — Current (Modular Refactor)
- [x] Split monolithic `game.js` (3 000+ lines) into 25 ES modules
- [x] Split `style.css` (4 800+ lines) into 7 focused stylesheets
- [x] All 30 evolution stages with unique creature appearances
- [x] 50+ pets across 12 egg tiers with drop tables
- [x] 40 upgrades across 4 phases
- [x] Combo, crit, jackpot, duplicate-click systems
- [x] Rebirth / prestige system (5 ranks)
- [x] Random timed events (storm, rain, combo-fiesta)
- [x] Canvas particle system + floating text
- [x] Procedural Web Audio (no sound files)
- [x] Yandex Games SDK: cloud save, rewarded ads, interstitials, review bonus
- [x] Offline income calculation (up to 6 h)
- [x] Auto-save every 10 s

## v1.1 — Quality of Life
- [ ] Achievement system UI (popup + achievement log panel)
- [ ] Settings panel (language toggle, reduced motion)
- [ ] Leaderboard integration via Yandex SDK
- [ ] Touch ripple effect on creature click
- [ ] "New!" badge on shop items the player can now afford

## v1.2 — Content
- [ ] Stage 31–40 (post-Omega extended path)
- [ ] 5 new egg tiers (tiers 13–17) with demonic-tier pets
- [ ] 3 new random event types
- [ ] Daily login bonus (calendar streak)

## v1.3 — Meta Progression
- [ ] Prestige currency ("NeuroShards") earned per rebirth
- [ ] NeuroShard shop: permanent passive bonuses that survive rebirths
- [ ] Unlock-able creature skins per stage tier

## v2.0 — Multiplayer Lite
- [ ] Yandex social: see friends' stages on a leaderboard
- [ ] Co-op click event: 60 s burst where both players' clicks count
- [ ] Send "meme power" gift to a friend once per day

## Tech Debt / Refactor
- [ ] Replace `innerHTML` shop renders with a minimal virtual-DOM diffing helper
- [ ] Add TypeScript JSDoc annotations for IDE support
- [ ] Unit tests for `evolutionSystem.recalculateStats` and `comboSystem`
- [ ] Bundle for production (esbuild / rollup) to reduce module waterfall
- [ ] Replace `confirm()` modal with a custom non-blocking modal component
