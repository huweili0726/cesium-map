<template>
  <div class="cesium-container" ref="cesiumContainer" />
</template>

<script setup lang="ts">
import * as Cesium from 'cesium'
import { ref, onMounted, onUnmounted, toRaw } from 'vue'
import { jsonUtils } from '@/utils/json'
import { objectUtils } from '@/utils/object'
import { basicConfig } from '@/components/cesiumMap/ts/basis'
import { useMapStore } from '@/stores/modules/mapStore'

// 获取store实例，保持响应性
const mapStore = useMapStore()

// onload事件将在地图渲染后触发
const emit = defineEmits(["onload"])

const props = withDefaults(
  defineProps<{
    config?: string // 传入的地图配置参数url，可为空，只传options
    url?: string // 传入的地图构造参数url，可为空，只传options
    options?: any // 传入的地图构造参数options，可覆盖url内的参数
  }>(),
  {
    config: undefined,
    url: undefined, 
    options: undefined
  }
)

// 容器引用
const cesiumContainer = ref<HTMLElement | null>(null)
// 用于存放地球组件实例
let map: Cesium.Viewer | null = null

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
    })

    // 从配置中加载底图
    if (mapOptions && mapOptions.basemaps) {
      // 查找show为true的底图
      const activeBasemap = mapOptions.basemaps.find((basemap: any) => basemap.show === true)
      
      if (activeBasemap) {
        // 除默认底图 (不执行这行代码，高德地图会被 Cesium 默认底图覆盖，导致你看不到高德地图)
        map.imageryLayers.removeAll()

        // 加载配置的底图
        const imageryLayer = new Cesium.ImageryLayer(
          new Cesium.UrlTemplateImageryProvider({
            url: activeBasemap.url,
            subdomains: ['1', '2', '3', '4'], // 通过多子域名分散请求，突破浏览器并发限制，让地图加载更快、更稳定。
            maximumLevel: 18,
            credit: activeBasemap.name // 用于配置版权 / 来源声明的参数 (显示底图名称)
          })
        )
        // 添加图层
        map.imageryLayers.add(imageryLayer)
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

    // 开启/关闭 地球光照效果
    map.scene.globe.enableLighting = mapOptions.scene.globe.enableLighting
    // 显示帧速（FPS）
    map.scene.debugShowFramesPerSecond = true;
    // 开启地形深度测试，确保在地形上的实体正确渲染
    map.scene.globe.depthTestAgainstTerrain = true;

    // 初始化鼠标控制器
    mouseController(map); 

    // 保存地图中心点、旋转角度、俯仰角度
    mapStore.setMapInfo('center', {
      heading: mapOptions.scene.center.heading,
      pitch: mapOptions.scene.center.pitch,
      roll: mapOptions.scene.center.roll,
      duration: mapOptions.scene.center.duration,
      alt: mapOptions.scene.center.alt,
    })
    // 使用 flyTo 方法实现相机看向中心点的效果
    setMapCenter({lng: mapOptions.scene.center.lng, lat: mapOptions.scene.center.lat, alt: mapOptions.scene.center.alt, map: map}) // 设置地图中心点

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
  if (map) {
    map.destroy()
    map = null
  }
})

const { getJsonFile } = jsonUtils()
const { merge } = objectUtils()
const { mouseController, setMapCenter } = basicConfig()
</script>

<style scoped lang="less">
.cesium-container {
  width: 100vw;
  height: 100vh;
  position: relative;
}
</style>
