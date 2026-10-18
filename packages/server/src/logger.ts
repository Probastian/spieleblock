export interface Logger {
  info(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

export function createLogger(enabled: boolean): Logger {
  return {
    info: (...args) => {
      if (enabled) console.log(new Date().toISOString(), ...args);
    },
    error: (...args) => console.error(new Date().toISOString(), ...args),
  };
}
