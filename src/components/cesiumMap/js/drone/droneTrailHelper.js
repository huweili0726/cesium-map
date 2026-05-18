/**
 * 无人机 Primitive 拖尾辅助模块
 *
 * 上万架规模策略：
 * 1. 全图共享单个 PolylineCollection，批量 GPU 绘制。
 * 2. 无 Entity / CallbackProperty，直接更新 positions 数组。
 * 3. 每机环形点列 + maxPoints 上限，永久拖尾也不会无限膨胀。
 * 4. 非 smooth：每次经纬高更新追加一点；smooth：共享 postRender 按 sampleInterval 采样。
 */
import * as Cesium from 'cesium'
import { useMapStore } from '@/stores/modules/mapStore'

const trailContextMap = new WeakMap()

const DEFAULT_TRAIL_COLOR = '#fbff00ff'
const DEFAULT_TRAIL_WIDTH = 2
const DEFAULT_MAX_POINTS = 512
const DEFAULT_SMOOTH_SAMPLE_MS = 250

const parseTrailColor = (color) => {
  if (color instanceof Cesium.Color) return color
  if (typeof color === 'string') return Cesium.Color.fromCssColorString(color)
  return Cesium.Color.fromCssColorString(DEFAULT_TRAIL_COLOR)
}

/** PolylineCollection 内的 polyline 无 isDestroyed，用 collection.contains 判断 */
const isTrailPolylineValid = (trailState) => {
  const { polyline, polylineCollection } = trailState
  if (!polyline || !polylineCollection) return false
  if (polylineCollection.isDestroyed()) return false
  return polylineCollection.contains(polyline)
}

const destroyTrailContextIfEmpty = (context) => {
  if (context.trailMap.size > 0) return

  if (context.pruneListener) {
    context.map.scene.postRender.removeEventListener(context.pruneListener)
    context.pruneListener = null
  }

  if (!context.polylineCollection.isDestroyed()) {
    context.map.scene.primitives.remove(context.polylineCollection)
    context.polylineCollection.destroy()
  }

  trailContextMap.delete(context.map)
}

const pruneTrailPointsByTime = (trailState, now) => {
  const { retainSeconds, points } = trailState
  if (retainSeconds < 0 || points.length === 0) return

  const cutoff = now - retainSeconds * 1000
  let removeCount = 0
  while (removeCount < points.length && points[removeCount].time < cutoff) {
    removeCount += 1
  }
  if (removeCount > 0) {
    points.splice(0, removeCount)
  }
}

const trimTrailPointsByMax = (trailState) => {
  const overflow = trailState.points.length - trailState.maxPoints
  if (overflow > 0) {
    trailState.points.splice(0, overflow)
  }
}

const syncPolylinePositions = (trailState) => {
  const { polyline, points, positionsScratch } = trailState
  if (!isTrailPolylineValid(trailState)) return

  const count = points.length
  if (count < 2) {
    polyline.show = false
    return
  }

  positionsScratch.length = count
  for (let i = 0; i < count; i += 1) {
    positionsScratch[i] = points[i].position
  }

  polyline.positions = positionsScratch
  polyline.show = trailState.visible
}

const shouldAppendTrailPoint = (trailState, position, now, force) => {
  if (force) return true

  const lastPoint = trailState.points[trailState.points.length - 1]
  if (!lastPoint) return true

  if (trailState.minDistance > 0) {
    const distance = Cesium.Cartesian3.distance(lastPoint.position, position)
    if (distance < trailState.minDistance) return false
  }

  if (trailState.sampleInterval > 0 && now - trailState.lastSampleTime < trailState.sampleInterval) {
    return false
  }

  return true
}

const appendTrailPointInternal = (trailState, position, now, force) => {
  if (!shouldAppendTrailPoint(trailState, position, now, force)) return false

  trailState.points.push({
    position: Cesium.Cartesian3.clone(position),
    time: now,
  })

  trailState.lastSampleTime = now
  trailState.lastSamplePosition = position

  pruneTrailPointsByTime(trailState, now)
  trimTrailPointsByMax(trailState)
  syncPolylinePositions(trailState)
  return true
}

const pruneAllTrails = (context) => {
  const now = performance.now()
  let changed = false

  context.trailMap.forEach((trailState) => {
    if (trailState.retainSeconds < 0) return

    const before = trailState.points.length
    pruneTrailPointsByTime(trailState, now)
    if (trailState.points.length !== before) {
      syncPolylinePositions(trailState)
      changed = true
    }
  })

  if (!changed) return
  destroyTrailContextIfEmpty(context)
}

const ensurePruneListener = (context) => {
  if (context.pruneListener) return

  context.pruneListener = () => {
    pruneAllTrails(context)
  }
  context.map.scene.postRender.addEventListener(context.pruneListener)
}

export const normalizeTrailConfig = (trail = {}, mapStore) => {
  const retainSeconds = trail.retainSeconds ?? mapStore?.getTrailTime?.() ?? 30

  return {
    enabled: trail.enabled !== false,
    color: trail.color ?? DEFAULT_TRAIL_COLOR,
    width: trail.width ?? DEFAULT_TRAIL_WIDTH,
    retainSeconds,
    maxPoints: trail.maxPoints ?? DEFAULT_MAX_POINTS,
    minDistance: trail.minDistance ?? 0,
    sampleInterval: trail.sampleInterval ?? DEFAULT_SMOOTH_SAMPLE_MS,
    visible: trail.visible !== false,
  }
}

const getTrailContext = (map) => {
  let context = trailContextMap.get(map)
  if (context && !context.polylineCollection.isDestroyed()) return context

  const polylineCollection = new Cesium.PolylineCollection()
  map.scene.primitives.add(polylineCollection)

  context = {
    map,
    polylineCollection,
    trailMap: new Map(),
    pruneListener: null,
  }

  trailContextMap.set(map, context)
  return context
}

