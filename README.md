# Brainrot Evolution Clicker

> An HTML5 idle clicker for Yandex Games. Click the creature. Watch it evolve. Descend into memetic madness.

---

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:8080` in a browser.

You can also serve the folder with any static file server:

```bash
# Serve with any static file server — no build needed
npx serve .
# or
python3 -m http.server 8080
```

The Yandex SDK loads only on the Yandex Games platform; all features fall back gracefully in a local browser.

---

## Development Notes

- `index.html` loads `src/main.js`, the current live game bundle.
- The split files under `src/` document the intended module structure and are useful for navigation, but the published browser entry is still `src/main.js`.
- Run `npm run check` to verify the live bundle parses.
- Run `npm run lint` to lint the live bundle.
- No build step is required for deployment; upload the repository contents to any static host or GitHub Pages.

---

## Project Structure

```
Brainrot-Evolution-Clicker/
│
├── index.html            ← Shell HTML; links CSS + loads src/main.js
├── README.md
├── LICENSE
│
├── assets/
│   ├── images/           ← (future) sprite sheets, icons
│   ├── sounds/           ← (future) optional audio files
│   └── icons/            ← favicon, PWA icons
│
├── styles/               ← CSS split by concern
│   ├── base.css          ← variables, reset, body, canvas
│   ├── layout.css        ← game-shell grid, panels, stats
│   ├── creature.css      ← creature anatomy + 30 stage styles
│   ├── shop.css          ← shop items, eggs, pets
│   ├── animations.css    ← keyframes, hatch overlay, toasts
│   ├── ads.css           ← ad overlays, buff popup, review bonus
│   └── responsive.css    ← all @media queries
│
├── src/                  ← ES modules (no bundler required)
│   ├── main.js           ← entry point + game loop
│   ├── state.js          ← single source of truth
│   ├── config.js         ← all constants and tuning values
│   ├── utils.js          ← pure helper functions
│   │
│   ├── systems/          ← engine-level systems
│   │   ├── saveSystem.js
│   │   ├── evolutionSystem.js
│   │   ├── comboSystem.js
│   │   ├── eventSystem.js
│   │   ├── particleSystem.js
│   │   ├── rebirthSystem.js
│   │   └── audioSystem.js
│   │
│   ├── ads/              ← Yandex ad integration
│   │   ├── adManager.js
│   │   ├── rewardedAds.js
│   │   ├── reviewBonus.js
│   │   └── adUI.js
│   │
│   ├── pets/             ← pet & egg data + logic
│   │   ├── petsData.js
│   │   ├── petSystem.js
│   │   ├── eggsData.js
│   │   └── hatchAnimation.js
│   │
│   ├── ui/               ← DOM rendering
│   │   ├── renderUI.js
│   │   ├── shopUI.js
│   │   ├── toastUI.js
│   │   ├── modalUI.js
│   │   ├── creatureUI.js
│   │   └── effectsCanvas.js
│   │
│   └── data/             ← pure game data
│       ├── upgrades.js
│       ├── stages.js
│       ├── events.js
│       └── achievements.js
│
└── docs/
    ├── architecture.md   ← module graph, data flow, CSS map
    └── roadmap.md        ← feature roadmap + tech debt
```

---

## Game Systems

| System | Description |
|--------|-------------|
| **Click** | Base power × combo × crit/jackpot/event mults |
| **Combo** | Rapid clicks build the multiplier; passive combo from pets |
| **Evolution** | 30 stages unlocked by total points; each changes creature appearance |
| **Upgrades** | 40 upgrades across 4 phases; 4 special post-rebirth upgrades |
| **Pets** | 50+ pets hatched from 12 egg tiers; equip up to 3 simultaneously |
| **Events** | Random timed buffs (storm ×2 click, rain ×3 income, combo ×5) |
| **Rebirth** | 5 prestige ranks, each granting a permanent stat multiplier |
| **Ads** | Rewarded videos for free eggs & upgrades; buff offers; interstitials |

---

## Technology

- **Vanilla ES Modules** — zero dependencies, no build step
- **Web Audio API** — all sounds synthesized procedurally
- **Canvas 2D** — particles and floating text rendered each frame
- **Yandex Games SDK v2** — cloud save, ads, social features
- **localStorage** — fallback save for dev/browser

---

## License

MIT — see `LICENSE`.
