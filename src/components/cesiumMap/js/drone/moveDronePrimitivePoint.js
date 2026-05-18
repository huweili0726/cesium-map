/**
 * 无人机 Primitive 点位移动模块
 *
 * 面向上万架无人机的移动策略：
 * 1. 默认直接更新到服务端/外部传入的新经纬度高度，单次调用 O(1)，最稳。
 * 2. 可选 smooth=true 使用共享 postRender 插值器，所有平滑移动共用一个渲染循环，避免每架无人机创建定时器。
 */
import * as Cesium from 'cesium'
import { useMapStore } from '@/stores/modules/mapStore'
import { getMoveContext, stopAllMove, stopMoveByPointId, syncDronePosition } from './droneMoveHelper'

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

    const targetOptions = {
      lng: options.lng,
      lat: options.lat,
      height: options.height || 0,
      heading: options.heading,
    }

    if (!options.smooth) {
      stopMoveByPointId(map, options.pointId)
      syncDronePosition(dronePrimitive, targetPosition, targetOptions)
      return dronePrimitive
    }

    const context = getMoveContext(map)
    const startPosition = Cesium.Cartesian3.clone(dronePrimitive.position || dronePrimitive.billboard?.position)
    const distance = Cesium.Cartesian3.distance(startPosition, targetPosition)
    const duration = Math.max(
      options.duration || (options.speed ? distance / options.speed * 1000 : 1000),
      16
    )

    context.movingMap.set(options.pointId, {
      dronePrimitive,
      startPosition,
      targetPosition,
      startTime: performance.now(),
      duration,
      targetOptions,
    })

    return dronePrimitive
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
    stopMoveDronePrimitivePoint,
    stopAllMoveDronePrimitivePoint,
  }
}
