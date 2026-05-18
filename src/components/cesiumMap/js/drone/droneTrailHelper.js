/**
 * 无人机 Primitive 拖尾
 *
 * - PolylineGeometry 屏幕像素线宽 + 纯色材质（同 setPath Entity 轨迹）
 * - 每机一个 Primitive，仅脏机 preRender 重建
 * - 绘制时对急弯/掉头做圆角插点，避免 miter 塌陷变细
 */
import * as Cesium from 'cesium'
import { useMapStore } from '@/stores/modules/mapStore'

const trailContextMap = new WeakMap()

const DEFAULT_TRAIL_COLOR = '#fbff00ff'
const DEFAULT_TRAIL_WIDTH = 2
const DEFAULT_MAX_POINTS = 512
const DEFAULT_SMOOTH_SAMPLE_MS = 250
/** smooth 采样默认最小间距（米），避免每帧追点 */
const DEFAULT_SMOOTH_MIN_DISTANCE = 8
const DEFAULT_CORNER_DOT_THRESHOLD = 0.5
const DEFAULT_CORNER_RADIUS = 25
const DEFAULT_CORNER_STEPS = 5
/** primitive 模式每帧最多重建条数，避免 1000+ 同帧卡死 */
const MAX_PRIMITIVE_REBUILDS_PER_FRAME = 48
const LARGE_TRAIL_COUNT = 300
const PRUNE_INTERVAL_MS = 400

const MATERIAL_VERTEX_FORMAT = Cesium.PolylineMaterialAppearance.VERTEX_FORMAT

const getColorKey = (color) => {
  if (color instanceof Cesium.Color) return color.toCssColorString()
  return String(color)
}

const scratchV1 = new Cesium.Cartesian3()
const scratchV2 = new Cesium.Cartesian3()
const scratchP1 = new Cesium.Cartesian3()
const scratchP2 = new Cesium.Cartesian3()
const scratchOut = new Cesium.Cartesian3()

const parseTrailColor = (color) => {
  if (color instanceof Cesium.Color) return color
  if (typeof color === 'string') return Cesium.Color.fromCssColorString(color)
  return Cesium.Color.fromCssColorString(DEFAULT_TRAIL_COLOR)
}

const getTrailMaterial = (context, color) => {
  const key = color instanceof Cesium.Color ? color.toCssColorString() : String(color)
  if (context.materialCache.has(key)) {
    return context.materialCache.get(key)
  }
  const material = Cesium.Material.fromType(Cesium.Material.ColorType, {
    color: parseTrailColor(color),
  })
  context.materialCache.set(key, material)
  return material
}

const removeLegacyTrailEntity = (map, pointId) => {
  const entity = map.entities.getById(`${pointId}_primitive_trail`)
  if (entity) map.entities.remove(entity)
}

const releaseTrailPrimitive = (trailState, map) => {
  const { primitive } = trailState
  trailState.primitive = null
  if (!primitive || primitive.isDestroyed()) return
  if (map.scene.primitives.contains(primitive)) {
    map.scene.primitives.remove(primitive, false)
  }
  if (!primitive.isDestroyed()) {
    primitive.destroy()
  }
}

const getSegmentDirectionDot = (from, corner, to) => {
  const distIn = Cesium.Cartesian3.distance(from, corner)
  const distOut = Cesium.Cartesian3.distance(corner, to)
  if (distIn < 0.5 || distOut < 0.5) return 1

  Cesium.Cartesian3.subtract(corner, from, scratchV1)
  Cesium.Cartesian3.subtract(to, corner, scratchV2)
  Cesium.Cartesian3.normalize(scratchV1, scratchV1)
  Cesium.Cartesian3.normalize(scratchV2, scratchV2)
  return Cesium.Cartesian3.dot(scratchV1, scratchV2)
}

