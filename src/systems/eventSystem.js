

import { state } from "../state.js";
import { EVENTS, DEFAULT_COMBO_LIMIT } from "../data/events.js";

export function spawnRandomEvent(showToast, playSound, els) {

  if (Date.now() < state.eventUntil) return;

  if (Math.random() > 0.12) return;

  const event       = EVENTS[Math.floor(Math.random() * EVENTS.length)];
  state.eventUntil  = Date.now() + event.duration * 1000;
  state.eventType   = event.id;

  if (els?.eventBanner) {
    els.eventBanner.textContent = event.name;
    els.eventBanner.classList.remove("hidden");
    setTimeout(() => els.eventBanner?.classList.add("hidden"), event.duration * 1000);
  }

  showToast?.(event.toast);
  playSound?.("event");
}

export function getEventMultiplier(type) {
  if (Date.now() > state.eventUntil) {
    return type === "comboLimit" ? DEFAULT_COMBO_LIMIT : 1;
  }

  const event = EVENTS.find(e => e.id === state.eventType);
  if (!event) return type === "comboLimit" ? DEFAULT_COMBO_LIMIT : 1;

  if (type === "click")      return event.clickMult;
  if (type === "income")     return event.incomeMult;
  if (type === "comboLimit") return event.comboLimit;
  return 1;
}
