

import { TOAST_DURATION_MS, BIG_ANNOUNCEMENT_MS } from "../config.js";

const _activeToastKeys = new Set();

export function showToast(message, dedupeKey, stackEl) {
  if (!stackEl) return;

  if (dedupeKey) {
    if (_activeToastKeys.has(dedupeKey)) return;
    _activeToastKeys.add(dedupeKey);
  }

  const el = document.createElement("div");
  el.className   = "toast";
  el.textContent = message;
  stackEl.appendChild(el);

  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("visible")));

  setTimeout(() => {
    el.classList.remove("visible");
    el.addEventListener("transitionend", () => {
      el.remove();
      if (dedupeKey) _activeToastKeys.delete(dedupeKey);
    }, { once: true });
  }, TOAST_DURATION_MS);
}

export function showStackedToast(dedupeKey, message, stackEl) {
  showToast(message, dedupeKey, stackEl);
}

let _bigAnnouncementTimer = null;

export function showBigAnnouncement(message, bannerEl) {
  if (!bannerEl) return;

  bannerEl.textContent = message;
  bannerEl.classList.remove("hidden");
  requestAnimationFrame(() => requestAnimationFrame(() => bannerEl.classList.add("visible")));

  clearTimeout(_bigAnnouncementTimer);
  _bigAnnouncementTimer = setTimeout(() => {
    bannerEl.classList.remove("visible");
    bannerEl.addEventListener("transitionend", () => bannerEl.classList.add("hidden"), { once: true });
  }, BIG_ANNOUNCEMENT_MS);
}
