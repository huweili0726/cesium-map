# 🚀 Vue3 + Cesium 三维地图项目

一个现代化、高性能的 Vue 3 + Cesium 三维地图解决方案，为您提供沉浸式的地理空间可视化体验。

## 分支说明
- **main 分支**：TypeScript 版本，使用 TypeScript 类型系统，代码质量更高，开发体验更好
- **js 分支**：JavaScript 版本，移除了 TypeScript 类型注解，更适合纯 JavaScript 项目

## ✨ 项目亮点

- **现代化技术栈**：Vue 3 + JavaScript + Vite，代码质量高，开发体验优秀
- **强大的三维地图**：基于 Cesium 1.136.0，支持高精度地球模型和丰富的空间分析功能
- **无人机系统**：支持 GLB 模型和 PNG 图片两种显示方式，具备完整的轨迹管理和点击交互
- **点击穿透功能**：无人机在四棱锥体后面也能被点击，提升用户体验

## 技术栈

| 技术/依赖 | 版本 | 用途 |
|---------|------|------|
| Vue | ^3.5.22 | 前端框架 |
| Vite | ^7.1.11 | 构建工具 |
| Cesium | ^1.136.0 | 三维地球/地图可视化库 |
| vite-plugin-cesium | ^1.2.23 | Cesium Vite 插件 |

## 项目结构

```
├── public/              # 公共资源
│   ├── config/          # 配置文件
│   │   └── mapConfig.json # 地图配置
│   └── glb/             # 3D 模型文件
├── src/
│   ├── components/      # 全局组件
│   │   └── cesiumMap/   # Cesium 三维地图组件
│   ├── views/           # 页面视图
│   ├── router/          # 路由配置
│   └── utils/           # 工具函数
├── package.json         # 项目配置
└── vite.config.js       # Vite 配置
```

## 快速开始

### 设置淘宝镜像
```bash
npm config set registry https://registry.npmmirror.com
```

### 安装依赖
```bash
npm install
```

### 开发服务器
```bash
npm run dev
```
默认会在 http://localhost:5173 启动开发服务器。

### 构建生产版本
```bash
npm run build
```

## 核心功能

### 🗺️ Cesium 三维地图组件
- 原生三维地图加载
- 地图底图动态配置
- 地球光照效果控制
- 相机初始位置设置
- **底图风格自定义**：支持深蓝色风格和黑色风格，可通过配置文件调整颜色参数

### 🚁 无人机系统
- **无人机创建**：支持 GLB 模型和 PNG 图片两种显示方式
- **轨迹管理**：
  - 轨迹保留时间可配置（通过 config.json）
  - 支持无限时长保留轨迹（设置保留时间为 -1）
  - 基于位置距离阈值优化轨迹点添加
- **点击事件**：
  - 支持左键和右键点击事件
  - 点击穿透功能（无人机在四棱锥体后面也能被点击）

### 📐 四棱锥体效果
- 支持点击穿透，不阻挡无人机点击
- 可配置高度、角度和颜色

### 🎨 自定义工具栏按钮
- **图标按钮**：支持使用 SVG 图标作为按钮显示
- **文本按钮**：支持显示文字按钮
- **灵活配置**：可自定义按钮标题、点击事件和样式
- **默认按钮**：包含返回中心点和自定义功能按钮

## 配置说明

### 轨迹保留时间
在 `public/config/config.json` 文件中配置：
```json
{
  "trailTime": -1  // -1 表示无限时长保留轨迹
}
```

### 地图配置
在 `public/config/mapConfig.json` 文件中配置地图参数，包括场景设置和底图配置。

### 底图风格配置
在 `public/config/mapConfig.json` 文件中，每个底图配置项都可以设置自定义颜色风格：

**深蓝色风格配置示例**：
```json
"customMapColorStyle": {
  "enabled": true,  // 是否启用自定义颜色风格
  "MapBaseColor": { "r": 9, "g": 20, "b": 46 },  // 深蓝色底色
  "RoadLightColor": { "r": 125, "g": 165, "b": 255 }  // 亮蓝色道路/文字
}
```

**黑色风格配置示例**：
```json
"customMapColorStyle": {
  "enabled": true,  // 是否启用自定义颜色风格
  "MapBaseColor": { "r": 10, "g": 10, "b": 10 },  // 深黑色底色
  "RoadLightColor": { "r": 200, "g": 200, "b": 200 }  // 亮白色道路/文字
}
```

## 事件监听

### 无人机点击事件
**对应的 JavaScript 文件**：`src/components/cesiumMap/ts/bindClickHandler.js`

## 🔧 回放引擎架构

### 🎭 四大核心类

回放引擎由四个核心类组成，各司其职：