const buildRoundedCornerPoints = (prev, corner, next, cornerRadius, steps) => {
  const distIn = Cesium.Cartesian3.distance(prev, corner)
  const distOut = Cesium.Cartesian3.distance(corner, next)
  const radius = Math.min(cornerRadius, distIn * 0.48, distOut * 0.48)
  if (radius < 2) return null

  Cesium.Cartesian3.subtract(corner, prev, scratchV1)
  Cesium.Cartesian3.subtract(next, corner, scratchV2)
  Cesium.Cartesian3.normalize(scratchV1, scratchV1)
  Cesium.Cartesian3.normalize(scratchV2, scratchV2)

  Cesium.Cartesian3.multiplyByScalar(scratchV1, -radius, scratchP1)
  Cesium.Cartesian3.add(corner, scratchP1, scratchP1)
  Cesium.Cartesian3.multiplyByScalar(scratchV2, radius, scratchP2)
  Cesium.Cartesian3.add(corner, scratchP2, scratchP2)

  const arcPoints = []
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps
    const oneMinusT = 1 - t
    scratchOut.x = oneMinusT * oneMinusT * scratchP1.x + 2 * oneMinusT * t * corner.x + t * t * scratchP2.x
    scratchOut.y = oneMinusT * oneMinusT * scratchP1.y + 2 * oneMinusT * t * corner.y + t * t * scratchP2.y
    scratchOut.z = oneMinusT * oneMinusT * scratchP1.z + 2 * oneMinusT * t * corner.z + t * t * scratchP2.z
    arcPoints.push(Cesium.Cartesian3.clone(scratchOut))
  }
  return arcPoints
}

/** 绘制用点列：highDensity 跳过圆角；primitive 模式用于 PolylineGeometry */
const buildRenderPositions = (trailState) => {
  const source = trailState.points.map((point) => point.position)
  const count = source.length
  if (count < 3 || trailState.highDensity) return source

  const { cornerDotThreshold, cornerRadius, cornerSteps } = trailState
  const result = [source[0]]

  for (let i = 1; i < count - 1; i += 1) {
    const prev = result[result.length - 1]
    const corner = source[i]
    const next = source[i + 1]

    if (getSegmentDirectionDot(prev, corner, next) < cornerDotThreshold) {
      const arcPoints = buildRoundedCornerPoints(prev, corner, next, cornerRadius, cornerSteps)
      if (arcPoints) {
        for (let j = 1; j < arcPoints.length; j += 1) {
          result.push(arcPoints[j])
        }
        continue
      }
    }
    result.push(corner)
  }

  result.push(source[count - 1])
  return result
}

const releaseCollectionPolyline = (context, trailState) => {
  const polyline = trailState.collectionPolyline
  trailState.collectionPolyline = null
  if (!polyline) return

  const bucket = context.collectionBuckets?.get(getColorKey(trailState.color))
  if (bucket && !bucket.collection.isDestroyed()) {
    bucket.collection.remove(polyline)
    bucket.count -= 1
  }
}

const getCollectionBucket = (context, color) => {
  const key = getColorKey(color)
  let bucket = context.collectionBuckets.get(key)
  if (!bucket) {
    const collection = new Cesium.PolylineCollection()
    context.map.scene.primitives.add(collection)
    bucket = { collection, count: 0 }
    context.collectionBuckets.set(key, bucket)
  }
  return bucket
}

const syncCollectionPolyline = (context, trailState) => {
  const positions = trailState.points.map((point) => point.position)
  if (positions.length < 2 || !trailState.visible) {
    if (trailState.collectionPolyline) {
      trailState.collectionPolyline.show = false
    }
    return
  }

  const bucket = getCollectionBucket(context, trailState.color)
  const material = getTrailMaterial(context, trailState.color)
  let polyline = trailState.collectionPolyline

  if (!polyline) {
    polyline = bucket.collection.add({
      positions: positions.map((p) => Cesium.Cartesian3.clone(p)),
      width: trailState.width,
      material,
      show: true,
      id: trailState.pointId,
    })
    trailState.collectionPolyline = polyline
    bucket.count += 1
    return
  }

  polyline.positions = positions
  polyline.width = trailState.width
  polyline.material = material
  polyline.show = true
}

const rebuildTrailPrimitive = (context, trailState) => {
  const { map } = context
  releaseTrailPrimitive(trailState, map)

  if (trailState.points.length < 2 || !trailState.visible) return

  const trailColor = parseTrailColor(trailState.color)
  const primitive = new Cesium.Primitive({
    geometryInstances: new Cesium.GeometryInstance({
      geometry: new Cesium.PolylineGeometry({
        positions: buildRenderPositions(trailState),
        width: trailState.width,
        vertexFormat: MATERIAL_VERTEX_FORMAT,
        arcType: Cesium.ArcType.NONE,
      }),
      id: trailState.pointId,
    }),
    appearance: new Cesium.PolylineMaterialAppearance({
      material: getTrailMaterial(context, trailState.color),
      translucent: trailColor.alpha < 1,
    }),
    asynchronous: false,
    allowPicking: false,
  })

  map.scene.primitives.add(primitive)
  trailState.primitive = primitive
}

