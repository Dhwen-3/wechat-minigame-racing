'use strict';

/**
 * 渲染层：公路卷动、程序化车辆、粒子、HUD、菜单与结算面板，全部 Canvas 现场绘制。
 */

var C = {
  grass: '#6da34d',
  road: '#4b4b52',
  roadEdge: '#3d3d44',
  dash: '#f0e6d2',
  curbRed: '#e53935',
  curbWhite: '#f5f5f5',
  textMain: '#ffffff',
  panelBg: '#faf8ef',
  panelText: '#4b4b52',
  textSub2: '#a89b8c',
  button: '#8f7a66',
  buttonFg: '#f9f6f2',
  startBtn: '#e53935',
  playerColor: '#e53935',
  glass: '#2b3a4a'
};

var GAME_TITLE_TEXT = '极速赛车';

function clamp01(t) { return t < 0 ? 0 : (t > 1 ? 1 : t); }

// 十六进制颜色明暗调整（amt 按每通道 0~255 的偏移量）
function shade(hex, amt) {
  var n = parseInt(hex.slice(1), 16);
  var amtN = amt / 255;
  var r = clamp01(((n >> 16) & 255) / 255 + amtN) * 255;
  var g = clamp01(((n >> 8) & 255) / 255 + amtN) * 255;
  var b = clamp01((n & 255) / 255 + amtN) * 255;
  return 'rgb(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ')';
}

function Renderer(canvas, view) {
  this.canvas = canvas;
  this.ctx = canvas.getContext('2d');
  this.view = view;
  this.dpr = view.dpr || 1;
  this.computeLayout();
}

Renderer.prototype.computeLayout = function () {
  var w = this.view.width;
  var h = this.view.height;
  var top = this.view.safeTop + 8;

  var startW = Math.min(w - 110, 250);
  var btnStart = { x: (w - startW) / 2, y: h * 0.54, w: startW, h: 58 };

  var panelW = Math.min(w - 56, 320);
  var panelH = Math.round(panelW * 0.62);
  var panel = { x: (w - panelW) / 2, y: (h - panelH) / 2 - 20, w: panelW, h: panelH };
  var btnW2 = Math.round(panelW * 0.42);
  var btnH2 = 46;
  var btnAgain = { x: panel.x + 20, y: panel.y + panel.h - btnH2 - 22, w: btnW2, h: btnH2 };
  var btnShareO = { x: panel.x + panel.w - 20 - btnW2, y: btnAgain.y, w: btnW2, h: btnH2 };

  this.layout = {
    top: top,
    btnStart: btnStart,
    panel: panel,
    btnAgain: btnAgain,
    btnShareO: btnShareO
  };
};

