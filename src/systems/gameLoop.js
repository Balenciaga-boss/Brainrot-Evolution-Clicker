// systems/gameLoop.js  (lines 3558-3675 of src/main.js)
// Main RAF loop, particle tick, drawEffects.
// NOTE: This file is a readable extract. The live bundle is src/main.js.

/**
 * systems/gameLoop.js
 * Main RAF loop, particle update, drawEffects.
 * Part of src/main.js — do not load standalone.
 */


  function loop(time) {
    // Если вкладка скрыта — пропускаем весь игровой тик и обновляем lastTick,
    // чтобы при возврате не было гигантского dt и накопленных звуков/событий.
    if (document.hidden) {
      lastTick = time;
      requestAnimationFrame(loop);
      return;
    }

    var dt = Math.min(0.05, (time - lastTick) / 1000);
    lastTick = time;

    // П. 4.7: пока идёт реклама — доход не начисляется, автокликер не работает
    if (!gamePaused) {
      if (state.income > 0) {
        addPoints(state.income * getEventMultiplier("income") * (state._adBuffIncome || 1) * dt);
      }
      adTickSecond();
      autoClickerTick(dt);
      aiTick(dt); // авто-интерстишл: тикаем только во время активного геймплея
      inviteTick(dt); // периодический инвайт-бонус
    }

    if (state.passiveCombo > 0 && now() - state.lastClickAt < 5000) {
      state.combo = Math.min(getEventMultiplier("comboLimit"), state.combo + state.passiveCombo * dt);
    }

    if (now() - state.lastClickAt > 1400 && state.combo > 1) {
      state.combo = Math.max(1, state.combo - dt * 1.7);
      if (state.combo === 1) state.comboClicks = 0;
    }

    emitVisualAuraParticles(dt);
    maybePetAttack(dt);
    drawEffects(dt);
    updateUi();
    requestAnimationFrame(loop);
  }

  function spawnParticles(x, y, count, jackpot) {
    var colors = jackpot ? ["#ffeb3b", "#ffffff", "#61ff8b"] : ["#ffffff", "#61ff8b", "#00d4ff", "#ff3d81"];
    if (state.visualModState === 1) colors.push("#67e8f9");
    if (state.visualModState === 2) colors.push("#ffeb3b", "#ff4d6d");
    if (state.visualModState === 3) colors.push("#ffffff", "#ffeb3b", "#ff4d6d", "#67e8f9");
    if (state.visualModState === 4) colors.push("#ff0000", "#7c2dff", "#ffffff", "#ff6b00", "#ff123f");
    for (var i = 0; i < count && particles.length < MAX_PARTICLES; i += 1) {
      var angle = Math.random() * Math.PI * 2;
      var speed = 90 + Math.random() * (jackpot ? 260 : 150);
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.45 + Math.random() * 0.35,
        maxLife: 0.8,
        size: 3 + Math.random() * (jackpot ? 7 : 5),
        color: colors[(Math.random() * colors.length) | 0]
      });
    }
  }

  function spawnFloatingText(x, y, text, color) {
    if (floatingTexts.length >= MAX_FLOATING) floatingTexts.shift();
    floatingTexts.push({
      x: x + (Math.random() - 0.5) * 24,
      y: y - 20,
      vy: -70 - Math.random() * 35,
      life: 0.95,
      maxLife: 0.95,
      text: text,
      color: color
    });
  }

  function drawEffects(dt) {
    var ctx = els.ctx;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    for (var i = particles.length - 1; i >= 0; i -= 1) {
      var p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.vy += 210 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.font = "900 24px Arial, Helvetica, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (var j = floatingTexts.length - 1; j >= 0; j -= 1) {
      var f = floatingTexts[j];
      f.life -= dt;
      if (f.life <= 0) {
        floatingTexts.splice(j, 1);
        continue;
      }
      f.y += f.vy * dt;
      ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
      ctx.lineWidth = 5;
      ctx.strokeStyle = "rgba(17, 24, 39, 0.75)";
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }

    ctx.globalAlpha = 1;
  }

