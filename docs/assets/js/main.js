// Nicotine landing page. No framework: a few small, independent pieces.
const SITE = window.NICOTINE_SITE || {};
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const STICK_PRICE = 18.5; // design persona's default brand, single stick
const DAYS_PER_MONTH = 30.4;
const taka = (n, decimals = n < 1000 ? 2 : 0) =>
  '৳' + n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

/* ---------- Download links and the download count ---------- */

$$('[data-download]').forEach((a) => {
  if (SITE.downloadUrl) a.href = SITE.downloadUrl;
});
$$('[data-version]').forEach((el) => {
  if (SITE.version) el.textContent = 'Version ' + SITE.version;
});

// GitHub counts downloads of release files. Read them (cached for 10 minutes,
// the API allows 60 calls an hour per visitor) and show the total once it's
// worth showing.
(async () => {
  if (!SITE.repo) return;
  const key = 'nicotine-downloads';
  let total = null;
  try {
    const cached = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (cached && Date.now() - cached.at < 10 * 60 * 1000) total = cached.total;
  } catch {}
  if (total === null) {
    try {
      const res = await fetch(`https://api.github.com/repos/${SITE.repo}/releases?per_page=100`);
      if (!res.ok) return;
      const releases = await res.json();
      total = releases
        .flatMap((r) => r.assets || [])
        .filter((a) => a.name.endsWith('.apk'))
        .reduce((sum, a) => sum + a.download_count, 0);
      try {
        sessionStorage.setItem(key, JSON.stringify({ total, at: Date.now() }));
      } catch {}
    } catch {
      return;
    }
  }
  if (total < (SITE.showCountFrom ?? 25)) return;
  $$('[data-count]').forEach((el) => {
    el.innerHTML = `Downloaded <b>${total.toLocaleString('en-US')}</b> times`;
    el.hidden = false;
  });
})();

/* ---------- Header: dark over the hero, page-coloured after it ---------- */

(() => {
  const header = $('.nav');
  const hero = $('.hero');
  if (!header || !hero) return;
  let ticking = false;
  const update = () => {
    ticking = false;
    const overHero = hero.getBoundingClientRect().bottom > header.offsetHeight;
    header.classList.toggle('nav--hero', overHero);
    header.classList.toggle('nav--raised', window.scrollY > 8);
  };
  window.addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }, { passive: true });
  update();
})();

/* ---------- Reveal on scroll ---------- */

(() => {
  const items = $$('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('in'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    }
  }, { rootMargin: '0px 0px -8% 0px' });
  items.forEach((el) => io.observe(el));
})();

/* ---------- Hero: "How many a day?" + the 3D lungs ---------- */

