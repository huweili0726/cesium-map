<template>
  <div class="home-container">
    <!-- 引入地图控制组件 -->
    <MapControls />

    <!-- cesium 地图 -->
    <cesium-map 
      :config="config"
      :url="mapConfigUrl"
      :options="options"
      @onload="mapOnLoad"/>
  </div>
</template>

<script setup lang="ts">
import * as Cesium from 'cesium'
import CesiumMap from '@/components/cesiumMap/index.vue'
import MapControls from '@/views/map/mapControls.vue'
import { useMapStore, MapLoadStatus } from '@/stores/modules/mapStore'

// 获取store实例，保持响应性
const mapStore = useMapStore()

// 组件初始化时设置为加载中
mapStore.setMapLoadSta(MapLoadStatus.LOADING)

// 如果未来需要动态更改地图配置，可以使用ref使其成为响应式
// 目前由于mapConfigUrl只在组件初始化时计算一次，不需要响应式
const config = `${process.env.BASE_URL}/config/config.jsonc?time=${new Date().getTime()}`
const mapConfigUrl = `${process.env.BASE_URL}/config/mapConfig.jsonc?time=${new Date().getTime()}`

// 设置地图属性
const options = {
  "scene": {
    // 设置地图中心点
    "center": {
      "lat": 31.726288,
      "lng": 117.229619,
      "alt": 5000
    }
  }
}

// 地图加载完成后触发
const mapOnLoad = (map: any) => {
  mapStore.setMapLoadSta(MapLoadStatus.LOADED) // 地图加载完成，设置状态为已加载
  mapStore.setMap(map); // 地图加载完成, 全局设置地图对象到store中

  setBeiJingTime(); // 地图加载完成后设置为当前北京时间

}

/**
 * 设置Cesium地图时间为当前北京时间
 */
const setBeiJingTime = () => {
  const map = mapStore.getMap() // 或者你的viewer变量
  if (!map) return
  // 强制设置时间为当前北京时间
  const now = new Date()
  const chinaTime = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  map.clock.currentTime = Cesium.JulianDate.fromDate(chinaTime)
  // 如果你不想动画效果，可以暂停时钟
  map.clock.shouldAnimate = true
  console.log('Cesium时间已调整为北京时间')
}

</script>

<style scoped lang="less">
.home-container {
  position: relative;
  display: flex;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}
</style>