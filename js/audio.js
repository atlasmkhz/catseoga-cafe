// Web Audio로 만드는 소리: 빗소리, 장작 타는 소리, 새 · 풀벌레, 골골송, 야옹, 간식 오독오독 + 배경 음악
import { CONFIG } from './config.js';

export class Sound {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.night = 0;
    this.outdoor = false;
    this.rain = false;
  }

  ensure() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    // 노이즈 버퍼 (핑크 · 브라운)
    const len = ctx.sampleRate * 3;
    const pink = ctx.createBuffer(1, len, ctx.sampleRate);
    const brown = ctx.createBuffer(1, len, ctx.sampleRate);
    {
      const p = pink.getChannelData(0), b = brown.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
        p[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
        last = (last + 0.02 * w) / 1.02; b[i] = last * 3.5;
      }
      // 끊김 없이 이어지도록 끝을 부드럽게
      for (let i = 0; i < 2000; i++) { const k = i / 2000; p[len - 1 - i] *= k; b[len - 1 - i] *= k; p[i] *= k; b[i] *= k; }
    }
    this.pinkBuf = pink;
    this.brownBuf = brown;

    // 빗소리
    this.rainGain = ctx.createGain(); this.rainGain.gain.value = 0; this.rainGain.connect(this.master);
    this.natureGain = ctx.createGain(); this.natureGain.gain.value = 0; this.natureGain.connect(this.master);
    const rain = this.loop(pink);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 400;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    rain.connect(hp).connect(lp).connect(this.rainGain);
    // 장작 (낮은 웅웅 + 탁탁)
    this.fireGain = ctx.createGain(); this.fireGain.gain.value = 0.35; this.fireGain.connect(this.master);
    const rumble = this.loop(brown);
    const flp = ctx.createBiquadFilter(); flp.type = 'lowpass'; flp.frequency.value = 320;
    const rg = ctx.createGain(); rg.gain.value = 0.5;
    rumble.connect(flp).connect(rg).connect(this.fireGain);

    this.purrGain = ctx.createGain(); this.purrGain.gain.value = 0; this.purrGain.connect(this.master);
    this.purrUntil = 0;
    this.tick = setInterval(() => this.schedule(), 60);
    this.setupMusic();
    this.mix();
  }

  loop(buf) {
    const s = this.ctx.createBufferSource();
    s.buffer = buf; s.loop = true;
    s.start(0, Math.random() * 2);
    return s;
  }

  // 빗방울 · 장작 탁탁 · 골골송 스케줄링
  schedule() {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx, now = ctx.currentTime;
    // 새 (낮 · 정원 · 맑은 날) / 풀벌레 (밤 · 정원)
    if (this.outdoor && !this.rain && this.night < 0.5 && Math.random() < 0.035) this.bird(now + Math.random() * 0.05);
    if (this.outdoor && this.night >= 0.5 && Math.random() < 0.12) this.cricket(now);
    // 빗방울 톡톡
    for (let i = 0; i < 2; i++) if (this.rain && Math.random() < 0.55) this.click(now + Math.random() * 0.06, 2500 + Math.random() * 3500, 0.015 + Math.random() * 0.03, 0.012, this.rainGain);
    // 장작 탁탁 (실내에서만 또렷하게)
    if (!this.outdoor && Math.random() < 0.09 + this.night * 0.08) {
      const burst = Math.random() < 0.25 ? 3 + Math.floor(Math.random() * 4) : 1;
      for (let i = 0; i < burst; i++) this.click(now + i * (0.02 + Math.random() * 0.05), 900 + Math.random() * 2200, 0.12 + Math.random() * 0.25, 0.02 + Math.random() * 0.03, this.fireGain);
    }
    // 골골송
    if (now < this.purrUntil) {
      if (!this.purrNext || this.purrNext < now) this.purrNext = now;
      while (this.purrNext < now + 0.2) {
        this.purrBreath(this.purrNext);
        this.purrNext += 1.25 + Math.random() * 0.2;
      }
    }
  }

  click(t, freq, gain, dur, dest) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.pinkBuf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(g).connect(dest);
    src.start(t, Math.random() * 2, dur + 0.02);
  }

  // 들숨 · 날숨 한 번 (25Hz 안팎으로 진동하는 낮은 소리)
  purrBreath(t) {
    const ctx = this.ctx;
    for (const [off, dur, rate, amp] of [[0, 0.55, 27, 0.5], [0.6, 0.6, 23, 0.8]]) {
      const src = ctx.createBufferSource();
      src.buffer = this.brownBuf;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
      const am = ctx.createGain(); am.gain.value = 0;
      const lfo = ctx.createOscillator(); lfo.type = 'sawtooth'; lfo.frequency.value = rate;
      const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.5;
      lfo.connect(lfoGain).connect(am.gain);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t + off);
      env.gain.linearRampToValueAtTime(amp, t + off + dur * 0.3);
      env.gain.linearRampToValueAtTime(amp * 0.8, t + off + dur * 0.7);
      env.gain.linearRampToValueAtTime(0, t + off + dur);
      const body = ctx.createOscillator(); body.type = 'triangle'; body.frequency.value = rate * 2;
      const bodyG = ctx.createGain(); bodyG.gain.value = 0.25;
      body.connect(bodyG).connect(am);
      src.connect(lp).connect(am).connect(env).connect(this.purrGain);
      src.start(t + off, Math.random() * 2, dur + 0.05);
      lfo.start(t + off); lfo.stop(t + off + dur + 0.05);
      body.start(t + off); body.stop(t + off + dur + 0.05);
    }
  }

  purr(sec = 4) {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.purrUntil = Math.max(this.purrUntil, now + sec);
    this.purrGain.gain.cancelScheduledValues(now);
    this.purrGain.gain.setTargetAtTime(0.9, now, 0.2);
    this.purrGain.gain.setTargetAtTime(0, now + sec, 0.4);
  }

  meow() {
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + 0.02;
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(520, t);
    o.frequency.linearRampToValueAtTime(820, t + 0.18);
    o.frequency.linearRampToValueAtTime(600, t + 0.45);
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = 5;
    f1.frequency.setValueAtTime(700, t); f1.frequency.linearRampToValueAtTime(1500, t + 0.2); f1.frequency.linearRampToValueAtTime(900, t + 0.45);
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.Q.value = 6; f2.frequency.value = 2600;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.35, t + 0.06);
    g.gain.linearRampToValueAtTime(0.25, t + 0.3);
    g.gain.linearRampToValueAtTime(0, t + 0.5);
    const g2 = ctx.createGain(); g2.gain.value = 0.4;
    o.connect(f1).connect(g);
    o.connect(f2).connect(g2).connect(g);
    g.connect(this.master);
    o.start(t); o.stop(t + 0.55);
  }

  crunch() {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 6; i++) this.click(t + i * 0.16 + Math.random() * 0.04, 1800 + Math.random() * 1500, 0.25, 0.05, this.master);
  }

  // 새 지저귐: 짧게 위아래로 미끄러지는 높은 음 몇 개
  bird(t) {
    const ctx = this.ctx;
    const n = 2 + Math.floor(Math.random() * 4);
    const base = 2600 + Math.random() * 1800;
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator(); o.type = 'sine';
      const g = ctx.createGain();
      const st = t + i * (0.09 + Math.random() * 0.05), d = 0.06 + Math.random() * 0.05;
      o.frequency.setValueAtTime(base * (0.9 + Math.random() * 0.2), st);
      o.frequency.exponentialRampToValueAtTime(base * (1.25 + Math.random() * 0.3), st + d * 0.5);
      o.frequency.exponentialRampToValueAtTime(base * 0.85, st + d);
      g.gain.setValueAtTime(0, st);
      g.gain.linearRampToValueAtTime(0.05, st + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, st + d);
      o.connect(g).connect(this.natureGain);
      o.start(st); o.stop(st + d + 0.02);
    }
  }

  // 풀벌레: 높은 음을 빠르게 끊어서
  cricket(t) {
    const ctx = this.ctx;
    const f = 4200 + Math.random() * 600;
    for (let i = 0; i < 3; i++) {
      const st = t + i * 0.045;
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, st);
      g.gain.linearRampToValueAtTime(0.018, st + 0.008);
      g.gain.linearRampToValueAtTime(0, st + 0.03);
      o.connect(g).connect(this.natureGain);
      o.start(st); o.stop(st + 0.035);
    }
  }

  // ---------- 배경 음악 (낮 · 밤 두 곡을 엇갈려 켜기) ----------
  setupMusic() {
    const m = CONFIG.music;
    if (!m) return;
    this.music = {};
    for (const k of ['day', 'night']) {
      if (!m[k]) continue;
      const el = new Audio();
      el.src = m[k];
      el.loop = true;
      el.preload = 'none';
      el.crossOrigin = 'anonymous';
      el.addEventListener('error', () => { this.music[k] = null; });
      const g = this.ctx.createGain();
      g.gain.value = 0;
      try { this.ctx.createMediaElementSource(el).connect(g).connect(this.master); } catch { continue; }
      this.music[k] = { el, g, playing: false };
    }
  }

  mix() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const n = this.night;
    this.fireGain.gain.setTargetAtTime(this.outdoor ? 0.05 : 0.3 + n * 0.45, now, 0.6);
    this.rainGain.gain.setTargetAtTime(this.rain ? (this.outdoor ? 0.75 : 0.4) : 0, now, 0.8);
    this.natureGain.gain.setTargetAtTime(this.outdoor ? 1 : 0.15, now, 0.8);
    const vol = CONFIG.music?.volume ?? 0.35;
    for (const [k, w] of [['day', 1 - n], ['night', n]]) {
      const mu = this.music?.[k];
      if (!mu) continue;
      const v = this.enabled ? vol * w : 0;
      mu.g.gain.setTargetAtTime(v, now, 1.2);
      if (v > 0.001 && !mu.playing) { mu.playing = true; mu.el.play().catch(() => { mu.playing = false; }); }
      if (v <= 0.001 && mu.playing) {
        clearTimeout(mu.stopT);
        mu.stopT = setTimeout(() => { if (mu.g.gain.value < 0.01) { mu.el.pause(); mu.playing = false; } }, 5000);
      }
    }
  }

  setNight(n) { this.night = n; this.mix(); }
  setOutdoor(o) { if (o === this.outdoor) return; this.outdoor = o; this.mix(); }
  setRain(on) { this.rain = on; this.mix(); }

  setEnabled(on) {
    this.ensure();
    if (!this.ctx) return false;
    this.enabled = on;
    if (on && this.ctx.state === 'suspended') this.ctx.resume();
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(on ? 0.8 : 0, now, 0.4);
    this.mix();
    return true;
  }
}
