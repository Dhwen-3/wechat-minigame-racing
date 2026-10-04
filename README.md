# 极速赛车 · 微信小游戏

一款可直接发布上线的微信小游戏：竖版公路躲避赛车，拖动赛车躲开车流，跑得越远速度越快。**纯 Canvas 绘制、零图片素材、零第三方依赖**，主包仅约 30KB（限额 4MB）。

**已实现**

- 完整玩法闭环：菜单 → 拖动操控 → 车流躲避 → 撞车结算 → 再来一局
- 4 车道程序化生成：保证任何时刻至少一条车道可通行（算法级防死路）
- 难度曲线：车速与车流密度随里程平滑提升并封顶（320→780 px/s）
- 撞车粒子爆炸 + 屏幕震动 + 合成音效 + 震动反馈
- 最高里程本地持久化、破纪录标记、成绩分享（主动分享 + 右上角转发）
- 刘海屏/安全区适配、多分辨率自适应
- 网页版预览（与小游戏共用同一份代码）+ 15 项核心逻辑单元测试

## 项目结构

```
D:\赛车小游戏
├── game.js               # 小游戏入口（微信开发者工具从这里启动）
├── game.json             # 小游戏配置（竖屏）
├── project.config.json   # 项目配置（appid 在这里替换）
├── js/
│   ├── core.js           # 核心玩法逻辑（纯逻辑，无平台依赖，可单测）
│   ├── render.js         # Canvas 渲染：公路卷动、程序化车辆、粒子、面板
│   ├── main.js           # 主循环、场景切换、拖动输入、分享、存档
│   ├── storage.js        # wx 本地存储封装（最高纪录/静音）
│   └── sound.js          # WebAudio 合成音效（撞车）
├── test/
│   └── core.test.js      # 核心逻辑单元测试（Node 环境）
├── tools/                # GitHub 发布脚本（不参与小游戏包）
├── web-preview/          # 浏览器预览（wx 适配层 + 模块加载器）
└── README.md
```

`web-preview/`、`test/`、`tools/`、`README.md` 已在 `project.config.json` 的 `packOptions.ignore` 中排除，**不会被打进小游戏包**。

## 本地试玩

### 方式一：浏览器

```bash
python -m http.server 8898 --bind 127.0.0.1 --directory "D:\赛车小游戏"
```

打开 <http://127.0.0.1:8898/web-preview/>（电脑上按住鼠标拖动 = 拖动赛车）。

**在线试玩（GitHub Pages）**：<https://dhwen-3.github.io/wechat-minigame-racing/web-preview/>

### 方式二：微信开发者工具

1. 下载安装「微信开发者工具」：<https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html>
2. 导入项目 → 目录选 `D:\赛车小游戏` → AppID 先用「测试号」
3. 模拟器试玩；「预览」扫码真机体验

### 运行单元测试（可选，需 Node.js）

```bash
node test/core.test.js
```

覆盖：道路几何、拖动约束、距离计分、难度封顶、生成公平性（多随机种子模拟）、碰撞判定、出界回收、时间步长截断、重置。

## 正式发布到微信

与《2048 合并挑战》流程完全一致，关键步骤：

1. **注册小程序账号**：<https://mp.weixin.qq.com/> → 注册 → 小程序 → 类目选「游戏-休闲游戏」
2. **资质**：无内购小游戏**不需要版号**，提审需软著 + 游戏自审自查报告；个人主体可注册但不能开内购
3. **填 AppID**：替换 `project.config.json` 中的 `touristappid`
4. **上传提审**：开发者工具「上传」→ 公众平台「版本管理」→ 提交审核 → 发布

详细说明（含资质材料、审核注意事项）参见姊妹项目《2048 合并挑战》的 README：<https://github.com/Dhwen-3/wechat-minigame-2048>

## 更新到 GitHub

```bash
python tools\publish-github.py Dhwen-3 wechat-minigame-racing --message "这次改了什么"
```

首次在其他机器使用前，先运行 `python tools\gh-auth.py` 完成一次设备码登录。

## 二次开发指南

| 想改什么 | 位置 |
| --- | --- |
| 游戏名 / 分享文案 | `js/render.js` 顶部 `GAME_TITLE_TEXT`；`js/main.js` 顶部 `GAME_TITLE` |
| 车道数 | `js/main.js` 创建 RaceGame 时（默认 4） |
| 难度曲线 | `js/core.js` 的 `currentRoadSpeed`（初速/增速/封顶）与 `trySpawn` 里的生成间隔 |
| 配色 | `js/render.js` 顶部 `C` 调色板与 `ENEMY_COLORS`（在 `js/core.js`） |
| 判定松紧 | `js/core.js` 碰撞检测中的 0.72 / 0.78 缩放系数 |

## 玩法说明

- 按住屏幕左右拖动，赛车跟随手指（自动约束在路面内）
- 躲开车流，行驶距离即得分（米）
- 速度与车流密度随里程提升，撞车即结束
- 撞车后有短暂爆炸粒子和屏幕震动，结算面板可一键重开或分享成绩
