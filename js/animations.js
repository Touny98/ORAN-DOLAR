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
  const PEAK_OP  = 0.40;
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

const REVEAL_EASING  = 'cubic-bezier(0.16, 1, 0.3, 1)';
const REVEAL_STAGGER = IS_TOUCH ? 45 : 55;
const REVEAL_MAX     = 8;
const CHILD_SEL      = '.section-header, .rate-card, .news-card, .home-post-card, .casa-card, .accordion-item, .faq-item';

function getRevealChildren(section) {
  return [...section.querySelectorAll(CHILD_SEL)].slice(0, REVEAL_MAX);
}

function initScrollReveals() {
  const sections = document.querySelectorAll('[data-reveal]');
  if (!sections.length) return;

  if (REDUCED) {
    sections.forEach(el => { el.style.opacity = '1'; el.style.transform = 'none'; });
    return;
  }

  /* Pre-ocultar secciones y sus hijos estáticos */
  sections.forEach(section => {
    section.style.opacity   = '0';
    section.style.transition = 'opacity 0.25s ease';

    getRevealChildren(section).forEach(child => {
      const isHeader = child.classList.contains('section-header');
      const dur      = isHeader ? 350 : 500;
      const dy       = isHeader ? 8 : (IS_TOUCH ? 10 : 12);
      child.style.opacity   = '0';
      child.style.transform = `translateY(${dy}px)`;
      child.style.transition = `opacity ${dur}ms ${REVEAL_EASING}, transform ${dur}ms ${REVEAL_EASING}`;
    });
  });

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      revealSection(entry.target);
    });
  }, { threshold: 0.06, rootMargin: '0px 0px -30px 0px' });

  sections.forEach(el => observer.observe(el));
}

function revealSection(section) {
  /* 1. Sección: fade rápido */
  section.style.opacity = '1';

  /* 2. Hijos: cascada con stagger */
  getRevealChildren(section).forEach((child, i) => {
    setTimeout(() => {
      child.style.opacity   = '1';
      child.style.transform = 'translateY(0)';
    }, 60 + i * REVEAL_STAGGER);
  });

  /* 3. Hijos extra (>MAX): mostrar sin animación */
  [...section.querySelectorAll(CHILD_SEL)].slice(REVEAL_MAX).forEach(child => {
    child.style.opacity   = '1';
    child.style.transform = 'none';
  });

  setTimeout(() => { section.style.willChange = 'auto'; }, 800);
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

function animateBOBNumber(el) {
  if (REDUCED) return;
  const originalHTML = el.innerHTML;
  const raw = el.textContent.trim();
  /* "6,92 Bs" → 6.92 */
  const target = parseFloat(raw.replace(/[^0-9,]/g, '').replace(',', '.'));
  if (isNaN(target) || target <= 0) return;

  const duration = IS_TOUCH ? 800 : 1200;
  const start    = performance.now();

  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased    = easeOutExpo(progress);
    const current  = target * eased;

    el.textContent = current.toLocaleString('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }) + ' Bs';

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      el.innerHTML = originalHTML; /* restaurar <small> tag */
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

  /* Animar valores ARS (compra/venta) */
  grid.querySelectorAll('.price-value.buy, .price-value.sell').forEach((el, i) => {
    const raw = el.textContent.trim();
    if (!raw || raw === '—') return;
    setTimeout(() => animateNumber(el, raw), i * 120 + 100);
  });

  /* Animar valores BOB */
  grid.querySelectorAll('.price-value.single').forEach((el, i) => {
    setTimeout(() => animateBOBNumber(el), i * 150 + 100);
  });
}
