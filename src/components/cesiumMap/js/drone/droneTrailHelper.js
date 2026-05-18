/**
 * 无人机 Primitive 拖尾辅助模块
 *
 * 上万架 + 线宽一致 + 低锯齿：
 * - PolylineGeometry 屏幕像素扩线（与 Entity.polyline 同管线）
 * - 每机独立 Primitive，仅重建脏机，避免“同桶全量重建”导致其它轨迹闪烁/变细
 * - 纯色 Color 材质（与 setPath.js Entity 轨迹一致），不用 PolylineGlow 避免发彩/渐变
 * - 急转弯/掉头处在追加点时插入圆角折点，避免屏幕空间折线 miter 塌陷变细
 */
import * as Cesium from 'cesium'
import { useMapStore } from '@/stores/modules/mapStore'

const trailContextMap = new WeakMap()

const DEFAULT_TRAIL_COLOR = '#fbff00ff'
const DEFAULT_TRAIL_WIDTH = 2
const DEFAULT_MAX_POINTS = 512
const DEFAULT_SMOOTH_SAMPLE_MS = 250
/** 两线段方向点积低于此值视为急弯（0=直角，-1=掉头） */
const DEFAULT_CORNER_DOT_THRESHOLD = 0.5
/** 急弯圆角半径（米） */
const DEFAULT_CORNER_RADIUS = 25
/** 圆角贝塞尔插值段数 */
const DEFAULT_CORNER_STEPS = 5

const MATERIAL_VERTEX_FORMAT = Cesium.PolylineMaterialAppearance.VERTEX_FORMAT

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

const getMaterialCacheKey = (color) => {
  if (color instanceof Cesium.Color) return color.toCssColorString()
  return String(color)
}

/** 与 setPath.js 一致：纯色折线材质 */
const getTrailMaterial = (context, color) => {
  const key = getMaterialCacheKey(color)
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
  const legacyId = `${pointId}_primitive_trail`
  const entity = map.entities.getById(legacyId)
  if (entity) map.entities.remove(entity)
}

