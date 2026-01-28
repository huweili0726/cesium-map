import { defineStore } from 'pinia'
import { ref, computed, shallowRef } from 'vue'

// 1. 定义地图加载状态的枚举，语义化状态值，避免魔法值
export enum MapLoadStatus {
  UNLOADED = 0,
  LOADING = 1,
  LOADED = 2,
  FAILED = 3 
}

// 2. 抽离状态与描述的映射常量，统一维护文案和状态码
const MAP_STATUS_MAP = {
  [MapLoadStatus.UNLOADED]: { info: '未加载', status: MapLoadStatus.UNLOADED },
  [MapLoadStatus.LOADING]: { info: '加载中', status: MapLoadStatus.LOADING },
  [MapLoadStatus.LOADED]: { info: '已加载', status: MapLoadStatus.LOADED },
  [MapLoadStatus.FAILED]: { info: '加载失败', status: MapLoadStatus.FAILED }, 
  default: { info: '未知状态', status: -1 }
}

export const useMapStore = defineStore('map', () => {
  // 地图对象引用
  const map = shallowRef<any>(null)
  // 地图加载状态
  const isMapLoaded = ref<MapLoadStatus>(MapLoadStatus.UNLOADED)
  // 全局唯一的GraphicLayer实例
  const graphicLayer = ref<any>(null)
  // 无人机轨迹缓存Map，key: 无人机ID + '_trail'，value: 轨迹数据
  const droneTrails = new Map<string, any>()
  // 图层是否已初始化
  const isLayerInitialized = ref(false)
  // 使用Map缓存图形对象，优化查找性能（从O(n)降到O(1)）
  const graphicMap = new Map<string, any>()
  // 地图信息，包含地图中心点、缩放级别、旋转角度等
  const mapInfo = new Map<string, any>()
  // 展示最近多少时间的轨迹，之前的轨迹渐影式移除（单位：秒）
  const trailTime = ref<number>(30)

  // 计算地图状态信息
  const mapStatus = computed(() => {
    return MAP_STATUS_MAP[isMapLoaded.value] || MAP_STATUS_MAP.default
  })

  // 设置地图加载状态的方法
  const setMapLoadSta = (status: MapLoadStatus) => {
    isMapLoaded.value = status
  }

  const resetMapLoadSta = () => {
    isMapLoaded.value = MapLoadStatus.UNLOADED
  }

  /**
   * 设置地图对象
   * @param mapInstance 地图实例
   */
  const setMap = (mapInstance: any) => {
    map.value = mapInstance
  }

  const getMap = () => {
    return map.value
  }

  const setTrailTime = (time: number) => {
    trailTime.value = time
  }

  const getTrailTime = () => {
    return trailTime.value
  }

  const setGraphicMap = (id: string, graphic: any) => {
    graphicMap.set(id, graphic)
  }

  const getGraphicMap = (id: string) => {
    return graphicMap.get(id)
  }

  const hasGraphicMap = (id: string) => {
    return graphicMap.has(id)
  }

  const removeGraphicMap = (id: string) => {
    graphicMap.delete(id)
  }

  const setMapInfo = (key: string, value: any) => {
    mapInfo.set(key, value)
  }

  const getMapInfo = (key: string) => {
    return mapInfo.get(key)
  }

  // 设置无人机轨迹
  const setDroneTrail = (droneId: string, trailData: any) => {
    droneTrails.set(`${droneId}_trail`, trailData)
  }

  // 获取无人机轨迹
  const getDroneTrail = (droneId: string) => {
    return droneTrails.get(`${droneId}_trail`)
  }

  // 检查无人机轨迹是否存在
  const hasDroneTrail = (droneId: string) => {
    return droneTrails.has(`${droneId}_trail`)
  }

  // 清除指定无人机轨迹
  const clearDroneTrail = (droneId: string) => {
    droneTrails.delete(`${droneId}_trail`)
  }

  // 清除所有无人机轨迹
  const clearAllDroneTrails = () => {
    droneTrails.forEach((_, key) => {
      if (key.endsWith('_trail')) {
        droneTrails.delete(key)
      }
    })
  }

  /**
   * 清除图层中的所有图形
   */
  const clearLayer = () => {
    if (graphicLayer.value) {
      graphicLayer.value.clear()
    }
  }

  /**
   * 重置图层状态
   */
  const resetLayer = () => {
    // 如果已有图层，从地图中移除
    if (graphicLayer.value && map.value) {
      map.value.removeLayer(graphicLayer.value)
    }
    
    // 重置状态
    graphicLayer.value = null
    isLayerInitialized.value = false
  }

  // 返回状态、计算属性和方法
  return {
    // 地图状态相关
    mapStatus,
    setMapLoadSta,
    resetMapLoadSta,
    // 地图对象和图层管理相关
    map,
    graphicLayer,
    isLayerInitialized,
    graphicMap,
    setGraphicMap,
    removeGraphicMap,
    getGraphicMap,
    hasGraphicMap,
    setDroneTrail,
    getDroneTrail,
    hasDroneTrail,
    clearDroneTrail,
    clearAllDroneTrails,
    setMap,
    getMap,
    clearLayer,
    resetLayer,
    setTrailTime,
    getTrailTime,
    mapInfo,
    setMapInfo,
    getMapInfo
  }
})