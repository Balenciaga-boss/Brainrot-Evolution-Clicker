

  var els = {};
  var particles = [];
  var floatingTexts = [];
  var audioContext = null;
  var lastTick = performance.now();
  var lastUiUpdate = 0;
  var randomEventTimer = 18;
  var activePetRenderKey = "";

  var ysdk   = null;
  var yplayer = null;

  var useCloudSave = false;

  (function bootWithSdk() {
    if (typeof YaGames === "undefined") {

      console.warn("[YaSDK] YaGames не найден — запуск без SDK");
      document.addEventListener("DOMContentLoaded", init);
      return;
    }

    YaGames.init()
      .then(function (sdk) {
        ysdk = sdk;
        console.log("[YaSDK] SDK инициализирован");

        if (ysdk.features && ysdk.features.LoadingAPI) {
          ysdk.features.LoadingAPI.ready();
        }

        try {
          var lang = ysdk.environment && ysdk.environment.i18n && ysdk.environment.i18n.lang;
          if (lang) console.log("[YaSDK] Язык игрока:", lang);
        } catch (e) {   }

        return ysdk.getPlayer({ scopes: false });
      })
      .then(function (player) {
        yplayer = player;
        useCloudSave = true;
        console.log("[YaSDK] Игрок получен, облачные сохранения активны");
      })
      .catch(function (err) {

        console.warn("[YaSDK] getPlayer недоступен, используем localStorage:", err);
        useCloudSave = false;
      })
      .finally(function () {

        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", init);
        } else {
          init();
        }
      });
  })();

  var INVITE_INTERVAL   = 20 * 60;
  var INVITE_SHOW_SECS  = 30;

  var inviteState = {
    elapsed:   0,
    visible:   false,
    hideTimer: null,
    running:   false
  };

  function inviteCanTick() {
    if (!inviteState.running) return false;
    if (gamePaused)           return false;
    if (isAdRunning)          return false;
    if (document.hidden)      return false;
    if (state.hatching)       return false;
    return true;
  }

  function inviteTick(dt) {
    if (!inviteCanTick()) return;
    if (inviteState.visible) return;
    inviteState.elapsed += dt;
    if (inviteState.elapsed >= INVITE_INTERVAL) {
      inviteState.elapsed = 0;
      inviteShowButton();
    }
  }
