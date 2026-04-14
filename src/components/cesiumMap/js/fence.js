/**
 * 围栏实体管理模块
 * 
 * 提供在Cesium地图上创建、更新、移动和删除围栏实体的功能
 * 整合了多边形扩散墙效果
 * 
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

  /**
   * 创建多边形扩散涟漪效果
   * 
   * 在指定位置创建一个从中心向外扩散的多边形波纹，类似雷达波或信号涟漪
   * 波纹会逐渐扩大并淡出，支持循环播放
   * 
   * @param {string} options.id 波纹唯一标识
   * @param {number} options.maxHeight 波纹最大扩散高度（米）
   * @param {string} options.color 波纹颜色（CSS颜色字符串）
   * @param {number} [options.speed=1.0] 倍速（原始速率的倍数）
   *   - u_speed = 1.0 → 1倍速（跟随原始千帧速率）
   *   - u_speed = 2.0 → 2倍速（千帧速率的2倍）
   *   - u_speed = 0.5 → 0.5倍速（千帧速率的一半）
   * @param {number[]} [options.polygonPoints] 多边形顶点坐标数组，格式为 [longitude1, latitude1, longitude2, latitude2, ...]
   * @param {number} [options.type=0] 波纹类型
   *   - 0:光环扩散
   *   - 1:扫描线
   *   - 2:涟漪
   *   - 3:粒子
   * @returns {Cesium.Entity|null} 创建的波纹实体，若创建失败则返回null 
   */
  const polygonFence = (options) => {
    const map = mapStore.getMap()
    if (!map) {
      console.error('地图实例不存在')
      return null
    }

    // 检查是否已存在相同ID的扫描效果
    if (mapStore.getGraphicMap(options.id)) {
      console.log(`id: ${options.id} 效果已存在`)
      return null
    }

    if (!options.polygonPoints || options.polygonPoints.length < 6) {
      console.error('必须提供至少3个顶点的多边形坐标');
      return null;
    }

    const primitive = new Cesium.Primitive({
      // 墙体几何实例
      geometryInstances: new Cesium.GeometryInstance({
        geometry: Cesium.WallGeometry.fromConstantHeights({
          positions: Cesium.Cartesian3.fromDegreesArray(options.polygonPoints),
          maximumHeight: options.maxHeight || 1000.0,
          minimumHeight: 0
        })
      }), 
      appearance: new Cesium.MaterialAppearance({
        material: new Cesium.Material({
          fabric: {
            uniforms: {
              u_color: Cesium.Color.fromCssColorString(options.color || '#00ffff').withAlpha(1.0),
              u_time: 0.0, // 时间参数，用于动画效果
              u_speed: options.speed || 1.0, // 倍速参数，影响动画速度
              u_effectType: options.type || 0, // 0:光环扩散, 1:扫描线, 2:涟漪, 3:粒子
              u_intensity: 2.0, // 增加强度使效果更明显
              u_noiseScale: 5.0, // 噪声缩放参数，影响波纹的细节程度
              u_edgeGlow: 0.5, // 增加边缘发光强度
              u_amplitude: 2.0 // 振幅参数
            },
            source: `
              czm_material czm_getMaterial(czm_materialInput materialInput) {
                czm_material material = czm_getDefaultMaterial(materialInput);
                
                vec2 st = materialInput.st;
                float per = fract(u_speed * czm_frameNumber / 1000.0);
                
                vec4 color = u_color;
                
                if (u_effectType < 0.5) {
                  // 效果1：垂直流动的光环
                  float glow = 0.0;
                  for(int i = 0; i < 5; i++) {
                    float phase = float(i) * 0.2;
                    float currentPos = fract(per + phase);
                    float distanceToGlow = abs(st.y - currentPos);
                    glow += exp(-distanceToGlow * 50.0) * (sin(currentPos * 10.0 + u_speed * czm_frameNumber / 50.0) * 0.5 + 0.5);
                  }
                  material.diffuse = color.rgb * 2.0;
                  material.emission = color.rgb * glow * u_intensity;
                  material.alpha = color.a * glow * u_intensity;
                } else if (u_effectType < 1.5) {
                  // 效果2：扫描线效果
                  float scanLine = 1.0 - smoothstep(0.0, 0.1, abs(st.y - per));
                  material.diffuse = color.rgb * scanLine;
                  material.emission = color.rgb * scanLine * 2.0;
                  material.alpha = color.a * scanLine;
                } else if (u_effectType < 2.5) {
                  // 效果3：波浪效果
                  float wave = sin(st.x * 20.0 + u_speed * czm_frameNumber / 50.0) * 0.5 + 0.5;
                  wave *= sin(st.y * 5.0 + u_speed * czm_frameNumber / 100.0) * 0.5 + 0.5;
                  material.diffuse = color.rgb * wave;
                  material.emission = color.rgb * wave * 2.0;
                  material.alpha = color.a * wave;
                } else {
                  // 效果4：粒子流动效果
                  float particles = 0.0;
                  for(int i = 0; i < 30; i++) {
                    float phase = float(i) * 0.033;
                    float particlePos = fract(per + phase);
                    float distanceToParticle = abs(st.y - particlePos);
                    particles += exp(-distanceToParticle * 100.0) * (sin(float(i) + u_speed * czm_frameNumber / 50.0) * 0.5 + 0.5);
                  }
                  material.diffuse = color.rgb;
                  material.emission = color.rgb * particles * u_intensity;
                  material.alpha = color.a * particles * u_intensity;
                }
                
                return material;
              }
            `
          },
          translucent: true,
        }), // 使用自定义材质
        closed: false
      }),
      asynchronous: false
    });

    try {
      // 添加primitive到场景
      map.scene.primitives.add(primitive);
      // 将primitive缓存到graphicMap中
      mapStore.setGraphicMap(options.id, primitive);
      
      return primitive;
    } catch (error) {
      console.error('创建多边形扩散效果失败:', error);
      // 清理资源
      if (primitive) {
        map.scene.primitives.remove(primitive);
      }
      return null;
    }
  }

  /**
   * 创建圆形墙效果
   * @param options - 配置选项
   * @param options.id - 效果的唯一标识符
   * @param options.center - 中心坐标 [经度, 纬度, 高度（可选，默认0）]
   * @param options.maxRadius - 最大半径（米）
   * @param options.maxHeight - 最大高度（米）
   * @param options.color - 颜色字符串（例如 '#00ffff'）
   * @param options.opacity - 初始透明度（可选，默认1.0）
   * @param options.speed - 倍速参数，影响动画速度（可选，默认1.0）
   * @param options.effectType - 效果类型（可选，默认2）：
   *                              0 - 垂直流动光环
   *                              1 - 扫描线
   *                              2 - 波浪效果
   *                              3 - 粒子流动
   * @param options.segments - 圆形的分段数（可选，默认64，影响圆形平滑度和性能）
   * @param options.asynchronous - 是否异步创建（可选，默认false）
   * @returns 成功时返回Primitive实例，失败时返回null
   */
  const circleFence= (options) => {
    const map = mapStore.getMap()
    if (!map) {
      console.error('地图实例不存在')
      return null
    }
    
    // 检查是否已存在相同ID的效果
    if (mapStore.getGraphicMap(options.id)) {
      console.warn(`ID: ${options.id} 的效果已存在，将返回现有实例`)
      return mapStore.getGraphicMap(options.id)
    }
    
    // 参数默认值
    const radius = options.radius;
    const height = options.height;
    const segments = Math.max(8, Math.min(options.segments || 64, 256)); // 限制分段数在8-256之间
    const opacity = options.opacity !== undefined ? options.opacity : 1.0;
    const speed = options.speed || 1.0;
    const asynchronous = options.asynchronous || false; // 是否异步创建，默认false
    
    // 确保墙体贴地显示
    const groundHeight = 0; // 地面高度
    const wallHeight = height; // 墙体高度
    
    // 使用EllipsoidSurfacePrimitive创建圆形墙
    const circlePositions = [];
    
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const lat = options.center[1] + (radius / 111320) * Math.sin(angle); // 纬度偏移
      const lon = options.center[0] + (radius / (111320 * Math.cos(options.center[1] * Math.PI / 180))) * Math.cos(angle); // 经度偏移
      
      // 使用贴地高度
      circlePositions.push(Cesium.Cartesian3.fromDegrees(lon, lat, groundHeight));
    }

    try {
      // 创建火焰燃烧材质
      const material = new Cesium.Material({
        fabric: {
          uniforms: {
            u_color: Cesium.Color.fromCssColorString(options.color).withAlpha(opacity),
            u_speed: speed,
            u_maxHeight: height,
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
      });
      
      // 创建Primitive
      const primitive = new Cesium.Primitive({
        // 使用WallGeometry创建圆形墙（只显示侧面）
        geometryInstances: new Cesium.GeometryInstance({
          geometry: new Cesium.WallGeometry({
            positions: circlePositions,
            maximumHeights: new Array(circlePositions.length).fill(groundHeight + wallHeight),
            minimumHeights: new Array(circlePositions.length).fill(groundHeight)
          })
        }),
        appearance: new Cesium.MaterialAppearance({
          material: material,
          translucent: true,
          closed: false
        }),
        asynchronous: asynchronous
      });
      
      // 添加primitive到场景
      map.scene.primitives.add(primitive);
      // 将primitive缓存到graphicMap中
      mapStore.setGraphicMap(options.id, primitive);
      return primitive;
    } catch (error) {
      console.error('创建圆形墙效果失败:', error);
      return null;
    }
  }

  /**
   * 创建火焰围栏效果
   * @param options 
   * @param options.id 效果唯一标识符
   * @param options.positions 围栏路径点数组，每个点为 [lng, lat, height] 格式
   * @param options.color 可选，火焰颜色，默认 '#FF6600'
   * @param options.speed 可选，火焰移动速度，默认 1.0
   * @param options.width 可选，围栏宽度，默认 10.0
   * @param options.maxHeight 可选，最大高度，默认 100.0
   * @returns 
   */
  const fenceFlowEffect = (options) => {
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
   * 创建墙体多边形扩散效果
   * @param fenceId 围栏唯一标识
   * @param positions 围栏位置坐标数组
   * @param options 配置选项
   * @returns 创建是否成功
   */
  const circleDiffuseFence = (options) => {
    const map = mapStore.getMap()
    
    if (!map) {
      console.error('地图实例不存在')
      return null
    }

    // 检查是否已存在相同ID的效果
    if (mapStore.getGraphicMap(options.id)) {
      console.warn(`ID: ${options.id} 的扩散墙效果已存在`)
      return null
    }

    // 参数默认值
    const center = options.center || [0, 0, 0]
    const radius = options.radius || 1000.0
    const height = options.height || 100.0
    const color = options.color || '#FFFF00'
    const opacity = options.opacity !== undefined ? options.opacity : 1.0
    const speed = options.speed || 5.0
    const segments = Math.max(3, options.segments || 64)
    const minRadius = options.minRadius || 10

    // 当前扩散状态
    let currentRadius = minRadius
    let currentHeight = height

    /**
     * 获取当前多边形的节点位置和高度
     * @param {number[]} centerPoint 中心点坐标
     * @param {number} edge 多边形边数
     * @param {number} currentRadius 当前半径
     * @param {number} currentHeight 当前高度
     * @returns {Cesium.Cartesian3[]} 多边形节点位置数组
     */
    const getPositions = (centerPoint, edge, currentRadius, currentHeight) => {
      const positions = []
      const modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(
        Cesium.Cartesian3.fromDegrees(centerPoint[0], centerPoint[1], 0)
      )
      
      for (let i = 0; i < edge; i++) {
        const angle = (i / edge) * Cesium.Math.TWO_PI
        const x = Math.cos(angle)
        const y = Math.sin(angle)
        const point = new Cesium.Cartesian3(
          x * currentRadius,
          y * currentRadius,
          currentHeight
        )
        positions.push(
          Cesium.Matrix4.multiplyByPoint(
            modelMatrix,
            point,
            new Cesium.Cartesian3()
          )
        )
      }
      
      // 封闭墙，首节点需要存两次
      positions.push(positions[0])
      return positions
    }

    try {
      // 创建初始的墙体几何
      const createWallGeometry = () => {
        const positions = getPositions(center, segments, currentRadius, currentHeight)
        return new Cesium.WallGeometry({
          positions: positions,
          maximumHeights: new Array(positions.length).fill(currentHeight),
          minimumHeights: new Array(positions.length).fill(0)
        })
      }

      // 创建可更新的引用对象
      const effectRef = {
        primitive: null,
        updateEvent: null,
        isDestroyed: false,
        currentRadius: () => currentRadius,
        currentHeight: () => currentHeight
      }

      // 创建并添加Primitive到场景的函数
      const createAndAddPrimitive = () => {
        // 检查是否已被销毁
        if (effectRef.isDestroyed) {
          return
        }
        
        try {      
          // 创建新的Primitive
          const newPrimitive = new Cesium.Primitive({
            geometryInstances: new Cesium.GeometryInstance({
              geometry: createWallGeometry()
            }),
            appearance: new Cesium.MaterialAppearance({
              material: new Cesium.Material({
                fabric: {
                  uniforms: {
                    u_color: Cesium.Color.fromCssColorString(color).withAlpha(opacity),
                    u_speed: speed,
                    u_time: 0.0
                  },
                  source: `
                    uniform vec4 u_color;
                    uniform float u_speed;
                    uniform float u_time;
                    
                    czm_material czm_getMaterial(czm_materialInput materialInput){
                      czm_material material = czm_getDefaultMaterial(materialInput);
                      vec2 st = materialInput.st;
                      material.diffuse = u_color.rgb * 2.0;
                      material.alpha = u_color.a * (1.0-fract(st.t)) * 0.8;
                      return material;
                    }
                  `
                },
                translucent: true
              }),
              translucent: true,
              closed: false
            }),
            asynchronous: false
          })
          
          // 添加到场景
          map.scene.primitives.add(newPrimitive)
          
          // 移除旧的Primitive
          if (effectRef.primitive) {
            try {
              // 安全检查：确保primitive仍然存在于场景中
              const isPrimitiveInScene = map.scene.primitives.contains(effectRef.primitive)
              
              // 只从场景中移除存在的primitive
              if (isPrimitiveInScene) {
                map.scene.primitives.remove(effectRef.primitive)
              }
              
              // 检查对象是否已被销毁，避免重复销毁
              if (typeof effectRef.primitive.isDestroyed === 'function' && !effectRef.primitive.isDestroyed()) {
                effectRef.primitive.destroy()
              }
            } catch (destroyError) {
              // 如果操作失败（比如对象已经被销毁），忽略错误
              console.error('移除或销毁旧Primitive时出错:', destroyError)
            }
          }
          
          // 更新引用
          effectRef.primitive = newPrimitive
        } catch (error) {
          console.error('更新Primitive失败:', error)
        }
      }

      // 创建初始Primitive
      createAndAddPrimitive()

      // 创建时间监听
      effectRef.updateEvent = map.clock.onTick.addEventListener(() => {
        // 检查是否已被销毁
        if (effectRef.isDestroyed) {
          return
        }
        
        // 更新扩散状态
        currentRadius += (radius * speed) / 1000.0
        currentHeight -= (height * speed) / 1000.0

        // 判断扩散的实际半径和高度是否超出范围
        if (currentRadius > radius || currentHeight < 0) {
          currentRadius = minRadius
          currentHeight = height
        }

        // 重新创建Primitive
        createAndAddPrimitive()
      })

      // 将引用对象缓存到graphicMap中
      mapStore.setGraphicMap(options.id, effectRef)
      
      console.log('多边形扩散墙效果(Primitive版)创建成功')
      return effectRef.primitive
    } catch (error) {
      console.error('创建多边形扩散墙效果(Primitive版)失败:', error)
      return null
    }
  }

  /**
   * 创建多边形扩散墙效果
   * @param options 配置选项
   * @returns 创建的效果实例
   */
  const polygonDiffuseFence = (options) => {
    const map = mapStore.getMap()
    
    if (!map) {
      console.error('地图实例不存在')
      return null
    }

    // 检查是否已存在相同ID的效果
    if (mapStore.getGraphicMap(options.id)) {
      console.warn(`ID: ${options.id} 的多边形扩散效果已存在`)
      return null
    }

    // 参数默认值
    const positions = options.positions || []
    const height = options.height || 100.0
    const color = options.color || '#FFFF00'
    const opacity = options.opacity !== undefined ? options.opacity : 1.0
    const speed = options.speed || 5.0

    // 验证positions参数
    if (!Array.isArray(positions) || positions.length < 3) {
      console.error('多边形顶点数量不足，至少需要3个顶点')
      return null
    }

    // 当前扩散状态 - 从0开始，实现从中心点扩散效果
    let currentRadius = 0
    let currentHeight = height

    // 计算多边形中心点
    const center = positions.reduce((sum, pos) => {
      return [sum[0] + pos[0], sum[1] + pos[1]]
    }, [0, 0])
    center[0] /= positions.length
    center[1] /= positions.length

    // 计算最大扩散半径（从中心到最远顶点的距离）
    const maxRadius = Math.max(...positions.map(pos => {
      const dx = pos[0] - center[0]
      const dy = pos[1] - center[1]
      // 将经纬度差值转换为大致的米数（1度约等于111km）
      return Math.sqrt(dx * dx + dy * dy) * 111000
    }))

    /**
     * 获取扩散后的多边形节点位置和高度
     * @param basePositions 基础多边形顶点坐标
     * @param currentRadius 当前扩散半径
     * @param currentHeight 当前高度
     * @returns 扩散后的多边形节点位置数组
     */
    const getDiffusePositions = (basePositions, currentRadius, currentHeight) => {
      const diffusePositions = []
      
      // 创建中心的笛卡尔坐标
      const centerCartesian = Cesium.Cartesian3.fromDegrees(center[0], center[1], currentHeight)

      // 如果当前半径为0或非常小，返回中心点（创建一个极小的多边形）
      if (currentRadius < 1) {
        // 创建一个极小的正方形，以中心点为中心
        const tinyOffset = 0.0000001 // 极小的经纬度偏移
        diffusePositions.push(Cesium.Cartesian3.fromDegrees(center[0] - tinyOffset, center[1] - tinyOffset, currentHeight))
        diffusePositions.push(Cesium.Cartesian3.fromDegrees(center[0] + tinyOffset, center[1] - tinyOffset, currentHeight))
        diffusePositions.push(Cesium.Cartesian3.fromDegrees(center[0] + tinyOffset, center[1] + tinyOffset, currentHeight))
        diffusePositions.push(Cesium.Cartesian3.fromDegrees(center[0] - tinyOffset, center[1] + tinyOffset, currentHeight))
        diffusePositions.push(diffusePositions[0]) // 封闭多边形
        return diffusePositions
      }

      // 计算每个顶点的扩散位置
      for (const pos of basePositions) {
        // 创建原始顶点的笛卡尔坐标
        const originalCartesian = Cesium.Cartesian3.fromDegrees(pos[0], pos[1], currentHeight)
        
        // 计算从中心到原始顶点的向量
        const vector = Cesium.Cartesian3.subtract(originalCartesian, centerCartesian, new Cesium.Cartesian3())
        const originalDistance = Cesium.Cartesian3.magnitude(vector)
        
        // 如果当前扩散半径小于原始顶点到中心的距离，按比例计算扩散位置
        // 如果当前扩散半径大于等于原始距离，使用原始顶点位置
        const scaleFactor = Math.min(currentRadius / originalDistance, 1.0)
        Cesium.Cartesian3.normalize(vector, vector)
        
        // 计算扩散后的位置
        const offset = Cesium.Cartesian3.multiplyByScalar(vector, originalDistance * scaleFactor, new Cesium.Cartesian3())
        const newPosition = Cesium.Cartesian3.add(centerCartesian, offset, new Cesium.Cartesian3())
        
        diffusePositions.push(newPosition)
      }
      
      // 封闭多边形，首节点需要存两次
      diffusePositions.push(diffusePositions[0])
      return diffusePositions
    }

      try {
        // 创建初始的墙体几何
        const createWallGeometry = () => {
          const diffusePositions = getDiffusePositions(positions, currentRadius, currentHeight)
          
          // 确保位置数组有足够的元素
          if (diffusePositions.length < 5) { // 至少需要5个点（4个顶点+1个闭合点）
            console.error('位置数组长度不足，无法创建墙体几何')
            return null
          }
          
          try {
            // 使用WallGeometry创建空心多边形边框
            return new Cesium.WallGeometry({
              positions: diffusePositions,
              maximumHeights: new Array(diffusePositions.length).fill(currentHeight),
              minimumHeights: new Array(diffusePositions.length).fill(0),
              vertexFormat: Cesium.VertexFormat.POSITION_AND_ST
            })
          } catch (error) {
            console.error('创建几何图形失败:', error)
            return null
          }
        }

      // 创建可更新的引用对象
      const effectRef = {
        primitive: null,
        updateEvent: null,
        isDestroyed: false,
        currentRadius: () => currentRadius,
        currentHeight: () => currentHeight
      }

      // 创建并添加Primitive到场景的函数
      const createAndAddPrimitive = () => {
        // 检查是否已被销毁
        if (effectRef.isDestroyed) {
          return
        }
        
        try {
          // 创建新的Primitive
          const newPrimitive = new Cesium.Primitive({
            geometryInstances: new Cesium.GeometryInstance({
              geometry: createWallGeometry()
            }),
            appearance: new Cesium.MaterialAppearance({
              material: new Cesium.Material({
                fabric: {
                  uniforms: {
                    u_color: Cesium.Color.fromCssColorString(color).withAlpha(opacity),
                    u_speed: speed,
                    u_time: 0.0
                  },
                  source: `
                    uniform vec4 u_color;
                    uniform float u_speed;
                    uniform float u_time;
                    
                    czm_material czm_getMaterial(czm_materialInput materialInput){
                      czm_material material = czm_getDefaultMaterial(materialInput);
                      vec2 st = materialInput.st;
                      material.diffuse = u_color.rgb * 2.0;
                      material.alpha = u_color.a * (1.0-fract(st.t)) * 0.8;
                      return material;
                    }
                  `
                },
                translucent: true
              }),
              translucent: true,
              closed: false
            }),
            asynchronous: false
          })
          
          // 添加到场景
          map.scene.primitives.add(newPrimitive)
          
          // 移除旧的Primitive
          if (effectRef.primitive) {
            try {
              // 安全检查：确保primitive仍然存在于场景中
              const isPrimitiveInScene = map.scene.primitives.contains(effectRef.primitive)
              
              // 只从场景中移除存在的primitive
              if (isPrimitiveInScene) {
                map.scene.primitives.remove(effectRef.primitive)
              }
              
              // 检查对象是否已被销毁，避免重复销毁
              if (typeof effectRef.primitive.isDestroyed === 'function' && !effectRef.primitive.isDestroyed()) {
                effectRef.primitive.destroy()
              }
            } catch (destroyError) {
              // 如果操作失败（比如对象已经被销毁），忽略错误
              console.error('移除或销毁旧Primitive时出错:', destroyError)
            }
          }
          
          // 更新引用
          effectRef.primitive = newPrimitive
        } catch (error) {
          console.error('更新Primitive失败:', error)
        }
      }

      // 创建初始Primitive
      createAndAddPrimitive()

      // 创建时间监听
      effectRef.updateEvent = map.clock.onTick.addEventListener(() => {
        // 检查是否已被销毁
        if (effectRef.isDestroyed) {
          return
        }
        
        // 更新扩散状态 - 只增加半径，不改变高度
        currentRadius += speed
        
        // 判断扩散是否超出最大半径
        if (currentRadius > maxRadius * 1.2) { // 超出最大半径20%后重置
          currentRadius = 0
        }

        // 重新创建Primitive
        createAndAddPrimitive()
      })

      // 将引用对象缓存到graphicMap中
      mapStore.setGraphicMap(options.id, effectRef)
      
      console.log('多边形扩散效果(Primitive版)创建成功')
      return effectRef.primitive
    } catch (error) {
      console.error('创建多边形扩散效果(Primitive版)失败:', error)
      return null
    }
  }

  return {
    polygonFence,
    circleFence,
    fenceFlowEffect,
    circleDiffuseFence,
    polygonDiffuseFence
  }
}