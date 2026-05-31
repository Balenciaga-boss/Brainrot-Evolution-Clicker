# Brainrot Evolution Clicker Audit Report

Date: 2026-05-30

## Bugs Found

### Daily/review bonus button caused layout shift
- Cause: `#reviewBonusBtn` lived in normal `.shop-footer` flow and used height/margin/padding collapse classes. When it appeared or disappeared, `#shopPageButton` moved.
- Fix: Made the bonus button an absolutely positioned overlay anchored to `.shop-footer`; the Eggs/Upgrades button now remains in fixed footer flow from first paint through all bonus states.

### Daily/review bonus was actually one-time
- Cause: `claimedForever` permanently hid the bonus after the first claim, while UI copy and cooldown code described a daily timer.
- Fix: Replaced permanent claim behavior with a daily reset model using `cooldownUntil` and `lastClaimDay`, with migration for legacy `claimedForever` saves.

### Bonus timer and saved state could desynchronize
- Cause: `sessionUsed` and `claimedForever` could block claims independently of `cooldownUntil`.
- Fix: Centralized normalization in `rbNormalizeState()`, clears expired cooldowns, clamps impossible future cooldowns, and derives availability from the current local day plus `cooldownUntil`.

### Local Yandex SDK runtime noise
- Cause: `index.html` loaded the Yandex SDK on localhost, causing SDK parent-frame messaging errors in local development.
- Fix: Load the Yandex SDK only on non-local hosts; local/dev runs use the existing graceful fallback.

### Tooling failed on repository JS files
- Cause: Several readable extract files in `src/` were syntactically incomplete, and ESLint had no flat config.
- Fix: Made extract files syntax-valid and added `eslint.config.js` so `npm run lint` can execute successfully.

## Performance Improvements

- Removed footer reflow from daily/review bonus visibility changes by taking the bonus button out of normal layout.
- Kept the button hidden/visible via opacity and transform only, avoiding expensive height and padding transitions.
- Preserved existing throttled UI rendering and delegated shop event handling.
- Kept local SDK fallback from loading unnecessary external SDK code during local development.

Expected impact: no footer layout recalculation when the bonus state changes, fewer local startup errors, and more stable perceived loading.

## Architecture Improvements

- Preserved the current production architecture: `src/main.js` remains the live bundled runtime, while `src/` subfolders remain readable module extracts.
- Added a project-level ESLint flat config so the current structure is toolable.
- Fixed extract-file syntax so future modularization work can proceed without broken JavaScript files blocking tooling.

Recommended next architecture step: promote the modular `src/systems`, `src/ui`, `src/data`, and `src/utils` files from readable extracts into the actual runtime, then replace the live bundle with a small module entrypoint.

## Security Improvements

- Added validation/normalization around bonus save timestamps.
- Migrated legacy permanent bonus saves into a bounded daily cooldown instead of trusting stale save shape forever.
- Limited impossible future cooldown values to the next daily reset.
- Kept existing numeric save coercion for core game state intact.

Remaining risk: localStorage is inherently editable by players. For a public release, server/cloud-side validation is needed for competitive features such as leaderboards.

## Code Quality Improvements

- Made daily bonus naming and behavior consistent.
- Reduced hidden coupling between bonus visibility and shop navigation layout.
- Made local development startup cleaner by avoiding unnecessary third-party SDK loading.
- Added lint configuration and fixed syntax issues in non-live JS files.

## Verification

- `node --check src/main.js`: passed.
- `node --check` across all `src/**/*.js`: passed.
- `npm.cmd run build`: passed.
- `npm.cmd run lint`: passed.
- Browser startup at `http://127.0.0.1:8080`: passed.
- Desktop layout check: `#shopPageButton` top remained `645.2px` before and after bonus claim.
- Mobile layout check at 390x844: shop footer and bonus overlay remained within viewport.

Screenshots:
- `docs/desktop-verification.png`
- `docs/mobile-verification.png`

## Remaining Recommendations

- Complete the modular architecture by making `src/main.js` import real modules instead of carrying the entire runtime bundle.
- Add a small test harness for save migration, daily reset, shop affordability, egg unlocks, and rebirth state.
- Add reduced-motion support for heavy animation phases.
- Add achievement UI or remove unused achievement data from public scope until implemented.
- Escape or DOM-build shop HTML before accepting any future user-generated names/content.
- Consider a cloud-backed checksum or server validation for leaderboard-relevant progress.
