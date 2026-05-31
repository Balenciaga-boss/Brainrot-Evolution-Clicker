// ui/effectsUI.js  (lines 3676-3741 of src/main.js)
// triggerShake/Flash, spawnRandomEvent, toasts.
// NOTE: This file is a readable extract. The live bundle is src/main.js.

/**
 * ui/effectsUI.js
 * bounceCreature, triggerShake, triggerFlash, spawnRandomEvent, toasts.
 * Part of src/main.js — do not load standalone.
 */

  function bounceCreature() {
    els.creature.classList.remove("clicked");
    void els.creature.offsetWidth;
    els.creature.classList.add("clicked");
  }

  function triggerShake() {
    els.shell.classList.remove("shake");
    void els.shell.offsetWidth;
    els.shell.classList.add("shake");
  }

  function triggerFlash() {
    var overlay = document.getElementById("screenFlashOverlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "screenFlashOverlay";
      overlay.className = "screen-flash-overlay";
      document.body.appendChild(overlay);
    }
    overlay.classList.remove("flash-active");
    void overlay.offsetWidth;
    overlay.classList.add("flash-active");
  }

  function triggerBossPhaseFlash(color) {
    var overlay = document.getElementById("bossPhaseFlashOverlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "bossPhaseFlashOverlay";
      overlay.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9;opacity:0;";
      document.body.appendChild(overlay);
    }
    overlay.style.background = color;
    overlay.style.animation = "none";
    void overlay.offsetWidth;
    overlay.style.animation = "bossPhaseFlash 0.6s ease-out forwards";
  }

  function spawnRandomEvent() {
    // Не запускаем события пока вкладка скрыта — иначе при возврате
    // мог бы сыграть накопленный звук события
    if (document.hidden || gamePaused) return;
    randomEventTimer -= 1;
    if (randomEventTimer > 0 || now() < state.eventUntil) return;

    randomEventTimer = 20 + Math.floor(Math.random() * 24);
    if (Math.random() > 0.52) return;

    var events = [
      { type: "storm", text: "Мемный шторм: клики x2!", duration: 10000 },
      { type: "rain", text: "Дождь дофамина: доход x3!", duration: 9000 },
      { type: "combo", text: "Комбо-лихорадка: потолок комбо x7!", duration: 11000 }
    ];
    var event = events[(Math.random() * events.length) | 0];
    state.eventType = event.type;
    state.eventUntil = now() + event.duration;
    showToast(event.text);
    triggerFlash();
    playSound("event");
  }

  function updateEventBanner() {
    if (now() < state.eventUntil) {
      var seconds = Math.ceil((state.eventUntil - now()) / 1000);
      var label = state.eventType === "storm" ? "Мемный шторм" : state.eventType === "rain" ? "Дождь дофамина" : "Комбо-лихорадка";
      els.eventBanner.textContent = label + " В· " + seconds + "с";
      els.eventBanner.classList.remove("hidden");
    } else {
      els.eventBanner.classList.add("hidden");
    }
  }
