// 화면 위에 떠 있는 UI (모든 안내는 그림 위에 짧게)
import { LOOKS } from './avatar.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class UI {
  init({ name, look, night, server, rain }) {
    this.look = { ...look };
    this.server = server;
    if (server) { $('#roomField').classList.remove('hidden'); this.refreshRooms(); }
    this.setRain(rain);
    $('#btnRain').addEventListener('click', () => {
      const on = this.onToggleRain?.();
      this.setRain(on);
      this.toast(on ? '☔ 비가 내려요' : '☀️ 비가 그쳤어요');
    });
    $('#petBubble').addEventListener('click', () => { if (this.bubbleId) this.onPetBubble?.(this.bubbleId); });
    // 입장 카드
    $('#nameInput').value = name || '';
    this.swatches('#topSwatches', LOOKS.tops, 'top');
    this.swatches('#hairSwatches', LOOKS.hairs, 'hair');
    this.swatches('#skinSwatches', LOOKS.skins, 'skin');
    $('#enterForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const n = $('#nameInput').value.trim().slice(0, 12);
      if (!n) { $('#nameInput').focus(); $('#nameInput').classList.add('shake'); setTimeout(() => $('#nameInput').classList.remove('shake'), 400); return; }
      $('#entry').classList.add('gone');
      $('#hud').classList.remove('hidden');
      this.onEnter?.({ name: n, look: this.look, soundOn: $('#soundOnEnter').checked, room: +$('#roomSelect').value || null });
    });
    // 위쪽 버튼
    this.setNight(night);
    $('#btnNight').addEventListener('click', () => this.setNight(this.onToggleNight?.()));
    $('#btnSound').addEventListener('click', () => this.setSound(this.onToggleSound?.()));
    $('#btnWave').addEventListener('click', () => this.onWave?.());
    $('#btnMyCat').addEventListener('click', () => this.openMyCat());
    $('#cardClose').addEventListener('click', () => this.hideCard());
    // 내 고양이 시트
    $('#myCatClose').addEventListener('click', () => $('#myCatSheet').classList.add('hidden'));
    $('#photoInput').addEventListener('change', (e) => this.handlePhoto(e.target.files?.[0]));
    $('#adoptBtn').addEventListener('click', () => {
      if (!this.pendingCat) return;
      this.pendingCat.name = $('#catNameInput').value.trim().slice(0, 10) || '우리 고양이';
      this.onAdoptCat?.(this.pendingCat);
      $('#myCatSheet').classList.add('hidden');
    });
    $('#sendHomeBtn').addEventListener('click', () => { this.onSendHome?.(); $('#myCatSheet').classList.add('hidden'); });
    this.setCount(1);
  }

  swatches(sel, colors, key) {
    const box = $(sel);
    box.innerHTML = '';
    colors.forEach((c) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sw' + (this.look[key] === c ? ' on' : '');
      b.style.background = c;
      b.setAttribute('aria-label', c);
      b.addEventListener('click', () => {
        this.look[key] = c;
        box.querySelectorAll('.sw').forEach((x) => x.classList.remove('on'));
        b.classList.add('on');
      });
      box.appendChild(b);
    });
    if (!colors.includes(this.look[key])) { this.look[key] = colors[0]; box.firstChild.classList.add('on'); }
  }

  async refreshRooms() {
    if (!this.loadRooms) return;
    const sel = $('#roomSelect');
    try {
      const info = await this.loadRooms();
      const keep = sel.value;
      sel.innerHTML = '';
      const auto = document.createElement('option');
      auto.value = '';
      auto.textContent = info.best ? `빈자리 있는 방으로 (${info.best}호점)` : '빈자리 있는 방으로';
      sel.appendChild(auto);
      for (const r of info.rooms) {
        const o = document.createElement('option');
        o.value = r.n;
        const full = r.count >= info.cap;
        o.textContent = `${r.n}호점 · ${r.count}/${info.cap}명${full ? ' (가득)' : ''}`;
        o.disabled = full;
        sel.appendChild(o);
      }
      sel.value = keep;
    } catch (e) {
      console.warn('방 목록을 못 불러왔어요', e);
    }
  }

  reopenEntry() {
    $('#hud').classList.add('hidden');
    $('#entry').classList.remove('gone');
    this.refreshRooms();
  }

  setRoom(n) { $('#roomNo').textContent = n ? `${n}호점` : ''; }

  setRain(on) {
    $('#btnRain').classList.toggle('off', !on);
    $('#btnRain').title = on ? '비 그치게 하기' : '비 오는 날';
  }

  petBubble(info) {
    const el = $('#petBubble');
    const hide = !info || $('#card').classList.contains('show') && this.cardCat === info.id;
    if (hide) { el.classList.remove('show'); this.bubbleId = null; return; }
    this.bubbleId = info.id;
    el.style.left = info.x + 'px';
    el.style.top = info.y + 'px';
    el.querySelector('span').textContent = `${info.name} 쓰다듬기`;
    el.classList.add('show');
  }

  setNight(on) {
    $('#btnNight').textContent = on ? '🌙' : '☀️';
    $('#btnNight').title = on ? '밤 (누르면 낮)' : '낮 (누르면 밤)';
  }
  setSound(on) {
    $('#btnSound').textContent = on ? '🔊' : '🔈';
    $('#btnSound').classList.toggle('off', !on);
    $('#btnSound').title = on ? '소리 끄기' : '소리 켜기';
  }
  soundNudge() {
    if (this.nudged) return;
    this.nudged = true;
    this.toast('🔈 소리를 켜면 골골송이 들려요');
    $('#btnSound').classList.add('pulse');
    setTimeout(() => $('#btnSound').classList.remove('pulse'), 3000);
  }
  setStatus(s) {
    this.status = s;
    $('#statusDot').className = 'dot ' + s;
    this.renderCount();
  }
  setCount(n) { this.count = n; this.renderCount(); }
  renderCount() {
    const s = this.status;
    $('#count').textContent = s === 'offline' ? '혼자 머무는 중' : s === 'reconnecting' ? '연결 중…' : `${this.count}명 머무는 중`;
  }

  showHint(lines) {
    const el = $('#hint');
    let i = 0;
    const next = () => {
      if (i >= lines.length) { el.classList.remove('show'); return; }
      el.textContent = lines[i++];
      el.classList.add('show');
      this.hintTimer = setTimeout(next, 3600);
    };
    next();
  }

  toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(this.toastT);
    this.toastT = setTimeout(() => el.classList.remove('show'), 2600);
  }

  showProduct(p) {
    this.cardCat = null;
    $('#cardBody').innerHTML = `
      <div class="card-kicker">고양이서가 원목 가구</div>
      <div class="card-title">${esc(p.name)}</div>
      <div class="card-desc">${esc(p.desc)}</div>
      <a class="btn primary" href="${esc(p.url)}" target="_blank" rel="noopener">이 캣타워 보러 가기</a>`;
    this.openCard();
  }

  showCat(def, onTreat) {
    this.cardCat = def.id;
    $('#cardBody').innerHTML = `
      <div class="card-kicker">카페 고양이</div>
      <div class="card-title">${esc(def.name)} <span class="purr">골골…</span></div>
      <div class="card-desc">${esc(def.desc)}</div>
      <button class="btn primary" id="treatBtn" type="button">🐟 간식 주기</button>`;
    $('#treatBtn').addEventListener('click', onTreat);
    this.openCard();
  }

  openCard() {
    $('#card').classList.add('show');
    $('#hint').classList.remove('show');
    clearTimeout(this.cardT);
    this.cardT = setTimeout(() => this.hideCard(), 12000);
  }
  hideCard() { $('#card').classList.remove('show'); }

  openMyCat() {
    const cur = this.getMyCat?.();
    $('#myCatSheet').classList.remove('hidden');
    $('#myCatPreview').classList.add('hidden');
    $('#photoInput').value = '';
    this.pendingCat = null;
    $('#currentCat').classList.toggle('hidden', !cur);
    if (cur) $('#currentCatName').textContent = cur.name || '우리 고양이';
  }

  async handlePhoto(file) {
    if (!file) return;
    $('#photoStatus').textContent = '털색을 살펴보는 중…';
    try {
      const info = await this.onPhoto(file);
      this.pendingCat = info;
      const sw = $('#catSwatches');
      sw.innerHTML = '';
      for (const c of [info.base, info.dark, info.light, info.orange].filter(Boolean)) {
        const d = document.createElement('span'); d.className = 'sw small'; d.style.background = c; sw.appendChild(d);
      }
      const kind = info.patches ? '삼색 얼룩' : info.stripes ? (info.white ? '줄무늬 + 흰 배' : '줄무늬') : info.white ? '두 가지 색' : '단색';
      $('#catKind').textContent = kind;
      $('#myCatPreview').classList.remove('hidden');
      $('#photoStatus').textContent = '';
      $('#catNameInput').focus();
    } catch (e) {
      console.warn(e);
      $('#photoStatus').textContent = '사진을 읽지 못했어요. 다른 사진으로 해 볼까요?';
    }
  }
}
