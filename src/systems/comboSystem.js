

import { state } from "../state.js";
import { COMBO_WINDOW_MS } from "../config.js";

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

export function tickPassiveCombo(dt, limit) {
  if (!state.passiveCombo) return;
  state.combo = Math.min(state.combo + state.passiveCombo * dt, limit);
}
