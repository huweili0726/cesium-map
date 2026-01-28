/**
 * 点位设置模块
 * 
 * 提供在Cesium地图上设置无人机点位的功能
 * 
 * @author huweili
 * @email czxyhuweili@163.com
 * @version 1.0.0
 * @date 2025-12-29
 */
import * as Cesium from 'cesium'
import html2canvas from 'html2canvas';
import { useMapStore } from '@/stores/modules/mapStore'
import { setPath } from '@/components/cesiumMap/ts/setPath'

export function setPoint(baseUrl: string) {

  // 获取地图store实例
  const mapStore = useMapStore()
  const {
    setDroneTrail,
  } = setPath()

  /**
   * 设置点位 （直接把图片设置成点位）
   * @param options 配置选项
   * @param options.id 点位唯一标识
   * @param options.lng 经度
   * @param options.lat 纬度
   * @returns 创建的点位对象
   * 
   * map.entities.add 理论上能添加上千 / 上万个点位，但不推荐在海量点位场景下使用
   * Entity 是 Cesium 提供的高层级封装 API，为了简化开发，它内部做了大量自动处理（比如属性监听、事件绑定、样式解析），但这也带来了额外开销
   * 
   * Entity 并非完全不能用，以下场景优先选它：
   *   点位数量 ≤ 500：少量点位时，Entity 的 “易用性” 远大于性能损耗；
   *   需要点位绑定复杂逻辑：比如每个点位有独立的点击事件、弹窗、动态样式（如实时变色 / 缩放）；
   *   快速开发验证：Entity 代码简洁，无需关注底层渲染细节，适合原型开发。
   */
  const setPointEntityByImg = (options: { 
    id: string, 
    lng: number, 
    lat: number,
    name?: string
  }) => {
    // 获取地图实例
    const map = mapStore.getMap()
    if (!map) {
      console.error('地图实例不存在')
      return null
    }

    // 检查是否已存在相同id的点位，如果存在直接返回
    if (mapStore.hasGraphicMap(options.id)) {
      console.warn(`点位已存在，ID: ${options.id}`)
      return mapStore.getGraphicMap(options.id)
    }

    // 点位参数配置
    const pointParams = {
      position: Cesium.Cartesian3.fromDegrees(options.lng, options.lat, 0), // 经纬度 + 高度（使用0米高度）
      billboard: {
        image: new URL('@/assets/img/point.png', import.meta.url).href, // 图片路径
        width: 30, // 图片宽度（像素）
        height: 64, // 图片高度（像素）
        scale: 1, // 缩放比例（可选，覆盖宽高）
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM, // 垂直对齐方式（底部对齐点位）
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER, // 水平居中
        clampToGround: true,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, // 贴地显示，固定在地面上
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      // 添加标签：黑底白字显示点位名称
      label: {
        text: options.name || '自定义图片点位', // 使用传入的名称或默认名称
        font: '12px sans-serif', // 字体样式
        fillColor: Cesium.Color.WHITE, // 文字颜色：白色
        outlineColor: Cesium.Color.BLACK, // 文字描边颜色：黑色
        outlineWidth: 2, // 文字描边宽度
        style: Cesium.LabelStyle.FILL_AND_OUTLINE, // 文字样式：填充+描边
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM, // 垂直对齐方式：底部
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER, // 水平对齐方式：居中
        pixelOffset: new Cesium.Cartesian2(0, -70), // 偏移量：在图标上方70像素处
        showBackground: true, // 显示背景
        backgroundColor: new Cesium.Color(0, 0, 0, 0.8), // 背景颜色：黑色，透明度0.8
        backgroundPadding: new Cesium.Cartesian2(5, 3), // 背景内边距：水平5像素，垂直3像素
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, // 贴地显示，固定在地面上
        disableDepthTestDistance: Number.POSITIVE_INFINITY, // 禁用深度测试，确保标签始终在最上层
      },
      // 可选：添加点位名称/描述
      name: options.name || '自定义图片点位',
      description: '<p>这是一个基于图片的 Cesium 点位</p>',
    };

    // 添加到 map 中
    const pointEntity = map.entities.add(pointParams);

    // 将点位缓存到 graphicMap 中，防止重复创建
    mapStore.setGraphicMap(options.id, pointEntity)

    // 可选：相机飞到该点位
    // map.flyTo(pointEntity, {
    //   duration: 2,
    //   offset: new Cesium.HeadingPitchRange(0, -0.5, 1000), // 视角偏移（俯视点位）
    // });

    return pointEntity;
  }

  /**
   * 设置点位 （通过提供的图片设置点位）【Primitive】
   * @param options 点位参数
   * @param options.id 点位id
   * @param options.lng 点位经度
   * @param options.lat 点位纬度
   * @param options.name 点位名称
   * @returns 点位Primitive
   */
/**
 * 设置点位 （通过提供的图片设置点位）【Primitive】
 * @param options 点位参数
 * @param options.id 点位id
 * @param options.lng 点位经度
 * @param options.lat 点位纬度
 * @param options.name 点位名称
 * @returns 点位Primitive
 */
const setPointPrimitiveByImg = async (options: { 
    id: string, 
    lng: number, 
    lat: number,
    name?: string,
    imageUrl: string,
    cssStyle?: string,
}) => {
    // 获取地图实例
    const map = mapStore.getMap()
    if (!map) {
        console.error('地图实例不存在')
        return null
    }

    // 检查是否已存在相同id的点位，如果存在直接返回
    if (mapStore.hasGraphicMap(options.id)) {
        console.warn(`点位已存在，ID: ${options.id}`)
        return mapStore.getGraphicMap(options.id)
    }


    // 1. 【核心】创建内存中的HTML元素（和你原结构完全一致）
    const container = document.createElement('div');
    // 给容器添加原类名，并注入CSS样式（保证样式还原）
    container.className = 'cesium-point-div';
    container.style.position = 'absolute';
    container.style.pointerEvents = 'none';

    // 插入你原有的HTML结构
    container.innerHTML = `
        <div class="cesium-point-body">
            <div class="icon-text">${options.name || '自定义图片点位'}</div>
            <img class="cesium-point-img" src="${options.imageUrl}" />
        </div>
    `;

    // 2. 临时挂载到body，但定位到屏幕外避免影响布局
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    container.style.visibility = 'visible';
    document.body.appendChild(container);
    
    // 等待图片加载完成（避免canvas中图片缺失）
    await new Promise((resolve) => {
        const img = container.querySelector('.cesium-point-img') as HTMLImageElement;
        if (img.complete) resolve(null);
        img.onload = resolve;
        img.onerror = resolve; // 图片加载失败也继续
    });

    // 3. 【核心】用html2canvas将HTML转Canvas
    const canvas = await html2canvas(container, {
        scale: 1, // 2倍分辨率，避免模糊
        useCORS: true, // 解决图片跨域
        allowTaint: true,
        logging: false, // 关闭日志
        width: container.offsetWidth,
        height: container.offsetHeight,
        // ✅ 关键配置：关闭默认白色背景，保留透明
        backgroundColor: null,
        // 可选：进一步确保透明渲染（部分版本需要）
        // foreignObjectRendering: true
    });

    // 4. 移除临时DOM元素
    document.body.removeChild(container);

    // 5. Canvas转纹理URL
    const textureUrl = canvas.toDataURL('image/png');

    // 6. 经纬度转Cesium坐标（贴地）
    const position = Cesium.Cartesian3.fromDegrees(options.lng, options.lat, 0);
    const cartographic = Cesium.Cartographic.fromCartesian(position);
    const terrainHeight = map.scene.globe.getHeight(cartographic) || 0;
    const groundPosition = Cesium.Cartesian3.fromDegrees(options.lng, options.lat, terrainHeight);

    // 7. 创建BillboardCollection和Billboard
    const billboardCollection = new Cesium.BillboardCollection({
        scene: map.scene
    });

    const billboard = billboardCollection.add({
        id: options.id,
        position: groundPosition,
        image: textureUrl, // 使用HTML转的Canvas纹理
        scale: 1,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        show: true,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        // pickable: false // 等效原pointerEvents: none
    });

    // 8. 距离显示条件控制
    const updateShowStatus = () => {
        if (!map) return;
        const cameraHeight = Cesium.Cartographic.fromCartesian(map.camera.position).height;
        const isInRange = cameraHeight >= 0 && cameraHeight <= 500000;
        billboard.show = isInRange;
    };

    // 9. 监听视角变化
    const postRenderListener = map.scene.postRender.addEventListener(updateShowStatus);
    updateShowStatus();

    // 10. 添加到场景
    map.scene.primitives.add(billboardCollection);

    // 11. 销毁方法
    const destroy = () => {
        map.scene.postRender.removeEventListener(postRenderListener);
        map.scene.primitives.remove(billboardCollection);
        billboardCollection.destroy();
    };

    // 返回Primitive对象
    return {
        id: options.id,
        position: groundPosition,
        billboardCollection: billboardCollection,
        billboard: billboard,
        destroy: destroy
    };
};
  /**
   * 批量设置点位 （直接把图片设置成点位, 1万+个点位）【海量点位的最优解：BillboardCollection（批量 Primitive）】
   * @param options 配置选项
   * @param options.id 点位唯一标识
   * @param options.lng 经度
   * @param options.lat 纬度
   * @returns 创建的点位对象
   */
  const setBatchPointsByImg = (options: { 
    lng: number, 
    lat: number,
    name?: string
  }) => {
    const map = mapStore.getMap()
    if (!map) {
      console.error('地图实例不存在')
      return null
    }

    // 1. 先生成点位配置数组
    const billboardOptions = [];
    const baseLon = options.lng;
    const baseLat = options.lat;
    for (let i = 0; i < 10000; i++) {
      billboardOptions.push({
        id: `${i}`,
        position: Cesium.Cartesian3.fromDegrees(
          baseLon + Math.random() * 1,
          baseLat + Math.random() * 1,
          0
        ),
        image: new URL('@/assets/img/point.png', import.meta.url).href,
        width: 30,
        height: 64,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(100, 1000000),
      });
    }

    // 2. 创建空的BillboardCollection和LabelCollection
    const billboardCollection = new Cesium.BillboardCollection({
      scene: map.scene,
      blendOption: Cesium.BlendOption.OPAQUE_AND_TRANSLUCENT,
    });

    const labelCollection = new Cesium.LabelCollection({
      scene: map.scene,
      blendOption: Cesium.BlendOption.OPAQUE_AND_TRANSLUCENT,
    });

    // 3. 循环添加所有点位和标签配置
    billboardOptions.forEach(option => {
      // 检查是否已存在相同id的点位，如果存在直接返回
      if (mapStore.hasGraphicMap(option.id)) {
        console.warn(`点位已存在，ID: ${option.id}`)
        return mapStore.getGraphicMap(option.id)
      }
      
      // 添加billboard
      const billboard = billboardCollection.add(option);
      
      // 添加对应的label
      const label = labelCollection.add({
        position: option.position,
        text: options.name || `点位${option.id}`,
        font: '12px sans-serif',
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        pixelOffset: new Cesium.Cartesian2(0, -70),
        showBackground: true,
        backgroundColor: new Cesium.Color(0, 0, 0, 0.8),
        backgroundPadding: new Cesium.Cartesian2(5, 3),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      });
      
      // 将点位和标签缓存到 graphicMap 中，防止重复创建
      mapStore.setGraphicMap(option.id, {
        billboard,
        label
      });
    });

    // 4. 添加到场景
    map.scene.primitives.add(billboardCollection);
    map.scene.primitives.add(labelCollection);
    
    return {
      billboardCollection,
      labelCollection
    };
  };

  /**
   * 设置点位 （通过提供的glb模型设置点位）
   * @param options 配置选项
   * @param options.id 点位唯一标识
   * @param options.lng 经度
   * @param options.lat 纬度
   * @param options.height 高度（可选，默认0）
   * @param options.heading 朝向（可选，默认0）
   * @returns 创建的点位对象
   */
  const setPointByGlb = (options: { 
    id: string, 
    url: string, 
    lng: number, 
    lat: number, 
    height?: number, 
    heading?: number 
  }) => {
    const map = mapStore.getMap()
    if (!map) {
      console.error('地图实例不存在')
      return null
    }

    // 检查是否已存在相同id的点位，如果存在直接返回
    if (mapStore.hasGraphicMap(options.id)) {
      console.warn(`点位已存在，ID: ${options.id}`)
      return mapStore.getGraphicMap(options.id)
    }

    // 模型实例缓存（用于后续销毁/修改）
    let modelEntity: Cesium.Entity | null = null

    // 创建模型 Entity
    const position = Cesium.Cartesian3.fromDegrees(options.lng, options.lat, options.height)
    const heading = Cesium.Math.toRadians(options.heading || 0)
    const pitch = Cesium.Math.toRadians(0)
    const roll = 0
    const hpr = new Cesium.HeadingPitchRoll(heading, pitch, roll)
    modelEntity = map.entities.add({
      // 模型位置（经纬度转笛卡尔坐标）
      position: Cesium.Cartesian3.fromDegrees(options.lng, options.lat, options.height),
      // 模型朝向/旋转（heading: 水平旋转, pitch: 俯仰, roll: 翻滚）
      orientation: Cesium.Transforms.headingPitchRollQuaternion(position, hpr),
      // GLB 模型核心配置
      model: {
        uri: options.url, // 模型路径（本地/网络）
        scale: 1 || 1, // 缩放比例（根据模型大小调整）
        minimumPixelSize: 80, // 模型最小像素尺寸（避免缩小时消失）
        maximumScale: 20000, // 最大缩放比例
        show: true, // 是否显示
        // 模型颜色（可选，叠加到模型上）
        color: Cesium.Color.WHITE,
        clampToGround: true,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, // 贴地显示，固定在地面上
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      }
    })

    // 将模型缓存到 graphicMap 中，防止重复创建
    mapStore.setGraphicMap(options.id, modelEntity)

    return modelEntity;
  }

  /**
   * 设置无人机点位 （通过提供的无人机 glb模型设置点位）
   * @param options 配置选项
   * @param options.id 点位唯一标识
   * @param options.lng 经度
   * @param options.lat 纬度
   * @param options.height 高度（可选，默认0）
   * @param options.heading 朝向（可选，默认0）
   * @returns 创建的点位对象
   */
  const setDronePointByGlb = (options: { 
    id: string, 
    lng: number, 
    lat: number, 
    height?: number, 
    heading?: number 
  }) => {
    const map = mapStore.getMap()
    if (!map) {
      console.error('地图实例不存在')
      return null
    }

    // 检查是否已存在相同id的点位，如果存在直接返回
    if (mapStore.hasGraphicMap(options.id)) {
      console.warn(`点位已存在，ID: ${options.id}`)
      return mapStore.getGraphicMap(options.id)
    }

    // 模型实例（用于后续销毁/修改）
    let modelEntity: any | null = {
      targetLng: options.lng, // 默认北京经度
      targetLat: options.lat,  // 默认北京纬度
      targetHeight: options.height || 0,   // 默认高度
      speed: 50,           // 默认速度
      entity: null,        // Cesium实体
      positionProperty: null, // 位置属性
      isFlying: false,     // 飞行状态
      currentPosition: null, // 当前位置
      trailEntityId: `${options.id}_trail` // 轨迹实体ID，用于管理独立的轨迹
    }
    modelEntity.entity = map.entities.add({
      id: options.id,
      name: `无人机${options.id}`,
      position: Cesium.Cartesian3.fromDegrees(
        modelEntity.targetLng,
        modelEntity.targetLat,
        modelEntity.targetHeight
      ),
      model: {
        uri: baseUrl + '/glb/drone.glb', // Cesium Ion上的无人机模型ID
        scale: 1.0, // 模型放大3倍
        minimumPixelSize: 80, // 模型最小像素尺寸，确保缩放时可见
        maximumScale: 20000, // 最大缩放比例
        show: true, // 是否显示
        color: Cesium.Color.WHITE,// 模型颜色（可选，叠加到模型上）
      },
      label: {
        text: `无人机: ${options.id}\n高度: ${options.height}米`,
        font: '14px monospace',
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineWidth: 2,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -50),
        fillColor: Cesium.Color.YELLOW,
        showBackground: true,
        backgroundColor: new Cesium.Color(0.1, 0.1, 0.1, 0.7)
      }
    })

    // 记录初始位置
    modelEntity.currentPosition = Cesium.Cartesian3.fromDegrees(
      modelEntity.targetLng,
      modelEntity.targetLat,
      modelEntity.targetHeight || 0
    )

    // 初始化位置属性（用于插值）
    modelEntity.positionProperty = new Cesium.SampledPositionProperty()
    modelEntity.positionProperty.addSample(map.clock.currentTime, modelEntity.currentPosition)
    modelEntity.entity.position = modelEntity.positionProperty

    // 创建独立的轨迹实体
    setDroneTrail(options.id, modelEntity.currentPosition)

    mapStore.setGraphicMap(options.id, modelEntity)
    return modelEntity
  }

  return {
    setPointEntityByImg,
    setPointPrimitiveByImg,
    setBatchPointsByImg,
    setPointByGlb,
    setDronePointByGlb
  }
}