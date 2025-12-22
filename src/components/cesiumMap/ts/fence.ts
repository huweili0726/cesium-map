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

    let primitive = null;

    try {
      // 提取坐标并生成壁面几何
      const coordinates = options.positions.map(pos => [pos[0], pos[1], pos[2] || 0])
      const flattenedCoords = coordinates.flat()

      // 创建壁面几何 - 增加高度到100米
      const wall = new Cesium.WallGeometry({
        positions: Cesium.Cartesian3.fromDegreesArrayHeights(flattenedCoords),
        minimumHeights: new Array(coordinates.length).fill(0),
        maximumHeights: new Array(coordinates.length).fill(100), // 增加高度到100米
      })

      // 创建流光材质 - 添加动画效果
      const material = new Cesium.Material({
        fabric: {
          uniforms: {
            u_color: Cesium.Color.fromCssColorString(options.color || '#00FFFF').withAlpha(0.8),
            u_speed: options.speed || 1.0,
            u_width: options.width || 0.1,
          },
          source: `
          uniform vec4 u_color;
          uniform float u_speed;
          uniform float u_width;
          
          czm_material czm_getMaterial(czm_materialInput materialInput)
          {
            czm_material material = czm_getDefaultMaterial(materialInput);
            vec2 st = materialInput.st;
            
            // 使用czm_frameNumber驱动动画
            float time = czm_frameNumber * 0.01 * u_speed;
            
            // 创建流光效果
            float flow = fract(st.t - time);
            
            // 流光形状
            float glow = smoothstep(0.0, u_width, flow) - 
                        smoothstep(u_width, 2.0 * u_width, flow);
            
            // 添加边缘发光
            float edgeGlow = smoothstep(0.0, 0.1, st.t) * 
                            smoothstep(1.0, 0.9, st.t);
            
            // 混合效果
            material.diffuse = u_color.rgb;
            material.alpha = u_color.a * (glow * 0.8 + edgeGlow * 0.2);
            
            return material;
          }
        `
        },
        translucent: true
      })

      // 创建primitive
      primitive = new Cesium.Primitive({
        geometryInstances: new Cesium.GeometryInstance({
          geometry: wall
        }),
        appearance: new Cesium.MaterialAppearance({
          material: material,
          translucent: true
        }),
        asynchronous: false
      })

      // 添加到场景
      map.scene.primitives.add(primitive)
      // 存储primitive
      mapStore.setGraphicMap(options.id, primitive)
      
      console.log('围栏流动效果创建成功，位置数量：', options.positions.length, '墙体高度：100米')
      return primitive
    } catch (error) {
      console.error('围栏效果位置转换失败:', error)
      // 清理资源
      if (primitive) {
        map.scene.primitives.remove(primitive);
      }
      return null;
    }

  }

  return {
    fenceFlowEffect
  }
}