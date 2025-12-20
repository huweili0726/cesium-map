// src/types/cesium.d.ts
import * as Cesium from 'cesium';

// 扩展 Billboard 类型
declare module 'cesium' {
  interface Billboard {
    properties?: {
      clusterPoints?: Array<{ lng: number, lat: number, id: string }>,
      isCluster?: boolean
    };
  }
}