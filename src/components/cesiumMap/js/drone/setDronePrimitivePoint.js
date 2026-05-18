/**
 * 无人机 Primitive 点位设置模块
 *
 * 使用共享 BillboardCollection / LabelCollection 以 Primitive 方式在 Cesium 地图上展示无人机图片点位。
 */
import * as Cesium from 'cesium'
import { useMapStore } from '@/stores/modules/mapStore'
import { destroyDroneInfoBoard, showDroneInfoBoard, syncOpenedDroneInfoBoards } from './droneInfoBoard'

const DRONE_PICK_TYPE = 'drone-primitive'
const DRONE_LABEL_PICK_TYPE = 'drone-primitive-label'
const droneContextMap = new WeakMap()

const createDronePickId = (type, droneId) => ({
  type,
  droneId,
})

const getDroneIdFromPicked = (picked) => {
  if (!Cesium.defined(picked)) return null

  const pickedId = picked.id
  if (pickedId?.type === DRONE_PICK_TYPE || pickedId?.type === DRONE_LABEL_PICK_TYPE) {
    return pickedId.droneId
  }

  return null
}

const createDroneContext = (map, mapStore) => {
  const billboardCollection = new Cesium.BillboardCollection({
    scene: map.scene,
    blendOption: Cesium.BlendOption.OPAQUE_AND_TRANSLUCENT,
  })

  const labelCollection = new Cesium.LabelCollection({
    scene: map.scene,
    blendOption: Cesium.BlendOption.OPAQUE_AND_TRANSLUCENT,
  })

  map.scene.primitives.add(billboardCollection)
  map.scene.primitives.add(labelCollection)

  const droneInfoMap = new Map()
  const infoBoardDroneIds = new Set()
  const handler = new Cesium.ScreenSpaceEventHandler(map.scene.canvas)
  const context = {
    map,
    mapStore,
    billboardCollection,
    labelCollection,
    droneInfoMap,
    infoBoardDroneIds,
    handler,
    postRenderListener: null,
  }

  const handlePickedDrone = (movement, eventName) => {
    const picked = map.scene.pick(movement.position)
    const droneId = getDroneIdFromPicked(picked)
    if (!droneId) return

    const droneInfo = droneInfoMap.get(droneId) || mapStore.getGraphicMap(droneId)?.info
    if (droneInfo) {
      console.log(`无人机${eventName}点击信息：`, droneInfo)
    }

    if (eventName === '左键') {
      infoBoardDroneIds.add(droneId)
      showDroneInfoBoard(context, droneId)
    }
  }

  handler.setInputAction((movement) => {
    handlePickedDrone(movement, '左键')
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

  handler.setInputAction((movement) => {
    handlePickedDrone(movement, '右键')
  }, Cesium.ScreenSpaceEventType.RIGHT_CLICK)

  context.postRenderListener = map.scene.postRender.addEventListener(() => {
    syncOpenedDroneInfoBoards(context)
  })

  return context
}

const getDroneContext = (map, mapStore) => {
  let context = droneContextMap.get(map)

  if (!context || context.billboardCollection.isDestroyed() || context.labelCollection.isDestroyed()) {
    context = createDroneContext(map, mapStore)
    droneContextMap.set(map, context)
  }

  return context
}

const destroyDroneContextIfEmpty = (context) => {
  if (context.droneInfoMap.size > 0) return

  if (context.postRenderListener) {
    context.map.scene.postRender.removeEventListener(context.postRenderListener)
    context.postRenderListener = null
  }

  if (!context.handler.isDestroyed()) {
    context.handler.destroy()
  }

  if (!context.billboardCollection.isDestroyed()) {
    context.map.scene.primitives.remove(context.billboardCollection)
    context.billboardCollection.destroy()
  }

  if (!context.labelCollection.isDestroyed()) {
    context.map.scene.primitives.remove(context.labelCollection)
    context.labelCollection.destroy()
  }

  droneContextMap.delete(context.map)
}

export function setDronePrimitivePoint(baseUrl) {
  const mapStore = useMapStore()

  /**
   * 设置无人机图片点位【Primitive】
   * @param options 配置选项
   * @param options.id 点位唯一标识
   * @param options.lng 经度
   * @param options.lat 纬度
   * @param options.labelBgColor 标签背景颜色（可选，默认rgba(0, 0, 0, 0.65)）
   * @param options.height 高度（可选，默认0）
   * @param options.width 图片宽度（可选，默认30）
   * @param options.heightSize 图片高度（可选，默认30）
   * @param options.imageUrl 图片地址（可选，默认使用 /images/drone.png）
   * @returns 创建的无人机点位对象
   */
  const setDronePrimitivePointByImg = (options) => {
    const map = mapStore.getMap()
    if (!map) {
      console.error('地图实例不存在')
      return null
    }

    if (mapStore.hasGraphicMap(options.id)) {
      console.warn(`点位已存在，ID: ${options.id}`)
      return mapStore.getGraphicMap(options.id)
    }

    const context = getDroneContext(map, mapStore)
    const position = Cesium.Cartesian3.fromDegrees(
      options.lng,
      options.lat,
      options.height || 0
    )
    const droneName = options.name || `无人机${options.id}`
    const labelText = options.labelText || `白名单：${droneName}`
    const droneInfo = {
      id: options.id,
      name: droneName,
      labelText,
      lng: options.lng,
      lat: options.lat,
      height: options.height || 0,
      heading: options.heading || 0,
    }

    const billboard = context.billboardCollection.add({
      id: createDronePickId(DRONE_PICK_TYPE, options.id),
      position,
      image: options.imageUrl || `${baseUrl}/images/drone.png`,
      width: options.width || 30,
      height: options.heightSize || 30,
      horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
      verticalOrigin: Cesium.VerticalOrigin.CENTER,
      show: true,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    })

    const label = context.labelCollection.add({
      id: createDronePickId(DRONE_LABEL_PICK_TYPE, options.id),
      position,
      text: labelText,
      font: options.labelFont || '14px Microsoft YaHei',
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 3,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(0, -(options.heightSize || 30) / 2 - 10),
      showBackground: true,
      backgroundColor: Cesium.Color.fromCssColorString(options.labelBgColor || 'rgba(0, 0, 0, 0.65)'),
      backgroundPadding: new Cesium.Cartesian2(10, 6),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      show: true,
    })

    context.droneInfoMap.set(options.id, droneInfo)

    const dronePrimitive = {
      id: options.id,
      name: droneName,
      targetLng: options.lng,
      targetLat: options.lat,
      targetHeight: options.height || 0,
      position,
      billboardCollection: context.billboardCollection,
      labelCollection: context.labelCollection,
      billboard,
      label,
      info: droneInfo,
      infoBoard: null,
      infoLine: null,
      infoBoardOffset: { x: 0, y: 0 },
      destroyInfoBoardDrag: null,
      destroy: () => {
        destroyDroneInfoBoard(dronePrimitive)
        context.infoBoardDroneIds.delete(options.id)

        if (!context.billboardCollection.isDestroyed() && billboard) {
          context.billboardCollection.remove(billboard)
        }

        if (!context.labelCollection.isDestroyed() && label) {
          context.labelCollection.remove(label)
        }

        context.droneInfoMap.delete(options.id)
        mapStore.removeGraphicMap(options.id)
        destroyDroneContextIfEmpty(context)
      },
    }

    mapStore.setGraphicMap(options.id, dronePrimitive)
    return dronePrimitive
  }

  return {
    setDronePrimitivePointByImg,
  }
}
