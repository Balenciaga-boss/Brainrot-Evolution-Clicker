

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
