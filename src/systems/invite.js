// systems/invite.js  (lines 1527-1657 of src/main.js)
// Periodic invite-friend button and reward.
// NOTE: This file is a readable extract. The live bundle is src/main.js.

/**
 * systems/invite.js
 * Periodic invite-friend button and reward flow.
 * Part of src/main.js — do not load standalone.
 */

  function inviteShowButton() {
    if (inviteState.visible) return;          // anti-duplicate guard
    var btn = document.getElementById("inviteOfferBtn");
    if (!btn) return;

    inviteState.visible = true;
    btn.classList.remove("invite-hidden");
    // rAF → класс visible для плавного fade-in
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        btn.classList.add("invite-visible");
      });
    });

    // Автоскрытие через INVITE_SHOW_SECS
    if (inviteState.hideTimer) clearTimeout(inviteState.hideTimer);
    inviteState.hideTimer = setTimeout(function () {
      inviteHideButton(false);
    }, INVITE_SHOW_SECS * 1000);
  }

  /* ── Скрыть кнопку ── */
  function inviteHideButton(clicked) {
    if (inviteState.hideTimer) { clearTimeout(inviteState.hideTimer); inviteState.hideTimer = null; }
    var btn = document.getElementById("inviteOfferBtn");
    if (!btn) return;

    btn.classList.remove("invite-visible");
    // После transition удаляем из потока
    setTimeout(function () {
      btn.classList.add("invite-hidden");
      inviteState.visible = false;
    }, 400);

    if (!clicked) {
      // Игрок не кликнул — сбрасываем таймер, ждём следующего цикла
      inviteState.elapsed = 0;
    }
  }

  /* ── Клик по кнопке: открываем шеринг ── */
  function inviteHandleClick() {
    inviteHideButton(true);
    inviteState.elapsed = 0;   // сбросить таймер независимо от результата

    var shareUrl   = (typeof location !== "undefined") ? location.href : "https://yandex.ru/games/";
    var shareTitle = "Brainrot Evolution Clicker";
    var shareText  = "Играю в Brainrot Evolution Clicker — засасывает с первого клика! Присоединяйся 🧠";

    /* Попытка 1: Yandex Games SDK shortcut/environment share */
    if (ysdk && ysdk.shortcut && typeof ysdk.shortcut.canShowPrompt === "function") {
      ysdk.shortcut.canShowPrompt().then(function (result) {
        if (result && result.canShow) {
          ysdk.shortcut.showPrompt().then(function (res) {
            if (res && res.outcome === "accepted") {
              inviteGrantReward();
            }
          }).catch(function () { inviteFallbackShare(shareText, shareUrl); });
        } else {
          inviteFallbackShare(shareText, shareUrl);
        }
      }).catch(function () { inviteFallbackShare(shareText, shareUrl); });
      return;
    }

    /* Попытка 2: Web Share API (мобильный браузер, Яндекс Браузер) */
    if (navigator.share) {
      navigator.share({ title: shareTitle, text: shareText, url: shareUrl })
        .then(function () { inviteGrantReward(); })
        .catch(function () { /* пользователь отменил — без награды */ });
      return;
    }

    /* Попытка 3: копируем ссылку в буфер и выдаём награду */
    inviteFallbackShare(shareText, shareUrl);
  }

  /* ── Fallback: копируем ссылку, показываем тост, выдаём награду ── */
  function inviteFallbackShare(text, url) {
    var combined = text + "\n" + url;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(combined)
        .then(function () {
          showToast("📋 Ссылка скопирована! Поделись с другом");
          inviteGrantReward();
        })
        .catch(function () { inviteManualCopyPrompt(combined); });
    } else {
      inviteManualCopyPrompt(combined);
    }
  }

  /* ── Последний fallback: prompt с текстом для ручного копирования ── */
  function inviteManualCopyPrompt(text) {
    try { window.prompt("Скопируй и отправь другу:", text); } catch (e) {}
    inviteGrantReward();
  }

  /* ── Выдача награды ── */
  function inviteGrantReward() {
    // Бонус = 5 минут текущего пассивного дохода (минимум 50 очков)
    var bonus = Math.max(50, Math.round(state.income * 300));
    addPoints(bonus);
    showToast("🎉 Спасибо за приглашение! +" + formatNumber(bonus) + " брейнрот-очков");
    playSound("evolve");
  }

  /* ── Инъекция кнопки в DOM ── */
  function inviteInitDom() {
    var btn = document.createElement("button");
    btn.id        = "inviteOfferBtn";
    btn.type      = "button";
    btn.className = "invite-offer-btn invite-hidden";
    btn.setAttribute("aria-label", "Пригласить друга за бонус");
    btn.innerHTML =
      '<span class="invite-icon">🎁</span>' +
      '<span class="invite-text">Пригласить друга за бонус</span>';
    btn.addEventListener("click", inviteHandleClick);
    document.body.appendChild(btn);
  }

  /* ── Инициализация ── */
  function inviteInit() {
    inviteInitDom();
    inviteState.running = true;
  }

  /* ═══════════════════════════════════════════════════════════════
     END PERIODIC INVITE BONUS SYSTEM
     ═══════════════════════════════════════════════════════════════ */

