/**
 * 自定义工具栏按钮功能
 * 
 * 提供在 Cesium 地图工具栏中添加自定义按钮的功能
 * 
 * @author huweili
 * @email czxyhuweili@163.com
 * @version 1.0.0
 * @date 2026-04-13
 */
import * as Cesium from 'cesium'

/**
 * 自定义工具栏按钮选项
 */
export interface CustomToolbarButtonOptions {
  title: string
  text: string
  onClick: (viewer: Cesium.Viewer) => void
  className?: string
}

/**
 * 自定义工具栏按钮功能
 */
export function customToolbarButtons() {
  /**
   * 添加自定义工具栏按钮
   * @param viewer Cesium Viewer 实例
   * @param options 自定义按钮选项
   * @returns 创建的按钮元素
   */
  const addCustomToolbarButton = (viewer: Cesium.Viewer, options: CustomToolbarButtonOptions): HTMLButtonElement | null => {
    const toolbar = viewer.container.querySelector('.cesium-viewer-toolbar') as HTMLElement | null
    if (!toolbar) return null

    const button = document.createElement('button')
    button.type = 'button'
    button.className = `cesium-button cesium-toolbar-button ${options.className || 'custom-toolbar-button'}`
    button.title = options.title
    button.innerText = options.text
    button.onclick = () => {
      options.onClick(viewer)
    }

    const homeBtn = toolbar.querySelector('.cesium-home-button')
    if (homeBtn && homeBtn.nextSibling) {
      toolbar.insertBefore(button, homeBtn.nextSibling)
    } else {
      toolbar.appendChild(button)
    }

    return button
  }

  /**
   * 添加多个自定义工具栏按钮
   * @param viewer Cesium Viewer 实例
   * @param buttons 自定义按钮选项数组
   * @returns 创建的按钮元素数组
   */
  const addCustomToolbarButtons = (viewer: Cesium.Viewer, buttons: CustomToolbarButtonOptions[]): HTMLButtonElement[] => {
    const createdButtons: HTMLButtonElement[] = []
    
    buttons.forEach(buttonOptions => {
      const button = addCustomToolbarButton(viewer, buttonOptions)
      if (button) {
        createdButtons.push(button)
      }
    })
    
    return createdButtons
  }

  return {
    addCustomToolbarButton,
    addCustomToolbarButtons
  }
}