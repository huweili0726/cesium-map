# Vue3 TypeScript + Cesium 项目

一个基于 Vue 3 + TypeScript + Cesium 的三维地图项目，提供现代化的前端开发体验和强大的三维地图功能。

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

### 构建生产版本
```bash
npm run build
```

## 核心功能

### Cesium 三维地图组件
- 原生三维地图加载
- 地图底图动态配置
- 地球光照效果控制
- 相机初始位置设置

### 无人机系统
- **无人机创建**：支持 GLB 模型和 PNG 图片两种显示方式
- **轨迹管理**：
  - 轨迹保留时间可配置（通过 config.json）
  - 支持无限时长保留轨迹（设置保留时间为 -1）
  - 基于位置距离阈值优化轨迹点添加
- **点击事件**：
  - 支持左键和右键点击事件
  - 点击穿透功能（无人机在四棱锥体后面也能被点击）
  - 视觉反馈（点击时无人机短暂高亮）
  - 事件委托模式，提高性能

### 四棱锥体效果
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
