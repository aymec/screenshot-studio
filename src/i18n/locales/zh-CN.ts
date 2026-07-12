import type { Dict } from './en'

export const zhCN: Dict = {
  brandSubtitle: '{{store}} 图片 · {{size}}',
  about: '关于',
  light: '浅色',
  dark: '深色',
  closeControls: '关闭设置',
  showControls: '显示设置',
  switchToLight: '切换到浅色模式',
  switchToDark: '切换到深色模式',

  device: '设备',
  screenshot: '截图',
  dropImage: '点击或拖入图片',
  replaceImage: '更换图片',

  screenshots: '截图',
  screenshotN: '截图 {{n}}',
  previousScreenshot: '上一张截图',
  nextScreenshot: '下一张截图',
  addScreenshot: '添加截图',
  deleteScreenshot: '删除截图 {{n}}',
  deleteScreenshotBody: '它的图片、文案和颜色都会一起删除，且无法撤销。',
  yes: '是',
  no: '否',

  caption: '文案',
  captionHint: '按 Enter 键换行。',
  highlightedWords: '高亮的词',
  noWords: '暂无文字',

  backgroundColor: '背景色',
  highlightColor: '高亮色',
  textColor: '文字颜色',

  font: '字体',
  fontSystem: '系统字体 (SF Pro)',
  fontInter: 'Inter（各平台一致）',
  language: '语言',

  size: '字号 — {{value}}px',
  weight: '字重 — {{value}}',
  lineHeight: '行高 — {{value}}',

  exportPng: '导出 PNG',
  exportAll: '全部导出',
  exporting: '正在导出…',
  reset: '恢复模板默认值',

  aboutTitle: '关于本站',
  closeInfo: '关闭说明',
  modalTagline: '在浏览器里制作 App Store 和 Google Play 营销截图。',
  modalIntro:
    '选择设备，把手机、平板或模拟器的原始截图放进对应外框，加上一句高亮其中一个词的文案，导出可直接上传的 PNG —— 尺寸正是该商店所要求的。全部在浏览器本地完成，不会上传任何图片。',

  step1Title: '选择设备并添加截图。',
  step1Body:
    '先选择 iPhone、iPad、Android 手机或 Android 平板，然后点击拖放区域，或把图片拖进去。图片会缩放到填满设备屏幕并从中心裁剪，因此任何尺寸都可以。',
  step2Title: '撰写文案。',
  step2Body: '按 Enter 键换行。文案始终在设备上方的空白区域居中显示。',
  step3Title: '选择高亮的词。',
  step3Body: '点按任意词即可将其变为高亮色，再点一次即可取消。',
  step4Title: '设置颜色和字体。',
  step4Body: '背景色、高亮色和文字颜色，以及字体、字号、字重和行高。',
  step5Title: '做成一整套。',
  step5Body:
    '用预览下方的 + 为每个设备添加最多 10 张截图，并用带编号的圆点在它们之间切换。每张截图都保留各自的图片、文案、颜色和字体。',
  step6Title: '导出。',
  step6Body:
    '预览就是全分辨率的真实画布，所以下载的 PNG 与你看到的完全一致。可以只导出当前这张，也可以一次导出整套。',

  modalFootnote:
    '设置会保存在此浏览器中，下次会自动恢复。图片不会保存 —— 重新加载后请再次拖入。',
  gotIt: '知道了',
}
