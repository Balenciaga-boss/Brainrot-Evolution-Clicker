/**
 * ui/modalUI.js
 * Manages modal-style overlays: invite-friend banner and future popups.
 */

import { state } from "../state.js";
import { INVITE_INTERVAL_SEC, INVITE_SHOW_SECS } from "../config.js";
import { formatNumber } from "../utils.js";

// ── Invite banner ─────────────────────────────────────────────────────────────

let _inviteShowing  = false;
let _inviteTimer    = INVITE_INTERVAL_SEC;
let _inviteHideTimer = 0;
let _inviteEl       = null;
let _ysdk           = null;
let _showToast      = null;

export function initInviteModal({ ysdk, showToast }) {
  _ysdk      = ysdk;
  _showToast = showToast;
}

export function tickInviteBanner(dt) {
  if (_inviteShowing) {
    _inviteHideTimer -= dt;
    if (_inviteHideTimer <= 0) hideInviteBanner();
    return;
  }

  _inviteTimer -= dt;
  if (_inviteTimer <= 0) {
    _inviteTimer = INVITE_INTERVAL_SEC;
    _showInviteBanner();
  }
}

function _showInviteBanner() {
  if (!_inviteEl) {
    _inviteEl = document.createElement("div");
    _inviteEl.id        = "inviteBanner";
    _inviteEl.className = "invite-banner hidden";
    _inviteEl.innerHTML = [
      "<span>Позови друга — вместе безумнее!</span>",
      '<button id="inviteBtn" type="button">Пригласить</button>',
      '<button id="inviteClose" type="button">✕</button>',
    ].join("");
    document.body.appendChild(_inviteEl);

    document.getElementById("inviteBtn").onclick = _handleInvite;
    document.getElementById("inviteClose").onclick = hideInviteBanner;
  }

  _inviteEl.classList.remove("hidden");
  void _inviteEl.offsetWidth;
  _inviteEl.classList.add("visible");
  _inviteShowing    = true;
  _inviteHideTimer  = INVITE_SHOW_SECS;
}

function _handleInvite() {
  if (_ysdk?.shortcut) {
    _ysdk.shortcut.canShowPrompt()
      .then(r => r.canShow && _ysdk.shortcut.showPrompt())
      .catch(() => {});
  }
  _showToast?.("Пригласи друга и открой секретный кринж вместе!");
  hideInviteBanner();
}

export function hideInviteBanner() {
  if (!_inviteEl) return;
  _inviteEl.classList.remove("visible");
  _inviteEl.addEventListener("transitionend", () => _inviteEl.classList.add("hidden"), { once: true });
  _inviteShowing = false;
}

// ── Generic confirm modal ─────────────────────────────────────────────────────

/**
 * Show a simple native confirm() — easily swappable for a custom modal later.
 * @returns {boolean}
 */
export function confirmModal(message) {
  return confirm(message);
}