(() => {
  const input = $('#per-day');
  if (!input) return;
  const out = $('#per-day-out');
  const month = $('#c-month');
  const year = $('#c-year');
  const packs = $('#c-packs');
  const stage = $('.lung-stage');
  let scene = null;

  // Illustrative only: more a day → a heavier tint. Not the app's lung-load formula.
  const loadFor = (perDay) => 100 * (1 - Math.exp(-perDay / 22));

  const update = () => {
    const perDay = Number(input.value);
    out.textContent = perDay;
    input.style.setProperty('--fill', (perDay / Number(input.max)) * 100 + '%');
    input.setAttribute('aria-valuetext', `${perDay} a day`);
    month.textContent = taka(perDay * STICK_PRICE * DAYS_PER_MONTH, 0);
    year.textContent = taka(perDay * STICK_PRICE * 365, 0);
    packs.textContent = Math.round((perDay * DAYS_PER_MONTH) / 20);
    const load = loadFor(perDay);
    stage.style.setProperty('--lung', lungCss(load));
    scene?.setLoad(load);
  };
  input.addEventListener('input', update);
  update();

  // Load three.js only where it can run well. The flat SVG lung stays otherwise.
  const canvas = $('#lungs');
  const saveData = navigator.connection && navigator.connection.saveData;
  const gl = (() => {
    try {
      const c = document.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch {
      return false;
    }
  })();
  if (!canvas || saveData || !gl) return;

  import('./lungs.js')
    .then(({ createLungScene }) => {
      scene = createLungScene(canvas, { reduceMotion, load: loadFor(Number(input.value)) });
      stage.classList.add('is-3d');
    })
    .catch((err) => console.warn('3D lungs unavailable:', err));
})();

// Same stops as the lung palette, for the flat fallback.
function lungCss(load) {
  const stops = [[242, 149, 138], [222, 140, 126], [196, 134, 120], [158, 123, 112], [122, 106, 100], [85, 74, 70]];
  const t = Math.min(Math.max(load, 0), 100) / 20;
  const i = Math.min(4, Math.floor(t));
  const f = t - i;
  const c = stops[i].map((v, k) => Math.round(v + (stops[i + 1][k] - v) * f));
  return `rgb(${c.join(',')})`;
}

/* ---------- Phone mock-up: a working + button ---------- */

(() => {
  const btn = $('#m-log');
  if (!btn) return;
  const LIMIT = 10;
  const RING = 201.06;
  let count = 7;
  let spent = 125;
  let toastTimer;
  const timeline = $('#m-timeline');
  const toast = $('#m-toast');

  const render = () => {
    $('#m-count').textContent = count;
    $('#m-spent').textContent = taka(spent, 2);
    const ring = $('#m-ring');
    ring.style.strokeDashoffset = RING * (1 - Math.min(count / LIMIT, 1));
    ring.style.stroke = count >= LIMIT * 1.5 ? 'var(--alert)' : 'var(--ember)';
    const left = LIMIT - count;
    $('#m-left').innerHTML = left > 0 ? `${left}<br>left` : left === 0 ? 'At the<br>limit' : `+${-left}<br>over`;
  };

  const showToast = (text, withUndo) => {
    $('#m-toast-text').textContent = text;
    $('#m-undo').hidden = !withUndo;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), withUndo ? 5000 : 1500);
  };

  btn.addEventListener('click', () => {
    if (count >= 99) return;
    count += 1;
    spent += STICK_PRICE;
    const tick = document.createElement('span');
    tick.className = 'tick added';
    tick.style.left = '90%';
    timeline.appendChild(tick);
    $('#m-last').textContent = 'Just now';
    $('#m-hint').hidden = true;
    btn.classList.remove('burst');
    void btn.offsetWidth; // restart the ripple
    btn.classList.add('burst');
    render();
    const over = count - LIMIT;
    showToast(
      over > 0 ? `That's ${count} today, ${over} over your limit of ${LIMIT}.` : `Logged · single · ${taka(STICK_PRICE, 2)}`,
      true,
    );
  });

  $('#m-undo').addEventListener('click', () => {
    const added = $$('.tick.added', timeline);
    if (!added.length) return;
    added[added.length - 1].remove();
    count -= 1;
    spent -= STICK_PRICE;
    if (added.length === 1) $('#m-last').textContent = '2h 36m';
    render();
    showToast('Removed.', false);
  });
})();

/* ---------- Bento: the pack calculator ---------- */

(() => {
  const input = $('#pack-price');
  if (!input) return;
  const SINGLE = 23;
  const STICKS = 20;
  const update = () => {
    const price = Number(input.value);
    const each = price / STICKS;
    const diff = SINGLE - each;
    $('#pack-price-out').textContent = taka(price, 0);
    $('#pack-each').textContent = taka(each, 2);
    input.style.setProperty('--fill', ((price - input.min) / (input.max - input.min)) * 100 + '%');
    input.setAttribute('aria-valuetext', taka(price, 0));
    const note = $('#pack-note');
    note.classList.toggle('is-up', diff < 0);
    note.textContent =
      diff > 0.004
        ? `Saves ${taka(diff, 2)} a stick vs singles (${taka(SINGLE, 2)})`
        : diff < -0.004
          ? `${taka(-diff, 2)} more a stick than singles (${taka(SINGLE, 2)})`
          : `Same as buying singles (${taka(SINGLE, 2)})`;
  };
  input.addEventListener('input', update);
  update();
})();
