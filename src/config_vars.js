// config_vars.js  (lines 1411-1526 of src/main.js)
// Runtime vars: els, particles, audioContext, SDK bootstrap.
// NOTE: This file is a readable extract. The live bundle is src/main.js.

/**
 * config_vars.js
 * Runtime vars: els, particles, audio context, SDK bootstrap.
 * Part of src/main.js — do not load standalone.
 */

  var els = {};
  var particles = [];
  var floatingTexts = [];
  var audioContext = null;
  var lastTick = performance.now();
  var lastUiUpdate = 0;
  var randomEventTimer = 18;
  var activePetRenderKey = "";

  /* ═══════════════════════════════════════════════════════════════
     YANDEX GAMES SDK — инициализация
     Инициализируем SDK первым делом; игра стартует только после
     успешного получения объекта ysdk.  Если SDK недоступен
     (локальная разработка, сеть упала) — падаем в graceful-режим
     и запускаем игру без облачных фич.
     ═══════════════════════════════════════════════════════════════ */

  var ysdk   = null;   // Yandex Games SDK instance
  var yplayer = null;  // Player object (для облачных сохранений)

  /* Флаг: использовать ли облачные сохранения.
     true  — PlayerData API доступен (авторизованный игрок).
     false — fallback на localStorage.                          */
  var useCloudSave = false;

  /* Запускаем инициализацию SDK сразу при парсинге скрипта.
     Игра ждёт промиса и стартует внутри .then/.catch.         */
  (function bootWithSdk() {
    if (typeof YaGames === "undefined") {
      // SDK не загружен (локальная разработка)
      console.warn("[YaSDK] YaGames не найден — запуск без SDK");
      document.addEventListener("DOMContentLoaded", init);
      return;
    }

    YaGames.init()
      .then(function (sdk) {
        ysdk = sdk;
        console.log("[YaSDK] SDK инициализирован");

        // Сообщаем Яндексу, что игра готова к показу
        if (ysdk.features && ysdk.features.LoadingAPI) {
          ysdk.features.LoadingAPI.ready();
        }

        // П. 2.14: автоопределение языка через SDK (рекомендуется Яндексом)
        // Игра русскоязычная, но логируем язык для будущей локализации
        try {
          var lang = ysdk.environment && ysdk.environment.i18n && ysdk.environment.i18n.lang;
          if (lang) console.log("[YaSDK] Язык игрока:", lang);
        } catch (e) { /* некритично */ }

        // Пробуем получить объект игрока для облачных сохранений
        return ysdk.getPlayer({ scopes: false });
      })
      .then(function (player) {
        yplayer = player;
        useCloudSave = true;
        console.log("[YaSDK] Игрок получен, облачные сохранения активны");
      })
      .catch(function (err) {
        // Игрок не авторизован или getPlayer упал — не критично
        console.warn("[YaSDK] getPlayer недоступен, используем localStorage:", err);
        useCloudSave = false;
      })
      .finally(function () {
        // В любом случае запускаем игру
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", init);
        } else {
          init();
        }
      });
  })();

  /* ═══════════════════════════════════════════════════════════════
     PERIODIC INVITE BONUS SYSTEM
     Каждые 20 минут активного геймплея показывает кнопку
     «Пригласить друга за бонус» на 30 секунд.
     Таймер паузируется при неактивной вкладке, рекламе, оверлеях.
     Награда: единовременный бонус очками (5-минутный доход).
     Нет рекламы. Нет принуждения.
     ═══════════════════════════════════════════════════════════════ */

  var INVITE_INTERVAL   = 20 * 60;    // секунды активного геймплея между показами
  var INVITE_SHOW_SECS  = 30;        // сколько секунд кнопка висит на экране

  var inviteState = {
    elapsed:   0,       // активное время с последнего показа/сброса
    visible:   false,   // кнопка сейчас на экране
    hideTimer: null,    // setTimeout для автоскрытия
    running:   false
  };

  /* ── Блокирующие состояния (те же что у aiIsSafeToShow) ── */
  function inviteCanTick() {
    if (!inviteState.running) return false;
    if (gamePaused)           return false;
    if (isAdRunning)          return false;
    if (document.hidden)      return false;
    if (state.hatching)       return false;
    return true;
  }

  /* ── Вызывается из loop() каждый кадр ── */
  function inviteTick(dt) {
    if (!inviteCanTick()) return;
    if (inviteState.visible) return;   // кнопка уже видна — не накапливаем
    inviteState.elapsed += dt;
    if (inviteState.elapsed >= INVITE_INTERVAL) {
      inviteState.elapsed = 0;
      inviteShowButton();
    }
  }

  /* ── Показать кнопку ── */
