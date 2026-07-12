import type { Dict } from './en'

export const ja: Dict = {
  brandSubtitle: '{{store}} 用画像 · {{size}}',
  about: '概要',
  light: 'ライト',
  dark: 'ダーク',
  closeControls: '設定を閉じる',
  showControls: '設定を表示',
  switchToLight: 'ライトモードに切り替える',
  switchToDark: 'ダークモードに切り替える',

  device: 'デバイス',
  screenshot: 'スクリーンショット',
  dropImage: 'クリックまたは画像をドロップ',
  replaceImage: '画像を差し替える',

  screenshots: 'スクリーンショット',
  screenshotN: 'スクリーンショット {{n}}',
  previousScreenshot: '前のスクリーンショット',
  nextScreenshot: '次のスクリーンショット',
  addScreenshot: 'スクリーンショットを追加',
  deleteScreenshot: 'スクリーンショット {{n}} を削除',
  deleteScreenshotBody: '画像・キャプション・色も一緒に削除されます。元に戻すことはできません。',
  yes: 'はい',
  no: 'いいえ',

  caption: 'キャプション',
  captionHint: 'Enter キーで改行できます。',
  highlightedWords: '強調する単語',
  noWords: '単語がありません',

  backgroundColor: '背景色',
  highlightColor: '強調色',
  textColor: '文字色',

  font: 'フォント',
  fontSystem: 'システム (SF Pro)',
  fontInter: 'Inter (どの環境でも同じ)',
  language: '言語',

  size: 'サイズ — {{value}}px',
  weight: '太さ — {{value}}',
  lineHeight: '行の高さ — {{value}}',

  exportPng: 'PNG を書き出す',
  exportAll: 'すべて書き出す',
  exporting: '書き出し中…',
  reset: 'テンプレートの初期値に戻す',

  aboutTitle: 'このサイトについて',
  closeInfo: '説明を閉じる',
  modalTagline: 'App Store と Google Play 用のマーケティング画像をブラウザーで作成できます。',
  modalIntro:
    'デバイスを選び、スマートフォン・タブレット・シミュレーターのスクリーンショットをそのフレームに入れ、1 語を強調したキャプションを添えて、各ストアが求めるサイズのままアップロードできる PNG を書き出せます。すべてブラウザー内で処理され、画像がどこかに送信されることはありません。',

  step1Title: 'デバイスを選んでスクリーンショットを追加',
  step1Body:
    'iPhone・iPad・Android スマートフォン・Android タブレットから選び、ドロップ領域をクリックするか画像をドラッグしてください。デバイスの画面いっぱいに拡大され中央でトリミングされるため、どのサイズでも使えます。',
  step2Title: 'キャプションを入力',
  step2Body: 'Enter キーで改行できます。デバイスの上の余白の中央に配置されます。',
  step3Title: '強調する単語を選ぶ',
  step3Body: '単語をタップすると強調色になります。もう一度タップすると解除されます。',
  step4Title: '色と文字を設定',
  step4Body: '背景色・強調色・文字色に加えて、フォント、サイズ、太さ、行の高さを調整できます。',
  step5Title: 'セットを作る',
  step5Body:
    'プレビューの下にある + で、1 つのデバイスにつき最大 10 枚まで追加できます。番号付きのチップで切り替えてください。画像・キャプション・色・書体はスクリーンショットごとに保持されます。',
  step6Title: '書き出す',
  step6Body:
    'プレビューはフル解像度の実際のキャンバスなので、ダウンロードされる PNG は見たままです。表示中の 1 枚だけでも、セット全体を一度にでも書き出せます。',

  modalFootnote:
    '設定はこのブラウザーに保存され、次回も復元されます。画像は保存されないため、再読み込み後にもう一度ドロップしてください。',
  gotIt: 'わかりました',
}
