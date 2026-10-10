class Capture extends AudioWorkletProcessor {
  constructor() {
    super(); this.size = Math.round(sampleRate / 50); this.frame = new Int16Array(this.size); this.offset = 0; this.sequence = 0; this.gain = 1; this.muted = false;
    this.port.onmessage = ({ data }) => { this.gain = data.gain; this.muted = data.muted; };
  }
  process(inputs, outputs) {
    const channels = inputs[0];
    if (!channels?.length) return true;
    for (let i = 0; i < channels[0].length; i++) {
      let value = 0; for (const channel of channels) value += channel[i] / channels.length;
      value = this.muted ? 0 : Math.max(-1, Math.min(1, value * this.gain));
      this.frame[this.offset++] = Math.round(value * (value < 0 ? 32768 : 32767));
      if (this.offset === this.size) {
        this.port.postMessage({ samples: this.frame, sequence: this.sequence++ >>> 0, timestamp: currentTime * 1000, sampleRate }, [this.frame.buffer]);
        this.frame = new Int16Array(this.size); this.offset = 0;
      }
    }
    // Keep the worklet alive without playing the phone microphone back locally.
    for (const output of outputs[0] ?? []) output.fill(0);
    return true;
  }
}
registerProcessor('micbridge-capture', Capture);
