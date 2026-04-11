import { useMapStore } from '@/stores/modules/mapStore'
import * as Cesium from 'cesium'

/**
 * 绑定无人机实体的点击事件（左键/右键）
 * @param modelEntity setDronePointByGlb 返回的实体对象
 * @param options 创建点位时的 options
 */

export function bindDroneClickHandler(modelEntity: any, options: { id: string }) {
    // 获取store实例，保持响应性
    const mapStore = useMapStore()

    const map = mapStore.getMap();
    if (!map || !modelEntity?.entity) return;

    // 添加鼠标点击事件监听（支持左键和右键）
    const clickHandler = new Cesium.ScreenSpaceEventHandler(map.canvas);

    // 统一的点击处理函数
    const handleDroneClick = (click: any, type: 'left' | 'right') => {
        // 使用pick而不是drillPick，提高性能（只获取最顶层对象）
        const pickedObject = map.scene.pick(click.position);
        // 快速检查点击对象是否为当前无人机
        if (Cesium.defined(pickedObject) && pickedObject.id === modelEntity.entity) {
            // 移除alert，避免阻塞UI
            alert(`${type === 'left' ? '左键' : '右键'}点击了无人机: ${options.id}`);
            // 触发自定义事件
            window.dispatchEvent(new CustomEvent('droneClick', {
                detail: { id: options.id, type, entity: modelEntity }
            }));
        }
    };

    // 左键点击事件
    clickHandler.setInputAction((click: any) => {
        handleDroneClick(click, 'left');
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // 右键点击事件
    clickHandler.setInputAction((click: any) => {
        handleDroneClick(click, 'right');
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

    // 保存事件处理器，便于后续清理
    modelEntity.clickHandler = clickHandler;
}