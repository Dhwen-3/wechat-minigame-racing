'use strict';

/**
 * 核心逻辑单元测试（Node 环境）：node test/core.test.js
 * 覆盖：道路几何、拖动约束、距离计分、难度封顶、生成公平性、碰撞与回收、时间步长截断。
 */

const path = require('path');
const { RaceGame, clamp } = require(path.join(__dirname, '..', 'js', 'core.js'));

let passed = 0;
const failures = [];

function check(name, cond, extra) {
  if (cond) {
    passed++;
  } else {
    failures.push(name + (extra !== undefined ? ' :: ' + JSON.stringify(extra) : ''));
  }
}

// 可复现随机数
function lcg(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeGame(overrides) {
  return new RaceGame(Object.assign(
    { width: 390, height: 780, lanes: 4, rand: lcg(42) },
    overrides || {}
  ));
}

// 1. 道路几何
{
  const g = makeGame();
  check('路面宽度为正且不超屏', g.roadW > 0 && g.roadW <= 390 - 48);
  check('路面居中', Math.abs(g.roadX - (390 - g.roadW) / 2) < 0.001);
  check('车道宽为正', g.laneW > 0 && g.carW > 0 && g.carH > 0);
  check('玩家初始在路面内', g.player.x > g.roadX && g.player.x < g.roadX + g.roadW);
}

// 2. 拖动目标约束在路面内
{
  const g = makeGame();
  g.setPlayerTarget(-9999);
  check('左边界约束', Math.abs(g.player.targetX - (g.roadX + g.carW / 2)) < 0.001);
  g.setPlayerTarget(9999);
  check('右边界约束', Math.abs(g.player.targetX - (g.roadX + g.roadW - g.carW / 2)) < 0.001);
}

// 3. clamp 工具
{
  check('clamp 基本行为', clamp(5, 0, 3) === 3 && clamp(-1, 0, 3) === 0 && clamp(1, 0, 3) === 1);
}

// 4. 距离与米数
{
  const g = makeGame();
  const d0 = g.distance;
  g.update(1);
  check('update 推进距离', g.distance > d0);
  check('米数换算', g.meters() === Math.floor(g.distance / 8), { d: g.distance, m: g.meters() });
}

// 5. 难度曲线提升且封顶
{
  const g = makeGame();
  for (let i = 0; i < 4000; i++) g.update(0.05);
  check('速度提升', g.roadSpeed > 320);
  check('速度封顶 780', g.roadSpeed <= 780.001, g.roadSpeed);
  check('里程为正', g.meters() > 1000);
}

// 6. 玩家平滑跟随
{
  const g = makeGame();
  g.setPlayerTarget(g.roadX + g.carW); // 路面内的合法位置
  for (let i = 0; i < 60; i++) g.update(0.016);
  check('玩家趋近目标', Math.abs(g.player.x - (g.roadX + g.carW)) < 5, g.player.x);
}

// 7. 生成公平性：任何时刻顶部被堵车道数不超过 lanes-1，且敌车都在车道上
{
  let violated = false;
  for (let seed = 1; seed <= 6; seed++) {
    const g = makeGame({ rand: lcg(seed * 97) });
    for (let i = 0; i < 4000 && !violated; i++) {
      g.update(0.03);
      let blocked = 0;
      for (let lane = 0; lane < g.lanes; lane++) if (g.laneBlocked(lane)) blocked++;
      if (blocked > g.lanes - 1) violated = true;
      for (const e of g.enemies) {
        const onLane = g.laneCenter(0) === undefined ||
          Array.from({ length: g.lanes }, (_, li) => g.laneCenter(li))
            .some((cx) => Math.abs(cx - e.x) < 0.001);
        if (!onLane) { violated = true; break; }
      }
    }
  }
  check('生成永远保留至少一条通道', !violated);
}

// 8. 碰撞判定
{
  const g = makeGame();
  g.enemies.push({
    x: g.player.x, y: g.playerY, vy: 0, w: g.carW, h: g.carH, color: '#fff'
  });
  g.update(0.016);
  check('重叠即撞车', g.state === 'over');

  const g2 = makeGame();
  g2.enemies.push({
    x: g.roadX + 5, y: 50, vy: 0, w: g2.carW, h: g2.carH, color: '#fff'
  });
  g2.update(0.016);
  check('远离时不误判', g2.state === 'running');
}

// 9. 出界敌车回收
{
  const g = makeGame();
  g.enemies.push({
    x: g.laneCenter(0), y: g.height + g.carH * 2, vy: 0, w: g.carW, h: g.carH, color: '#fff'
  });
  g.update(0.016);
  check('出界敌车被回收', g.enemies.length === 0);
}

// 10. 超长步长截断
{
  const g = makeGame();
  const speed = g.roadSpeed;
  g.update(3);
  check('步长截断为 0.1s', Math.abs(g.distance - speed * 0.1) < 0.001, g.distance);
}

// 11. 撞车后重置
{
  const g = makeGame();
  g.enemies.push({ x: g.player.x, y: g.playerY, vy: 0, w: g.carW, h: g.carH, color: '#fff' });
  g.update(0.016);
  g.reset();
  check('重置后可重新开始', g.state === 'running' && g.enemies.length === 0 && g.distance === 0);
}

console.log('通过 ' + passed + ' 项');
if (failures.length) {
  console.error('失败 ' + failures.length + ' 项:');
  failures.forEach((f) => console.error('  ✗ ' + f));
  process.exit(1);
} else {
  console.log('全部通过 ✓');
}
