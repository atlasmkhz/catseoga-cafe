// 화면 조작: 톡(걷기 · 누르기), 끌기(시점 돌리기), 꾹 누른 채 끌기(그쪽으로 걷기), 두 손가락(확대 · 축소)
// 키보드(WASD · 방향키 · Q/E)는 보조
export class Controls {
  constructor(el, h) {
    this.el = el;
    this.h = h; // { tap, drag, pinch, holdStart, holdMove, holdEnd, wheel }
    this.ptrs = new Map();
    this.keys = new Set();
    this.mode = null;
    this.enabled = true;

    el.addEventListener('pointerdown', (e) => this.down(e));
    el.addEventListener('pointermove', (e) => this.move(e));
    el.addEventListener('pointerup', (e) => this.up(e));
    el.addEventListener('pointercancel', (e) => this.up(e, true));
    el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') this.up(e, true); });
    el.addEventListener('wheel', (e) => { e.preventDefault(); this.h.wheel?.(e.deltaY); }, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      if (e.target.closest?.('input, textarea')) return;
      this.keys.add(e.key.toLowerCase());
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }

  down(e) {
    if (!this.enabled) return;
    this.el.setPointerCapture?.(e.pointerId);
    this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() });
    if (this.ptrs.size === 1) {
      this.mode = 'pending';
      clearTimeout(this.holdTimer);
      this.holdTimer = setTimeout(() => {
        if (this.mode === 'pending') {
          this.mode = 'hold';
          const p = [...this.ptrs.values()][0];
          this.h.holdStart?.(p.x, p.y);
        }
      }, 380);
    } else if (this.ptrs.size === 2) {
      clearTimeout(this.holdTimer);
      if (this.mode === 'hold') this.h.holdEnd?.();
      this.mode = 'pinch';
      this.pinchD = this.pinchDist();
      this.pinchMid = this.pinchCenter();
    }
  }

  move(e) {
    const p = this.ptrs.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (this.mode === 'pending') {
      if (Math.hypot(p.x - p.sx, p.y - p.sy) > 9) { this.mode = 'drag'; clearTimeout(this.holdTimer); }
    }
    if (this.mode === 'drag') this.h.drag?.(dx, dy);
    else if (this.mode === 'hold') this.h.holdMove?.(p.x, p.y);
    else if (this.mode === 'pinch' && this.ptrs.size >= 2) {
      const d = this.pinchDist();
      if (this.pinchD > 0) this.h.pinch?.(this.pinchD / d);
      this.pinchD = d;
      const c = this.pinchCenter();
      this.h.drag?.((c.x - this.pinchMid.x) * 0.6, (c.y - this.pinchMid.y) * 0.6);
      this.pinchMid = c;
    }
  }

  up(e, cancel = false) {
    const p = this.ptrs.get(e.pointerId);
    if (!p) return;
    this.ptrs.delete(e.pointerId);
    clearTimeout(this.holdTimer);
    if (this.mode === 'pending' && !cancel && performance.now() - p.t < 600) this.h.tap?.(p.x, p.y);
    if (this.mode === 'hold') this.h.holdEnd?.();
    if (this.ptrs.size === 0) this.mode = null;
    else if (this.mode === 'pinch') this.mode = 'drag-after-pinch';
  }

  pinchDist() { const [a, b] = [...this.ptrs.values()]; return Math.hypot(a.x - b.x, a.y - b.y); }
  pinchCenter() { const [a, b] = [...this.ptrs.values()]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }

  // 키보드 이동 방향 (카메라 기준) [오른쪽, 앞]
  axis() {
    const k = this.keys;
    let x = 0, y = 0;
    if (k.has('w') || k.has('arrowup')) y += 1;
    if (k.has('s') || k.has('arrowdown')) y -= 1;
    if (k.has('a') || k.has('arrowleft')) x -= 1;
    if (k.has('d') || k.has('arrowright')) x += 1;
    return [x, y];
  }
  turn() {
    let r = 0;
    if (this.keys.has('q')) r += 1;
    if (this.keys.has('e')) r -= 1;
    return r;
  }
}
