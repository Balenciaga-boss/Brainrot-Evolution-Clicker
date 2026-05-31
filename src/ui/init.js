// ui/init.js  (lines 1658-1958 of src/main.js)
// init(), cacheElements(), injectUI(), bindEvents().
// NOTE: This file is a readable extract. The live bundle is src/main.js.

/**
 * ui/init.js
 * init(), cacheElements(), injectEquippedPetsUI(), bindEvents().
 * Part of src/main.js — do not load standalone.
 */

  function init() {
    cacheElements();
    setupCanvas();
    bindEvents();
    adInitDom();
    adLoadState();
    adResetBuffTimer();
    adRenderStatus();
    rbInit();
    aiInit();
    inviteInit();
    injectAutoClickerButton();
    // loadGame() запускает асинхронную цепочку; renderShop/updateUi
    // вызываются внутри _postLoadSetup() после получения данных.
    loadGame();
    requestAnimationFrame(loop);
    setInterval(saveGame, 10000);
    setInterval(spawnRandomEvent, 1000);
    showToast("Добро пожаловать в брейнрот!");
  }

  function cacheElements() {
    els.canvas = document.getElementById("effectsCanvas");
    els.ctx = els.canvas.getContext("2d", { alpha: true });
    els.shell = document.getElementById("gameShell");
    els.creatureButton = document.getElementById("creatureButton");
    els.creature = document.getElementById("creature");
    els.creatureSymbol = document.getElementById("creatureSymbol");
    els.pointsText = document.getElementById("pointsText");
    els.incomeText = document.getElementById("incomeText");
    els.clickPowerText = document.getElementById("clickPowerText");
    els.comboText = document.getElementById("comboText");
    els.critText = document.getElementById("critText");
    els.jackpotText = document.getElementById("jackpotText");
    els.mutationText = document.getElementById("mutationText");
    els.stageName = document.getElementById("stageName");
    els.nextStageText = document.getElementById("nextStageText");
    els.evolutionProgress = document.getElementById("evolutionProgress");
    els.shopList = document.getElementById("shopList");
    els.shopTitle = document.getElementById("shopTitle");
    els.shopMiniTitle = document.getElementById("shopMiniTitle");
    els.shopPageTabs = Array.prototype.slice.call(document.querySelectorAll("[data-shop-page]"));
    els.saveButton = document.getElementById("saveButton");
    els.soundButton = document.getElementById("soundButton");
    els.toastStack = document.getElementById("toastStack");
    els.eventBanner = document.getElementById("eventBanner");
    els.petBonusText = document.getElementById("petBonusText");
    els.activePet = document.getElementById("activePet");
    els.bigAnnouncement = document.getElementById("bigAnnouncement");
    els.hatchOverlay = document.getElementById("hatchOverlay");
    els.hatchCard = document.getElementById("hatchCard");
    els.hatchEgg = document.getElementById("hatchEgg");
    els.hatchResult = document.getElementById("hatchResult");
    els.hatchPetFace = document.getElementById("hatchPetFace");
    els.hatchPetName = document.getElementById("hatchPetName");
    els.hatchPetRarity = document.getElementById("hatchPetRarity");
    els.hatchPetBonus = document.getElementById("hatchPetBonus");
    els.equippedPetsBtn = document.getElementById("equippedPetsBtn");
    els.equippedPetsBtnCount = document.getElementById("equippedPetsBtnCount");
    els.equippedModal = document.getElementById("equippedModal");
    els.equippedModalClose = document.getElementById("equippedModalClose");
    els.equippedModalBody = document.getElementById("equippedModalBody");

    // If button/modal aren't in the HTML yet, inject them now
    if (!els.equippedPetsBtn) {
      injectEquippedPetsUI();
      els.equippedPetsBtn     = document.getElementById("equippedPetsBtn");
      els.equippedPetsBtnCount = document.getElementById("equippedPetsBtnCount");
      els.equippedModal       = document.getElementById("equippedModal");
      els.equippedModalClose  = document.getElementById("equippedModalClose");
      els.equippedModalBody   = document.getElementById("equippedModalBody");
    }

    els.rebirthModal      = document.getElementById("rebirthModal");
    els.rebirthModalClose = document.getElementById("rebirthModalClose");
    els.rebirthActionBtn  = document.getElementById("rebirthActionBtn");
  }

  function injectEquippedPetsUI() {
    // Find the Питомец article inside .bonus-row and append button there
    var petArticle = null;
    var bonusRow = document.querySelector(".bonus-row");
    if (bonusRow) {
      bonusRow.querySelectorAll("article").forEach(function (a) {
        if (a.querySelector("#petBonusText")) petArticle = a;
      });
    }
    if (petArticle) {
      petArticle.classList.add("bonus-row-pet-article");
      var btn = document.createElement("button");
      btn.className = "equipped-pets-btn";
      btn.id = "equippedPetsBtn";
      btn.type = "button";
      btn.setAttribute("aria-label", "Посмотреть одетых питомцев");
      btn.innerHTML = '<span class="equipped-pets-btn-icon">🐾</span><span class="equipped-pets-btn-label">Смотреть</span><span class="equipped-pets-btn-count" id="equippedPetsBtnCount">0/3</span>';
      petArticle.appendChild(btn);
    }

    // Inject rebirth stat card into bonus-row (before pet article)
    if (bonusRow && !document.getElementById("rebirthStatText")) {
      var rebirthArticle = document.createElement("article");
      rebirthArticle.innerHTML = '<span>Перерождения</span><strong id="rebirthStatText">нет</strong>';
      if (petArticle) {
        bonusRow.insertBefore(rebirthArticle, petArticle);
      } else {
        bonusRow.appendChild(rebirthArticle);
      }
      // Expand grid to fit 5 columns
      bonusRow.classList.add("bonus-row-cols-5");
    }

    // Inject rarity badge into stage name span
    var stageNameEl = document.getElementById("stageName");
    if (stageNameEl && !document.getElementById("stageRarityBadge")) {
      var badge = document.createElement("span");
      badge.id = "stageRarityBadge";
      badge.className = "stage-rarity-badge";
      badge.textContent = "Обычный";
      stageNameEl.appendChild(badge);
    }

    // Inject rebirth button under stage progress bar (opens modal, does NOT perform rebirth directly)
    if (!document.getElementById("rebirthBtn")) {
      var stagePanel = document.querySelector(".stage-panel");
      if (stagePanel) {
        var actionsRow = stagePanel.querySelector(".stage-actions");
        if (!actionsRow) {
          actionsRow = document.createElement("div");
          actionsRow.className = "stage-actions";
          stagePanel.appendChild(actionsRow);
        }
        var rebirthBar = document.createElement("div");
        rebirthBar.className = "rebirth-bar";
        rebirthBar.innerHTML = '<button class="rebirth-btn rebirth-open-btn" id="rebirthBtn" type="button" disabled>⭕ Путь Перерождений</button>';
        actionsRow.appendChild(rebirthBar);

        // Bind click → open modal
        var rebirthBtnEl = rebirthBar.querySelector("#rebirthBtn");
        if (rebirthBtnEl) rebirthBtnEl.addEventListener("click", openRebirthModal);
      }
    }

    // Inject equipped pets modal into body
    var wrapperPets = document.createElement("div");
    wrapperPets.innerHTML = [
      '<div class="equipped-modal-backdrop hidden" id="equippedModal" aria-modal="true" role="dialog" aria-label="Одетые питомцы">',
        '<div class="equipped-modal-box">',
          '<div class="equipped-modal-header">',
            '<div>',
              '<span class="mini-label">Активные питомцы</span>',
              '<h2 class="equipped-modal-title">Одетые питомцы</h2>',
            '</div>',
            '<button class="equipped-modal-close" id="equippedModalClose" type="button" aria-label="Закрыть">✕</button>',
          '</div>',
          '<div class="equipped-modal-body" id="equippedModalBody"></div>',
        '</div>',
      '</div>'
    ].join("");
    document.body.appendChild(wrapperPets.firstElementChild);

    // Inject rebirth modal into body
    var wrapperRebirth = document.createElement("div");
    wrapperRebirth.innerHTML = [
      '<div class="rebirth-modal-backdrop hidden" id="rebirthModal" aria-modal="true" role="dialog" aria-label="Путь Перерождений">',
        '<div class="rebirth-modal-box">',
          '<div class="rebirth-modal-header">',
            '<div>',
              '<span class="mini-label">Система прогрессии</span>',
              '<h2 class="rebirth-modal-title">⭕ Путь Перерождений</h2>',
            '</div>',
            '<button class="rebirth-modal-close" id="rebirthModalClose" type="button" aria-label="Закрыть">✕</button>',
          '</div>',
          '<div class="rebirth-modal-body" id="rebirthModalBody">',
            '<div id="rebirthTrack" class="rebirth-track"></div>',
            '<div class="rebirth-modal-action">',
              '<button class="rebirth-action-btn" id="rebirthActionBtn" type="button" disabled>🔁 Доступно с этапа 10</button>',
            '</div>',
          '</div>',
        '</div>',
      '</div>'
    ].join("");
    document.body.appendChild(wrapperRebirth.firstElementChild);
  }

  function setupCanvas() {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas, { passive: true });
  }

  function resizeCanvas() {
    var ratio = Math.min(window.devicePixelRatio || 1, 2);
    els.canvas.width = Math.floor(window.innerWidth * ratio);
    els.canvas.height = Math.floor(window.innerHeight * ratio);
    els.canvas.style.width = window.innerWidth + "px";
    els.canvas.style.height = window.innerHeight + "px";
    els.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function bindEvents() {
    registerAudioUnlockHandlers();

    // П. 1.6.1.8 / 1.6.2.7: запрет контекстного меню на игровом поле
    // (лонгтап / правая кнопка мыши не должны открывать системное меню)
    document.getElementById("gameShell").addEventListener("contextmenu", function (e) {
      e.preventDefault();
    });

    els.creatureButton.addEventListener("pointerdown", function (event) {
      event.preventDefault();
      ensureAudio(); // must be called directly inside a user gesture handler
      handleCreatureClick(event.clientX, event.clientY);
    });

    els.shopList.addEventListener("click", function (event) {
      var button = event.target.closest(".upgrade-button:not(.upgrade-special)");
      var specialButton = event.target.closest(".upgrade-special");
      var eggButton = event.target.closest(".egg-button");
      var petButton = event.target.closest(".pet-card") || event.target.closest(".pc2-main");
      var adUpgradeBtn = event.target.closest("[data-ad-upgrade]");
      var adEggBtn     = event.target.closest("[data-ad-egg]");
      var eggChancesBtn = event.target.closest("[data-egg-chances]");
      if (adUpgradeBtn) { adRequestUpgrade(adUpgradeBtn.dataset.adUpgrade); return; }
      if (adEggBtn)     { adRequestEgg(adEggBtn.dataset.adEgg); return; }
      if (eggChancesBtn) { toggleEggPreview(eggChancesBtn); return; }
      if (specialButton && specialButton.dataset.specialId) { buySpecialUpgrade(specialButton.dataset.specialId); return; }
      if (button)    buyUpgrade(button.dataset.id);
      if (eggButton) openEgg(eggButton.dataset.id);
      var petUpgradeBtn = event.target.closest('.pet-upgrade-btn');
      if (petUpgradeBtn) { upgradePet(petUpgradeBtn.dataset.id); return; }
      if (petButton) { equipPet(petButton.dataset.id); return; }
    });
    els.shopList.addEventListener("pointerover", updateShopAffordability);
    els.shopList.addEventListener("focusin", updateShopAffordability);

    els.shopPageTabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        var page = tab.dataset.shopPage === "eggs" ? "eggs" : "upgrades";
        if (state.shopPage === page) return;
        state.shopPage = page;
        els.shopList.classList.remove("page-swap");
        void els.shopList.offsetWidth;
        els.shopList.classList.add("page-swap");
        renderShop();
        playSound("buy");
      });
    });

    if (els.shopPageButton) {
      els.shopPageButton.addEventListener("click", function () {
        state.shopPage = state.shopPage === "upgrades" ? "eggs" : "upgrades";
        els.shopList.classList.remove("page-swap");
        void els.shopList.offsetWidth;
        els.shopList.classList.add("page-swap");
        renderShop();
        playSound("buy");
      });
    }

    els.saveButton.addEventListener("click", function () {
      saveGame();
      showStackedToast("game_saved", "Игра сохранена!");
      playSound("save");
    });

    els.soundButton.addEventListener("click", function () {
      state.sound = !state.sound;
      els.soundButton.textContent = state.sound ? "🔊" : "🔇";
      els.soundButton.setAttribute("aria-label", state.sound ? "Звук включён" : "Звук выключен");
      if (state.sound) {
        ensureAudio();
      } else {
        resetAudioContext();
      }
      saveGame();
    });

    // П. 1.3: при сворачивании страницы звук останавливается (требование Яндекс Игр)
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        saveGame();
      } else {
        // Сбрасываем lastTick чтобы первый кадр после возврата имел dt=0
        // и не спровоцировал накопленный игровой тик
        lastTick = performance.now();
      }
    });

    window.addEventListener("blur", function () {
      if (audioContext && audioContext.state === "running") {
        try {
          audioContext.suspend().catch(function () {});
        } catch (e) {}
      }
    });

    window.addEventListener("focus", function () {
      lastTick = performance.now();
    });

    var rebirthBtn = document.getElementById("rebirthBtn");
    if (rebirthBtn) rebirthBtn.addEventListener("click", openRebirthModal);

    els.equippedPetsBtn && els.equippedPetsBtn.addEventListener("click", function () {
      openEquippedModal();
    });

    els.equippedModalClose && els.equippedModalClose.addEventListener("click", function () {
      closeEquippedModal();
    });

    els.equippedModal && els.equippedModal.addEventListener("click", function (event) {
      if (event.target === els.equippedModal) closeEquippedModal();
    });

    // Rebirth modal wiring (elements injected by injectEquippedPetsUI)
    var rebirthModalEl = document.getElementById("rebirthModal");
    var rebirthModalCloseEl = document.getElementById("rebirthModalClose");
    var rebirthActionBtnEl = document.getElementById("rebirthActionBtn");
    if (rebirthModalCloseEl) rebirthModalCloseEl.addEventListener("click", closeRebirthModal);
    if (rebirthModalEl) rebirthModalEl.addEventListener("click", function (event) {
      if (event.target === rebirthModalEl) closeRebirthModal();
    });
    if (rebirthActionBtnEl) rebirthActionBtnEl.addEventListener("click", function () {
      closeRebirthModal();
      doRebirth();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        if (els.equippedModal && !els.equippedModal.classList.contains("hidden")) closeEquippedModal();
        if (!document.getElementById("rebirthModal").classList.contains("hidden")) closeRebirthModal();
      }
    });
  }
