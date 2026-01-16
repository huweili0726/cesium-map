import { defineConfig, loadEnv } from 'vite'
import type { ConfigEnv } from "vite"
import vue from '@vitejs/plugin-vue'
import path from 'path';
import cesium from 'vite-plugin-cesium'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default ({ mode }: ConfigEnv) => {
  const root = process.cwd()
  // 获取 .env 文件里定义的环境变量
  const ENV = loadEnv(mode, root)

  return defineConfig({
    base: ENV.VITE_BASE_URL,
    plugins: [
      vue(), 
      cesium(), 
      viteStaticCopy({
        targets: [
          {
            src: 'node_modules/cesium/Build/Cesium/*',
            dest: 'cesium'
          }
        ]
      })
    ],
    server: {
      host: '0.0.0.0', // 监听所有网络接口
      port: 3001, // 监听端口
      open: true, //项目启动时是否打开页面
      proxy: {
        // 自定义地形服务
        '/terrain': {
          target: 'https://data.mars3d.cn',//目标地址（跨域）
          changeOrigin: true,
        },
    }
    },
    define: {
      "process.env": {
        mode,
        BASE_URL: ENV.VITE_BASE_URL,
      },
      buildTime: new Date()
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue'],
    }
  })
}