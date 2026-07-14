import type { Dict } from './en'

export const fr: Dict = {
  brandSubtitle: 'Visuel {{store}} · {{size}}',
  about: 'À propos',
  light: 'Clair',
  dark: 'Sombre',
  closeControls: 'Fermer les réglages',
  showControls: 'Afficher les réglages',
  switchToLight: 'Passer en mode clair',
  switchToDark: 'Passer en mode sombre',

  device: 'Appareil',
  screenshot: 'Capture d’écran',
  dropImage: 'Cliquez ou déposez une image',
  replaceImage: 'Remplacer l’image',

  screenshots: 'Captures d’écran',
  screenshotN: 'Capture d’écran {{n}}',
  previousScreenshot: 'Capture d’écran précédente',
  nextScreenshot: 'Capture d’écran suivante',
  addScreenshot: 'Ajouter une capture d’écran',
  deleteScreenshot: 'Supprimer la capture d’écran {{n}}',
  deleteScreenshotBody: 'Son image, sa légende et ses couleurs disparaissent avec elle. Cette action est irréversible.',
  yes: 'Oui',
  no: 'Non',

  caption: 'Légende',
  captionHint: 'Appuyez sur Entrée pour aller à la ligne.',
  highlightedWords: 'Mots mis en avant',
  noWords: 'Aucun mot',

  backgroundColor: 'Couleur de fond',
  highlightColor: 'Couleur de mise en avant',
  textColor: 'Couleur du texte',

  font: 'Police',
  fontSystem: 'Système (SF Pro)',
  fontInter: 'Inter (portable)',
  language: 'Langue',

  size: 'Taille — {{value}} px',
  weight: 'Graisse — {{value}}',
  lineHeight: 'Interligne — {{value}}',

  export: 'Exporter',
  exportThis: 'Exporter cette capture',
  exportAll: 'Exporter toutes les captures',
  saveProject: 'Enregistrer le projet (.zip)',
  exporting: 'Exportation…',
  savingProject: 'Enregistrement du projet…',
  loadProject: 'Ouvrir un projet…',
  loadingProject: 'Ouverture du projet…',
  loadProjectTitle: 'Ouvrir ce projet ?',
  loadProjectBody: 'Toutes les captures de tous les appareils seront remplacées par celles du fichier. Votre travail actuel n’est enregistré nulle part ailleurs.',
  loadErrorUnreadable: 'Ce fichier n’a pas pu être lu. Il est peut-être endommagé, ou ce n’est pas une archive zip.',
  loadErrorNotAProject: 'Ce zip n’est pas un projet Screenshot Studio.',
  loadErrorTooNew: 'Ce projet a été enregistré par une version plus récente de l’application.',
  resetAll: 'Tout réinitialiser',
  resetAllTitle: 'Tout réinitialiser ?',
  resetAllBody:
    'Toutes les captures de tous les appareils disparaissent, images comprises, ainsi que la copie enregistrée dans ce navigateur. Enregistrez votre projet d’abord si vous voulez le conserver. Cette action est irréversible.',
  storageFull: 'Ce navigateur n’a plus d’espace de stockage : vos images ne sont plus enregistrées. Libérez de l’espace ou enregistrez votre projet dans un fichier.',

  aboutTitle: 'À propos de ce site',
  closeInfo: 'Fermer les informations',
  modalTagline: 'Créez vos visuels marketing App Store et Google Play dans votre navigateur.',
  modalIntro:
    'Choisissez un appareil, déposez une capture d’écran brute de votre téléphone, de votre tablette ou du simulateur dans son cadre, ajoutez une légende dont un mot est mis en avant, puis exportez un PNG prêt à être envoyé, exactement à la taille exigée par la boutique. Tout se passe localement dans votre navigateur : rien n’est envoyé nulle part.',

  step1Title: 'Choisissez l’appareil et ajoutez votre capture d’écran.',
  step1Body:
    'Choisissez un iPhone, un iPad, un téléphone ou une tablette Android, puis cliquez sur la zone de dépôt (ou faites-y glisser une image). Elle est redimensionnée pour remplir l’écran de l’appareil et recadrée depuis le centre : toutes les tailles fonctionnent.',
  step2Title: 'Écrivez la légende.',
  step2Body:
    'Appuyez sur Entrée pour aller à la ligne. Elle reste centrée dans l’espace au-dessus de l’appareil.',
  step3Title: 'Choisissez les mots à mettre en avant.',
  step3Body:
    'Touchez un mot pour lui appliquer la couleur de mise en avant. Touchez-le à nouveau pour l’enlever.',
  step4Title: 'Réglez les couleurs et la typographie.',
  step4Body:
    'Couleurs de fond, de mise en avant et du texte, ainsi que la police, la taille, la graisse et l’interligne.',
  step5Title: 'Composez la série.',
  step5Body:
    'Ajoutez jusqu’à 10 captures d’écran par appareil avec le + sous l’aperçu, et passez de l’une à l’autre avec les pastilles numérotées. Chacune garde son image, sa légende, ses couleurs et sa typographie.',
  step6Title: 'Exportez.',
  step6Body:
    'L’aperçu est le vrai canevas en pleine résolution : le PNG que vous téléchargez est exactement ce que vous voyez. Exportez la capture en cours, toutes les captures de tous les appareils d’un coup, ou enregistrez le projet entier dans un .zip que vous pourrez rouvrir plus tard.',

  modalFootnote:
    'Votre travail est enregistré dans ce navigateur — images comprises — et restauré à la prochaine visite. Rien n’est envoyé nulle part.',
  gotIt: 'J’ai compris',
}
