/**
 * ui/toastUI.js
 * Non-blocking toast notifications and the big-announcement banner.
 */

import { TOAST_DURATION_MS, BIG_ANNOUNCEMENT_MS } from "../config.js";

// ── Active toast deduplication ────────────────────────────────────────────────

const _activeToastKeys = new Set();

// ── Toast notifications ───────────────────────────────────────────────────────

/**
 * Show a brief toast notification.
 * @param {string} message
 * @param {string|null} dedupeKey  - If set, only one toast per key at a time.
 * @param {HTMLElement} stackEl    - The toast stack container element.
 */
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

  // Trigger CSS fade-in on next frame
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("visible")));

  setTimeout(() => {
    el.classList.remove("visible");
    el.addEventListener("transitionend", () => {
      el.remove();
      if (dedupeKey) _activeToastKeys.delete(dedupeKey);
    }, { once: true });
  }, TOAST_DURATION_MS);
}

/**
 * Convenience wrapper that mirrors the legacy showStackedToast(key, msg) signature.
 * @param {string} dedupeKey
 * @param {string} message
 * @param {HTMLElement} stackEl
 */
export function showStackedToast(dedupeKey, message, stackEl) {
  showToast(message, dedupeKey, stackEl);
}

// ── Big announcement banner ───────────────────────────────────────────────────

let _bigAnnouncementTimer = null;

/**
 * Show the large centered announcement banner briefly.
 * @param {string}      message
 * @param {HTMLElement} bannerEl
 */
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
