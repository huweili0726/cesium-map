/**
 * 无人机 Primitive 点位设置模块
 *
 * 使用共享 BillboardCollection / LabelCollection 以 Primitive 方式在 Cesium 地图上展示无人机图片点位。
 */
import * as Cesium from 'cesium'
import { useMapStore } from '@/stores/modules/mapStore'

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

const getScreenPosition = (map, position) => {
  if (!position) return null

  const screenPosition = Cesium.SceneTransforms.worldToWindowCoordinates(map.scene, position)
  if (!screenPosition) return null

  return screenPosition
}

const createInfoBoardElement = (droneInfo) => {
  const board = document.createElement('div')
  board.style.position = 'absolute'
  board.style.zIndex = '20'
  board.style.minWidth = '190px'
  board.style.padding = '10px 12px'
  board.style.border = '1px solid rgba(64, 224, 255, 0.85)'
  board.style.borderRadius = '6px'
  board.style.background = 'rgba(3, 20, 35, 0.88)'
  board.style.boxShadow = '0 0 12px rgba(64, 224, 255, 0.35)'
  board.style.color = '#fff'
  board.style.fontSize = '13px'
  board.style.lineHeight = '1.7'
  board.style.pointerEvents = 'auto'
  board.style.userSelect = 'none'
  board.style.cursor = 'move'

  board.innerHTML = `
    <div style="font-weight: 700; color: #40e0ff; margin-bottom: 4px;">无人机信息</div>
    <div>ID：${droneInfo.id}</div>
    <div>名称：${droneInfo.name}</div>
    <div>经度：${droneInfo.lng}</div>
    <div>纬度：${droneInfo.lat}</div>
    <div>高度：${droneInfo.height}</div>
    <div>航向：${droneInfo.heading}</div>
  `

  return board
}

const createInfoBoardLineElement = () => {
  const line = document.createElement('div')
  line.style.position = 'absolute'
  line.style.zIndex = '19'
  line.style.height = '1px'
  line.style.background = 'rgba(64, 224, 255, 0.9)'
  line.style.boxShadow = '0 0 6px rgba(64, 224, 255, 0.7)'
  line.style.transformOrigin = '0 50%'
  line.style.pointerEvents = 'none'
  return line
}

const getOverlayContainer = (map) => {
  const container = map.container || map.scene.canvas.parentElement
  if (container && getComputedStyle(container).position === 'static') {
    container.style.position = 'relative'
  }
  return container
}

const updateInfoBoardPosition = (map, dronePrimitive) => {
  const { infoBoard, infoLine, infoBoardOffset, position } = dronePrimitive
  if (!infoBoard || !infoLine) return

  const screenPosition = getScreenPosition(map, position)
  if (!screenPosition) {
    infoBoard.style.display = 'none'
    infoLine.style.display = 'none'
    return
  }

  infoBoard.style.display = 'block'
  infoLine.style.display = 'block'

  const anchorX = screenPosition.x + 45
  const anchorY = screenPosition.y - 36
  const boardX = anchorX + infoBoardOffset.x
  const boardY = anchorY + infoBoardOffset.y

  infoBoard.style.left = `${boardX}px`
  infoBoard.style.top = `${boardY}px`

  const lineStartX = screenPosition.x + 20
  const lineStartY = screenPosition.y - 28
  const lineEndX = boardX
  const lineEndY = boardY + infoBoard.offsetHeight / 2
  const deltaX = lineEndX - lineStartX
  const deltaY = lineEndY - lineStartY
  const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
  const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI

  infoLine.style.left = `${lineStartX}px`
  infoLine.style.top = `${lineStartY}px`
  infoLine.style.width = `${length}px`
  infoLine.style.transform = `rotate(${angle}deg)`
}

const makeInfoBoardDraggable = (map, dronePrimitive) => {
  const { infoBoard } = dronePrimitive
  if (!infoBoard) return

  let isDragging = false
  let startClientX = 0
  let startClientY = 0
  let startOffsetX = 0
  let startOffsetY = 0

  const onPointerMove = (event) => {
    if (!isDragging) return
    dronePrimitive.infoBoardOffset.x = startOffsetX + event.clientX - startClientX
    dronePrimitive.infoBoardOffset.y = startOffsetY + event.clientY - startClientY
    updateInfoBoardPosition(map, dronePrimitive)
  }

  const onPointerUp = () => {
    isDragging = false
    document.removeEventListener('mousemove', onPointerMove)
    document.removeEventListener('mouseup', onPointerUp)
  }

  const onPointerDown = (event) => {
    event.preventDefault()
    event.stopPropagation()
    isDragging = true
    startClientX = event.clientX
    startClientY = event.clientY
    startOffsetX = dronePrimitive.infoBoardOffset.x
    startOffsetY = dronePrimitive.infoBoardOffset.y
    document.addEventListener('mousemove', onPointerMove)
    document.addEventListener('mouseup', onPointerUp)
  }

  infoBoard.addEventListener('mousedown', onPointerDown)

  dronePrimitive.destroyInfoBoardDrag = () => {
    infoBoard.removeEventListener('mousedown', onPointerDown)
    document.removeEventListener('mousemove', onPointerMove)
    document.removeEventListener('mouseup', onPointerUp)
  }
}

const showDroneInfoBoard = (context, droneId) => {
  const dronePrimitive = context.mapStore.getGraphicMap(droneId)
  if (!dronePrimitive) return

  if (!dronePrimitive.infoBoard || !dronePrimitive.infoLine) {
    const overlayContainer = getOverlayContainer(context.map)
    dronePrimitive.infoBoard = createInfoBoardElement(dronePrimitive.info)
    dronePrimitive.infoLine = createInfoBoardLineElement()
    dronePrimitive.infoBoardOffset = dronePrimitive.infoBoardOffset || { x: 0, y: 0 }
    overlayContainer.appendChild(dronePrimitive.infoLine)
    overlayContainer.appendChild(dronePrimitive.infoBoard)
    makeInfoBoardDraggable(context.map, dronePrimitive)
  }

  updateInfoBoardPosition(context.map, dronePrimitive)
}

const destroyDroneInfoBoard = (dronePrimitive) => {
  if (dronePrimitive.destroyInfoBoardDrag) {
    dronePrimitive.destroyInfoBoardDrag()
    dronePrimitive.destroyInfoBoardDrag = null
  }

  if (dronePrimitive.infoBoard) {
    dronePrimitive.infoBoard.remove()
    dronePrimitive.infoBoard = null
  }

  if (dronePrimitive.infoLine) {
    dronePrimitive.infoLine.remove()
    dronePrimitive.infoLine = null
  }
}

const syncOpenedInfoBoards = (context) => {
  context.infoBoardDroneIds.forEach((droneId) => {
    const dronePrimitive = context.mapStore.getGraphicMap(droneId)
    if (dronePrimitive?.infoBoard) {
      updateInfoBoardPosition(context.map, dronePrimitive)
    }
  })
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
    syncOpenedInfoBoards(context)
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
