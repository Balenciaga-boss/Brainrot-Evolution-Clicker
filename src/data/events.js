/**
 * data/events.js
 * Definitions for random in-game events (storms, rains, etc.).
 * The eventSystem picks from this list and applies multipliers.
 */

export const EVENTS = [
  {
    id:       "storm",
    name:     "Мемный шторм!",
    duration: 20,          // seconds
    toast:    "⚡ Мемный шторм! Клики ×2 на 20 сек!",
    /** Returns a click multiplier when this event is active. */
    clickMult:  2,
    incomeMult: 1,
    comboLimit: 2.5,
  },
  {
    id:       "rain",
    name:     "Брейнрот-дождь!",
    duration: 25,
    toast:    "🌧 Брейнрот-дождь! Доход ×3 на 25 сек!",
    clickMult:  1,
    incomeMult: 3,
    comboLimit: 2.5,
  },
  {
    id:       "combo",
    name:     "Комбо-фиеста!",
    duration: 15,
    toast:    "🔥 Комбо-фиеста! Макс. комбо ×5 на 15 сек!",
    clickMult:  1,
    incomeMult: 1,
    comboLimit: 5,
  },
];

/** Default combo limit when no event is active. */
export const DEFAULT_COMBO_LIMIT = 2.5;
