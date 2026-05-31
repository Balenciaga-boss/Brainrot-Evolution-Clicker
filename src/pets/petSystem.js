

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
