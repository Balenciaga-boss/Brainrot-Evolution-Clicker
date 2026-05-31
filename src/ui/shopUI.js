// ui/shopUI.js  (lines 2904-3075 of src/main.js)
// renderEggShop, openEgg, hatch animation.
// NOTE: This file is a readable extract. The live bundle is src/main.js.

/**
 * ui/shopUI.js
 * renderEggShop, openEgg, hatch animation, updateShopAffordability.
 * Part of src/main.js — do not load standalone.
 */

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
      // Special upgrades use data-special-id, not data-id — skip them here
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
