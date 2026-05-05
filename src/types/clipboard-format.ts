import { Buffer } from 'node:buffer'

/**
 * @fileoverview 剪贴板格式数据结构定义
 * @module types/ClipboardFormat
 */

/**
 * @description 标准剪贴板格式常量
 * 对应 Windows 剪贴板格式
 * @see https://learn.microsoft.com/en-us/windows/win32/dataxchg/clipboard-formats
 */
export enum ClipboardFormatType {
  /** 文本格式。每行以 CR-LF 结束，null 字符表示数据结束。用于 ANSI 文本。 */
  CF_TEXT = 1,
  /** 位图 (HBITMAP) 的句柄。 */
  CF_BITMAP = 2,
  /** 图元文件图片格式。 */
  CF_METAFILEPICT = 3,
  /** 数据交换格式 (Software Arts)。 */
  CF_DIF = 5,
  /** 标记图像文件格式 (TIFF)。 */
  CF_TIFF = 6,
  /** OEM 文本格式。每行以 CR-LF 结束，null 字符表示数据结束。 */
  CF_OEMTEXT = 7,
  /** 包含 BITMAPINFO 结构的内存对象，后跟位图位。 */
  CF_DIB = 8,
  /** 调色板句柄。应用程序应使用 SelectPalette 和 RealizePalette 实现调色板。 */
  CF_PALETTE = 9,
  /** 表示标准波形的音频数据（如 11 kHz 或 22 kHz PCM）。 */
  CF_WAVE = 12,
  /** Unicode 文本格式。每行以 CR-LF 结束，null 字符表示数据结束。 */
  CF_UNICODETEXT = 13,
  /** 增强型图元文件的句柄 (HENHMETAFILE)。 */
  CF_ENHMETAFILE = 14,
  /** 文件列表格式 (CF_HDROP)。 */
  CF_HDROP = 15,
  /** 与剪贴板文本关联的区域设置标识符 (LCID) 的句柄。 */
  CF_LOCALE = 16,
  /** 包含 BITMAPV5HEADER 结构的内存对象，后跟位图颜色空间信息和位图位。 */
  CF_DIBV5 = 17,
  /** 所有者显示格式。剪贴板所有者必须显示和更新剪贴板查看器窗口。 */
  CF_OWNERDISPLAY = 0x0080,
  /** 与专用格式关联的文本显示格式。 */
  CF_DSPTEXT = 0x0081,
  /** 与专用格式关联的位图显示格式。 */
  CF_DSPBITMAP = 0x0082,
  /** 与专用格式关联的图元文件图片显示格式。 */
  CF_DSPMETAFILEPICT = 0x0083,
  /** 与专用格式关联的增强型图元文件显示格式。 */
  CF_DSPENHMETAFILE = 0x008E,
  /** 专用剪贴板格式范围的开头。关联的句柄不会自动释放。 */
  CF_PRIVATEFIRST = 0x0200,
  /** 专用剪贴板格式范围的末尾。 */
  CF_PRIVATELAST = 0x02FF,
  /** GDI 对象剪贴板格式范围的开头。 */
  CF_GDIOBJFIRST = 0x0300,
  /** GDI 对象剪贴板格式范围的末尾。 */
  CF_GDIOBJLAST = 0x03FF,

  /** Rich Text Format */
  RTFFormat = 49301,
  /** HTML Format */
  HTML_Format = 49424,
  /** Ditto Ping Format */
  PingFormat = 49777,
  /** Clipboard Viewer Ignore */
  m_cfIgnoreClipboard = 49778,
  /** Ditto Delay Saving Data */
  m_cfDelaySavingData = 49779,
  /** Ditto Remote CF_HDROP */
  RemoteCF_HDROP = 49780,
  /** Ditto File Data */
  DittoFileData = 49781,
  PNG_Format = 49540,
}

/**
 * @description 剪贴板格式名称类型（枚举 key 的联合）
 */
export type ClipboardFormatName = keyof typeof ClipboardFormatType | string

/**
 * @description 剪贴板格式数据
 */
export interface ClipboardFormatData {
  cfType: ClipboardFormatType
  formatName: ClipboardFormatName
  data: Buffer
}

