class Playback extends AudioWorkletProcessor {
  constructor() {
    super(); this.ring = new Float32Array(48000); this.write = 0; this.read = 0; this.sourceRate = sampleRate; this.primed = false; this.underruns = 0; this.dropped = 0; this.ticks = 0;
    this.port.onmessage = ({ data }) => {
      if (data.reset) { this.read = this.write; this.primed = false; return; }
      if (data.sampleRate !== this.sourceRate) { this.sourceRate = data.sampleRate; this.write = 0; this.read = 0; this.primed = false; }
      for (const s of data.samples) this.ring[this.write++ % this.ring.length] = s / 32768;
      if (this.write - this.read > this.sourceRate * .2) { this.dropped += this.write - this.read - this.sourceRate * .06; this.read = this.write - this.sourceRate * .06; }
    };
  }
  process(_inputs, outputs) {
    const out = outputs[0]; if (!out?.length) return true;
    if (!this.primed && this.write - this.read >= this.sourceRate * .06) this.primed = true;
    const occupancy = (this.write - this.read) / this.sourceRate;
    const ratio = this.sourceRate / sampleRate * Math.max(.99, Math.min(1.01, 1 + (occupancy - .06) * .08));
    for (let i = 0; i < out[0].length; i++) {
      let value = 0;
      if (this.primed && this.read + 1 < this.write) {
        const base = Math.floor(this.read), fraction = this.read - base;
        value = this.ring[base % this.ring.length] * (1 - fraction) + this.ring[(base + 1) % this.ring.length] * fraction;
        this.read += ratio;
      } else if (this.primed) { this.primed = false; this.underruns++; }
      for (const channel of out) channel[i] = value;
    }
    if (++this.ticks % 100 === 0) this.port.postMessage({ queueMs: (this.write - this.read) / this.sourceRate * 1000, underruns: this.underruns, dropped: Math.round(this.dropped) });
    return true;
  }
}
registerProcessor('micbridge-playback', Playback);
