# 🚀 Vue3 TypeScript + Cesium 三维地图项目

一个现代化、高性能的 Vue 3 + TypeScript + Cesium 三维地图解决方案，为您提供沉浸式的地理空间可视化体验。

## ✨ 项目亮点

- **现代化技术栈**：Vue 3 + TypeScript + Vite，代码质量高，开发体验优秀
- **强大的三维地图**：基于 Cesium 1.136.0，支持高精度地球模型和丰富的空间分析功能
- **无人机系统**：支持 GLB 模型和 PNG 图片两种显示方式，具备完整的轨迹管理和点击交互
- **点击穿透功能**：无人机在四棱锥体后面也能被点击，提升用户体验

## 技术栈

| 技术/依赖 | 版本 | 用途 |
|---------|------|------|
| Vue | ^3.5.22 | 前端框架 |
| TypeScript | ^5.9.3 | 类型系统 |
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
└── vite.config.ts       # Vite 配置
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

## 事件监听

### 无人机点击事件
**对应的 TypeScript 文件**：`src/components/cesiumMap/ts/bindClickHandler.ts`

## 🎯 应用场景

- **无人机监控系统**：实时追踪无人机位置和轨迹
- **地理空间分析**：基于 Cesium 的强大空间分析能力
- **三维可视化**：展示地理数据和空间关系
- **智慧城市**：城市规划和管理的可视化平台