# Vue3 TypeScript + Cesium 项目

一个清爽、高效的 Vue 3 + TypeScript + Cesium 三维地图项目，提供了现代化的前端开发体验和强大的三维地图功能。

## 技术栈

| 技术/依赖 | 版本 | 用途 |
|---------|------|------|
| Vue | ^3.5.22 | 前端框架 |
| TypeScript | ^5.9.3 | 类型系统 |
| Vite | ^7.1.11 | 构建工具 |
| Vue Router | ^4.6.3 | 路由管理 |
| Cesium | ^1.136.0 | 三维地球/地图可视化库 |
| @vitejs/plugin-vue | ^6.0.1 | Vue 插件 |
| vite-plugin-cesium | ^1.2.23 | Cesium Vite 插件 |
| less | ^4.4.2 | 样式预处理器 |
| vue-tsc | ^3.1.1 | Vue TypeScript 编译器 |

## 项目结构

```
├── public/              # 公共资源
│   ├── config/          # 配置文件
│   │   └── mapConfig.json # 地图配置
│   └── glb/             # 3D 模型文件
├── src/
│   ├── assets/          # 静态资源
│   ├── components/      # 全局组件
│   │   └── cesiumMap/   # Cesium 三维地图组件
│   ├── views/           # 页面视图
│   │   └── map/         # 地图页面
│   ├── router/          # 路由配置
│   ├── utils/           # 工具函数
│   │   ├── json.ts      # JSON 处理工具
│   │   └── object.ts    # 对象处理工具
│   ├── App.vue          # 根组件
│   ├── main.ts          # 入口文件
│   └── style.css        # 全局样式
├── package.json         # 项目配置
├── tsconfig.json        # TypeScript 配置
└── vite.config.ts       # Vite 配置
```

## 环境要求

- Node.js 18.x 或更高版本
- npm 9.x 或更高版本

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

启动本地开发服务器：

```bash
npm run dev
```

默认会在 http://localhost:5173 启动开发服务器。

### 构建生产版本

构建用于生产的应用：

```bash
npm run build
```

### 预览生产构建

预览生产构建结果：

```bash
npm run preview
```

## 开发说明

### 添加新页面

1. 在 `src/views/` 目录下创建新的 Vue 组件
2. 在 `src/router/index.ts` 中添加新的路由配置

### 组件开发

- 全局组件放在 `src/components/` 目录下
- 使用 TypeScript 为组件添加类型定义
- 遵循 Vue 3 组合式 API 的最佳实践

### Cesium 三维地图组件

#### 组件介绍
`cesiumMap` 是一个基于 Cesium 的三维地图组件，支持加载多种地图底图、自定义地图配置和地图实例管理。

#### 组件使用

```vue
<template>
  <div class="map-container">
    <CesiumMap
      :config="'/config/config.json'"
      :url="'/config/mapConfig.json'"
      :options="mapOptions"
      @onload="mapOnLoad"/>
  </div>
</template>

<script setup lang="ts">
import CesiumMap from '@/components/cesiumMap/index.vue'

  // 地图配置选项
const mapOptions = {}

// 地图加载完成后触发
const mapOnLoad = (map: any) => {}
</script>
```

#### 地图配置文件

地图配置文件位于 `public/config/mapConfig.json`，包含以下配置项：

- `scene`：场景配置（中心点坐标、视角等）
- `basemaps`：底图配置数组，支持多个底图切换
- `show`：控制底图是否显示

#### 主要功能

- ✅ Cesium 原生三维地图加载
- ✅ 地图底图动态配置（通过 mapConfig.json）
- ✅ 地球光照效果控制
- ✅ 相机初始位置设置
- ✅ 底图版权信息显示
- ✅ 无人机飞行 + 轨迹绘制（实时更新）
  - ✅ 轨迹保留时间可动态配置（通过 config.json 配置）
  - ✅ 支持无限时长保留轨迹（设置保留时间为 -1）
  - ✅ 基于位置距离阈值优化轨迹点添加（避免重复添加相同位置的点）

### 工具函数

- `json.ts`：提供 JSON 文件加载功能
- `object.ts`：提供对象处理相关工具函数

### 无人机轨迹管理

#### 轨迹保留时间配置

可以在 `public/config/config.json` 文件中配置默认的轨迹保留时长：

```json
{
  "trailTime": -1  // -1 表示无限时长保留轨迹，其他数值表示保留的秒数
}
```

#### 轨迹管理方法

- `setDroneTrail(droneId: string, trailData: any)`：设置无人机轨迹
- `getDroneTrail(droneId: string)`：获取无人机轨迹
- `hasDroneTrail(droneId: string)`：检查无人机轨迹是否存在
- `clearDroneTrail(droneId: string)`：清除指定无人机轨迹
- `clearAllDroneTrails()`：清除所有无人机轨迹

#### 轨迹优化

- **位置距离阈值**：只有当无人机移动超过1米时才会添加新的轨迹点，避免重复添加相同位置的点
- **时间阈值清理**：根据配置的保留时间自动清理旧轨迹点，保持轨迹的实时性
- **无限时长模式**：通过设置保留时间为-1，可以实现无限时长保留轨迹的功能

