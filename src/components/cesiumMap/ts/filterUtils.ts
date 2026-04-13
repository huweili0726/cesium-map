import * as Cesium from 'cesium'

/**
 * 将十六进制颜色转换为0-1范围的RGB值
 * @param hex 十六进制颜色字符串
 * @returns RGB颜色对象，值范围0-1
 */
export function hexToRgb01(hex: string): { r: number; g: number; b: number } {
  // 移除#号
  const cleanHex = hex.replace('#', '')
  
  // 处理缩写形式（如#FFF）
  const full = cleanHex.length === 3 
    ? cleanHex.split('').map(char => char + char).join('') 
    : cleanHex
  
  return {
    r: parseInt(full.slice(0, 2), 16) / 255,
    g: parseInt(full.slice(2, 4), 16) / 255,
    b: parseInt(full.slice(4, 6), 16) / 255
  }
}

// 存储暗滤镜阶段
let darkFilterStage: Cesium.PostProcessStage | Cesium.PostProcessStageComposite = null

/**
 * 应用CSS风格的暗滤镜效果
 * @param viewer Cesium Viewer实例
 * @param options 滤镜配置选项
 */
export function applyCssLikeDarkFilter(
  viewer: Cesium.Viewer,
  options?: {
    sepiaMix?: number
    saturation?: number
    hueRotate?: number
    contrast?: number
    brightness?: number
    yellowSuppress?: number
    blueTint?: number
    cyanBoost?: number
    shadowBlue?: number
    shadowBlueHex?: string
  }
) {
  // 若已存在则先移除，避免重复叠加导致画面异常
  if (darkFilterStage) {
    viewer.scene.postProcessStages.remove(darkFilterStage)
    darkFilterStage = null
  }

  const shadowBlueRgb = hexToRgb01(options?.shadowBlueHex || '#1a237e')

  darkFilterStage = viewer.scene.postProcessStages.add(
    new Cesium.PostProcessStage({
      name: 'css-like-dark-filter',
      fragmentShader: `
        uniform sampler2D colorTexture;
        in vec2 v_textureCoordinates;
        out vec4 fragColor;

        uniform float u_sepiaMix;
        uniform float u_saturation;
        uniform float u_hueRotate;
        uniform float u_contrast;
        uniform float u_brightness;
        uniform float u_yellowSuppress;
        uniform float u_blueTint;
        uniform float u_cyanBoost;
        uniform float u_shadowBlue;
        uniform vec3 u_shadowBlueRgb;

        vec3 rgb2hsv(vec3 c) {
          vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
          vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
          vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
          float d = q.x - min(q.w, q.y);
          float e = 1e-10;
          return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
        }

        vec3 hsv2rgb(vec3 c) {
          vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
          vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
          return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
        }

        void main() {
          vec4 texColor = texture(colorTexture, v_textureCoordinates);
          vec3 color = texColor.rgb;

          // 1) invert(1)
          color = 1.0 - color;

          // 2) sepia(u_sepiaMix)
          vec3 sepia = vec3(
            dot(color, vec3(0.393, 0.769, 0.189)),
            dot(color, vec3(0.349, 0.686, 0.168)),
            dot(color, vec3(0.272, 0.534, 0.131))
          );
          color = mix(color, sepia, clamp(u_sepiaMix, 0.0, 1.0));

          // 3) saturate(u_saturation)
          float luminance = dot(color, vec3(0.299, 0.587, 0.114));
          vec3 gray = vec3(luminance);
          color = mix(gray, color, max(u_saturation, 0.0));

          // 4) hue-rotate(deg)
          vec3 hsv = rgb2hsv(color);
          hsv.x = fract(hsv.x + u_hueRotate / 360.0);


            // 4.1) suppress yellow/orange roads after dark transform
            // yellow hue range approx: [30°, 75°]
            float hDeg = hsv.x * 360.0;
            float yellowMask = smoothstep(20.0, 35.0, hDeg) * (1.0 - smoothstep(75.0, 90.0, hDeg));
            
            // only suppress when color has enough saturation/value
            float vividMask = smoothstep(0.2, 0.6, hsv.y) * smoothstep(0.2, 0.7, hsv.z);
            float suppress = clamp(u_yellowSuppress, 0.0, 1.0) * yellowMask * vividMask;

            // shift yellow hue toward cool blue and lower saturation slightly
            hsv.x = fract(hsv.x + suppress * (160.0 / 360.0));
            hsv.y = mix(hsv.y, hsv.y * 0.75, suppress);
            color = hsv2rgb(hsv);

            // 4.2) global cool-blue tint (科技深蓝基调 → 调浅)
            float blueTint = clamp(u_blueTint, 0.0, 1.0);
            color = mix(color, vec3(color.r * 0.80, color.g * 0.92, color.b * 1.15), blueTint);

            // 4.3) cyan highlight boost for bright pixels (道路/文字更“科技感”)
            float brightMask = smoothstep(0.45, 0.95, max(max(color.r, color.g), color.b));
            color.gb += vec2(0.04, 0.10) * clamp(u_cyanBoost, 0.0, 1.0) * brightMask;

            // 4.4) shadow deep blue push (暗部 → 更浅的蓝色，不是深黑蓝)
            float darkMask = 1.0 - smoothstep(0.06, 0.45, dot(color, vec3(0.299, 0.587, 0.114)));
            vec3 shadowBlue = clamp(u_shadowBlueRgb, 0.0, 1.0);
            color = mix(color, max(color, shadowBlue), clamp(u_shadowBlue, 0.0, 1.0) * darkMask);

          // 5) contrast(u_contrast)
          color = (color - 0.5) * u_contrast + 0.5;

          // 6) brightness(u_brightness)
          color *= u_brightness;

          fragColor = vec4(clamp(color, 0.0, 1.0), texColor.a);
        }
      `,
      uniforms: {
        u_sepiaMix: options?.sepiaMix ?? 0.16,
        u_saturation: options?.saturation ?? 1.35,
        u_hueRotate: options?.hueRotate ?? 188.0,
        u_contrast: options?.contrast ?? 1.08,
        u_brightness: options?.brightness ?? 0.9,
        u_yellowSuppress: options?.yellowSuppress ?? 1.0,
        u_blueTint: options?.blueTint ?? 0.78,
        u_cyanBoost: options?.cyanBoost ?? 0.62,
        u_shadowBlue: options?.shadowBlue ?? 0.72,
        u_shadowBlueRgb: new Cesium.Cartesian3(shadowBlueRgb.r, shadowBlueRgb.g, shadowBlueRgb.b)
      }
    })
  )
}

/**
 * 移除暗滤镜效果
 * @param viewer Cesium Viewer实例
 */
export function removeDarkFilter(viewer: Cesium.Viewer) {
  if (darkFilterStage) {
    viewer.scene.postProcessStages.remove(darkFilterStage)
    darkFilterStage = null
  }
}
