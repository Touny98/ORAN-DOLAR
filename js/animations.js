/* ═══════════════════════════════════════════════════════════════
   ORAN DOLAR — Animations v2
   1. Hero canvas dot grid (mouse-reactive, desktop only)
   2. Scroll-triggered section reveals (IntersectionObserver)
   3. Number counter animation on rate cards
   ═══════════════════════════════════════════════════════════════ */

const REDUCED  = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const IS_TOUCH = window.matchMedia('(pointer: coarse)').matches;

/* Quitar FOIC guard en cuanto JS carga */
document.documentElement.classList.remove('js-reveal-pending');

/* ── 1. HERO DOT GRID ──────────────────────────────────────── */

function initDotCanvas() {
  if (REDUCED || IS_TOUCH) return;

  const section = document.getElementById('hero-intro');
  if (!section) return;

  const canvas = document.createElement('canvas');
  canvas.id = 'hero-dot-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  section.prepend(canvas);

  const ctx      = canvas.getContext('2d');
  const SPACING  = 32;
  const R        = 1.5;
  const BASE_OP  = 0.155;
  const PEAK_OP  = 0.30;
  const INFLUENCE = 130;

  let mouse = { x: -9999, y: -9999 };
  let dots  = [];
  let raf   = null;

  function buildGrid() {
    const rect = section.getBoundingClientRect();
    canvas.width  = rect.width;
    canvas.height = rect.height;
    dots = [];
    const cols = Math.ceil(rect.width  / SPACING) + 1;
    const rows = Math.ceil(rect.height / SPACING) + 1;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        dots.push({ cx: c * SPACING, cy: r * SPACING });
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#111111';
    for (const { cx, cy } of dots) {
      const dist = Math.hypot(cx - mouse.x, cy - mouse.y);
      const t    = Math.max(0, 1 - dist / INFLUENCE);
      ctx.globalAlpha = BASE_OP + (PEAK_OP - BASE_OP) * t;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(draw);
  }

  section.addEventListener('mousemove', e => {
    const r = canvas.getBoundingClientRect();
    mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
  }, { passive: true });

  section.addEventListener('mouseleave', () => {
    mouse = { x: -9999, y: -9999 };
  });

  buildGrid();
  draw();

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      cancelAnimationFrame(raf);
      buildGrid();
      draw();
    }, 150);
  }, { passive: true });
}

/* ── 2. SCROLL REVEALS ─────────────────────────────────────── */

function initScrollReveals() {
  const targets = document.querySelectorAll('[data-reveal]');
  if (!targets.length) return;

  if (REDUCED) {
    /* Sin animaciones: mostrar todo directamente */
    targets.forEach(el => {
      el.style.opacity   = '1';
      el.style.transform = 'none';
    });
    return;
  }

  const Y = IS_TOUCH ? '10px' : '16px';
  targets.forEach(el => {
    el.style.opacity   = '0';
    el.style.transform = `translateY(${Y})`;
  });

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      revealElement(entry.target);
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

  targets.forEach(el => observer.observe(el));
}

function revealElement(el) {
  el.classList.add('reveal-ready');
  void el.offsetHeight; /* force reflow so transition applies */
  el.classList.add('reveal-visible');
  setTimeout(() => { el.style.willChange = 'auto'; }, 600);
}

/* ── 3. NUMBER COUNTER ─────────────────────────────────────── */

function parseARS(str) {
  /* "$1.234,50" → 1234.50 */
  const n = str.replace('$', '').trim()
    .replace(/\./g, '')
    .replace(',', '.');
  return parseFloat(n);
}

function easeOutExpo(t) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function animateNumber(el, targetStr) {
  if (REDUCED) return;
  const target = parseARS(targetStr);
  if (isNaN(target) || target <= 0) return;

  const duration = IS_TOUCH ? 800 : 1200;
  const start    = performance.now();

  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased    = easeOutExpo(progress);
    const current  = target * eased;

    el.textContent = '$' + current.toLocaleString('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      el.textContent = targetStr;
      el.classList.add('value-flash');
      el.addEventListener('animationend', () => el.classList.remove('value-flash'), { once: true });
    }
  }

  requestAnimationFrame(tick);
}

/* ── EXPORTS ───────────────────────────────────────────────── */

export function initAnimations() {
  initDotCanvas();
  initScrollReveals();
}

export function animateRateCards(grid) {
  if (!grid || REDUCED) return;

  /* Solo animar los números — las cards son visibles por defecto */
  grid.querySelectorAll('.price-value.buy, .price-value.sell').forEach((el, i) => {
    const raw = el.textContent.trim();
    if (!raw || raw === '—') return;
    setTimeout(() => animateNumber(el, raw), i * 120 + 100);
  });
}
