

  var INTERSTITIAL_INTERVAL = 10 * 60;

  var aiState = {
    elapsed:      0,
    pending:      false,
    pendingWait:  0,
    lastShownAt:  0,
    running:      false
  };

  function aiIsSafeToShow() {

    if (isAdRunning) return false;

    if (gamePaused) return false;

    if (document.hidden) return false;

    if (state.hatching) return false;

    var equippedModal = document.getElementById("equippedModal");
    if (equippedModal && !equippedModal.classList.contains("hidden")) return false;
    var rebirthModal = document.getElementById("rebirthModal");
    if (rebirthModal && !rebirthModal.classList.contains("hidden")) return false;

    var rbThanks = document.getElementById("rbThanksScreen");
    if (rbThanks && !rbThanks.classList.contains("rb-hidden")) return false;
    var rbReward = document.getElementById("rbRewardScreen");
    if (rbReward && !rbReward.classList.contains("rb-hidden")) return false;

    if (els.bigAnnouncement && !els.bigAnnouncement.classList.contains("hidden")) return false;
    return true;
  }

  function aiTick(dt) {
    if (!aiState.running) return;

    if (isAdRunning || gamePaused || document.hidden || state.hatching) return;

    aiState.elapsed += dt;

    if (aiState.elapsed < INTERSTITIAL_INTERVAL && !aiState.pending) return;

    if (!aiState.pending) {
      aiState.pending     = true;
      aiState.pendingWait = 0;
    }

    aiState.pendingWait += dt;

    if (!aiIsSafeToShow()) {

      if (aiState.pendingWait < 60) return;
    }

    aiTrigger();
  }

  function aiTrigger() {

    aiState.elapsed      = 0;
    aiState.pending      = false;
    aiState.pendingWait  = 0;
    aiState.lastShownAt  = Date.now();

    aiShowAd();
  }

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

              aiState.elapsed = INTERSTITIAL_INTERVAL - 180;
            }
            settle();
          },
          onError: function (e) {
            console.error("[AI] Interstitial error:", e);

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

      console.log("[AI] SDK не найден, пропускаем interstitial (dev-режим)");
      setTimeout(settle, 400);
    }
  }

  function aiInit() {
    aiState.running = true;

    aiState.elapsed = 0;
  }
