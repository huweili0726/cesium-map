import * as Cesium from 'cesium';

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * 无人机标签项接口
 */
export interface DroneLabelItem {
  id: string;
  getPosition: () => any;
  getInfo?: () => any;
  getVisible?: () => boolean;
  text: string;
  map: any;
}

/**
 * 各种标签div合集
 */
export function labelDiv() {
  /**
   * 创建或更新无人机div标签
   * @param labelItem 无人机标签项
   * @returns 销毁函数
   */
  const createOrUpdateDroneLabelDiv = (labelItem: DroneLabelItem) => {
    const labelDiv = document.createElement('div');
    labelDiv.className = 'drone-label';
    labelDiv.innerHTML = labelItem.text;

    // 存储无人机详情面板的位置坐标，用于拖拽功能
    let new_detailDivLeft = null;
    let new_detailDivTop = null;

    // 让labelDiv成为定位参考容器
    labelDiv.style.position = 'absolute';
    labelDiv.style.display = 'none';
    // 添加点击事件，事件对象中带上无人机id
    labelDiv.addEventListener('click', (e) => {
      e.stopPropagation();
      // 先移除已存在的内容div，避免重复
      const existDetailDiv = labelDiv.querySelector('.drone-detail-div');
      if (existDetailDiv) existDetailDiv.remove();

      // 创建新的内容div，作为labelDiv的子元素
      const detailDiv = document.createElement('div');
      detailDiv.className = 'drone-detail-div';
      detailDiv.innerHTML = `
        <div style="font-weight:bold;font-size:16px;margin-bottom:2px;">无人机详细信息</div>
        <button class="drone-detail-close">×</button>
        <div style='margin-top:2px;margin-bottom:2px;'>ID: ${labelItem.id}</div>
        <div id="drone-info-${labelItem.id}">
          <div>经度：<span class="lng">-</span></div>
          <div>纬度：<span class="lat">-</span></div>
          <div>高度：<span class="alt">-</span> m</div>
          <div>速度：<span class="speed">-</span> m/s</div>
        </div>
      `;
      labelDiv.appendChild(detailDiv);

      // 创建拖拽线svg元素
      const dragLineSvg = document.createElementNS(SVG_NS, 'svg');
      dragLineSvg.classList.add('drone-drag-line-svg');
      const dragLine = document.createElementNS(SVG_NS, 'line');
      dragLine.classList.add('drone-drag-line-line');
      dragLineSvg.appendChild(dragLine);

      let isDragging = false; // 是否正在拖拽
      let startX = 0; // 拖拽线的起始点x坐标
      let startY = 0; // 拖拽线的起始点y坐标
    
      // 更新拖拽线的位置
      const updateDragLine = () => {
        if (!isDragging) return;
        const labelRect = labelDiv.getBoundingClientRect(); // 无人机标签div的矩形框
        const detailRect = detailDiv.getBoundingClientRect(); // 无人机详情面板的矩形框
        const startX = labelRect.left + labelRect.width / 2; // 拖拽线的起始点x坐标
        const startY = labelRect.top + labelRect.height / 2; // 拖拽线的起始点y坐标
        const endX = detailRect.left + detailRect.width / 2; // 拖拽线的结束点x坐标
        const endY = detailRect.top + detailRect.height / 2; // 拖拽线的结束点y坐标
        dragLine.setAttribute('x1', String(startX)); 
        dragLine.setAttribute('y1', String(startY)); 
        dragLine.setAttribute('x2', String(endX)); 
        dragLine.setAttribute('y2', String(endY)); 
      };

      // 移除拖拽线
      const removeDragLine = () => {
        if (dragLineSvg.parentNode) {
          dragLineSvg.remove(); // 移除拖拽线svg元素
        }
      };

      // 拖拽过程中，更新无人机详情面板的位置坐标
      const onPointerMove = (e: PointerEvent) => {
        if (!isDragging) return;
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        detailDiv.style.left = `${new_detailDivLeft + deltaX}px`;
        detailDiv.style.top = `${new_detailDivTop + deltaY}px`;
        updateDragLine();
      };

      // 拖拽结束时，更新无人机详情面板的位置坐标
      const onPointerEnd = () => {
        if (!isDragging) return;
        isDragging = false;
        new_detailDivLeft = parseFloat(detailDiv.style.left) || 0;
        new_detailDivTop = parseFloat(detailDiv.style.top) || 0;
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerEnd);
        removeDragLine();
      };

      // 点击无人机详情面板时，开始拖拽
      detailDiv.addEventListener('pointerdown', (e) => {
        if (e.target instanceof HTMLElement && e.target.closest('.drone-detail-close')) {
          return;
        }
        e.preventDefault();

        if (detailDiv.parentElement !== document.body) {
          labelDiv.appendChild(detailDiv);
        }
        document.body.appendChild(dragLineSvg);
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        updateDragLine();
        document.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerup', onPointerEnd);
      });

      // 实时刷新无人机经纬度、高度、速度
      const infoDiv = detailDiv.querySelector(`#drone-info-${labelItem.id}`);
      let rafId = 0;
      function updateDroneInfo() {
        if (!infoDiv) return;
  
        const lng = labelItem.getInfo?.().lng ?? '--';
        const lat = labelItem.getInfo?.().lat ?? '--';
        const alt = labelItem.getInfo?.().height ?? '--';
        const info = labelItem.getInfo ? labelItem.getInfo() : null;
        const speed = info?.speed ?? '--';
        const lngEl = infoDiv.querySelector('.lng');
        const latEl = infoDiv.querySelector('.lat');
        const altEl = infoDiv.querySelector('.alt');
        const speedEl = infoDiv.querySelector('.speed');
        if (lngEl) lngEl.textContent = lng;
        if (latEl) latEl.textContent = lat;
        if (altEl) altEl.textContent = alt;
        if (speedEl) speedEl.textContent = String(speed);
      
        rafId = requestAnimationFrame(updateDroneInfo);
      }
      updateDroneInfo();
      // 关闭时移除动画帧
      const closeButton = detailDiv.querySelector('.drone-detail-close');
      if (closeButton instanceof HTMLElement) {
        closeButton.addEventListener('click', (e) => {
          e.stopPropagation();
          cancelAnimationFrame(rafId);
          removeDragLine();
          detailDiv.remove();
        });
      }

      // 创建自定义事件，事件名为 'drone-label-click'，并通过 detail 传递无人机 id
      const event = new CustomEvent('drone-label-click', {
        detail: {
          id: labelItem.id
        }
      });
      window.dispatchEvent(event);
    });
    document.body.appendChild(labelDiv);

    // 每帧同步div位置
    const updateDivPosition = () => {
      if (!labelItem.map || !labelItem.map.scene) {
        labelDiv.style.display = 'none';
        return;
      }
      let position: any;
      try {
        position = labelItem.getPosition();
      } catch (e) {
        labelDiv.style.display = 'none';
        return;
      }
      if (!position || !(position instanceof Cesium.Cartesian3)) {
        labelDiv.style.display = 'none';
        return;
      }

      if (labelItem.getVisible && !labelItem.getVisible()) {
        labelDiv.style.display = 'none';
        return;
      }

      let windowPos : Cesium.Cartesian2;
      try {
        windowPos = Cesium.SceneTransforms.worldToWindowCoordinates(labelItem.map.scene, position);
      } catch (e) {
        labelDiv.style.display = 'none';
        return;
      }
      if (windowPos && !isNaN(windowPos.x) && !isNaN(windowPos.y)) {
        labelDiv.style.left = `${windowPos.x - labelDiv.offsetWidth / 2}px`;
        labelDiv.style.top = `${windowPos.y - 60}px`;
        labelDiv.style.display = 'block';
      } else {
        labelDiv.style.display = 'none';
      }
    };
    const postRenderListener = labelItem.map.scene.postRender.addEventListener(updateDivPosition);

    // 返回销毁函数
    return () => {
      labelItem.map.scene.postRender.removeEventListener(postRenderListener);
      labelDiv.remove();
    };
  };

  return {
    createOrUpdateDroneLabelDiv
  };
}

