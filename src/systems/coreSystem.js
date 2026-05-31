// systems/coreSystem.js  (lines 3742-4007 of src/main.js)
// playSound, saveGame, loadGame, formatNumber.
// NOTE: This file is a readable extract. The live bundle is src/main.js.

/**
 * systems/coreSystem.js
 * playSound, saveGame, loadGame, formatNumber, finiteNumber.
 * Part of src/main.js — do not load standalone.
 */

  /* ── Toast registry for stacking ── */
  var _toastRegistry = {};

  /*
   * showToast(message)           — разовые уведомления (без стакинга)
   * showStackedToast(key, text)  — повторяющиеся уведомления (стакаются по key)
   *
   * key — уникальный идентификатор группы (например "jackpot", "crit", "event_storm")
   * При повторном вызове с тем же key счётчик увеличивается и таймер сбрасывается.
   */
  function showToast(message) {
    var toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    els.toastStack.appendChild(toast);
    setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 3000);
  }

  function showStackedToast(key, message) {
    var existing = _toastRegistry[key];
    if (existing && existing.el && existing.el.parentNode) {
      existing.count += 1;
      existing.el.textContent = message + " ×" + existing.count;
      clearTimeout(existing.timer);
      existing.timer = setTimeout(function () {
        if (existing.el.parentNode) existing.el.parentNode.removeChild(existing.el);
        delete _toastRegistry[key];
      }, 3000);
    } else {
      var toast = document.createElement("div");
      toast.className = "toast";
      toast.textContent = message;
      els.toastStack.appendChild(toast);
      var entry = { el: toast, count: 1, timer: null };
      entry.timer = setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
        delete _toastRegistry[key];
      }, 3000);
      _toastRegistry[key] = entry;
    }
  }

  function ensureAudio() {
    if (!state.sound || document.hidden || gamePaused || isAdRunning) return;
    var AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!audioContext || audioContext.state === "closed") {
      audioContext = new AudioCtx();
    }
    if (audioContext.state === "suspended") {
      try {
        audioContext.resume().catch(function () {});
      } catch (e) {}
    }
  }

  function registerAudioUnlockHandlers() {
    var unlock = function () {
      ensureAudio();
    };
    ["pointerdown", "touchstart", "click", "keydown"].forEach(function (eventName) {
      window.addEventListener(eventName, unlock, { passive: true });
    });
  }

  function resetAudioContext() {
    if (!audioContext) return;
    var ctx = audioContext;
    audioContext = null;
    if (ctx.state !== "closed") {
      try {
        ctx.close().catch(function () {});
      } catch (e) {}
    }
  }

  function playSound(type) {
    if (!state.sound || document.hidden || gamePaused || isAdRunning) return;
    ensureAudio();
    if (!audioContext) return;
    if (audioContext.state !== "running") return;

    var base = {
      click:   300,
      crit:    480,
      jackpot: 660,
      buy:     400,
      deny:    180,
      save:    540,
      evolve:  720,
      event:   560
    }[type] || 300;

    var duration = type === "jackpot" || type === "evolve" ? 0.32 : 0.18;
    var isHarsh  = type === "deny";

    var osc  = audioContext.createOscillator();
    var gain = audioContext.createGain();

    // Мягкий фильтр срезает резкие верхние частоты
    var filter = audioContext.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = isHarsh ? 900 : 2200;
    filter.Q.value = 0.7;

    // triangle — мягче всего; для deny — немного резче (sine)
    osc.type = isHarsh ? "sine" : "triangle";

    osc.frequency.setValueAtTime(base, audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(80, base * 0.62),
      audioContext.currentTime + duration
    );

    // Громкость снижена с 0.12 → 0.06; атака плавная 40мс вместо 15мс
    var peak = isHarsh ? 0.045 : 0.065;
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(peak, audioContext.currentTime + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioContext.destination);
    osc.start();
    osc.stop(audioContext.currentTime + duration + 0.04);
  }

  function saveGame() {
    var payload = {
      points: state.points,
      totalPoints: state.totalPoints,
      combo: state.combo,
      comboClicks: state.comboClicks,
      mutations: state.mutations,
      sound: state.sound,
      upgrades: state.upgrades,
      pets: state.pets,
      petLevels: state.petLevels,
      activePetIds: state.activePetIds,
      shopPage: state.shopPage,
      rebirths: state.rebirths,
      savedAt: now()
    };

    // ── Облачное сохранение через Yandex PlayerData ──
    if (useCloudSave && yplayer) {
      yplayer.setData({ save: payload }, true /* flush */)
        .then(function () {
          console.log("[YaSDK] Облачное сохранение выполнено");
        })
        .catch(function (err) {
          console.warn("[YaSDK] Облачное сохранение не удалось, пишем в localStorage:", err);
          _localSave(payload);
        });
    } else {
      _localSave(payload);
    }

    adSaveState();
  }

  function _localSave(payload) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    } catch (error) {
      showToast("Сохранение не удалось");
    }
  }

  function loadGame() {
    // ── Попытка загрузить из облака, потом fallback на localStorage ──
    if (useCloudSave && yplayer) {
      yplayer.getData(["save"])
        .then(function (cloudData) {
          var data = cloudData && cloudData.save ? cloudData.save : null;
          if (data) {
            console.log("[YaSDK] Загружено из облака");
            _applyLoadedData(data);
          } else {
            // Облако пустое — пробуем localStorage (первый запуск / миграция)
            _loadFromLocalStorage();
          }
          _postLoadSetup();
        })
        .catch(function (err) {
          console.warn("[YaSDK] Не удалось загрузить облачное сохранение:", err);
          _loadFromLocalStorage();
          _postLoadSetup();
        });
    } else {
      _loadFromLocalStorage();
      _postLoadSetup();
    }
  }

  function _loadFromLocalStorage() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      _applyLoadedData(JSON.parse(raw));
      console.log("[Save] Загружено из localStorage");
    } catch (error) {
      showToast("Сейв странный, но игра живёт дальше");
    }
  }

  function _applyLoadedData(data) {
    try {
      state.points       = finiteNumber(data.points, 0);
      state.totalPoints  = finiteNumber(data.totalPoints, state.points);
      state.combo        = finiteNumber(data.combo, 1);
      state.comboClicks  = finiteNumber(data.comboClicks, 0);
      state.mutations    = finiteNumber(data.mutations, 0);
      state.sound        = data.sound !== false;
      state.upgrades     = data.upgrades && typeof data.upgrades === "object" ? data.upgrades : {};
      state.pets         = data.pets && typeof data.pets === "object" ? data.pets : {};
      state.petLevels    = data.petLevels && typeof data.petLevels === "object" ? data.petLevels : {};
      state.activePetIds = Array.isArray(data.activePetIds)
        ? data.activePetIds
        : (typeof data.activePetId === "string" && data.activePetId ? [data.activePetId] : []);
      state.shopPage     = data.shopPage === "eggs" ? "eggs" : "upgrades";
      state.rebirths     = Math.min(5, Math.max(0, Math.floor(finiteNumber(data.rebirths, 0))));

      var offlineSeconds = Math.min(21600, Math.max(0, (now() - finiteNumber(data.savedAt, now())) / 1000));
      normalizeUpgradeState();
      normalizePetState();
      recalculateStats();
      var offlineGain = state.income * offlineSeconds * 0.45;
      if (offlineGain > 1) {
        addPoints(offlineGain);
        showToast("Оффлайн-награда: +" + formatNumber(offlineGain));
      }
    } catch (error) {
      showToast("Сейв странный, но игра живёт дальше");
    }
  }

  /* Вызывается после любой загрузки (облако или localStorage) */
  function _postLoadSetup() {
    normalizeUpgradeState();
    normalizePetState();
    recalculateStats();
    updateStage(true);
    renderShop();
    updateUi(true);
  }

  function normalizeUpgradeState() {
    upgrades.forEach(function (upgrade) {
      var raw = Math.max(0, Math.floor(finiteNumber(state.upgrades[upgrade.id], 0)));
      var maxLevel = upgrade.maxLevel || Infinity;
      state.upgrades[upgrade.id] = Math.min(raw, maxLevel);
    });
  }

  function normalizePetState() {
    var normalized = {};
    var normalizedLevels = {};
    pets.forEach(function (pet) {
      var count = Math.max(0, Math.floor(finiteNumber(state.pets[pet.id], 0)));
      if (count > 0) {
        normalized[pet.id] = count;
        var rawLevel = Math.max(1, Math.floor(finiteNumber(state.petLevels ? state.petLevels[pet.id] : 1, 1)));
        normalizedLevels[pet.id] = Math.min(rawLevel, getPetMaxLevel(pet));
      }
    });
    state.pets = normalized;
    state.petLevels = normalizedLevels;
    state.activePetIds = (Array.isArray(state.activePetIds) ? state.activePetIds : []).filter(function (id, index, list) {
      return state.pets[id] > 0 && list.indexOf(id) === index;
    }).slice(0, getMaxPetSlots());
  }

  function finiteNumber(value, fallback) {
    var number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function formatNumber(value) {
    var num = Number(value) || 0;
    if (num > 0 && num < 1) return num.toFixed(2).replace(".", ",");
    if (num >= 1 && num < 1000) return String(Math.floor(num));
    if (num <= 0) return "0";
    var units = ["тыс", "млн", "млрд", "трлн", "квдр", "квинт", "секст", "септ"];
    var index = -1;
    var short = Math.floor(num);
    while (short >= 1000 && index < units.length - 1) {
      short /= 1000;
      index += 1;
    }
    return short.toFixed(short >= 100 ? 0 : short >= 10 ? 1 : 2).replace(".", ",") + " " + units[index];
  }
