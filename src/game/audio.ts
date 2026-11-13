class AlpineAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private riverGain: GainNode | null = null;
  private riverFilter: BiquadFilterNode | null = null;
  private helicopterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private volume = 0.72;
  private initialized = false;
  private lastBreathTime = 0;

  public init() {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);

      const sampleRate = this.ctx.sampleRate;
      const length = sampleRate * 2;
      this.noiseBuffer = this.ctx.createBuffer(1, length, sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + white * 0.099046;
        b1 = 0.963 * b1 + white * 0.2965164;
        b2 = 0.57 * b2 + white * 1.0526913;
        data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.18;
      }

      // Wind Ambience
      const windSource = this.ctx.createBufferSource();
      windSource.buffer = this.noiseBuffer;
      windSource.loop = true;
      this.windFilter = this.ctx.createBiquadFilter();
      this.windFilter.type = 'bandpass';
      this.windFilter.frequency.value = 300;
      this.windFilter.Q.value = 1.4;
      this.windGain = this.ctx.createGain();
      this.windGain.gain.value = 0.08;
      windSource.connect(this.windFilter);
      this.windFilter.connect(this.windGain);
      this.windGain.connect(this.masterGain);
      windSource.start();

      // Glacial River / Flood Ambience
      const riverSource = this.ctx.createBufferSource();
      riverSource.buffer = this.noiseBuffer;
      riverSource.loop = true;
      this.riverFilter = this.ctx.createBiquadFilter();
      this.riverFilter.type = 'lowpass';
      this.riverFilter.frequency.value = 680;
      this.riverGain = this.ctx.createGain();
      this.riverGain.gain.value = 0.0;
      riverSource.connect(this.riverFilter);
      this.riverFilter.connect(this.riverGain);
      this.riverGain.connect(this.masterGain);
      riverSource.start();

      // Rescue Helicopter Rotor Loop (modulated amplitude pulse)
      const heliOsc = this.ctx.createOscillator();
      heliOsc.type = 'sawtooth';
      heliOsc.frequency.value = 22;
      const heliFilter = this.ctx.createBiquadFilter();
      heliFilter.type = 'lowpass';
      heliFilter.frequency.value = 140;
      this.helicopterGain = this.ctx.createGain();
      this.helicopterGain.gain.value = 0.0;
      heliOsc.connect(heliFilter);
      heliFilter.connect(this.helicopterGain);
      this.helicopterGain.connect(this.masterGain);
      heliOsc.start();

      // Atmospheric Alpine Pad
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.0;
      this.musicGain.connect(this.masterGain);
      const droneFilter = this.ctx.createBiquadFilter();
      droneFilter.type = 'lowpass';
      droneFilter.frequency.value = 380;
      droneFilter.connect(this.musicGain);

      [73.42, 110.0, 146.83, 174.61].forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
        osc.frequency.value = freq;
        const g = this.ctx.createGain();
        g.gain.value = 0.12 / (idx + 1);
        osc.connect(g);
        g.connect(droneFilter);
        osc.start();
      });

      this.initialized = true;
    } catch {
      // Audio unavailable
    }
  }

  public setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.08);
    }
  }

  public setMusicIntensity(level: number) {
    if (!this.ctx || !this.musicGain) return;
    this.musicGain.gain.setTargetAtTime(
      Math.max(0, Math.min(0.22, level)),
      this.ctx.currentTime,
      0.6
    );
  }

  public setRiverVolume(intensity: number) {
    if (!this.ctx || !this.riverGain) return;
    this.riverGain.gain.setTargetAtTime(
      Math.max(0, Math.min(0.32, intensity * 0.32)),
      this.ctx.currentTime,
      0.2
    );
  }

  public setHelicopterVolume(intensity: number) {
    if (!this.ctx || !this.helicopterGain) return;
    this.helicopterGain.gain.setTargetAtTime(
      Math.max(0, Math.min(0.26, intensity * 0.26)),
      this.ctx.currentTime,
      0.25
    );
  }

  public updateWind(intensity: number, timeSec: number) {
    if (!this.ctx || !this.windGain || !this.windFilter) return;
    const gust = 0.5 + 0.5 * Math.sin(timeSec * 0.65) * Math.cos(timeSec * 0.27);
    const targetGain = 0.05 + intensity * 0.28 + gust * intensity * 0.14;
    const targetFreq = 210 + intensity * 480 + gust * 280;
    this.windGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.15);
    this.windFilter.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.2);
  }

  public playFootstep(running = false) {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = running ? 1150 : 880;
    filter.Q.value = 1.8;

    const gain = this.ctx.createGain();
    const peak = running ? 0.16 : 0.1;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(now, Math.random() * 1.2, 0.13);
  }

  public playIceAxe() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1450, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.075);
    const oscGain = this.ctx.createGain();
    oscGain.gain.setValueAtTime(0.16, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.1);

    if (this.noiseBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 1800;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.15, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      src.connect(filter);
      filter.connect(g);
      g.connect(this.masterGain);
      src.start(now, Math.random() * 0.8, 0.12);
    }
  }

  public playRopeClip() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2200, now);
    osc.frequency.exponentialRampToValueAtTime(980, now + 0.06);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.14, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playHeadlampClick() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1600, now);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.08, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.03);
  }

  public playRockfallPebbles() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const t = now + i * 0.16 + Math.random() * 0.06;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(900 + Math.random() * 600, t);
      osc.frequency.exponentialRampToValueAtTime(240, t + 0.04);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.06);
    }
  }

  public playBoulderImpact() {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 240;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.28, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    src.start(now, 0.2, 0.4);
  }

  public playThunder() {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, now);
    filter.frequency.exponentialRampToValueAtTime(75, now + 1.4);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.32, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.6);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    src.start(now, 0, 1.65);
  }

  public playIceCrack() {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2600, now);
    filter.frequency.exponentialRampToValueAtTime(160, now + 0.36);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.28, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    src.start(now, 0.1, 0.42);
  }

  public playSlip() {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.22, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    src.start(now, 0.3, 0.35);
  }

  public playOxygenHiss() {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 3200;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.18, now + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    src.start(now, 0.2, 0.5);
  }

  public playRepair() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    [0, 0.14].forEach((offset, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(idx === 0 ? 680 : 920, now + offset);
      osc.frequency.exponentialRampToValueAtTime(320, now + offset + 0.08);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.16, now + offset);
      g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.1);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(now + offset);
      osc.stop(now + offset + 0.11);
    });
  }

  public playAvalanche() {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 180;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.01, now);
    g.gain.linearRampToValueAtTime(0.36, now + 0.35);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.55);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    src.start(now, 0, 1.6);
  }

  public updateBreathing(stress: number, nowSec: number) {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer || stress < 0.35) return;
    const interval = 1.55 - stress * 0.72;
    if (nowSec - this.lastBreathTime < interval) return;
    this.lastBreathTime = nowSec;

    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 620;
    filter.Q.value = 2.0;
    const g = this.ctx.createGain();
    const peak = 0.05 + stress * 0.11;
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(peak, now + 0.12);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    src.start(now, Math.random() * 0.5, 0.38);
  }

  public playFlareIgnite() {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2200, now);
    filter.frequency.exponentialRampToValueAtTime(1100, now + 0.65);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.01, now);
    g.gain.linearRampToValueAtTime(0.24, now + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.72);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    src.start(now, 0.1, 0.75);
  }

  public playWildlifeGrowl() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(115, now);
    osc.frequency.exponentialRampToValueAtTime(64, now + 0.42);
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 260;
    filter.Q.value = 2.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.01, now);
    g.gain.linearRampToValueAtTime(0.22, now + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
    osc.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.52);
  }

  public playQteAlert() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    [0, 0.13].forEach((offset) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now + offset);
      osc.frequency.setValueAtTime(1174, now + offset + 0.05);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.18, now + offset);
      g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.11);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(now + offset);
      osc.stop(now + offset + 0.12);
    });
  }

  public playQteSuccess() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    [523.25, 783.99].forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.16, now + idx * 0.08);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.25);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.28);
    });
  }

  public playObstaclePush() {
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 340;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.24, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    src.start(now, 0.15, 0.36);
  }

  public playVictory() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const notes = [261.63, 329.63, 392.0, 523.25];
    notes.forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.14);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.001, now + i * 0.14);
      g.gain.linearRampToValueAtTime(0.14, now + i * 0.14 + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.14 + 0.9);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(now + i * 0.14);
      osc.stop(now + i * 0.14 + 0.95);
    });
  }

  public speakSubtitle(text: string, enabled: boolean) {
    if (!enabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 0.92;
      utter.pitch = 0.85;
      utter.volume = Math.min(1, this.volume * 0.9);
      window.speechSynthesis.speak(utter);
    } catch {
      // Speech synthesis not supported
    }
  }

  public stopSpeech() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
  }
}

export const audioEngine = new AlpineAudioEngine();
