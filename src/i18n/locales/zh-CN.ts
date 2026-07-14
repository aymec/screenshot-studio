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

  export: '导出',
  exportThis: '导出这张截图',
  exportAll: '导出所有截图',
  saveProject: '保存项目（.zip）',
  exporting: '正在导出…',
  savingProject: '正在保存项目…',
  loadProject: '打开项目…',
  loadingProject: '正在打开项目…',
  loadProjectTitle: '打开这个项目？',
  loadProjectBody: '所有设备上的截图都会被文件中的内容替换。你当前的作品没有保存在其他任何地方。',
  loadErrorUnreadable: '无法读取该文件。它可能已损坏，或者不是 zip 压缩包。',
  loadErrorNotAProject: '这个 zip 不是 Screenshot Studio 项目。',
  loadErrorTooNew: '该项目由更新版本的应用保存。',
  deleteAll: '全部删除',
  deleteAllTitle: '要全部删除吗？',
  deleteAllBody: '所有设备上的截图，以及保存在此浏览器中的全部内容，都将被删除。此操作无法撤销。',
  deleteAllSave: '保存项目并删除',
  deleteAllConfirm: '不保存直接删除',
  cancel: '取消',
  saveFailed: '项目保存失败，因此没有删除任何内容。',
  storageFull: '此浏览器存储空间已满，图片不再保存。请释放空间，或将项目保存为文件。',

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
    '预览就是全分辨率的真实画布，所以下载的 PNG 与你看到的完全一致。可以导出当前这张截图、一次导出所有设备的所有截图，或者把整个项目保存为 .zip，以后再打开。',

  modalFootnote:
    '你的作品会保存在此浏览器中（包括图片），下次会自动恢复。不会上传到任何地方。',
  gotIt: '知道了',
}
