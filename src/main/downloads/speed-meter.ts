export class SpeedMeter {
  private readonly samples: Array<{ time: number; bytes: number }> = [];

  constructor(private readonly windowMs = 2500) {}

  record(bytes: number): void {
    const now = Date.now();
    this.samples.push({ time: now, bytes });
    while (this.samples.length > 0 && now - this.samples[0].time > this.windowMs) this.samples.shift();
  }

  bytesPerSecond(): number {
    if (this.samples.length === 0) return 0;
    const now = Date.now();
    const span = Math.max(500, now - this.samples[0].time);
    const total = this.samples.reduce((sum, sample) => sum + sample.bytes, 0);
    return (total / span) * 1000;
  }
}
