/** Einfache Begrenzung pro IP und Minute. */
export class RateLimiter {
  private readonly buckets = new Map<string, { t: number; n: number }>();
  private timer: NodeJS.Timeout;

  constructor(private readonly perMinute: number) {
    this.timer = setInterval(() => this.sweep(), 60_000);
    this.timer.unref();
  }

  /** `true`, wenn die IP ihr Kontingent überschritten hat. */
  isLimited(ip: string, now = Date.now()): boolean {
    let b = this.buckets.get(ip);
    if (!b || now - b.t > 60_000) {
      b = { t: now, n: 0 };
      this.buckets.set(ip, b);
    }
    return ++b.n > this.perMinute;
  }

  stop(): void {
    clearInterval(this.timer);
  }

  private sweep(now = Date.now()): void {
    for (const [ip, b] of this.buckets) if (now - b.t > 120_000) this.buckets.delete(ip);
  }
}
