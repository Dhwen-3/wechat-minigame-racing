'use strict';

/**
 * 游戏入口与主循环：场景切换（菜单/游戏/结算）、拖动控制、粒子与震动、存档与分享。
 */

var RaceGame = require('./core.js').RaceGame;
var Renderer = require('./render.js');
var storage = require('./storage.js');
var sound = require('./sound.js');

var GAME_TITLE = '极速赛车';

function getSystemInfo() {
  try {
    if (typeof wx.getWindowInfo === 'function') return wx.getWindowInfo();
  } catch (e) {}
  return wx.getSystemInfoSync();
}

function boot() {
  var canvas = wx.createCanvas();

  var info = getSystemInfo();
  var dpr = Math.min(Math.max(info.pixelRatio || 1, 1), 3);
  canvas.width = Math.round(info.screenWidth * dpr);
  canvas.height = Math.round(info.screenHeight * dpr);

  var view = {
    width: info.screenWidth,
    height: info.screenHeight,
    dpr: dpr,
    safeTop: 0,
    safeBottom: 0
  };
  if (info.safeArea) {
    view.safeTop = Math.max(0, info.safeArea.top || 0);
    view.safeBottom = Math.max(0, view.height - (info.safeArea.bottom || view.height));
  } else if (info.statusBarHeight) {
    view.safeTop = info.statusBarHeight;
  }

  var renderer = new Renderer(canvas, view);
  var game = new RaceGame({ width: view.width, height: view.height });
  game.best = storage.getBest();

  var raf = typeof canvas.requestAnimationFrame === 'function'
    ? canvas.requestAnimationFrame.bind(canvas)
    : (typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame.bind(typeof window === 'undefined' ? globalThis : window)
      : function (cb) { setTimeout(function () { cb(Date.now()); }, 16); });

  var muted = storage.getMute();
  sound.setEnabled(!muted);
  renderer.muted = muted;

  var scene = 'menu'; // menu | playing | over
  var menuScroll = 0;
  var particles = [];
  var shake = 0;
  var curTime = 0;
  var lastFrame = null;
  var touchStart = null;

  function showToast(text) {
    // 赛车没有常驻 toast UI，用 console 兜底即可（当前无使用场景）
    if (text) console.log('[提示]', text);
  }

  function vibrate(type) {
    try { wx.vibrateShort({ type: type }); } catch (e) {}
  }

  function startRun() {
    game.reset();
    game.best = storage.getBest();
    particles = [];
    shake = 0;
    scene = 'playing';
  }

  function crashFx() {
    shake = 14;
    var px = game.player.x;
    var py = game.playerY;
    var colors = ['#ffd54f', '#ff7043', '#eceff1'];
    for (var i = 0; i < 28; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = 60 + Math.random() * 280;
      particles.push({
        x: px, y: py,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
        life: 0.5 + Math.random() * 0.45, t: 0,
        color: colors[i % colors.length]
      });
    }
    sound.crash();
    vibrate('heavy');
  }

  function shareScore() {
    try {
      wx.shareAppMessage({ title: '「' + GAME_TITLE + '」我跑了 ' + game.meters() + ' 米，敢来比比吗！' });
    } catch (e) {}
  }

  function hit(rect, x, y) {
    return !!rect && x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;
  }

  function handleTap(x, y) {
    var L = renderer.layout;
    if (scene === 'menu') {
      if (hit(L.btnStart, x, y)) startRun();
      return;
    }
    if (scene === 'over') {
      if (hit(L.btnAgain, x, y)) startRun();
      else if (hit(L.btnShareO, x, y)) shareScore();
    }
  }

  wx.onTouchStart(function (e) {
    sound.unlock();
    if (e && e.changedTouches && e.changedTouches[0]) {
      touchStart = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
      if (scene === 'playing') game.setPlayerTarget(e.changedTouches[0].clientX);
    }
  });

  wx.onTouchMove(function (e) {
    if (scene !== 'playing') return;
    if (e && e.changedTouches && e.changedTouches[0]) {
      game.setPlayerTarget(e.changedTouches[0].clientX);
    }
  });

  wx.onTouchEnd(function (e) {
    if (!touchStart || !e || !e.changedTouches || !e.changedTouches[0]) return;
    var dx = e.changedTouches[0].clientX - touchStart.x;
    var dy = e.changedTouches[0].clientY - touchStart.y;
    var x = e.changedTouches[0].clientX;
    var y = e.changedTouches[0].clientY;
    touchStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) handleTap(x, y);
  });

  // 被动分享
  try {
    wx.showShareMenu({ withShareTicket: false });
    wx.onShareAppMessage(function () {
      return { title: '「' + GAME_TITLE + '」最高 ' + (game.best || 0) + ' 米，敢来比比吗？' };
    });
  } catch (e) {}

  function update(dt) {
    if (scene === 'menu') {
      menuScroll += 240 * dt;
    } else if (scene === 'playing') {
      game.update(dt);
      if (game.state === 'over') {
        scene = 'over';
        crashFx();
        var m = game.meters();
        game.newBest = m > game.best && m > 0;
        if (game.newBest) {
          storage.setBest(m);
          game.best = m;
        }
      }
    }
    // 粒子
    var kept = [];
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      p.t += dt;
      if (p.t < p.life) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 320 * dt;
        kept.push(p);
      }
    }
    particles = kept;
    if (shake > 0) shake = Math.max(0, shake - 42 * dt);
  }

  function draw(now) {
    renderer.draw(scene, game, { particles: particles, shake: shake }, now);
  }

  function frame(now) {
    if (lastFrame === null) lastFrame = now;
    var dt = (now - lastFrame) / 1000;
    lastFrame = now;
    if (dt > 0.05) dt = 0.05;
    update(dt);
    draw(now);
    raf(frame);
  }
  raf(frame);

  // 调试句柄：网页预览/自动化测试用
  if (typeof globalThis !== 'undefined') {
    globalThis.__racing = {
      getGame: function () { return game; },
      getScene: function () { return scene; },
      start: startRun,
      tap: handleTap,
      layout: function () { return renderer.layout; }
    };
  }
}

boot();
