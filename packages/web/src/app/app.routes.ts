import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'spiele' },
  ...(['spiele', 'spieler', 'verlauf'] as const).map(tab => ({
    path: tab,
    data: { tab },
    loadComponent: () => import('./features/hub/hub.page').then(m => m.HubPage),
  })),
  { path: 'neu/:type', loadComponent: () => import('./features/setup/setup.page').then(m => m.SetupPage) },
  { path: 'spiel/:id', loadComponent: () => import('./features/play/play.page').then(m => m.PlayPage) },
  { path: '**', redirectTo: 'spiele' },
];
