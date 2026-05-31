/**
 * ui/effectsCanvas.js
 * Sets up and manages the fullscreen effects canvas used by the particle system.
 */

import { updateAndRenderParticles, emitVisualAuraParticles } from "../systems/particleSystem.js";
import { state } from "../state.js";

let _canvas = null;
let _ctx    = null;

export function initCanvas(canvasEl) {
  _canvas = canvasEl;
  _ctx    = canvasEl?.getContext("2d");
  if (_canvas) {
    _resizeCanvas();
    window.addEventListener("resize", _resizeCanvas, { passive: true });
  }
}

function _resizeCanvas() {
  if (!_canvas) return;
  _canvas.width  = window.innerWidth;
  _canvas.height = window.innerHeight;
}

/**
 * Called every animation frame. Emits aura particles and renders all effects.
 * @param {number} dt        - Delta time in seconds
 * @param {HTMLElement} creatureEl
 */
export function renderEffects(dt, creatureEl) {
  if (!_ctx || !_canvas) return;
  emitVisualAuraParticles(dt, state, creatureEl);
  updateAndRenderParticles(_ctx, dt, _canvas.width, _canvas.height);
}
