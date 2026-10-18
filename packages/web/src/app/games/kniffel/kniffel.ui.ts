import type { GameUi } from '../game-ui';

export const kniffelUi: GameUi = {
  id: 'kniffel',
  name: 'Kniffel',
  blurb: 'Würfelblock mit Klassisch und Extreme, Eingabe per Würfel oder Summe.',
  tags: ['Klassisch', 'Extreme'],
  tile: 'var(--accent-soft)',
  icon: 'die5',
  startLabel: 'Kniffel starten',
  setup: () => import('./kniffel-setup.component').then(m => m.KniffelSetup),
  board: () => import('./kniffel-board.component').then(m => m.KniffelBoard),
  menuExtras: () => import('./kniffel-menu-extras.component').then(m => m.KniffelMenuExtras),
};
