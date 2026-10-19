import type { GameUi } from '../game-ui';

export const wavelengthUi: GameUi = {
  id: 'wavelength',
  name: 'Wavelength',
  blurb: 'Ein geheimes Ziel zwischen zwei Gegensätzen: Hinweis geben, Regler einstellen, Treffer zählen.',
  tags: ['2 bis 8 Spieler', 'Live-Tisch ideal'],
  tile: 'var(--accent-soft)',
  icon: 'dial',
  startLabel: 'Wavelength starten',
  experimental: true,
  reviewLabel: 'Runden ansehen',
  setup: () => import('./wavelength-setup.component').then(m => m.WavelengthSetup),
  board: () => import('./wavelength-board.component').then(m => m.WavelengthBoard),
  menuExtras: () => import('./wavelength-menu-extras.component').then(m => m.WavelengthMenuExtras),
  endExtras: () => import('./wavelength-end.component').then(m => m.WavelengthEnd),
};