| 类名 | 角色比喻 | 职责 | 文件位置 |
|------|----------|------|----------|
| `BusinessReplayClock` | 🥁 节拍器/心跳 | 全局单例时钟，产生固定帧率的时间脉冲 | `src/components/cesiumMap/js/replayEngine.js` |
| `TrackBuffer` | 📦 数据仓库/插值计算器 | 存储轨迹数据，计算任意时间点的无人机状态 | `src/components/cesiumMap/js/replayEngine.js` |
| `CesiumRendererAdapter` | 🎨 画家/渲染器 | 将回放状态渲染到 Cesium 地图上 | `src/components/cesiumMap/js/replayEngine.js` |
| `ReplayEngine` | 🎬 导演/播放器 | 协调整个回放流程，提供播放控制 API | `src/components/cesiumMap/js/replayEngine.js` |

### 📊 调用关系总览

| 类名 | 被谁调用 | 调用的方法 | 调用位置 |
|------|----------|-----------|----------|
| `BusinessReplayClock` | ReplayEngine | `subscribe()`, `unsubscribe()` | `ReplayEngine.play()/pause()` |
| `TrackBuffer` | ReplayEngine | `getStateAt()`, `append()` | `ReplayEngine.tick()/seekToTime()/appendData()` |
| `CesiumRendererAdapter` | ReplayEngine | `init()`, `render()`, `seek()`, `destroy()` | `ReplayEngine.init()/tick()/seekToTime()/destroy()` |
| `ReplayEngine` | 业务层/时间轴 | `play()`, `pause()`, `stop()`, `seekToTime()` | `replayPath.js`, `useBusinessReplayTimeline.js` |

### 🚀 调用顺序详解

#### **阶段一：初始化（页面加载时）**

```
CesiumMap 挂载
    │
    ▼
new BusinessReplayClock()
    │
    ▼
mapStore.setReplayClock(clock)  ← 存入全局状态
```

#### **阶段二：开始回放（用户触发）**

```
replayDronePath(options)
    │
    ├──► ① new TrackBuffer(sortedData)       ← 创建数据仓库
    │
    ├──► ② new CesiumRendererAdapter({ trackBuffer })  ← 创建渲染器
    │
    └──► ③ new ReplayEngine({ trackBuffer, renderer }) ← 创建引擎
                │
                ▼
         ④ mapStore.setActiveReplayEngine(engine)  ← 设置活跃引擎
                │
                ▼
         ⑤ engine.init()
                │
                ├──► renderer.init()          ← 初始化渲染器
                │
                └──► engine.seek(0)           ← 跳转到开始位置
```

#### **阶段三：播放中（时钟驱动）**

```
engine.play()
    │
    ▼
businessClock.subscribe(({ delta }) => engine.tick(delta))
    │
    ▼
BusinessReplayClock 每秒触发 30 次 tick
    │
    ▼
engine.tick(delta)
    │
    ├──► ① trackBuffer.getStateAt(currentTime)  ← 获取插值状态
    │
    └──► ② renderer.render(state)                ← 渲染到地图
                │
                ├──► update position (位置)
                ├──► update orientation (朝向)
                └──► updateTrail() (轨迹线)
```

#### **阶段四：拖动时间轴（用户交互）**

```
用户拖动滑块 → onTimelineInput(event)
    │
    ▼
mapStore.getActiveReplayEngine()  ← 获取活跃引擎
    │
    ▼
engine.seekToTime(targetTime)
    │
    ├──► trackBuffer.getStateAt(targetTime)  ← 获取目标时间状态
    │
    └──► renderer.seek(state)                 ← 跳转渲染
                │
                ├──► 重置轨迹线
                └──► renderer.render(state, { forceTrail: true })
```

### 🔄 核心调用链总结

| 场景 | 调用链 |
|------|--------|
| **启动回放** | `replayDronePath()` → `new TrackBuffer()` → `new CesiumRendererAdapter()` → `new ReplayEngine()` → `engine.init()` |
| **播放** | `engine.play()` → `businessClock.subscribe()` → `engine.tick()` → `trackBuffer.getStateAt()` → `renderer.render()` |
| **拖动时间轴** | `onTimelineInput()` → `engine.seekToTime()` → `trackBuffer.getStateAt()` → `renderer.seek()` |
| **暂停** | `engine.pause()` → `businessClock.unsubscribe()` |

## 🎯 应用场景

- **无人机监控系统**：实时追踪无人机位置和轨迹
- **地理空间分析**：基于 Cesium 的强大空间分析能力
- **三维可视化**：展示地理数据和空间关系
- **智慧城市**：城市规划和管理的可视化平台

## 📧 联系方式

如有问题或建议，欢迎联系：

- **邮箱**：czxyhuweili@163.com

---

⭐ 如果这个项目对您有帮助，欢迎 Star 支持！