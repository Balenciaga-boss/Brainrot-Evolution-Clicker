// ads/interstitial.js  (lines 985-1142 of src/main.js)
// Auto-interstitial (fullscreen) ad every 10 minutes.
// NOTE: This file is a readable extract. The live bundle is src/main.js.

/**
 * ads/interstitial.js
 * Auto-interstitial (fullscreen) ad, 10-min interval with safety checks.
 * Part of src/main.js — do not load standalone.
 */

  /* ═══════════════════════════════════════════════════════════════ */

  /* ═══════════════════════════════════════════════════════════════
     AUTO INTERSTITIAL SYSTEM
     ───────────────────────────────────────────────────────────────
     Показывает fullscreen interstitial каждые INTERSTITIAL_INTERVAL
     секунд АКТИВНОГО геймплея. Таймер работает только когда нет
     блокирующих состояний и вкладка видима.

     Блокирующие состояния (таймер стоит):
       · gamePaused (идёт любая реклама)
       · document.hidden (вкладка свёрнута)
       · state.hatching (анимация яйца)
       · equippedModal открыт
       · rebirthModal открыт
       · rbThanksScreen / rbRewardScreen видимы
       · bigAnnouncement показывается (эволюция / boss)
       · isAdRunning (другая реклама в процессе)
       · pendingDelay (реклама отложена — ждём стабильного момента)

     Архитектура без setInterval:
     aiTick(dt) вызывается прямо из loop() — точный dt без дрейфа.
     ═══════════════════════════════════════════════════════════════ */

  var INTERSTITIAL_INTERVAL = 10 * 60;  // секунды между показами (10 мин)

  var aiState = {
    elapsed:      0,       // активное время (сек) с последнего показа
    pending:      false,   // таймер сработал, ждём подходящего момента
    pendingWait:  0,       // сколько секунд ждём уже в pending-режиме
    lastShownAt:  0,       // timestamp последнего показа (мс)
    running:      false    // флаг "система запущена"
  };

  /* ── Проверяем: сейчас безопасный момент для показа рекламы? ── */
  function aiIsSafeToShow() {
    // Другая реклама активна
    if (isAdRunning) return false;
    // Игра на паузе (rewarded/fullscreen реклама)
    if (gamePaused) return false;
    // Вкладка скрыта
    if (document.hidden) return false;
    // Анимация вылупления яйца
    if (state.hatching) return false;
    // Модальные окна открыты
    var equippedModal = document.getElementById("equippedModal");
    if (equippedModal && !equippedModal.classList.contains("hidden")) return false;
    var rebirthModal = document.getElementById("rebirthModal");
    if (rebirthModal && !rebirthModal.classList.contains("hidden")) return false;
    // Review bonus экраны
    var rbThanks = document.getElementById("rbThanksScreen");
    if (rbThanks && !rbThanks.classList.contains("rb-hidden")) return false;
    var rbReward = document.getElementById("rbRewardScreen");
    if (rbReward && !rbReward.classList.contains("rb-hidden")) return false;
    // Big announcement (эволюция, boss, перерождение)
    if (els.bigAnnouncement && !els.bigAnnouncement.classList.contains("hidden")) return false;
    return true;
  }

  /* ── Таймер активного геймплея — вызывается из loop() ── */
  function aiTick(dt) {
    if (!aiState.running) return;

    // Не тикаем в блокирующих состояниях
    if (isAdRunning || gamePaused || document.hidden || state.hatching) return;

    // Накапливаем активное время
    aiState.elapsed += dt;

    // Таймер ещё не достиг порога — ничего не делаем
    if (aiState.elapsed < INTERSTITIAL_INTERVAL && !aiState.pending) return;

    // Порог достигнут — переходим в pending
    if (!aiState.pending) {
      aiState.pending     = true;
      aiState.pendingWait = 0;
    }

    aiState.pendingWait += dt;

    // Проверяем безопасность момента
    if (!aiIsSafeToShow()) {
      // Ждём не более 60 сек, потом всё равно пробуем
      if (aiState.pendingWait < 60) return;
    }

    // Запускаем рекламу
    aiTrigger();
  }

  /* ── Запуск interstitial ── */
  function aiTrigger() {
    // Сбрасываем состояние сразу, чтобы не было двойного вызова
    aiState.elapsed      = 0;
    aiState.pending      = false;
    aiState.pendingWait  = 0;
    aiState.lastShownAt  = Date.now();

    aiShowAd();
  }

  /* ── Реальный вызов Yandex SDK ── */
  function aiShowAd() {
    var settled = false;

    function settle() {
      if (settled) return;
      settled = true;
      resumeGameAfterAd();
    }

    pauseGameForAd();

    if (ysdk && ysdk.adv) {
      ysdk.adv.showFullscreenAdv({
        callbacks: {
          onOpen: function () {
            console.log("[AI] Interstitial opened");
          },
          onClose: function (wasShown) {
            if (!wasShown) {
              // Реклама не показалась (нет инвентаря, сеть упала)
              // Сдвигаем следующий показ на 3 мин, чтобы не спамить
              aiState.elapsed = INTERSTITIAL_INTERVAL - 180;
            }
            settle();
          },
          onError: function (e) {
            console.error("[AI] Interstitial error:", e);
            // При ошибке откатываем таймер на 5 мин вперёд
            aiState.elapsed = INTERSTITIAL_INTERVAL - 300;
            settle();
          },
          onOffline: function () {
            console.warn("[AI] Interstitial: offline");
            aiState.elapsed = INTERSTITIAL_INTERVAL - 300;
            settle();
          }
        }
      });
    } else {
      // SDK нет (локальная разработка) — просто снимаем паузу
      console.log("[AI] SDK не найден, пропускаем interstitial (dev-режим)");
      setTimeout(settle, 400);
    }
  }

  /* ── Инициализация ── */
  function aiInit() {
    aiState.running = true;
    // Если игрок только что вернулся и последний показ был давно —
    // сдвигаем до половины интервала, чтобы не ударить сразу при старте
    aiState.elapsed = 0;
  }

  /* ═══════════════════════════════════════════════════════════════
     END AUTO INTERSTITIAL SYSTEM
     ═══════════════════════════════════════════════════════════════ */