/**
 * @description 剪贴板数据（包含多个格式）
 */
export interface ClipboardData {
  description: string
  formats: ClipboardFormatData[]
}

/**
 * @description 剪贴板格式构建器
 * 提供类型安全的工厂方法创建剪贴板格式
 */
export class ClipboardFormat {
  /**
   * @description 格式类型到名称的映射
   */
  static readonly FORMAT_NAMES: Record<ClipboardFormatType, ClipboardFormatName> = {
    [ClipboardFormatType.CF_TEXT]: 'CF_TEXT',
    [ClipboardFormatType.CF_BITMAP]: 'CF_BITMAP',
    [ClipboardFormatType.CF_METAFILEPICT]: 'CF_METAFILEPICT',
    [ClipboardFormatType.CF_DIF]: 'CF_DIF',
    [ClipboardFormatType.CF_TIFF]: 'CF_TIFF',
    [ClipboardFormatType.CF_OEMTEXT]: 'CF_OEMTEXT',
    [ClipboardFormatType.CF_DIB]: 'CF_DIB',
    [ClipboardFormatType.CF_PALETTE]: 'CF_PALETTE',
    [ClipboardFormatType.CF_WAVE]: 'CF_WAVE',
    [ClipboardFormatType.CF_UNICODETEXT]: 'CF_UNICODETEXT',
    [ClipboardFormatType.CF_ENHMETAFILE]: 'CF_ENHMETAFILE',
    [ClipboardFormatType.CF_HDROP]: 'CF_HDROP',
    [ClipboardFormatType.CF_LOCALE]: 'CF_LOCALE',
    [ClipboardFormatType.CF_DIBV5]: 'CF_DIBV5',
    [ClipboardFormatType.CF_OWNERDISPLAY]: 'CF_OWNERDISPLAY',
    [ClipboardFormatType.CF_DSPTEXT]: 'CF_DSPTEXT',
    [ClipboardFormatType.CF_DSPBITMAP]: 'CF_DSPBITMAP',
    [ClipboardFormatType.CF_DSPMETAFILEPICT]: 'CF_DSPMETAFILEPICT',
    [ClipboardFormatType.CF_DSPENHMETAFILE]: 'CF_DSPENHMETAFILE',
    [ClipboardFormatType.CF_PRIVATEFIRST]: 'CF_PRIVATEFIRST',
    [ClipboardFormatType.CF_PRIVATELAST]: 'CF_PRIVATELAST',
    [ClipboardFormatType.CF_GDIOBJFIRST]: 'CF_GDIOBJFIRST',
    [ClipboardFormatType.CF_GDIOBJLAST]: 'CF_GDIOBJLAST',
    [ClipboardFormatType.RTFFormat]: 'Rich Text Format',
    [ClipboardFormatType.HTML_Format]: 'HTML Format',
    [ClipboardFormatType.PingFormat]: 'Ditto Ping Format',
    [ClipboardFormatType.m_cfIgnoreClipboard]: 'Clipboard Viewer Ignore',
    [ClipboardFormatType.m_cfDelaySavingData]: 'Ditto Delay Saving Data',
    [ClipboardFormatType.RemoteCF_HDROP]: 'Ditto Remote CF_HDROP',
    [ClipboardFormatType.DittoFileData]: 'Ditto File Data',
    [ClipboardFormatType.PNG_Format]: 'PNG',
  }

  /**
   * @description 创建剪贴板格式（通用工厂方法）
   * @param {ClipboardFormatType} cfType - 格式类型
   * @param {Buffer | string} data - 格式数据，字符串会自动编码
   * @returns {ClipboardFormatData} 剪贴板格式对象
   */
  static create(cfType: ClipboardFormatType, data: Buffer | string): ClipboardFormatData {
    const buffer = typeof data === 'string'
      ? (cfType === ClipboardFormatType.CF_UNICODETEXT ? Buffer.from(data, 'utf16le') : Buffer.from(data))
      : data

    return {
      cfType,
      formatName: ClipboardFormat.FORMAT_NAMES[cfType],
      data: buffer,
    }
  }

