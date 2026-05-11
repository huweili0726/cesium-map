<template>
  <div class="cesium-map-wrapper">
    <div class="cesium-container" ref="cesiumContainer" />

    <div v-if="timeline.visible" class="business-replay-timeline">
      <div class="timeline-header">
        <span class="timeline-title">业务回放时间轴</span>
        <span class="timeline-time">{{ formatTimelineTime(timeline.currentTime) }}</span>
      </div>
      <input
        class="timeline-slider"
        type="range"
        :min="timeline.startTime"
        :max="timeline.endTime"
        :step="1000"
        :value="timeline.currentTime"
        @input="onTimelineInput"
        @change="onTimelineChange"
      />
      <div class="timeline-footer">
        <span>{{ formatTimelineTime(timeline.startTime) }}</span>
        <span>{{ Math.round(timeline.progress * 100) }}%</span>
        <span>{{ formatTimelineTime(timeline.endTime) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import * as Cesium from 'cesium'
import { ref, reactive, watch, onMounted, onUnmounted, toRaw } from 'vue'
import { jsonUtils } from '@/utils/json'
import { objectUtils } from '@/utils/object'
import { basicConfig } from '@/components/cesiumMap/js/basis'
import { useMapStore } from '@/stores/modules/mapStore'
import { customColorTileProvider } from '@/components/cesiumMap/js/tileProviders'
import { createCustomToolbarButtons } from '@/components/cesiumMap/js/customToolbarButtons'
import { BusinessReplayClock } from '@/components/cesiumMap/js/replayEngine'

const { getJsonFile } = jsonUtils()
const { merge } = objectUtils()
const { mouseController, setMapCenter } = basicConfig()
const { addCustomToolbarButtons, removeCustomToolbarButtons, createDefaultToolbarButtons } = createCustomToolbarButtons()

// 获取store实例，保持响应性
const mapStore = useMapStore()

// onload事件将在地图渲染后触发
const emit = defineEmits(["onload", "customButtonClick"])

// ✅ 正确：纯 JS 写法，去掉 withDefaults
const props = defineProps({
  config: {
    type: String,
    default: undefined
  },
  url: {
    type: String,
    default: undefined
  },
  options: {
    type: Object,
    default: undefined
  }
})

// 容器引用
const cesiumContainer = ref(null)
// 用于存放地球组件实例
let map = null
let customButtons = []
let businessReplayClock = null
let unwatchActiveReplayEngine = null
let unsubscribeReplayState = null
let wasPlayingBeforeTimelineDrag = false

const timeline = reactive({
  visible: false,
  startTime: 0,
  endTime: 0,
  currentTime: 0,
  progress: 0,
  isPlaying: false,
  dragging: false
})

const formatTimelineTime = (timestamp) => {
  if (!timestamp) return '--:--:--'
  const date = new Date(timestamp)
  const pad = (value) => String(value).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

const updateTimelineState = (state) => {
  if (!state) {
    timeline.visible = false
    return
  }

  timeline.visible = true
  timeline.startTime = state.startTime
  timeline.endTime = state.endTime
  if (!timeline.dragging) {
    timeline.currentTime = state.currentTime
  }
  timeline.progress = state.progress
  timeline.isPlaying = state.isPlaying
}

const bindActiveReplayEngine = (engine) => {
  if (unsubscribeReplayState) {
    unsubscribeReplayState()
    unsubscribeReplayState = null
  }

  if (!engine) {
    updateTimelineState(null)
    return
  }

  unsubscribeReplayState = engine.onStateChange(updateTimelineState)
}

const onTimelineInput = (event) => {
  const engine = mapStore.getActiveReplayEngine()
  if (!engine) return

  if (!timeline.dragging) {
    timeline.dragging = true
    wasPlayingBeforeTimelineDrag = engine.isPlaying
    if (engine.isPlaying) {
      engine.pause()
    }
  }

  const targetTime = Number(event.target.value)
  timeline.currentTime = targetTime
  timeline.progress = timeline.endTime > timeline.startTime ? (targetTime - timeline.startTime) / (timeline.endTime - timeline.startTime) : 0
  engine.seekToTime(targetTime)
}

const onTimelineChange = () => {
  const engine = mapStore.getActiveReplayEngine()
  timeline.dragging = false

  if (engine && wasPlayingBeforeTimelineDrag) {
    engine.continue()
  }

  wasPlayingBeforeTimelineDrag = false
}

const initCesium = async () => {
  if (!cesiumContainer.value) return

  // 获取配置
  let mapOptions
  if (props.url) {
    mapOptions = await getJsonFile(props.url)
  }

  if (props.config) {
    const configOptions = await getJsonFile(props.config)
    mapStore.setTrailTime(configOptions.trailTime)
  }

  if (props.options) {
    // 存在叠加的属性时
    let exOptions
    if (props.options.then) {
      exOptions = toRaw(await props.options)
    } else {
      exOptions = toRaw(props.options)
    }

    if (mapOptions) {
      mapOptions = merge(mapOptions, exOptions) // 合并配置
    } else {
      mapOptions = exOptions
    }
  }

  try {
    // 初始化 Cesium 地球
    map = new Cesium.Viewer(cesiumContainer.value, {
      // 配置项
      // Cesium 新版 Viewer.ConstructorOptions 中已移除 imageryProvider，改用 baseLayer。
      // 当配置为 false 时，禁用默认底图；其他情况走 Cesium 默认底图逻辑。
      baseLayer: mapOptions.control.imageryProvider === false ? false : undefined,
      baseLayerPicker: mapOptions.control.baseLayerPicker, // 底图选择器
      geocoder: mapOptions.control.geocoder, // 地址搜索
      homeButton: mapOptions.control.homeButton, // 主页按钮
      sceneModePicker: mapOptions.control.sceneModePicker, // 场景模式选择器
      navigationHelpButton: mapOptions.control.navigationHelpButton, // 导航帮助按钮
      animation: mapOptions.control.animation, // 动画控件
      timeline: mapOptions.control.timeline, // 时间轴
      infoBox: mapOptions.control.infoBox, // 信息框
      fullscreenButton: mapOptions.control.fullscreenButton, // 全屏按钮  
      vrButton: mapOptions.control.vrButton, // VR按钮
      terrainProvider: mapOptions.terrain.show ? await Cesium.CesiumTerrainProvider.fromUrl(mapOptions.terrain.url, {
        requestWaterMask: mapOptions.terrain.coastlineData, // 请求水体效果所需要的海岸线数据
        requestVertexNormals: mapOptions.terrain.lightingData, // 请求地形照明数据
      }) : undefined, // 加载自定义地形服务
      // 核心：隐藏版权水印
      creditContainer: document.createElement('div'), // 用空容器替换

      contextOptions: {
        webgl: {
          // 是否启用透明度通道
          alpha: false,
          // 是否启用深度缓冲区
          depth: true,
          // 是否启用模板缓冲区
          stencil: false,
          // 是否启用抗锯齿
          antialias: true,
          // 是否启用预乘透明度
          premultipliedAlpha: true,
          // 是否保留绘制缓冲区
          preserveDrawingBuffer: false,
          // 关键：允许在性能受限环境（如软件渲染、虚拟机）中运行
          failIfMajorPerformanceCaveat: false
        },
      }
    })

    // 从配置中加载底图
    if (mapOptions && mapOptions.basemaps) {
      // 查找show为true的底图
      const activeBasemap = mapOptions.basemaps.find(basemap => basemap.show === true)
      
      if (activeBasemap) {
        // 除默认底图 (不执行这行代码，高德地图会被 Cesium 默认底图覆盖，导致你看不到高德地图)
        map.imageryLayers.removeAll()

        // 加载配置的底图
        const layer = new Cesium.ImageryLayer(
          new Cesium.UrlTemplateImageryProvider({
            url: activeBasemap.url,
            subdomains: ['1', '2', '3', '4'], // 通过多子域名分散请求，突破浏览器并发限制，让地图加载更快、更稳定。
            maximumLevel: 18,
            credit: activeBasemap.name // 用于配置版权 / 来源声明的参数 (显示底图名称)
          })
        )
        
        // 如果配置了自定义地图颜色风格，则使用customColorTileProvider
        if (activeBasemap.customMapColorStyle && activeBasemap.customMapColorStyle.enabled) {
          const customColorLayer = new Cesium.ImageryLayer(
            new customColorTileProvider({
              url: activeBasemap.url,
              subdomains: ['1', '2', '3', '4'],
              maximumLevel: 18,
              credit: activeBasemap.name
            }, activeBasemap.customMapColorStyle)
          )
          map.imageryLayers.remove(layer)
          map.imageryLayers.add(customColorLayer)
        } else {
          map.imageryLayers.add(layer)
        }
        console.log(`加载底图：${activeBasemap.name}，URL：${activeBasemap.url}`)
      }
    }

    // 禁用默认的双击行为 (双击缩放)
    if (map.screenSpaceEventHandler && mapOptions.control.disableDoubleClick) {
      // 移除默认的双击行为
      map.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    }

    // 单击 entity 事件
    if (mapOptions.control.disableEntityClick) {
      map.selectedEntityChanged.addEventListener(() => {
        map.selectedEntity = undefined;   // 永远不让实体被选中
      });
    }

    // 显示帧速（FPS）
    map.scene.debugShowFramesPerSecond = mapOptions.scene.debugShowFramesPerSecond;
    // 开启/关闭 地球光照效果
    map.scene.globe.enableLighting = mapOptions.scene.globe.enableLighting
    // 开启地形深度测试，确保在地形上的实体正确渲染
    map.scene.globe.depthTestAgainstTerrain = mapOptions.scene.globe.depthTestAgainstTerrain;
    // 开启雾效
    map.scene.fog.enabled = mapOptions.scene.fog.enabled;
    // 开启/关闭 大气层光环
    map.scene.skyAtmosphere.show = mapOptions.scene.skyAtmosphere.show;
    // 开启/关闭 动态大气光照
    map.scene.globe.dynamicAtmosphereLighting = mapOptions.scene.globe.dynamicAtmosphereLighting;
    // 开启/关闭 动态大气光照从太阳开始
    map.scene.globe.dynamicAtmosphereLightingFromSun = mapOptions.scene.globe.dynamicAtmosphereLightingFromSun;
    
    // 初始化鼠标控制器
    mouseController(map); 

    // 初始化业务回放主时钟：所有自定义回放引擎统一挂到这里，Cesium Clock 不再作为业务主时钟
    businessReplayClock = new BusinessReplayClock()
    mapStore.setReplayClock(businessReplayClock)
    unwatchActiveReplayEngine = watch(
      () => mapStore.activeReplayEngine,
      (engine) => bindActiveReplayEngine(engine),
      { immediate: true }
    )

    // 保存地图中心点、旋转角度、俯仰角度
    mapStore.setMapInfo('center', {
      heading: mapOptions.scene.center.heading,
      pitch: mapOptions.scene.center.pitch,
      roll: mapOptions.scene.center.roll,
      duration: mapOptions.scene.center.duration,
      alt: mapOptions.scene.center.alt,
    })
    // 使用 flyTo 方法实现相机看向中心点的效果
    setMapCenter({lng: mapOptions.scene.center.lng, lat: mapOptions.scene.center.lat, map: map}) // 设置地图中心点

    // 在主页按钮附近添加自定义按钮
    customButtons = addCustomToolbarButtons(map, createDefaultToolbarButtons({
      mapOptions,
      map,
      setMapCenter,
      emit
    }))

    console.log('Cesium 地图加载成功')
    emit("onload", map)
  } catch (error) {
    console.error('Cesium 地图加载失败:', error)
  }
}

// 组件挂载时初始化地图
onMounted(() => {
  initCesium()
})

// 组件销毁时释放资源
onUnmounted(() => {
  // 移除自定义工具栏按钮
  removeCustomToolbarButtons(customButtons)
  customButtons = []

  if (unsubscribeReplayState) {
    unsubscribeReplayState()
    unsubscribeReplayState = null
  }

  if (unwatchActiveReplayEngine) {
    unwatchActiveReplayEngine()
    unwatchActiveReplayEngine = null
  }

  if (businessReplayClock) {
    businessReplayClock.destroy()
    businessReplayClock = null
    mapStore.setReplayClock(null)
    mapStore.setActiveReplayEngine(null)
  }

  if (map) {
    map.destroy()
    map = null
  }
})

</script>

<style scoped lang="less">
.cesium-map-wrapper {
  width: 100vw;
  height: 100vh;
  position: relative;
}

.cesium-container {
  width: 100%;
  height: 100%;
  position: relative;
}

.business-replay-timeline {
  position: absolute;
  left: 50%;
  bottom: 24px;
  z-index: 10;
  width: min(720px, calc(100vw - 48px));
  padding: 14px 18px 12px;
  transform: translateX(-50%);
  border: 1px solid rgba(64, 196, 255, 0.35);
  border-radius: 14px;
  background: rgba(8, 18, 32, 0.86);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(10px);
  color: #e8f7ff;
}

.timeline-header,
.timeline-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
}

.timeline-title {
  font-size: 14px;
  font-weight: 600;
  color: #7ee7ff;
}

.timeline-time {
  font-family: Consolas, Monaco, monospace;
  color: #ffffff;
}

.timeline-slider {
  width: 100%;
  margin: 10px 0 8px;
  accent-color: #28d7ff;
  cursor: pointer;
}

.timeline-footer {
  color: rgba(232, 247, 255, 0.72);
}

// map自定义按钮样式
.cesium-container :deep(.cesium-viewer-toolbar) {
  top: auto;
  bottom: 4vh;
  right: 5px;
  display: flex;
  flex-direction: column;
}
.cesium-container :deep(.custom-toolbar-button) {
  min-width: 64px;
}
</style>
