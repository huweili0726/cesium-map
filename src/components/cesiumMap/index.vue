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
let darkFilterStage: Cesium.PostProcessStage | Cesium.PostProcessStageComposite | null = null

const applyCssLikeDarkFilter = (
  viewer: Cesium.Viewer,
  options?: {
    sepiaMix?: number
    saturation?: number
    hueRotate?: number
    contrast?: number
    brightness?: number
    yellowSuppress?: number
    blueTint?: number
    cyanBoost?: number
    shadowBlue?: number
  }
) => {
  // 若已存在则先移除，避免重复叠加导致画面异常
  if (darkFilterStage) {
    viewer.scene.postProcessStages.remove(darkFilterStage)
    darkFilterStage = null
  }

  darkFilterStage = viewer.scene.postProcessStages.add(
    new Cesium.PostProcessStage({
      name: 'css-like-dark-filter',
      fragmentShader: `
        uniform sampler2D colorTexture;
        in vec2 v_textureCoordinates;
        out vec4 fragColor;

        uniform float u_sepiaMix;
        uniform float u_saturation;
        uniform float u_hueRotate;
        uniform float u_contrast;
        uniform float u_brightness;
        uniform float u_yellowSuppress;
        uniform float u_blueTint;
        uniform float u_cyanBoost;
        uniform float u_shadowBlue;

        vec3 rgb2hsv(vec3 c) {
          vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
          vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
          vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
          float d = q.x - min(q.w, q.y);
          float e = 1e-10;
          return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
        }

        vec3 hsv2rgb(vec3 c) {
          vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
          vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
          return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
        }

        void main() {
          vec4 texColor = texture(colorTexture, v_textureCoordinates);
          vec3 color = texColor.rgb;

          // 1) invert(1)
          color = 1.0 - color;

          // 2) sepia(u_sepiaMix)
          vec3 sepia = vec3(
            dot(color, vec3(0.393, 0.769, 0.189)),
            dot(color, vec3(0.349, 0.686, 0.168)),
            dot(color, vec3(0.272, 0.534, 0.131))
          );
          color = mix(color, sepia, clamp(u_sepiaMix, 0.0, 1.0));

          // 3) saturate(u_saturation)
          float luminance = dot(color, vec3(0.299, 0.587, 0.114));
          vec3 gray = vec3(luminance);
          color = mix(gray, color, max(u_saturation, 0.0));

          // 4) hue-rotate(deg)
          vec3 hsv = rgb2hsv(color);
          hsv.x = fract(hsv.x + u_hueRotate / 360.0);


            // 4.1) suppress yellow/orange roads after dark transform
            // yellow hue range approx: [30°, 75°]
            float hDeg = hsv.x * 360.0;
            float yellowMask = smoothstep(20.0, 35.0, hDeg) * (1.0 - smoothstep(75.0, 90.0, hDeg));
            
            // only suppress when color has enough saturation/value
            float vividMask = smoothstep(0.2, 0.6, hsv.y) * smoothstep(0.2, 0.7, hsv.z);
            float suppress = clamp(u_yellowSuppress, 0.0, 1.0) * yellowMask * vividMask;

            // shift yellow hue toward cool blue and lower saturation slightly
            hsv.x = fract(hsv.x + suppress * (160.0 / 360.0));
            hsv.y = mix(hsv.y, hsv.y * 0.75, suppress);
            color = hsv2rgb(hsv);

            // 4.2) global cool-blue tint (科技深蓝基调 → 调浅)
            float blueTint = clamp(u_blueTint, 0.0, 1.0);
            color = mix(color, vec3(color.r * 0.80, color.g * 0.92, color.b * 1.15), blueTint);

            // 4.3) cyan highlight boost for bright pixels (道路/文字更“科技感”)
            float brightMask = smoothstep(0.45, 0.95, max(max(color.r, color.g), color.b));
            color.gb += vec2(0.04, 0.10) * clamp(u_cyanBoost, 0.0, 1.0) * brightMask;

            // 4.4) shadow deep blue push (暗部 → 更浅的蓝色，不是深黑蓝)
            float darkMask = 1.0 - smoothstep(0.06, 0.45, dot(color, vec3(0.299, 0.587, 0.114)));
            vec3 shadowBlue = vec3(0.07, 0.15, 0.28); // 这里是关键：调浅了
            color = mix(color, max(color, shadowBlue), clamp(u_shadowBlue, 0.0, 1.0) * darkMask);

          // 5) contrast(u_contrast)
          color = (color - 0.5) * u_contrast + 0.5;

          // 6) brightness(u_brightness)
          color *= u_brightness;

          fragColor = vec4(clamp(color, 0.0, 1.0), texColor.a);
        }
      `,
      uniforms: {
        u_sepiaMix: options?.sepiaMix ?? 0.16,
        u_saturation: options?.saturation ?? 1.35,
        u_hueRotate: options?.hueRotate ?? 188.0,
        u_contrast: options?.contrast ?? 1.08,
        u_brightness: options?.brightness ?? 0.9,
        u_yellowSuppress: options?.yellowSuppress ?? 1.0,
        u_blueTint: options?.blueTint ?? 0.78,
        u_cyanBoost: options?.cyanBoost ?? 0.62,
        u_shadowBlue: options?.shadowBlue ?? 0.72
      }
    })
  )
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

    // 暗色滤镜（可选）
    const darkFilterConfig = mapOptions?.scene?.darkFilter
    if (darkFilterConfig?.enabled ?? true) {
      applyCssLikeDarkFilter(map, {
        sepiaMix: darkFilterConfig?.sepiaMix,
        saturation: darkFilterConfig?.saturation,
        hueRotate: darkFilterConfig?.hueRotate,
        contrast: darkFilterConfig?.contrast,
        brightness: darkFilterConfig?.brightness,
        yellowSuppress: darkFilterConfig?.yellowSuppress,
        blueTint: darkFilterConfig?.blueTint,
        cyanBoost: darkFilterConfig?.cyanBoost,
        shadowBlue: darkFilterConfig?.shadowBlue,
      })
    }

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
    setMapCenter({lng: mapOptions.scene.center.lng, lat: mapOptions.scene.center.lat, map: map}) // 设置地图中心点

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
  if (map && darkFilterStage) {
    map.scene.postProcessStages.remove(darkFilterStage)
    darkFilterStage = null
  }

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
