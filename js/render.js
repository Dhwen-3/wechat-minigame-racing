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
  var btnGarage = {
    x: (w - Math.round(startW * 0.62)) / 2,
    y: btnStart.y + btnStart.h + 14,
    w: Math.round(startW * 0.62),
    h: 44
  };

  // 车库
  var btnPrev = { x: w / 2 - 150, y: h * 0.3 - 28, w: 56, h: 56 };
  var btnNext = { x: w / 2 + 94, y: btnPrev.y, w: 56, h: 56 };
  var btnUse = { x: (w - 210) / 2, y: h * 0.66, w: 210, h: 54 };
  var btnBack = { x: 14, y: top, w: 74, h: 36 };

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
    btnGarage: btnGarage,
    btnPrev: btnPrev,
    btnNext: btnNext,
    btnUse: btnUse,
    btnBack: btnBack,
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
    this.drawRoad(fx.scroll != null ? fx.scroll : game.distance);
    this.drawMenu(game, fx);
    return;
  }

  if (scene === 'garage') {
    this.drawRoad(fx.scroll != null ? fx.scroll : game.distance);
    this.drawGarage(fx, now);
    return;
  }

  ctx.save();
  if (fx.shake > 0.5) {
    ctx.translate((Math.random() - 0.5) * fx.shake, (Math.random() - 0.5) * fx.shake);
  }
  this.drawRoad(game.distance);
  this.drawCars(game, now, fx.car);
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
// style: sedan 轿车 / sports 跑车（尾翼）/ suv 越野（大座舱+行李架）/ f1 方程式（外露车轮+翼板）
Renderer.prototype.drawCar = function (x, y, w, h, color, facingDown, style) {
  style = style || 'sedan';
  var ctx = this.ctx;
  var frontY = facingDown ? y + h / 2 : y - h / 2;
  var rearY = facingDown ? y - h / 2 : y + h / 2;

  // 阴影
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  this.roundRect(ctx, x - w / 2 + 3, y - h / 2 + 5, w, h, w * 0.22);
  ctx.fill();

  if (style === 'f1') {
    // 外露车轮
    ctx.fillStyle = '#26262b';
    var fww = w * 0.3;
    var fwh = h * 0.16;
    var wheels = [[-1, -0.3], [1, -0.3], [-1, 0.28], [1, 0.28]];
    for (var wi = 0; wi < wheels.length; wi++) {
      this.roundRect(
        ctx,
        x + wheels[wi][0] * (w / 2 + fww * 0.18) - fww / 2,
        y + wheels[wi][1] * h - fwh / 2,
        fww, fwh, 4
      );
      ctx.fill();
    }
    // 前翼与尾翼
    ctx.fillStyle = shade(color, -60);
    this.roundRect(ctx, x - w * 0.52, frontY - h * 0.035, w * 1.04, h * 0.06, 3);
    ctx.fill();
    this.roundRect(ctx, x - w * 0.52, rearY - h * 0.025, w * 1.04, h * 0.05, 3);
    ctx.fill();
    // 窄车身
    var fg = ctx.createLinearGradient(x, y - h / 2, x, y + h / 2);
    fg.addColorStop(0, shade(color, 34));
    fg.addColorStop(1, shade(color, -26));
    ctx.fillStyle = fg;
    this.roundRect(ctx, x - w * 0.34, y - h / 2, w * 0.68, h, w * 0.16);
    ctx.fill();
    // 露天座舱
    ctx.fillStyle = C.glass;
    ctx.beginPath();
    ctx.arc(x, y - (facingDown ? -h * 0.02 : h * 0.06), w * 0.17, 0, Math.PI * 2);
    ctx.fill();
    // 头灯
    ctx.fillStyle = '#fff8d0';
    this.roundRect(ctx, x - w * 0.2, frontY - h * 0.02, w * 0.14, h * 0.035, 2);
    ctx.fill();
    this.roundRect(ctx, x + w * 0.06, frontY - h * 0.02, w * 0.14, h * 0.035, 2);
    ctx.fill();
    return;
  }

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

  // 座舱玻璃（suv 座舱更大）
  ctx.fillStyle = C.glass;
  var glassH = style === 'suv' ? h * 0.32 : h * 0.26;
  var gy = facingDown ? y + h * 0.05 : y - h * 0.05 - glassH;
  this.roundRect(ctx, x - w * 0.31, gy, w * 0.62, glassH, w * 0.1);
  ctx.fill();

  // 跑车尾翼 / 越野行李架
  if (style === 'sports') {
    ctx.fillStyle = shade(color, -60);
    this.roundRect(ctx, x - w * 0.44, rearY + (facingDown ? h * 0.06 : -h * 0.08), w * 0.88, h * 0.05, 3);
    ctx.fill();
  } else if (style === 'suv') {
    ctx.fillStyle = shade(color, -60);
    this.roundRect(ctx, x - w * 0.34, rearY + (facingDown ? h * 0.12 : -h * 0.14), w * 0.68, h * 0.04, 2);
    ctx.fill();
  }

  // 车灯：头灯在前（浅黄），尾灯在后（红）
  var lightH = h * 0.045;
  ctx.fillStyle = '#fff8d0';
  this.roundRect(ctx, x - w * 0.36, frontY + (facingDown ? -lightH - 2 : 2), w * 0.2, lightH, 2);
  ctx.fill();
  this.roundRect(ctx, x + w * 0.16, frontY + (facingDown ? -lightH - 2 : 2), w * 0.2, lightH, 2);
  ctx.fill();
  ctx.fillStyle = '#ff5252';
  this.roundRect(ctx, x - w * 0.36, rearY + (facingDown ? 2 : -lightH - 2), w * 0.2, lightH, 2);
  ctx.fill();
  this.roundRect(ctx, x + w * 0.16, rearY + (facingDown ? 2 : -lightH - 2), w * 0.2, lightH, 2);
  ctx.fill();
};

