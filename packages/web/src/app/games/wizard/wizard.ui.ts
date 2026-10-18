import type { GameUi } from '../game-ui';

export const wizardUi: GameUi = {
  id: 'wizard',
  name: 'Wizard',
  blurb: 'Stiche ansagen, Runde für Runde zählen, mit Diagramm zum Punkteverlauf.',
  tags: ['3 bis 6 Spieler', 'Diagramm'],
  tile: 'var(--lilac)',
  icon: 'wizard',
  startLabel: 'Wizard starten',
  reviewLabel: 'Verlauf ansehen',
  setup: () => import('./wizard-setup.component').then(m => m.WizardSetup),
  board: () => import('./wizard-board.component').then(m => m.WizardBoard),
  menuExtras: () => import('./wizard-menu-extras.component').then(m => m.WizardMenuExtras),
  endExtras: () => import('./wizard-end.component').then(m => m.WizardEnd),
};