  /**
   * @description 创建 Unicode 文本格式 (CF_UNICODETEXT)
   * @param {string} text - 文本内容
   * @returns {ClipboardFormatData} Unicode 文本格式对象
   */
  static unicodeText(text: string): ClipboardFormatData {
    return ClipboardFormat.create(ClipboardFormatType.CF_UNICODETEXT, text)
  }

  /**
   * @description 创建 ANSI 文本格式 (CF_TEXT)
   * @param {string} text - 文本内容
   * @returns {ClipboardFormatData} ANSI 文本格式对象
   */
  static ansiText(text: string): ClipboardFormatData {
    return ClipboardFormat.create(ClipboardFormatType.CF_TEXT, text)
  }

  /**
   * @description 创建 OEM 文本格式 (CF_OEMTEXT)
   * @param {string} text - 文本内容
   * @returns {ClipboardFormatData} OEM 文本格式对象
   */
  static oemText(text: string): ClipboardFormatData {
    return ClipboardFormat.create(ClipboardFormatType.CF_OEMTEXT, text)
  }

  /**
   * @description 创建文件列表格式 (CF_HDROP)
   * @param {Buffer} data - 文件列表数据
   * @returns {ClipboardFormatData} 文件列表格式对象
   */
  static fileDrop(data: Buffer): ClipboardFormatData {
    return ClipboardFormat.create(ClipboardFormatType.CF_HDROP, data)
  }

  /**
   * @description 创建位图格式 (CF_BITMAP)
   * @param {Buffer} data - 位图数据
   * @returns {ClipboardFormatData} 位图格式对象
   */
  static bitmap(data: Buffer): ClipboardFormatData {
    return ClipboardFormat.create(ClipboardFormatType.CF_BITMAP, data)
  }

  /**
   * @description 创建增强元文件格式 (CF_ENHMETAFILE)
   * @param {Buffer} data - 元文件数据
   * @returns {ClipboardFormatData} 增强元文件格式对象
   */
  static enhancedMetafile(data: Buffer): ClipboardFormatData {
    return ClipboardFormat.create(ClipboardFormatType.CF_ENHMETAFILE, data)
  }

  /**
   * @description 从格式类型获取格式名称
   * @param {ClipboardFormatType} cfType - 格式类型枚举值
   * @returns {ClipboardFormatName} 格式名称
   */
  static getName(cfType: ClipboardFormatType): ClipboardFormatName | null {
    return ClipboardFormat.FORMAT_NAMES[cfType] ?? null
  }

  /**
   * @description 从格式名称获取格式类型
   * @param {ClipboardFormatName} formatName - 格式名称
   * @returns {ClipboardFormatType} 格式类型，如果未知则返回 0
   */
  static getType(formatName: ClipboardFormatName): ClipboardFormatType {
    const entries = Object.entries(ClipboardFormat.FORMAT_NAMES) as [string, ClipboardFormatName][]
    for (const [type, name] of entries) {
      if (name === formatName) {
        return Number.parseInt(type, 10) as ClipboardFormatType
      }
    }
    return 0 as ClipboardFormatType
  }

  /**
   * @description 检查格式类型是否为文本格式
   * @param {ClipboardFormatType} cfType - 格式类型
   * @returns {boolean} 是否为文本格式
   */
  static isTextFormat(cfType: ClipboardFormatType): boolean {
    return [
      ClipboardFormatType.CF_TEXT,
      ClipboardFormatType.CF_UNICODETEXT,
      ClipboardFormatType.CF_OEMTEXT,
    ].includes(cfType)
  }

  /**
   * @description 解码文本格式数据
   * @param {ClipboardFormatData} format - 格式数据
   * @returns {string} 解码后的文本，非文本格式返回空字符串
   */
  static decodeText(format: ClipboardFormatData): string {
    if (!ClipboardFormat.isTextFormat(format.cfType)) {
      return ''
    }

    try {
      if (format.cfType === ClipboardFormatType.CF_UNICODETEXT) {
        return format.data.toString('utf16le').replace(/\0+$/, '')
      }
      return format.data.toString('latin1').replace(/\0+$/, '')
    }
    catch {
      return ''
    }
  }
}
