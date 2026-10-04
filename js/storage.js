'use strict';

/**
 * 本地存储封装：最高里程、静音开关。
 * 微信的同步存储接口在部分环境可能抛错，这里统一 try/catch 兜底。
 */

var KEY_BEST = 'racing_best';
var KEY_MUTE = 'racing_mute';
var KEY_CAR = 'racing_car';

function read(key) {
  try {
    return wx.getStorageSync(key);
  } catch (e) {
    return null;
  }
}

function write(key, value) {
  try {
    wx.setStorageSync(key, value);
  } catch (e) {}
}

module.exports = {
  getBest: function () {
    var v = read(KEY_BEST);
    return typeof v === 'number' && isFinite(v) && v > 0 ? Math.floor(v) : 0;
  },
  setBest: function (value) { write(KEY_BEST, Math.floor(value)); },
  getMute: function () { return read(KEY_MUTE) === true; },
  setMute: function (value) { write(KEY_MUTE, !!value); },
  getCar: function () {
    var v = read(KEY_CAR);
    return typeof v === 'string' && v ? v : null;
  },
  setCar: function (id) { write(KEY_CAR, String(id)); }
};