const getTrailContext = (map) => {
  let context = trailContextMap.get(map)
  if (context) return context

  context = {
    map,
    trailMap: new Map(),
    materialCache: new Map(),
    collectionBuckets: new Map(),
    dirtyTrailIds: new Set(),
    batchFlushListener: null,
    pruneListener: null,
    deferFlush: 0,
    lastPruneTime: 0,
  }
  trailContextMap.set(map, context)
  return context
}

const flushDirtyTrails = (context) => {
  if (context.dirtyTrailIds.size === 0) return

  const ids = Array.from(context.dirtyTrailIds)
  context.dirtyTrailIds.clear()

  const collectionIds = []
  const primitiveIds = []

  ids.forEach((id) => {
    const trailState = context.trailMap.get(id)
    if (!trailState) return
    if (trailState.renderMode === 'collection') {
      collectionIds.push(id)
    } else {
      primitiveIds.push(id)
    }
  })

  collectionIds.forEach((id) => {
    const trailState = context.trailMap.get(id)
    if (trailState) syncCollectionPolyline(context, trailState)
  })

  const rebuildIds = primitiveIds.slice(0, MAX_PRIMITIVE_REBUILDS_PER_FRAME)
  const deferredIds = primitiveIds.slice(MAX_PRIMITIVE_REBUILDS_PER_FRAME)
  deferredIds.forEach((id) => context.dirtyTrailIds.add(id))

  rebuildIds.forEach((id) => {
    const trailState = context.trailMap.get(id)
    if (trailState) rebuildTrailPrimitive(context, trailState)
  })

  if (context.trailMap.size === 0) {
    destroyTrailContextIfEmpty(context)
  }
}

const scheduleTrailFlush = (context) => {
  if (context.deferFlush > 0) return
  if (context.batchFlushListener) return

  context.batchFlushListener = () => {
    context.batchFlushListener = null
    flushDirtyTrails(context)
    if (context.dirtyTrailIds.size > 0) {
      scheduleTrailFlush(context)
    }
  }
  context.map.scene.preRender.addEventListener(context.batchFlushListener)
}

const markTrailDirty = (context, pointId) => {
  context.dirtyTrailIds.add(pointId)
  scheduleTrailFlush(context)
}

/** 批量移动/创建时合并为一次 preRender 刷新 */
export const beginBatchTrailUpdate = (map) => {
  const context = getTrailContext(map)
  context.deferFlush += 1
}

export const endBatchTrailUpdate = (map) => {
  const context = trailContextMap.get(map)
  if (!context) return

  context.deferFlush = Math.max(0, context.deferFlush - 1)
  if (context.deferFlush === 0 && context.dirtyTrailIds.size > 0) {
    scheduleTrailFlush(context)
  }
}

const destroyTrailContextIfEmpty = (context) => {
  if (context.trailMap.size > 0) return

  if (context.pruneListener) {
    context.map.scene.postRender.removeEventListener(context.pruneListener)
    context.pruneListener = null
  }
  if (context.batchFlushListener) {
    context.map.scene.preRender.removeEventListener(context.batchFlushListener)
    context.batchFlushListener = null
  }
  context.dirtyTrailIds?.clear()

  context.trailMap.forEach((trailState) => {
    releaseTrailPrimitive(trailState, context.map)
    releaseCollectionPolyline(context, trailState)
  })
  context.collectionBuckets?.forEach((bucket) => {
    if (!bucket.collection.isDestroyed()) {
      context.map.scene.primitives.remove(bucket.collection)
      bucket.collection.destroy()
    }
  })
  context.collectionBuckets?.clear()
  context.materialCache.clear()
  trailContextMap.delete(context.map)
}

const pruneTrailPointsByTime = (trailState, now) => {
  if (trailState.retainSeconds < 0 || trailState.points.length === 0) return false

  const cutoff = now - trailState.retainSeconds * 1000
  let removeCount = 0
  while (removeCount < trailState.points.length && trailState.points[removeCount].time < cutoff) {
    removeCount += 1
  }
  if (removeCount === 0) return false

  trailState.points.splice(0, removeCount)
  return true
}

