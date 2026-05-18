/**
 * 无人机 Primitive 移动辅助模块
 *
 * 负责维护共享移动上下文、同步无人机位置、批量执行平滑插值移动。
 */
import * as Cesium from 'cesium'
import { appendDroneTrailPoint, sampleSmoothMovingTrails } from './droneTrailHelper'

const moveContextMap = new WeakMap()

const destroyMoveContextIfEmpty = (context) => {
  if (context.movingMap.size > 0) return

  if (context.postRenderListener) {
    context.map.scene.postRender.removeEventListener(context.postRenderListener)
    context.postRenderListener = null
  }

  moveContextMap.delete(context.map)
}

export const syncDronePosition = (dronePrimitive, position, options = {}) => {
  dronePrimitive.position = position

  if (dronePrimitive.billboard) {
    dronePrimitive.billboard.position = position
  }

  if (dronePrimitive.label) {
    dronePrimitive.label.position = position
  }

  if (typeof options.lng === 'number') {
    dronePrimitive.targetLng = options.lng
    dronePrimitive.info.lng = options.lng
  }

  if (typeof options.lat === 'number') {
    dronePrimitive.targetLat = options.lat
    dronePrimitive.info.lat = options.lat
  }

  if (typeof options.height === 'number') {
    dronePrimitive.targetHeight = options.height
    dronePrimitive.info.height = options.height
  }

  if (typeof options.heading === 'number') {
    dronePrimitive.info.heading = options.heading
  }
}

const updateMovingDrones = (context) => {
  const now = performance.now()

  context.movingMap.forEach((moveState, pointId) => {
    const { dronePrimitive, startPosition, targetPosition, startTime, duration, targetOptions } = moveState
    const progress = Math.min((now - startTime) / duration, 1)
    const currentPosition = Cesium.Cartesian3.lerp(
      startPosition,
      targetPosition,
      progress,
      new Cesium.Cartesian3()
    )

    syncDronePosition(dronePrimitive, currentPosition)

    if (progress >= 1) {
      syncDronePosition(dronePrimitive, targetPosition, targetOptions)
      if (dronePrimitive.trailConfig?.enabled !== false) {
        appendDroneTrailPoint({
          map: context.map,
          pointId,
          position: targetPosition,
          trailConfig: dronePrimitive.trailConfig,
          force: true,
        })
      }
      context.movingMap.delete(pointId)
    }
  })

  sampleSmoothMovingTrails(context)
  destroyMoveContextIfEmpty(context)
}

export const getMoveContext = (map) => {
  let context = moveContextMap.get(map)
  if (context) return context

  context = {
    map,
    movingMap: new Map(),
    postRenderListener: null,
  }

  context.postRenderListener = map.scene.postRender.addEventListener(() => {
    updateMovingDrones(context)
  })

  moveContextMap.set(map, context)
  return context
}

export const getExistingMoveContext = (map) => {
  return moveContextMap.get(map)
}

export const stopMoveByPointId = (map, pointId) => {
  const context = getExistingMoveContext(map)
  if (!context) return

  context.movingMap.delete(pointId)
  destroyMoveContextIfEmpty(context)
}

export const stopAllMove = (map) => {
  const context = getExistingMoveContext(map)
  if (!context) return

  context.movingMap.clear()
  destroyMoveContextIfEmpty(context)
}