export const applyTrailConfigToState = (trailState, config) => {
  trailState.color = config.color
  trailState.width = config.width
  trailState.retainSeconds = config.retainSeconds
  trailState.maxPoints = config.maxPoints
  trailState.minDistance = config.minDistance
  trailState.sampleInterval = config.sampleInterval
  trailState.visible = config.visible

  if (isTrailPolylineValid(trailState)) {
    trailState.polyline.width = config.width
    trailState.polyline.material = Cesium.Material.fromType(Cesium.Material.ColorType, {
      color: parseTrailColor(config.color),
    })
    trailState.polyline.show = config.visible
  }
}

export const ensureDroneTrail = (map, pointId, trailConfig = {}) => {
  const mapStore = useMapStore()
  const config = normalizeTrailConfig(trailConfig, mapStore)
  if (!config.enabled) return null

  const context = getTrailContext(map)
  let trailState = context.trailMap.get(pointId)

  if (!trailState) {
    const polyline = context.polylineCollection.add({
      positions: [],
      width: config.width,
      material: Cesium.Material.fromType(Cesium.Material.ColorType, {
        color: parseTrailColor(config.color),
      }),
      show: config.visible,
      arcType: Cesium.ArcType.NONE,
    })

    trailState = {
      pointId,
      polyline,
      polylineCollection: context.polylineCollection,
      points: [],
      positionsScratch: [],
      lastSampleTime: 0,
      lastSamplePosition: null,
      visible: config.visible,
    }
    context.trailMap.set(pointId, trailState)
  } else if (!trailState.polylineCollection) {
    trailState.polylineCollection = context.polylineCollection
  }

  applyTrailConfigToState(trailState, config)

  if (config.retainSeconds >= 0) {
    ensurePruneListener(context)
  }

  return trailState
}

/**
 * 追加拖尾点
 * @param {object} options
 * @param {Cesium.Viewer} options.map
 * @param {string} options.pointId
 * @param {Cesium.Cartesian3} options.position
 * @param {object} [options.trailConfig]
 * @param {boolean} [options.force] 跳过距离/采样间隔限制
 */
export const appendDroneTrailPoint = (options) => {
  const { map, pointId, position, trailConfig, force = false } = options
  if (!map || !pointId || !position) return false

  const mapStore = useMapStore()
  const config = normalizeTrailConfig(trailConfig, mapStore)
  if (!config.enabled) return false

  const trailState = ensureDroneTrail(map, pointId, config)
  if (!trailState) return false

  return appendTrailPointInternal(trailState, position, performance.now(), force)
}

export const syncDroneTrailOnMove = (map, pointId, position, moveOptions = {}) => {
  const trailInput = moveOptions.trail
  if (trailInput?.enabled === false) return false

  const mapStore = useMapStore()
  const dronePrimitive = mapStore.getGraphicMap(pointId)
  if (!dronePrimitive?.trailConfig && !trailInput) return false

  const mergedConfig = normalizeTrailConfig(
    {
      ...(dronePrimitive?.trailConfig || {}),
      ...(trailInput || {}),
    },
    mapStore
  )

  if (!mergedConfig.enabled) return false

  if (dronePrimitive) {
    dronePrimitive.trailConfig = mergedConfig
  }

  return appendDroneTrailPoint({
    map,
    pointId,
    position,
    trailConfig: mergedConfig,
    force: !moveOptions.smooth,
  })
}

/** smooth 移动过程中按采样间隔追加拖尾点（由 droneMoveHelper 的 postRender 调用） */
export const sampleSmoothMovingTrails = (moveContext) => {
  if (!moveContext?.movingMap?.size) return

  moveContext.movingMap.forEach((moveState, pointId) => {
    const { dronePrimitive, targetOptions } = moveState
    const trailConfig = dronePrimitive?.trailConfig
    if (!trailConfig || trailConfig.enabled === false) return

    const position = dronePrimitive.position || dronePrimitive.billboard?.position
    if (!position) return

    const sampleConfig = {
      ...trailConfig,
      minDistance: targetOptions?.trail?.minDistance ?? trailConfig.minDistance ?? 1,
      sampleInterval: targetOptions?.trail?.sampleInterval ?? trailConfig.sampleInterval ?? DEFAULT_SMOOTH_SAMPLE_MS,
    }

    appendDroneTrailPoint({
      map: moveContext.map,
      pointId,
      position,
      trailConfig: sampleConfig,
      force: false,
    })
  })
}

export const clearDronePrimitiveTrail = (map, pointId) => {
  const context = trailContextMap.get(map)
  if (!context) return

  const trailState = context.trailMap.get(pointId)
  if (!trailState) return

  if (isTrailPolylineValid(trailState)) {
    context.polylineCollection.remove(trailState.polyline)
  }

  context.trailMap.delete(pointId)
  destroyTrailContextIfEmpty(context)
}

export const toggleDronePrimitiveTrail = (map, pointId, visible) => {
  const context = trailContextMap.get(map)
  const trailState = context?.trailMap.get(pointId)
  if (!trailState) return

  trailState.visible = visible
  if (isTrailPolylineValid(trailState)) {
    trailState.polyline.show = visible && trailState.points.length >= 2
  }
}

export const updateDronePrimitiveTrailConfig = (map, pointId, trailConfig) => {
  const mapStore = useMapStore()
  const config = normalizeTrailConfig(trailConfig, mapStore)
  const trailState = ensureDroneTrail(map, pointId, config)
  if (!trailState) return null

  const dronePrimitive = mapStore.getGraphicMap(pointId)
  if (dronePrimitive) {
    dronePrimitive.trailConfig = config
  }

  return trailState
}
