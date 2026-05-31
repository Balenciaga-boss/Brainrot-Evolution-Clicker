// ui/stageUI.js  (lines 2537-2690 of src/main.js)
// updateStage, syncVisualModState, visual phase bursts.
// NOTE: This file is a readable extract. The live bundle is src/main.js.

/**
 * ui/stageUI.js
 * updateStage, syncVisualModState, visual phase bursts.
 * Part of src/main.js — do not load standalone.
 */

  function getStageNumber() {
    return state.stage + 1;
  }

  function getVisualModState() {
    var stageNumber = getStageNumber();
    var bossHp = getStageBossHpRatio();
    if (stageNumber >= 28) {
      if (bossHp <= 0.33) return 4;
      if (bossHp <= 0.66) return 3;
      return 2;
    }
    if (stageNumber >= 24) {
      if (bossHp <= 0.4) return 3;
      if (bossHp <= 0.7) return 2;
      return 1;
    }
    if (stageNumber < 15) return 0;
    if (stageNumber < 20) return bossHp <= 0.5 ? 1 : 0;
    if (bossHp <= 0.33) return 3;
    if (bossHp <= 0.66) return 2;
    return 0;
  }

  function getStageBossHpRatio() {
    var currentStage = stages[state.stage];
    var nextStage = stages[state.stage + 1];
    var currentNeed = currentStage ? currentStage.need : 0;
    var nextNeed = nextStage ? nextStage.need : currentNeed + getFinalStageVirtualHp();
    var span = Math.max(1, nextNeed - currentNeed);
    var progress = Math.max(0, Math.min(1, (state.totalPoints - currentNeed) / span));
    return 1 - progress;
  }

  function getFinalStageVirtualHp() {
    var currentStage = stages[state.stage];
    var previousStage = stages[Math.max(0, state.stage - 1)];
    if (!currentStage || !previousStage) return Math.max(1, state.totalPoints || 1);
    return Math.max(1, currentStage.need - previousStage.need);
  }

  function getVisualModParticleBonus() {
    var stageNumber = getStageNumber();
    var stageBonus = stageNumber >= 28 ? 12 : stageNumber >= 24 ? 8 : stageNumber >= 21 ? 5 : stageNumber >= 16 ? 3 : stageNumber >= 11 ? 1 : 0;
    if (state.visualModState === 4) return stageBonus + 16;
    if (state.visualModState === 3) return stageBonus + 10;
    if (state.visualModState === 2) return stageBonus + 6;
    if (state.visualModState === 1) return stageBonus + 3;
    return stageBonus;
  }

  function syncVisualModState(force) {
    var stageNumber = getStageNumber();
    var charge = stageNumber < 15 ? 0 : 1 - getStageBossHpRatio();
    var nextState = getVisualModState();
    var bodyStyle = document.body.style;

    if (force || Math.abs(charge - state.visualCharge) > 0.002) {
      var stageN = getStageNumber();
      var isUltimateTier = stageN >= 28;
      bodyStyle.setProperty("--mod-aura-opacity", (0.78 + charge * (isUltimateTier ? 0.28 : 0.2)).toFixed(3));
      bodyStyle.setProperty("--mod-aura-opacity-peak", (0.9 + charge * (isUltimateTier ? 0.22 : 0.16)).toFixed(3));
      bodyStyle.setProperty("--mod-aura-blur", (12 + charge * (isUltimateTier ? 18 : 10)).toFixed(1) + "px");
      bodyStyle.setProperty("--mod-aura-blur-peak", (17 + charge * (isUltimateTier ? 24 : 14)).toFixed(1) + "px");
      bodyStyle.setProperty("--mod-eye-glow", (4 + charge * (isUltimateTier ? 36 : 20)).toFixed(1) + "px");
      state.visualCharge = charge;
    }

    if (force || nextState !== state.visualModState) {
      document.body.classList.remove("mod-phase-1", "mod-phase-2", "mod-phase-3", "mod-phase-4");
      if (nextState > 0) document.body.classList.add("mod-phase-" + nextState);
      if (!force && nextState > state.visualModState) triggerVisualPhaseBurst(nextState);
      state.visualModState = nextState;
    }
  }

  function triggerVisualPhaseBurst(modState) {
    var rect = els.creature.getBoundingClientRect();
    var x = rect.left + rect.width / 2;
    var y = rect.top + rect.height / 2;

    spawnParticles(x, y, modState === 4 ? 28 : modState === 3 ? 20 : modState === 2 ? 14 : 10, modState >= 3);
    if (modState >= 2) triggerTinyShake();
    if (modState >= 3) triggerFlash();

    // === PHASE TRANSITION EFFECTS ===
    if (modState === 2) {
      // Boss enters phase 2: enraged
      triggerShake();
      triggerBossPhaseFlash("#ff3d00");
      spawnParticles(x, y, 22, false);
      spawnFloatingText(x, y - 90, "РАЗЪЯРЁН!", "#ff6600");
      showBigAnnouncement("⚡ БОСС РАЗЪЯРЁН ⚡");
      playSound("event");
      showToast("⚠️ Босс переходит во вторую фазу!");
    } else if (modState === 3) {
      // Boss enters phase 3: final form
      triggerShake();
      setTimeout(triggerShake, 180);
      triggerFlash();
      triggerBossPhaseFlash("#cc00ff");
      spawnParticles(x, y, 32, true);
      spawnCenterBurst("#cc00ff");
      spawnFloatingText(x, y - 110, "ФИНАЛЬНАЯ ФОРМА!", "#ee00ff");
      showBigAnnouncement("💀 ФИНАЛЬНАЯ ФОРМА 💀");
      playSound("jackpot");
      setTimeout(function () { playSound("evolve"); }, 220);
      showToast("💀 Босс активирует финальную форму!");
    }
  }

  function emitVisualAuraParticles(dt) {
    if (state.visualModState === 0 || state.hatching) return;

    state.visualParticleTimer -= dt;
    if (state.visualParticleTimer > 0) return;

    state.visualParticleTimer = state.visualModState === 4
      ? 0.07 + Math.random() * 0.04
      : state.visualModState === 1
        ? 0.22 + Math.random() * 0.08
        : state.visualModState === 2
          ? 0.16 + Math.random() * 0.06
          : 0.11 + Math.random() * 0.05;

    var rect = els.creature.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    var radius = Math.max(rect.width, rect.height) * 0.48;
    var colors = state.visualModState === 4
      ? ["#ff0000", "#ff123f", "#7c2dff", "#ffffff", "#ff6b00", "#000000"]
      : state.visualModState === 3
        ? ["#ffffff", "#ffeb3b", "#ff3d81", "#67e8f9"]
        : state.visualModState === 2
          ? ["#ffeb3b", "#ff3d81", "#67e8f9"]
          : ["#61ff8b", "#67e8f9", "#ffffff"];
    var count = state.visualModState === 4 ? 5 : state.visualModState === 3 ? 3 : state.visualModState === 2 ? 2 : 1;

    for (var i = 0; i < count && particles.length < MAX_PARTICLES; i += 1) {
      var angle = Math.random() * Math.PI * 2;
      var spawnRadius = radius * (0.78 + Math.random() * 0.34);
      var speed = state.visualModState === 4 ? 38 + Math.random() * 52 : 22 + Math.random() * 28;
      particles.push({
        x: cx + Math.cos(angle) * spawnRadius,
        y: cy + Math.sin(angle) * spawnRadius,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 18,
        life: 0.45 + Math.random() * 0.35,
        maxLife: 0.78,
        size: 2 + Math.random() * (state.visualModState >= 3 ? 4.8 : state.visualModState === 3 ? 3.6 : 2.2),
        color: colors[(Math.random() * colors.length) | 0]
      });
    }
  }