Renderer.prototype.roundRect = function (ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

Renderer.prototype.draw = function (scene, game, fx, now) {
  var ctx = this.ctx;
  var v = this.view;
  this._game = game;
  ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

  if (scene === 'menu') {
    this.drawRoad(game.distance);
    this.drawMenu(game);
    return;
  }

  ctx.save();
  if (fx.shake > 0.5) {
    ctx.translate((Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake);
  }
  this.drawRoad(game.distance);
  this.drawCars(game, now);
  this.drawParticles(fx.particles);
  ctx.restore();

  this.drawHud(game);

  if (scene === 'over') {
    this.drawOver(game, now);
  }
};

// 公路 + 路肩 + 车道虚线（distance 驱动卷动）
Renderer.prototype.drawRoad = function (distance) {
  var ctx = this.ctx;
  var v = this.view;
  var g = this._game;

  ctx.fillStyle = C.grass;
  ctx.fillRect(0, 0, v.width, v.height);

  var roadX = g ? g.roadX : (v.width - Math.min(v.width - 48, 430)) / 2;
  var roadW = g ? g.roadW : Math.min(v.width - 48, 430);
  var lanes = g ? g.lanes : 4;
  var laneW = roadW / lanes;

  ctx.fillStyle = C.road;
  ctx.fillRect(roadX, 0, roadW, v.height);
  ctx.fillStyle = C.roadEdge;
  ctx.fillRect(roadX, 0, 6, v.height);
  ctx.fillRect(roadX + roadW - 6, 0, 6, v.height);

  // 路肩红白条纹
  var stripeH = 26;
  var off = distance % (stripeH * 2);
  for (var y = -stripeH * 2 + off; y < v.height + stripeH; y += stripeH) {
    ctx.fillStyle = C.curbRed;
    ctx.fillRect(roadX - 12, y, 12, stripeH);
    ctx.fillRect(roadX + roadW, y, 12, stripeH);
  }

  // 车道虚线
  var period = 60;
  var dashOff = distance % period;
  ctx.fillStyle = C.dash;
  for (var i = 1; i < lanes; i++) {
    var x = roadX + laneW * i - 3;
    for (var yy = -period + dashOff; yy < v.height; yy += period) {
      ctx.fillRect(x, yy, 6, 34);
    }
  }
};

// 程序化车辆：阴影 + 车轮 + 渐变车身 + 座舱玻璃 + 车灯
Renderer.prototype.drawCar = function (x, y, w, h, color, facingDown) {
  var ctx = this.ctx;
  // 阴影
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  this.roundRect(ctx, x - w / 2 + 3, y - h / 2 + 5, w, h, w * 0.22);
  ctx.fill();
  // 车轮
  ctx.fillStyle = '#26262b';
  var ww = w * 0.17;
  var wh = h * 0.15;
  this.roundRect(ctx, x - w / 2 - 2, y - h / 2 + h * 0.1, ww, wh, 3);
  ctx.fill();
  this.roundRect(ctx, x + w / 2 + 2 - ww, y - h / 2 + h * 0.1, ww, wh, 3);
  ctx.fill();
  this.roundRect(ctx, x - w / 2 - 2, y + h / 2 - h * 0.25, ww, wh, 3);
  ctx.fill();
  this.roundRect(ctx, x + w / 2 + 2 - ww, y + h / 2 - h * 0.25, ww, wh, 3);
  ctx.fill();
  // 车身
  var grad = ctx.createLinearGradient(x, y - h / 2, x, y + h / 2);
  grad.addColorStop(0, shade(color, 34));
  grad.addColorStop(1, shade(color, -26));
  ctx.fillStyle = grad;
  this.roundRect(ctx, x - w / 2, y - h / 2, w, h, w * 0.22);
  ctx.fill();
  // 座舱玻璃（挡风在前方）
  ctx.fillStyle = C.glass;
  var gy = facingDown ? y + h * 0.06 : y - h * 0.32;
  this.roundRect(ctx, x - w * 0.31, gy, w * 0.62, h * 0.26, w * 0.1);
  ctx.fill();
  // 车灯
  ctx.fillStyle = facingDown ? '#fff8d0' : '#ff5252'; // 朝下的车头灯 / 玩家尾灯
  this.roundRect(ctx, x - w * 0.36, facingDown ? y + h / 2 - h * 0.07 : y - h / 2 + h * 0.03, w * 0.2, h * 0.045, 2);
  ctx.fill();
  this.roundRect(ctx, x + w * 0.16, facingDown ? y + h / 2 - h * 0.07 : y - h / 2 + h * 0.03, w * 0.2, h * 0.045, 2);
  ctx.fill();
  ctx.fillStyle = facingDown ? '#ff5252' : '#fff8d0';
  this.roundRect(ctx, x - w * 0.36, facingDown ? y - h / 2 + h * 0.03 : y + h / 2 - h * 0.07, w * 0.2, h * 0.045, 2);
  ctx.fill();
  this.roundRect(ctx, x + w * 0.16, facingDown ? y - h / 2 + h * 0.03 : y + h / 2 - h * 0.07, w * 0.2, h * 0.045, 2);
  ctx.fill();
};

Renderer.prototype.drawCars = function (game, now) {
  for (var i = 0; i < game.enemies.length; i++) {
    var e = game.enemies[i];
    this.drawCar(e.x, e.y, e.w, e.h, e.color, true);
  }
  var pulse = 1 + Math.sin(now / 180) * 0.012; // 轻微呼吸感
  this.drawCar(
    game.player.x,
    game.playerY,
    game.carW * pulse,
    game.carH * pulse,
    C.playerColor,
    false
  );
};

Renderer.prototype.drawParticles = function (particles) {
  var ctx = this.ctx;
  for (var i = 0; i < particles.length; i++) {
    var p = particles[i];
    ctx.globalAlpha = clamp01(1 - p.t / p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
};

Renderer.prototype.drawHud = function (game) {
  var ctx = this.ctx;
  var v = this.view;
  var L = this.layout;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.font = 'bold ' + Math.round(v.width * 0.105) + 'px sans-serif';
  ctx.fillText(game.meters() + ' m', v.width / 2 + 2, L.top + 22);
  ctx.fillStyle = C.textMain;
  ctx.fillText(game.meters() + ' m', v.width / 2, L.top + 20);

  ctx.font = Math.max(12, Math.round(v.width * 0.037)) + 'px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = C.textMain;
  ctx.fillText('最高 ' + (game.best || 0) + ' m', 14, L.top + 14);
  ctx.textAlign = 'right';
  ctx.fillText(Math.round(game.roadSpeed / 8 * 3.6) + ' km/h', v.width - 14, L.top + 14);
};

Renderer.prototype.drawButton = function (rect, label, fontPx, opts) {
  opts = opts || {};
  var ctx = this.ctx;
  ctx.fillStyle = opts.bg || C.button;
  this.roundRect(ctx, rect.x, rect.y, rect.w, rect.h, Math.min(12, rect.h / 2));
  ctx.fill();
  ctx.fillStyle = opts.fg || C.buttonFg;
  ctx.font = 'bold ' + fontPx + 'px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1);
};

Renderer.prototype.drawMenu = function (game) {
  var ctx = this.ctx;
  var v = this.view;
  var L = this.layout;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.font = 'bold ' + Math.round(v.width * 0.185) + 'px sans-serif';
  ctx.fillText(GAME_TITLE_TEXT, v.width / 2 + 3, v.height * 0.2 + 3);
  ctx.fillStyle = C.textMain;
  ctx.fillText(GAME_TITLE_TEXT, v.width / 2, v.height * 0.2);

  ctx.font = Math.round(v.width * 0.045) + 'px sans-serif';
  ctx.fillStyle = C.textMain;
  ctx.fillText('拖动赛车躲开车流，看你能跑多远', v.width / 2, v.height * 0.29);

  ctx.font = 'bold ' + Math.round(v.width * 0.048) + 'px sans-serif';
  ctx.fillStyle = '#ffe082';
  ctx.fillText('最高纪录 ' + (game.best || 0) + ' m', v.width / 2, v.height * 0.36);

  this.drawButton(L.btnStart, '开始游戏', Math.round(L.btnStart.h * 0.42), { bg: C.startBtn });
  ctx.font = Math.round(v.width * 0.037) + 'px sans-serif';
  ctx.fillStyle = C.textMain;
  ctx.fillText('拖动屏幕控制赛车', v.width / 2, L.btnStart.y + L.btnStart.h + 30);
};

Renderer.prototype.drawOver = function (game, now) {
  var ctx = this.ctx;
  var v = this.view;
  var L = this.layout;
  var P = L.panel;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(0, 0, v.width, v.height);

  ctx.fillStyle = C.panelBg;
  this.roundRect(ctx, P.x, P.y, P.w, P.h, 16);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = C.panelText;
  ctx.font = 'bold ' + Math.round(P.w * 0.1) + 'px sans-serif';
  ctx.fillText('撞车了！', v.width / 2, P.y + P.h * 0.2);

  ctx.font = 'bold ' + Math.round(P.w * 0.12) + 'px sans-serif';
  ctx.fillStyle = '#e53935';
  ctx.fillText(game.meters() + ' m', v.width / 2, P.y + P.h * 0.42);

  ctx.font = Math.round(P.w * 0.058) + 'px sans-serif';
  ctx.fillStyle = C.textSub2;
  if (game.newBest) {
    ctx.fillStyle = '#f57c00';
    ctx.fillText('🎉 新纪录！', v.width / 2, P.y + P.h * 0.58);
  } else {
    ctx.fillText('最高纪录 ' + (game.best || 0) + ' m', v.width / 2, P.y + P.h * 0.58);
  }

  this.drawButton(L.btnAgain, '再来一局', 19, { bg: C.startBtn });
  this.drawButton(L.btnShareO, '分享成绩', 19);
};

module.exports = Renderer;
