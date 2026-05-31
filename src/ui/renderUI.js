

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
