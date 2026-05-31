(function () {
  "use strict";

  var SAVE_KEY = "brainrotEvolutionClickerSaveV1";
  var MAX_PARTICLES = 150;
  var MAX_FLOATING = 42;
  var now = Date.now;

  var BALANCE_PET_BASE = 0.42;
  var BALANCE_PET_SPAN_REF = 3000;
  var BALANCE_UPGRADE_SPAN_REF = 3000;
  var BALANCE_PET_AUTOCLICK_INCOME = 0.2;
  var BALANCE_CLICK_BOSS_CHIP = 0.26;
  var CRIT_DAMAGE_MULT = 4;
  var JACKPOT_DAMAGE_MULT = 24;
  var PET_JACKPOT_BOOST_MULT = 6;

  var state = {
    points: 0,
    totalPoints: 0,
    clickPower: 1,
    multiplier: 1,
    income: 0,
    combo: 1,
    comboClicks: 0,
    lastClickAt: 0,
    critChance: 0.05,
    jackpotChance: 0.01,
    mutations: 0,
    stage: 0,
    sound: true,
    eventUntil: 0,
    eventType: "",
    upgrades: {},
    shopPage: "upgrades",
    pets: {},
    petLevels: {},
    activePetIds: [],
    petComboBonus: 0,
    petBonusText: "нет",
    hatching: false,
    duplicateClickChance: 0,
    jackpotBoostChance: 0,
    passiveCombo: 0,
    petAttackTimer: 5,
    visualModState: 0,
    visualCharge: 0,
    visualParticleTimer: 0,
    _adBuffIncome: 1,
    _adBuffPet: 1,
    _adBuffUpgrade: 1,
    _adBuffPassive: 1,
    rebirths: 0,
    autoClickerUntil: 0
  };

  var AD_CONFIG = {
    egg:     { maxPerCycle: 10, cooldownMs: 7 * 60 * 1000 },
    upgrade: { maxPerCycle: 10, cooldownMs: 6 * 60 * 1000 },
    buff: {
      offerIntervalMin: 120,
      offerIntervalMax: 180,
      durationMin: 120,
      durationMax: 180
    }
  };

  var BUFF_TYPES = [
    { id: "income2x",   label: "x2 Доход в секунду",    icon: "⚡" },
    { id: "petStats2x", label: "x2 Сила питомцев",       icon: "🐾" },
    { id: "upgrade2x",  label: "x2 Эффект улучшений",    icon: "🔮" },
    { id: "passive2x",  label: "x2 Пассивный доход",     icon: "💰" }
  ];

  var adState = {
    egg:              { used: 0, cooldownUntil: 0 },
    upgrade:          { used: 0, cooldownUntil: 0 },
    activeBuff:       null,
    buffOfferTimer:   0,
    pendingBuffOffer: null
  };

  var adEls = {};

  var isAdRunning = false;

  var gamePaused = false;

  function pauseGameForAd() {
    gamePaused = true;

    if (audioContext && audioContext.state === "running") {
      try {
        audioContext.suspend().catch(function () {});
      } catch (e) {}
    }
  }

  function resumeGameAfterAd() {
    gamePaused = false;

    ensureAudio();
  }

  function showRewardedAd(callback) {

    if (isAdRunning) {
      showStackedToast("ad_loading", "Реклама уже запущена — подождите");
      return;
    }
    isAdRunning = true;

    var session = { rewardGranted: false, settled: false };

    function settle(rewarded) {
      if (session.settled) return;
      session.settled = true;
      isAdRunning = false;

      resumeGameAfterAd();
      callback(rewarded);
    }

    if (ysdk && ysdk.adv) {

      ysdk.adv.showRewardedVideo({
        callbacks: {
          onOpen: function () {

            pauseGameForAd();
            console.log("[YaSDK] Rewarded ad opened");
          },
          onRewarded: function () {

            session.rewardGranted = true;
          },
          onClose: function () {

            settle(session.rewardGranted);
          },
          onError: function (e) {
            console.error("[YaSDK] Rewarded ad error:", e);
            settle(false);
          }
        }
      });
    } else {

      pauseGameForAd();
      showAdSimOverlay(function (watched) { settle(watched); });
    }
  }

  function showAdSimOverlay(callback) {
    var overlay = adEls.simOverlay;
    if (!overlay) { callback(true); return; }

    var simSettled = false;
    function simSettle(result) {
      if (simSettled) return;
      simSettled = true;
      overlay.classList.add("ad-hidden");
      adEls.simCancel.disabled = false;
      callback(result);
    }

    overlay.classList.remove("ad-hidden");
    adEls.simConfirm.classList.add("ad-hidden");
    adEls.simBar.style.width = "0%";
    adEls.simCancel.disabled = false;
    var elapsed = 0;
    var tick = setInterval(function () {
      elapsed += 0.1;
      adEls.simBar.style.width = Math.min(100, (elapsed / 5) * 100) + "%";
      if (elapsed >= 5) {
        clearInterval(tick);
        adEls.simConfirm.classList.remove("ad-hidden");
        adEls.simCancel.disabled = true;
      }
    }, 100);

    adEls.simCancel.onclick = function () {
      clearInterval(tick);
      simSettle(false);
    };
    adEls.simConfirm.onclick = function () {
      clearInterval(tick);
      simSettle(true);
    };
  }

  function adCanWatchEgg() {
    return Date.now() >= adState.egg.cooldownUntil && adState.egg.used < AD_CONFIG.egg.maxPerCycle;
  }
  function adCanWatchUpgrade() {
    return Date.now() >= adState.upgrade.cooldownUntil && adState.upgrade.used < AD_CONFIG.upgrade.maxPerCycle;
  }

  function adGrantReward(type, payload) {
    if (type === "egg") {
      adState.egg.used += 1;
      if (adState.egg.used >= AD_CONFIG.egg.maxPerCycle) {
        adState.egg.cooldownUntil = Date.now() + AD_CONFIG.egg.cooldownMs;
        adState.egg.used = 0;
        showStackedToast("ad_egg_limit", "Лимит яиц за рекламу исчерпан. Перезарядка!");
      }
      adOpenEggFree(payload.eggId);
      playSound("evolve");
      adSaveState();
      adRenderStatus();
      return;
    }
    if (type === "upgrade") {
      adState.upgrade.used += 1;
      if (adState.upgrade.used >= AD_CONFIG.upgrade.maxPerCycle) {
        adState.upgrade.cooldownUntil = Date.now() + AD_CONFIG.upgrade.cooldownMs;
        adState.upgrade.used = 0;
        showStackedToast("ad_upg_limit", "Лимит улучшений за рекламу исчерпан. Перезарядка!");
      }
      adApplyUpgradeFree(payload.upgradeId);
      playSound("buy");
      adSaveState();
      adRenderStatus();
      return;
    }
    if (type === "buff") {
      adActivateBuff(payload.buffId);
      adState.pendingBuffOffer = null;
      adHideBuffPopup();
      adSaveState();
      adRenderStatus();
      return;
    }
  }

  function adOpenEggFree(eggId) {
    var egg = eggs.find(function (e) { return e.id === eggId; });
    if (!egg || state.hatching) return;
    if (!isEggUnlocked(egg)) { showStackedToast("egg_locked_free_" + eggId, "Яйцо недоступно на этой стадии"); return; }
    state.hatching = true;
    updateUi(true);
    updateShopAffordability();
    var pet = rollEggPet(egg);
    startHatchAnimation(egg, pet);
    showToast("🎁 Бесплатное яйцо за рекламу: " + egg.name);
  }

  function adApplyUpgradeFree(upgradeId) {
    var upgrade = upgrades.find(function (u) { return u.id === upgradeId; });
    if (!upgrade) return;
    if (!isUpgradePhaseUnlocked(upgrade)) {
      showToast("🔒 Фаза " + upgrade.phase + " ещё не открыта");
      return;
    }
    var level = state.upgrades[upgradeId] || 0;
    var maxLevel = upgrade.maxLevel || Infinity;
    if (level >= maxLevel) {
      showToast("Максимальный уровень уже куплен: " + upgrade.name);
      return;
    }
    state.upgrades[upgradeId] = level + 1;
    state.mutations += upgrade.multiplier || upgrade.combo || upgrade.crit || upgrade.jackpot ? 1 : 0;
    recalculateStats();
    renderShop();
    updateUi(true);
    triggerShake();
    showToast("🎁 Бесплатное улучшение: " + upgrade.name + " ур. " + state.upgrades[upgradeId]);
  }

  function adActivateBuff(buffId) {
    var buff = BUFF_TYPES.find(function (b) { return b.id === buffId; });
    if (!buff) return;
    var dur = AD_CONFIG.buff.durationMin + Math.floor(Math.random() * (AD_CONFIG.buff.durationMax - AD_CONFIG.buff.durationMin + 1));
    adState.activeBuff = { id: buffId, label: buff.label, icon: buff.icon, expiresAt: Date.now() + dur * 1000 };
    adClearBuffFields();
    if (buffId === "income2x")   state._adBuffIncome  = 2;
    if (buffId === "petStats2x") state._adBuffPet     = 2;
    if (buffId === "upgrade2x")  state._adBuffUpgrade = 2;
    if (buffId === "passive2x")  state._adBuffPassive = 2;
    recalculateStats();
    showToast(buff.icon + " " + buff.label + " активирован на " + dur + " сек!");
    adResetBuffTimer();
    setTimeout(function () {
      adClearBuffFields();
      adState.activeBuff = null;
      recalculateStats();
      showToast("Рекламный бафф завершён");
      adRenderActiveBuff();
      adSaveState();
    }, dur * 1000);
  }

  function adClearBuffFields() {
    state._adBuffIncome  = 1;
    state._adBuffPet     = 1;
    state._adBuffUpgrade = 1;
    state._adBuffPassive = 1;
  }

  function adBuffActive() {
    return adState.activeBuff !== null && Date.now() < adState.activeBuff.expiresAt;
  }

  function adBuffTimeRemaining() {
    if (!adState.activeBuff) return 0;
    return Math.max(0, Math.ceil((adState.activeBuff.expiresAt - Date.now()) / 1000));
  }

  var _adLastSecond = 0;
  function adTickSecond() {
    var t = Math.floor(Date.now() / 1000);
    if (t === _adLastSecond) return;
    _adLastSecond = t;
    adState.buffOfferTimer -= 1;
    if (adBuffActive()) adRenderActiveBuff();
    if (adState.buffOfferTimer <= 0 && !adState.pendingBuffOffer && !adBuffActive()) {
      adState.pendingBuffOffer = BUFF_TYPES[Math.floor(Math.random() * BUFF_TYPES.length)];
      adShowBuffPopup(adState.pendingBuffOffer);
    }
    adUpdateCooldownDisplay();
  }

  function adResetBuffTimer() {
    adState.buffOfferTimer = AD_CONFIG.buff.offerIntervalMin +
      Math.floor(Math.random() * (AD_CONFIG.buff.offerIntervalMax - AD_CONFIG.buff.offerIntervalMin + 1));
  }

  function adRequestEgg(eggId) {
    if (!adCanWatchEgg()) { showStackedToast("ad_egg_cd", "Реклама за яйцо недоступна — перезарядка"); playSound("deny"); return; }
    var egg = eggs.find(function (e) { return e.id === eggId; });
    if (!egg || !isEggUnlocked(egg)) { showStackedToast("egg_locked_ad_" + eggId, "Яйцо недоступно на этой стадии"); playSound("deny"); return; }

    var adBtns = document.querySelectorAll("[data-ad-egg]");
    adBtns.forEach(function (b) { b.disabled = true; });
    showStackedToast("ad_loading", "Реклама загружается...");
    showRewardedAd(function (rewarded) {

      adBtns.forEach(function (b) { b.disabled = false; });
      adUpdateCooldownDisplay();
      if (!rewarded) { showStackedToast("ad_not_watched_egg", "Реклама не досмотрена — яйцо не выдано"); return; }
      adGrantReward("egg", { eggId: eggId });
    });
  }

  function adRequestUpgrade(upgradeId) {
    if (!adCanWatchUpgrade()) { showStackedToast("ad_upg_cd", "Реклама за улучшение недоступна — перезарядка"); playSound("deny"); return; }
    var upgrade = upgrades.find(function (u) { return u.id === upgradeId; });
    if (!upgrade) { showToast("Улучшение не найдено"); return; }

    var adBtns = document.querySelectorAll("[data-ad-upgrade]");
    adBtns.forEach(function (b) { b.disabled = true; });
    showStackedToast("ad_loading", "Реклама загружается...");
    showRewardedAd(function (rewarded) {
      adBtns.forEach(function (b) { b.disabled = false; });
      adUpdateCooldownDisplay();
      if (!rewarded) { showStackedToast("ad_not_watched_upg", "Реклама не досмотрена — улучшение не выдано"); return; }
      adGrantReward("upgrade", { upgradeId: upgradeId });
    });
  }

  function adRequestBuff(buffId) {
    if (isAdRunning) return;
    var watchBtn = document.getElementById("adBuffWatch");
    var cancelBtn = document.getElementById("adBuffCancel");
    if (watchBtn) watchBtn.disabled = true;
    if (cancelBtn) cancelBtn.disabled = true;
    showStackedToast("ad_loading", "Реклама загружается...");
    showRewardedAd(function (rewarded) {
      if (watchBtn) watchBtn.disabled = false;
      if (cancelBtn) cancelBtn.disabled = false;
      if (!rewarded) { showStackedToast("ad_not_watched_buff", "Реклама не досмотрена — бафф не активирован"); return; }
      adGrantReward("buff", { buffId: buffId });
    });
  }

  function adShowBuffPopup(buff) {
    var el = adEls.buffPopup;
    if (!el) return;
    adEls.buffIcon.textContent  = buff.icon;
    adEls.buffLabel.textContent = buff.label;
    el.classList.remove("ad-hidden");
  }

  function adHideBuffPopup() {
    if (adEls.buffPopup) adEls.buffPopup.classList.add("ad-hidden");
  }

  function adRenderActiveBuff() {
    var el = adEls.activeBuff;
    if (!el) return;
    var rem = adBuffTimeRemaining();
    if (!adBuffActive() || rem <= 0) { el.classList.add("ad-hidden"); return; }
    var b = adState.activeBuff;
    var mm = String(Math.floor(rem / 60)).padStart(2, "0");
    var ss = String(rem % 60).padStart(2, "0");
    adEls.activeBuffText.textContent = b.icon + " " + b.label + " · " + mm + ":" + ss;
    el.classList.remove("ad-hidden");
  }

  function adUpdateCooldownDisplay() {
    adUpdateOneCounter("adEggCounter", "adEggCooldown", adState.egg, AD_CONFIG.egg);
    adUpdateOneCounter("adUpgradeCounter", "adUpgradeCooldown", adState.upgrade, AD_CONFIG.upgrade);
  }

  function adUpdateOneCounter(counterId, cooldownId, typeState, cfg) {
    var cEl = document.getElementById(counterId);
    var dEl = document.getElementById(cooldownId);
    if (!cEl) return;
    var rem = Math.max(0, typeState.cooldownUntil - Date.now());
    if (rem > 0) {
      cEl.textContent = "Доступно 0/" + cfg.maxPerCycle;
      if (dEl) {
        var mm = String(Math.floor(rem / 60000)).padStart(2, "0");
        var ss = String(Math.floor((rem % 60000) / 1000)).padStart(2, "0");
        dEl.textContent = "Перезарядка: " + mm + ":" + ss;
        dEl.classList.remove("ad-hidden");
      }
    } else {
      cEl.textContent = "Доступно " + (cfg.maxPerCycle - typeState.used) + "/" + cfg.maxPerCycle;
      if (dEl) { dEl.textContent = ""; dEl.classList.add("ad-hidden"); }
    }
  }

  function adRenderStatus() {
    adUpdateCooldownDisplay();
    adRenderActiveBuff();
  }

  var AD_SAVE_KEY = "brainrotAdStateV1";

  function adSaveState() {
    try { localStorage.setItem(AD_SAVE_KEY, JSON.stringify({ egg: adState.egg, upgrade: adState.upgrade, activeBuff: adState.activeBuff })); } catch (e) {}
  }

  function adLoadState() {
    try {
      var raw = localStorage.getItem(AD_SAVE_KEY);
      if (!raw) return;
      var d = JSON.parse(raw);
      if (d.egg)     Object.assign(adState.egg,     d.egg);
      if (d.upgrade) Object.assign(adState.upgrade, d.upgrade);
      if (d.activeBuff && Date.now() < d.activeBuff.expiresAt) {
        adState.activeBuff = d.activeBuff;

        var bid = d.activeBuff.id;
        if (bid === "income2x")   state._adBuffIncome  = 2;
        if (bid === "petStats2x") state._adBuffPet     = 2;
        if (bid === "upgrade2x")  state._adBuffUpgrade = 2;
        if (bid === "passive2x")  state._adBuffPassive = 2;

        var msLeft = d.activeBuff.expiresAt - Date.now();
        setTimeout(function () {
          adClearBuffFields();
          adState.activeBuff = null;
          recalculateStats();
          showToast("Рекламный бафф завершён");
          adRenderActiveBuff();
          adSaveState();
        }, msLeft);
      }
    } catch (e) {}
  }

  function adGetUpgradeAdBtn(upgradeId) {
    var can = adCanWatchUpgrade();

    return '<button class="upgrade-ad-btn" type="button" data-ad-upgrade="' + upgradeId + '"' + (can ? '' : ' disabled') + '>📺 Реклама → бесплатный уровень</button>';
  }

  function adGetEggAdSection(egg) {
    if (!isEggUnlocked(egg)) return "";
    var can = adCanWatchEgg();
    return [
      '<div class="egg-ad-section">',
      '<button class="egg-ad-btn" type="button" data-ad-egg="' + egg.id + '"' + (can ? '' : ' disabled') + '>',
      '<span>📺 Реклама → бесплатное яйцо</span>',
      '<span id="adEggCounter_' + egg.id + '" class="egg-ad-counter">Доступно ' + (AD_CONFIG.egg.maxPerCycle - adState.egg.used) + '/' + AD_CONFIG.egg.maxPerCycle + '</span>',
      '</button>',
      '<span id="adEggCooldown_' + egg.id + '" class="egg-ad-cooldown' + (can ? ' ad-hidden' : '') + '"></span>',
      '</div>'
    ].join("");
  }

  function adInitDom() {

    var adHtml = [

      '<div id="adBuffPopup" class="ad-hidden" role="dialog" aria-label="Рекламное предложение">',
        '<div class="ad-popup-header"><span>📺</span><span>Специальное предложение</span></div>',
        '<span id="adBuffIcon" class="ad-popup-icon">⚡</span>',
        '<span id="adBuffLabel" class="ad-popup-label">x2 Доход в секунду</span>',
        '<span class="ad-popup-sublabel">Досмотрите рекламу до конца</span>',
        '<div class="ad-popup-buttons">',
          '<button id="adBuffWatch" class="ad-watch-btn" type="button">📺 Смотреть рекламу</button>',
          '<button id="adBuffCancel" class="ad-cancel-btn" type="button">Отмена</button>',
        '</div>',
      '</div>',

      '<div id="adActiveBuff" class="ad-hidden" aria-live="polite">',
        '<span id="adActiveBuffText"></span>',
      '</div>',

      '<div id="adSimOverlay" class="ad-hidden" role="dialog" aria-modal="true">',
        '<div class="ad-sim-card">',
          '<span class="ad-sim-title">Просмотр рекламы</span>',
          '<div class="ad-sim-screen">',
            '<span class="ad-sim-logo">📺</span>',
            '<span class="ad-sim-tagline">Здесь будет реклама Яндекс Игр</span>',
          '</div>',
          '<div class="ad-sim-progress-wrap">',
            '<span class="ad-sim-progress-label">Досмотрите до конца для получения награды</span>',
            '<div class="ad-sim-progress-bg"><div id="adSimBar"></div></div>',
          '</div>',
          '<div class="ad-sim-actions">',
            '<button id="adSimCancel" type="button">Пропустить</button>',
            '<button id="adSimConfirm" type="button" class="ad-hidden">Получить награду ✓</button>',
          '</div>',
        '</div>',
      '</div>'
    ].join("");

    var wrapper = document.createElement("div");
    wrapper.innerHTML = adHtml;
    document.body.appendChild(wrapper);

    adEls.buffPopup     = document.getElementById("adBuffPopup");
    adEls.buffIcon      = document.getElementById("adBuffIcon");
    adEls.buffLabel     = document.getElementById("adBuffLabel");
    adEls.activeBuff    = document.getElementById("adActiveBuff");
    adEls.activeBuffText= document.getElementById("adActiveBuffText");
    adEls.simOverlay    = document.getElementById("adSimOverlay");
    adEls.simBar        = document.getElementById("adSimBar");
    adEls.simCancel     = document.getElementById("adSimCancel");
    adEls.simConfirm    = document.getElementById("adSimConfirm");

    if (adEls.activeBuff && adEls.activeBuff.parentNode !== document.body) {
      document.body.appendChild(adEls.activeBuff);
    }
    if (adEls.activeBuff) {
      adEls.activeBuff.style.transform = "translateZ(0)";
      adEls.activeBuff.style.willChange = "transform";
    }

    document.getElementById("adBuffWatch").addEventListener("click", function () {
      if (!adState.pendingBuffOffer) return;
      adRequestBuff(adState.pendingBuffOffer.id);
    });
    document.getElementById("adBuffCancel").addEventListener("click", function () {
      adState.pendingBuffOffer = null;
      adHideBuffPopup();
      adResetBuffTimer();
    });
  }

  var REVIEW_BONUS_SAVE_KEY = "brainrotReviewBonusV1";

  var reviewBonus = {
    sessionUsed:   false,
    cooldownUntil: 0,
    lastClaimDay:  ""
  };

  function rbTodayKey(date) {
    var d = date || new Date();
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0")
    ].join("-");
  }

  function rbNextDailyReset(nowMs) {
    var d = new Date(nowMs || Date.now());
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0).getTime();
  }

  function rbNormalizeState() {
    var current = Date.now();
    reviewBonus.cooldownUntil = Math.max(0, finiteNumber(reviewBonus.cooldownUntil, 0));

    if (reviewBonus.cooldownUntil > current + 48 * 60 * 60 * 1000) {
      reviewBonus.cooldownUntil = rbNextDailyReset(current);
    }

    if (current >= reviewBonus.cooldownUntil) {
      reviewBonus.cooldownUntil = 0;
      reviewBonus.sessionUsed = false;
      if (reviewBonus.lastClaimDay !== rbTodayKey()) reviewBonus.lastClaimDay = "";
    }
  }

  function rbLoad() {
    try {
      var raw = localStorage.getItem(REVIEW_BONUS_SAVE_KEY);
      if (!raw) return;
      var d = JSON.parse(raw);
      reviewBonus.cooldownUntil = finiteNumber(d.cooldownUntil, 0);
      reviewBonus.lastClaimDay = typeof d.lastClaimDay === "string" ? d.lastClaimDay : "";

      if (d.claimedForever === true && reviewBonus.cooldownUntil <= Date.now()) {
        reviewBonus.cooldownUntil = rbNextDailyReset(Date.now());
        reviewBonus.lastClaimDay = rbTodayKey();
      }
      reviewBonus.sessionUsed = reviewBonus.lastClaimDay === rbTodayKey() && Date.now() < reviewBonus.cooldownUntil;
      rbNormalizeState();
    } catch (e) {}
  }

  function rbSave() {
    try {
      localStorage.setItem(REVIEW_BONUS_SAVE_KEY, JSON.stringify({
        cooldownUntil: reviewBonus.cooldownUntil,
        lastClaimDay:  reviewBonus.lastClaimDay
      }));
    } catch (e) {}
  }

  function rbCanClaim() {
    rbNormalizeState();
    if (Date.now() < reviewBonus.cooldownUntil) return false;
    if (reviewBonus.lastClaimDay === rbTodayKey()) return false;
    return true;
  }

  function rbCooldownSeconds() {
    return Math.max(0, Math.ceil((reviewBonus.cooldownUntil - Date.now()) / 1000));
  }

  function rbRewardAmount() {
    return Math.max(1000, Math.floor(state.income * 60 * 0.10));
  }

  function rbInjectUI() {

    var btnEl = document.getElementById("reviewBonusBtn");
    if (btnEl && !btnEl.dataset.rbWired) {
      btnEl.dataset.rbWired = "1";
      btnEl.addEventListener("click", rbHandleClick);
    }

    if (!document.getElementById("rbCooldownBadge")) {
      var topPanel = document.querySelector(".top-panel");
      var soundBtn = document.getElementById("soundButton");
      if (topPanel && soundBtn) {
        var timerEl = document.createElement("div");
        timerEl.id        = "rbCooldownBadge";
        timerEl.className = "rb-cooldown-badge rb-badge-hidden";
        timerEl.setAttribute("aria-live", "polite");
        timerEl.setAttribute("title", "Ежедневный бонус — следующий через:");
        timerEl.innerHTML = '<span class="rb-badge-icon">⭐</span><span id="rbCooldownText">24:00:00</span>';

        topPanel.insertBefore(timerEl, soundBtn);
      }
    }

    if (!document.getElementById("rbThanksScreen")) {
      var thanksEl = document.createElement("div");
      thanksEl.id        = "rbThanksScreen";
      thanksEl.className = "rb-thanks-screen rb-hidden";
      thanksEl.setAttribute("aria-live", "assertive");
      thanksEl.innerHTML = [
        '<div class="rb-thanks-card">',
          '<div class="rb-thanks-icon">❤️</div>',
          '<p class="rb-thanks-title">Спасибо за поддержку!</p>',
          '<p class="rb-thanks-sub">Подготавливаем ваш бонус…</p>',
          '<div class="rb-thanks-dots"><span></span><span></span><span></span></div>',
        '</div>'
      ].join("");
      document.body.appendChild(thanksEl);
    }

    if (!document.getElementById("rbRewardScreen")) {
      var rewardEl = document.createElement("div");
      rewardEl.id        = "rbRewardScreen";
      rewardEl.className = "rb-reward-screen rb-hidden";
      rewardEl.setAttribute("aria-live", "assertive");
      rewardEl.innerHTML = [
        '<div class="rb-reward-card">',
          '<div class="rb-reward-icon">🎁</div>',
          '<p class="rb-reward-title">Награда получена!</p>',
          '<p class="rb-reward-amount" id="rbRewardAmount">+0 очков</p>',
          '<p class="rb-reward-sub">Приятной игры! Следующий бонус доступен через 24 ч.</p>',
          '<button class="rb-reward-close" id="rbRewardClose" type="button">Отлично!</button>',
        '</div>'
      ].join("");
      document.body.appendChild(rewardEl);
      document.getElementById("rbRewardClose").addEventListener("click", rbCloseRewardScreen);
    }

    if (btnEl) btnEl.classList.add("rb-no-transition");
    rbUpdateButton();
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var btn2 = document.getElementById("reviewBonusBtn");
        if (btn2) btn2.classList.remove("rb-no-transition");
      });
    });
  }

  function rbUpdateButton() {
    var btn      = document.getElementById("reviewBonusBtn");
    var badge    = document.getElementById("rbCooldownBadge");
    var badgeText = document.getElementById("rbCooldownText");

    rbNormalizeState();

    if (!rbCanClaim()) {

      if (btn && !btn.classList.contains("rb-btn-fading") && !btn.classList.contains("rb-btn-gone")) {
        btn.classList.add("rb-btn-fading");
        setTimeout(function () {
          if (btn) btn.classList.add("rb-btn-gone");
        }, 500);
      }

      var sec = rbCooldownSeconds();
      if (badgeText) {
        if (sec > 0) {
          var h = Math.floor(sec / 3600);
          var m = Math.floor((sec % 3600) / 60);
          var s = sec % 60;
          badgeText.textContent =
            String(h).padStart(2, "0") + ":" +
            String(m).padStart(2, "0") + ":" +
            String(s).padStart(2, "0");
        } else {
          badgeText.textContent = "скоро";
        }
      }

      if (badge && badge.classList.contains("rb-badge-hidden")) {
        badge.classList.remove("rb-badge-hidden");
        requestAnimationFrame(function () {
          badge.classList.add("rb-badge-visible");
        });
      }

    } else {

      if (btn) {
        btn.classList.remove("rb-btn-fading", "rb-btn-gone");
        btn.disabled = false;
        btn.querySelector(".rb-btn-text").textContent = "Бонус за отзыв";
      }

      if (badge && !badge.classList.contains("rb-badge-hidden")) {
        badge.classList.remove("rb-badge-visible");
        setTimeout(function () {
          badge.classList.add("rb-badge-hidden");
        }, 320);
      }
    }
  }

  function rbHandleClick() {
    if (!rbCanClaim()) {
      showStackedToast("rb_cooldown", "Дневной бонус уже получен — следующий будет доступен после сброса таймера.");
      playSound("deny");
      return;
    }
    if (isAdRunning) {
      showStackedToast("rb_ad_wait", "Дождитесь завершения текущей рекламы");
      return;
    }

    rbRequestReview();
  }

  function rbRequestReview() {
    if (ysdk && ysdk.feedback) {

      ysdk.feedback.canReview()
        .then(function (result) {
          if (result.value) {

            showToast("Оставленный отзыв помогает улучшить игру ❤️");
            return ysdk.feedback.requestReview();
          } else {

            console.log("[RB] canReview false:", result.reason);
            return Promise.resolve({ feedbackSent: false });
          }
        })
        .then(function () {

          rbShowThanksScreen();
        })
        .catch(function (err) {
          console.warn("[RB] feedback API error:", err);

          rbShowThanksScreen();
        });
    } else {

      showToast("Оставленный отзыв помогает улучшить игру ❤️");
      rbShowThanksScreen();
    }
  }

  function rbShowThanksScreen() {
    var el = document.getElementById("rbThanksScreen");
    if (!el) return;
    el.classList.remove("rb-hidden");
    void el.offsetWidth;
    el.classList.add("rb-visible");

    setTimeout(function () {

      rbShowInterstitialAd(function (adShown) {

        el.classList.remove("rb-visible");
        setTimeout(function () {
          el.classList.add("rb-hidden");

          rbGrantReward(adShown);
        }, 350);
      });
    }, 1800);
  }

  function rbShowInterstitialAd(callback) {

    var settled = false;
    function settle(shown) {
      if (settled) return;
      settled = true;
      resumeGameAfterAd();
      callback(shown);
    }

    pauseGameForAd();

    if (ysdk && ysdk.adv) {
      ysdk.adv.showFullscreenAdv({
        callbacks: {
          onOpen: function () {
            console.log("[RB] Fullscreen ad opened");
          },
          onClose: function (wasShown) {

            settle(!!wasShown);
          },
          onError: function (e) {
            console.error("[RB] Fullscreen ad error:", e);
            settle(false);
          },
          onOffline: function () {
            console.warn("[RB] Ad: offline");
            settle(false);
          }
        }
      });
    } else {

      setTimeout(function () { settle(true); }, 1200);
    }
  }

  function rbGrantReward(adWasShown) {
    reviewBonus.sessionUsed   = true;
    reviewBonus.lastClaimDay  = rbTodayKey();
    reviewBonus.cooldownUntil = rbNextDailyReset(Date.now());
    rbSave();
    rbUpdateButton();

    var amount = rbRewardAmount();
    addPoints(amount);
    saveGame();

    var amountEl = document.getElementById("rbRewardAmount");
    if (amountEl) amountEl.textContent = "+" + formatNumber(amount) + " очков";

    var subEl = document.querySelector(".rb-reward-sub");
    if (subEl) subEl.textContent = "Спасибо за отзыв! Следующий дневной бонус появится после сброса таймера.";

    var rewardEl = document.getElementById("rbRewardScreen");
    if (rewardEl) {
      rewardEl.classList.remove("rb-hidden");
      void rewardEl.offsetWidth;
      rewardEl.classList.add("rb-visible");
    }

    spawnCenterBurst("#ffeb3b");
    spawnCenterBurst("#61ff8b");
    playSound("jackpot");

    var note = adWasShown
      ? "🎁 Бонус за отзыв получен: +" + formatNumber(amount) + " очков!"
      : "🎁 Бонус за поддержку: +" + formatNumber(amount) + " очков!";
    showBigAnnouncement(note);
  }

  function rbCloseRewardScreen() {
    var el = document.getElementById("rbRewardScreen");
    if (!el) return;
    el.classList.remove("rb-visible");
    setTimeout(function () { el.classList.add("rb-hidden"); }, 350);
  }

  function rbInit() {
    rbLoad();
    rbInjectUI();

    setInterval(rbUpdateButton, 1000);
  }

  var INTERSTITIAL_INTERVAL = 10 * 60;

  var aiState = {
    elapsed:      0,
    pending:      false,
    pendingWait:  0,
    lastShownAt:  0,
    running:      false
  };

  function aiIsSafeToShow() {

    if (isAdRunning) return false;

    if (gamePaused) return false;

    if (document.hidden) return false;

    if (state.hatching) return false;

    var equippedModal = document.getElementById("equippedModal");
    if (equippedModal && !equippedModal.classList.contains("hidden")) return false;
    var rebirthModal = document.getElementById("rebirthModal");
    if (rebirthModal && !rebirthModal.classList.contains("hidden")) return false;

    var rbThanks = document.getElementById("rbThanksScreen");
    if (rbThanks && !rbThanks.classList.contains("rb-hidden")) return false;
    var rbReward = document.getElementById("rbRewardScreen");
    if (rbReward && !rbReward.classList.contains("rb-hidden")) return false;

    if (els.bigAnnouncement && !els.bigAnnouncement.classList.contains("hidden")) return false;
    return true;
  }

  function aiTick(dt) {
    if (!aiState.running) return;

    if (isAdRunning || gamePaused || document.hidden || state.hatching) return;

    aiState.elapsed += dt;

    if (aiState.elapsed < INTERSTITIAL_INTERVAL && !aiState.pending) return;

    if (!aiState.pending) {
      aiState.pending     = true;
      aiState.pendingWait = 0;
    }

    aiState.pendingWait += dt;

    if (!aiIsSafeToShow()) {

      if (aiState.pendingWait < 60) return;
    }

    aiTrigger();
  }

  function aiTrigger() {

    aiState.elapsed      = 0;
    aiState.pending      = false;
    aiState.pendingWait  = 0;
    aiState.lastShownAt  = Date.now();

    aiShowAd();
  }

  function aiShowAd() {
    var settled = false;

    function settle() {
      if (settled) return;
      settled = true;
      resumeGameAfterAd();
    }

    pauseGameForAd();

    if (ysdk && ysdk.adv) {
      ysdk.adv.showFullscreenAdv({
        callbacks: {
          onOpen: function () {
            console.log("[AI] Interstitial opened");
          },
          onClose: function (wasShown) {
            if (!wasShown) {

              aiState.elapsed = INTERSTITIAL_INTERVAL - 180;
            }
            settle();
          },
          onError: function (e) {
            console.error("[AI] Interstitial error:", e);

            aiState.elapsed = INTERSTITIAL_INTERVAL - 300;
            settle();
          },
          onOffline: function () {
            console.warn("[AI] Interstitial: offline");
            aiState.elapsed = INTERSTITIAL_INTERVAL - 300;
            settle();
          }
        }
      });
    } else {

      console.log("[AI] SDK не найден, пропускаем interstitial (dev-режим)");
      setTimeout(settle, 400);
    }
  }

  function aiInit() {
    aiState.running = true;

    aiState.elapsed = 0;
  }

  var stages = [
    { need: 0, name: "Стадия 1: Странный Комочек", symbol: "?", toast: "Появился Странный Комочек!" },
    { need: 400, name: "Стадия 2: Жвачка с Глазами", symbol: "ж", toast: "Эволюция: Жвачка с Глазами!" },
    { need: 2000, name: "Стадия 3: Мемный Пузырь", symbol: "м", toast: "Эволюция: Мемный Пузырь!" },
    { need: 10000, name: "Стадия 4: Рогатый Скример", symbol: "!", toast: "Эволюция: Рогатый Скример!" },
    { need: 45000, name: "Стадия 5: Танцующий Кринжоид", symbol: "ха", toast: "Эволюция: Танцующий Кринжоид!" },
    { need: 220000, name: "Стадия 6: Квантовый Бредоген", symbol: "∞", toast: "Эволюция: Квантовый Бредоген!" },
    { need: 1200000, name: "Стадия 7: Сверхразум Шитпоста", symbol: "404", toast: "Эволюция: Сверхразум Шитпоста!" },
    { need: 8000000, name: "Стадия 8: Гига-Брейнрот", symbol: "ГИГА", toast: "Эволюция: Гига-Брейнрот!" },
    { need: 40000000, name: "Стадия 9: Липкий Нейромем", symbol: "ЛОЛ", toast: "Эволюция: Липкий Нейромем!" },
    { need: 200000000, name: "Стадия 10: Сырный Оракул", symbol: "сыр", toast: "Эволюция: Сырный Оракул!" },
    { need: 1100000000, name: "Стадия 11: Пиксельный Психоз", symbol: "px", toast: "Эволюция: Пиксельный Психоз!" },
    { need: 6000000000, name: "Стадия 12: Дофаминовый Самовар", symbol: "чай", toast: "Эволюция: Дофаминовый Самовар!" },
    { need: 36000000000, name: "Стадия 13: Космический Кринж-Гриб", symbol: "гриб", toast: "Эволюция: Космический Кринж-Гриб!" },
    { need: 230000000000, name: "Стадия 14: Турбо-Шлёпа Разума", symbol: "тап", toast: "Эволюция: Турбо-Шлёпа Разума!" },
    { need: 1500000000000, name: "Стадия 15: Глазастый Алгоритм", symbol: "AI", toast: "Эволюция: Глазастый Алгоритм!" },
    { need: 10000000000000, name: "Стадия 16: Нейро-Пельмень 3000", symbol: "пм", toast: "Эволюция: Нейро-Пельмень 3000!" },
    { need: 75000000000000, name: "Стадия 17: Антисонный Монолит", symbol: "zzz", toast: "Эволюция: Антисонный Монолит!" },
    { need: 600000000000000, name: "Стадия 18: Сверхлипкий Дедлайн", symbol: "!!!", toast: "Эволюция: Сверхлипкий Дедлайн!" },
    { need: 5000000000000000, name: "Стадия 19: Мегамозг Без Сна", symbol: "NO", toast: "Эволюция: Мегамозг Без Сна!" },
    { need: 42000000000000000, name: "Стадия 20: Галактический Скроллер", symbol: "↕", toast: "Эволюция: Галактический Скроллер!" },
    { need: 380000000000000000, name: "Стадия 21: Абсолютный Мемосинтез", symbol: "M+", toast: "Эволюция: Абсолютный Мемосинтез!" },
    { need: 3.5e18, name: "Стадия 22: Хрустящий Хаос-Куб", symbol: "куб", toast: "Эволюция: Хрустящий Хаос-Куб!" },
    { need: 3.5e19, name: "Стадия 23: Директор Бесконечного Шума", symbol: "CEO", toast: "Эволюция: Директор Бесконечного Шума!" },
    { need: 3.8e20, name: "Стадия 24: Демонический Предвестник", symbol: "ДЕМ", toast: "Эволюция: Демонический Предвестник!" },
    { need: 3.5e21, name: "Стадия 25: Адский Корруптор", symbol: "АД", toast: "Эволюция: Адский Корруптор!" },
    { need: 3.3e22, name: "Стадия 26: Тёмный Синтез Хаоса", symbol: "ХАО", toast: "Эволюция: Тёмный Синтез Хаоса!" },
    { need: 3e23, name: "Стадия 27: Господин Бездны", symbol: "БЗД", toast: "Эволюция: Господин Бездны!" },
    { need: 2.8e24, name: "Стадия 28: Элитный Повелитель Тьмы", symbol: "ЭЛТ", toast: "ЭЛИТНАЯ ФАЗА: Повелитель Тьмы пробуждён!" },
    { need: 2.6e25, name: "Стадия 29: Вознёсшийся Демон-Владыка", symbol: "ВОЗ", toast: "Эволюция: Вознёсшийся Демон-Владыка!" },
    { need: 2.4e26, name: "Стадия 30: АБСОЛЮТНЫЙ ДЕМОН-ВЛАДЫКА", symbol: "∞ДМ", toast: "ФИНАЛЬНАЯ ФОРМА: Абсолютный Демон-Владыка!" }
  ];

  var PHASE_UNLOCK_STAGES = { 1: 0, 2: 7, 3: 14, 4: 23 };

  var upgrades = [

    { id: "fingers",     phase: 1, icon: "☝",  name: "Лучшие Пальцы",         desc: "Клики становятся мясистее.",                          baseCost: 15,          costGrow: 1.25, click: 0.25 },
    { id: "mouse",       phase: 1, icon: "🖱",  name: "Геймерская Мышь",        desc: "RGB добавляет уверенности.",                          baseCost: 80,          costGrow: 1.28, click: 1 },
    { id: "keyboard",    phase: 1, icon: "⌨",   name: "Клавиатура Паники",      desc: "Каждая кнопка думает за тебя.",                       baseCost: 210,         costGrow: 1.30, click: 2 },
    { id: "autoclick",   phase: 1, icon: "⚙",   name: "Автокликер Деда",        desc: "Пассивно тыкает в бездну.",                           baseCost: 340,         costGrow: 1.32, income: 0.7 },
    { id: "accelerator", phase: 1, icon: "🧠",  name: "Ускоритель Мозга",       desc: "Очки капают быстрее.",                                baseCost: 950,         costGrow: 1.33, income: 3 },
    { id: "memeFarm",    phase: 1, icon: "📱",  name: "Ферма Мемов",            desc: "Генерирует смешнявки каждую секунду.",                 baseCost: 2500,        costGrow: 1.35, income: 8 },
    { id: "aiFarm",      phase: 1, icon: "🤖",  name: "ИИ-Ферма",              desc: "Роботы выращивают абсурд.",                            baseCost: 7200,        costGrow: 1.37, income: 28 },
    { id: "reactor",     phase: 1, icon: "☢",   name: "Мемный Реактор",         desc: "Светится подозрительно, но эффективно.",              baseCost: 18000,       costGrow: 1.38, income: 85 },

    { id: "dopamine",    phase: 2, icon: "⚡",  name: "Бесконечный Дофамин",    desc: "Комбо растёт бодрее.",                                baseCost: 42000,       costGrow: 1.40, combo: 0.006 },
    { id: "crit",        phase: 2, icon: "💥",  name: "Критический Кринж",      desc: "Чаще выпадают мощные клики.",                         baseCost: 90000,       costGrow: 1.41, crit: 0.003 },
    { id: "quantum",     phase: 2, icon: "🌀",  name: "Квантовый Брейнрот",     desc: "Все доходы слегка ломают реальность.",                baseCost: 220000,      costGrow: 1.43, multiplier: 0.035, maxLevel: 15 },
    { id: "singularity", phase: 2, icon: "👁",  name: "Сингулярность Шитпоста", desc: "Открывает странные числа.",                           baseCost: 650000,      costGrow: 1.45, income: 550, click: 28 },
    { id: "jackpot",     phase: 2, icon: "🎰",  name: "Джекпотный Тикток",      desc: "Редкие клики становятся безумными.",                  baseCost: 1500000,     costGrow: 1.47, jackpot: 0.0015 },
    { id: "giga",        phase: 2, icon: "👑",  name: "Гига Дофамин",           desc: "Почти легально ускоряет всё.",                        baseCost: 5000000,     costGrow: 1.49, multiplier: 0.06, income: 2000, maxLevel: 12 },
    { id: "neuralnet",   phase: 2, icon: "🔗",  name: "Нейросеть Хаоса",        desc: "Связывает клики с пассивным доходом.",                baseCost: 14000000,    costGrow: 1.51, income: 6000, click: 85 },
    { id: "viralloop",   phase: 2, icon: "🔁",  name: "Вирусная Петля",         desc: "Каждый мем порождает новый мем.",                     baseCost: 48000000,    costGrow: 1.52, income: 24000, combo: 0.004 },
    { id: "memegod",     phase: 2, icon: "🌐",  name: "Бог Мемов",              desc: "Интернет работает на тебя.",                          baseCost: 180000000,   costGrow: 1.53, income: 90000, multiplier: 0.04, maxLevel: 12 },

    { id: "synapse",     phase: 3, icon: "🫀",  name: "Синаптический Взрыв",    desc: "Крит и комбо усиливают друг друга.",                  baseCost: 900000000,    costGrow: 1.55, crit: 0.005, combo: 0.008, multiplier: 0.06, maxLevel: 10 },
    { id: "deepcringe",  phase: 3, icon: "😵",  name: "Глубокий Кринж-Поток",   desc: "Пассивный доход начинает самоусиливаться.",           baseCost: 4500000000,   costGrow: 1.56, income: 1200000000, multiplier: 0.07, maxLevel: 10 },
    { id: "clickfusion",  phase: 3, icon: "🖐",  name: "Клик-Фузия",             desc: "Каждый клик чуть умножает сам себя.",                 baseCost: 22000000000,  costGrow: 1.57, clickMult: 0.06, multiplier: 0.05, maxLevel: 10 },
    { id: "critcascade", phase: 3, icon: "💫",  name: "Каскад Критов",          desc: "Критические удары множатся лавиной.",                 baseCost: 110000000000, costGrow: 1.58, crit: 0.007, jackpot: 0.002, multiplier: 0.07, maxLevel: 10 },
    { id: "doomscroll",  phase: 3, icon: "📜",  name: "Бесконечный Думскролл",  desc: "Чем дольше играешь, тем больше зарабатываешь.",      baseCost: 600000000000, costGrow: 1.59, income: 8000000000000, combo: 0.01, multiplier: 0.08, maxLevel: 8 },
    { id: "brainworm",   phase: 3, icon: "🪱",  name: "Мозговой Червь",         desc: "Разъедает реальность, оставляя только очки.",         baseCost: 3500000000000, costGrow: 1.60, multiplier: 0.12, income: 60000000000000, maxLevel: 8 },
    { id: "voidpulse",   phase: 3, icon: "🕳",  name: "Пульс Пустоты",          desc: "Каждый тик пустоты приносит значительный доход.",     baseCost: 22000000000000, costGrow: 1.61, income: 600000000000000, multiplier: 0.14, clickMult: 0.07, maxLevel: 8 },

    { id: "brainsing",   phase: 4, icon: "🌌",  name: "Брейнрот-Сингулярность", desc: "Пассивный доход масштабируется мощно.",               baseCost: 2e14,         costGrow: 1.63, income: 8000000000000000, multiplier: 0.28, maxLevel: 6 },
    { id: "clickloop",   phase: 4, icon: "♾",   name: "Бесконечная Клик-Петля", desc: "Клики генерируют множители, множители генерируют клики.", baseCost: 1.8e15,    costGrow: 1.64, clickMult: 0.14, combo: 0.015, multiplier: 0.18, maxLevel: 6 },
    { id: "cosmicmult",  phase: 4, icon: "✨",  name: "Космический Мультипликатор", desc: "Умножает все источники дохода глобально.",        baseCost: 1.6e16,       costGrow: 1.65, multiplier: 0.38, income: 90000000000000000, maxLevel: 5 },
    { id: "petsynergy",  phase: 4, icon: "🤝",  name: "Реактор Синергии Питомцев", desc: "Питомцы усиливают всю экономику.",                baseCost: 1.4e17,       costGrow: 1.66, multiplier: 0.28, clickMult: 0.10, income: 900000000000000000, maxLevel: 5 },
    { id: "eggmutator",  phase: 4, icon: "🧬",  name: "Мутатор Яиц",            desc: "Шанс критов и джекпотов выходит за рамки.",           baseCost: 1.2e18,       costGrow: 1.67, crit: 0.008, jackpot: 0.0024, clickMult: 0.10, multiplier: 0.22, maxLevel: 5 },
    { id: "transccore",  phase: 4, icon: "🔮",  name: "Трансцендентное Ядро Экономики", desc: "Позднеигровое мощное масштабирование дохода.", baseCost: 1e19,        costGrow: 1.68, multiplier: 0.55, income: 1.2e19, combo: 0.02, maxLevel: 4 },
    { id: "absolutevoid", phase: 4, icon: "⬛", name: "Абсолютная Пустота",      desc: "Поглощает реальность. Мощный финальный множитель.", baseCost: 8e19,          costGrow: 1.70, multiplier: 0.9, clickMult: 0.16, crit: 0.009, income: 1.1e20, maxLevel: 3 }
  ];

  var rarities = {
    common: { name: "Обычный", className: "rarity-common", color: "#9ca3af" },
    uncommon: { name: "Необычный", className: "rarity-uncommon", color: "#22c55e" },
    rare: { name: "Редкий", className: "rarity-rare", color: "#38bdf8" },
    epic: { name: "Эпический", className: "rarity-epic", color: "#a855f7" },
    legendary: { name: "Легендарный", className: "rarity-legendary", color: "#facc15" },
    mythic: { name: "Мифический", className: "rarity-mythic", color: "#ff4d6d" },
    secret: { name: "Секретный", className: "rarity-secret", color: "#67e8f9" },
    divine: { name: "Божественный", className: "rarity-divine", color: "#fff7ad" },
    cosmic: { name: "Космический", className: "rarity-cosmic", color: "#8b5cf6" },
    transcendent: { name: "Трансцендентный", className: "rarity-transcendent", color: "#ffffff" },
    demonic: { name: "Демонический", className: "rarity-demonic", color: "#ff2200" }
  };

  var PET_MAX_LEVELS = {
    common: 10, uncommon: 12, rare: 15,
    epic: 18, legendary: 20, mythic: 22,
    secret: 25, divine: 27, cosmic: 28,
    transcendent: 30, demonic: 30
  };

  var PET_SCALE_PER_LEVEL = {
    common: 0.038, uncommon: 0.042, rare: 0.046,
    epic: 0.052, legendary: 0.056, mythic: 0.06,
    secret: 0.065, divine: 0.065, cosmic: 0.068,
    transcendent: 0.072, demonic: 0.072
  };

  var PET_RARITY_COST_MULT = {
    common: 1, uncommon: 1.4, rare: 2,
    epic: 3.5, legendary: 6, mythic: 10,
    secret: 18, divine: 25, cosmic: 40,
    transcendent: 70, demonic: 80
  };

  function getPetLevel(petId) {
    return Math.max(1, Math.floor(finiteNumber(state.petLevels[petId], 1)));
  }

  function getPetMaxLevel(pet) {
    return PET_MAX_LEVELS[pet.rarity] || 10;
  }

  function getPetLevelScalar(pet) {
    var level = getPetLevel(pet.id);
    var scalePerLevel = PET_SCALE_PER_LEVEL[pet.rarity] || 0.05;
    return 1 + (level - 1) * scalePerLevel;
  }

  function getPetUpgradeCost(pet) {
    var level = getPetLevel(pet.id);
    var maxLevel = getPetMaxLevel(pet);
    if (level >= maxLevel) return Infinity;

    var incomeBase = (pet.income || 0) + (pet.autoclick || 0) * 50;
    var rarityMult = PET_RARITY_COST_MULT[pet.rarity] || 1;
    var minimum = rarityMult * 50;
    var baseCost = Math.max(minimum, incomeBase * 12 * rarityMult);

    return Math.floor(baseCost * Math.pow(1.55, level - 1));
  }

  function upgradePet(id) {
    var pet = getPetById(id);
    if (!pet || !state.pets[pet.id]) return;
    var level = getPetLevel(id);
    var maxLevel = getPetMaxLevel(pet);
    if (level >= maxLevel) {
      showStackedToast("pet_maxlevel_" + id, "Питомец достиг максимального уровня!");
      playSound("deny");
      return;
    }
    var cost = getPetUpgradeCost(pet);
    if (state.points < cost) {
      showStackedToast("pet_afford_" + id, "Не хватает очков: нужно " + formatNumber(cost));
      playSound("deny");
      return;
    }
    state.points -= cost;
    state.petLevels[id] = level + 1;
    recalculateStats();
    renderShop();
    updateUi(true);
    playSound("evolve");
    var newLevel = state.petLevels[id];
    var rarity = rarities[pet.rarity];
    spawnCenterBurst(rarity.color, "УЛУЧШЕН!");
    showStackedToast("pet_lvl_" + id, "⬆ " + pet.name + " — Уровень " + newLevel + "!");
    setTimeout(function () {
      var upgradeBtn = els.shopList.querySelector(".pet-upgrade-btn[data-id='" + id + "']");
      if (upgradeBtn) {
        var wrapEl = upgradeBtn.closest(".pc2-wrap");
        if (wrapEl) {
          wrapEl.classList.remove("leveled-up");
          void wrapEl.offsetWidth;
          wrapEl.classList.add("leveled-up");
          setTimeout(function () { wrapEl.classList.remove("leveled-up"); }, 900);
        }
      }
    }, 80);
    saveGame();
  }

  var pets = [

    { id: "crumb",        face: "•_•",   name: "Крошка Кринжа",              rarity: "common",       income: 0.6,           combo: 0.001 },
    { id: "noodle",       face: "≈_≈",   name: "Лапшичный Мыслитель",        rarity: "uncommon",     income: 2,             crit: 0.001 },
    { id: "sock",         face: "⊙▂⊙",  name: "Носок Предсказатель",         rarity: "uncommon",     income: 4,             autoclick: 0.1 },

    { id: "pickle",       face: "ಠ_ಠ",   name: "Огурец Паники",              rarity: "common",       income: 8,             combo: 0.002 },
    { id: "wifi",         face: "≋_≋",   name: "Вайфайный Пупс",             rarity: "uncommon",     income: 18,            crit: 0.002 },
    { id: "teapot",       face: "◉_◉",   name: "Чайник Бессмыслицы",         rarity: "rare",         income: 55,            autoclick: 0.35 },

    { id: "pixel",        face: "▣_▣",   name: "Пиксельный Визгун",          rarity: "uncommon",     income: 80,            combo: 0.005 },
    { id: "cursor",       face: "↖_↗",   name: "Курсор Судьбы",              rarity: "rare",         income: 280,           crit: 0.005 },
    { id: "portal",       face: "◌_◌",   name: "Портальная Булочка",         rarity: "epic",         income: 900,           autoclick: 1.2 },

    { id: "moon",         face: "☾_☽",   name: "Лунный Бубнитель",           rarity: "rare",         income: 1800,          combo: 0.009 },
    { id: "crown",        face: "♛_♛",   name: "Король Микроволн",           rarity: "epic",         income: 6000,          crit: 0.009 },
    { id: "sun",          face: "☀_☀",   name: "Солнечный Сырник",           rarity: "legendary",    income: 22000,         autoclick: 4,          incomeMult: 0.012 },

    { id: "antenna",      face: "⌁_⌁",   name: "Антенна Хихиканья",          rarity: "rare",         income: 620000,        crit: 0.006,           incomeMult: 0.018 },
    { id: "mixer",        face: "◐_◑",   name: "Блендер Мыслей",             rarity: "epic",         income: 2400000,       combo: 0.014,          autoclick: 7 },
    { id: "idol",         face: "◆_◆",   name: "Золотой Болванчик",          rarity: "legendary",    income: 9000000,       incomeMult: 0.038 },

    { id: "clock",        face: "◷_◶",   name: "Часы Нервного Тика",         rarity: "rare",         income: 60000000,      autoclick: 18 },
    { id: "drama",        face: "ಥ_ಥ",   name: "Драма-Глаз",                 rarity: "epic",         income: 210000000,     crit: 0.015,           combo: 0.012 },
    { id: "throne",       face: "♚_♚",   name: "Тронный Брейнрот",           rarity: "legendary",    income: 720000000,     incomeMult: 0.055 },

    { id: "cubelet",      face: "▤_▥",   name: "Кубик Нелогики",             rarity: "epic",         income: 6000000000,    autoclick: 45,         combo: 0.018 },
    { id: "angel",        face: "✦_✦",   name: "Ангел Абсурда",              rarity: "legendary",    income: 28000000000,   crit: 0.022,           incomeMult: 0.07 },
    { id: "voidling",     face: "●_●",   name: "Пустотный Малыш",            rarity: "mythic",       income: 130000000000,  combo: 0.038,          autoclick: 90,         incomeMult: 0.09 },

    { id: "neon",         face: "▰_▰",   name: "Неоновый Скример",           rarity: "epic",         income: 960000000000,  crit: 0.02 },
    { id: "kingbyte",     face: "K_B",   name: "Король Байтокринжа",         rarity: "legendary",    income: 5200000000000, autoclick: 260,        incomeMult: 0.08 },
    { id: "mythsignal",   face: "∞_∞",   name: "Мифический Сигнал",          rarity: "mythic",       income: 26000000000000, combo: 0.048,         crit: 0.032,           incomeMult: 0.12 },

    { id: "glitch",       face: "▓_▒",   name: "Глючный Абсолют",            rarity: "epic",         income: 120000000000000, combo: 0.028,        autoclick: 480 },
    { id: "oracle",       face: "👁",    name: "Оракул Дофамина",            rarity: "legendary",    income: 480000000000000, crit: 0.032,          autoclick: 1800,       incomeMult: 0.10 },
    { id: "redacted",     face: "?!",    name: "Запрещённый Шум",            rarity: "mythic",       income: 2200000000000000, combo: 0.062,        crit: 0.045,           autoclick: 7200,       incomeMult: 0.17 },
    { id: "secret404",    face: "???",   name: "Секрет 404",                 rarity: "secret",       income: 8000000000000000, crit: 0.048,         combo: 0.072,          duplicate: 0.014 },
    { id: "divinebell",   face: "✧_✧",   name: "Божественный Колокольчик",   rarity: "divine",       income: 3.2e16,        crit: 0.058,           incomeMult: 0.16,      jackpotBoost: 0.003 },
    { id: "cosmicmouth",  face: "★_★",   name: "Космический Рот Шума",       rarity: "cosmic",       income: 1.2e17,        crit: 0.072,           combo: 0.10,           incomeMult: 0.24,      jackpotBoost: 0.005 },
    { id: "transglitch",  face: "ЖЖЖ",   name: "Трансцендентный Глитч",      rarity: "transcendent", income: 4.8e17,        crit: 0.09,            combo: 0.14,           incomeMult: 0.36,      duplicate: 0.045,      jackpotBoost: 0.007 },

    { id: "finalspark",   face: "✺_✺",   name: "Финальная Искра",            rarity: "legendary",    income: 180000000000000000, autoclick: 600,    crit: 0.024 },
    { id: "apocalypse",   face: "!!!",   name: "Апокалипсис Мемов",          rarity: "mythic",       income: 1.1e18,        combo: 0.055,          crit: 0.038,           incomeMult: 0.14 },
    { id: "overbrain",    face: "Ω_Ω",   name: "Сверхбрейнрот Омега",        rarity: "mythic",       income: 6e18,          autoclick: 1800,       combo: 0.068,          incomeMult: 0.19 },
    { id: "hiddenmeme",   face: "шш",    name: "Тихий Мем Под Полом",        rarity: "secret",       income: 2.4e19,        autoclick: 2800,       incomeMult: 0.13,      duplicate: 0.018 },
    { id: "divinehand",   face: "☼_☼",   name: "Святая Ладонь Бонка",        rarity: "divine",       income: 9.6e19,        autoclick: 4800,       combo: 0.09,           duplicate: 0.024 },
    { id: "galaxyeye",    face: "◎_◎",   name: "Галактический Глаз Повтора", rarity: "cosmic",       income: 3.6e20,        autoclick: 12000,      duplicate: 0.036,      passiveCombo: 0.022 },
    { id: "beyondbrain",  face: "Ω!Ω",   name: "Брейнрот За Пределом",       rarity: "transcendent", income: 1.44e21,       autoclick: 36000,      combo: 0.18,           incomeMult: 0.45,      duplicate: 0.06,       passiveCombo: 0.036 },

    { id: "chaoscore",    face: "◈_◈",   name: "Ядро Хаоса",                 rarity: "epic",         income: 5e21,          combo: 0.08,           autoclick: 180000 },
    { id: "demonlord",    face: "⛧_⛧",   name: "Демонический Владыка",       rarity: "mythic",       income: 3.5e22,        combo: 0.078,          crit: 0.052,           autoclick: 60000,      incomeMult: 0.22 },
    { id: "infernalecho", face: "ψ_ψ",   name: "Адское Эхо",                 rarity: "mythic",       income: 8e22,          autoclick: 120000,     combo: 0.065,          incomeMult: 0.17 },
    { id: "shadowpulse",  face: "◗_◖",   name: "Теневой Пульс",              rarity: "secret",       income: 3.2e23,        crit: 0.056,           combo: 0.085,          duplicate: 0.022,      incomeMult: 0.15 },
    { id: "demonseraph",  face: "✞_✞",   name: "Демонический Серафим",       rarity: "divine",       income: 1.28e24,       crit: 0.076,           incomeMult: 0.28,      jackpotBoost: 0.006,   duplicate: 0.028 },
    { id: "abysswalker",  face: "◬_◬",   name: "Странник Бездны",            rarity: "cosmic",       income: 5.1e24,        combo: 0.14,           crit: 0.086,           autoclick: 600000,     incomeMult: 0.34,      jackpotBoost: 0.008 },
    { id: "finaldemongod",face: "Ω⛧Ω",  name: "Финальный Бог Демонов",      rarity: "transcendent", income: 2.04e25,       crit: 0.11,            combo: 0.22,           incomeMult: 0.65,      duplicate: 0.09,       autoclick: 2400000,    passiveCombo: 0.055,   jackpotBoost: 0.009 },

    { id: "voidthrone",   face: "▼_▼",   name: "Трон Пустоты",               rarity: "legendary",    income: 8.16e25,       autoclick: 9600000,    incomeMult: 0.18,      crit: 0.032 },
    { id: "hellsovereign",face: "⛦_⛦",  name: "Владыка Адского Пламени",     rarity: "demonic",      income: 3.26e26,       crit: 0.14,            combo: 0.30,           incomeMult: 0.90,      duplicate: 0.11,       autoclick: 36000000,   passiveCombo: 0.08,    jackpotBoost: 0.012 },
    { id: "voidemperor",  face: "҉_҉",   name: "Император Вечной Бездны",     rarity: "demonic",      income: 1.3e27,        crit: 0.17,            combo: 0.40,           incomeMult: 1.40,      duplicate: 0.14,       autoclick: 180000000,  passiveCombo: 0.11,    jackpotBoost: 0.017 }
  ];

  var eggs = [
    { id: "cheap", tier: 1, unlockStage: 2, icon: "🥚", name: "Дешёвое Яйцо", desc: "Первый маленький источник подозрительных друзей.", cost: 320, drops: [{ pet: "crumb", chance: 60 }, { pet: "noodle", chance: 30 }, { pet: "sock", chance: 10 }] },
    { id: "weird", tier: 2, unlockStage: 4, icon: "🍳", name: "Странное Яйцо", desc: "Внутри кто-то листает мемы и тихо спорит.", cost: 6500, drops: [{ pet: "pickle", chance: 50 }, { pet: "wifi", chance: 35 }, { pet: "teapot", chance: 15 }] },
    { id: "glitched", tier: 3, unlockStage: 6, icon: "🪩", name: "Глючное Яйцо", desc: "Мерцает так, будто знает пароль от реальности.", cost: 85000, drops: [{ pet: "pixel", chance: 50 }, { pet: "cursor", chance: 35 }, { pet: "portal", chance: 15 }] },
    { id: "cosmic", tier: 4, unlockStage: 8, icon: "🌌", name: "Космическое Яйцо", desc: "Пахнет звёздами, кринжем и свежим комбо.", cost: 1400000, drops: [{ pet: "moon", chance: 48 }, { pet: "crown", chance: 34 }, { pet: "sun", chance: 18 }] },
    { id: "reactorEgg", tier: 5, unlockStage: 10, icon: "☢", name: "Реакторное Яйцо", desc: "Греется даже когда на него просто смотришь.", cost: 22000000, drops: [{ pet: "antenna", chance: 45 }, { pet: "mixer", chance: 38 }, { pet: "idol", chance: 17 }] },
    { id: "royal", tier: 6, unlockStage: 13, icon: "👑", name: "Королевское Яйцо", desc: "Ведёт себя дорого и требует оваций.", cost: 2800000000, drops: [{ pet: "clock", chance: 42 }, { pet: "drama", chance: 38 }, { pet: "throne", chance: 20 }] },
    { id: "void", tier: 7, unlockStage: 16, icon: "🕳", name: "Пустотное Яйцо", desc: "Съедает свет и возвращает пассивный доход.", cost: 650000000000, drops: [{ pet: "cubelet", chance: 42 }, { pet: "angel", chance: 36 }, { pet: "voidling", chance: 22 }] },
    { id: "neon", tier: 8, unlockStage: 19, icon: "💎", name: "Неоновое Яйцо", desc: "Слишком яркое, чтобы быть законным.", cost: 260000000000000, drops: [{ pet: "neon", chance: 40 }, { pet: "kingbyte", chance: 36 }, { pet: "mythsignal", chance: 24 }] },
    { id: "forbidden", tier: 9, unlockStage: 22, icon: "🧿", name: "Запрещённое Яйцо", desc: "Лучше не спрашивать, почему оно смотрит. Внутри есть ультра-редкие сигналы.", cost: 180000000000000000, drops: [{ pet: "glitch", chance: 60 }, { pet: "oracle", chance: 20 }, { pet: "redacted", chance: 18.57 }, { pet: "secret404", chance: 1 }, { pet: "divinebell", chance: 0.3 }, { pet: "cosmicmouth", chance: 0.1 }, { pet: "transglitch", chance: 0.03 }] },
    { id: "omega", tier: 10, unlockStage: 23, icon: "🔴", name: "Омега-Яйцо Апокалипсиса", desc: "Финальный контейнер для самой громкой странности и невозможных питомцев.", cost: 2400000000000000000, drops: [{ pet: "finalspark", chance: 45 }, { pet: "apocalypse", chance: 25 }, { pet: "overbrain", chance: 28.57 }, { pet: "hiddenmeme", chance: 1 }, { pet: "divinehand", chance: 0.3 }, { pet: "galaxyeye", chance: 0.1 }, { pet: "beyondbrain", chance: 0.03 }] },
    { id: "infernal", tier: 11, unlockStage: 25, icon: "🔥", name: "Инфернальное Яйцо", desc: "Выкована в глубинах ада. Пылает изнутри и снаружи. Содержит существ, которых не должно существовать.", cost: 3.5e21, drops: [{ pet: "chaoscore", chance: 55 }, { pet: "demonlord", chance: 25 }, { pet: "infernalecho", chance: 18.57 }, { pet: "shadowpulse", chance: 1 }, { pet: "demonseraph", chance: 0.3 }, { pet: "abysswalker", chance: 0.1 }, { pet: "finaldemongod", chance: 0.02 }, { pet: "hellsovereign", chance: 0.01 }] },
    { id: "absolute", tier: 12, unlockStage: 28, icon: "🌑", name: "Абсолютное Яйцо Демона", desc: "Тьма внутри тьмы. Оно не просто светится — оно поглощает реальность. Только истинные повелители бездны могут его открыть.", cost: 8e22, drops: [{ pet: "voidthrone", chance: 50 }, { pet: "infernalecho", chance: 27 }, { pet: "demonlord", chance: 21.57 }, { pet: "shadowpulse", chance: 1 }, { pet: "demonseraph", chance: 0.3 }, { pet: "abysswalker", chance: 0.1 }, { pet: "finaldemongod", chance: 0.02 }, { pet: "hellsovereign", chance: 0.007 }, { pet: "voidemperor", chance: 0.003 }] }
  ];

  var els = {};
  var particles = [];
  var floatingTexts = [];
  var audioContext = null;
  var lastTick = performance.now();
  var lastUiUpdate = 0;
  var randomEventTimer = 18;
  var activePetRenderKey = "";

  var ysdk   = null;
  var yplayer = null;

  var useCloudSave = false;

  (function bootWithSdk() {
    if (typeof YaGames === "undefined") {

      console.warn("[YaSDK] YaGames не найден — запуск без SDK");
      document.addEventListener("DOMContentLoaded", init);
      return;
    }

    YaGames.init()
      .then(function (sdk) {
        ysdk = sdk;
        console.log("[YaSDK] SDK инициализирован");

        if (ysdk.features && ysdk.features.LoadingAPI) {
          ysdk.features.LoadingAPI.ready();
        }

        try {
          var lang = ysdk.environment && ysdk.environment.i18n && ysdk.environment.i18n.lang;
          if (lang) console.log("[YaSDK] Язык игрока:", lang);
        } catch (e) {   }

        return ysdk.getPlayer({ scopes: false });
      })
      .then(function (player) {
        yplayer = player;
        useCloudSave = true;
        console.log("[YaSDK] Игрок получен, облачные сохранения активны");
      })
      .catch(function (err) {

        console.warn("[YaSDK] getPlayer недоступен, используем localStorage:", err);
        useCloudSave = false;
      })
      .finally(function () {

        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", init);
        } else {
          init();
        }
      });
  })();

  var INVITE_INTERVAL   = 20 * 60;
  var INVITE_SHOW_SECS  = 30;

  var inviteState = {
    elapsed:   0,
    visible:   false,
    hideTimer: null,
    running:   false
  };

  function inviteCanTick() {
    if (!inviteState.running) return false;
    if (gamePaused)           return false;
    if (isAdRunning)          return false;
    if (document.hidden)      return false;
    if (state.hatching)       return false;
    return true;
  }

  function inviteTick(dt) {
    if (!inviteCanTick()) return;
    if (inviteState.visible) return;
    inviteState.elapsed += dt;
    if (inviteState.elapsed >= INVITE_INTERVAL) {
      inviteState.elapsed = 0;
      inviteShowButton();
    }
  }

  function inviteShowButton() {
    if (inviteState.visible) return;
    var btn = document.getElementById("inviteOfferBtn");
    if (!btn) return;

    inviteState.visible = true;
    btn.classList.remove("invite-hidden");

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        btn.classList.add("invite-visible");
      });
    });

    if (inviteState.hideTimer) clearTimeout(inviteState.hideTimer);
    inviteState.hideTimer = setTimeout(function () {
      inviteHideButton(false);
    }, INVITE_SHOW_SECS * 1000);
  }

  function inviteHideButton(clicked) {
    if (inviteState.hideTimer) { clearTimeout(inviteState.hideTimer); inviteState.hideTimer = null; }
    var btn = document.getElementById("inviteOfferBtn");
    if (!btn) return;

    btn.classList.remove("invite-visible");

    setTimeout(function () {
      btn.classList.add("invite-hidden");
      inviteState.visible = false;
    }, 400);

    if (!clicked) {

      inviteState.elapsed = 0;
    }
  }

  function inviteHandleClick() {
    inviteHideButton(true);
    inviteState.elapsed = 0;

    var shareUrl   = (typeof location !== "undefined") ? location.href : "https://yandex.ru/games/";
    var shareTitle = "Brainrot Evolution Clicker";
    var shareText  = "Играю в Brainrot Evolution Clicker — засасывает с первого клика! Присоединяйся 🧠";

    if (ysdk && ysdk.shortcut && typeof ysdk.shortcut.canShowPrompt === "function") {
      ysdk.shortcut.canShowPrompt().then(function (result) {
        if (result && result.canShow) {
          ysdk.shortcut.showPrompt().then(function (res) {
            if (res && res.outcome === "accepted") {
              inviteGrantReward();
            }
          }).catch(function () { inviteFallbackShare(shareText, shareUrl); });
        } else {
          inviteFallbackShare(shareText, shareUrl);
        }
      }).catch(function () { inviteFallbackShare(shareText, shareUrl); });
      return;
    }

    if (navigator.share) {
      navigator.share({ title: shareTitle, text: shareText, url: shareUrl })
        .then(function () { inviteGrantReward(); })
        .catch(function () {   });
      return;
    }

    inviteFallbackShare(shareText, shareUrl);
  }

  function inviteFallbackShare(text, url) {
    var combined = text + "\n" + url;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(combined)
        .then(function () {
          showToast("📋 Ссылка скопирована! Поделись с другом");
          inviteGrantReward();
        })
        .catch(function () { inviteManualCopyPrompt(combined); });
    } else {
      inviteManualCopyPrompt(combined);
    }
  }

  function inviteManualCopyPrompt(text) {
    try { window.prompt("Скопируй и отправь другу:", text); } catch (e) {}
    inviteGrantReward();
  }

  function inviteGrantReward() {

    var bonus = Math.max(50, Math.round(state.income * 300));
    addPoints(bonus);
    showToast("🎉 Спасибо за приглашение! +" + formatNumber(bonus) + " брейнрот-очков");
    playSound("evolve");
  }

  function inviteInitDom() {
    var btn = document.createElement("button");
    btn.id        = "inviteOfferBtn";
    btn.type      = "button";
    btn.className = "invite-offer-btn invite-hidden";
    btn.setAttribute("aria-label", "Пригласить друга за бонус");
    btn.innerHTML =
      '<span class="invite-icon">🎁</span>' +
      '<span class="invite-text">Пригласить друга за бонус</span>';
    btn.addEventListener("click", inviteHandleClick);
    document.body.appendChild(btn);
  }

  function inviteInit() {
    inviteInitDom();
    inviteState.running = true;
  }

  function init() {
    cacheElements();
    setupCanvas();
    bindEvents();
    adInitDom();
    adLoadState();
    adResetBuffTimer();
    adRenderStatus();
    rbInit();
    aiInit();
    inviteInit();
    injectAutoClickerButton();

    loadGame();
    requestAnimationFrame(loop);
    setInterval(saveGame, 10000);
    setInterval(spawnRandomEvent, 1000);
    showToast("Добро пожаловать в брейнрот!");
  }

  function cacheElements() {
    els.canvas = document.getElementById("effectsCanvas");
    els.ctx = els.canvas.getContext("2d", { alpha: true });
    els.shell = document.getElementById("gameShell");
    els.creatureButton = document.getElementById("creatureButton");
    els.creature = document.getElementById("creature");
    els.creatureSymbol = document.getElementById("creatureSymbol");
    els.pointsText = document.getElementById("pointsText");
    els.incomeText = document.getElementById("incomeText");
    els.clickPowerText = document.getElementById("clickPowerText");
    els.comboText = document.getElementById("comboText");
    els.critText = document.getElementById("critText");
    els.jackpotText = document.getElementById("jackpotText");
    els.mutationText = document.getElementById("mutationText");
    els.stageName = document.getElementById("stageName");
    els.nextStageText = document.getElementById("nextStageText");
    els.evolutionProgress = document.getElementById("evolutionProgress");
    els.shopList = document.getElementById("shopList");
    els.shopTitle = document.getElementById("shopTitle");
    els.shopMiniTitle = document.getElementById("shopMiniTitle");
    els.shopPageTabs = Array.prototype.slice.call(document.querySelectorAll("[data-shop-page]"));
    els.saveButton = document.getElementById("saveButton");
    els.soundButton = document.getElementById("soundButton");
    els.toastStack = document.getElementById("toastStack");
    els.eventBanner = document.getElementById("eventBanner");
    els.petBonusText = document.getElementById("petBonusText");
    els.activePet = document.getElementById("activePet");
    els.bigAnnouncement = document.getElementById("bigAnnouncement");
    els.hatchOverlay = document.getElementById("hatchOverlay");
    els.hatchCard = document.getElementById("hatchCard");
    els.hatchEgg = document.getElementById("hatchEgg");
    els.hatchResult = document.getElementById("hatchResult");
    els.hatchPetFace = document.getElementById("hatchPetFace");
    els.hatchPetName = document.getElementById("hatchPetName");
    els.hatchPetRarity = document.getElementById("hatchPetRarity");
    els.hatchPetBonus = document.getElementById("hatchPetBonus");
    els.equippedPetsBtn = document.getElementById("equippedPetsBtn");
    els.equippedPetsBtnCount = document.getElementById("equippedPetsBtnCount");
    els.equippedModal = document.getElementById("equippedModal");
    els.equippedModalClose = document.getElementById("equippedModalClose");
    els.equippedModalBody = document.getElementById("equippedModalBody");

    if (!els.equippedPetsBtn) {
      injectEquippedPetsUI();
      els.equippedPetsBtn     = document.getElementById("equippedPetsBtn");
      els.equippedPetsBtnCount = document.getElementById("equippedPetsBtnCount");
      els.equippedModal       = document.getElementById("equippedModal");
      els.equippedModalClose  = document.getElementById("equippedModalClose");
      els.equippedModalBody   = document.getElementById("equippedModalBody");
    }

    els.rebirthModal      = document.getElementById("rebirthModal");
    els.rebirthModalClose = document.getElementById("rebirthModalClose");
    els.rebirthActionBtn  = document.getElementById("rebirthActionBtn");
  }

  function injectEquippedPetsUI() {

    var petArticle = null;
    var bonusRow = document.querySelector(".bonus-row");
    if (bonusRow) {
      bonusRow.querySelectorAll("article").forEach(function (a) {
        if (a.querySelector("#petBonusText")) petArticle = a;
      });
    }
    if (petArticle) {
      petArticle.classList.add("bonus-row-pet-article");
      var btn = document.createElement("button");
      btn.className = "equipped-pets-btn";
      btn.id = "equippedPetsBtn";
      btn.type = "button";
      btn.setAttribute("aria-label", "Посмотреть одетых питомцев");
      btn.innerHTML = '<span class="equipped-pets-btn-icon">🐾</span><span class="equipped-pets-btn-label">Смотреть</span><span class="equipped-pets-btn-count" id="equippedPetsBtnCount">0/3</span>';
      petArticle.appendChild(btn);
    }

    if (bonusRow && !document.getElementById("rebirthStatText")) {
      var rebirthArticle = document.createElement("article");
      rebirthArticle.innerHTML = '<span>Перерождения</span><strong id="rebirthStatText">нет</strong>';
      if (petArticle) {
        bonusRow.insertBefore(rebirthArticle, petArticle);
      } else {
        bonusRow.appendChild(rebirthArticle);
      }

      bonusRow.classList.add("bonus-row-cols-5");
    }

    var stageNameEl = document.getElementById("stageName");
    if (stageNameEl && !document.getElementById("stageRarityBadge")) {
      var badge = document.createElement("span");
      badge.id = "stageRarityBadge";
      badge.className = "stage-rarity-badge";
      badge.textContent = "Обычный";
      stageNameEl.appendChild(badge);
    }

    if (!document.getElementById("rebirthBtn")) {
      var stagePanel = document.querySelector(".stage-panel");
      if (stagePanel) {
        var actionsRow = stagePanel.querySelector(".stage-actions");
        if (!actionsRow) {
          actionsRow = document.createElement("div");
          actionsRow.className = "stage-actions";
          stagePanel.appendChild(actionsRow);
        }
        var rebirthBar = document.createElement("div");
        rebirthBar.className = "rebirth-bar";
        rebirthBar.innerHTML = '<button class="rebirth-btn rebirth-open-btn" id="rebirthBtn" type="button" disabled>⭕ Путь Перерождений</button>';
        actionsRow.appendChild(rebirthBar);

        var rebirthBtnEl = rebirthBar.querySelector("#rebirthBtn");
        if (rebirthBtnEl) rebirthBtnEl.addEventListener("click", openRebirthModal);
      }
    }

    var wrapperPets = document.createElement("div");
    wrapperPets.innerHTML = [
      '<div class="equipped-modal-backdrop hidden" id="equippedModal" aria-modal="true" role="dialog" aria-label="Одетые питомцы">',
        '<div class="equipped-modal-box">',
          '<div class="equipped-modal-header">',
            '<div>',
              '<span class="mini-label">Активные питомцы</span>',
              '<h2 class="equipped-modal-title">Одетые питомцы</h2>',
            '</div>',
            '<button class="equipped-modal-close" id="equippedModalClose" type="button" aria-label="Закрыть">✕</button>',
          '</div>',
          '<div class="equipped-modal-body" id="equippedModalBody"></div>',
        '</div>',
      '</div>'
    ].join("");
    document.body.appendChild(wrapperPets.firstElementChild);

    var wrapperRebirth = document.createElement("div");
    wrapperRebirth.innerHTML = [
      '<div class="rebirth-modal-backdrop hidden" id="rebirthModal" aria-modal="true" role="dialog" aria-label="Путь Перерождений">',
        '<div class="rebirth-modal-box">',
          '<div class="rebirth-modal-header">',
            '<div>',
              '<span class="mini-label">Система прогрессии</span>',
              '<h2 class="rebirth-modal-title">⭕ Путь Перерождений</h2>',
            '</div>',
            '<button class="rebirth-modal-close" id="rebirthModalClose" type="button" aria-label="Закрыть">✕</button>',
          '</div>',
          '<div class="rebirth-modal-body" id="rebirthModalBody">',
            '<div id="rebirthTrack" class="rebirth-track"></div>',
            '<div class="rebirth-modal-action">',
              '<button class="rebirth-action-btn" id="rebirthActionBtn" type="button" disabled>🔁 Доступно с этапа 10</button>',
            '</div>',
          '</div>',
        '</div>',
      '</div>'
    ].join("");
    document.body.appendChild(wrapperRebirth.firstElementChild);
  }

  function setupCanvas() {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas, { passive: true });
  }

  function resizeCanvas() {
    var ratio = Math.min(window.devicePixelRatio || 1, 2);
    els.canvas.width = Math.floor(window.innerWidth * ratio);
    els.canvas.height = Math.floor(window.innerHeight * ratio);
    els.canvas.style.width = window.innerWidth + "px";
    els.canvas.style.height = window.innerHeight + "px";
    els.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function bindEvents() {
    registerAudioUnlockHandlers();

    document.getElementById("gameShell").addEventListener("contextmenu", function (e) {
      e.preventDefault();
    });

    els.creatureButton.addEventListener("pointerdown", function (event) {
      event.preventDefault();
      ensureAudio();
      handleCreatureClick(event.clientX, event.clientY);
    });

    els.shopList.addEventListener("click", function (event) {
      var button = event.target.closest(".upgrade-button:not(.upgrade-special)");
      var specialButton = event.target.closest(".upgrade-special");
      var eggButton = event.target.closest(".egg-button");
      var petButton = event.target.closest(".pet-card") || event.target.closest(".pc2-main");
      var adUpgradeBtn = event.target.closest("[data-ad-upgrade]");
      var adEggBtn     = event.target.closest("[data-ad-egg]");
      var eggChancesBtn = event.target.closest("[data-egg-chances]");
      if (adUpgradeBtn) { adRequestUpgrade(adUpgradeBtn.dataset.adUpgrade); return; }
      if (adEggBtn)     { adRequestEgg(adEggBtn.dataset.adEgg); return; }
      if (eggChancesBtn) { toggleEggPreview(eggChancesBtn); return; }
      if (specialButton && specialButton.dataset.specialId) { buySpecialUpgrade(specialButton.dataset.specialId); return; }
      if (button)    buyUpgrade(button.dataset.id);
      if (eggButton) openEgg(eggButton.dataset.id);
      var petUpgradeBtn = event.target.closest('.pet-upgrade-btn');
      if (petUpgradeBtn) { upgradePet(petUpgradeBtn.dataset.id); return; }
      if (petButton) { equipPet(petButton.dataset.id); return; }
    });
    els.shopList.addEventListener("pointerover", updateShopAffordability);
    els.shopList.addEventListener("focusin", updateShopAffordability);

    els.shopPageTabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        var page = tab.dataset.shopPage === "eggs" ? "eggs" : "upgrades";
        if (state.shopPage === page) return;
        state.shopPage = page;
        els.shopList.classList.remove("page-swap");
        void els.shopList.offsetWidth;
        els.shopList.classList.add("page-swap");
        renderShop();
        playSound("buy");
      });
    });

    if (els.shopPageButton) {
      els.shopPageButton.addEventListener("click", function () {
        state.shopPage = state.shopPage === "upgrades" ? "eggs" : "upgrades";
        els.shopList.classList.remove("page-swap");
        void els.shopList.offsetWidth;
        els.shopList.classList.add("page-swap");
        renderShop();
        playSound("buy");
      });
    }

    els.saveButton.addEventListener("click", function () {
      saveGame();
      showStackedToast("game_saved", "Игра сохранена!");
      playSound("save");
    });

    els.soundButton.addEventListener("click", function () {
      state.sound = !state.sound;
      els.soundButton.textContent = state.sound ? "🔊" : "🔇";
      els.soundButton.setAttribute("aria-label", state.sound ? "Звук включён" : "Звук выключен");
      if (state.sound) {
        ensureAudio();
      } else {
        resetAudioContext();
      }
      saveGame();
    });

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        saveGame();
      } else {

        lastTick = performance.now();
      }
    });

    window.addEventListener("blur", function () {
      if (audioContext && audioContext.state === "running") {
        try {
          audioContext.suspend().catch(function () {});
        } catch (e) {}
      }
    });

    window.addEventListener("focus", function () {
      lastTick = performance.now();
    });

    var rebirthBtn = document.getElementById("rebirthBtn");
    if (rebirthBtn) rebirthBtn.addEventListener("click", openRebirthModal);

    els.equippedPetsBtn && els.equippedPetsBtn.addEventListener("click", function () {
      openEquippedModal();
    });

    els.equippedModalClose && els.equippedModalClose.addEventListener("click", function () {
      closeEquippedModal();
    });

    els.equippedModal && els.equippedModal.addEventListener("click", function (event) {
      if (event.target === els.equippedModal) closeEquippedModal();
    });

    var rebirthModalEl = document.getElementById("rebirthModal");
    var rebirthModalCloseEl = document.getElementById("rebirthModalClose");
    var rebirthActionBtnEl = document.getElementById("rebirthActionBtn");
    if (rebirthModalCloseEl) rebirthModalCloseEl.addEventListener("click", closeRebirthModal);
    if (rebirthModalEl) rebirthModalEl.addEventListener("click", function (event) {
      if (event.target === rebirthModalEl) closeRebirthModal();
    });
    if (rebirthActionBtnEl) rebirthActionBtnEl.addEventListener("click", function () {
      closeRebirthModal();
      doRebirth();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        if (els.equippedModal && !els.equippedModal.classList.contains("hidden")) closeEquippedModal();
        if (!document.getElementById("rebirthModal").classList.contains("hidden")) closeRebirthModal();
      }
    });
  }

  function handleCreatureClick(x, y) {
    var current = now();
    if (current - state.lastClickAt < 1200) {
      state.comboClicks += 1;
    } else {
      state.comboClicks = 1;
      state.combo = 1;
    }
    state.lastClickAt = current;

    var comboLimit = getEventMultiplier("comboLimit");
    state.combo = Math.min(1 + state.comboClicks * getComboStep(), comboLimit);

    var value = state.clickPower * state.multiplier * state.combo;
    var textPrefix = "+";
    var crit = Math.random() < state.critChance;
    var jackpot = Math.random() < state.jackpotChance;

    if (crit) {
      value *= CRIT_DAMAGE_MULT;
      textPrefix = "КРИТ +";
      showStackedToast("crit", "💥 Критический удар!");
    }

    if (jackpot) {
      value *= JACKPOT_DAMAGE_MULT;
      textPrefix = "ДЖЕКПОТ +";
      triggerShake();
      triggerFlash();
      showStackedToast("jackpot", "🎰 Джекпотный клик!");
    }

    if (Math.random() < state.jackpotBoostChance) {
      value *= PET_JACKPOT_BOOST_MULT;
      textPrefix = "БУСТ +";
      spawnFloatingText(x + 18, y - 22, "ПИТОМЕЦ УСИЛИЛ!", "#ffeb3b");
      triggerFlash();
      showStackedToast("petboost", "🐾 Питомец усилил удар!");
    }

    if (Math.random() < state.duplicateClickChance) {
      value *= 2;
      spawnFloatingText(x - 18, y + 8, "ДУБЛЬ!", "#67e8f9");
      playSound("event");
      showStackedToast("duplicate", "✨ Дубль клика!");
    }

    value *= getEventMultiplier("click");

    var bossRemain = getBossHpRemaining();
    if (bossRemain > 0 && bossRemain < Infinity) {
      var clickCap = bossRemain * BALANCE_CLICK_BOSS_CHIP;
      if (value > clickCap) value = clickCap;
    }

    addPoints(value);
    spawnParticles(x, y, (crit || jackpot ? 22 : 12) + getVisualModParticleBonus(), jackpot);
    spawnFloatingText(x, y, textPrefix + formatNumber(value), jackpot ? "#ffeb3b" : crit ? "#ff4d6d" : "#ffffff");
    bounceCreature();
    if (getStageNumber() >= 16 || state.visualModState > 0) triggerTinyShake();
    playSound(jackpot ? "jackpot" : crit ? "crit" : "click");
    updateUi();
  }

  function addPoints(amount) {
    state.points += amount;
    state.totalPoints += amount;
    snapDefeatedBoss(amount);
    updateStage(false);
    syncVisualModState(false);
  }

  var _upgradeToasts = {};

  function showUpgradeToast(upgrade, level) {
    var id = upgrade.id;
    var existing = _upgradeToasts[id];

    if (existing && existing.el && existing.el.parentNode) {

      existing.count += 1;
      existing.el.textContent = "Куплено: " + upgrade.name + " ур. " + level + " · " + existing.count + "x";
      clearTimeout(existing.timer);
      existing.timer = setTimeout(function () {
        if (existing.el.parentNode) existing.el.parentNode.removeChild(existing.el);
        delete _upgradeToasts[id];
      }, 3000);
    } else {

      var toast = document.createElement("div");
      toast.className = "toast";
      toast.textContent = "Куплено: " + upgrade.name + " ур. " + level;
      els.toastStack.appendChild(toast);
      var entry = { el: toast, count: 1, timer: null };
      entry.timer = setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
        delete _upgradeToasts[id];
      }, 3000);
      _upgradeToasts[id] = entry;
    }
  }

  var REBIRTH_STAGES = [9, 14, 19, 24, 29];

  function getRebirthUnlockStage() {
    if (state.rebirths >= 5) return null;
    return REBIRTH_STAGES[state.rebirths];
  }

  function canRebirth() {
    var needed = getRebirthUnlockStage();
    return needed !== null && state.stage >= needed;
  }

  function doRebirth() {
    if (!canRebirth()) return;
    if (!confirm("Перерождение сбросит весь прогресс (очки, улучшения, питомцев), но даст постоянный бафф ×" + (1 + (state.rebirths + 1) * 0.5).toFixed(1) + " ко всем статам. Продолжить?")) return;

    var newRebirths = state.rebirths + 1;
    var sound = state.sound;

    state.points = 0;
    state.totalPoints = 0;
    state.clickPower = 1;
    state.multiplier = 1;
    state.income = 0;
    state.combo = 1;
    state.comboClicks = 0;
    state.lastClickAt = 0;
    state.critChance = 0.05;
    state.jackpotChance = 0.01;
    state.mutations = 0;
    state.stage = 0;
    state.eventUntil = 0;
    state.eventType = "";
    state.upgrades = {};
    state.pets = {};
    state.petLevels = {};
    state.activePetIds = [];
    state.petComboBonus = 0;
    state.petBonusText = "нет";
    state.hatching = false;
    state.duplicateClickChance = 0;
    state.jackpotBoostChance = 0;
    state.passiveCombo = 0;
    state.petAttackTimer = 5;
    state.visualModState = 0;
    state.visualCharge = 0;
    state.visualParticleTimer = 0;
    state._adBuffIncome = 1;
    state._adBuffPet = 1;
    state._adBuffUpgrade = 1;
    state._adBuffPassive = 1;
    state.sound = sound;

    state.rebirths = newRebirths;

    recalculateStats();
    normalizeUpgradeState();
    normalizePetState();
    updateStage(true);
    renderShop();
    updateUi(true);
    updateRebirthButton();
    saveGame();

    playSound("evolve");
    var rebirthRewards = {
      1: "🍀 Открыт: Множитель удачи",
      2: "🐾 Открыт: Второй слот питомца",
      3: "🐾 Открыт: Третий слот питомца",
      4: "⚡🍀 Открыт: Ультра множитель удачи",
      5: "🪞 Открыт: Зеркальный Брейнрот!"
    };
    var rewardMsg = rebirthRewards[newRebirths] ? "\n" + rebirthRewards[newRebirths] : "";
    showBigAnnouncement("🔁 ПЕРЕРОЖДЕНИЕ " + newRebirths + "! Бафф ×" + (1 + newRebirths * 0.5).toFixed(1));
    if (rebirthRewards[newRebirths]) {
      setTimeout(function () { showToast(rebirthRewards[newRebirths]); }, 1200);
    }
    updateRebirthButton();
  }

  function updateRebirthButton() {
    var stageBtn = document.getElementById("rebirthBtn");
    var actionBtn = document.getElementById("rebirthActionBtn");

    var rebirths = state.rebirths;
    var nextMult = "×" + (1 + (rebirths + 1) * 0.5).toFixed(1);
    var ready = canRebirth();
    var allDone = rebirths >= 5;

    if (stageBtn) {
      if (allDone) {
        stageBtn.textContent = "⭕ Путь Перерождений ✦";
        stageBtn.disabled = false;
        stageBtn.classList.remove("rebirth-ready");
      } else if (ready) {
        stageBtn.textContent = "⭕ Путь Перерождений ✨";
        stageBtn.disabled = false;
        stageBtn.classList.add("rebirth-ready");
      } else {
        stageBtn.textContent = "⭕ Путь Перерождений";
        stageBtn.disabled = false;
        stageBtn.classList.remove("rebirth-ready");
      }
    }

    if (actionBtn) {
      if (allDone) {
        actionBtn.disabled = true;
        actionBtn.textContent = "🔁 Макс. перерождений достигнут";
      } else {
        var needed = getRebirthUnlockStage();
        var stageNum = needed + 1;
        actionBtn.disabled = !ready;
        actionBtn.textContent = ready
          ? "🔁 Переродиться (" + nextMult + ")"
          : "🔁 Доступно с этапа " + stageNum;
      }
    }

    renderRebirthTrack();
  }

  var _REBIRTH_MILESTONES = [
    { n: 1, icon: "🍀", reward: "Множитель удачи",   stage: 10 },
    { n: 2, icon: "🐾", reward: "2-й слот питомца",  stage: 15 },
    { n: 3, icon: "🐾", reward: "3-й слот питомца",  stage: 20 },
    { n: 4, icon: "⚡",  reward: "Ультра-удача",      stage: 25 },
    { n: 5, icon: "🪞", reward: "Зеркальный питомец", stage: 30 }
  ];

  function renderRebirthTrack() {
    var trackEl = document.getElementById("rebirthTrack");
    if (!trackEl) return;

    var rebirths = state.rebirths;
    var ready = canRebirth();
    var allDone = rebirths >= 5;

    var html = '<div class="rebirth-track-title">';
    html += '<span class="rebirth-track-title-label">⭕ Путь Перерождений</span>';
    html += '<span class="rebirth-track-title-count">' + rebirths + ' / 5</span>';
    html += '</div>';

    html += '<div class="rebirth-nodes-row">';

    for (var i = 0; i < _REBIRTH_MILESTONES.length; i++) {
      var m = _REBIRTH_MILESTONES[i];
      var isDone    = rebirths >= m.n;
      var isCurrent = !allDone && rebirths === m.n - 1;
      var isLocked  = !isDone && !isCurrent;

      var nodeClass = "rebirth-node " + (isDone ? (allDone && m.n === 5 ? "max done" : "done") : isCurrent ? "current" : "locked");
      var circleContent = isDone ? (m.n === 5 && allDone ? "✦" : "✓") : isCurrent ? m.icon : m.icon;
      var labelText = isDone
        ? m.reward
        : isCurrent
          ? "Стадия " + m.stage
          : m.reward;

      html += '<div class="' + nodeClass + '" title="Перерождение ' + m.n + ': ' + m.reward + '">';
      html += '<div class="rebirth-node-circle">' + circleContent + '</div>';
      html += '<div class="rebirth-node-label">' + labelText + '</div>';
      html += '</div>';

      if (i < _REBIRTH_MILESTONES.length - 1) {
        var connectorClass = "rebirth-connector " + (isDone ? "done" : isCurrent ? "active" : "");
        html += '<div class="' + connectorClass + '"></div>';
      }
    }
    html += '</div>';

    var hintClass = "rebirth-track-hint" + (ready ? " ready" : "");
    var hintText;
    if (allDone) {
      hintText = "✦ Максимальный бафф ×3.5 достигнут · Зеркальный питомец активен";
    } else if (ready) {
      hintText = "✨ Перерождение доступно! Нажми кнопку выше";
    } else {
      var nextNeeded = REBIRTH_STAGES[rebirths];
      var stagesLeft = nextNeeded !== null ? (nextNeeded + 1) - (state.stage + 1) : 0;
      var nextReward = _REBIRTH_MILESTONES[rebirths] ? _REBIRTH_MILESTONES[rebirths].reward : "";
      hintText = stagesLeft > 0
        ? "Ещё " + stagesLeft + " " + declStages(stagesLeft) + " до перерождения · Открывает: " + nextReward
        : "Скоро доступно перерождение!";
    }
    html += '<div class="' + hintClass + '">' + hintText + '</div>';

    trackEl.innerHTML = html;
  }

  function declStages(n) {
    var mod10 = n % 10, mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return "стадия";
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "стадии";
    return "стадий";
  }

  var SPECIAL_UPGRADES = [
    {
      id: "luck_mult",
      name: "Множитель удачи",
      icon: "🍀",
      desc: "Плавно повышает шанс крита и джекпота. Стакается без выхода в постоянные джекпоты.",
      cost: 100,
      rebirthRequired: 1,
      maxLevel: 5,
      costScale: 3.5
    },
    {
      id: "pet_slot_2",
      name: "Второй слот питомца",
      icon: "🐾",
      desc: "Открывает второй слот для экипировки питомца.",
      cost: 100,
      rebirthRequired: 2,
      maxLevel: 1
    },
    {
      id: "pet_slot_3",
      name: "Третий слот питомца",
      icon: "🐾",
      desc: "Открывает третий слот для экипировки питомца.",
      cost: 100,
      rebirthRequired: 3,
      requiresUpgrade: "pet_slot_2",
      maxLevel: 1
    },
    {
      id: "luck_ultra",
      name: "Ультра множитель удачи",
      icon: "⚡🍀",
      desc: "Сильно, но мягко повышает шанс крита и джекпота. Стакается с обычным.",
      cost: 100,
      rebirthRequired: 4,
      maxLevel: 2,
      costScale: 8
    }
  ];

  function getLuckMult() {
    var luckLevel = state.upgrades["luck_mult"] || 0;
    var ultraLevel = state.upgrades["luck_ultra"] || 0;
    return 1 + luckLevel * 0.35 + ultraLevel * 0.75;
  }

  function getMaxPetSlots() {
    var slots = 1;
    if (state.upgrades["pet_slot_2"]) slots = 2;
    if (state.upgrades["pet_slot_2"] && state.upgrades["pet_slot_3"]) slots = 3;
    return slots;
  }

  function getSpecialUpgradeRequirement(upg) {
    if (!upg || !upg.requiresUpgrade) return null;
    return SPECIAL_UPGRADES.find(function (item) { return item.id === upg.requiresUpgrade; }) || null;
  }

  function getSpecialUpgradeCost(upg) {
    var level = state.upgrades[upg.id] || 0;
    if (!upg.costScale) return upg.cost;
    return Math.floor(upg.cost * Math.pow(upg.costScale, level));
  }

  function buySpecialUpgrade(id) {
    var upg = SPECIAL_UPGRADES.find(function (u) { return u.id === id; });
    if (!upg) return;
    var level = state.upgrades[id] || 0;
    var maxLevel = upg.maxLevel || 1;
    if (level >= maxLevel) { showStackedToast("spec_maxlevel_" + id, "Максимальный уровень куплен"); return; }
    var required = upg.rebirthRequired || 0;
    if (state.rebirths < required) {
      showStackedToast("spec_rebirth_" + id, "Недоступно — нужно " + required + " перерождений (у тебя " + state.rebirths + ")");
      playSound("deny");
      return;
    }
    var prerequisite = getSpecialUpgradeRequirement(upg);
    if (prerequisite && !state.upgrades[prerequisite.id]) {
      showStackedToast("spec_requires_" + id, "Сначала купи: " + prerequisite.name);
      playSound("deny");
      return;
    }
    var cost = getSpecialUpgradeCost(upg);
    if (state.points < cost) { showStackedToast("spec_afford_" + id, "Не хватает очков: нужно " + formatNumber(cost)); playSound("deny"); return; }
    state.points -= cost;
    state.upgrades[id] = level + 1;
    recalculateStats();
    renderShop();
    updateUi(true);
    playSound("buy");
    var newLevel = state.upgrades[id];
    showToast("Куплено: " + upg.name + (maxLevel > 1 ? " ур. " + newLevel + "/" + maxLevel : "") + "!");
    saveGame();
  }

  function isUpgradePhaseUnlocked(upgrade) {
    var needed = PHASE_UNLOCK_STAGES[upgrade.phase || 1] || 0;
    return state.stage >= needed;
  }

  function buyUpgrade(id) {
    var upgrade = upgrades.find(function (item) { return item.id === id; });
    if (!upgrade) return;

    if (!isUpgradePhaseUnlocked(upgrade)) {
      var neededStage = (PHASE_UNLOCK_STAGES[upgrade.phase || 1] || 0) + 1;
      showStackedToast("deny_phase_" + id, "Фаза " + upgrade.phase + " откроется на стадии " + neededStage);
      playSound("deny");
      return;
    }

    var level = state.upgrades[id] || 0;
    var maxLevel = upgrade.maxLevel || Infinity;
    if (level >= maxLevel) {
      showStackedToast("deny_max_" + id, "Максимальный уровень куплен (" + maxLevel + ")");
      playSound("deny");
      return;
    }

    var cost = getUpgradeCost(upgrade, level);
    if (state.points < cost) {
      showStackedToast("deny_upgrade_" + id, "Не хватает очков: нужно " + formatNumber(cost));
      playSound("deny");
      return;
    }

    state.points -= cost;
    state.upgrades[id] = level + 1;
    state.mutations += upgrade.multiplier || upgrade.combo || upgrade.crit || upgrade.jackpot ? 1 : 0;
    recalculateStats();
    renderShop();
    updateUi(true);
    triggerShake();
    playSound("buy");
    showUpgradeToast(upgrade, state.upgrades[id]);
  }

  function getBossSpan() {
    var currentStage = stages[state.stage];
    var nextStage = stages[state.stage + 1];
    var currentNeed = currentStage ? currentStage.need : 0;
    var nextNeed = nextStage ? nextStage.need : currentNeed + getFinalStageVirtualHp();
    return Math.max(1, nextNeed - currentNeed);
  }

  function getBossHpRemaining() {
    var currentStage = stages[state.stage];
    var nextStage = stages[state.stage + 1];
    if (!currentStage || !nextStage) return Infinity;
    return Math.max(0, nextStage.need - state.totalPoints);
  }

  function snapDefeatedBoss(amount) {
    var nextStage = stages[state.stage + 1];
    if (!nextStage || amount <= 0 || state.totalPoints >= nextStage.need) return;

    var remaining = nextStage.need - state.totalPoints;
    var displayEpsilon = 0.005;
    var precisionEpsilon = Math.abs(nextStage.need) * Number.EPSILON * 8;
    if (remaining <= Math.max(displayEpsilon, precisionEpsilon)) {
      state.totalPoints = nextStage.need;
    }
  }

  function getPetPowerScale() {
    var span = getBossSpan();
    var stageFactor = Math.max(0.14, Math.min(1, Math.pow(BALANCE_PET_SPAN_REF / span, 0.14)));
    return BALANCE_PET_BASE * stageFactor;
  }

  function getUpgradePowerScale() {
    var span = getBossSpan();
    return Math.max(0.4, Math.min(1, Math.pow(BALANCE_UPGRADE_SPAN_REF / span, 0.1)));
  }

  function recalculateStats() {
    var clickPower = 1;
    var income = 0;
    var multiplier = 1;
    var critChance = 0.05;
    var jackpotChance = 0.01;
    var activePets = getActivePets();
    var petSummaries = [];
    var upgradeScale = getUpgradePowerScale();

    var clickMult = 1;
    upgrades.forEach(function (upgrade) {
      var level = state.upgrades[upgrade.id] || 0;
      clickPower += (upgrade.click || 0) * level * upgradeScale;
      income += (upgrade.income || 0) * level * upgradeScale;
      multiplier += (upgrade.multiplier || 0) * level * upgradeScale;
      critChance += (upgrade.crit || 0) * level * upgradeScale;
      jackpotChance += (upgrade.jackpot || 0) * level * upgradeScale;
      clickMult += (upgrade.clickMult || 0) * level * upgradeScale;
    });

    state.petComboBonus = 0;
    state.duplicateClickChance = 0;
    state.jackpotBoostChance = 0;
    state.passiveCombo = 0;
    var rawPetIncomeMult = 0;
    activePets.forEach(function (activePet) {
      var petBonus = getPetBonus(activePet);
      income += petBonus.income + (petBonus.autoclick * clickPower * BALANCE_PET_AUTOCLICK_INCOME);
      rawPetIncomeMult += petBonus.incomeMult;
      critChance += petBonus.crit;
      state.petComboBonus += petBonus.combo;
      state.duplicateClickChance += petBonus.duplicate;
      state.jackpotBoostChance += petBonus.jackpotBoost;
      state.passiveCombo += petBonus.passiveCombo;
      petSummaries.push(shortPetBonus(activePet, petBonus));
    });

    var PET_MULT_CAP = 0.55;
    var softPetMult = rawPetIncomeMult <= PET_MULT_CAP
      ? rawPetIncomeMult
      : PET_MULT_CAP + Math.sqrt(rawPetIncomeMult - PET_MULT_CAP) * 0.38;
    multiplier += softPetMult;
    state.duplicateClickChance = Math.min(0.28, state.duplicateClickChance);
    state.jackpotBoostChance = Math.min(0.06, state.jackpotBoostChance);
    var RAW_COMBO_CAP = 0.12;
    state.petComboBonus = state.petComboBonus <= RAW_COMBO_CAP
      ? state.petComboBonus
      : RAW_COMBO_CAP + Math.sqrt(state.petComboBonus - RAW_COMBO_CAP) * 0.32;
    state.passiveCombo = Math.min(0.08, state.passiveCombo);

    if (state.rebirths >= 5) {
      var mirrorSource = getMirrorSourcePet();
      if (mirrorSource) {
        var mirrorBonus = getPetBonus(mirrorSource);
        income += mirrorBonus.income + (mirrorBonus.autoclick * clickPower * BALANCE_PET_AUTOCLICK_INCOME);

        var mirrorMult = mirrorBonus.incomeMult;
        var mirrorSoftMult = mirrorMult <= PET_MULT_CAP
          ? mirrorMult
          : PET_MULT_CAP + Math.sqrt(mirrorMult - PET_MULT_CAP) * 0.38;
        multiplier += mirrorSoftMult;
        critChance += mirrorBonus.crit;
        state.petComboBonus += mirrorBonus.combo;
        state.duplicateClickChance = Math.min(0.28, state.duplicateClickChance + mirrorBonus.duplicate);
        state.jackpotBoostChance = Math.min(0.06, state.jackpotBoostChance + mirrorBonus.jackpotBoost);
        state.passiveCombo += mirrorBonus.passiveCombo;
        petSummaries.push("🪞 " + mirrorSource.name);
      }
    }

    state.petBonusText = petSummaries.length ? petSummaries.length + "/3 В· " + petSummaries[0] : "нет";

    var RAW_MULT_CAP = 8;
    var softMultiplier = multiplier <= RAW_MULT_CAP
      ? multiplier
      : RAW_MULT_CAP + Math.sqrt(multiplier - RAW_MULT_CAP) * 0.65;

    var stageBonus = 1 + state.stage * 0.034;
    var rebirthMult = 1 + (state.rebirths || 0) * 0.5;
    var luckMult = getLuckMult();
    state.clickPower = clickPower * clickMult * (state._adBuffUpgrade || 1) * rebirthMult;
    state.income = income * softMultiplier * stageBonus * (state._adBuffPet || 1) * (state._adBuffPassive || 1) * rebirthMult;
    state.multiplier = softMultiplier * stageBonus * rebirthMult;
    state.critChance = Math.min(0.55, critChance * rebirthMult * luckMult);
    state.jackpotChance = Math.min(0.12, jackpotChance * rebirthMult * luckMult);
  }

  function getComboStep() {
    var bonus = 0.01;
    var upgradeScale = getUpgradePowerScale();
    upgrades.forEach(function (upgrade) {
      bonus += (upgrade.combo || 0) * (state.upgrades[upgrade.id] || 0) * upgradeScale;
    });
    bonus += state.petComboBonus;
    return bonus;
  }

  function getEventMultiplier(type) {
    if (now() > state.eventUntil) return type === "comboLimit" ? 2.5 : 1;
    if (state.eventType === "storm" && type === "click") return 2;
    if (state.eventType === "rain" && type === "income") return 3;
    if (state.eventType === "combo" && type === "comboLimit") return 5;
    return type === "comboLimit" ? 2.5 : 1;
  }

  var STAGE_TIER_NAMES = ["Обычный", "Редкий", "Эпический", "Космический", "Трансцендентный", "Демонический"];
  function getStageRarityTier(stageIndex) {
    var n = stageIndex + 1;
    if (n <= 5)  return 1;
    if (n <= 10) return 2;
    if (n <= 15) return 3;
    if (n <= 20) return 4;
    if (n <= 25) return 5;
    return 6;
  }

  function updateStage(silent) {
    var oldStage = state.stage;
    var nextStage = 0;
    for (var i = 0; i < stages.length; i += 1) {
      if (state.totalPoints >= stages[i].need) nextStage = i;
    }
    state.stage = nextStage;
    if (oldStage !== state.stage || silent) {
      document.body.className = document.body.className.replace(/\bstage-\d+\b|\bstage-tier-\d+\b/g, "").trim();
      var tier = getStageRarityTier(state.stage);
      document.body.classList.add("stage-" + (state.stage + 1));
      document.body.classList.add("stage-tier-" + tier);
      els.creatureSymbol.textContent = stages[state.stage].symbol;

      var badgeEl = document.getElementById("stageRarityBadge");
      if (badgeEl) {
        badgeEl.textContent = STAGE_TIER_NAMES[tier - 1];
      }
      recalculateStats();
      syncVisualModState(true);
      if (!silent && stages[state.stage]) {
        showToast(stages[state.stage].toast);
        triggerFlash();
        playSound("evolve");
      }
    }
  }

  function getStageNumber() {
    return state.stage + 1;
  }

  function getVisualModState() {
    var stageNumber = getStageNumber();
    var bossHp = getStageBossHpRatio();
    if (stageNumber >= 28) {
      if (bossHp <= 0.33) return 4;
      if (bossHp <= 0.66) return 3;
      return 2;
    }
    if (stageNumber >= 24) {
      if (bossHp <= 0.4) return 3;
      if (bossHp <= 0.7) return 2;
      return 1;
    }
    if (stageNumber < 15) return 0;
    if (stageNumber < 20) return bossHp <= 0.5 ? 1 : 0;
    if (bossHp <= 0.33) return 3;
    if (bossHp <= 0.66) return 2;
    return 0;
  }

  function getStageBossHpRatio() {
    var currentStage = stages[state.stage];
    var nextStage = stages[state.stage + 1];
    var currentNeed = currentStage ? currentStage.need : 0;
    var nextNeed = nextStage ? nextStage.need : currentNeed + getFinalStageVirtualHp();
    var span = Math.max(1, nextNeed - currentNeed);
    var progress = Math.max(0, Math.min(1, (state.totalPoints - currentNeed) / span));
    return 1 - progress;
  }

  function getFinalStageVirtualHp() {
    var currentStage = stages[state.stage];
    var previousStage = stages[Math.max(0, state.stage - 1)];
    if (!currentStage || !previousStage) return Math.max(1, state.totalPoints || 1);
    return Math.max(1, currentStage.need - previousStage.need);
  }

  function getVisualModParticleBonus() {
    var stageNumber = getStageNumber();
    var stageBonus = stageNumber >= 28 ? 12 : stageNumber >= 24 ? 8 : stageNumber >= 21 ? 5 : stageNumber >= 16 ? 3 : stageNumber >= 11 ? 1 : 0;
    if (state.visualModState === 4) return stageBonus + 16;
    if (state.visualModState === 3) return stageBonus + 10;
    if (state.visualModState === 2) return stageBonus + 6;
    if (state.visualModState === 1) return stageBonus + 3;
    return stageBonus;
  }

  function syncVisualModState(force) {
    var stageNumber = getStageNumber();
    var charge = stageNumber < 15 ? 0 : 1 - getStageBossHpRatio();
    var nextState = getVisualModState();
    var bodyStyle = document.body.style;

    if (force || Math.abs(charge - state.visualCharge) > 0.002) {
      var stageN = getStageNumber();
      var isUltimateTier = stageN >= 28;
      bodyStyle.setProperty("--mod-aura-opacity", (0.78 + charge * (isUltimateTier ? 0.28 : 0.2)).toFixed(3));
      bodyStyle.setProperty("--mod-aura-opacity-peak", (0.9 + charge * (isUltimateTier ? 0.22 : 0.16)).toFixed(3));
      bodyStyle.setProperty("--mod-aura-blur", (12 + charge * (isUltimateTier ? 18 : 10)).toFixed(1) + "px");
      bodyStyle.setProperty("--mod-aura-blur-peak", (17 + charge * (isUltimateTier ? 24 : 14)).toFixed(1) + "px");
      bodyStyle.setProperty("--mod-eye-glow", (4 + charge * (isUltimateTier ? 36 : 20)).toFixed(1) + "px");
      state.visualCharge = charge;
    }

    if (force || nextState !== state.visualModState) {
      document.body.classList.remove("mod-phase-1", "mod-phase-2", "mod-phase-3", "mod-phase-4");
      if (nextState > 0) document.body.classList.add("mod-phase-" + nextState);
      if (!force && nextState > state.visualModState) triggerVisualPhaseBurst(nextState);
      state.visualModState = nextState;
    }
  }

  function triggerVisualPhaseBurst(modState) {
    var rect = els.creature.getBoundingClientRect();
    var x = rect.left + rect.width / 2;
    var y = rect.top + rect.height / 2;

    spawnParticles(x, y, modState === 4 ? 28 : modState === 3 ? 20 : modState === 2 ? 14 : 10, modState >= 3);
    if (modState >= 2) triggerTinyShake();
    if (modState >= 3) triggerFlash();

    if (modState === 2) {

      triggerShake();
      triggerBossPhaseFlash("#ff3d00");
      spawnParticles(x, y, 22, false);
      spawnFloatingText(x, y - 90, "РАЗЪЯРЁН!", "#ff6600");
      showBigAnnouncement("⚡ БОСС РАЗЪЯРЁН ⚡");
      playSound("event");
      showToast("⚠️ Босс переходит во вторую фазу!");
    } else if (modState === 3) {

      triggerShake();
      setTimeout(triggerShake, 180);
      triggerFlash();
      triggerBossPhaseFlash("#cc00ff");
      spawnParticles(x, y, 32, true);
      spawnCenterBurst("#cc00ff");
      spawnFloatingText(x, y - 110, "ФИНАЛЬНАЯ ФОРМА!", "#ee00ff");
      showBigAnnouncement("💀 ФИНАЛЬНАЯ ФОРМА 💀");
      playSound("jackpot");
      setTimeout(function () { playSound("evolve"); }, 220);
      showToast("💀 Босс активирует финальную форму!");
    }
  }

  function emitVisualAuraParticles(dt) {
    if (state.visualModState === 0 || state.hatching) return;

    state.visualParticleTimer -= dt;
    if (state.visualParticleTimer > 0) return;

    state.visualParticleTimer = state.visualModState === 4
      ? 0.07 + Math.random() * 0.04
      : state.visualModState === 1
        ? 0.22 + Math.random() * 0.08
        : state.visualModState === 2
          ? 0.16 + Math.random() * 0.06
          : 0.11 + Math.random() * 0.05;

    var rect = els.creature.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    var radius = Math.max(rect.width, rect.height) * 0.48;
    var colors = state.visualModState === 4
      ? ["#ff0000", "#ff123f", "#7c2dff", "#ffffff", "#ff6b00", "#000000"]
      : state.visualModState === 3
        ? ["#ffffff", "#ffeb3b", "#ff3d81", "#67e8f9"]
        : state.visualModState === 2
          ? ["#ffeb3b", "#ff3d81", "#67e8f9"]
          : ["#61ff8b", "#67e8f9", "#ffffff"];
    var count = state.visualModState === 4 ? 5 : state.visualModState === 3 ? 3 : state.visualModState === 2 ? 2 : 1;

    for (var i = 0; i < count && particles.length < MAX_PARTICLES; i += 1) {
      var angle = Math.random() * Math.PI * 2;
      var spawnRadius = radius * (0.78 + Math.random() * 0.34);
      var speed = state.visualModState === 4 ? 38 + Math.random() * 52 : 22 + Math.random() * 28;
      particles.push({
        x: cx + Math.cos(angle) * spawnRadius,
        y: cy + Math.sin(angle) * spawnRadius,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 18,
        life: 0.45 + Math.random() * 0.35,
        maxLife: 0.78,
        size: 2 + Math.random() * (state.visualModState >= 3 ? 4.8 : state.visualModState === 3 ? 3.6 : 2.2),
        color: colors[(Math.random() * colors.length) | 0]
      });
    }
  }

  function updateUi(force) {
    var time = performance.now();
    if (!force && time - lastUiUpdate < 80) return;
    lastUiUpdate = time;

    els.pointsText.textContent = formatNumber(state.points);
    els.incomeText.textContent = formatNumber(state.income * getEventMultiplier("income")) + "/с";
    els.clickPowerText.textContent = formatNumber(state.clickPower * state.multiplier);
    els.comboText.textContent = "x" + state.combo.toFixed(2);
    els.critText.textContent = Math.round(state.critChance * 100) + "%";
    els.jackpotText.textContent = Math.round(state.jackpotChance * 1000) / 10 + "%";
    els.mutationText.textContent = formatNumber(state.mutations);
    els.petBonusText.textContent = state.petBonusText;

    var rebirthStatEl = document.getElementById("rebirthStatText");
    if (rebirthStatEl) {
      rebirthStatEl.textContent = state.rebirths > 0
        ? state.rebirths + "/5 · ×" + (1 + state.rebirths * 0.5).toFixed(1)
        : "нет";
    }
    els.stageName.textContent = stages[state.stage].name;
    els.soundButton.textContent = state.sound ? "🔊" : "🔇";
    updateActivePetView();
    updateEquippedPetsBtnCount();

    var next = stages[state.stage + 1];
    if (next) {
      var prevNeed = stages[state.stage].need;
      var progress = (state.totalPoints - prevNeed) / (next.need - prevNeed);
      els.evolutionProgress.style.width = Math.max(0, Math.min(100, progress * 100)) + "%";
      els.nextStageText.textContent = "До следующей формы: " + formatNumber(Math.max(0, next.need - state.totalPoints));
    } else {
      els.evolutionProgress.style.width = "100%";
      els.nextStageText.textContent = "Финальная форма открыта. Дальше только шум.";
    }

    updateShopAffordability();
    updateEventBanner();
    updateRebirthButton();
  }

  function renderShop() {
    updateShopPageTabs();
    if (state.shopPage === "eggs") {
      renderEggShop();
      return;
    }
    renderUpgradeShop();
  }

  function updateShopPageTabs() {
    if (!els.shopPageTabs) return;
    els.shopPageTabs.forEach(function (tab) {
      var active = tab.dataset.shopPage === state.shopPage;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function renderUpgradeShop() {
    els.shopTitle.textContent = "Улучшения";
    els.shopMiniTitle.textContent = "Магазин безумия";
    if (els.shopPageButton) els.shopPageButton.textContent = "Яйца →";

    var phaseLabels = {
      1: "⚡ Фаза 1 — Ранняя игра",
      2: "🔥 Фаза 2 — Средняя игра",
      3: "💫 Фаза 3 — Поздняя игра",
      4: "🌌 Фаза 4 — Финал"
    };

    var html = "";
    var lastPhase = 0;
    upgrades.forEach(function (upgrade) {
      var level = state.upgrades[upgrade.id] || 0;
      var phase = upgrade.phase || 1;
      var maxLevel = upgrade.maxLevel || null;
      var isEndgame = phase >= 4;
      var isLate = phase >= 3;
      var phaseUnlocked = isUpgradePhaseUnlocked(upgrade);
      var isMaxed = maxLevel !== null && level >= maxLevel;

      if (phase !== lastPhase) {
        lastPhase = phase;
        var phaseLabel = phaseLabels[phase] || "Фаза " + phase;
        var unlockNote = "";
        if (!phaseUnlocked) {
          var stageNeeded = (PHASE_UNLOCK_STAGES[phase] || 0) + 1;
          unlockNote = ' <span class="phase-lock-note">🔒 Откроется на стадии ' + stageNeeded + '</span>';
        }
        html += '<div class="upgrade-phase-header upgrade-phase-' + phase + '">' + phaseLabel + unlockNote + '</div>';
      }

      if (!phaseUnlocked) {
        html += [
          '<div class="upgrade-row">',
          '<button class="upgrade-button upgrade-phase-locked" type="button" disabled>',
          '<span class="upgrade-icon">' + upgrade.icon + '</span>',
          '<span>',
          '<span class="upgrade-name">' + upgrade.name + '</span>',
          '<span class="upgrade-desc upgrade-locked-hint">🔒 Недоступно — нужна стадия ' + ((PHASE_UNLOCK_STAGES[phase] || 0) + 1) + '</span>',
          '</span>',
          '</button>',
          '</div>'
        ].join("");
        return;
      }

      var cost = getUpgradeCost(upgrade, level);
      var maxLevelNote = maxLevel !== null ? (isMaxed ? ' <small class="upgrade-maxed">МАКС</small>' : ' <small class="upgrade-maxlevel">макс ' + maxLevel + '</small>') : '';

      html += [
        '<div class="upgrade-row">',
        '<button class="upgrade-button' + (isEndgame ? ' upgrade-endgame' : isLate ? ' upgrade-late' : '') + (isMaxed ? ' upgrade-maxed-btn' : '') + '" type="button" data-id="' + upgrade.id + '"' + (isMaxed ? ' disabled' : '') + '>',
        '<span class="upgrade-icon">' + upgrade.icon + '</span>',
        '<span>',
        '<span class="upgrade-name">' + upgrade.name + '<small>ур. ' + level + (maxLevel !== null ? '/' + maxLevel : '') + '</small>' + maxLevelNote + '</span>',
        '<span class="upgrade-desc">' + upgrade.desc + '</span>',
        '<span class="upgrade-meta">' + (isMaxed ? '✅ Максимальный уровень' : 'Цена: ' + formatNumber(cost) + ' | ' + describeUpgrade(upgrade)) + '</span>',
        '</span>',
        '</button>',
        isMaxed ? '' : adGetUpgradeAdBtn(upgrade.id),
        '</div>'
      ].join("");
    });

    els.shopList.innerHTML = html + renderSpecialUpgradesHtml();
    updateShopAffordability();
  }

  function renderSpecialUpgradesHtml() {
    var html = '<div class="upgrade-phase-header upgrade-phase-special">✨ Специальные улучшения перерождений</div>';

    SPECIAL_UPGRADES.forEach(function (upg) {
      var level = state.upgrades[upg.id] || 0;
      var maxLevel = upg.maxLevel || 1;
      var bought = level >= maxLevel;
      var required = upg.rebirthRequired || 0;
      var prerequisite = getSpecialUpgradeRequirement(upg);
      var missingPrerequisite = prerequisite && !state.upgrades[prerequisite.id];
      var locked = state.rebirths < required || missingPrerequisite;
      var cost = getSpecialUpgradeCost(upg);
      var canAfford = state.points >= cost;
      var cls = "upgrade-button upgrade-special";
      if (bought) cls += " upgrade-special-bought";
      else if (locked) cls += " upgrade-special-locked";
      else if (!canAfford) cls += " upgrade-cannot-afford";

      var levelLabel = maxLevel > 1
        ? "<small>ур. " + level + "/" + maxLevel + "</small>"
        : (bought ? "<small>куплено</small>" : "");

      var metaText;
      if (bought) {
        metaText = "✅ Куплено";
      } else if (missingPrerequisite) {
        metaText = "🔒 Сначала купи: " + prerequisite.name;
      } else if (locked) {
        metaText = "🔒 Нужно " + required + " перерожд. (у тебя " + state.rebirths + ")";
      } else {
        metaText = "Цена: " + formatNumber(cost) + " очков" + (maxLevel > 1 ? " · след. ур." : "");
      }

      var effectText = "";
      if (upg.id === "luck_mult" || upg.id === "luck_ultra") {
        var mult = getLuckMult();
        effectText = '<span class="upgrade-meta upgrade-special-effect">Текущий множитель удачи: ×' + mult.toFixed(2) + '</span>';
      }

      html += [
        '<div class="upgrade-row">',
        '<button class="' + cls + '" type="button" data-special-id="' + upg.id + '"' + (bought || locked ? ' disabled' : '') + '>',
        '<span class="upgrade-icon' + ([...upg.icon].length > 1 ? ' upgrade-icon-multi' : '') + '">' + upg.icon + '</span>',
        '<span>',
        '<span class="upgrade-name">' + upg.name + levelLabel + '</span>',
        '<span class="upgrade-desc">' + upg.desc + '</span>',
        '<span class="upgrade-meta">' + metaText + '</span>',
        effectText,
        '</span>',
        '</button>',
        '</div>'
      ].join("");
    });

    html += renderMirrorPetBlock();

    return html;
  }

  function getMirrorSourcePet() {

    var best = null;
    var bestScore = -1;
    pets.forEach(function (pet) {
      if (!state.pets[pet.id]) return;
      var b = getPetBonus(pet);
      var score = b.income + b.autoclick * 1000 + b.incomeMult * 1e15;
      if (score > bestScore) { bestScore = score; best = pet; }
    });
    return best;
  }

  function renderMirrorPetBlock() {
    var unlocked = state.rebirths >= 5;
    var source = unlocked ? getMirrorSourcePet() : null;
    var cls = "upgrade-button upgrade-special upgrade-mirror-pet" + (unlocked ? "" : " upgrade-special-locked");
    var metaText = unlocked
      ? (source ? "Активен · копирует: " + source.name : "Нет питомцев для копирования")
      : "🔒 Нужно 5 перерождений (у тебя " + state.rebirths + ")";
    var faceText = source ? source.face : "?";
    var rarityName = source ? (rarities[source.rarity] ? rarities[source.rarity].name : "") : "";
    return [
      '<div class="upgrade-row">',
      '<button class="' + cls + '" type="button" disabled>',
      '<span class="upgrade-icon">🪞</span>',
      '<span>',
      '<span class="upgrade-name">Зеркальный Брейнрот <small>' + (unlocked ? "активен" : "заблокирован") + '</small></span>',
      '<span class="upgrade-desc">Динамически копирует статы сильнейшего питомца. Обновляется в реальном времени.</span>',
      '<span class="upgrade-meta">' + metaText + '</span>',
      unlocked && source ? '<span class="upgrade-meta upgrade-special-effect">Сейчас: ' + faceText + ' ' + source.name + ' (' + rarityName + ')</span>' : '',
      '</span>',
      '</button>',
      '</div>'
    ].join("");
  }

  function renderEggShop() {
    els.shopTitle.textContent = "Брейнрот-яйца";
    els.shopMiniTitle.textContent = "Яйца и питомцы";
    if (els.shopPageButton) els.shopPageButton.textContent = "← Улучшения";
    var eggHtml = '<div class="egg-grid">' + eggs.map(function (egg) {
      var eggState = getEggUiState(egg);
      return [
        '<article class="egg-card egg-tier-' + egg.tier + (eggState.unlocked ? '' : ' locked') + '" data-egg-card="' + egg.id + '">',
        '<div class="egg-main">',
        '<span class="egg-icon">' + egg.icon + '</span>',
        '<span class="egg-info">',
        '<span class="egg-name">' + egg.name + '</span>',
        '<span class="egg-desc">' + egg.desc + '</span>',
        '<span class="egg-meta-row">',
        '<span class="egg-meta"><b>Цена</b><em>' + formatNumber(egg.cost) + '</em></span>',
        '<span class="egg-meta"><b>Стадия</b><em>' + egg.unlockStage + '</em></span>',
        '</span>',
        '</span>',
        '</div>',
        '<div class="egg-card-actions">',
        '<button class="egg-button ' + eggState.className + '" type="button" data-id="' + egg.id + '"><span class="egg-action">' + eggState.label + '</span></button>',
        '<button class="egg-chances-btn" type="button" data-egg-chances="' + egg.id + '" aria-expanded="false">Шансы</button>',
        '</div>',
        adGetEggAdSection(egg),
        '<div class="egg-preview">',
        '<strong>Возможные брейнроты</strong>',
        '<div class="egg-drop-list">',
        egg.drops.map(renderEggDropPreview).join(""),
        '</div>',
        '</div>',
        '</article>'
      ].join("");
    }).join("") + '</div>';

    var owned = pets.filter(function (pet) { return (state.pets[pet.id] || 0) > 0; });
    var inventoryHtml = [
      '<div class="inventory-divider"><span class="inventory-divider-line"></span><span class="inventory-divider-text">⚡ ИНВЕНТАРЬ БРЕЙНРОТОВ ⚡</span><span class="inventory-divider-line"></span></div><div class="inventory-slots-badge">экипировано ' + state.activePetIds.length + '/' + getMaxPetSlots() + '</div>',
      owned.length ? '<div class="pet-grid">' + owned.map(renderPetCard).join("") + '</div>' : '<div class="empty-inventory">Пока пусто. Открой яйцо и получи первого странного помощника.</div>'
    ].join("");

    els.shopList.innerHTML = eggHtml + inventoryHtml;
    updateShopAffordability();
  }

  function toggleEggPreview(button) {
    var card = button.closest(".egg-card");
    if (!card) return;
    var willOpen = !card.classList.contains("preview-open");
    els.shopList.querySelectorAll(".egg-card.preview-open").forEach(function (item) {
      item.classList.remove("preview-open");
      var openButton = item.querySelector("[data-egg-chances]");
      if (openButton) openButton.setAttribute("aria-expanded", "false");
    });
    card.classList.toggle("preview-open", willOpen);
    button.setAttribute("aria-expanded", willOpen ? "true" : "false");
    playSound(willOpen ? "buy" : "click");
  }

  function updateShopAffordability() {
    var buttons = els.shopList.querySelectorAll(".upgrade-button");
    buttons.forEach(function (button) {

      if (button.classList.contains("upgrade-special")) return;
      if (button.classList.contains("upgrade-phase-locked")) return;
      var upgrade = upgrades.find(function (item) { return item.id === button.dataset.id; });
      if (!upgrade) return;
      var level = state.upgrades[upgrade.id] || 0;
      var maxLevel = upgrade.maxLevel || Infinity;
      if (level >= maxLevel) {
        button.classList.remove("locked");
        return;
      }
      var cost = getUpgradeCost(upgrade, level);
      button.classList.toggle("locked", state.points < cost);
    });
    var petUpgradeBtns = els.shopList.querySelectorAll(".pet-upgrade-btn:not(.pet-upgrade-maxed)");
    petUpgradeBtns.forEach(function (btn) {
      var pet = getPetById(btn.dataset.id);
      if (!pet) return;
      var cost = getPetUpgradeCost(pet);
      var canAfford = state.points >= cost;
      btn.classList.toggle("pet-upgrade-locked", !canAfford);
    });
    var eggButtons = els.shopList.querySelectorAll(".egg-button");
    eggButtons.forEach(function (button) {
      var egg = eggs.find(function (item) { return item.id === button.dataset.id; });
      var eggState = getEggUiState(egg);
      var action = button.querySelector(".egg-action");
      button.classList.toggle("locked", !eggState.unlocked);
      button.classList.toggle("no-money", eggState.unlocked && !eggState.canAfford);
      button.classList.toggle("hatching", eggState.unlocked && eggState.canAfford && state.hatching);
      if (action) action.textContent = eggState.label;
    });
  }

  function getEggUiState(egg) {
    if (!egg) return { unlocked: false, canAfford: false, label: "Закрыто", className: "locked" };

    var price = finiteNumber(egg.cost, Infinity);
    var points = finiteNumber(state.points, 0);
    var unlocked = isEggUnlocked(egg);
    var canAfford = points >= price;
    var className = !unlocked ? "locked" : !canAfford ? "no-money" : state.hatching ? "hatching" : "";
    var label = !unlocked ? "Закрыто" : !canAfford ? "Не хватает" : state.hatching ? "Открывается" : "Открыть";

    return {
      unlocked: unlocked,
      canAfford: canAfford,
      label: label,
      className: className
    };
  }

  function openEgg(id) {
    var egg = eggs.find(function (item) { return item.id === id; });
    if (!egg || state.hatching) return;
    if (!isEggUnlocked(egg)) {
      showStackedToast("egg_locked_" + id, "Яйцо откроется на стадии " + egg.unlockStage);
      playSound("deny");
      return;
    }
    if (finiteNumber(state.points, 0) < finiteNumber(egg.cost, Infinity)) {
      showStackedToast("deny_egg_" + id, "Не хватает очков: нужно " + formatNumber(egg.cost));
      playSound("deny");
      return;
    }

    state.points -= egg.cost;
    state.hatching = true;
    updateUi(true);
    updateShopAffordability();
    var pet = rollEggPet(egg);
    startHatchAnimation(egg, pet);
  }

  function rollEggPet(egg) {
    var roll = Math.random() * 100;
    var total = 0;
    for (var i = 0; i < egg.drops.length; i += 1) {
      total += egg.drops[i].chance;
      if (roll <= total) return getPetById(egg.drops[i].pet);
    }
    return getPetById(egg.drops[egg.drops.length - 1].pet);
  }

  function startHatchAnimation(egg, pet) {
    var rarity = rarities[pet.rarity];
    els.hatchOverlay.classList.remove("hidden");
    els.hatchOverlay.classList.remove("revealed");
    els.hatchOverlay.classList.toggle("ultra-hatch", isUltraRarity(pet.rarity));
    els.hatchCard.className = "hatch-card shaking";
    els.hatchEgg.textContent = egg.icon;
    els.hatchResult.classList.add("hidden");
    triggerShake();
    triggerFlash();
    playSound("event");

    setTimeout(function () {
      els.hatchCard.className = "hatch-card revealed " + rarity.className;
      els.hatchOverlay.classList.add("revealed");
      els.hatchPetFace.textContent = pet.face;
      els.hatchPetName.textContent = pet.name;
      els.hatchPetRarity.textContent = rarity.name;
      els.hatchPetRarity.className = rarity.className;
      els.hatchPetBonus.textContent = "Бонус: " + describePetBonus(getPetBonus(pet));
      els.hatchResult.classList.remove("hidden");
      addOwnedPet(pet);
      showToast(rarity.name + " брейнрот: " + pet.name + "!");
      if (isUltraRarity(pet.rarity)) {
        showBigAnnouncement(getUltraAnnouncement(pet));
        els.hatchCard.classList.add("ultra-reveal");
      }
      spawnCenterBurst(rarity.color);
      triggerShake();
      triggerFlash();
      if (isUltraRarity(pet.rarity)) {
        setTimeout(triggerShake, 120);
        setTimeout(triggerFlash, 180);
      }
      playSound(isUltraRarity(pet.rarity) || pet.rarity === "mythic" || pet.rarity === "legendary" ? "jackpot" : "evolve");
      recalculateStats();
      renderShop();
      updateUi(true);
      saveGame();
    }, 900);

    setTimeout(function () {
      els.hatchOverlay.classList.add("hidden");
      els.hatchOverlay.classList.remove("ultra-hatch");
      state.hatching = false;
      updateShopAffordability();
    }, 2700);
  }

  function addOwnedPet(pet) {
    state.pets[pet.id] = (state.pets[pet.id] || 0) + 1;
    if (state.activePetIds.indexOf(pet.id) === -1 && state.activePetIds.length < getMaxPetSlots()) {
      state.activePetIds.push(pet.id);
    }
  }

  function equipPet(id) {
    if (!state.pets[id]) return;
    var maxSlots = getMaxPetSlots();
    var index = state.activePetIds.indexOf(id);
    if (index !== -1) {
      state.activePetIds.splice(index, 1);
    } else if (state.activePetIds.length < maxSlots) {
      state.activePetIds.push(id);
    } else {
      state.activePetIds.shift();
      state.activePetIds.push(id);
      showToast("Первый слот заменён новым питомцем");
    }
    recalculateStats();
    renderShop();
    updateUi(true);
    playSound("buy");
    showStackedToast("equip_pet", "Активные питомцы: " + state.activePetIds.length + "/" + maxSlots);
    saveGame();
  }

  function renderPetCard(pet) {
    var rarity = rarities[pet.rarity];
    var count = state.pets[pet.id] || 0;
    var slot = state.activePetIds.indexOf(pet.id);
    var active = slot !== -1;
    var level = getPetLevel(pet.id);
    var maxLevel = getPetMaxLevel(pet);
    var isMaxed = level >= maxLevel;
    var upgCost = getPetUpgradeCost(pet);
    var canAfford = !isMaxed && state.points >= upgCost;
    var scalePerLevel = PET_SCALE_PER_LEVEL[pet.rarity] || 0.05;
    var currentBonus = getPetBonus(pet);
    var levelBarPct = Math.round((level / maxLevel) * 100);

    var rarityColor = rarity.color || "#9ca3af";
    var pills = [
      "<span class='pc2-pill pc2-pill-rarity " + rarity.className + "'>" + rarity.name + "</span>"
    ];
    if (count > 1) pills.push("<span class='pc2-pill pc2-pill-dup'>×" + count + "</span>");
    if (active) pills.push("<span class='pc2-pill pc2-pill-slot'>Слот " + (slot + 1) + "</span>");

    var statChips = [];
    if (currentBonus.income)      statChips.push({ icon: "💰", val: formatNumber(currentBonus.income) + "/с" });
    if (currentBonus.autoclick)   statChips.push({ icon: "🖱", val: "×" + (Math.round(currentBonus.autoclick * 10) / 10) });
    if (currentBonus.crit)        statChips.push({ icon: "💥", val: "+" + Math.round(currentBonus.crit * 1000) / 10 + "%" });
    if (currentBonus.combo)       statChips.push({ icon: "🔥", val: "+" + Math.round(currentBonus.combo * 1000) / 10 + "%" });
    if (currentBonus.incomeMult)  statChips.push({ icon: "✨", val: "×" + (1 + Math.round(currentBonus.incomeMult * 100) / 100).toFixed(2) });
    if (currentBonus.duplicate)   statChips.push({ icon: "🔀", val: "+" + Math.round(currentBonus.duplicate * 1000) / 10 + "%" });
    if (currentBonus.jackpotBoost)statChips.push({ icon: "🎰", val: "+" + Math.round(currentBonus.jackpotBoost * 1000) / 10 + "%" });
    if (currentBonus.passiveCombo)statChips.push({ icon: "⚡", val: "+" + Math.round(currentBonus.passiveCombo * 100) + "%" });
    var chipsHtml = statChips.map(function (c) {
      return "<span class='pc2-stat-chip'><span class='pc2-stat-icon'>" + c.icon + "</span><span>" + c.val + "</span></span>";
    }).join("");

    var upgBtnClass = "pet-upgrade-btn" + (isMaxed ? " pet-upgrade-maxed" : canAfford ? "" : " pet-upgrade-locked");
    var upgBtnText = isMaxed
      ? "✦ Максимальный уровень"
      : "▲ Улучшить · " + formatNumber(upgCost);
    var nextStatHint = isMaxed ? "" :
      "<span class='pc2-upg-hint'>+" + Math.round(scalePerLevel * 100) + "% к статам · Ур. " + (level + 1) + "</span>";

    var equipHintHtml = active
      ? "<span class='pc2-equip-active'>✓ Слот " + (slot + 1) + " · нажми чтобы снять</span>"
      : "<span class='pc2-equip-hint'>Нажми чтобы экипировать</span>";

    return [
      "<div class='pc2-wrap" + (active ? " pc2-active" : "") + "'>",

      "<button class='pc2-main " + rarity.className + "' type='button' data-id='" + pet.id + "'>",
        "<div class='pc2-face " + rarity.className + "'>" + pet.face + "</div>",
        "<div class='pc2-header'>",
          "<span class='pc2-name'>" + pet.name + "</span>",
          "<div class='pc2-pills'>" + pills.join("") + "</div>",
          equipHintHtml,
        "</div>",
      "</button>",

      chipsHtml ? "<div class='pc2-stats'>" + chipsHtml + "</div>" : "",

      "<div class='pc2-level'>",
        "<div class='pc2-level-top'>",
          "<span class='pc2-level-label'>Ур. <b>" + level + "</b></span>",
          "<div class='pc2-level-bar-wrap'><div class='pc2-level-bar " + rarity.className + "' style='width:" + levelBarPct + "%'></div></div>",
          "<span class='pc2-level-cap'>" + level + " / " + maxLevel + "</span>",
        "</div>",
        "<div class='pc2-upg-row'>",
          "<button class='" + upgBtnClass + "' type='button' data-id='" + pet.id + "'" + (isMaxed ? " disabled" : "") + ">",
            upgBtnText,
          "</button>",
          nextStatHint,
        "</div>",
      "</div>",

      "</div>"
    ].join("");
  }

  function renderEggDropPreview(drop) {
    var pet = getPetById(drop.pet);
    var rarity = rarities[pet.rarity];
    return [
      '<span class="egg-drop-row ' + rarity.className + '">',
      '<span class="egg-drop-face">' + pet.face + '</span>',
      '<span><b>' + pet.name + '</b><small>' + rarity.name + '</small></span>',
      '<em>' + drop.chance + '%</em>',
      '</span>'
    ].join("");
  }

  function describeEggDrops(egg) {
    return egg.drops.map(function (drop) {
      var pet = getPetById(drop.pet);
      return rarities[pet.rarity].name + " " + drop.chance + "%";
    }).join(" В· ");
  }

  function isEggUnlocked(egg) {
    return state.stage + 1 >= egg.unlockStage;
  }

  function getActivePets() {
    return state.activePetIds.filter(function (id) {
      return state.pets[id] > 0;
    }).slice(0, 3).map(getPetById);
  }

  function getPetById(id) {
    return pets.find(function (pet) { return pet.id === id; }) || pets[0];
  }

  function getPetBonus(pet) {
    var count = Math.max(1, state.pets[pet.id] || 1);
    var duplicateBonus = 1 + (count - 1) * 0.1;
    var levelScalar = getPetLevelScalar(pet);
    var powerScale = getPetPowerScale();
    return {
      income: (pet.income || 0) * duplicateBonus * levelScalar * powerScale,
      incomeMult: (pet.incomeMult || 0) * levelScalar * powerScale,
      crit: (pet.crit || 0) * duplicateBonus * levelScalar * powerScale,
      combo: (pet.combo || 0) * duplicateBonus * levelScalar * powerScale,
      autoclick: (pet.autoclick || 0) * duplicateBonus * levelScalar * powerScale,
      duplicate: (pet.duplicate || 0) * duplicateBonus * levelScalar * powerScale,
      jackpotBoost: (pet.jackpotBoost || 0) * duplicateBonus * levelScalar * powerScale,
      passiveCombo: (pet.passiveCombo || 0) * duplicateBonus * levelScalar * powerScale
    };
  }

  function describePetBonus(bonus) {
    var parts = [];
    if (bonus.income) parts.push("доход +" + formatNumber(bonus.income) + "/с");
    if (bonus.autoclick) parts.push("автоклик +" + Math.round(bonus.autoclick * 10) / 10);
    if (bonus.crit) parts.push("крит +" + Math.round(bonus.crit * 1000) / 10 + "%");
    if (bonus.combo) parts.push("комбо +" + Math.round(bonus.combo * 1000) / 10 + "%");
    if (bonus.incomeMult) parts.push("множитель +" + Math.round(bonus.incomeMult * 100) + "%");
    if (bonus.duplicate) parts.push("дубль +" + Math.round(bonus.duplicate * 1000) / 10 + "%");
    if (bonus.jackpotBoost) parts.push("джекпот-буст +" + Math.round(bonus.jackpotBoost * 1000) / 10 + "%");
    if (bonus.passiveCombo) parts.push("комбо-синтез +" + Math.round(bonus.passiveCombo * 100) + "%");
    return parts.join(", ");
  }

  function shortPetBonus(pet, bonus) {
    return pet.name + " В· " + describePetBonus(bonus).split(", ")[0];
  }

  function updateActivePetView() {
    var activePets = getActivePets();
    var renderKey = activePets.map(function (pet) { return pet.id; }).join("|");
    if (renderKey === activePetRenderKey) return;
    activePetRenderKey = renderKey;
    if (!activePets.length) {
      els.activePet.classList.add("hidden");
      els.activePet.innerHTML = "";
      return;
    }
    els.activePet.className = "active-pets";
    els.activePet.innerHTML = activePets.map(function (pet, index) {
      var rarity = rarities[pet.rarity];
      return '<span class="active-pet pet-orbit-' + (index + 1) + ' ' + rarity.className + '" data-pet-id="' + pet.id + '" title="' + pet.name + ' В· ' + rarity.name + '"><span class="pet-face">' + pet.face + '</span></span>';
    }).join("");
  }

  function openEquippedModal() {
    renderEquippedModal();
    els.equippedModal.classList.remove("hidden");
    playSound("buy");
  }

  function closeEquippedModal() {
    els.equippedModal.classList.add("hidden");
  }

  function openRebirthModal() {
    renderRebirthTrack();
    updateRebirthButton();
    var modal = document.getElementById("rebirthModal");
    if (modal) {
      modal.classList.remove("hidden");
      modal.classList.add("rebirth-modal-open");
    }
    playSound("buy");
  }

  function closeRebirthModal() {
    var modal = document.getElementById("rebirthModal");
    if (modal) {
      modal.classList.remove("rebirth-modal-open");
      modal.classList.add("hidden");
    }
  }

  function renderEquippedModal() {
    var activePets = getActivePets();
    if (!activePets.length) {
      els.equippedModalBody.innerHTML = '<div class="equipped-modal-empty">Ни одного питомца не одето.<br>Открой яйцо в магазине и получи своих первых помощников!</div>';
      return;
    }
    els.equippedModalBody.innerHTML = activePets.map(function (pet, index) {
      var rarity = rarities[pet.rarity];
      var bonus = getPetBonus(pet);
      var buffLines = buildPetBuffLines(bonus);
      return [
        '<div class="equipped-pet-card ' + rarity.className + '">',
        '<div class="equipped-pet-card-face">' + pet.face + '</div>',
        '<span class="equipped-pet-card-slot">Слот ' + (index + 1) + '</span>',
        '<span class="equipped-pet-card-name">' + pet.name + '</span>',
        '<span class="equipped-pet-card-rarity">' + rarity.name + ' · Ур. ' + getPetLevel(pet.id) + '/' + getPetMaxLevel(pet) + '</span>',
        '<div class="equipped-pet-card-buffs">',
        buffLines.map(function (line) {
          return '<div class="equipped-pet-buff-line">' + line + '</div>';
        }).join(""),
        '</div>',
        '</div>'
      ].join("");
    }).join("");
  }

  function buildPetBuffLines(bonus) {
    var lines = [];
    if (bonus.income) lines.push("+" + formatNumber(bonus.income) + "/с к доходу");
    if (bonus.autoclick) lines.push("+" + Math.round(bonus.autoclick * 10) / 10 + " к автоклику");
    if (bonus.crit) lines.push("+" + Math.round(bonus.crit * 1000) / 10 + "% к шансу крита");
    if (bonus.combo) lines.push("+" + Math.round(bonus.combo * 1000) / 10 + "% к комбо");
    if (bonus.incomeMult) lines.push("+" + Math.round(bonus.incomeMult * 100) + "% к множителю дохода");
    if (bonus.duplicate) lines.push("+" + Math.round(bonus.duplicate * 1000) / 10 + "% к шансу дубля");
    if (bonus.jackpotBoost) lines.push("+" + Math.round(bonus.jackpotBoost * 1000) / 10 + "% к джекпот-бусту");
    if (bonus.passiveCombo) lines.push("+" + Math.round(bonus.passiveCombo * 100) + "% к комбо-синтезу");
    return lines.length ? lines : ["Нет активных бонусов"];
  }

  function updateEquippedPetsBtnCount() {
    if (!els.equippedPetsBtnCount) return;
    els.equippedPetsBtnCount.textContent = state.activePetIds.length + "/" + getMaxPetSlots();
  }

  function isUltraRarity(rarity) {
    return rarity === "secret" || rarity === "divine" || rarity === "cosmic" || rarity === "transcendent" || rarity === "demonic";
  }

  function getUltraAnnouncement(pet) {
    if (pet.rarity === "secret") return "СЕКРЕТНЫЙ БРЕЙНРОТ!";
    if (pet.rarity === "divine") return "БОЖЕСТВЕННОЕ ВЫЛУПЛЕНИЕ!";
    if (pet.rarity === "cosmic") return "КОСМИЧЕСКИЙ БРЕЙНРОТ!";
    return "ТРАНСЦЕНДЕНТНЫЙ ШУМ!";
  }

  function showBigAnnouncement(text) {
    if (!els.bigAnnouncement) return;
    els.bigAnnouncement.textContent = text;
    els.bigAnnouncement.classList.remove("hidden");
    els.bigAnnouncement.classList.remove("show");
    void els.bigAnnouncement.offsetWidth;
    els.bigAnnouncement.classList.add("show");
    setTimeout(function () {
      els.bigAnnouncement.classList.add("hidden");
      els.bigAnnouncement.classList.remove("show");
    }, 2600);
  }

  function maybePetAttack(dt) {
    var activePets = getActivePets();
    if (!activePets.length || state.hatching) return;

    if (document.hidden) {
      state.petAttackTimer = 3.8 + Math.random() * 4.2;
      return;
    }
    state.petAttackTimer -= dt;
    if (state.petAttackTimer > 0) return;
    state.petAttackTimer = 3.8 + Math.random() * 4.2;
    if (Math.random() > 0.72) return;

    var pet = activePets[(Math.random() * activePets.length) | 0];
    performPetAttack(pet);
  }

  function performPetAttack(pet) {
    var attacks = [
      { className: "attack-headbutt", text: "БОНК!", sound: "crit" },
      { className: "attack-laser", text: "ПИУ!", sound: "event" },
      { className: "attack-throw", text: "МЕМ!", sound: "buy" },
      { className: "attack-punch", text: "ТЫК!", sound: "click" },
      { className: "attack-spin", text: "ВЖУХ!", sound: "evolve" }
    ];
    var index = Math.abs(hashText(pet.id)) % attacks.length;
    var attack = attacks[index];
    var petEl = els.activePet.querySelector('[data-pet-id="' + pet.id + '"]');
    var rect = els.creature.getBoundingClientRect();
    var x = rect.left + rect.width / 2;
    var y = rect.top + rect.height / 2;

    if (petEl) {
      petEl.classList.remove("attack-headbutt", "attack-laser", "attack-throw", "attack-punch", "attack-spin");
      void petEl.offsetWidth;
      petEl.classList.add(attack.className);
      setTimeout(function () {
        petEl.classList.remove(attack.className);
      }, 620);
    }

    els.creature.classList.remove("attacked");
    void els.creature.offsetWidth;
    els.creature.classList.add("attacked");
    setTimeout(function () {
      els.creature.classList.remove("attacked");
    }, 520);

    spawnParticles(x, y, isUltraRarity(pet.rarity) ? 18 : 10, isUltraRarity(pet.rarity));
    spawnFloatingText(x + (Math.random() - 0.5) * 36, y - 58, attack.text, rarities[pet.rarity].color);
    if (attack.className === "attack-laser") spawnFloatingText(x, y - 22, "~~~~", "#67e8f9");
    triggerTinyShake();
    playSound(attack.sound);
  }

  function hashText(text) {
    var hash = 0;
    for (var i = 0; i < text.length; i += 1) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }

  function triggerTinyShake() {
    els.shell.classList.remove("tiny-shake");
    void els.shell.offsetWidth;
    els.shell.classList.add("tiny-shake");
  }

  function spawnCenterBurst(color, label) {
    var x = window.innerWidth / 2;
    var y = window.innerHeight / 2;
    for (var i = 0; i < 34 && particles.length < MAX_PARTICLES; i += 1) {
      var angle = Math.random() * Math.PI * 2;
      var speed = 140 + Math.random() * 280;
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.7 + Math.random() * 0.45,
        maxLife: 1.15,
        size: 5 + Math.random() * 8,
        color: i % 4 === 0 ? "#ffffff" : color
      });
    }
    spawnFloatingText(x, y - 70, label || "ВЫЛУПЛЕНИЕ!", color);
  }

  function describeUpgrade(upgrade) {
    var parts = [];
    if (upgrade.click) parts.push("клик +" + formatNumber(upgrade.click));
    if (upgrade.clickMult) parts.push("сила клика +" + Math.round(upgrade.clickMult * 100) + "%");
    if (upgrade.income) parts.push("доход +" + formatNumber(upgrade.income) + "/с");
    if (upgrade.multiplier) parts.push("множитель +" + Math.round(upgrade.multiplier * 100) + "%");
    if (upgrade.combo) parts.push("комбо +" + Math.round(upgrade.combo * 1000) / 10 + "%");
    if (upgrade.crit) parts.push("крит +" + Math.round(upgrade.crit * 1000) / 10 + "%");
    if (upgrade.jackpot) parts.push("джекпот +" + Math.round(upgrade.jackpot * 1000) / 10 + "%");
    return parts.join(", ");
  }

  function getUpgradeCost(upgrade, level) {
    return Math.floor(upgrade.baseCost * Math.pow(upgrade.costGrow, level));
  }

  var _autoClickerAccum = 0;
  var AUTO_CLICKER_INTERVAL = 0.25;

  function isAutoClickerActive() {
    return now() < state.autoClickerUntil;
  }

  function autoClickerTick(dt) {
    if (!isAutoClickerActive()) {
      updateAutoClickerButton();
      return;
    }

    _autoClickerAccum += dt;

    if (_autoClickerAccum >= AUTO_CLICKER_INTERVAL) {
      _autoClickerAccum = _autoClickerAccum % AUTO_CLICKER_INTERVAL;
      var rect = els.creatureButton.getBoundingClientRect();
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      handleCreatureClick(cx, cy);
    }
    updateAutoClickerButton();
  }

  function adRequestAutoClicker() {
    if (isAutoClickerActive()) {
      showStackedToast("ac_running", "⚙️ Автокликер уже работает!");
      playSound("deny");
      return;
    }
    var btn = document.getElementById("autoClickerAdBtn");
    if (btn) btn.disabled = true;
    showToast("Реклама загружается...");
    showRewardedAd(function (rewarded) {
      if (btn) btn.disabled = false;
      if (!rewarded) { showToast("Реклама не досмотрена — автокликер не выдан"); return; }
      state.autoClickerUntil = now() + 60000;
      _autoClickerAccum = 0;
      showToast("⚙️ Автокликер запущен на 60 секунд!");
      playSound("evolve");
      updateAutoClickerButton();
    });
  }

  function updateAutoClickerButton() {
    var btn   = document.getElementById("autoClickerAdBtn");
    if (!btn) return;
    var badge = document.getElementById("acBadge");
    if (isAutoClickerActive()) {
      var secsLeft = Math.ceil((state.autoClickerUntil - now()) / 1000);
      btn.disabled = true;
      btn.classList.add("autoclicker-active");
      if (badge) badge.textContent = secsLeft + "с";
    } else {
      btn.disabled = false;
      btn.classList.remove("autoclicker-active");
      if (badge) badge.textContent = "1 мин";
    }
  }

  function getStageActionsEl() {
    var stagePanel = document.querySelector(".stage-panel");
    if (!stagePanel) return null;
    var row = stagePanel.querySelector(".stage-actions");
    if (!row) {
      row = document.createElement("div");
      row.className = "stage-actions";
      stagePanel.appendChild(row);
    }
    var orphanBars = stagePanel.querySelectorAll(":scope > .rebirth-bar, :scope > .autoclicker-bar");
    orphanBars.forEach(function (bar) { row.appendChild(bar); });
    return row;
  }

  function injectAutoClickerButton() {
    if (document.getElementById("autoClickerAdBtn")) return;
    var actionsRow = getStageActionsEl();
    if (!actionsRow) return;
    var wrap = document.createElement("div");
    wrap.className = "autoclicker-bar";
    wrap.innerHTML =
      '<button class="rebirth-open-btn autoclicker-btn" id="autoClickerAdBtn" type="button" aria-label="Авто-кликер на 60 секунд за рекламу">' +
        '🤖 Авто-клик · <span class="ac-time" id="acBadge">1 мин</span>' +
      '</button>';
    actionsRow.appendChild(wrap);
    document.getElementById("autoClickerAdBtn").addEventListener("click", adRequestAutoClicker);
  }

  function loop(time) {

    if (document.hidden) {
      lastTick = time;
      requestAnimationFrame(loop);
      return;
    }

    var dt = Math.min(0.05, (time - lastTick) / 1000);
    lastTick = time;

    if (!gamePaused) {
      if (state.income > 0) {
        addPoints(state.income * getEventMultiplier("income") * (state._adBuffIncome || 1) * dt);
      }
      adTickSecond();
      autoClickerTick(dt);
      aiTick(dt);
      inviteTick(dt);
    }

    if (state.passiveCombo > 0 && now() - state.lastClickAt < 5000) {
      state.combo = Math.min(getEventMultiplier("comboLimit"), state.combo + state.passiveCombo * dt);
    }

    if (now() - state.lastClickAt > 1400 && state.combo > 1) {
      state.combo = Math.max(1, state.combo - dt * 1.7);
      if (state.combo === 1) state.comboClicks = 0;
    }

    emitVisualAuraParticles(dt);
    maybePetAttack(dt);
    drawEffects(dt);
    updateUi();
    requestAnimationFrame(loop);
  }

  function spawnParticles(x, y, count, jackpot) {
    var colors = jackpot ? ["#ffeb3b", "#ffffff", "#61ff8b"] : ["#ffffff", "#61ff8b", "#00d4ff", "#ff3d81"];
    if (state.visualModState === 1) colors.push("#67e8f9");
    if (state.visualModState === 2) colors.push("#ffeb3b", "#ff4d6d");
    if (state.visualModState === 3) colors.push("#ffffff", "#ffeb3b", "#ff4d6d", "#67e8f9");
    if (state.visualModState === 4) colors.push("#ff0000", "#7c2dff", "#ffffff", "#ff6b00", "#ff123f");
    for (var i = 0; i < count && particles.length < MAX_PARTICLES; i += 1) {
      var angle = Math.random() * Math.PI * 2;
      var speed = 90 + Math.random() * (jackpot ? 260 : 150);
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.45 + Math.random() * 0.35,
        maxLife: 0.8,
        size: 3 + Math.random() * (jackpot ? 7 : 5),
        color: colors[(Math.random() * colors.length) | 0]
      });
    }
  }

  function spawnFloatingText(x, y, text, color) {
    if (floatingTexts.length >= MAX_FLOATING) floatingTexts.shift();
    floatingTexts.push({
      x: x + (Math.random() - 0.5) * 24,
      y: y - 20,
      vy: -70 - Math.random() * 35,
      life: 0.95,
      maxLife: 0.95,
      text: text,
      color: color
    });
  }

  function drawEffects(dt) {
    var ctx = els.ctx;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    for (var i = particles.length - 1; i >= 0; i -= 1) {
      var p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.vy += 210 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.font = "900 24px Arial, Helvetica, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (var j = floatingTexts.length - 1; j >= 0; j -= 1) {
      var f = floatingTexts[j];
      f.life -= dt;
      if (f.life <= 0) {
        floatingTexts.splice(j, 1);
        continue;
      }
      f.y += f.vy * dt;
      ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
      ctx.lineWidth = 5;
      ctx.strokeStyle = "rgba(17, 24, 39, 0.75)";
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }

    ctx.globalAlpha = 1;
  }

  function bounceCreature() {
    els.creature.classList.remove("clicked");
    void els.creature.offsetWidth;
    els.creature.classList.add("clicked");
  }

  function triggerShake() {
    els.shell.classList.remove("shake");
    void els.shell.offsetWidth;
    els.shell.classList.add("shake");
  }

  function triggerFlash() {
    var overlay = document.getElementById("screenFlashOverlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "screenFlashOverlay";
      overlay.className = "screen-flash-overlay";
      document.body.appendChild(overlay);
    }
    overlay.classList.remove("flash-active");
    void overlay.offsetWidth;
    overlay.classList.add("flash-active");
  }

  function triggerBossPhaseFlash(color) {
    var overlay = document.getElementById("bossPhaseFlashOverlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "bossPhaseFlashOverlay";
      overlay.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9;opacity:0;";
      document.body.appendChild(overlay);
    }
    overlay.style.background = color;
    overlay.style.animation = "none";
    void overlay.offsetWidth;
    overlay.style.animation = "bossPhaseFlash 0.6s ease-out forwards";
  }

  function spawnRandomEvent() {

    if (document.hidden || gamePaused) return;
    randomEventTimer -= 1;
    if (randomEventTimer > 0 || now() < state.eventUntil) return;

    randomEventTimer = 20 + Math.floor(Math.random() * 24);
    if (Math.random() > 0.52) return;

    var events = [
      { type: "storm", text: "Мемный шторм: клики x2!", duration: 10000 },
      { type: "rain", text: "Дождь дофамина: доход x3!", duration: 9000 },
      { type: "combo", text: "Комбо-лихорадка: потолок комбо x7!", duration: 11000 }
    ];
    var event = events[(Math.random() * events.length) | 0];
    state.eventType = event.type;
    state.eventUntil = now() + event.duration;
    showToast(event.text);
    triggerFlash();
    playSound("event");
  }

  function updateEventBanner() {
    if (now() < state.eventUntil) {
      var seconds = Math.ceil((state.eventUntil - now()) / 1000);
      var label = state.eventType === "storm" ? "Мемный шторм" : state.eventType === "rain" ? "Дождь дофамина" : "Комбо-лихорадка";
      els.eventBanner.textContent = label + " В· " + seconds + "с";
      els.eventBanner.classList.remove("hidden");
    } else {
      els.eventBanner.classList.add("hidden");
    }
  }

  var _toastRegistry = {};

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

    if (existing) clearTimeout(existing.timer);

    if (existing && existing.el && existing.el.parentNode) {
      existing.el.parentNode.removeChild(existing.el);
    }

    var count = existing ? existing.count + 1 : 1;
    var toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = count > 1 ? message + " ×" + count : message;
    els.toastStack.appendChild(toast);

    var entry = { el: toast, count: count, timer: null };
    entry.timer = setTimeout(function () {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
      delete _toastRegistry[key];
    }, 3000);
    _toastRegistry[key] = entry;
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

    var filter = audioContext.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = isHarsh ? 900 : 2200;
    filter.Q.value = 0.7;

    osc.type = isHarsh ? "sine" : "triangle";

    osc.frequency.setValueAtTime(base, audioContext.currentTime);
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(80, base * 0.62),
      audioContext.currentTime + duration
    );

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

    if (useCloudSave && yplayer) {
      yplayer.setData({ save: payload }, true  )
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

    if (useCloudSave && yplayer) {
      yplayer.getData(["save"])
        .then(function (cloudData) {
          var data = cloudData && cloudData.save ? cloudData.save : null;
          if (data) {
            console.log("[YaSDK] Загружено из облака");
            _applyLoadedData(data);
          } else {

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
})();
