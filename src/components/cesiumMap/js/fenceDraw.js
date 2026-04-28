/**
 * 电子围栏绘制模块
 *
 * 提供在 Cesium 地图上交互式创建电子围栏的能力。
 *
 * 右键结束绘制，双击也可结束绘制。
 *
 * @version 1.0.0
 * @date 2026-04-28
 */
import * as Cesium from 'cesium'
import { useMapStore } from '@/stores/modules/mapStore'

export function fenceDraw() {
  const mapStore = useMapStore()

  /**
   * 交互式创建多边形电子围栏
   * @param {Object} options 配置项
   * @param {string} options.id 围栏唯一标识
   * @param {number} [options.height=100] 围栏高度（米）
   * @param {string} [options.color='#00ffff'] 围栏颜色
   * @param {number} [options.opacity=0.35] 面透明度
   * @param {number} [options.outlineWidth=2] 边线宽度
   * @param {boolean} [options.zoomTo=false] 完成后是否飞行到围栏
   * @param {(result: Object) => void} [options.onFinish] 完成后的回调
   * @param {(result: Object) => void} [options.onChange] 绘制过程中的回调
   * @param {() => void} [options.onCancel] 取消时回调
   * @returns {Object|null} 绘制控制器
   */
  const createPolygonFence = (options = {}) => {
    const map = mapStore.getMap()
    if (!map) {
      console.error('地图实例不存在')
      return null
    }

    if (!options.id) {
      console.error('创建多边形电子围栏时必须提供 id')
      return null
    }

    if (mapStore.hasGraphicMap(options.id)) {
      console.warn(`id: ${options.id} 围栏已存在`)
      return null
    }

    const color = Cesium.Color.fromCssColorString(options.color || '#00ffff')
    const height = options.height ?? 100
    const opacity = options.opacity ?? 0.35
    const outlineWidth = options.outlineWidth ?? 2

    const positions = []
    let floatingPosition = null
    let wallEntity = null
    let polylineEntity = null
    let activePointEntity = null
    let handler = null
    let isFinished = false

    const pointEntityIds = []
    const tempIds = {
      wall: `${options.id}_draw_wall`,
      line: `${options.id}_draw_line`,
      active: `${options.id}_draw_active_point`
    }

    const getCatesianFromScreen = (screenPosition) => {
      if (!screenPosition) return null

      const scene = map.scene
      let cartesian = null

      if (scene.pickPositionSupported) {
        cartesian = scene.pickPosition(screenPosition)
      }

      if (!Cesium.defined(cartesian)) {
        const ray = map.camera.getPickRay(screenPosition)
        if (!ray) return null
        cartesian = scene.globe.pick(ray, scene)
      }

      return Cesium.defined(cartesian) ? cartesian : null
    }

    const cartesianToLngLatHeight = (cartesian) => {
      const cartographic = Cesium.Cartographic.fromCartesian(cartesian)
      return {
        lng: Cesium.Math.toDegrees(cartographic.longitude),
        lat: Cesium.Math.toDegrees(cartographic.latitude),
        height: cartographic.height || 0
      }
    }

    const getPolylinePositions = () => {
      if (positions.length === 0) return []
      if (floatingPosition) return [...positions, floatingPosition]
      return [...positions]
    }

    const getWallPositions = () => {
      if (positions.length < 2) return []

      const wallPositions = floatingPosition
        ? [...positions, floatingPosition]
        : [...positions]

      if (wallPositions.length >= 3) {
        wallPositions.push(wallPositions[0])
      }

      return wallPositions
    }

    const emitChange = () => {
      if (typeof options.onChange !== 'function') return

      options.onChange({
        id: options.id,
        positions: positions.map(item => cartesianToLngLatHeight(item)),
        count: positions.length
      })
    }

    const addVertexPoint = (position, index) => {
      const pointId = `${options.id}_point_${index}`
      pointEntityIds.push(pointId)

      return map.entities.add({
        id: pointId,
        position,
        point: {
          pixelSize: 10,
          color,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
        }
      })
    }

    const ensurePreviewEntities = () => {
      if (!polylineEntity) {
        polylineEntity = map.entities.add({
          id: tempIds.line,
          polyline: {
            positions: new Cesium.CallbackProperty(() => getPolylinePositions(), false),
            width: outlineWidth,
            material: color,
            clampToGround: false,
            arcType: Cesium.ArcType.NONE
          }
        })
      }

      if (!wallEntity) {
        wallEntity = map.entities.add({
          id: tempIds.wall,
          wall: {
            positions: new Cesium.CallbackProperty(() => getWallPositions(), false),
            maximumHeights: new Cesium.CallbackProperty(() => {
              const wallPositions = getWallPositions()
              return wallPositions.map(() => height)
            }, false),
            minimumHeights: new Cesium.CallbackProperty(() => {
              const wallPositions = getWallPositions()
              return wallPositions.map(() => 0)
            }, false),
            material: color.withAlpha(0.18),
            outline: true,
            outlineColor: color
          }
        })
      }

      if (!activePointEntity) {
        activePointEntity = map.entities.add({
          id: tempIds.active,
          position: new Cesium.CallbackProperty(() => floatingPosition, false),
          point: {
            pixelSize: 8,
            color: Cesium.Color.WHITE,
            outlineColor: color,
            outlineWidth: 2,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
          }
        })
      }
    }

    const cleanupTempEntities = () => {
      ;[wallEntity, polylineEntity, activePointEntity].forEach((entity) => {
        if (entity) {
          map.entities.remove(entity)
        }
      })
      wallEntity = null
      polylineEntity = null
      activePointEntity = null
    }

    const cleanupPointEntities = () => {
      pointEntityIds.forEach((id) => {
        const entity = map.entities.getById(id)
        if (entity) {
          map.entities.remove(entity)
        }
      })
      pointEntityIds.length = 0
    }

    const destroyHandler = () => {
      if (handler) {
        handler.destroy()
        handler = null
      }
      map.cesiumWidget.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
    }

    const finalize = () => {
      if (isFinished) return null

      if (positions.length < 3) {
        console.warn('至少需要 3 个点才能形成多边形电子围栏')
        return null
      }

      isFinished = true
      destroyHandler()
      cleanupTempEntities()
      cleanupPointEntities()

      const finalPositions = positions.map(item => Cesium.Cartesian3.clone(item))
      const finalWallPositions = [...finalPositions, finalPositions[0]]
      const lngLatPositions = finalPositions.map(item => cartesianToLngLatHeight(item))

      const fenceEntity = map.entities.add({
        id: options.id,
        name: options.name || `多边形电子围栏-${options.id}`,
        wall: {
          positions: finalWallPositions,
          maximumHeights: finalWallPositions.map(() => height),
          minimumHeights: finalWallPositions.map(() => 0),
          material: color.withAlpha(0.18),
          outline: true,
          outlineColor: color
        },
        polyline: {
          positions: finalWallPositions,
          width: outlineWidth,
          material: color,
          clampToGround: false,
          arcType: Cesium.ArcType.NONE
        }
      })

      fenceEntity._originalOptions = {
        ...options,
        positions: lngLatPositions,
        height,
        color: options.color || '#00ffff',
        opacity,
        outlineWidth
      }

      mapStore.setGraphicMap(options.id, fenceEntity)

      if (options.zoomTo) {
        map.flyTo(fenceEntity)
      }

      const result = {
        id: options.id,
        entity: fenceEntity,
        positions: lngLatPositions,
        cartesianPositions: finalPositions,
        height
      }

      if (typeof options.onFinish === 'function') {
        options.onFinish(result)
      }

      return result
    }

    const cancel = () => {
      if (isFinished) return
      destroyHandler()
      cleanupTempEntities()
      cleanupPointEntities()
      positions.length = 0
      floatingPosition = null

      if (typeof options.onCancel === 'function') {
        options.onCancel()
      }
    }

    handler = new Cesium.ScreenSpaceEventHandler(map.scene.canvas)

    handler.setInputAction((event) => {
      const cartesian = getCatesianFromScreen(event.position)
      if (!cartesian) return

      if (positions.length === 0) {
        positions.push(Cesium.Cartesian3.clone(cartesian))
        floatingPosition = Cesium.Cartesian3.clone(cartesian)
        addVertexPoint(cartesian, positions.length - 1)
        ensurePreviewEntities()
        emitChange()
        return
      }

      const lastPosition = positions[positions.length - 1]
      if (Cesium.Cartesian3.distance(lastPosition, cartesian) < 0.1) {
        return
      }

      positions.push(Cesium.Cartesian3.clone(cartesian))
      addVertexPoint(cartesian, positions.length - 1)
      emitChange()
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

    handler.setInputAction((event) => {
      if (positions.length === 0) return
      const cartesian = getCatesianFromScreen(event.endPosition)
      if (!cartesian) return
      floatingPosition = Cesium.Cartesian3.clone(cartesian)
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)

    handler.setInputAction(() => {
      finalize()
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK)

    handler.setInputAction(() => {
      finalize()
    }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)

    map.cesiumWidget.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)

    return {
      id: options.id,
      finish: finalize,
      cancel,
      destroy: cancel,
      getPositions: () => positions.map(item => cartesianToLngLatHeight(item))
    }
  }

  /**
   * 回显多边形电子围栏（根据已有坐标数据显示）
   * @param {Object} options 配置项
   * @param {string} options.id 围栏唯一标识
   * @param {Array} options.positions 围栏顶点坐标数组，格式: [{lng, lat, height}, ...]
   * @param {number} [options.height=100] 围栏高度（米）
   * @param {string} [options.color='#00ffff'] 围栏颜色
   * @param {number} [options.opacity=0.35] 面透明度
   * @param {number} [options.outlineWidth=2] 边线宽度
   * @param {boolean} [options.zoomTo=false] 是否飞行到围栏位置
   * @returns {Object|null} 围栏实体信息
   */
  const showPolygonFence = (options = {}) => {
    const map = mapStore.getMap()
    if (!map) {
      console.error('地图实例不存在')
      return null
    }

    if (!options.id) {
      console.error('回显多边形电子围栏时必须提供 id')
      return null
    }

    if (!options.positions || !Array.isArray(options.positions) || options.positions.length < 3) {
      console.error('回显多边形电子围栏时必须提供至少 3 个顶点坐标')
      return null
    }

    if (mapStore.hasGraphicMap(options.id)) {
      console.warn(`id: ${options.id} 围栏已存在，将被替换`)
      removePolygonFence(options.id)
    }

    const color = Cesium.Color.fromCssColorString(options.color || '#00ffff')
    const height = options.height ?? 100
    const opacity = options.opacity ?? 0.35
    const outlineWidth = options.outlineWidth ?? 2

    const lngLatToCartesian = (lngLat) => {
      return Cesium.Cartesian3.fromDegrees(lngLat.lng, lngLat.lat, lngLat.height || 0)
    }

    const finalPositions = options.positions.map(pos => lngLatToCartesian(pos))
    const finalWallPositions = [...finalPositions, finalPositions[0]]

    const fenceEntity = map.entities.add({
      id: options.id,
      name: options.name || `多边形电子围栏-${options.id}`,
      wall: {
        positions: finalWallPositions,
        maximumHeights: finalWallPositions.map(() => height),
        minimumHeights: finalWallPositions.map(() => 0),
        material: color.withAlpha(opacity),
        outline: true,
        outlineColor: color
      },
      polyline: {
        positions: finalWallPositions,
        width: outlineWidth,
        material: color,
        clampToGround: false,
        arcType: Cesium.ArcType.NONE
      }
    })

    fenceEntity._originalOptions = {
      ...options,
      positions: options.positions,
      height,
      color: options.color || '#00ffff',
      opacity,
      outlineWidth
    }

    mapStore.setGraphicMap(options.id, fenceEntity)

    if (options.zoomTo) {
      map.flyTo(fenceEntity)
    }

    return {
      id: options.id,
      entity: fenceEntity,
      positions: options.positions,
      cartesianPositions: finalPositions,
      height
    }
  }

  /**
   * 删除多边形电子围栏
   * @param {string} id 围栏ID
   * @returns {boolean}
   */
  const removePolygonFence = (id) => {
    const map = mapStore.getMap()
    if (!map) {
      console.error('地图实例不存在')
      return false
    }

    const entity = mapStore.getGraphicMap(id)
    if (!entity) {
      console.warn(`id: ${id} 围栏不存在`)
      return false
    }

    const removed = map.entities.remove(entity)
    if (removed) {
      mapStore.removeGraphicMap(id)
    }
    return removed
  }

  /**
   * 交互式创建圆形电子围栏（带高度）
   * @param {Object} options 配置项
   * @param {string} options.id 围栏唯一标识
   * @param {number} [options.height=100] 围栏高度（米）
   * @param {string} [options.color='#00ffff'] 围栏颜色
   * @param {number} [options.opacity=0.35] 面透明度
   * @param {number} [options.outlineWidth=2] 边线宽度
   * @param {boolean} [options.zoomTo=false] 完成后是否飞行到围栏
   * @param {(result: Object) => void} [options.onFinish] 完成后的回调
   * @param {(result: Object) => void} [options.onChange] 绘制过程中的回调
   * @param {() => void} [options.onCancel] 取消时回调
   * @returns {Object|null} 绘制控制器
   */
  const drawCircleFence = (options = {}) => {
    const map = mapStore.getMap()
    if (!map) {
      console.error('地图实例不存在')
      return null
    }

    if (!options.id) {
      console.error('创建圆形电子围栏时必须提供 id')
      return null
    }

    if (mapStore.hasGraphicMap(options.id)) {
      console.warn(`id: ${options.id} 围栏已存在`)
      return null
    }

    const color = Cesium.Color.fromCssColorString(options.color || '#00ffff')
    const height = options.height ?? 100
    const opacity = options.opacity ?? 0.35
    const outlineWidth = options.outlineWidth ?? 2

    let centerPosition = null
    let edgePosition = null
    let centerPointEntity = null
    let activePointEntity = null
    let ellipseEntity = null
    let handler = null
    let isFinished = false

    const tempIds = {
      ellipse: `${options.id}_draw_circle_wall`,
      center: `${options.id}_draw_center_point`,
      active: `${options.id}_draw_active_point`
    }

    const getCatesianFromScreen = (screenPosition) => {
      if (!screenPosition) return null

      const scene = map.scene
      let cartesian = null

      if (scene.pickPositionSupported) {
        cartesian = scene.pickPosition(screenPosition)
      }

      if (!Cesium.defined(cartesian)) {
        const ray = map.camera.getPickRay(screenPosition)
        if (!ray) return null
        cartesian = scene.globe.pick(ray, scene)
      }

      return Cesium.defined(cartesian) ? cartesian : null
    }

    const cartesianToLngLatHeight = (cartesian) => {
      const cartographic = Cesium.Cartographic.fromCartesian(cartesian)
      return {
        lng: Cesium.Math.toDegrees(cartographic.longitude),
        lat: Cesium.Math.toDegrees(cartographic.latitude),
        height: cartographic.height || 0
      }
    }

    const getRadius = () => {
      if (!centerPosition || !edgePosition) return 0
      return Cesium.Cartesian3.distance(centerPosition, edgePosition)
    }

    const emitChange = () => {
      if (typeof options.onChange !== 'function' || !centerPosition) return

      options.onChange({
        id: options.id,
        center: cartesianToLngLatHeight(centerPosition),
        edge: edgePosition ? cartesianToLngLatHeight(edgePosition) : null,
        radius: getRadius(),
        height
      })
    }

    const ensurePreviewEntities = () => {
      if (!centerPointEntity) {
        centerPointEntity = map.entities.add({
          id: tempIds.center,
          position: centerPosition,
          point: {
            pixelSize: 10,
            color,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
          }
        })
      }

      if (!ellipseEntity) {
        ellipseEntity = map.entities.add({
          id: tempIds.ellipse,
          position: new Cesium.CallbackProperty(() => centerPosition, false),
          ellipse: {
            semiMajorAxis: new Cesium.CallbackProperty(() => getRadius(), false),
            semiMinorAxis: new Cesium.CallbackProperty(() => getRadius(), false),
            height: 0,
            extrudedHeight: height,
            material: color.withAlpha(0),
            outline: true,
            outlineColor: color,
            outlineWidth,
            numberOfVerticalLines: 64
          }
        })
      }

      if (!activePointEntity) {
        activePointEntity = map.entities.add({
          id: tempIds.active,
          position: new Cesium.CallbackProperty(() => edgePosition, false),
          point: {
            pixelSize: 8,
            color: Cesium.Color.WHITE,
            outlineColor: color,
            outlineWidth: 2,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND
          }
        })
      }
    }

    const cleanupTempEntities = () => {
      ;[ellipseEntity, centerPointEntity, activePointEntity].forEach((entity) => {
        if (entity) {
          map.entities.remove(entity)
        }
      })
      ellipseEntity = null
      centerPointEntity = null
      activePointEntity = null
    }

    const destroyHandler = () => {
      if (handler) {
        handler.destroy()
        handler = null
      }
      map.cesiumWidget.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
    }

    const finalize = () => {
      if (isFinished) return null

      const radius = getRadius()
      if (!centerPosition || radius <= 0) {
        console.warn('至少需要 2 个点才能形成圆形电子围栏')
        return null
      }

      isFinished = true
      destroyHandler()
      cleanupTempEntities()

      const finalCenter = Cesium.Cartesian3.clone(centerPosition)
      const finalEdge = Cesium.Cartesian3.clone(edgePosition)

      const fenceEntity = map.entities.add({
        id: options.id,
        name: options.name || `圆形电子围栏-${options.id}`,
        position: finalCenter,
        ellipse: {
          semiMajorAxis: radius,
          semiMinorAxis: radius,
          height: 0,
          extrudedHeight: height,
          material: color.withAlpha(0),
          outline: true,
          outlineColor: color,
          outlineWidth,
          numberOfVerticalLines: 64
        }
      })

      fenceEntity._originalOptions = {
        ...options,
        center: cartesianToLngLatHeight(finalCenter),
        edge: cartesianToLngLatHeight(finalEdge),
        radius,
        height,
        color: options.color || '#00ffff',
        opacity,
        outlineWidth
      }

      mapStore.setGraphicMap(options.id, fenceEntity)

      if (options.zoomTo) {
        map.flyTo(fenceEntity)
      }

      const result = {
        id: options.id,
        entity: fenceEntity,
        center: cartesianToLngLatHeight(finalCenter),
        edge: cartesianToLngLatHeight(finalEdge),
        centerCartesian: finalCenter,
        edgeCartesian: finalEdge,
        radius,
        height
      }

      if (typeof options.onFinish === 'function') {
        options.onFinish(result)
      }

      return result
    }

    const cancel = () => {
      if (isFinished) return
      destroyHandler()
      cleanupTempEntities()
      centerPosition = null
      edgePosition = null

      if (typeof options.onCancel === 'function') {
        options.onCancel()
      }
    }

    handler = new Cesium.ScreenSpaceEventHandler(map.scene.canvas)

    handler.setInputAction((event) => {
      const cartesian = getCatesianFromScreen(event.position)
      if (!cartesian) return

      if (!centerPosition) {
        centerPosition = Cesium.Cartesian3.clone(cartesian)
        edgePosition = Cesium.Cartesian3.clone(cartesian)
        ensurePreviewEntities()
        emitChange()
        return
      }

      edgePosition = Cesium.Cartesian3.clone(cartesian)
      emitChange()
      finalize()
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

    handler.setInputAction((event) => {
      if (!centerPosition) return
      const cartesian = getCatesianFromScreen(event.endPosition)
      if (!cartesian) return
      edgePosition = Cesium.Cartesian3.clone(cartesian)
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)

    handler.setInputAction(() => {
      finalize()
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK)

    handler.setInputAction(() => {
      finalize()
    }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)

    map.cesiumWidget.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)

    return {
      id: options.id,
      finish: finalize,
      cancel,
      destroy: cancel,
      getCenter: () => (centerPosition ? cartesianToLngLatHeight(centerPosition) : null),
      getEdge: () => (edgePosition ? cartesianToLngLatHeight(edgePosition) : null),
      getRadius
    }
  }

  /**
   * 删除圆形电子围栏
   * @param {string} id 围栏ID
   * @returns {boolean}
   */
  const destroyCircleFence = (id) => {
    const map = mapStore.getMap()
    if (!map) {
      console.error('地图实例不存在')
      return false
    }

    const entity = mapStore.getGraphicMap(id)
    if (!entity) {
      console.warn(`id: ${id} 围栏不存在`)
      return false
    }

    const removed = map.entities.remove(entity)
    if (removed) {
      mapStore.removeGraphicMap(id)
    }
    return removed
  }

  return {
    createPolygonFence,
    showPolygonFence,
    removePolygonFence,
    drawCircleFence,
    destroyCircleFence
  }
}