const trimTrailPointsByMax = (trailState) => {
  const overflow = trailState.points.length - trailState.maxPoints
  if (overflow <= 0) return false
  trailState.points.splice(0, overflow)
  return true
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

const appendTrailPointInternal = (context, trailState, position, now, force) => {
  if (!shouldAppendTrailPoint(trailState, position, now, force)) return false

  trailState.points.push({
    position: Cesium.Cartesian3.clone(position),
    time: now,
  })
  trailState.lastSampleTime = now

  pruneTrailPointsByTime(trailState, now)
  trimTrailPointsByMax(trailState)
  markTrailDirty(context, trailState.pointId)
  return true
}

const pruneAllTrails = (context) => {
  const now = performance.now()
  if (
    context.trailMap.size > LARGE_TRAIL_COUNT &&
    now - context.lastPruneTime < PRUNE_INTERVAL_MS
  ) {
    return
  }
  context.lastPruneTime = now

  context.trailMap.forEach((trailState, pointId) => {
    if (trailState.retainSeconds < 0) return
    if (pruneTrailPointsByTime(trailState, now)) {
      markTrailDirty(context, pointId)
    }
  })

  destroyTrailContextIfEmpty(context)
}

const ensurePruneListener = (context) => {
  if (context.pruneListener) return
  context.pruneListener = () => pruneAllTrails(context)
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
    cornerDotThreshold: trail.cornerDotThreshold ?? DEFAULT_CORNER_DOT_THRESHOLD,
    cornerRadius: trail.cornerRadius ?? DEFAULT_CORNER_RADIUS,
    cornerSteps: trail.cornerSteps ?? DEFAULT_CORNER_STEPS,
    visible: trail.visible !== false,
    /** primitive=高质量单条；collection=PolylineCollection 海量（推荐 500+） */
    renderMode: trail.renderMode === 'collection' ? 'collection' : 'primitive',
    highDensity: trail.highDensity === true,
  }
}

const applyTrailConfigToState = (context, trailState, config) => {
  const styleChanged =
    trailState.color !== config.color ||
    trailState.width !== config.width ||
    trailState.visible !== config.visible

  Object.assign(trailState, {
    color: config.color,
    width: config.width,
    retainSeconds: config.retainSeconds,
    maxPoints: config.maxPoints,
    minDistance: config.minDistance,
    sampleInterval: config.sampleInterval,
    cornerDotThreshold: config.cornerDotThreshold,
    cornerRadius: config.cornerRadius,
    cornerSteps: config.cornerSteps,
    visible: config.visible,
    renderMode: config.renderMode,
    highDensity: config.highDensity,
  })

  if (styleChanged && trailState.points.length >= 2) {
    markTrailDirty(context, trailState.pointId)
  }
}

export const ensureDroneTrail = (map, pointId, trailConfig = {}) => {
  const mapStore = useMapStore()
  const config = normalizeTrailConfig(trailConfig, mapStore)
  if (!config.enabled) return null

  removeLegacyTrailEntity(map, pointId)

  const context = getTrailContext(map)
  let trailState = context.trailMap.get(pointId)

  if (!trailState) {
    trailState = {
      pointId,
      primitive: null,
      points: [],
      lastSampleTime: 0,
      sampleSegmentId: 0,
    }
    context.trailMap.set(pointId, trailState)
  }

  applyTrailConfigToState(context, trailState, config)

  if (config.retainSeconds >= 0) {
    ensurePruneListener(context)
  }

  return trailState
}

/**
 * smooth 改目标/新航段：立刻在无人机当前位置落点并重置采样，避免仍按上一段插值 minDistance 滞后
 */
export const syncSmoothTrailSegment = (map, pointId, position, trailConfig = {}, segmentId) => {
  if (!map || !pointId || !position) return false

  const mapStore = useMapStore()
  const config = normalizeTrailConfig(trailConfig, mapStore)
  if (!config.enabled) return false

  const context = getTrailContext(map)
  const trailState = ensureDroneTrail(map, pointId, config)
  if (!trailState) return false

  const now = performance.now()
  appendTrailPointInternal(context, trailState, position, now, true)
  trailState.lastSampleTime = 0
  if (segmentId !== undefined) {
    trailState.sampleSegmentId = segmentId
  }
  return true
}

