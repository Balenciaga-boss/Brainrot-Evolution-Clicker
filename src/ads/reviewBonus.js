// ads/reviewBonus.js  (lines 604-984 of src/main.js)
// One-time review bonus: SDK request, thanks screen, reward.
// NOTE: This file is a readable extract. The live bundle is src/main.js.

/**
 * ads/reviewBonus.js
 * One-time review bonus: SDK request, thanks screen, reward flow.
 * Part of src/main.js — do not load standalone.
 */

  /* ═══════════════════════════════════════════════════════════════
     END AD MANAGER
     ═══════════════════════════════════════════════════════════════ */

  /* ═══════════════════════════════════════════════════════════════
     REVIEW BONUS SYSTEM
     ───────────────────────────────────────────────────────────────
     Полный поток: кнопка → запрос отзыва (Yandex SDK canReview /
     requestReview) → экран благодарности → fullscreen-реклама
     (ysdk.adv.showFullscreenAdv) → выдача награды.

     Защита от злоупотреблений:
       reviewBonus.usedToday  — флаг "уже использовано сегодня"
       reviewBonus.sessionUsed — флаг "уже использовано в сессии"
       reviewBonus.cooldownUntil — timestamp снятия суточной блокировки

     Наградa: фиксированный бонус к очкам (10 % от текущего дохода
     за 60 с, но не менее 1000 очков). Выдаётся единожды за сессию
     и единожды за календарный день.
     ═══════════════════════════════════════════════════════════════ */

  var REVIEW_BONUS_SAVE_KEY = "brainrotReviewBonusV1";

  var reviewBonus = {
    sessionUsed:    false,  // true = кнопка уже нажата в этой сессии
    cooldownUntil:  0,      // timestamp до которого нельзя брать снова
    claimedForever: false   // true = бонус уже получен навсегда, кнопка скрыта
  };

  /* ── Загрузить / сохранить состояние Review Bonus ── */
  function rbLoad() {
    try {
      var raw = localStorage.getItem(REVIEW_BONUS_SAVE_KEY);
      if (!raw) return;
      var d = JSON.parse(raw);
      reviewBonus.cooldownUntil  = finiteNumber(d.cooldownUntil, 0);
      reviewBonus.claimedForever = d.claimedForever === true;
      if (reviewBonus.claimedForever) reviewBonus.sessionUsed = true;
    } catch (e) {}
  }

  function rbSave() {
    try {
      localStorage.setItem(REVIEW_BONUS_SAVE_KEY, JSON.stringify({
        cooldownUntil:  reviewBonus.cooldownUntil,
        claimedForever: reviewBonus.claimedForever
      }));
    } catch (e) {}
  }

  /* ── Можно ли получить бонус прямо сейчас? ── */
  function rbCanClaim() {
    if (reviewBonus.claimedForever) return false;
    if (reviewBonus.sessionUsed) return false;
    if (Date.now() < reviewBonus.cooldownUntil) return false;
    return true;
  }

  /* ── Сколько секунд до снятия кулдауна ── */
  function rbCooldownSeconds() {
    return Math.max(0, Math.ceil((reviewBonus.cooldownUntil - Date.now()) / 1000));
  }

  /* ── Размер награды: 10 % дохода за 60 с, минимум 1000 ── */
  function rbRewardAmount() {
    return Math.max(1000, Math.floor(state.income * 60 * 0.10));
  }

  /* ══════════════════════════════════════════════════════════════
     UI — HTML кнопки и модальных экранов
     ══════════════════════════════════════════════════════════════ */
  function rbInjectUI() {
    if (document.getElementById("reviewBonusBtn")) return;

    /* ── Кнопка в .shop-footer ── */
    var footer = document.querySelector(".shop-footer");
    if (footer) {
      var btnEl = document.createElement("button");
      btnEl.id          = "reviewBonusBtn";
      btnEl.type        = "button";
      btnEl.className   = "review-bonus-btn";
      btnEl.setAttribute("aria-label", "Бонус за отзыв об игре");
      btnEl.innerHTML   = '<span class="rb-btn-icon">⭐</span><span class="rb-btn-text">Бонус за отзыв</span>';
      footer.appendChild(btnEl);
      btnEl.addEventListener("click", rbHandleClick);
    }

    /* ── Таймер кулдауна — вставляем в top-panel (левая панель, зелёный фон).
          Когда скрыт: display:none — не занимает места.
          Когда виден: flex-item, прижат к правому краю рядом с кнопкой звука. ── */
    var topPanel  = document.querySelector(".top-panel");
    var soundBtn  = document.getElementById("soundButton");
    if (topPanel && soundBtn) {
      var timerEl = document.createElement("div");
      timerEl.id        = "rbCooldownBadge";
      timerEl.className = "rb-cooldown-badge rb-badge-hidden";
      timerEl.setAttribute("aria-live", "polite");
      timerEl.setAttribute("title", "Бонус за отзыв — следующий через:");
      timerEl.innerHTML = '<span class="rb-badge-icon">⭐</span><span id="rbCooldownText">24:00:00</span>';
      /* Вставляем перед кнопкой звука — она остаётся последней */
      topPanel.insertBefore(timerEl, soundBtn);
    }

    /* ── Экран благодарности ── */
    var thanksEl = document.createElement("div");
    thanksEl.id        = "rbThanksScreen";
    thanksEl.className = "rb-thanks-screen rb-hidden";
    thanksEl.setAttribute("aria-live", "assertive");
    thanksEl.innerHTML = [
      '<div class="rb-thanks-card">',
        '<div class="rb-thanks-icon">❤️</div>',
        '<p class="rb-thanks-title">Спасибо за поддержку!</p>',
        '<p class="rb-thanks-sub">Подготавливаем ваш бонус…</p>',
        '<div class="rb-thanks-dots"><span></span><span></span><span></span></div>',
      '</div>'
    ].join("");
    document.body.appendChild(thanksEl);

    /* ── Экран получения награды ── */
    var rewardEl = document.createElement("div");
    rewardEl.id        = "rbRewardScreen";
    rewardEl.className = "rb-reward-screen rb-hidden";
    rewardEl.setAttribute("aria-live", "assertive");
    rewardEl.innerHTML = [
      '<div class="rb-reward-card">',
        '<div class="rb-reward-icon">🎁</div>',
        '<p class="rb-reward-title">Награда получена!</p>',
        '<p class="rb-reward-amount" id="rbRewardAmount">+0 очков</p>',
        '<p class="rb-reward-sub">Приятной игры! Следующий бонус доступен через 24 ч.</p>',
        '<button class="rb-reward-close" id="rbRewardClose" type="button">Отлично!</button>',
      '</div>'
    ].join("");
    document.body.appendChild(rewardEl);

    document.getElementById("rbRewardClose").addEventListener("click", rbCloseRewardScreen);

    rbUpdateButton();
  }

  function rbUpdateButton() {
    var btn      = document.getElementById("reviewBonusBtn");
    var badge    = document.getElementById("rbCooldownBadge");
    var badgeText = document.getElementById("rbCooldownText");

    /* ── Бонус получен навсегда: полностью скрываем кнопку и бейдж ── */
    if (reviewBonus.claimedForever) {
      if (btn && !btn.classList.contains("rb-btn-gone")) {
        btn.classList.add("rb-btn-fading");
        setTimeout(function () { if (btn) btn.classList.add("rb-btn-gone"); }, 500);
      }
      if (badge && !badge.classList.contains("rb-badge-hidden")) {
        badge.classList.remove("rb-badge-visible");
        setTimeout(function () { badge.classList.add("rb-badge-hidden"); }, 320);
      }
      return;
    }

    if (!rbCanClaim()) {
      /* ── Кулдаун активен: плавно скрываем кнопку ── */
      if (btn && !btn.classList.contains("rb-btn-fading") && !btn.classList.contains("rb-btn-gone")) {
        btn.classList.add("rb-btn-fading");
        setTimeout(function () {
          if (btn) btn.classList.add("rb-btn-gone");
        }, 500);
      }

      /* Обновляем текст таймера */
      var sec = rbCooldownSeconds();
      if (badgeText) {
        if (sec > 0) {
          var h = Math.floor(sec / 3600);
          var m = Math.floor((sec % 3600) / 60);
          var s = sec % 60;
          badgeText.textContent =
            String(h).padStart(2, "0") + ":" +
            String(m).padStart(2, "0") + ":" +
            String(s).padStart(2, "0");
        } else {
          badgeText.textContent = "скоро";
        }
      }

      /* Показываем бейдж: сначала display:flex, потом opacity через rAF */
      if (badge && badge.classList.contains("rb-badge-hidden")) {
        badge.classList.remove("rb-badge-hidden");
        requestAnimationFrame(function () {
          badge.classList.add("rb-badge-visible");
        });
      }

    } else {
      /* ── Кулдаун снят: возвращаем кнопку, прячем бейдж ── */
      if (btn) {
        btn.classList.remove("rb-btn-fading", "rb-btn-gone");
        btn.disabled = false;
        btn.querySelector(".rb-btn-text").textContent = "Бонус за отзыв";
      }

      /* Скрываем бейдж: fade opacity, потом display:none */
      if (badge && !badge.classList.contains("rb-badge-hidden")) {
        badge.classList.remove("rb-badge-visible");
        setTimeout(function () {
          badge.classList.add("rb-badge-hidden");
        }, 320);
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════
     ОСНОВНОЙ ПОТОК
     ══════════════════════════════════════════════════════════════ */

  function rbHandleClick() {
    if (!rbCanClaim()) {
      if (reviewBonus.claimedForever) {
        showStackedToast("rb_used", "Бонус за отзыв уже получен — спасибо за поддержку! ❤️");
      } else {
        showStackedToast("rb_cooldown", "Бонус за отзыв уже получен — следующий через 24 ч.");
      }
      playSound("deny");
      return;
    }
    if (isAdRunning) {
      showStackedToast("rb_ad_wait", "Дождитесь завершения текущей рекламы");
      return;
    }

    /* Шаг 1 — запрос отзыва через Yandex SDK */
    rbRequestReview();
  }

  function rbRequestReview() {
    if (ysdk && ysdk.feedback) {
      /* Yandex SDK 2.x: проверяем canReview, потом requestReview */
      ysdk.feedback.canReview()
        .then(function (result) {
          if (result.value) {
            /* Платформа разрешает запросить отзыв */
            showToast("Оставленный отзыв помогает улучшить игру ❤️");
            return ysdk.feedback.requestReview();
          } else {
            /* canReview вернул false (уже оставлял, платформа не поддерживает) —
               всё равно идём дальше к экрану благодарности */
            console.log("[RB] canReview false:", result.reason);
            return Promise.resolve({ feedbackSent: false });
          }
        })
        .then(function () {
          /* Независимо от того, оставил ли игрок отзыв —
             показываем экран благодарности и запускаем рекламу */
          rbShowThanksScreen();
        })
        .catch(function (err) {
          console.warn("[RB] feedback API error:", err);
          /* При ошибке API тоже идём дальше — не блокируем игрока */
          rbShowThanksScreen();
        });
    } else {
      /* SDK недоступен (локальная разработка) — пропускаем запрос отзыва */
      showToast("Оставленный отзыв помогает улучшить игру ❤️");
      rbShowThanksScreen();
    }
  }

  /* Шаг 2 — экран благодарности (1.8 сек, затем реклама) */
  function rbShowThanksScreen() {
    var el = document.getElementById("rbThanksScreen");
    if (!el) return;
    el.classList.remove("rb-hidden");
    void el.offsetWidth;
    el.classList.add("rb-visible");

    setTimeout(function () {
      /* Шаг 3 — fullscreen реклама Yandex SDK */
      rbShowInterstitialAd(function (adShown) {
        /* Реклама завершена (или не показалась) — скрываем экран благодарности */
        el.classList.remove("rb-visible");
        setTimeout(function () {
          el.classList.add("rb-hidden");
          /* Шаг 4 — выдаём награду */
          rbGrantReward(adShown);
        }, 350);
      });
    }, 1800);
  }

  /* Шаг 3 — Fullscreen / Interstitial реклама Yandex Games SDK */
  function rbShowInterstitialAd(callback) {
    /* Единственный вызов; все защиты от дублирования внутри */
    var settled = false;
    function settle(shown) {
      if (settled) return;
      settled = true;
      resumeGameAfterAd();
      callback(shown);
    }

    pauseGameForAd();

    if (ysdk && ysdk.adv) {
      ysdk.adv.showFullscreenAdv({
        callbacks: {
          onOpen: function () {
            console.log("[RB] Fullscreen ad opened");
          },
          onClose: function (wasShown) {
            /* wasShown=true — реклама показалась и закрылась;
               wasShown=false — рекламы не было (лимит, ошибка сети) */
            settle(!!wasShown);
          },
          onError: function (e) {
            console.error("[RB] Fullscreen ad error:", e);
            settle(false);
          },
          onOffline: function () {
            console.warn("[RB] Ad: offline");
            settle(false);
          }
        }
      });
    } else {
      /* Dev-режим: симулируем задержку рекламы */
      setTimeout(function () { settle(true); }, 1200);
    }
  }

  /* Шаг 4 — выдаём награду (только если поток завершён корректно) */
  function rbGrantReward(adWasShown) {
    /* Блокируем повторное получение навсегда */
    reviewBonus.sessionUsed    = true;
    reviewBonus.claimedForever = true;
    reviewBonus.cooldownUntil  = 0;
    rbSave();
    rbUpdateButton();

    var amount = rbRewardAmount();
    addPoints(amount);
    saveGame();

    /* Показываем экран награды */
    var amountEl = document.getElementById("rbRewardAmount");
    if (amountEl) amountEl.textContent = "+" + formatNumber(amount) + " очков";

    /* Меняем подпись — больше таймера нет */
    var subEl = document.querySelector(".rb-reward-sub");
    if (subEl) subEl.textContent = "Спасибо за отзыв! Это был разовый бонус ❤️";

    var rewardEl = document.getElementById("rbRewardScreen");
    if (rewardEl) {
      rewardEl.classList.remove("rb-hidden");
      void rewardEl.offsetWidth;
      rewardEl.classList.add("rb-visible");
    }

    spawnCenterBurst("#ffeb3b");
    spawnCenterBurst("#61ff8b");
    playSound("jackpot");

    var note = adWasShown
      ? "🎁 Бонус за отзыв получен: +" + formatNumber(amount) + " очков!"
      : "🎁 Бонус за поддержку: +" + formatNumber(amount) + " очков!";
    showBigAnnouncement(note);
  }

  function rbCloseRewardScreen() {
    var el = document.getElementById("rbRewardScreen");
    if (!el) return;
    el.classList.remove("rb-visible");
    setTimeout(function () { el.classList.add("rb-hidden"); }, 350);
  }

  /* ── Инициализация системы ── */
  function rbInit() {
    rbLoad();
    rbInjectUI();
    /* Тикаем каждую секунду — для точного обратного отсчёта в бейдже */
    setInterval(rbUpdateButton, 1000);
  }

  /* ═══════════════════════════════════════════════════════════════
     END REVIEW BONUS SYSTEM
     ═══════════════════════════════════════════════════════════════ */
