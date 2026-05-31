/**
 * systems/saveSystem.js
 * Handles saving and loading game progress.
 * Supports Yandex PlayerData (cloud) with localStorage fallback.
 */

import { state } from "../state.js";
import { SAVE_KEY, OFFLINE_CAP_SEC, OFFLINE_FACTOR } from "../config.js";
import { finiteNumber, formatNumber } from "../utils.js";

/** External SDK references — set by main.js after SDK init. */
export let ysdk    = null;
export let yplayer = null;
export let useCloudSave = false;

export function setSdkRefs(sdk, player, cloudSave) {
  ysdk          = sdk;
  yplayer       = player;
  useCloudSave  = cloudSave;
}

// ── Save ──────────────────────────────────────────────────────────────────────

export function saveGame({ showToast } = {}) {
  const payload = {
    points:       state.points,
    totalPoints:  state.totalPoints,
    combo:        state.combo,
    comboClicks:  state.comboClicks,
    mutations:    state.mutations,
    sound:        state.sound,
    upgrades:     state.upgrades,
    pets:         state.pets,
    petLevels:    state.petLevels,
    activePetIds: state.activePetIds,
    shopPage:     state.shopPage,
    rebirths:     state.rebirths,
    savedAt:      Date.now(),
  };

  if (useCloudSave && yplayer) {
    yplayer.setData({ save: payload }, true)
      .then(() => console.log("[YaSDK] Облачное сохранение выполнено"))
      .catch(err => {
        console.warn("[YaSDK] Облачное сохранение не удалось, fallback:", err);
        _localSave(payload, showToast);
      });
  } else {
    _localSave(payload, showToast);
  }
}

function _localSave(payload, showToast) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  } catch {
    showToast?.("Сохранение не удалось");
  }
}

// ── Load ──────────────────────────────────────────────────────────────────────

/**
 * Loads game data and calls `onLoaded` when ready.
 * onLoaded receives no arguments; callers read from `state` directly.
 */
export function loadGame({ onLoaded, showToast, addPoints, normalizeUpgradeState, normalizePetState, recalculateStats }) {
  if (useCloudSave && yplayer) {
    yplayer.getData(["save"])
      .then(cloudData => {
        const data = cloudData?.save ?? null;
        if (data) {
          console.log("[YaSDK] Загружено из облака");
          _applyLoadedData(data, { showToast, addPoints, normalizeUpgradeState, normalizePetState, recalculateStats });
        } else {
          _loadFromLocalStorage({ showToast, addPoints, normalizeUpgradeState, normalizePetState, recalculateStats });
        }
        onLoaded();
      })
      .catch(err => {
        console.warn("[YaSDK] Не удалось загрузить облачное сохранение:", err);
        _loadFromLocalStorage({ showToast, addPoints, normalizeUpgradeState, normalizePetState, recalculateStats });
        onLoaded();
      });
  } else {
    _loadFromLocalStorage({ showToast, addPoints, normalizeUpgradeState, normalizePetState, recalculateStats });
    onLoaded();
  }
}

function _loadFromLocalStorage({ showToast, addPoints, normalizeUpgradeState, normalizePetState, recalculateStats }) {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    _applyLoadedData(JSON.parse(raw), { showToast, addPoints, normalizeUpgradeState, normalizePetState, recalculateStats });
    console.log("[Save] Загружено из localStorage");
  } catch {
    showToast?.("Сейв странный, но игра живёт дальше");
  }
}

function _applyLoadedData(data, { showToast, addPoints, normalizeUpgradeState, normalizePetState, recalculateStats }) {
  try {
    state.points       = finiteNumber(data.points, 0);
    state.totalPoints  = finiteNumber(data.totalPoints, state.points);
    state.combo        = finiteNumber(data.combo, 1);
    state.comboClicks  = finiteNumber(data.comboClicks, 0);
    state.mutations    = finiteNumber(data.mutations, 0);
    state.sound        = data.sound !== false;
    state.upgrades     = (data.upgrades && typeof data.upgrades === "object") ? data.upgrades : {};
    state.pets         = (data.pets    && typeof data.pets    === "object") ? data.pets : {};
    state.petLevels    = (data.petLevels && typeof data.petLevels === "object") ? data.petLevels : {};
    state.activePetIds = Array.isArray(data.activePetIds)
      ? data.activePetIds
      : (typeof data.activePetId === "string" && data.activePetId ? [data.activePetId] : []);
    state.shopPage     = data.shopPage === "eggs" ? "eggs" : "upgrades";
    state.rebirths     = Math.min(5, Math.max(0, Math.floor(finiteNumber(data.rebirths, 0))));

    const offlineSecs  = Math.min(OFFLINE_CAP_SEC, Math.max(0, (Date.now() - finiteNumber(data.savedAt, Date.now())) / 1000));
    normalizeUpgradeState();
    normalizePetState();
    recalculateStats();

    const offlineGain = state.income * offlineSecs * OFFLINE_FACTOR;
    if (offlineGain > 1) {
      addPoints(offlineGain);
      showToast?.("Оффлайн-награда: +" + formatNumber(offlineGain));
    }
  } catch {
    showToast?.("Сейв странный, но игра живёт дальше");
  }
}

// ── Ad state persistence (separate key) ───────────────────────────────────────
const AD_SAVE_KEY = "brainrotAdStateV1";

export function adSaveState(adState) {
  try {
    localStorage.setItem(AD_SAVE_KEY, JSON.stringify(adState));
  } catch {}
}

export function adLoadState() {
  try {
    const raw = localStorage.getItem(AD_SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