export const appendDroneTrailPoint = (options) => {
  const { map, pointId, position, trailConfig, force = false } = options
  if (!map || !pointId || !position) return false

  const mapStore = useMapStore()
  const config = normalizeTrailConfig(trailConfig, mapStore)
  if (!config.enabled) return false

  const context = getTrailContext(map)
  const trailState = ensureDroneTrail(map, pointId, config)
  if (!trailState) return false

  return appendTrailPointInternal(context, trailState, position, performance.now(), force)
}

export const syncDroneTrailOnMove = (map, pointId, position, moveOptions = {}) => {
  const trailInput = moveOptions.trail
  if (trailInput?.enabled === false) return false

  const mapStore = useMapStore()
  const dronePrimitive = mapStore.getGraphicMap(pointId)
  if (!dronePrimitive?.trailConfig && !trailInput) return false

  const mergedConfig = normalizeTrailConfig(
    { ...(dronePrimitive?.trailConfig || {}), ...(trailInput || {}) },
    mapStore
  )
  if (!mergedConfig.enabled) return false

  if (dronePrimitive) {
    dronePrimitive.trailConfig = mergedConfig
  }

  const hasMinDistance = (mergedConfig.minDistance ?? 0) > 0
  return appendDroneTrailPoint({
    map,
    pointId,
    position,
    trailConfig: mergedConfig,
    force: !moveOptions.smooth && !hasMinDistance,
  })
}

export const sampleSmoothMovingTrails = (moveContext) => {
  if (!moveContext?.movingMap?.size) return

  const context = getTrailContext(moveContext.map)
  const now = performance.now()

  moveContext.movingMap.forEach((moveState, pointId) => {
    const { dronePrimitive, targetOptions, currentPosition, segmentId } = moveState
    const trailConfig = dronePrimitive?.trailConfig
    if (!trailConfig?.enabled) return

    const position = currentPosition || dronePrimitive.position || dronePrimitive.billboard?.position
    if (!position) return

    const trailInput = targetOptions?.trail || {}
    const smoothMinDistance = Math.max(
      trailInput.minDistance ?? trailConfig.minDistance ?? 0,
      trailInput.smoothMinDistance ?? DEFAULT_SMOOTH_MIN_DISTANCE
    )
    const smoothSampleInterval = trailInput.sampleInterval ?? trailConfig.sampleInterval ?? DEFAULT_SMOOTH_SAMPLE_MS

    const trailState = ensureDroneTrail(moveContext.map, pointId, {
      ...trailConfig,
      minDistance: smoothMinDistance,
      sampleInterval: smoothSampleInterval,
    })
    if (!trailState) return

    if (segmentId !== trailState.sampleSegmentId) {
      trailState.sampleSegmentId = segmentId
      appendTrailPointInternal(context, trailState, position, now, true)
      return
    }

    appendTrailPointInternal(context, trailState, position, now, false)
  })
}

export const clearDronePrimitiveTrail = (map, pointId) => {
  const context = trailContextMap.get(map)
  if (!context) return

  const trailState = context.trailMap.get(pointId)
  if (!trailState) return

  releaseTrailPrimitive(trailState, map)
  releaseCollectionPolyline(context, trailState)
  context.trailMap.delete(pointId)
  context.dirtyTrailIds.delete(pointId)
  destroyTrailContextIfEmpty(context)
}

export const toggleDronePrimitiveTrail = (map, pointId, visible) => {
  const context = trailContextMap.get(map)
  const trailState = context?.trailMap.get(pointId)
  if (!trailState) return

  trailState.visible = visible
  markTrailDirty(context, pointId)
}

export const updateDronePrimitiveTrailConfig = (map, pointId, trailConfig) => {
  const mapStore = useMapStore()
  const config = normalizeTrailConfig(trailConfig, mapStore)
  const context = getTrailContext(map)
  const trailState = ensureDroneTrail(map, pointId, config)
  if (!trailState) return null

  const dronePrimitive = mapStore.getGraphicMap(pointId)
  if (dronePrimitive) {
    dronePrimitive.trailConfig = config
  }

  applyTrailConfigToState(context, trailState, config)
  return trailState
}
