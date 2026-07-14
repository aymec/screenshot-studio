import type { Dict } from './en'

export const zhTW: Dict = {
  brandSubtitle: '{{store}} 圖片 · {{size}}',
  about: '關於',
  light: '淺色',
  dark: '深色',
  closeControls: '關閉設定',
  showControls: '顯示設定',
  switchToLight: '切換為淺色模式',
  switchToDark: '切換為深色模式',

  device: '裝置',
  screenshot: '螢幕截圖',
  dropImage: '點擊或拖曳圖片',
  replaceImage: '更換圖片',

  screenshots: '螢幕截圖',
  screenshotN: '螢幕截圖 {{n}}',
  previousScreenshot: '上一張螢幕截圖',
  nextScreenshot: '下一張螢幕截圖',
  addScreenshot: '新增螢幕截圖',
  deleteScreenshot: '刪除螢幕截圖 {{n}}',
  deleteScreenshotBody: '它的圖片、文案與顏色都會一併刪除，且無法復原。',
  yes: '是',
  no: '否',

  caption: '文案',
  captionHint: '按 Enter 鍵換行。',
  highlightedWords: '強調的字詞',
  noWords: '尚無文字',

  backgroundColor: '背景顏色',
  highlightColor: '強調顏色',
  textColor: '文字顏色',

  font: '字體',
  fontSystem: '系統字體 (SF Pro)',
  fontInter: 'Inter（各平台一致）',
  language: '語言',

  size: '字級 — {{value}}px',
  weight: '字重 — {{value}}',
  lineHeight: '行高 — {{value}}',

  export: '匯出',
  exportThis: '匯出這張截圖',
  exportAll: '匯出所有截圖',
  saveProject: '儲存專案（.zip）',
  exporting: '正在匯出…',
  savingProject: '正在儲存專案…',
  loadProject: '開啟專案…',
  loadingProject: '正在開啟專案…',
  loadProjectTitle: '開啟這個專案？',
  loadProjectBody: '所有裝置上的截圖都會被檔案中的內容取代。你目前的作品沒有儲存在其他任何地方。',
  loadErrorUnreadable: '無法讀取這個檔案。它可能已損毀，或者不是 zip 壓縮檔。',
  loadErrorNotAProject: '這個 zip 不是 Screenshot Studio 專案。',
  loadErrorTooNew: '這個專案是由較新版本的應用程式儲存的。',
  reset: '還原範本預設值',
  storageFull: '這個瀏覽器的儲存空間已滿，圖片不再儲存。請釋出空間，或將專案儲存為檔案。',

  aboutTitle: '關於本站',
  closeInfo: '關閉說明',
  modalTagline: '在瀏覽器中製作 App Store 和 Google Play 行銷截圖。',
  modalIntro:
    '選擇裝置，把手機、平板或模擬器的原始截圖放進對應外框，加上一句強調其中一個字詞的文案，匯出可直接上傳的 PNG —— 尺寸正是該商店所要求的。所有處理都在瀏覽器本機完成，不會上傳任何圖片。',

  step1Title: '選擇裝置並加入你的截圖。',
  step1Body:
    '先選擇 iPhone、iPad、Android 手機或 Android 平板，然後點擊拖放區域，或把圖片拖進去。圖片會縮放到填滿裝置螢幕並從中央裁切，因此任何尺寸都適用。',
  step2Title: '撰寫文案。',
  step2Body: '按 Enter 鍵換行。文案會維持在裝置上方空白區域的中央。',
  step3Title: '挑選要強調的字詞。',
  step3Body: '點一下任一字詞即可套用強調顏色，再點一次即可取消。',
  step4Title: '設定顏色與字體。',
  step4Body: '背景色、強調色與文字顏色，以及字體、字級、字重和行高。',
  step5Title: '做成一整組。',
  step5Body:
    '用預覽下方的 + 為每個裝置新增最多 10 張截圖，並用有編號的圓點在它們之間切換。每一張都保有各自的圖片、文案、顏色與字體。',
  step6Title: '匯出。',
  step6Body:
    '預覽就是全解析度的真實畫布，所以下載的 PNG 與你看到的完全一致。可以匯出目前這張截圖、一次匯出所有裝置的所有截圖，或者把整個專案儲存為 .zip，之後再開啟。',

  modalFootnote:
    '你的作品會儲存在這個瀏覽器中（包括圖片），下次會自動還原。不會上傳到任何地方。',
  gotIt: '我知道了',
}