Renderer.prototype.drawCars = function (game, now, car) {
  car = car || { color: C.playerColor, style: 'sedan' };
  for (var i = 0; i < game.enemies.length; i++) {
    var e = game.enemies[i];
    this.drawCar(e.x, e.y, e.w, e.h, e.color, true, 'sedan');
  }
  var pulse = 1 + Math.sin(now / 180) * 0.012; // 轻微呼吸感
  this.drawCar(
    game.player.x,
    game.playerY,
    game.carW * pulse,
    game.carH * pulse,
    car.color,
    false,
    car.style
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

Renderer.prototype.drawMenu = function (game, fx) {
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
  this.drawButton(L.btnGarage, '选择赛车', Math.round(L.btnGarage.h * 0.42));
  if (fx.carName) {
    ctx.font = Math.round(v.width * 0.037) + 'px sans-serif';
    ctx.fillStyle = C.textMain;
    ctx.fillText('当前座驾：' + fx.carName, v.width / 2, L.btnGarage.y + L.btnGarage.h + 26);
  } else {
    ctx.font = Math.round(v.width * 0.037) + 'px sans-serif';
    ctx.fillStyle = C.textMain;
    ctx.fillText('拖动屏幕控制赛车', v.width / 2, L.btnGarage.y + L.btnGarage.h + 26);
  }
};

// 车库：车辆预览 + 属性条 + 左右切换 + 确认/返回
Renderer.prototype.drawGarage = function (fx, now) {
  var ctx = this.ctx;
  var v = this.view;
  var L = this.layout;
  var g = this._game;
  var car = fx.browseCar; // 展示正在浏览的车型

  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.fillRect(0, 0, v.width, v.height);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = C.textMain;
  ctx.font = 'bold ' + Math.round(v.width * 0.085) + 'px sans-serif';
  ctx.fillText('选择赛车', v.width / 2, L.top + 28);

  // 预览车（放大 1.4 倍，尺寸随车型体积变化）
  var previewScale = (g.laneW * 0.7 * car.size) * 1.4;
  this.drawCar(v.width / 2, v.height * 0.3, previewScale, previewScale * 1.85, car.color, false, car.style);

  ctx.font = 'bold ' + Math.round(v.width * 0.055) + 'px sans-serif';
  ctx.fillStyle = '#ffe082';
  ctx.fillText(car.name, v.width / 2, v.height * 0.455);
  ctx.font = Math.round(v.width * 0.038) + 'px sans-serif';
  ctx.fillStyle = C.textMain;
  ctx.fillText(car.desc, v.width / 2, v.height * 0.5);

  // 属性条
  this.drawStatBar(v.width / 2 - 110, v.height * 0.545, 220, '操控', car.handling / 24);
  this.drawStatBar(v.width / 2 - 110, v.height * 0.585, 220, '体积', (car.size - 0.8) / 0.32);

  // 左右箭头 + 圆点指示
  this.drawArrow(L.btnPrev, true);
  this.drawArrow(L.btnNext, false);
  for (var i = 0; i < fx.carTotal; i++) {
    ctx.fillStyle = i === fx.carIdx ? '#ffe082' : 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.arc(v.width / 2 + (i - (fx.carTotal - 1) / 2) * 18, v.height * 0.635, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  this.drawButton(L.btnUse, fx.isCurrent ? '当前座驾 ✓' : '就用这辆', 20, { bg: fx.isCurrent ? C.button : C.startBtn });
  this.drawButton(L.btnBack, '返回', 16);
};

Renderer.prototype.drawStatBar = function (x, y, w, label, ratio) {
  var ctx = this.ctx;
  var barX = x + 52;
  var barW = w - 52;
  var h = 14;
  ctx.fillStyle = '#ffffff';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y + h / 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  this.roundRect(ctx, barX, y, barW, h, h / 2);
  ctx.fill();
  ctx.fillStyle = '#ffe082';
  this.roundRect(ctx, barX, y, Math.max(h, barW * clamp01(ratio)), h, h / 2);
  ctx.fill();
};

Renderer.prototype.drawArrow = function (rect, left) {
  var ctx = this.ctx;
  var cx = rect.x + rect.w / 2;
  var cy = rect.y + rect.h / 2;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.beginPath();
  ctx.arc(cx, cy, rect.w / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  var d = rect.w * 0.16;
  if (left) {
    ctx.moveTo(cx + d, cy - d * 1.6);
    ctx.lineTo(cx - d, cy);
    ctx.lineTo(cx + d, cy + d * 1.6);
  } else {
    ctx.moveTo(cx - d, cy - d * 1.6);
    ctx.lineTo(cx + d, cy);
    ctx.lineTo(cx - d, cy + d * 1.6);
  }
  ctx.closePath();
  ctx.fill();
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
