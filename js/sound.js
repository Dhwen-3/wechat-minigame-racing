'use strict';

/**
 * 极简合成音效：用 WebAudio 振荡器现场合成，不占用包体积。
 * 环境不支持时静默降级为无声。
 */

var ctx = null;
var enabled = true;

function ensureCtx() {
  if (ctx || !enabled) return ctx;
  try {
    if (typeof wx !== 'undefined' && typeof wx.createWebAudioContext === 'function') {
      ctx = wx.createWebAudioContext();
    }
  } catch (e) {
    ctx = null;
  }
  return ctx;
}

function tone(freq, dur, delay, type, gainValue) {
  var ac = ensureCtx();
  if (!ac) return;
  try {
    var osc = ac.createOscillator();
    var gain = ac.createGain();
    var t0 = ac.currentTime + (delay || 0);
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(gainValue || 0.1, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  } catch (e) {}
}

module.exports = {
  // 首次触摸时调用，解锁音频
  unlock: function () {
    ensureCtx();
    if (ctx && typeof ctx.resume === 'function') {
      try { ctx.resume(); } catch (e) {}
    }
  },
  crash: function () {
    tone(320, 0.22, 0, 'sawtooth', 0.13);
    tone(110, 0.38, 0.02, 'square', 0.11);
    tone(60, 0.3, 0.04, 'sine', 0.12);
  },
  setEnabled: function (value) {
    enabled = !!value;
    if (enabled) ensureCtx();
  },
  isEnabled: function () { return enabled; }
};
