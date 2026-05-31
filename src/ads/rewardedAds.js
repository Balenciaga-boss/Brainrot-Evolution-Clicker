/**
 * ads/rewardedAds.js
 * Rewarded-ad flows for eggs and upgrades, including cooldown / quota logic.
 */

import { state } from "../state.js";
import { AD_CONFIG } from "../config.js";
import { showRewardedAd, isAdRunning } from "./adManager.js";
import { adSaveState } from "../systems/saveSystem.js";
import { eggs } from "../pets/eggsData.js";
import { upgrades } from "../data/upgrades.js";
import { isUpgradePhaseUnlocked } from "../systems/evolutionSystem.js";
import { formatNumber } from "../utils.js";

// ── Ad state ──────────────────────────────────────────────────────────────────

export let adState = {
  egg:     { used: 0, cooldownUntil: 0 },
  upgrade: { used: 0, cooldownUntil: 0 },
};

export function initAdState(saved) {
  if (!saved) return;
  if (saved.egg)     adState.egg     = { ...adState.egg,     ...saved.egg };
  if (saved.upgrade) adState.upgrade = { ...adState.upgrade, ...saved.upgrade };
}

// ── Cooldown helpers ──────────────────────────────────────────────────────────

export function adCanWatchEgg() {
  return Date.now() >= adState.egg.cooldownUntil && adState.egg.used < AD_CONFIG.egg.maxPerCycle;
}

export function adCanWatchUpgrade() {
  return Date.now() >= adState.upgrade.cooldownUntil && adState.upgrade.used < AD_CONFIG.upgrade.maxPerCycle;
}

// ── Reward grants ─────────────────────────────────────────────────────────────

export function adGrantEgg(eggId, { openEggFree, showStackedToast, playSound, adRenderStatus }) {
  adState.egg.used += 1;
  if (adState.egg.used >= AD_CONFIG.egg.maxPerCycle) {
    adState.egg.cooldownUntil = Date.now() + AD_CONFIG.egg.cooldownMs;
    adState.egg.used = 0;
    showStackedToast("ad_egg_limit", "Лимит яиц за рекламу исчерпан. Перезарядка!");
  }
  openEggFree(eggId);
  playSound("evolve");
  adSaveState(adState);
  adRenderStatus();
}

export function adGrantUpgrade(upgradeId, { showToast, recalculateStats, renderShop, updateUi, triggerShake, adRenderStatus, playSound }) {
  const upgrade = upgrades.find(u => u.id === upgradeId);
  if (!upgrade) return;

  if (!isUpgradePhaseUnlocked(upgrade)) {
    showToast("🔒 Фаза " + upgrade.phase + " ещё не открыта");
    return;
  }

  const level    = state.upgrades[upgradeId] || 0;
  const maxLevel = upgrade.maxLevel ?? Infinity;
  if (level >= maxLevel) {
    showToast("Максимальный уровень уже куплен: " + upgrade.name);
    return;
  }

  adState.upgrade.used += 1;
  if (adState.upgrade.used >= AD_CONFIG.upgrade.maxPerCycle) {
    adState.upgrade.cooldownUntil = Date.now() + AD_CONFIG.upgrade.cooldownMs;
    adState.upgrade.used = 0;
    showToast("Лимит улучшений за рекламу исчерпан. Перезарядка!", "ad_upg_limit");
  }

  state.upgrades[upgradeId] = level + 1;
  state.mutations += upgrade.multiplier || upgrade.combo || upgrade.crit || upgrade.jackpot ? 1 : 0;
  recalculateStats();
  renderShop();
  updateUi(true);
  triggerShake();
  showToast("🎁 Бесплатное улучшение: " + upgrade.name + " ур. " + state.upgrades[upgradeId]);
  adSaveState(adState);
  adRenderStatus();
}

// ── Request entry points (called from UI click handlers) ──────────────────────

export function adRequestEgg(eggId, deps) {
  if (!adCanWatchEgg()) {
    deps.showStackedToast("ad_egg_cd", "Реклама за яйцо недоступна — перезарядка");
    deps.playSound("deny");
    return;
  }
  const egg = eggs.find(e => e.id === eggId);
  if (!egg || !deps.isEggUnlocked(egg)) {
    deps.showStackedToast("egg_locked_ad_" + eggId, "Яйцо недоступно на этой стадии");
    deps.playSound("deny");
    return;
  }

  const adBtns = document.querySelectorAll("[data-ad-egg]");
  adBtns.forEach(b => b.disabled = true);
  deps.showStackedToast("ad_loading", "Реклама загружается...");

  showRewardedAd(rewarded => {
    adBtns.forEach(b => b.disabled = false);
    deps.adUpdateCooldownDisplay();
    if (!rewarded) {
      deps.showStackedToast("ad_not_watched_egg", "Реклама не досмотрена — яйцо не выдано");
      return;
    }
    adGrantEgg(eggId, deps);
  }, { showStackedToast: deps.showStackedToast });
}

export function adRequestUpgrade(upgradeId, deps) {
  if (!adCanWatchUpgrade()) {
    deps.showStackedToast("ad_upg_cd", "Реклама за улучшение недоступна — перезарядка");
    deps.playSound("deny");
    return;
  }

  const adBtns = document.querySelectorAll("[data-ad-upgrade]");
  adBtns.forEach(b => b.disabled = true);
  deps.showStackedToast("ad_loading", "Реклама загружается...");

  showRewardedAd(rewarded => {
    adBtns.forEach(b => b.disabled = false);
    deps.adUpdateCooldownDisplay();
    if (!rewarded) {
      deps.showStackedToast("ad_not_watched_upg", "Реклама не досмотрена — улучшение не выдано");
      return;
    }
    adGrantUpgrade(upgradeId, deps);
  }, { showStackedToast: deps.showStackedToast });
}
