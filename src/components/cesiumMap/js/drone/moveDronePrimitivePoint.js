/**
 * 无人机 Primitive 点位移动模块
 *
 * 面向上万架无人机的移动策略：
 * 1. 默认直接更新到服务端/外部传入的新经纬度高度，单次调用 O(1)，最稳。
 * 2. 可选 smooth=true 使用共享 postRender 插值器，所有平滑移动共用一个渲染循环，避免每架无人机创建定时器。
 * 3. 拖尾见 droneTrailHelper：PolylineGeometry 像素线宽，每机独立 Primitive，急弯绘制时圆角。
 */
import * as Cesium from 'cesium'
import { useMapStore } from '@/stores/modules/mapStore'
import { getMoveContext, stopAllMove, stopMoveByPointId, syncDronePosition } from './droneMoveHelper'
import {
  beginBatchTrailUpdate,
  clearDronePrimitiveTrail,
  endBatchTrailUpdate,
  normalizeTrailConfig,
  syncDroneTrailOnMove,
  syncSmoothTrailSegment,
  toggleDronePrimitiveTrail,
  updateDronePrimitiveTrailConfig,
} from './droneTrailHelper'

export function moveDronePrimitivePoint() {
  const mapStore = useMapStore()

  /**
   * 移动无人机 Primitive 点位
   * @param options 配置选项
   * @param options.pointId 无人机点位id
   * @param options.lng 目标经度
   * @param options.lat 目标纬度
   * @param options.height 目标高度（可选，默认0）
   * @param options.heading 航向（可选）
   * @param options.smooth 是否平滑插值移动（可选，默认false）
   * @param options.duration 平滑移动时长，单位毫秒（可选）
   * @param options.speed 平滑移动速度，单位米/秒（可选；未传duration时生效）
   * @param options.trail 拖尾配置（可选）
   * @param options.trail.enabled 是否启用拖尾（默认 true，需创建点位时或首次传入 trail 才生效）
   * @param options.trail.color 拖尾颜色，CSS 字符串或 Cesium.Color
   * @param options.trail.width 拖尾线宽（默认 2）
   * @param options.trail.retainSeconds 保留时长（秒），-1 永久；未传时使用 mapStore.getTrailTime()
   * @param options.trail.maxPoints 永久/高频场景下单机最大点数（默认 512）
   * @param options.trail.minDistance 追加点的最小间距（米），非 smooth 默认 0（每次更新都追加）
   * @param options.trail.smoothMinDistance smooth 时最小采样间距（米，默认 8，低于此值用 8）
   * @param options.trail.sampleInterval smooth 模式下采样间隔（毫秒，默认 250）
   * @param options.trail.cornerRadius 急弯/掉头圆角半径（米，默认 25，避免转弯处轨迹变细）
   * @returns 移动后的无人机对象
   */
  const moveDronePrimitivePointByLngLat = (options) => {
    const map = mapStore.getMap()
    if (!map) {
      console.error('地图实例不存在')
      return null
    }

    const dronePrimitive = mapStore.getGraphicMap(options.pointId)
    if (!dronePrimitive) {
      console.warn(`无人机点位不存在，ID: ${options.pointId}`)
      return null
    }

    const targetPosition = Cesium.Cartesian3.fromDegrees(
      options.lng,
      options.lat,
      options.height || 0
    )

    if (options.trail) {
      dronePrimitive.trailConfig = {
        ...(dronePrimitive.trailConfig || {}),
        ...normalizeTrailConfig(options.trail, mapStore),
      }
    }

    const targetOptions = {
      lng: options.lng,
      lat: options.lat,
      height: options.height || 0,
      heading: options.heading,
      trail: options.trail,
    }

    if (!options.smooth) {
      stopMoveByPointId(map, options.pointId)
      syncDronePosition(dronePrimitive, targetPosition, targetOptions)
      syncDroneTrailOnMove(map, options.pointId, targetPosition, options)
      return dronePrimitive
    }

    const context = getMoveContext(map)
    const startPosition = Cesium.Cartesian3.clone(dronePrimitive.position || dronePrimitive.billboard?.position)
    const distance = Cesium.Cartesian3.distance(startPosition, targetPosition)
    const duration = Math.max(
      options.duration || (options.speed ? distance / options.speed * 1000 : 1000),
      16
    )

    const segmentId = (dronePrimitive.moveSegmentId ?? 0) + 1
    dronePrimitive.moveSegmentId = segmentId
    const mergedTrailConfig = {
      ...(dronePrimitive.trailConfig || {}),
      ...(options.trail ? normalizeTrailConfig(options.trail, mapStore) : {}),
    }

    context.movingMap.set(options.pointId, {
      dronePrimitive,
      startPosition,
      targetPosition,
      startTime: performance.now(),
      duration,
      targetOptions,
      segmentId,
    })

    if (mergedTrailConfig.enabled !== false) {
      syncSmoothTrailSegment(map, options.pointId, startPosition, mergedTrailConfig, segmentId)
    }

    return dronePrimitive
  }

  /**
   * 批量移动（合并拖尾刷新，海量场景务必使用）
   * @param items { pointId, lng, lat, height?, heading?, trail? }[]
   * @param commonOptions 共用 smooth / speed / trail 等
   */
  const moveDronePrimitivePointsBatch = (items, commonOptions = {}) => {
    const map = mapStore.getMap()
    if (!map || !items?.length) return 0

    beginBatchTrailUpdate(map)
    let count = 0
    try {
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i]
        const options = {
          ...commonOptions,
          ...item,
          pointId: item.pointId,
        }
        const result = moveDronePrimitivePointByLngLat(options)
        if (result) count += 1
      }
    } finally {
      endBatchTrailUpdate(map)
    }
    return count
  }

  /**
   * 清除 Primitive 无人机拖尾
   * @param pointId 无人机点位 id
   */
  const clearMoveDronePrimitiveTrail = (pointId) => {
    const map = mapStore.getMap()
    if (!map) return
    clearDronePrimitiveTrail(map, pointId)
  }

  /**
   * 显示/隐藏 Primitive 无人机拖尾
   */
  const toggleMoveDronePrimitiveTrail = (options) => {
    const map = mapStore.getMap()
    if (!map) return
    toggleDronePrimitiveTrail(map, options.pointId, options.visible)
  }

  /**
   * 更新 Primitive 无人机拖尾配置（颜色、宽度、保留时长等）
   */
  const updateMoveDronePrimitiveTrail = (options) => {
    const map = mapStore.getMap()
    if (!map) return null
    return updateDronePrimitiveTrailConfig(map, options.pointId, options.trail)
  }

  /**
   * 停止某架无人机当前平滑移动
   * @param pointId 无人机点位id
   */
  const stopMoveDronePrimitivePoint = (pointId) => {
    const map = mapStore.getMap()
    if (!map) return

    stopMoveByPointId(map, pointId)
  }

  /**
   * 停止所有无人机当前平滑移动
   */
  const stopAllMoveDronePrimitivePoint = () => {
    const map = mapStore.getMap()
    if (!map) return

    stopAllMove(map)
  }

  return {
    moveDronePrimitivePointByLngLat,
    moveDronePrimitivePointsBatch,
    stopMoveDronePrimitivePoint,
    stopAllMoveDronePrimitivePoint,
    clearMoveDronePrimitiveTrail,
    toggleMoveDronePrimitiveTrail,
    updateMoveDronePrimitiveTrail,
  }
}
