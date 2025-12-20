import * as Cesium from 'cesium'
import { useMapStore } from '@/stores/modules/mapStore'
import { setPoint } from '@/components/cesiumMap/ts/setPoint'
import { movePath } from '@/components/cesiumMap/ts/movePath'

export function move(baseUrl: string) {
  // 获取地图store实例
  const mapStore = useMapStore()
  const {
    setDronePointByGlb,
  } = setPoint(baseUrl)

  const {
    moveDroneTrail,
  } = movePath()

  /**
   * 移动点位到新的坐标位置
   * @param options 配置选项
   * @param options.pointId 点位唯一标识
   * @param options.lng 新的经度
   * @param options.lat 新的纬度
   * @param options.height 高度
   * @param options.heading 方向角度（水平方向）
   * @param options.pitch 俯仰角度
   * @returns 是否移动成功
   * 
   * cesium 中只有部分实体 / 图形支持 orientation（朝向），比如：
   *   ✅ 支持：Cesium3DTileset、Model（3D 模型）、Billboard（带旋转的广告牌）、Entity（通过 orientation 属性）
   *   ❌ 不支持：普通的 PointPrimitive、CircleGraphics、PolylineGraphics 等基础图形（设置 orientation 无任何效果）。
   */
  const movePoint = (options: {
    pointId: string,
    lng: number,
    lat: number,
    height?: number,
    heading?: number,
    pitch?: number,
  }) => {
    // 检查是否存在该点位
    const point = mapStore.getGraphicMap(options.pointId)
    console.log('图形类型：', point.constructor.name)
    if (!point) {
      console.warn(`点位不存在，ID: ${options.pointId}`)
      return false
    }

    // 核心：校验并格式化经纬度/高度，避免 NaN
    const lng = Number(options.lng)
    const lat = Number(options.lat)
    const height = Number(options.height || 0) // 高度默认0

    // 重新计算 position（确保无 NaN）
    const position = Cesium.Cartesian3.fromDegrees(lng, lat, height)
    // 校验 position 是否有效（兜底）
    if (!position || isNaN(position.x) || isNaN(position.y) || isNaN(position.z)) {
      console.error('生成的坐标包含 NaN：', position)
      return false
    }

    // 更新点位位置
    point.position = position
    // 更新朝向（用校验后的 position）
    point.orientation = Cesium.Transforms.headingPitchRollQuaternion(
      position, // 用校验后的有效 position
      new Cesium.HeadingPitchRoll(
        Cesium.Math.toRadians(Number(options.heading) || 0), // 同样校验 heading
        Cesium.Math.toRadians(Number(options.pitch) || 0),   // 校验 pitch
        Cesium.Math.toRadians(0)
      )
    )

    return true
  }

  /**
   * 移动无人机点位到新的坐标位置
   * @param options 配置选项
   * @param options.pointId 点位唯一标识
   * @param options.lng 新的经度
   * @param options.lat 新的纬度
   * @param options.height 高度
   * @param options.speed 速度
   */
  const moveDronePoint = (options: {
    pointId: string;
    lng: number;
    lat: number;
    height?: number;
    speed?: number;
  }) => {
    const map = mapStore.getMap()
    if (!map) {
      console.error('地图实例不存在')
      return null
    }

    // 速度默认值
    const speed = options.speed || 10;
    // 高度默认值
    const height = options.height || 0;

    let modelEntity = mapStore.getGraphicMap(options.pointId);
    if (!modelEntity) {
      console.log(`id: ${options.pointId} 无人机实体不存在，创建新实体`)
      modelEntity = setDronePointByGlb({
        id: options.pointId,
        lng: options.lng,
        lat: options.lat,
        height: height,
        heading: 0
      });
      // 新创建的实体直接返回（首次创建无飞行状态）
      return modelEntity;
    }

    // ========== 核心修复：强制获取无人机实时位置 ==========
    let currentRealPosition: Cesium.Cartesian3;

    // 1. 优先从时钟实时计算当前位置（最准确）
    if (modelEntity.entity && modelEntity.entity.position) {
      currentRealPosition = modelEntity.entity.position.getValue(map.clock.currentTime);
    }

    // 2. 备用方案：从positionProperty获取当前值
    if (!currentRealPosition && modelEntity.positionProperty) {
      currentRealPosition = modelEntity.positionProperty.getValue(map.clock.currentTime);
    }

    // 3. 最后兜底：使用记录的currentPosition（防止空值）
    if (!currentRealPosition && modelEntity.currentPosition) {
      currentRealPosition = modelEntity.currentPosition.clone();
    }

    // 4. 终极兜底：如果都获取不到，使用新目标位置（避免崩溃）
    if (!currentRealPosition) {
      currentRealPosition = Cesium.Cartesian3.fromDegrees(options.lng, options.lat, height);
    }
    // ========== 实时位置获取结束 ==========

    // ========== 保留轨迹 ==========
    // 在飞行开始前，先更新当前点的轨迹
    moveDroneTrail(options.pointId, currentRealPosition)

    // ========== 终止当前所有飞行状态 ==========
    // 1. 移除旧的监听器
    if (modelEntity.flightEndListener) {
      map.clock.onTick.removeEventListener(modelEntity.flightEndListener);
      modelEntity.flightEndListener = null;
    }

    // 2. 重置飞行状态
    modelEntity.isFlying = false;

    // 3. 清空旧的位置采样点（关键：避免旧路径影响）
    if (modelEntity.positionProperty) {
      // 销毁旧的采样属性，创建全新的
      modelEntity.positionProperty = new Cesium.SampledPositionProperty();
      // 立即添加当前实时位置的采样点（锚定当前位置）
      modelEntity.positionProperty.addSample(map.clock.currentTime, currentRealPosition);
      // 更新实体位置属性
      modelEntity.entity.position = modelEntity.positionProperty;
    }
    // ========== 飞行状态重置结束 ==========

    // 计算新目标位置
    const targetPosition = Cesium.Cartesian3.fromDegrees(
      options.lng,
      options.lat,
      height
    );

    // 计算实时距离
    const distance = Cesium.Cartesian3.distance(currentRealPosition, targetPosition);

    // 距离过近则直接定位
    if (distance < 0.1) {
      console.log(`无人机${options.pointId}目标位置与当前位置过于接近（${distance.toFixed(3)}m），直接定位`);
      modelEntity.currentPosition = targetPosition;
      // 强制更新位置到目标点
      modelEntity.positionProperty.addSample(map.clock.currentTime, targetPosition);
      modelEntity.entity.position = modelEntity.positionProperty;

      // 直接更新轨迹
      moveDroneTrail(options.pointId, targetPosition)
      return;
    }

    // ========== 计算新的飞行路径 ==========
    // 飞行时长（秒）
    const flightDuration = distance / speed;
    // 新的飞行结束时间
    const flightEndTime = Cesium.JulianDate.addSeconds(
      map.clock.currentTime,
      flightDuration,
      new Cesium.JulianDate()
    );

    // 确保时钟运行
    if (!map.clock.shouldAnimate) {
      map.clock.shouldAnimate = true;
    }

    // 更新时钟范围
    map.clock.startTime = Cesium.JulianDate.clone(map.clock.currentTime);
    map.clock.stopTime = flightEndTime;
    map.clock.clockRange = Cesium.ClockRange.UNBOUNDED; // UNBOUNDED： 时钟在飞行结束后继续运行； CLAMPED：时钟在飞行结束后停止

    // 添加新的飞行采样点（当前实时位置 → 新目标位置）
    modelEntity.positionProperty.addSample(map.clock.currentTime, currentRealPosition);
    modelEntity.positionProperty.addSample(flightEndTime, targetPosition);

    // 更新飞行状态
    modelEntity.isFlying = true;
    // 记录当前实时位置（供后续使用）
    modelEntity.currentPosition = currentRealPosition.clone();

    // ========== 日志输出（调试用） ==========
    const startCartographic = Cesium.Cartographic.fromCartesian(currentRealPosition);
    console.log(`无人机${options.pointId}新飞行指令（中断旧航线）：`, {
      实时起点经度: Cesium.Math.toDegrees(startCartographic.longitude).toFixed(6),
      实时起点纬度: Cesium.Math.toDegrees(startCartographic.latitude).toFixed(6),
      实时起点高度: startCartographic.height.toFixed(2) + 'm',
      目标经度: options.lng.toFixed(6),
      目标纬度: options.lat.toFixed(6),
      目标高度: height.toFixed(2) + 'm',
      距离: distance.toFixed(2) + 'm',
      速度: speed + 'm/s',
      预计耗时: flightDuration.toFixed(2) + 's'
    });

    // ========== 实时更新轨迹的监听器 ==========
    const updateTrailListener = (clock: Cesium.Clock) => {
      if (!modelEntity.isFlying) return

      // 获取当前飞行中的位置
      const currentPosition = modelEntity.positionProperty.getValue(clock.currentTime)
      if (currentPosition) {
        // 实时更新轨迹
        moveDroneTrail(options.pointId, currentPosition)
      }
    }

    // ========== 新的飞行结束监听器 ==========
    const flightEndListener = (clock: Cesium.Clock) => {
      // 实时更新轨迹
      updateTrailListener(clock)

      if (Cesium.JulianDate.compare(clock.currentTime, flightEndTime) >= 0) {
        // 更新最终位置
        modelEntity.currentPosition = targetPosition;
        modelEntity.isFlying = false;

        // 确保轨迹包含终点
        moveDroneTrail(options.pointId, targetPosition)

        // 永久锚定目标位置（添加远期采样点）
        if (modelEntity.entity && modelEntity.positionProperty) {
          const farFutureTime = Cesium.JulianDate.addSeconds(flightEndTime, 3600, new Cesium.JulianDate());
          modelEntity.positionProperty.addSample(farFutureTime, targetPosition);
        }

        // 移除监听器
        clock.onTick.removeEventListener(flightEndListener);
        clock.onTick.removeEventListener(updateTrailListener)
        modelEntity.flightEndListener = null;
        console.log(`无人机${options.pointId}新航线飞行结束，已锚定目标位置`);
      }
    };

    // 保存监听器引用
    modelEntity.flightEndListener = flightEndListener;
    map.clock.onTick.addEventListener(updateTrailListener)
    map.clock.onTick.addEventListener(flightEndListener);

    // 可选：自动跟随无人机
    // if (map.viewer) map.viewer.trackedEntity = modelEntity.entity;
  };

  return {
    movePoint,
    moveDronePoint,
  }
}
