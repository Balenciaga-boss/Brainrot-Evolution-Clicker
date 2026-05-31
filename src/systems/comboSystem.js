/**
 * systems/comboSystem.js
 * Manages the combo multiplier that builds up with rapid clicks.
 */

import { state } from "../state.js";
import { COMBO_WINDOW_MS } from "../config.js";

/**
 * Update combo state on each creature click.
 * @param {number} now   - Current timestamp (ms)
 * @param {number} step  - Combo step per click (from getComboStep)
 * @param {number} limit - Maximum combo value for current event
 */
export function updateCombo(now, step, limit) {
  if (now - state.lastClickAt < COMBO_WINDOW_MS) {
    state.comboClicks += 1;
  } else {
    state.comboClicks = 1;
    state.combo       = 1;
  }
  state.lastClickAt = now;
  state.combo       = Math.min(1 + state.comboClicks * step, limit);
}

/**
 * Apply passive combo build-up from pets (called each game tick).
 * @param {number} dt  - Delta time in seconds
 * @param {number} limit - Maximum combo value
 */
export function tickPassiveCombo(dt, limit) {
  if (!state.passiveCombo) return;
  state.combo = Math.min(state.combo + state.passiveCombo * dt, limit);
}
