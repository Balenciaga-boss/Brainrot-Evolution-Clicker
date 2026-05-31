/**
 * pets/hatchAnimation.js
 * Controls the egg-hatching overlay animation sequence.
 */

import { state } from "../state.js";
import { eggs } from "./eggsData.js";
import { getPetById, addOwnedPet, getPetBonus, describePetBonus } from "./petSystem.js";
import { rarities, isUltraRarity, getUltraAnnouncement } from "./petsData.js";
import { finiteNumber } from "../utils.js";
import { HATCH_REVEAL_MS, HATCH_CLOSE_MS } from "../config.js";

/**
 * Roll a random pet from an egg's drop table.
 * @param {object} egg
 * @returns {object} pet
 */
export function rollEggPet(egg) {
  const roll  = Math.random() * 100;
  let   total = 0;
  for (const drop of egg.drops) {
    total += drop.chance;
    if (roll <= total) return getPetById(drop.pet);
  }
  return getPetById(egg.drops[egg.drops.length - 1].pet);
}

/**
 * Begin the hatch animation for a given egg + pet outcome.
 * @param {object} egg
 * @param {object} pet
 * @param {object} els      - Cached DOM element references
 * @param {object} api      - { showToast, showBigAnnouncement, spawnCenterBurst,
 *                             triggerShake, triggerFlash, recalculateStats,
 *                             renderShop, updateUi, updateShopAffordability,
 *                             playSound, saveGame }
 */
export function startHatchAnimation(egg, pet, els, api) {
  const rarity = rarities[pet.rarity];

  els.hatchOverlay.classList.remove("hidden", "revealed");
  els.hatchOverlay.classList.toggle("ultra-hatch", isUltraRarity(pet.rarity));
  els.hatchCard.className   = "hatch-card shaking";
  els.hatchEgg.textContent  = egg.icon;
  els.hatchResult.classList.add("hidden");

  api.triggerShake();
  api.triggerFlash();
  api.playSound("event");

  setTimeout(() => {
    els.hatchCard.className     = "hatch-card revealed " + rarity.className;
    els.hatchOverlay.classList.add("revealed");
    els.hatchPetFace.textContent = pet.face;
    els.hatchPetName.textContent = pet.name;
    els.hatchPetRarity.textContent = rarity.name;
    els.hatchPetRarity.className   = rarity.className;
    els.hatchPetBonus.textContent  = "Бонус: " + describePetBonus(getPetBonus(pet));
    els.hatchResult.classList.remove("hidden");

    addOwnedPet(pet);
    api.showToast(rarity.name + " брейнрот: " + pet.name + "!");

    if (isUltraRarity(pet.rarity)) {
      api.showBigAnnouncement(getUltraAnnouncement(pet));
      els.hatchCard.classList.add("ultra-reveal");
    }

    api.spawnCenterBurst(rarity.color);
    api.triggerShake();
    api.triggerFlash();

    if (isUltraRarity(pet.rarity)) {
      setTimeout(api.triggerShake, 120);
      setTimeout(api.triggerFlash, 180);
    }

    api.playSound(
      isUltraRarity(pet.rarity) || pet.rarity === "mythic" || pet.rarity === "legendary"
        ? "jackpot"
        : "evolve"
    );

    api.recalculateStats();
    api.renderShop();
    api.updateUi(true);
    api.saveGame();
  }, HATCH_REVEAL_MS);

  setTimeout(() => {
    els.hatchOverlay.classList.add("hidden");
    els.hatchOverlay.classList.remove("ultra-hatch");
    state.hatching = false;
    api.updateShopAffordability();
  }, HATCH_CLOSE_MS);
}
