

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
