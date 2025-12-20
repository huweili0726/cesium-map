/**
 * json 相关工具函数
 */
import * as jsonc from 'jsonc-parser'

export function jsonUtils() {

  /**
   * 从 URL 获取 JSON 文件（支持 JSONC 格式，即带注释的 JSON）
   * @param url JSON 文件的 URL
   * @returns 解析后的 JSON 对象
   */
  const getJsonFile = (url: string) => {
    return fetch(url)
      .then(response => response.text())
      .then(text => jsonc.parse(text))
      .catch(error => console.error('Error fetching JSON:', error))
  }

  return {
    getJsonFile
  }
}