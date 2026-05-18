/**
 * 无人机信息牌模块
 *
 * 负责无人机信息牌 DOM 创建、拖拽、连线以及随地图渲染同步位置。
 */
import * as Cesium from 'cesium'

const getScreenPosition = (map, position) => {
  if (!position) return null

  const screenPosition = Cesium.SceneTransforms.worldToWindowCoordinates(map.scene, position)
  if (!screenPosition) return null

  return screenPosition
}

const getOverlayContainer = (map) => {
  const container = map.container || map.scene.canvas.parentElement
  if (container && getComputedStyle(container).position === 'static') {
    container.style.position = 'relative'
  }
  return container
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

export const updateDroneInfoBoardPosition = (map, dronePrimitive) => {
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
    updateDroneInfoBoardPosition(map, dronePrimitive)
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

export const showDroneInfoBoard = (context, droneId) => {
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

  updateDroneInfoBoardPosition(context.map, dronePrimitive)
}

export const destroyDroneInfoBoard = (dronePrimitive) => {
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

export const syncOpenedDroneInfoBoards = (context) => {
  context.infoBoardDroneIds.forEach((droneId) => {
    const dronePrimitive = context.mapStore.getGraphicMap(droneId)
    if (dronePrimitive?.infoBoard) {
      updateDroneInfoBoardPosition(context.map, dronePrimitive)
    }
  })
}
