// systems/upgradeSystem.js  (lines 3459-3557 of src/main.js)
// buyUpgrade, buySpecialUpgrade, auto-clicker.
// NOTE: This file is a readable extract. The live bundle is src/main.js.

/**
 * systems/upgradeSystem.js
 * buyUpgrade, buySpecialUpgrade, auto-clicker.
 * Part of src/main.js — do not load standalone.
 */

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

  /* ══════════════════════════════════════════════════════════════
     AUTO CLICKER (рекламный бонус на 60 секунд)
     ══════════════════════════════════════════════════════════════ */
  var _autoClickerAccum = 0;
  var AUTO_CLICKER_INTERVAL = 0.25; // клик каждые 250мс = 4 в секунду

  function isAutoClickerActive() {
    return now() < state.autoClickerUntil;
  }

  function autoClickerTick(dt) {
    if (!isAutoClickerActive()) {
      updateAutoClickerButton();
      return;
    }
    // Сбрасываем накопленное время если вернулись с паузы/скрытой вкладки
    // (dt уже зажат в 0.05 в loop, но _autoClickerAccum мог накопиться ранее)
    _autoClickerAccum += dt;
    // Не допускаем более 1 клика за один тик loop() — это защита от пачки звуков
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
