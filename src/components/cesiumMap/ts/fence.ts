/**
 * 围栏实体管理模块
 * 
 * 提供在Cesium地图上创建、更新、移动和删除围栏实体的功能
 * 
 * @module FenceManager
 * @author huweili
 * @email czxyhuweili@163.com
 * @version 1.0.0
 * @date 2025-12-22
 */
import * as Cesium from 'cesium'
import { useMapStore } from '@/stores/modules/mapStore'

export function fenceConfig() {

  // 获取地图store实例
  const mapStore = useMapStore()

  const fenceFlowEffect = (options: {
    id: string,
    positions: number[][], // [lng, lat, height][]
    color?: string,
    speed?: number,
    width?: number,
    maxHeight?: number,
  }) => {
    const map = mapStore.getMap()
    if (!map) {
      console.error('地图实例不存在')
      return null
    }

    // 检查是否已存在相同ID的效果
    if (mapStore.getGraphicMap(options.id)) {
      console.log(`id: ${options.id} 效果已存在`)
      return null
    }

    // 确保至少有两个点
    if (!options.positions || options.positions.length < 2) {
      console.error('围栏效果需要至少两个点')
      return null
    }

    const maxHeight = options.maxHeight || 100;
    const speed = options.speed || 1.0;
    
    try {
      // 提取坐标
      const coordinates = options.positions.map(pos => [pos[0], pos[1], pos[2] || 0])
      const flattenedCoords = coordinates.flat()
      
      // 创建动态高度的壁面几何
      const wallGeometry = new Cesium.WallGeometry({
        positions: Cesium.Cartesian3.fromDegreesArrayHeights(flattenedCoords),
        minimumHeights: new Array(coordinates.length).fill(0),
        maximumHeights: new Array(coordinates.length).fill(maxHeight),
      })
      
      // 创建火焰燃烧材质
      const material = new Cesium.Material({
        fabric: {
          uniforms: {
            u_color: Cesium.Color.fromCssColorString(options.color || '#FF6600').withAlpha(0.9),
            u_speed: speed,
            u_maxHeight: maxHeight,
            u_time: 0.0
          },
          source: `
          uniform vec4 u_color;
          uniform float u_speed;
          uniform float u_maxHeight;
          uniform float u_time;
          
          // 简单的噪声函数，用于模拟火焰的随机性
          float noise(vec2 st) {
            return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
          }
          
          // 分形噪声，用于更自然的火焰效果
          float fbm(vec2 st) {
            float value = 0.0;
            float amplitude = 0.5;
            float frequency = 1.0;
            
            for(int i = 0; i < 5; i++) {
              value += amplitude * noise(st * frequency);
              frequency *= 2.0;
              amplitude *= 0.5;
            }
            
            return value;
          }
          
          czm_material czm_getMaterial(czm_materialInput materialInput)
          {
            czm_material material = czm_getDefaultMaterial(materialInput);
            vec2 st = materialInput.st;
            
            // 使用czm_frameNumber驱动动画
            float time = czm_frameNumber * 0.005 * u_speed;
            
            // 计算火焰上升的高度
            float flameHeight = fract(time);
            
            // 火焰形状 - 底部宽，顶部窄
            float flameShape = st.t * (1.0 - st.t * 0.5);
            
            // 创建火焰效果
            float flame = 0.0;
            if (st.t < flameHeight) {
              // 添加噪声使火焰更自然
              vec2 noiseSt = vec2(st.s * 5.0 + time * 0.5, st.t * 2.0 - time);
              float noiseValue = fbm(noiseSt);
              
              // 火焰强度随高度变化
              float intensity = 1.0 - (st.t / flameHeight);
              intensity = pow(intensity, 2.0);
              
              // 火焰边缘模糊
              float edge = smoothstep(0.8, 1.0, noiseValue);
              flame = intensity * (1.0 - edge);
            }
            
            // 火焰颜色变化 - 底部红色，顶部黄色
            vec3 flameColor = mix(vec3(1.0, 0.2, 0.0), vec3(1.0, 1.0, 0.3), st.t);
            
            // 混合基础颜色和火焰颜色
            vec3 finalColor = mix(u_color.rgb, flameColor, flame * 0.7);
            
            // 添加发光效果
            material.emission = finalColor * flame * 2.0;
            material.diffuse = finalColor;
            material.alpha = flame * u_color.a;
            
            return material;
          }
        `
        },
        translucent: true
      })

      // 创建primitive
      const primitive = new Cesium.Primitive({
        geometryInstances: new Cesium.GeometryInstance({
          geometry: wallGeometry
        }),
        appearance: new Cesium.MaterialAppearance({
          material: material,
          translucent: true,
          closed: false
        }),
        asynchronous: false
      })

      // 添加到场景
      map.scene.primitives.add(primitive)
      // 存储primitive
      mapStore.setGraphicMap(options.id, primitive)
      
      console.log('火焰围栏效果创建成功，位置数量：', options.positions.length, '最大高度：', maxHeight, '米')
      return primitive
    } catch (error) {
      console.error('火焰围栏效果创建失败:', error)
      return null;
    }
  }

  /**
   * 圆锥体特效
   * @param options 
   * @returns 
   */
  const conicalEffect = (options:  {
    id: string,
    positions: number[], // [lng, lat, height]
    color?: string,
    height?: number, // 圆锥体高度
    radius?: number, // 圆锥体底部半径
    heading?: number, // 圆锥体指向方向（弧度）
    pitch?: number, // 圆锥体俯仰角度（弧度）
  }) => {
    const map = mapStore.getMap()
    if (!map) {
      console.error('地图实例不存在')
      return null
    }

    // 检查是否已存在相同ID的效果
    if (mapStore.getGraphicMap(options.id)) {
      console.log(`id: ${options.id} 效果已存在`)
      return null
    }

    // 确保位置参数有效
    if (!options.positions || options.positions.length < 3) {
      console.error('圆锥体效果需要有效的位置参数 [lng, lat, height]')
      return null
    }

    try {
      // 提取位置参数
      const [lng, lat, height] = options.positions;
      const conicalHeight = options.height || 200; // 圆锥体高度默认200米
      const conicalRadius = options.radius || 50; // 圆锥体底部半径默认50米
      
      // 计算圆锥体的底部和顶部位置
      const center = Cesium.Cartesian3.fromDegrees(lng, lat, height);
      const top = Cesium.Cartesian3.fromDegrees(lng, lat, height + conicalHeight);
      
      // 创建圆锥体几何 - 使用CylinderGeometry创建圆锥体（顶部半径为0）
      const cylinderGeometry = new Cesium.CylinderGeometry({
        length: conicalHeight,
        topRadius: 0.0, // 顶部半径为0，形成圆锥
        bottomRadius: conicalRadius,
        slices: 64, // 增加切片数，使圆锥更平滑
        vertexFormat: Cesium.VertexFormat.POSITION_AND_NORMAL
      });
      
      // 获取默认角度
      const heading = options.heading || 0; // 指向方向，默认0（正北）
      const pitch = options.pitch || 0;     // 俯仰角度，默认0（水平）
      const roll = 0;                       // 翻滚角度，默认0
      
      // 圆锥尖端应该位于地面（center位置）
      
      // 1. 创建旋转矩阵，应用heading, pitch, roll（以尖端为原点）
      const hprRotation = Cesium.Transforms.headingPitchRollQuaternion(
        Cesium.Cartesian3.ZERO,
        new Cesium.HeadingPitchRoll(heading, pitch, roll)
      );
      const rotateHPR = Cesium.Matrix4.fromRotationTranslation(
        Cesium.Matrix3.fromQuaternion(hprRotation),
        Cesium.Cartesian3.ZERO
      );
      
      // 2. 创建一个沿X轴的旋转矩阵，将圆锥体从沿X轴方向旋转到沿Z轴方向
      const rotateX = Cesium.Matrix4.fromRotationTranslation(
        Cesium.Matrix3.fromQuaternion(
          Cesium.Quaternion.fromAxisAngle(
            new Cesium.Cartesian3(1, 0, 0), // X轴
            Cesium.Math.PI_OVER_TWO // 旋转90度
          )
        ),
        Cesium.Cartesian3.ZERO
      );
      
      // 3. 创建平移矩阵，将圆锥体沿Z轴向上平移，使其尖端位于原点
      const translateUp = Cesium.Matrix4.fromTranslation(
        new Cesium.Cartesian3(0, 0, -conicalHeight / 2) // 将圆锥体向下平移一半长度
      );
      
      // 4. 创建平移矩阵，将整个圆锥体移动到center位置（地面）
      const translateToGround = Cesium.Matrix4.fromTranslation(center);
      
      // 5. 合并所有变换矩阵：
      // 先调整圆锥体方向，然后平移使其尖端位于原点，最后移到地面位置
      let modelMatrix = Cesium.Matrix4.multiply(rotateX, translateUp, new Cesium.Matrix4());
      modelMatrix = Cesium.Matrix4.multiply(rotateHPR, modelMatrix, new Cesium.Matrix4());
      modelMatrix = Cesium.Matrix4.multiply(translateToGround, modelMatrix, new Cesium.Matrix4());
      
      // 创建半透明材质
      const material = new Cesium.Material({
        fabric: {
          uniforms: {
            color: Cesium.Color.fromCssColorString(options.color || '#00FFFF').withAlpha(0.2),
          },
          source: `
            uniform vec4 color;
            
            czm_material czm_getMaterial(czm_materialInput materialInput)
            {
              czm_material material = czm_getDefaultMaterial(materialInput);
              material.diffuse = color.rgb;
              material.alpha = color.a;
              material.emission = color.rgb * 0.5; // 添加轻微发光效果
              return material;
            }
          `
        },
        translucent: true
      });

      // 创建primitive
      const primitive = new Cesium.Primitive({
        geometryInstances: new Cesium.GeometryInstance({
          geometry: Cesium.CylinderGeometry.createGeometry(cylinderGeometry),
          modelMatrix: modelMatrix
        }),
        appearance: new Cesium.MaterialAppearance({
          material: material,
          translucent: true,
          closed: true
        }),
        asynchronous: false
      });

      // 添加到场景
      map.scene.primitives.add(primitive);
      // 存储primitive
      mapStore.setGraphicMap(options.id, primitive);
      
      console.log('圆锥体效果创建成功，位置：', [lng, lat, height], '高度：', conicalHeight, '米，半径：', conicalRadius, '米')
      return primitive;
    } catch (error) {
      console.error('圆锥体效果创建失败:', error);
      return null;
    }
  }

  return {
    conicalEffect,
    fenceFlowEffect
  }
}