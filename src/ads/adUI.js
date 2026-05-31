/**
 * ads/adUI.js
 * All ad-related UI: buff popup, active buff badge, cooldown display,
 * ad simulator overlay injection, and the buff offer loop.
 */

import { state } from "../state.js";
import { AD_CONFIG, BUFF_TYPES } from "../config.js";
import { showRewardedAd, isAdRunning } from "./adManager.js";
import { adState, adCanWatchEgg, adCanWatchUpgrade } from "./rewardedAds.js";
import { adSaveState } from "../systems/saveSystem.js";

// ── Buff state ────────────────────────────────────────────────────────────────

export const buffState = {
  activeBuff:       null,    // { id, label, icon, expiresAt }
  buffOfferTimer:   0,
  pendingBuffOffer: null,
};

export function adBuffActive() {
  return buffState.activeBuff !== null && Date.now() < buffState.activeBuff.expiresAt;
}

export function adBuffTimeRemaining() {
  if (!buffState.activeBuff) return 0;
  return Math.max(0, Math.ceil((buffState.activeBuff.expiresAt - Date.now()) / 1000));
}

export function adResetBuffTimer() {
  const { offerIntervalMin: min, offerIntervalMax: max } = AD_CONFIG.buff;
  buffState.buffOfferTimer = min + Math.floor(Math.random() * (max - min + 1));
}

// ── Buff activation ───────────────────────────────────────────────────────────

export function adActivateBuff(buffId, { showToast, recalculateStats }) {
  const buff = BUFF_TYPES.find(b => b.id === buffId);
  if (!buff) return;

  const { durationMin: min, durationMax: max } = AD_CONFIG.buff;
  const dur = min + Math.floor(Math.random() * (max - min + 1));

  buffState.activeBuff      = { id: buffId, label: buff.label, icon: buff.icon, expiresAt: Date.now() + dur * 1000 };
  buffState.pendingBuffOffer = null;
  adHideBuffPopup();
  _applyBuffFields(buffId);
  recalculateStats();
  showToast(buff.icon + " " + buff.label + " активирован на " + dur + " сек!");
  adResetBuffTimer();
  adSaveState({ ...adState, activeBuff: buffState.activeBuff });

  setTimeout(() => {
    _clearBuffFields();
    buffState.activeBuff = null;
    recalculateStats();
    showToast("Рекламный бафф завершён");
    adRenderActiveBuff(_adEls.activeBuff);
    adSaveState({ ...adState });
  }, dur * 1000);
}

function _applyBuffFields(buffId) {
  _clearBuffFields();
  if (buffId === "income2x")   state._adBuffIncome  = 2;
  if (buffId === "petStats2x") state._adBuffPet     = 2;
  if (buffId === "upgrade2x")  state._adBuffUpgrade = 2;
  if (buffId === "passive2x")  state._adBuffPassive = 2;
}

function _clearBuffFields() {
  state._adBuffIncome  = 1;
  state._adBuffPet     = 1;
  state._adBuffUpgrade = 1;
  state._adBuffPassive = 1;
}

// ── Buff offer loop (called from main loop each second) ───────────────────────

let _adLastSecond = 0;

export function adTickSecond(deps) {
  const t = Math.floor(Date.now() / 1000);
  if (t === _adLastSecond) return;
  _adLastSecond = t;

  buffState.buffOfferTimer -= 1;
  if (adBuffActive()) adRenderActiveBuff(_adEls.activeBuff);

  if (buffState.buffOfferTimer <= 0 && !buffState.pendingBuffOffer && !adBuffActive()) {
    buffState.pendingBuffOffer = BUFF_TYPES[Math.floor(Math.random() * BUFF_TYPES.length)];
    adShowBuffPopup(buffState.pendingBuffOffer);
  }

  adUpdateCooldownDisplay();
}

// ── Buff request (from UI) ────────────────────────────────────────────────────

export function adRequestBuff(buffId, deps) {
  if (isAdRunning()) return;

  const watchBtn  = document.getElementById("adBuffWatch");
  const cancelBtn = document.getElementById("adBuffCancel");
  if (watchBtn)  watchBtn.disabled  = true;
  if (cancelBtn) cancelBtn.disabled = true;
  deps.showStackedToast("ad_loading", "Реклама загружается...");

  showRewardedAd(rewarded => {
    if (watchBtn)  watchBtn.disabled  = false;
    if (cancelBtn) cancelBtn.disabled = false;
    if (!rewarded) {
      deps.showStackedToast("ad_not_watched_buff", "Реклама не досмотрена — бафф не активирован");
      return;
    }
    adActivateBuff(buffId, deps);
  }, { showStackedToast: deps.showStackedToast });
}

