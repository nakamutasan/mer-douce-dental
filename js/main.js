// =========================================
// MER DOUCE DENTAL CLINIC：トップ画面の動き
//
// 歯の写真（AIで作った画像）に、次の動きを重ねています。
// ・暗闇からスポットライトが点くように現れる（style.css）
// ・写真がゆっくり呼吸するように近づく／ゆれる（style.css）
// ・金の光の粒が、歯のまわりでまたたきながら漂う（このファイル）
// ・ゆっくり左右に傾き、マウス・指でなぞると立体的に傾く（このファイル）
// ・下にスクロールすると、写真が静かに暗く沈む（このファイル）
//
// ※前の 3D の歯は、mer-douce-dental-v4 フォルダに残してあります。
// =========================================

(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.documentElement.classList.add('js');

  // --- ヘッダー：スクロールすると、すりガラスの帯に変わる ---
  const header = document.querySelector('.header');
  const onHeader = () => header.classList.toggle('is-scrolled', window.scrollY > 40);
  window.addEventListener('scroll', onHeader, { passive: true });
  onHeader();

  // --- スマホ用メニュー：右上のボタンで開け閉め ---
  const toggle = document.querySelector('.menu-toggle');
  const setMenu = (open) => {
    header.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
    document.body.style.overflow = open ? 'hidden' : '';
  };
  toggle.addEventListener('click', () => setMenu(!header.classList.contains('is-open')));
  // メニューの中のリンクを押したら、閉じてからその場所へ
  document.querySelectorAll('.nav a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && header.classList.contains('is-open')) {
      setMenu(false);
      toggle.focus();
    }
  });
  // 画面を広げてメニューが要らなくなったら、閉じておく
  window.matchMedia('(min-width: 1025px)').addEventListener('change', (e) => {
    if (e.matches) setMenu(false);
  });

  // --- スクロールして画面に入った部分を、ふわっと浮かび上がらせる ---
  const reveals = document.querySelectorAll('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    reveals.forEach((el) => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        // 同じ並びの中では、少しずつ時間をずらして現れる
        const siblings = [...entry.target.parentElement.children].filter((c) => c.classList.contains('reveal'));
        const i = Math.max(0, siblings.indexOf(entry.target));
        entry.target.style.transitionDelay = `${Math.min(i, 5) * 0.12}s`;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
    reveals.forEach((el) => io.observe(el));
  }

  const visual = document.querySelector('.hero-visual');
  if (!visual) return;
  const mover = visual.querySelector('.hv-move');
  const canvas = visual.querySelector('.hv-sparks');
  const ctx = canvas.getContext('2d');

  // 写真の中で、歯がある場所（写真の幅・高さに対する割合）
  const PHOTOS = {
    wide: { w: 1672, h: 941, posX: 0.7, posY: 0.5, cx: 0.745, cy: 0.47, rw: 0.13, rh: 0.3, beamX: 0.72 },
    tall: { w: 941, h: 1672, posX: 0.5, posY: 0.3, cx: 0.58, cy: 0.35, rw: 0.22, rh: 0.16, beamX: 0.62 },
  };

  let W = 0, H = 0, dpr = 1;
  let tooth = { x: 0, y: 0, rx: 100, ry: 100, beamX: 0 };

  // 「画面いっぱいに写真をしきつめた（cover）」ときに、歯が画面のどこに来るかを計算する
  function layout() {
    W = window.innerWidth;
    H = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const p = W / H <= 1 ? PHOTOS.tall : PHOTOS.wide;
    // 写真の箱は、画面より上下左右 7% ずつ大きい（style.css の .hv-move）
    const BW = W * 1.14, BH = H * 1.14;
    const s = Math.max(BW / p.w, BH / p.h);
    const dw = p.w * s, dh = p.h * s;
    const ox = -W * 0.07 + (BW - dw) * p.posX, oy = -H * 0.07 + (BH - dh) * p.posY;
    // 歯を置きたい横の位置：広い画面は少し右寄り、狭い画面（900px 以下）は真ん中
    const target = W > 900 ? 0.64 : 0.5;
    const shiftX = Math.min(0, W * target - (ox + p.cx * dw)); // 左へずらす量（右へはずらさない）
    visual.style.setProperty('--hv-shift-x', `${shiftX.toFixed(1)}px`);

    tooth = {
      x: ox + p.cx * dw + shiftX,
      y: oy + p.cy * dh + H * (W / H <= 1 ? 0.05 : 0.06), // 写真を下へずらしたぶん（style.css の --hv-shift と同じ）
      rx: p.rw * dw,
      ry: p.rh * dh,
      beamX: ox + p.beamX * dw + shiftX,
    };
  }

  // --- 金の光の粒の「にじんだ光」を、先に1つ描いておく（毎回描くより軽い） ---
  const glow = document.createElement('canvas');
  glow.width = glow.height = 64;
  {
    const g = glow.getContext('2d');
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 244, 214, 1)');
    grad.addColorStop(0.18, 'rgba(255, 214, 140, 0.85)');
    grad.addColorStop(0.45, 'rgba(214, 160, 80, 0.25)');
    grad.addColorStop(1, 'rgba(184, 146, 79, 0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  }

  // ふつうの乱数を、真ん中に集まりやすい乱数にする（歯のまわりに粒を集めるため）
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  const COUNT = small ? 26 : 44;
  const sparks = [];

  function spawn(s, first) {
    const inBeam = Math.random() < 0.3; // 3割は、スポットライトの光の筋の中を漂うちり
    if (inBeam) {
      s.x = tooth.beamX + gauss() * tooth.rx * 0.6;
      s.y = tooth.y - tooth.ry * (0.6 + Math.random() * 1.4);
      s.size = 3 + Math.random() * 5;
      s.peak = 0.25 + Math.random() * 0.35;
    } else {
      s.x = tooth.x + gauss() * tooth.rx * 1.9;
      s.y = tooth.y + gauss() * tooth.ry * 1.4;
      s.size = 5 + Math.random() * 12;
      s.peak = 0.45 + Math.random() * 0.55;
    }
    s.vx = (Math.random() - 0.5) * 4;      // 1秒あたりの横の動き（ごくわずか）
    s.vy = -(2 + Math.random() * 7);       // ゆっくり上へ
    s.life = 6 + Math.random() * 8;        // 何秒で消えるか
    s.age = first ? Math.random() * s.life : 0;
    s.tw = 1.5 + Math.random() * 3;        // またたきの速さ
    s.ph = Math.random() * Math.PI * 2;
  }

  // --- マウス・指で、写真が立体的に少し傾く／スクロールで沈む ---
  // パソコン：マウスの位置に合わせて傾く
  // スマホ：画面を横になぞると傾き、指をはなすと、ゆっくり元にもどる
  let px = 0, py = 0, tx = 0, ty = 0;
  if (!reduceMotion) {
    if (window.matchMedia('(pointer: fine)').matches) {
      window.addEventListener('pointermove', (e) => {
        tx = (e.clientX / W - 0.5) * 2;
        ty = (e.clientY / H - 0.5) * 2;
      }, { passive: true });
    }
    let startX = 0, startY = 0, touching = false;
    window.addEventListener('touchstart', (e) => {
      touching = true;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (!touching) return;
      const dx = (e.touches[0].clientX - startX) / (W * 0.5);
      const dy = (e.touches[0].clientY - startY) / (H * 0.5);
      tx = Math.max(-1, Math.min(1, dx));
      ty = Math.max(-1, Math.min(1, dy)) * 0.3;
    }, { passive: true });
    const release = () => { touching = false; tx = 0; ty = 0; };
    window.addEventListener('touchend', release, { passive: true });
    window.addEventListener('touchcancel', release, { passive: true });
  }

  function applyScroll() {
    const k = Math.min(Math.max(window.scrollY / (H * 0.9), 0), 1);
    visual.style.opacity = String(1 - k); // 下のセクションでは、歯の写真は見えなくなるまで沈める
    return k;
  }

  function drawSparks(t) {
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for (const s of sparks) {
      const life = s.age / s.life;
      const fade = Math.sin(Math.PI * Math.min(Math.max(life, 0), 1)); // 生まれて、ふわっと消える
      const twinkle = 0.55 + 0.45 * Math.sin(t * s.tw + s.ph);
      const a = s.peak * fade * twinkle;
      if (a <= 0.01) continue;
      ctx.globalAlpha = a;
      const d = s.size;
      ctx.drawImage(glow, s.x - d / 2, s.y - d / 2, d, d);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  layout();
  for (let i = 0; i < COUNT; i++) {
    const s = {};
    spawn(s, true);
    sparks.push(s);
  }

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      layout();
      sparks.forEach((s) => spawn(s, true));
      if (reduceMotion) drawSparks(0);
    }, 150);
  });

  // 「動きを減らす」設定の人には、光の粒を止めた状態で1回だけ描く
  if (reduceMotion) {
    window.addEventListener('scroll', applyScroll, { passive: true });
    applyScroll();
    drawSparks(0);
    return;
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const k = applyScroll();

    // マウス・指の動きに、ゆっくり追いつく
    px += (tx - px) * 0.05;
    py += (ty - py) * 0.05;
    const sy = window.scrollY * 0.12;
    // 何もしなくても、ゆっくり左右に首をふるように傾く（＋マウス・指のぶん）
    const t = now / 1000;
    const rotY = Math.sin(t * 0.28) * 2.2 + px * 4.5;   // 左右の傾き（度）
    const rotX = Math.sin(t * 0.2 + 1) * 0.8 - py * 2.5; // 上下の傾き（度）
    mover.style.transform =
      `perspective(1600px) translate3d(${(-px * 10).toFixed(2)}px, ${(-py * 8 - sy).toFixed(2)}px, 0) ` +
      `rotateY(${rotY.toFixed(3)}deg) rotateX(${rotX.toFixed(3)}deg)`;
    canvas.style.transform = `translate3d(${(-px * 22).toFixed(2)}px, ${(-py * 16 - sy * 1.4).toFixed(2)}px, 0)`;

    // トップ画面が見えている間だけ、光の粒を動かす（電池の節約）
    if (k < 1) {
      for (const s of sparks) {
        s.age += dt;
        s.x += (s.vx + Math.sin(now / 1000 * 0.6 + s.ph) * 3) * dt;
        s.y += s.vy * dt;
        if (s.age >= s.life) spawn(s, false);
      }
      drawSparks(now / 1000);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

// --- お知らせ：Google スプレッドシートから読み込む ---
// ▼ スプレッドシートを「ウェブに公開」したときの CSV のアドレスを、'' の中に貼ります。
//   空のままなら、HTML に書いてある見本のお知らせがそのまま出ます。
//   表の形：1行目は見出し（日付・ラベル・お知らせ）、2行目から上に新しいものを書く
const NEWS_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTqrSwiNJADVyRyXVG6w2o2cJCszinIeHi3V2eZCcGlmAZeY7TZJb47h7iHRYBHIyQe0OSNsgoR_y0H/pub?gid=0&single=true&output=csv';
const NEWS_MAX = 5; // 表示するお知らせの数（上から順に）

// CSV（カンマ区切りの文字）を、表の形（行と列）に直す
function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// 表を読んで [{ date, tag, text }, ...] にする。読めないときは null（見本のお知らせのまま）
async function fetchNews() {
  if (!NEWS_SHEET_URL) return null;
  try {
    const res = await fetch(NEWS_SHEET_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(res.status);
    const items = parseCSV(await res.text())
      .slice(1)
      .map((r) => ({ date: (r[0] || '').trim(), tag: (r[1] || '').trim(), text: (r[2] || '').trim() }))
      .filter((n) => n.text)
      .slice(0, NEWS_MAX);
    return items.length ? items : null;
  } catch (err) {
    console.warn('お知らせを読み込めませんでした', err);
    return null;
  }
}

// 「2026.11.10」「2026/11/10」「2026年11月10日」を、機械が読める日付（2026-11-10）にする
function toISODate(s) {
  const m = s.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : '';
}

// 文字は textContent で入れる（表に何を書かれても、安全に文字として出す）
function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text != null) e.textContent = text;
  return e;
}

(async function loadNews() {
  const list = document.getElementById('news-list');
  const items = await fetchNews();
  if (!list || !items) return;
  list.replaceChildren(...items.map((n) => {
    const li = el('li', n.tag ? '' : 'no-tag');
    const time = el('time', '', n.date);
    const iso = toISODate(n.date);
    if (iso) time.dateTime = iso;
    li.append(time, el('span', 'news-tag', n.tag), el('p', '', n.text));
    return li;
  }));
})();
