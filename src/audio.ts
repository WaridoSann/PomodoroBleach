class Soundscape {
  private ctx: AudioContext | null = null;
  private wind: AudioBufferSourceNode | null = null;
  private windGain: GainNode | null = null;
  async unlock() {
    try {
      this.ctx ??= new AudioContext();
      if (this.ctx.state === "suspended") await this.ctx.resume();
    } catch {
      /* Audio can be unavailable on restricted devices. */
    }
  }
  bell(volume: number, finish = true) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running") return;
    const time = ctx.currentTime;
    [528, 1056, 1584].forEach((frequency, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(
        volume * (i === 0 ? 0.24 : 0.05),
        time + 0.025,
      );
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        time + (finish ? 3.2 : 0.65),
      );
      osc.connect(gain).connect(ctx.destination);
      osc.start(time);
      osc.stop(time + 3.5);
    });
  }
  ambient(enabled: boolean, volume: number) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running") return;
    if (!enabled && this.wind) {
      this.windGain?.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
      this.wind.stop(ctx.currentTime + 1);
      this.wind = null;
      this.windGain = null;
    } else if (enabled) {
      if (!this.wind) {
        const buffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
        const samples = buffer.getChannelData(0);
        let previous = 0;
        for (let i = 0; i < samples.length; i++) {
          previous = (previous + (Math.random() * 2 - 1) * 0.02) / 1.02;
          samples[i] = previous * 3.5;
        }
        this.wind = ctx.createBufferSource();
        this.wind.buffer = buffer;
        this.wind.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 650;
        this.windGain = ctx.createGain();
        this.windGain.gain.value = 0;
        this.wind
          .connect(filter)
          .connect(this.windGain)
          .connect(ctx.destination);
        this.wind.start();
      }
      this.windGain?.gain.setTargetAtTime(volume * 0.3, ctx.currentTime, 0.4);
    }
  }
}
export const audio = new Soundscape();
