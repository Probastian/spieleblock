export * from './core/engine';
export * from './core/lifecycle';
export * from './core/rank';
export * from './core/sanitize';
export * from './core/stats';
export * from './core/trend';
export * from './core/types';
export * from './core/util';
export * from './registry';

// Spiel-spezifische Funktionen bleiben im eigenen Namensraum: `kniffel.commit(...)`
export * as kniffel from './kniffel';
export * as wizard from './wizard';
export * as hitster from './hitster';
export * as tafel from './tafel';
