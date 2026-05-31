// pets/petsData.js  (lines 1218-1395 of src/main.js)
// Rarities, pet stat tables, level helpers.
// NOTE: This file is a readable extract. The live bundle is src/main.js.

/**
 * pets/petsData.js
 * Rarity definitions, pet stat tables, pet level helpers.
 * Part of src/main.js — do not load standalone.
 */

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

  /* ══════════════════════════════════════════════════════════════
     PET LEVELING SYSTEM
     ══════════════════════════════════════════════════════════════ */

  // Rarity → max level
  var PET_MAX_LEVELS = {
    common: 10, uncommon: 12, rare: 15,
    epic: 18, legendary: 20, mythic: 22,
    secret: 25, divine: 27, cosmic: 28,
    transcendent: 30, demonic: 30
  };

  // Rarity → stat multiplier added per level (fraction of base stats)
  var PET_SCALE_PER_LEVEL = {
    common: 0.038, uncommon: 0.042, rare: 0.046,
    epic: 0.052, legendary: 0.056, mythic: 0.06,
    secret: 0.065, divine: 0.065, cosmic: 0.068,
    transcendent: 0.072, demonic: 0.072
  };

  // Rarity → cost multiplier on top of base formula
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
    // Base cost: ~12s worth of the pet's income contribution, scaled by rarity
    var incomeBase = (pet.income || 0) + (pet.autoclick || 0) * 50;
    var rarityMult = PET_RARITY_COST_MULT[pet.rarity] || 1;
    var minimum = rarityMult * 50;
    var baseCost = Math.max(minimum, incomeBase * 12 * rarityMult);
    // Progressive cost: grows 55% per level
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
    showBigAnnouncement("\u2b06 \u423a\u0420. " + newLevel + " \u00b7 " + pet.name);
    showToast("\u2b06 " + pet.name + " \u2192 \u0423\u0440\u043e\u0432\u0435\u043d\u044c " + newLevel + "!");
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

  /* ══════════════════════════════════════════════════════════════
     END PET LEVELING SYSTEM
     ══════════════════════════════════════════════════════════════ */

  var pets = [
    // ── Tier 1: Дешёвое яйцо (стадия 2) ──
    { id: "crumb",        face: "•_•",   name: "Крошка Кринжа",              rarity: "common",       income: 0.6,           combo: 0.001 },
    { id: "noodle",       face: "≈_≈",   name: "Лапшичный Мыслитель",        rarity: "uncommon",     income: 2,             crit: 0.001 },
    { id: "sock",         face: "⊙▂⊙",  name: "Носок Предсказатель",         rarity: "uncommon",     income: 4,             autoclick: 0.1 },
    // ── Tier 2: Странное яйцо (стадия 4) ──
    { id: "pickle",       face: "ಠ_ಠ",   name: "Огурец Паники",              rarity: "common",       income: 8,             combo: 0.002 },
    { id: "wifi",         face: "≋_≋",   name: "Вайфайный Пупс",             rarity: "uncommon",     income: 18,            crit: 0.002 },
    { id: "teapot",       face: "◉_◉",   name: "Чайник Бессмыслицы",         rarity: "rare",         income: 55,            autoclick: 0.35 },
    // ── Tier 3: Глючное яйцо (стадия 6) ──
    { id: "pixel",        face: "▣_▣",   name: "Пиксельный Визгун",          rarity: "uncommon",     income: 80,            combo: 0.005 },
    { id: "cursor",       face: "↖_↗",   name: "Курсор Судьбы",              rarity: "rare",         income: 280,           crit: 0.005 },
    { id: "portal",       face: "◌_◌",   name: "Портальная Булочка",         rarity: "epic",         income: 900,           autoclick: 1.2 },
    // ── Tier 4: Космическое яйцо (стадия 8) ──
    { id: "moon",         face: "☾_☽",   name: "Лунный Бубнитель",           rarity: "rare",         income: 1800,          combo: 0.009 },
    { id: "crown",        face: "♛_♛",   name: "Король Микроволн",           rarity: "epic",         income: 6000,          crit: 0.009 },
    { id: "sun",          face: "☀_☀",   name: "Солнечный Сырник",           rarity: "legendary",    income: 22000,         autoclick: 4,          incomeMult: 0.012 },
    // ── Tier 5: Реакторное яйцо (стадия 10) ──
    { id: "antenna",      face: "⌁_⌁",   name: "Антенна Хихиканья",          rarity: "rare",         income: 620000,        crit: 0.006,           incomeMult: 0.018 },
    { id: "mixer",        face: "◐_◑",   name: "Блендер Мыслей",             rarity: "epic",         income: 2400000,       combo: 0.014,          autoclick: 7 },
    { id: "idol",         face: "◆_◆",   name: "Золотой Болванчик",          rarity: "legendary",    income: 9000000,       incomeMult: 0.038 },
    // ── Tier 6: Королевское яйцо (стадия 13) ──
    { id: "clock",        face: "◷_◶",   name: "Часы Нервного Тика",         rarity: "rare",         income: 60000000,      autoclick: 18 },
    { id: "drama",        face: "ಥ_ಥ",   name: "Драма-Глаз",                 rarity: "epic",         income: 210000000,     crit: 0.015,           combo: 0.012 },
    { id: "throne",       face: "♚_♚",   name: "Тронный Брейнрот",           rarity: "legendary",    income: 720000000,     incomeMult: 0.055 },
    // ── Tier 7: Пустотное яйцо (стадия 16) ──
    { id: "cubelet",      face: "▤_▥",   name: "Кубик Нелогики",             rarity: "epic",         income: 6000000000,    autoclick: 45,         combo: 0.018 },
    { id: "angel",        face: "✦_✦",   name: "Ангел Абсурда",              rarity: "legendary",    income: 28000000000,   crit: 0.022,           incomeMult: 0.07 },
    { id: "voidling",     face: "●_●",   name: "Пустотный Малыш",            rarity: "mythic",       income: 130000000000,  combo: 0.038,          autoclick: 90,         incomeMult: 0.09 },
    // ── Tier 8: Неоновое яйцо (стадия 19) ──
    { id: "neon",         face: "▰_▰",   name: "Неоновый Скример",           rarity: "epic",         income: 960000000000,  crit: 0.02 },
    { id: "kingbyte",     face: "K_B",   name: "Король Байтокринжа",         rarity: "legendary",    income: 5200000000000, autoclick: 260,        incomeMult: 0.08 },
    { id: "mythsignal",   face: "∞_∞",   name: "Мифический Сигнал",          rarity: "mythic",       income: 26000000000000, combo: 0.048,         crit: 0.032,           incomeMult: 0.12 },
    // ── Tier 9: Запрещённое яйцо (стадия 22) ──
    { id: "glitch",       face: "▓_▒",   name: "Глючный Абсолют",            rarity: "epic",         income: 120000000000000, combo: 0.028,        autoclick: 480 },
    { id: "oracle",       face: "👁",    name: "Оракул Дофамина",            rarity: "legendary",    income: 480000000000000, crit: 0.032,          autoclick: 1800,       incomeMult: 0.10 },
    { id: "redacted",     face: "?!",    name: "Запрещённый Шум",            rarity: "mythic",       income: 2200000000000000, combo: 0.062,        crit: 0.045,           autoclick: 7200,       incomeMult: 0.17 },
    { id: "secret404",    face: "???",   name: "Секрет 404",                 rarity: "secret",       income: 8000000000000000, crit: 0.048,         combo: 0.072,          duplicate: 0.014 },
    { id: "divinebell",   face: "✧_✧",   name: "Божественный Колокольчик",   rarity: "divine",       income: 3.2e16,        crit: 0.058,           incomeMult: 0.16,      jackpotBoost: 0.003 },
    { id: "cosmicmouth",  face: "★_★",   name: "Космический Рот Шума",       rarity: "cosmic",       income: 1.2e17,        crit: 0.072,           combo: 0.10,           incomeMult: 0.24,      jackpotBoost: 0.005 },
    { id: "transglitch",  face: "ЖЖЖ",   name: "Трансцендентный Глитч",      rarity: "transcendent", income: 4.8e17,        crit: 0.09,            combo: 0.14,           incomeMult: 0.36,      duplicate: 0.045,      jackpotBoost: 0.007 },
    // ── Tier 10: Омега-яйцо (стадия 23) ──
    { id: "finalspark",   face: "✺_✺",   name: "Финальная Искра",            rarity: "legendary",    income: 180000000000000000, autoclick: 600,    crit: 0.024 },
    { id: "apocalypse",   face: "!!!",   name: "Апокалипсис Мемов",          rarity: "mythic",       income: 1.1e18,        combo: 0.055,          crit: 0.038,           incomeMult: 0.14 },
    { id: "overbrain",    face: "Ω_Ω",   name: "Сверхбрейнрот Омега",        rarity: "mythic",       income: 6e18,          autoclick: 1800,       combo: 0.068,          incomeMult: 0.19 },
    { id: "hiddenmeme",   face: "шш",    name: "Тихий Мем Под Полом",        rarity: "secret",       income: 2.4e19,        autoclick: 2800,       incomeMult: 0.13,      duplicate: 0.018 },
    { id: "divinehand",   face: "☼_☼",   name: "Святая Ладонь Бонка",        rarity: "divine",       income: 9.6e19,        autoclick: 4800,       combo: 0.09,           duplicate: 0.024 },
    { id: "galaxyeye",    face: "◎_◎",   name: "Галактический Глаз Повтора", rarity: "cosmic",       income: 3.6e20,        autoclick: 12000,      duplicate: 0.036,      passiveCombo: 0.022 },
    { id: "beyondbrain",  face: "Ω!Ω",   name: "Брейнрот За Пределом",       rarity: "transcendent", income: 1.44e21,       autoclick: 36000,      combo: 0.18,           incomeMult: 0.45,      duplicate: 0.06,       passiveCombo: 0.036 },
    // ── Tier 11: Инфернальное яйцо (стадия 25) ──
    { id: "chaoscore",    face: "◈_◈",   name: "Ядро Хаоса",                 rarity: "epic",         income: 5e21,          combo: 0.08,           autoclick: 180000 },
    { id: "demonlord",    face: "⛧_⛧",   name: "Демонический Владыка",       rarity: "mythic",       income: 3.5e22,        combo: 0.078,          crit: 0.052,           autoclick: 60000,      incomeMult: 0.22 },
    { id: "infernalecho", face: "ψ_ψ",   name: "Адское Эхо",                 rarity: "mythic",       income: 8e22,          autoclick: 120000,     combo: 0.065,          incomeMult: 0.17 },
    { id: "shadowpulse",  face: "◗_◖",   name: "Теневой Пульс",              rarity: "secret",       income: 3.2e23,        crit: 0.056,           combo: 0.085,          duplicate: 0.022,      incomeMult: 0.15 },
    { id: "demonseraph",  face: "✞_✞",   name: "Демонический Серафим",       rarity: "divine",       income: 1.28e24,       crit: 0.076,           incomeMult: 0.28,      jackpotBoost: 0.006,   duplicate: 0.028 },
    { id: "abysswalker",  face: "◬_◬",   name: "Странник Бездны",            rarity: "cosmic",       income: 5.1e24,        combo: 0.14,           crit: 0.086,           autoclick: 600000,     incomeMult: 0.34,      jackpotBoost: 0.008 },
    { id: "finaldemongod",face: "Ω⛧Ω",  name: "Финальный Бог Демонов",      rarity: "transcendent", income: 2.04e25,       crit: 0.11,            combo: 0.22,           incomeMult: 0.65,      duplicate: 0.09,       autoclick: 2400000,    passiveCombo: 0.055,   jackpotBoost: 0.009 },
    // ── Tier 12: Абсолютное яйцо (стадия 28) ──
    { id: "voidthrone",   face: "▼_▼",   name: "Трон Пустоты",               rarity: "legendary",    income: 8.16e25,       autoclick: 9600000,    incomeMult: 0.18,      crit: 0.032 },
    { id: "hellsovereign",face: "⛦_⛦",  name: "Владыка Адского Пламени",     rarity: "demonic",      income: 3.26e26,       crit: 0.14,            combo: 0.30,           incomeMult: 0.90,      duplicate: 0.11,       autoclick: 36000000,   passiveCombo: 0.08,    jackpotBoost: 0.012 },
    { id: "voidemperor",  face: "҉_҉",   name: "Император Вечной Бездны",     rarity: "demonic",      income: 1.3e27,        crit: 0.17,            combo: 0.40,           incomeMult: 1.40,      duplicate: 0.14,       autoclick: 180000000,  passiveCombo: 0.11,    jackpotBoost: 0.017 }
  ];
