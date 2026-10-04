'use strict';

/**
 * 极速赛车核心逻辑（纯逻辑，不依赖任何平台 API）。
 * 世界坐标为像素，玩家与敌车均以中心点坐标表示。
 * 可在微信小游戏、浏览器、Node 中直接运行并测试。
 */

var PX_PER_METER = 8; // 每 8 像素计 1 米

var ENEMY_COLORS = ['#4fc3f7', '#ffb74d', '#aed581', '#ba68c8', '#ff8a65', '#90a4ae'];

function clamp(v, lo, hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

/**
 * @param {Object} [options]
 * @param {number} [options.width]   逻辑宽度
 * @param {number} [options.height]  逻辑高度
 * @param {number} [options.lanes]   车道数
 * @param {Function} [options.rand]  随机函数（可注入以便测试）
 */
function RaceGame(options) {
  options = options || {};
  this.rand = options.rand || Math.random;
  this.lanes = options.lanes || 4;
  this.width = options.width || 390;
  this.height = options.height || 780;

  this.roadW = Math.min(this.width - 48, 430);
  this.roadX = (this.width - this.roadW) / 2;
  this.laneW = this.roadW / this.lanes;
  this.carW = this.laneW * 0.7;
  this.carH = this.carW * 1.85;
  this.playerY = this.height - this.carH * 1.6;

  this.reset();
}

RaceGame.prototype.reset = function () {
  this.state = 'running'; // running | over
  this.distance = 0;      // 已卷动像素
  this.roadSpeed = 320;   // 公路卷动速度 px/s
  this.player = {
    x: this.roadX + this.roadW / 2,
    targetX: this.roadX + this.roadW / 2
  };
  this.enemies = [];
  this.spawnCooldown = 0.9;
};

RaceGame.prototype.laneCenter = function (i) {
  return this.roadX + this.laneW * (i + 0.5);
};

RaceGame.prototype.meters = function () {
  return Math.floor(this.distance / PX_PER_METER);
};

// 难度曲线：随里程提升，封顶 780
RaceGame.prototype.currentRoadSpeed = function () {
  return Math.min(320 + this.meters() * 0.12, 780);
};

// 拖动控制：设置玩家目标 x（自动约束在路面内）
RaceGame.prototype.setPlayerTarget = function (x) {
  this.player.targetX = clamp(
    x,
    this.roadX + this.carW / 2,
    this.roadX + this.roadW - this.carW / 2
  );
};

// 顶部附近该车道是否已有车（防止叠车/死路）
RaceGame.prototype.laneBlocked = function (lane) {
  var cx = this.laneCenter(lane);
  var limitY = this.carH * 1.6;
  for (var i = 0; i < this.enemies.length; i++) {
    var e = this.enemies[i];
    if (Math.abs(e.x - cx) < this.laneW * 0.5 && e.y < limitY) return true;
  }
  return false;
};

RaceGame.prototype.spawnEnemy = function (lane) {
  this.enemies.push({
    x: this.laneCenter(lane),
    y: -this.carH,
    vy: this.roadSpeed * (1.3 + this.rand() * 0.5),
    w: this.carW,
    h: this.carH,
    color: ENEMY_COLORS[Math.floor(this.rand() * ENEMY_COLORS.length)]
  });
};

// 生成敌车：永远保证至少一条车道可通行
RaceGame.prototype.trySpawn = function () {
  var free = [];
  for (var i = 0; i < this.lanes; i++) {
    if (!this.laneBlocked(i)) free.push(i);
  }
  if (free.length <= 1) return;

  var lane = free[Math.floor(this.rand() * free.length)];
  this.spawnEnemy(lane);

  // 中后期偶发双车，但仍保证至少一条通道
  if (free.length >= 3 && this.meters() > 300 && this.rand() < 0.3) {
    var rest = free.filter(function (l) { return l !== lane; });
    if (rest.length > 1) this.spawnEnemy(rest[Math.floor(this.rand() * rest.length)]);
  }
};

/**
 * 推进一帧。dt 单位秒，超长步长自动截断（防止切后台回来穿模）。
 */
RaceGame.prototype.update = function (dt) {
  if (this.state !== 'running') return;
  if (!(dt > 0)) return;
  if (dt > 0.1) dt = 0.1;

  this.roadSpeed = this.currentRoadSpeed();
  this.distance += this.roadSpeed * dt;

  // 玩家平滑跟随手指
  var p = this.player;
  p.x += (p.targetX - p.x) * Math.min(1, dt * 14);

  // 定时生成敌车
  this.spawnCooldown -= dt;
  if (this.spawnCooldown <= 0) {
    this.trySpawn();
    var base = Math.max(0.42, 1.1 - this.meters() * 0.0006);
    this.spawnCooldown = base * (0.75 + this.rand() * 0.5);
  }

  // 敌车移动与回收
  var limitY = this.height + this.carH;
  var kept = [];
  for (var i = 0; i < this.enemies.length; i++) {
    var e = this.enemies[i];
    e.y += e.vy * dt;
    if (e.y < limitY) kept.push(e);
  }
  this.enemies = kept;

  // 碰撞检测（AABB，判定盒略缩小以示公平）
  var halfW = (this.carW * 0.72 + this.carW * 0.72) / 2;
  var halfH = (this.carH * 0.78 + this.carH * 0.78) / 2;
  for (var j = 0; j < this.enemies.length; j++) {
    var o = this.enemies[j];
    if (Math.abs(o.x - p.x) < halfW && Math.abs(o.y - this.playerY) < halfH) {
      this.state = 'over';
      return;
    }
  }
};

module.exports = {
  PX_PER_METER: PX_PER_METER,
  ENEMY_COLORS: ENEMY_COLORS,
  RaceGame: RaceGame,
  clamp: clamp
};
