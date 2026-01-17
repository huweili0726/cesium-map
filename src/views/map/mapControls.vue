<template>
  <!-- 地图加载状态指示器 -->
  <div class="map-status-indicator">
    地图加载状态：{{ mapStore.mapStatus?.info || '未知状态' }}
  </div>

  <!-- 点位控制按钮 -->
  <div class="map-controls">
    <div class="button-group">
      <!-- 图片点位控制按钮组 -->
      <div class="button-group img-point-controls">
        <div class="group-title" @click="toggleControls('imgPoint')">
          图片点位控制
          <span class="toggle-icon">{{ isImgPointControlsOpen ? '▼' : '▶' }}</span>
        </div>
        <div v-if="isImgPointControlsOpen" class="controls-content">
          <button @click="toSetPointEntityByImg" class="control-btn">set entity点位(img)</button>
          <button @click="toSetPointPrimitiveByImg" class="control-btn">set primitive点位(img)</button>
          <button @click="toMovePointByImg" class="control-btn">move点位(img)</button>
          <button @click="toSetBatchPointByImg" class="control-btn">set(img 1万+）</button>
        </div>
      </div>

      <!-- 模型点位控制按钮组 -->
      <div class="button-group model-controls">
        <div class="group-title" @click="toggleControls('model')">
          模型点位控制
          <span class="toggle-icon">{{ isModelControlsOpen ? '▼' : '▶' }}</span>
        </div>
        <div v-if="isModelControlsOpen" class="controls-content">
          <button @click="toSetPointByGlb" class="control-btn">set点位(glb)</button>
          <button @click="toMovePointByGlb" class="control-btn">move点位(glb)</button>
        </div>
      </div>

      <!-- 半球体控制按钮组 -->
      <div class="button-group hemisphere-controls">
        <div class="group-title" @click="toggleControls('hemisphere')">
          半球体控制
          <span class="toggle-icon">{{ isHemisphereControlsOpen ? '▼' : '▶' }}</span>
        </div>
        <div v-if="isHemisphereControlsOpen" class="controls-content">
          <button @click="toSetHemisphere" class="control-btn">set半球</button>
          <button @click="toMoveHemisphere" class="control-btn">move半球</button>
          <button @click="toUpdateHemisphere" class="control-btn">update半球半径</button>
          <button @click="toRemoveHemisphere" class="control-btn">remove半球</button>
        </div>
      </div>

      <!-- 无人机点位移动控制按钮组 -->
      <div class="button-group drone-controls">
        <div class="group-title" @click="toggleControls('drone')">
          无人机点位移动
          <span class="toggle-icon">{{ isDroneControlsOpen ? '▼' : '▶' }}</span>
        </div>
        <div v-if="isDroneControlsOpen" class="controls-content">
          <button @click="toMoveDronePoint" class="control-btn">move(无人机1)</button>
          <button @click="toMoveDronePoint1" class="control-btn">move(无人机2)</button>
        </div>
      </div>

      <!-- 轨迹回放控制按钮组 -->
      <div class="button-group replay-controls">
        <div class="group-title" @click="toggleControls('replay')">
          轨迹回放控制
          <span class="toggle-icon">{{ isReplayControlsOpen ? '▼' : '▶' }}</span>
        </div>
        <div v-if="isReplayControlsOpen" class="controls-content">
          <button @click="toReplayDronePath" class="control-btn">回放轨迹</button>
          <button @click="toPauseDronePath" class="control-btn">暂停回放</button>
          <button @click="toContinueDronePath" class="control-btn">继续回放</button>
          <button @click="toStopDronePath" class="control-btn">停止回放</button>
          <button @click="toJumpToTime" class="control-btn">跳转到指定时间点</button>
          <button @click="toDestroyDronePath" class="control-btn">销毁回放</button>
        </div>
      </div>

      <!-- 涟漪效果控制按钮组 -->
      <div class="button-group diffusion-controls">
        <div class="group-title" @click="toggleControls('diffusion')">
          涟漪效果控制
          <span class="toggle-icon">{{ isDiffusionControlsOpen ? '▼' : '▶' }}</span>
        </div>
        <div v-if="isDiffusionControlsOpen" class="controls-content">
          <button @click="toCreateSingleDiffusion" class="control-btn">创建单圈涟漪</button>
          <button @click="toCreateMultiDiffusion" class="control-btn">创建多圈涟漪</button>
          <button @click="toCreateScanning" class="control-btn">创建扫描圈</button>
          <button @click="toCreateScanning1" class="control-btn">创建扫描圈img</button>
          <button @click="toRemoveSingleDiffusion" class="control-btn">移除涟漪效果</button>
        </div>
      </div>

      <!-- 围栏控制按钮组 -->
      <div class="button-group fence-controls">
        <div class="group-title" @click="toggleControls('fence')">
          围栏控制
          <span class="toggle-icon">{{ isFenceControlsOpen ? '▼' : '▶' }}</span>
        </div>
        <div v-if="isFenceControlsOpen" class="controls-content">
          <button @click="toCreatePolygonFence" class="control-btn">创建多边形墙</button>
          <button @click="toCreateCircleFence" class="control-btn">创建圆形墙</button>
          <button @click="toCreateCircleDiffusionFence" class="control-btn">圆形扩散墙</button>
          <button @click="toCreatePolygonDiffusionFence" class="control-btn">多边形扩散墙</button>
          <button @click="toCreateFenceFlowEffect" class="control-btn">创建火焰围栏</button>
        </div>
      </div>

      <!-- 椎体控制按钮组 -->
      <div class="button-group pyramid-controls">
        <div class="group-title" @click="toggleControls('pyramid')">
          椎体控制
          <span class="toggle-icon">{{ isPyramidControlsOpen ? '▼' : '▶' }}</span>
        </div>
        <div v-if="isPyramidControlsOpen" class="controls-content">
            <button @click="toCreateConicalEffect" class="control-btn">创建圆锥体</button>
            <button @click="toUpdateConicalEffect" class="control-btn">更新圆锥体高度</button>
            <button @click="toCreateRectangularPyramidEffect" class="control-btn">创建四棱锥</button>
            <button @click="toUpdateRectangularPyramidEffect" class="control-btn">更新四棱锥高度</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue'
import { useMapStore } from '@/stores/modules/mapStore'
import { setPoint } from '@/components/cesiumMap/ts/setPoint'
import { hemisphereConfig } from '@/components/cesiumMap/ts/hemisphere'
import { movePointConfig } from '@/components/cesiumMap/ts/movePoint'
import { setReplay } from '@/components/cesiumMap/ts/replayPath'
import { diffusionConfig } from '@/components/cesiumMap/ts/diffusion'
import { fenceConfig } from '@/components/cesiumMap/ts/fence'
import { geometryConfig } from '@/components/cesiumMap/ts/geometry'

// 获取store实例，保持响应性
const mapStore = useMapStore()

// 按钮组展开/折叠状态
const isImgPointControlsOpen = ref(false)
const isModelControlsOpen = ref(false)
const isHemisphereControlsOpen = ref(false)
const isDroneControlsOpen = ref(false)
const isReplayControlsOpen = ref(false)
const isDiffusionControlsOpen = ref(false)
const isFenceControlsOpen = ref(false)
const isPyramidControlsOpen = ref(false)

// 切换按钮组展开/折叠状态
const toggleControls = (controlType: string) => {
  switch (controlType) {
    case 'imgPoint':
      isImgPointControlsOpen.value = !isImgPointControlsOpen.value
      break
    case 'model':
      isModelControlsOpen.value = !isModelControlsOpen.value
      break
    case 'hemisphere':
      isHemisphereControlsOpen.value = !isHemisphereControlsOpen.value
      break
    case 'drone':
      isDroneControlsOpen.value = !isDroneControlsOpen.value
      break
    case 'replay':
      isReplayControlsOpen.value = !isReplayControlsOpen.value
      break
    case 'diffusion':
      isDiffusionControlsOpen.value = !isDiffusionControlsOpen.value
      break
    case 'fence':
      isFenceControlsOpen.value = !isFenceControlsOpen.value
      break
    case 'pyramid':
      isPyramidControlsOpen.value = !isPyramidControlsOpen.value
      break
  }
}

// 设置点位 （通过提供的图片设置点位）【Entity】
const toSetPointEntityByImg = () => {
  // 设置点位 （通过提供的图片设置点位）【Entity】
  // setPointEntityByImg({id: '1', lng: 117.229619, lat: 31.716288});
  setPointEntityByImg({id: '1', lng: 117.229629, lat: 31.716888});
}

// 设置点位 （通过提供的图片设置点位）【Primitive】
const toSetPointPrimitiveByImg = () => {
  // 设置点位 （通过提供的图片设置点位）【Primitive】
  setPointPrimitiveByImg({id: '1-primitive', lng: 117.229629, lat: 31.716888});
}

// 移动点位 （通过提供的图片设置点位）
const toMovePointByImg = () => {
  // 在原位置附近随机生成新的坐标
  const newLng = 117.236334 + (Math.random() - 0.5) * 0.01;
  const newLat = 31.715287 + (Math.random() - 0.5) * 0.01;
  const newHeight =  0;
  
  // 移动点位 （通过提供的图片设置点位）
  movePoint({pointId: '1', lng: newLng, lat: newLat, height: newHeight});
}

// 设置批量点位 （通过提供的图片设置点位）【上万个点位渲染】
const toSetBatchPointByImg = () => {
  // 设置批量点位 （通过提供的图片设置点位）【上万个点位渲染】
  setBatchPointsByImg({lng: 117.229619, lat: 31.716288});
}

// 设置点位 （通过提供的glb模型设置点位）
const toSetPointByGlb = () => {
  // 设置点位 （通过提供的glb模型设置点位）
  setPointByGlb({id: '2', url: `${process.env.BASE_URL}/glb/car.glb`, lng: 117.228433, lat: 31.723159, height: 0, heading: 180});
}

// 移动点位 （通过提供的glb模型设置点位）
const toMovePointByGlb = () => {
  // 在原位置附近随机生成新的坐标
  const newLng = 117.236334 + (Math.random() - 0.5) * 0.01;
  const newLat = 31.715287 + (Math.random() - 0.5) * 0.01;
  const newHeight =  0;
  const newHeading = Math.random() * 360;
  
  // 移动点位 （通过提供的glb模型设置点位）
  movePoint({pointId: '2', lng: newLng, lat: newLat, height: newHeight, heading: newHeading});
}

// 设置半球 （通过提供的glb模型设置点位）
const toSetHemisphere = () => {
  // 设置半球 （通过提供的glb模型设置点位）
  setHemisphere({id: '6', center: [117.228433, 31.723159, 0], radius: 1000, color: '#64ffda'});
}

// 移动半球 （通过提供的glb模型设置点位）
const toMoveHemisphere = () => {
  // 移动半球 （通过提供的glb模型设置点位）
  moveHemisphere({hemisphereId: '6', center: [117.236334, 31.715287, 0]});
}

// 更新半球半径 （通过提供的glb模型设置点位）
const toUpdateHemisphere = () => {
  // 更新半球半径 （通过提供的glb模型设置点位）
  updateHemisphere({hemisphereId: '6', radius: 2000});
}

// 删除半球 （通过提供的glb模型设置点位）
const toRemoveHemisphere = () => {
  // 删除半球 （通过提供的glb模型设置点位）
  removeHemisphere({hemisphereId: '6'});
}

// 平滑飞行到新位置 （通过提供的glb模型设置点位）
const toMoveDronePoint = () => {
  // 在原位置附近随机生成新的坐标
  const newLng = 117.236334 + (Math.random() - 0.5) * 0.01;
  const newLat = 31.715287 + (Math.random() - 0.5) * 0.01;
  const newHeight =  500;
  // const newHeading = Math.random() * 360;


  // 平滑飞行到新位置 （通过提供的glb模型设置点位）
  moveDronePoint({pointId: '4', lng: newLng, lat: newLat, height: newHeight, speed: 100});
}

// 平滑飞行到新位置 （通过提供的glb模型设置点位）
const toMoveDronePoint1 = () => {
  // 在原位置附近随机生成新的坐标
  const newLng = 117.236334 + (Math.random() - 0.5) * 0.01;
  const newLat = 31.715287 + (Math.random() - 0.5) * 0.01;
  const newHeight =  500;
  // const newHeading = Math.random() * 360;


  // 平滑飞行到新位置 （通过提供的glb模型设置点位）
  moveDronePoint({pointId: '5', lng: newLng, lat: newLat, height: newHeight, speed: 100});
}

// 回放控制器
let replayController: any = null
let replayController1: any = null
const toReplayDronePath = () => {
  // 示例回放数据：无人机飞行轨迹点
  // 格式：[{lng: 经度, lat: 纬度, height: 高度, timestamp: 时间戳(秒)}, ...]
  const exampleReplayData = [
    { lng: 117.229334, lat: 31.706787, height: 100, timestamp: 1710000000 },
    { lng: 117.230334, lat: 31.706787, height: 120, timestamp: 1710000001 },
    { lng: 117.231334, lat: 31.707787, height: 150, timestamp: 1710000002 },
    { lng: 117.232334, lat: 31.708787, height: 180, timestamp: 1710000003 },
    { lng: 117.233334, lat: 31.709787, height: 200, timestamp: 1710000004 },
    { lng: 117.234334, lat: 31.710787, height: 220, timestamp: 1710000005 },
    { lng: 117.235334, lat: 31.711787, height: 250, timestamp: 1710000006 },
    { lng: 117.236334, lat: 31.712787, height: 280, timestamp: 1710000007 },
    { lng: 117.237334, lat: 31.713787, height: 300, timestamp: 1710000008 },
    { lng: 117.238334, lat: 31.714787, height: 320, timestamp: 1710000009 },
    { lng: 117.239334, lat: 31.715787, height: 350, timestamp: 1710000010 }
  ]
  // 回放无人机轨迹
  replayController = replayDronePath({
    droneId: 'drone_replay_001', // 无人机ID
    replayData: exampleReplayData, // 回放数据
    speed: 1.0, // 回放速度（1.0表示正常速度）
    loop: false // 是否循环回放
  })

  // 创建另一个不同轨迹的回放数据，在当前点附近
  // 时间戳从1710000005开始，比第一个轨迹滞后5秒
  const exampleReplayData1 = [
    { lng: 117.227834, lat: 31.705987, height: 100, timestamp: 1710000005 }, // 稍微偏西南方的起点，滞后5秒
    { lng: 117.228334, lat: 31.707487, height: 130, timestamp: 1710000006 }, // 向西北方向移动
    { lng: 117.227834, lat: 31.708087, height: 160, timestamp: 1710000007 }, // 继续向西北
    { lng: 117.227334, lat: 31.708687, height: 190, timestamp: 1710000008 }, // 保持西北方向
    { lng: 117.226834, lat: 31.709287, height: 220, timestamp: 1710000009 }, // 高度继续增加
    { lng: 117.226334, lat: 31.709887, height: 200, timestamp: 1710000010 }, // 开始降低高度
    { lng: 117.225834, lat: 31.710487, height: 180, timestamp: 1710000011 }, // 继续降低
    { lng: 117.225334, lat: 31.711087, height: 160, timestamp: 1710000012 }, // 保持较低高度
    { lng: 117.224834, lat: 31.711687, height: 140, timestamp: 1710000013 }, // 继续降低
    { lng: 117.224334, lat: 31.712287, height: 120, timestamp: 1710000014 }, // 接近结束高度
    { lng: 117.223834, lat: 31.712887, height: 100, timestamp: 1710000015 }  // 结束在较低高度
  ]
  // 回放无人机轨迹
  replayController1 = replayDronePath({
    droneId: 'drone_replay_002', // 无人机ID
    replayData: exampleReplayData1, // 回放数据
    speed: 1.0, // 回放速度（1.0表示正常速度）
    loop: false // 是否循环回放
  })

  // 配置时钟，设置回放时间范围
  configureClock(1710000000, 1710000015, 1, false)

  // 开始播放
  replayController.play()
  // 开始播放
  replayController1.play()
}

// 暂停回放无人机轨迹
const toPauseDronePath = () => {
  if (replayController) {
    replayController.pause()
  }
}

// 继续回放无人机轨迹
const toContinueDronePath = () => {
  if (replayController) {
    replayController.continue()
  }
}

// 停止回放无人机轨迹
const toStopDronePath = () => {
  if (replayController) {
    replayController.stop()
  }
}

// 跳转到指定时间点
const toJumpToTime = () => {
  if (replayController) {
    replayController.seek(5) // 跳转到回放开始后10秒的位置
  }
}

// 销毁回放控制器
const toDestroyDronePath = () => {
  if (replayController) {
    replayController.destroy()
  }

  if (replayController1) {
    replayController1.destroy()
  }
}

// 涟漪效果控制方法
const toCreateSingleDiffusion = () => {
  singleDiffusion({
    id: 'single_diffusion_001',
    center: [117.228433, 31.723159], // 涟漪中心坐标
    maxRadius: 1500, // 最大扩散半径（米）
    color: '#E81224', // 涟漪颜色
    speed: 10, // 倍速（原始速率的倍数）
  })
}

// 创建多圈扩散涟漪效果
const toCreateMultiDiffusion = () => {
  multiDiffusion({
    id: 'multi_diffusion_001',
    center: [117.228433, 31.723159], // 涟漪中心坐标
    maxRadius: 1500, // 最大扩散半径（米）
    color: '#E81224', // 涟漪颜色
    speed: 10, // 倍速（原始速率的倍数）
    circlesNumber: 3 // 波纹圈数
  })
}

// 创建扫描圈涟漪效果
const toCreateScanning = () => {
  scanning({
    id: 'scanning_001',
    center: [117.228433, 31.723159], // 涟漪中心坐标
    maxRadius: 1500, // 最大扩散半径（米）
    color: '#E81224', // 涟漪颜色
    speed: 2, // 倍速（原始速率的倍数）
  })
}

// 创建扫描圈涟漪效果（img 扫描圈）
const toCreateScanning1 = () => {
  circleScanImage({
    id: 'scanning_002',
    center: [117.228433, 31.723159], // 涟漪中心坐标
    maxRadius: 1500, // 最大扩散半径（米）
    color: '#E81224', // 涟漪颜色
    speed: 2, // 倍速（原始速率的倍数）
  })
}

// 创建多边形扩散涟漪效果
const toCreatePolygonFence = () => {
  polygonFence({
    id: 'polygon_diffusion_001',
    maxHeight: 800, // 最大扩散高度（米）
    color: '#E81224', // 涟漪颜色
    speed: 5, // 倍速（原始速率的倍数）
    polygonPoints: [
      117.228433, 31.703159,
      117.215433, 31.714159,
      117.222433, 31.723859,
      117.238433, 31.703159,
      117.228433, 31.703159,
    ],
    type: 0 // 0:光环扩散, 1:扫描线, 2:涟漪, 3:粒子
  })
}

// 创建圆形围栏效果
const toCreateCircleFence = () => {
  circleFence({
    id: 'circle_diffusion_001',
    center: [117.229619, 31.726288, 500], // 使用地图初始化时的中心点坐标，并增加一点高度
    radius: 1500, // 最大扩散半径（米）
    height: 800, // 最大扩散高度（米）
    color: '#E81224', // 涟漪颜色
    opacity: 0.8, // 增加透明度确保可见
    speed: 5, // 倍速（原始速率的倍数）
    segments: 128 // 增加分段数，使圆形更平滑
  })
}

// 移除单圈涟漪效果
const toRemoveSingleDiffusion = () => {
  // 移除指定ID的涟漪效果
  removeDiffusion('single_diffusion_001')
}

// 创建扩散围栏效果
const toCreateCircleDiffusionFence = () => {
  // 创建扩散围栏
  circleDiffuseFence({
    id: 'diffusion_fence_001',
    center: [117.229619, 31.726288, 500], // 使用地图初始化时的中心点坐标，并增加一点高度
    radius: 1500, // 最大扩散半径（米）
    height: 800, // 最大扩散高度（米）
    color: '#E81224', // 涟漪颜色
    opacity: 0.8, // 增加透明度确保可见
    speed: 5, // 倍速（原始速率的倍数）
    segments: 128 // 增加分段数，使圆形更平滑
  })
}

// 创建多边形扩散围栏效果
const toCreatePolygonDiffusionFence = () => {
  polygonDiffuseFence({
    id: 'polygon_diffusion_001',
    color: '#E81224', // 涟漪颜色
    speed: 5, // 倍速（原始速率的倍数）
    positions: [
      [117.228433, 31.703159, 0],  // 起点
      [117.215433, 31.714159, 0],  // 左顶点
      [117.220433, 31.718159, 0],  // 左下方
      [117.225433, 31.723859, 0],  // 下顶点
      [117.232433, 31.718159, 0],  // 右下方
      [117.235433, 31.708159, 0],  // 右上方
      [117.230433, 31.705159, 0],  // 右侧中间
      [117.228433, 31.703159, 0],  // 闭合回到起点
    ],
    height: 800, // 最大扩散高度（米）
  })
}

// 创建火焰围栏效果
const toCreateFenceFlowEffect = () => {
  fenceFlowEffect({
    id: 'fence_flow_effect_001',
    positions: [
      // 多边形顶点坐标 - 可根据需要调整
      [117.228433, 31.703159, 0],  // 起点
      [117.230433, 31.708159, 0],  // 右上
      [117.238433, 31.710159, 0],  // 右顶点
      [117.230433, 31.712159, 0],  // 右下
      [117.228433, 31.717159, 0],  // 下顶点
      [117.226433, 31.712159, 0],  // 左下
      [117.218433, 31.710159, 0],  // 左顶点
      [117.226433, 31.708159, 0],  // 左上
      [117.228433, 31.703159, 0]   // 闭合回到起点
    ],
    color: '#E81224', // 火焰颜色
    speed: 1.0, // 火焰上升速度
    maxHeight: 900, // 火焰最大高度（米）
  }) 
}

// 创建圆锥体特效
let conicalTimer: number | null = null;
let currentHeading = 45;
let currentPitch = 190;
let coneIds: string[] = [];

const toCreateConicalEffect = () => {
  // 如果已有定时器，先清除
  if (conicalTimer) {
    clearInterval(conicalTimer);
    conicalTimer = null;
  }

  // 清除之前创建的所有圆锥
  clearAllCones();

  // 创建2000个圆锥体
  const centerLng = 117.229619;
  const centerLat = 31.726288;
  const maxOffset = 0.2; // 最大经纬度偏移
  const totalCones = 1;

  for (let i = 0; i < totalCones; i++) {
    // 生成随机位置（在中心点周围均匀分布）
    const angle = (i / totalCones) * Math.PI * 2;
    const distance = Math.random() * maxOffset;
    const lng = centerLng + Math.cos(angle) * distance;
    const lat = centerLat + Math.sin(angle) * distance;
    
    const coneId = `conical_wave_${i}`;
    coneIds.push(coneId);

    conicalWave({
      id: coneId,
      positions: [lng, lat, 0], // 圆锥体底部位置
      heading: currentHeading + (i % 360), // 初始角度略有不同
      pitch: currentPitch, // 初始俯仰角度
      length: 5000, // 波长（米）
      bottomRadius: 500, // 底部半径（米）
      thickness: 0.1, // 厚度（米）
      color: '#00FFFF', // 半透明青色
    });
  }

  // 设置定时器，每秒更新一次heading、pitch和length
  conicalTimer = setInterval(() => {
    // 更新heading和pitch值
    currentHeading += 5; // 每秒增加5度
    currentPitch += 2; // 每秒增加2度
    // 限制pitch值在合理范围内
    if (currentPitch > 360) {
      currentPitch -= 360;
    }

    // 更新所有圆锥体的姿态和长度
    coneIds.forEach((id, index) => {
      updateConePose({
        id,
        heading: currentHeading + (index % 360),
        pitch: currentPitch,
      });
    });

  }, 1000) as unknown as number;
}

// 更新所有圆锥体高度
const toUpdateConicalEffect = () => {
  updateConeLengthOrPosition({
    id: `conical_wave_0`,
    length: 15000,
    // positions: [117.229619, 31.706288, 0],
  });
}

// 清除所有圆锥体
const clearAllCones = () => {
  const map = mapStore.getMap();
  if (map) {
    coneIds.forEach(id => {
      const primitive = mapStore.getGraphicMap(id);
      if (primitive) {
        // 从场景中移除primitive
        map.scene.primitives.remove(primitive);
        // 从mapStore中移除
        mapStore.removeGraphicMap(id);
      }
    });
  }
  coneIds = [];
}

// 创建四棱锥特效
let rectangularPyramidTimer: number | null = null;
let currentPyramidHeading = 0;
let currentPyramidPitch = 120;
let pyramidIds: string[] = [];

const toCreateRectangularPyramidEffect = () => {
  // 如果已有定时器，先清除
  if (rectangularPyramidTimer) {
    clearInterval(rectangularPyramidTimer);
    rectangularPyramidTimer = null;
  }

  // 清除之前创建的所有四棱锥
  clearAllRectangularPyramids();

  // 创建四棱锥
  const centerLng = 117.228433;
  const centerLat = 31.703159;

  // 设置定时器，每秒更新一次heading和pitch
  rectangularPyramidTimer = setInterval(() => {
    // 更新heading和pitch值
    currentPyramidHeading += 5; // 每秒增加5度
    currentPyramidPitch += 2; // 每秒增加2度
    // 限制pitch值在合理范围内
    if (currentPyramidPitch > 360) {
      currentPyramidPitch -= 360;
    }

    // 创建四棱锥
    rectangularPyramidWave({
      id: 'rectangular_pyramid_wave_001',
      positions: [centerLng, centerLat, 0],
      heading: currentPyramidHeading,
      pitch: currentPyramidPitch,
      height: 5000, // 四棱锥高度（米）
      horizontalAngle: 20, // 水平展开角度（度）
      verticalAngle: 15, // 垂直展开角度（度）
      color: 'rgba(0,255,0,0.4)',
    });

    // 更新所有四棱锥的姿态
    updateRectangularPyramidWavePose({
      id: `rectangular_pyramid_wave_001`,
      heading: currentPyramidHeading + (1 % 360),
      pitch: currentPyramidPitch,
    });

  }, 1000) as unknown as number;
}

// 更新四棱锥高度
const toUpdateRectangularPyramidEffect = () => {
  updateRectangularPyramidLengthOrPosition({
    id: `rectangular_pyramid_wave_001`,
    height: 15000,
    // positions: [117.228033, 31.683159, 0],
  });
}

// 清除所有四棱锥
const clearAllRectangularPyramids = () => {
  const map = mapStore.getMap();
  if (map) {
    pyramidIds.forEach(id => {
      const primitive = mapStore.getGraphicMap(id);
      if (primitive) {
        // 从场景中移除primitive
        map.scene.primitives.remove(primitive);
        // 从mapStore中移除
        mapStore.removeGraphicMap(id);
      }
    });
  }
  pyramidIds = [];
}

onBeforeUnmount(() => {
  // 组件卸载时清除定时器和所有几何体
  if (conicalTimer) {
    clearInterval(conicalTimer);
    conicalTimer = null;
  }
  clearAllCones();
  
  if (rectangularPyramidTimer) {
    clearInterval(rectangularPyramidTimer);
    rectangularPyramidTimer = null;
  }
  clearAllRectangularPyramids();
})

const { 
  setPointEntityByImg, 
  setPointPrimitiveByImg,
  setBatchPointsByImg,
  setPointByGlb,
} = setPoint(process.env.BASE_URL)

const {
  movePoint,
  moveDronePoint,
} = movePointConfig(process.env.BASE_URL)

const {
  setHemisphere,
  updateHemisphere,
  removeHemisphere,
  moveHemisphere,
} = hemisphereConfig()

const {
  configureClock,
  replayDronePath
} = setReplay(process.env.BASE_URL)

const {
  singleDiffusion,
  multiDiffusion,
  removeDiffusion,
  circleScanImage,
  scanning
} = diffusionConfig()

const {
  polygonFence,
  circleFence,
  fenceFlowEffect,
  circleDiffuseFence,
  polygonDiffuseFence
} = fenceConfig()

const {
  conicalWave,
  updateConePose,
  updateConeLengthOrPosition,
  rectangularPyramidWave,
  updateRectangularPyramidWavePose,
  updateRectangularPyramidLengthOrPosition
} = geometryConfig()
</script>

<style scoped lang="less">
.map-status-indicator {
  position: absolute;
  top: 10px;
  left: 10px;
  background: linear-gradient(135deg, #0a192f 0%, #172a45 100%);
  color: #64ffda;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 1000;
  border: 1px solid rgba(100, 255, 218, 0.3);
  backdrop-filter: blur(5px);
}

.map-controls {
  position: absolute !important;
  top: 60px !important;
  left: 10px !important;
  z-index: 1000 !important;
}

.map-controls .button-group {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  background: rgba(0, 0, 0, 0.8);
  padding: 6px;
  border-radius: 6px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  flex-direction: column;
}

.map-controls .replay-controls {
  margin-top: 6px;
  background: rgba(20, 40, 60, 0.9);
  border-color: rgba(100, 255, 218, 0.3);
}

.map-controls .group-title {
  color: #64ffda;
  font-size: 11px;
  font-weight: 600;
  margin-bottom: 4px;
  text-align: center;
  border-bottom: 1px solid rgba(100, 255, 218, 0.2);
  padding-bottom: 3px;
  width: 100%;
  cursor: pointer;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s ease;
  box-sizing: border-box;
}

.map-controls .group-title:hover {
  background-color: rgba(100, 255, 218, 0.1);
}

.map-controls .toggle-icon {
  font-size: 9px;
  margin-left: 4px;
  color: #64ffda;
}

.map-controls .controls-content {
  display: flex;
  gap: 6px;
  padding-top: 4px;
  flex-direction: column;
  width: 100%;
}

.map-controls .drone-controls {
  margin-top: 6px;
  background: rgba(40, 20, 60, 0.9);
  border-color: rgba(255, 100, 218, 0.3);
}

.map-controls .img-point-controls {
  margin-top: 6px;
  background: rgba(20, 60, 40, 0.9);
  border-color: rgba(100, 255, 150, 0.3);
}

.map-controls .pyramid-controls {
  margin-top: 6px;
  background: rgba(60, 80, 100, 0.95);
  border-color: rgba(150, 255, 255, 0.5);
}

.map-controls .model-controls {
  margin-top: 6px;
  background: rgba(60, 40, 20, 0.9);
  border-color: rgba(255, 200, 100, 0.3);
}

.map-controls .hemisphere-controls {
  margin-top: 6px;
  background: rgba(40, 40, 60, 0.9);
  border-color: rgba(150, 100, 255, 0.3);
}

.map-controls .diffusion-controls {
  margin-top: 6px;
  background: rgba(60, 20, 40, 0.9);
  border-color: rgba(255, 100, 150, 0.3);
}

.map-controls .fence-controls {
  margin-top: 6px;
  background: rgba(60, 40, 20, 0.9); /* 棕色系背景，与模型控制类似 */
  border-color: rgba(255, 200, 100, 0.3); /* 金色边框 */
}

.delete-controls {
  position: absolute !important;
  top: 120px !important;
  left: 10px !important;
  z-index: 1000 !important;
}

.control-btn {
  background: rgba(255, 255, 255, 0.9);
  color: #000000;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 10px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  backdrop-filter: blur(5px);
}

.control-btn:hover {
  background: rgba(255, 255, 255, 1);
  box-shadow: 0 4px 12px rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
  border-color: rgba(255, 255, 255, 0.5);
}

.control-group {
  display: flex;
  gap: 4px;
  align-items: center;
}

.control-input {
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  outline: none;
  font-size: 14px;
  width: 100px;
}

.control-input:focus {
  border-color: rgba(24, 144, 255, 0.9);
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
}

/* 圆圈控制按钮样式 */
.circle-controls {
  position: absolute !important;
  top: 14px !important;
  right: 10px !important;
  z-index: 1000 !important;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 8px;
  padding: 15px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(5px);
}

.circle-controls h3 {
  margin-top: 0;
  margin-bottom: 15px;
  font-size: 16px;
  color: #1890ff;
  text-align: center;
}

.circle-controls h4 {
  margin-top: 12px;
  margin-bottom: 8px;
  font-size: 14px;
  color: #555;
  border-bottom: 1px solid #e8e8e8;
  padding-bottom: 4px;
}

.circle-buttons {
  margin-bottom: 15px;
}

.btn-row {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.btn-row button {
  flex: 1;
  min-width: 100px;
}
</style>
