

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
