import type { Dict } from './en'

export const ko: Dict = {
  brandSubtitle: '{{store}} 이미지 · {{size}}',
  about: '소개',
  light: '라이트',
  dark: '다크',
  closeControls: '설정 닫기',
  showControls: '설정 열기',
  switchToLight: '라이트 모드로 전환',
  switchToDark: '다크 모드로 전환',

  device: '기기',
  screenshot: '스크린샷',
  dropImage: '클릭하거나 이미지를 끌어다 놓으세요',
  replaceImage: '이미지 교체',

  screenshots: '스크린샷',
  screenshotN: '스크린샷 {{n}}',
  previousScreenshot: '이전 스크린샷',
  nextScreenshot: '다음 스크린샷',
  addScreenshot: '스크린샷 추가',
  deleteScreenshot: '스크린샷 {{n}} 삭제',
  deleteScreenshotBody: '이미지와 문구, 색상도 함께 사라집니다. 되돌릴 수 없습니다.',
  yes: '예',
  no: '아니요',

  caption: '문구',
  captionHint: 'Enter 키를 누르면 줄이 바뀝니다.',
  highlightedWords: '강조할 단어',
  noWords: '단어가 없습니다',

  backgroundColor: '배경색',
  highlightColor: '강조색',
  textColor: '글자색',

  font: '글꼴',
  fontSystem: '시스템 (SF Pro)',
  fontInter: 'Inter (어디서나 동일)',
  language: '언어',

  size: '크기 — {{value}}px',
  weight: '굵기 — {{value}}',
  lineHeight: '줄 간격 — {{value}}',

  export: '내보내기',
  exportThis: '이 스크린샷 내보내기',
  exportAll: '모든 스크린샷 내보내기',
  saveProject: '프로젝트 저장(.zip)',
  exporting: '내보내는 중…',
  savingProject: '프로젝트를 저장하는 중…',
  loadProject: '프로젝트 열기…',
  loadingProject: '프로젝트를 여는 중…',
  loadProjectTitle: '이 프로젝트를 열까요?',
  loadProjectBody: '모든 기기의 스크린샷이 파일에 담긴 것으로 바뀝니다. 지금 작업은 다른 곳에 저장되어 있지 않습니다.',
  loadErrorUnreadable: '파일을 읽을 수 없습니다. 손상되었거나 zip 아카이브가 아닐 수 있습니다.',
  loadErrorNotAProject: '이 zip은 Screenshot Studio 프로젝트가 아닙니다.',
  loadErrorTooNew: '이 프로젝트는 더 새로운 버전의 앱에서 저장되었습니다.',
  resetAll: '전체 초기화',
  resetAllTitle: '전체를 초기화할까요?',
  resetAllBody:
    '모든 기기의 스크린샷과 이 브라우저에 저장된 내용이 모두 삭제됩니다. 초기화할까요?',
  storageFull: '이 브라우저의 저장 공간이 부족해 이미지가 더 이상 저장되지 않습니다. 공간을 확보하거나 프로젝트를 파일로 저장하세요.',

  aboutTitle: '이 사이트 소개',
  closeInfo: '설명 닫기',
  modalTagline: '브라우저에서 App Store와 Google Play 마케팅 스크린샷을 만드세요.',
  modalIntro:
    '기기를 고르고, 휴대폰이나 태블릿, 시뮬레이터의 스크린샷을 그 프레임에 넣고, 한 단어를 강조한 문구를 더한 다음, 해당 스토어가 요구하는 크기 그대로 업로드할 수 있는 PNG로 내보내세요. 모든 작업은 브라우저 안에서 처리되며 어떤 이미지도 업로드되지 않습니다.',

  step1Title: '기기를 고르고 스크린샷 추가하기',
  step1Body:
    'iPhone, iPad, Android 휴대폰, Android 태블릿 중에서 고른 다음 드롭 영역을 클릭하거나 이미지를 끌어다 놓으세요. 기기 화면을 가득 채우도록 확대되고 가운데를 기준으로 잘리므로 어떤 크기든 괜찮습니다.',
  step2Title: '문구 작성하기',
  step2Body: 'Enter 키로 줄을 바꿉니다. 문구는 기기 위쪽 공간의 가운데에 유지됩니다.',
  step3Title: '강조할 단어 고르기',
  step3Body: '단어를 누르면 강조색이 적용됩니다. 다시 누르면 해제됩니다.',
  step4Title: '색상과 서체 설정하기',
  step4Body: '배경색, 강조색, 글자색과 함께 글꼴, 크기, 굵기, 줄 간격을 조정할 수 있습니다.',
  step5Title: '세트 만들기',
  step5Body:
    '미리보기 아래의 + 로 기기마다 최대 10장까지 추가하고, 번호가 매겨진 칩으로 전환하세요. 이미지, 문구, 색상, 글꼴은 스크린샷마다 따로 저장됩니다.',
  step6Title: '내보내기',
  step6Body:
    '미리보기가 곧 원본 해상도의 실제 캔버스이므로, 내려받는 PNG는 보이는 그대로입니다. 지금 보고 있는 스크린샷, 모든 기기의 모든 스크린샷, 또는 프로젝트 전체를 나중에 다시 열 수 있는 .zip으로 저장하세요.',

  modalFootnote:
    '작업 내용은 이미지까지 이 브라우저에 저장되어 다음에도 복원됩니다. 어디에도 업로드되지 않습니다.',
  gotIt: '확인',
}
