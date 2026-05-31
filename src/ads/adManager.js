

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
