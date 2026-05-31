export const state = {
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

export function resetStateForRebirth(newRebirths) {
  const sound = state.sound;
  const keys = Object.keys(state);

  keys.forEach((k) => {
    if (typeof state[k] === "number") state[k] = 0;
    else if (typeof state[k] === "boolean") state[k] = false;
    else if (Array.isArray(state[k])) state[k] = [];
    else if (typeof state[k] === "object" && state[k] !== null) state[k] = {};
    else if (typeof state[k] === "string") state[k] = "";
  });

  state.sound = sound;
  state.rebirths = newRebirths;
  state.clickPower = 1;
  state.multiplier = 1;
  state.combo = 1;
  state.critChance = 0.05;
  state.jackpotChance = 0.01;
  state.petBonusText = "нет";
  state.petAttackTimer = 5;
  state.shopPage = "upgrades";
  state._adBuffIncome = 1;
  state._adBuffPet = 1;
  state._adBuffUpgrade = 1;
  state._adBuffPassive = 1;
}
