

import { MAX_PARTICLES, MAX_FLOATING } from "../config.js";

let particles    = [];
let floatingTexts = [];

export function spawnParticles(x, y, count, rainbow = false) {
  for (let i = 0; i < count && particles.length < MAX_PARTICLES; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = rainbow ? (200 + Math.random() * 280) : (100 + Math.random() * 200);
    const colors = rainbow
      ? ["#ff4d6d", "#ffeb3b", "#61ff8b", "#67e8f9", "#a78bfa", "#ff9a3c"]
      : ["#ffffff", "#ffeb3b", "#61ff8b", "#67e8f9"];
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 60,
      life:    0.6 + Math.random() * 0.4,
      maxLife: 1.0,
      size:    3 + Math.random() * (rainbow ? 6 : 4),
      color:   colors[Math.floor(Math.random() * colors.length)],
    });
  }
}

export function spawnCenterBurst(color, label) {
  const x = window.innerWidth  / 2;
  const y = window.innerHeight / 2;
  for (let i = 0; i < 34 && particles.length < MAX_PARTICLES; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 140 + Math.random() * 280;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life:    0.7 + Math.random() * 0.45,
      maxLife: 1.15,
      size:    5 + Math.random() * 8,
      color:   i % 4 === 0 ? "#ffffff" : color,
    });
  }
  spawnFloatingText(x, y - 70, label || "ВЫЛУПЛЕНИЕ!", color);
}

export function spawnFloatingText(x, y, text, color = "#ffffff") {
  if (floatingTexts.length >= MAX_FLOATING) return;
  floatingTexts.push({ x, y, text, color, life: 1.0, maxLife: 1.0, vy: -55 });
}

export function emitVisualAuraParticles(dt, state, creatureEl) {
  if (state.visualModState === 0 || state.hatching) return;

  state.visualParticleTimer -= dt;
  if (state.visualParticleTimer > 0) return;

  const mod = state.visualModState;
  state.visualParticleTimer = mod === 4
    ? 0.07 + Math.random() * 0.04
    : mod === 3 ? 0.11 + Math.random() * 0.05
    : mod === 2 ? 0.16 + Math.random() * 0.06
    :             0.22 + Math.random() * 0.08;

  const rect   = creatureEl.getBoundingClientRect();
  const cx     = rect.left + rect.width  / 2;
  const cy     = rect.top  + rect.height / 2;
  const radius = Math.max(rect.width, rect.height) * 0.48;

  const colorMap = {
    4: ["#ff0000", "#ff123f", "#7c2dff", "#ffffff", "#ff6b00", "#000000"],
    3: ["#ffffff", "#ffeb3b", "#ff3d81", "#67e8f9"],
    2: ["#ffeb3b", "#ff3d81", "#67e8f9"],
    1: ["#61ff8b", "#67e8f9", "#ffffff"],
  };
  const colors = colorMap[mod] || colorMap[1];
  const count  = mod === 4 ? 5 : mod === 3 ? 3 : mod === 2 ? 2 : 1;

  for (let i = 0; i < count && particles.length < MAX_PARTICLES; i++) {
    const angle       = Math.random() * Math.PI * 2;
    const spawnRadius = radius * (0.78 + Math.random() * 0.34);
    const speed       = mod === 4 ? 38 + Math.random() * 52 : 22 + Math.random() * 28;
    particles.push({
      x: cx + Math.cos(angle) * spawnRadius,
      y: cy + Math.sin(angle) * spawnRadius,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 18,
      life:    0.45 + Math.random() * 0.35,
      maxLife: 0.78,
      size:    2 + Math.random() * (mod >= 3 ? 4.8 : mod === 2 ? 3.6 : 2.2),
      color:   colors[Math.floor(Math.random() * colors.length)],
    });
  }
}

export function updateAndRenderParticles(ctx, dt, canvasW, canvasH) {

  ctx.clearRect(0, 0, canvasW, canvasH);

  particles = particles.filter(p => {
    p.life -= dt;
    if (p.life <= 0) return false;
    p.x  += p.vx * dt;
    p.y  += p.vy * dt;
    p.vy += 320 * dt;
    const alpha = p.life / p.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.5, p.size * alpha), 0, Math.PI * 2);
    ctx.fill();
    return true;
  });

  floatingTexts = floatingTexts.filter(ft => {
    ft.life -= dt;
    if (ft.life <= 0) return false;
    ft.y += ft.vy * dt;
    const alpha = ft.life / ft.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = ft.color;
    ctx.font        = "bold 16px Arial, sans-serif";
    ctx.textAlign   = "center";
    ctx.fillText(ft.text, ft.x, ft.y);
    return true;
  });

  ctx.globalAlpha = 1;
  ctx.textAlign   = "left";
}

export function getParticles()     { return particles;     }
export function getFloatingTexts() { return floatingTexts; }