const releasePrimitives = (primitives, map) => {
  if (!primitives?.length) return
  primitives.forEach((primitive) => {
    if (!primitive || primitive.isDestroyed()) return
    if (map.scene.primitives.contains(primitive)) {
      map.scene.primitives.remove(primitive, false)
    }
    if (!primitive.isDestroyed()) {
      primitive.destroy()
    }
  })
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

const isSharpTurn = (from, corner, to, dotThreshold) => {
  return getSegmentDirectionDot(from, corner, to) < dotThreshold
}

/** 急弯处用二次贝塞尔插入圆角点，避免折线 miter 在掉头处变细 */
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

/** 生成用于绘制的点列（对历史急弯点补圆角） */
const buildRenderPositions = (trailState) => {
  const source = trailState.positionsArray
  const count = source.length
  if (count < 3) {
    return source.slice()
  }

  const {
    cornerDotThreshold,
    cornerRadius,
    cornerSteps,
  } = trailState

  const result = [source[0]]

  for (let i = 1; i < count - 1; i += 1) {
    const prev = result[result.length - 1]
    const corner = source[i]
    const next = source[i + 1]

    if (isSharpTurn(prev, corner, next, cornerDotThreshold)) {
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

const createTrailGeometryInstance = (trailState) => {
  if (trailState.positionsArray.length < 2 || !trailState.visible) return null

  const positions = buildRenderPositions(trailState)

  return new Cesium.GeometryInstance({
    geometry: new Cesium.PolylineGeometry({
      positions,
      width: trailState.width,
      vertexFormat: MATERIAL_VERTEX_FORMAT,
      arcType: Cesium.ArcType.NONE,
    }),
    id: trailState.pointId,
  })
}

const rebuildTrailPrimitive = (context, trailState) => {
  const { map } = context

  releasePrimitives(trailState.primitives, map)
  trailState.primitives = []

  const instance = createTrailGeometryInstance(trailState)
  if (!instance) return

  const trailColor = parseTrailColor(trailState.color)
  const primitive = new Cesium.Primitive({
    geometryInstances: instance,
    appearance: new Cesium.PolylineMaterialAppearance({
      material: getTrailMaterial(context, trailState.color),
      translucent: trailColor.alpha < 1,
    }),
    asynchronous: false,
    allowPicking: false,
  })

  map.scene.primitives.add(primitive)
  trailState.primitives = [primitive]
}

const getTrailContext = (map) => {
  let context = trailContextMap.get(map)
  if (context) return context

  context = {
    map,
    trailMap: new Map(),
    materialCache: new Map(),
    dirtyTrailIds: new Set(),
    batchDirty: false,
    batchFlushListener: null,
    pruneListener: null,
  }

  trailContextMap.set(map, context)
  return context
}

const releaseAllTrailPrimitives = (context) => {
  context.trailMap.forEach((trailState) => {
    releasePrimitives(trailState.primitives, context.map)
    trailState.primitives = []
  })
}

const markTrailDirty = (context, pointId) => {
  context.dirtyTrailIds.add(pointId)
  context.batchDirty = true
  ensureBatchFlushListener(context)
}

const flushDirtyTrails = (context) => {
  if (!context.batchDirty) return
  context.batchDirty = false

  const dirtyIds = Array.from(context.dirtyTrailIds)
  context.dirtyTrailIds.clear()

  dirtyIds.forEach((pointId) => {
    const trailState = context.trailMap.get(pointId)
    if (trailState) rebuildTrailPrimitive(context, trailState)
  })
}

const ensureBatchFlushListener = (context) => {
  if (context.batchFlushListener) return

  context.batchFlushListener = () => {
    flushDirtyTrails(context)
  }
  context.map.scene.preRender.addEventListener(context.batchFlushListener)
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

  releaseAllTrailPrimitives(context)
  context.materialCache.clear()
  trailContextMap.delete(context.map)
}

const pruneTrailPointsByTime = (trailState, now) => {
  const { retainSeconds, points, positionsArray } = trailState
  if (retainSeconds < 0 || points.length === 0) return false

  const cutoff = now - retainSeconds * 1000
  let removeCount = 0
  while (removeCount < points.length && points[removeCount].time < cutoff) {
    removeCount += 1
  }
  if (removeCount === 0) return false

  points.splice(0, removeCount)
  positionsArray.splice(0, removeCount)
  return true
}

const trimTrailPointsByMax = (trailState) => {
  const overflow = trailState.points.length - trailState.maxPoints
  if (overflow <= 0) return false

  trailState.points.splice(0, overflow)
  trailState.positionsArray.splice(0, overflow)
  return true
}

const shouldAppendTrailPoint = (trailState, position, now, force) => {
  if (force) return true

  const lastPosition = trailState.positionsArray[trailState.positionsArray.length - 1]
  if (!lastPosition) return true

  if (trailState.minDistance > 0) {
    const distance = Cesium.Cartesian3.distance(lastPosition, position)
    if (distance < trailState.minDistance) return false
  }

  if (trailState.sampleInterval > 0 && now - trailState.lastSampleTime < trailState.sampleInterval) {
    return false
  }

  return true
}

const appendRoundedPoints = (trailState, positions, now) => {
  positions.forEach((cartesian) => {
    trailState.points.push({ position: cartesian, time: now })
    trailState.positionsArray.push(cartesian)
  })
}

const appendTrailPointInternal = (context, trailState, position, now, force) => {
  if (!shouldAppendTrailPoint(trailState, position, now, force)) return false

  const cartesian = Cesium.Cartesian3.clone(position)
  const count = trailState.positionsArray.length

  if (count >= 2) {
    const prev = trailState.positionsArray[count - 2]
    const corner = trailState.positionsArray[count - 1]

    if (isSharpTurn(prev, corner, cartesian, trailState.cornerDotThreshold)) {
      trailState.positionsArray.pop()
      trailState.points.pop()

      const arcPoints = buildRoundedCornerPoints(
        prev,
        corner,
        cartesian,
        trailState.cornerRadius,
        trailState.cornerSteps
      )

      if (arcPoints?.length) {
        appendRoundedPoints(trailState, arcPoints, now)
      } else {
        appendRoundedPoints(trailState, [Cesium.Cartesian3.clone(corner)], now)
      }
    }
  }

  trailState.points.push({ position: cartesian, time: now })
  trailState.positionsArray.push(cartesian)

  trailState.lastSampleTime = now
  trailState.lastSamplePosition = position

  pruneTrailPointsByTime(trailState, now)
  trimTrailPointsByMax(trailState)
  markTrailDirty(context, trailState.pointId)
  return true
}

const pruneAllTrails = (context) => {
  const now = performance.now()
  let changed = false

  context.trailMap.forEach((trailState, pointId) => {
    if (trailState.retainSeconds < 0) return
    if (pruneTrailPointsByTime(trailState, now)) {
      context.dirtyTrailIds.add(pointId)
      changed = true
    }
  })

  if (changed) {
    context.batchDirty = true
    ensureBatchFlushListener(context)
  }

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
    cornerDotThreshold: trail.cornerDotThreshold ?? DEFAULT_CORNER_DOT_THRESHOLD,
    cornerRadius: trail.cornerRadius ?? DEFAULT_CORNER_RADIUS,
    cornerSteps: trail.cornerSteps ?? DEFAULT_CORNER_STEPS,
    visible: trail.visible !== false,
  }
}

export const applyTrailConfigToState = (context, trailState, config) => {
  const styleChanged =
    trailState.color !== config.color ||
    trailState.width !== config.width ||
    trailState.visible !== config.visible

  trailState.color = config.color
  trailState.width = config.width
  trailState.retainSeconds = config.retainSeconds
  trailState.maxPoints = config.maxPoints
  trailState.minDistance = config.minDistance
  trailState.sampleInterval = config.sampleInterval
  trailState.cornerDotThreshold = config.cornerDotThreshold
  trailState.cornerRadius = config.cornerRadius
  trailState.cornerSteps = config.cornerSteps
  trailState.visible = config.visible

  if (styleChanged && trailState.positionsArray.length >= 2) {
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
      primitives: [],
      points: [],
      positionsArray: [],
      lastSampleTime: 0,
      lastSamplePosition: null,
      visible: config.visible,
    }
    context.trailMap.set(pointId, trailState)
  }

  applyTrailConfigToState(context, trailState, config)

  if (config.retainSeconds >= 0) {
    ensurePruneListener(context)
  }

  return trailState
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

export const sampleSmoothMovingTrails = (moveContext) => {
  if (!moveContext?.movingMap?.size) return

  const context = getTrailContext(moveContext.map)

  moveContext.movingMap.forEach((moveState, pointId) => {
    const { dronePrimitive, targetOptions } = moveState
    const trailConfig = dronePrimitive?.trailConfig
    if (!trailConfig || trailConfig.enabled === false) return

    const position = dronePrimitive.position || dronePrimitive.billboard?.position
    if (!position) return

    const trailState = ensureDroneTrail(moveContext.map, pointId, trailConfig)
    if (!trailState) return

    const sampleConfig = normalizeTrailConfig(
      {
        ...trailConfig,
        minDistance: targetOptions?.trail?.minDistance ?? trailConfig.minDistance ?? 1,
        sampleInterval: targetOptions?.trail?.sampleInterval ?? trailConfig.sampleInterval ?? DEFAULT_SMOOTH_SAMPLE_MS,
      },
      useMapStore()
    )

    applyTrailConfigToState(context, trailState, sampleConfig)
    appendTrailPointInternal(context, trailState, position, performance.now(), false)
  })
}

export const clearDronePrimitiveTrail = (map, pointId) => {
  const context = trailContextMap.get(map)
  if (!context) return

  const trailState = context.trailMap.get(pointId)
  if (!trailState) return

  releasePrimitives(trailState.primitives, map)
  trailState.primitives = []
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
