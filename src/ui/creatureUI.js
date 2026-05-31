

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
