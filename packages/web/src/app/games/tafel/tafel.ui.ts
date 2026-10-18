import type { GameUi } from '../game-ui';

export const tafelUi: GameUi = {
  id: 'tafel',
  name: 'Punktetafel',
  blurb: 'Für jedes andere Spiel: Runden eintragen, Summen laufen mit.',
  tags: ['Beliebig viele Runden', 'Ziel optional'],
  tile: 'var(--mint)',
  icon: 'board',
  startLabel: 'Tafel starten',
  reviewLabel: 'Runden ansehen',
  setup: () => import('./tafel-setup.component').then(m => m.TafelSetup),
  board: () => import('./tafel-board.component').then(m => m.TafelBoard),
  endExtras: () => import('./tafel-end.component').then(m => m.TafelEnd),
};
