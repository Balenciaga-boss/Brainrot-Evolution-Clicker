# Architecture

## Overview

Brainrot Evolution Clicker is a static HTML5 game for Yandex Games. The browser loads **one script**: `src/main.js` (an IIFE). Source is split across `src/data/`, `src/systems/`, `src/ads/`, `src/ui/`, and `src/pets/` for readability; `npm run build` runs `scripts/stitch-main.mjs` to merge those slices plus `src/data/*` into `main.js`.

There is no webpack/Vite step in production—deploy the folder as-is.

---

## Runtime flow

```
index.html
  └── src/main.js (IIFE)
        ├── bootWithSdk() → YaGames.init() → init()
        ├── init() → cacheElements, bindEvents, loadGame()
        └── requestAnimationFrame(loop)
              ├── passive income, combo decay
              ├── adTickSecond, autoClickerTick, aiTick, inviteTick
              └── drawEffects (canvas)
```

---

## Data vs logic

| Layer | Location | Contents |
|-------|----------|----------|
| Content | `src/data/*.js` | `stages`, `upgrades`, `pets`, `eggs` |
| Tuning | `src/config.js` | Balance constants (inlined when stitching) |
| Logic slices | `src/systems/`, `src/ads/`, … | Functions that read `state` + data |
| Bundle | `src/main.js` | Full game (generated) |

---

## Click → points pipeline

```
handleCreatureClick
  → roll crit / jackpot / duplicate
  → cap damage vs getBossHpRemaining() × BALANCE_CLICK_BOSS_CHIP
  → addPoints → checkEvolution → updateUi / renderShop
```

`recalculateStats()` (in evolution slice) aggregates upgrades and active pets with `getPetPowerScale()` / `getUpgradePowerScale()` from current stage span.

---

## Save model

- Key: `brainrotEvolutionClickerSaveV1`
- Cloud: `yplayer.setData` when `useCloudSave`
- Fallback: `localStorage`
- Ad state: separate `brainrotAdStateV1`

---

## CSS map

| File | Responsibility |
|------|----------------|
| `base.css` | Variables, reset, canvas |
| `layout.css` | Shell grid, stats, panels |
| `creature.css` | Creature stages, bonus row |
| `shop.css` | Shop, eggs, pets |
| `animations.css` | Hatch, toasts, keyframes |
| `ads.css` | Ad UI, auto-clicker, rebirth row |
| `responsive.css` | All breakpoints |

---

## Future modularization

`src/state.js`, `src/utils.js`, and some `src/systems/*.js` files are structured as ES modules for a future `type="module"` entry without a bundler. Until then, treat them as reference and keep `main.js` in sync via `npm run build`.