// ── Buff popup UI ─────────────────────────────────────────────────────────────

let _adEls = {};

export function initAdUI(els) {
  _adEls = els;
}

export function adShowBuffPopup(buff) {
  const el = _adEls.buffPopup;
  if (!el) return;
  if (_adEls.buffIcon)  _adEls.buffIcon.textContent  = buff.icon;
  if (_adEls.buffLabel) _adEls.buffLabel.textContent  = buff.label;
  el.classList.remove("ad-hidden");
}

export function adHideBuffPopup() {
  _adEls.buffPopup?.classList.add("ad-hidden");
}

export function adRenderActiveBuff(el) {
  if (!el) return;
  const rem = adBuffTimeRemaining();
  if (!adBuffActive() || rem <= 0) { el.classList.add("ad-hidden"); return; }
  const b = buffState.activeBuff;
  el.classList.remove("ad-hidden");
  const label = el.querySelector(".ad-buff-label");
  const timer = el.querySelector(".ad-buff-timer");
  if (label) label.textContent = b.icon + " " + b.label;
  if (timer) timer.textContent = rem + "с";
}

export function adUpdateCooldownDisplay() {
  const eggBtns = document.querySelectorAll("[data-ad-egg]");
  eggBtns.forEach(btn => { btn.disabled = !adCanWatchEgg(); });

  const upgBtns = document.querySelectorAll("[data-ad-upgrade]");
  upgBtns.forEach(btn => { btn.disabled = !adCanWatchUpgrade(); });
}

export function adRenderStatus() {
  adRenderActiveBuff(_adEls.activeBuff);
  adUpdateCooldownDisplay();
}

// ── DOM injection ─────────────────────────────────────────────────────────────

export function adInitDom() {
  // Buff popup
  if (!document.getElementById("adBuffPopup")) {
    const popup = document.createElement("div");
    popup.id        = "adBuffPopup";
    popup.className = "ad-buff-popup ad-hidden";
    popup.innerHTML = [
      '<span class="ad-buff-icon" id="adBuffIcon">⚡</span>',
      '<span class="ad-buff-label" id="adBuffLabel">Бафф!</span>',
      '<button id="adBuffWatch"  type="button" class="ad-buff-watch-btn">Смотреть</button>',
      '<button id="adBuffCancel" type="button" class="ad-buff-cancel-btn">✕</button>',
    ].join("");
    document.body.appendChild(popup);

    document.getElementById("adBuffCancel").onclick = () => {
      buffState.pendingBuffOffer = null;
      adHideBuffPopup();
      adResetBuffTimer();
    };
  }

  // Active buff badge (inside shop header area)
  if (!document.getElementById("adActiveBuff")) {
    const badge = document.createElement("div");
    badge.id        = "adActiveBuff";
    badge.className = "ad-active-buff ad-hidden";
    badge.innerHTML = '<span class="ad-buff-label"></span><span class="ad-buff-timer"></span>';
    const shopHeader = document.querySelector(".shop-header");
    shopHeader?.appendChild(badge);
  }

  // Ad simulator overlay (dev-only)
  if (!document.getElementById("adSimOverlay")) {
    const sim = document.createElement("div");
    sim.id        = "adSimOverlay";
    sim.className = "ad-sim-overlay ad-hidden";
    sim.innerHTML = [
      '<div class="ad-sim-card">',
      '<p>📺 Симуляция рекламы</p>',
      '<div class="ad-sim-bar-wrap"><div class="ad-sim-bar" id="adSimBar"></div></div>',
      '<button id="adSimConfirm" type="button" class="ad-hidden">Награда получена ✓</button>',
      '<button id="adSimCancel"  type="button">Пропустить ✕</button>',
      '</div>',
    ].join("");
    document.body.appendChild(sim);
  }

  // Cache references
  _adEls = {
    buffPopup:  document.getElementById("adBuffPopup"),
    buffIcon:   document.getElementById("adBuffIcon"),
    buffLabel:  document.getElementById("adBuffLabel"),
    activeBuff: document.getElementById("adActiveBuff"),
    simOverlay: document.getElementById("adSimOverlay"),
    simBar:     document.getElementById("adSimBar"),
    simConfirm: document.getElementById("adSimConfirm"),
    simCancel:  document.getElementById("adSimCancel"),
  };

  // Wire watch button dynamically (buffId set at offer time)
  document.getElementById("adBuffWatch").onclick = () => {
    if (buffState.pendingBuffOffer) {
      adRequestBuff(buffState.pendingBuffOffer.id, window._adDeps);
    }
  };
}
