

  function inviteShowButton() {
    if (inviteState.visible) return;
    var btn = document.getElementById("inviteOfferBtn");
    if (!btn) return;

    inviteState.visible = true;
    btn.classList.remove("invite-hidden");

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        btn.classList.add("invite-visible");
      });
    });

    if (inviteState.hideTimer) clearTimeout(inviteState.hideTimer);
    inviteState.hideTimer = setTimeout(function () {
      inviteHideButton(false);
    }, INVITE_SHOW_SECS * 1000);
  }

  function inviteHideButton(clicked) {
    if (inviteState.hideTimer) { clearTimeout(inviteState.hideTimer); inviteState.hideTimer = null; }
    var btn = document.getElementById("inviteOfferBtn");
    if (!btn) return;

    btn.classList.remove("invite-visible");

    setTimeout(function () {
      btn.classList.add("invite-hidden");
      inviteState.visible = false;
    }, 400);

    if (!clicked) {

      inviteState.elapsed = 0;
    }
  }

  function inviteHandleClick() {
    inviteHideButton(true);
    inviteState.elapsed = 0;

    var shareUrl   = (typeof location !== "undefined") ? location.href : "https://yandex.ru/games/";
    var shareTitle = "Brainrot Evolution Clicker";
    var shareText  = "Играю в Brainrot Evolution Clicker — засасывает с первого клика! Присоединяйся 🧠";

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

    if (navigator.share) {
      navigator.share({ title: shareTitle, text: shareText, url: shareUrl })
        .then(function () { inviteGrantReward(); })
        .catch(function () {   });
      return;
    }

    inviteFallbackShare(shareText, shareUrl);
  }

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

  function inviteManualCopyPrompt(text) {
    try { window.prompt("Скопируй и отправь другу:", text); } catch (e) {}
    inviteGrantReward();
  }

  function inviteGrantReward() {

    var bonus = Math.max(50, Math.round(state.income * 300));
    addPoints(bonus);
    showToast("🎉 Спасибо за приглашение! +" + formatNumber(bonus) + " брейнрот-очков");
    playSound("evolve");
  }

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

  function inviteInit() {
    inviteInitDom();
    inviteState.running = true;
  }
