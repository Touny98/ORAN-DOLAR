import { fetchDolarRates, fetchBOBRate, formatARS, formatNum, timeAgo } from './api.js';
import { fetchWeather, shouldShowRainAlert, buildAlertMessage } from './weather.js';
import { setRates, convert, getCurrencyOptions, resultDecimals } from './converter.js';

/* ── Estado global ── */
let lastRates   = null;
let lastBOB     = null;
let lastWeather = null;
let updateTimer = null;
let lastFetchTime = null;

const REFRESH_MS = 5 * 60 * 1000; /* 5 minutos */

/* Configuración de las casas de cambio - Editar aquí para agregar o modificar */
const CASAS = [
  /* Ejemplo de casa verificada (de pago) */
  // {
  //   nombre:     'Casa de Cambio Ejemplo',
  //   verified:   true,
  //   blue_compra: null,
  //   blue_venta:  null,
  //   horario:    'Lun–Vie 8–13hs / 16–20hs',
  //   direccion:  'Av. 9 de Julio 123, Orán',
  //   whatsapp:   '5493878801149',
  // },
];

/* ── Imagen por defecto para noticias ── */
const DEFAULT_IMG = 'https://placehold.co/400x200/0d111a/facc15?text=Noticias';

/* ── Helper para asegurar thumbnail válido ── */
function getValidThumbnail(url) {
  if (typeof url === 'string' && url.trim() && url.startsWith('http')) {
    return url;
  }
  return DEFAULT_IMG;
}

/* ── Bootstrap ── */
document.addEventListener('DOMContentLoaded', async () => {
  initCookieBanner();
  initVanta();
  initNavbar();
  initAccordion();
  initFAQAccordion();
  initConverter();
  renderCasasCambio();
  fetchLocalNews();
  await fetchAll();
  startAutoRefresh();
});

function initCookieBanner() {
  const banner = document.getElementById('cookie-banner');
  const acceptBtn = document.getElementById('accept-cookies');
  
  if (banner && acceptBtn) {
    if (!localStorage.getItem('cookiesAccepted')) {
      banner.style.display = 'block';
    }
    
    acceptBtn.addEventListener('click', () => {
      localStorage.setItem('cookiesAccepted', 'true');
      banner.style.display = 'none';
    });
  }
}

function initVanta() {
  const isMobile = window.innerWidth < 768;
  if (isMobile) return; // No cargar canvas 3D en móviles para optimizar Core Web Vitals (AdSense)

  if (typeof VANTA !== 'undefined') {
    const vantaInstance = VANTA.NET({
      el: "#vanta-bg",
      mouseControls: true,
      touchControls: true,
      gyroControls: false,
      minHeight: 200.00,
      minWidth: 200.00,
      scale: 1.00,
      scaleMobile: 1.00,
      color: 0xfacc15,
      backgroundColor: 0x05070a,
      points: 12.00,
      maxDistance: 22.00,
      spacing: 16.00
    });

    window.addEventListener('resize', () => {
      if (vantaInstance) vantaInstance.resize();
    });
  }
}

/* ── Navbar: hamburger menu ── */
function initNavbar() {
  const hamburger = document.getElementById('hamburger');
  const navLinks   = document.getElementById('nav-links');
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => navLinks.classList.toggle('open'));
    document.querySelectorAll('#nav-links a').forEach(a =>
      a.addEventListener('click', () => navLinks.classList.remove('open'))
    );
  }

  document.getElementById('refresh-btn').addEventListener('click', () => fetchAll(true));
}

/* ── Acordeón ── */
function initAccordion() {
  document.querySelectorAll('.accordion-header').forEach(header => {
    header.addEventListener('click', () => {
      const item = header.closest('.accordion-item');
      item.classList.toggle('open');
    });
  });
}

/* ── FAQ Acordeón ── */
function initFAQAccordion() {
  document.querySelectorAll('.faq-question').forEach(question => {
    question.addEventListener('click', () => {
      const item = question.parentElement;
      item.classList.toggle('open');
    });
  });
}

/* ── Conversor ── */
function initConverter() {
  const fromSel = document.getElementById('conv-from');
  const toSel   = document.getElementById('conv-to');
  const amtIn   = document.getElementById('conv-amount');
  const result  = document.getElementById('conv-result');
  const note    = document.getElementById('conv-note');

  const opts = getCurrencyOptions();
  opts.forEach(o => {
    fromSel.add(new Option(o.label, o.value));
    toSel.add(new Option(o.label, o.value));
  });
  fromSel.value = 'ARS';
  toSel.value   = 'BOB';

  function recalc() {
    const amount = amtIn.value;
    const from   = fromSel.value;
    const to     = toSel.value;
    const res    = convert(amount, from, to);
    if (res === null) {
      result.textContent = '—';
      note.textContent   = 'Cargando cotizaciones…';
      return;
    }
    const dec  = resultDecimals(to);
    result.textContent = res.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    note.textContent   = lastBOB ? `1 USD = ${formatNum(lastBOB, 2)} BOB` : '';
  }

  amtIn.addEventListener('input', recalc);
  fromSel.addEventListener('change', recalc);
  toSel.addEventListener('change', recalc);
  window._recalcConverter = recalc;
}

/* ── Fetch all ── */
async function fetchAll(manual = false) {
  const btn = document.getElementById('refresh-btn');
  btn.classList.add('spinning');

  try {
    const [rates, bob, weather] = await Promise.all([
      fetchDolarRates(),
      fetchBOBRate(),
      fetchWeather(),
    ]);

    lastRates   = rates;
    lastBOB     = bob;
    lastWeather = weather;
    lastFetchTime = new Date();

    setRates(rates, bob);
    renderRateCards(rates, bob);
    renderWeather(weather);
    handleRainAlert(weather);
    updateTimestamp();

    if (window._recalcConverter) window._recalcConverter();
    if (manual) showToast('Cotizaciones actualizadas', 'success');

  } catch (err) {
    console.error(err);
    showToast('Error al actualizar. Mostrando datos previos.', 'error');
  } finally {
    btn.classList.remove('spinning');
  }
}

/* ── Auto-refresh ── */
function startAutoRefresh() {
  clearInterval(updateTimer);
  updateTimer = setInterval(() => fetchAll(), REFRESH_MS);
  setInterval(updateTimestamp, 30000);
}

function updateTimestamp() {
  const el = document.getElementById('update-time');
  if (!el) return;
  el.textContent = lastFetchTime
    ? `Actualizado ${timeAgo(lastFetchTime)}`
    : 'Actualizando…';
}

/* ── Render rate cards ── */
const CARD_CONFIG = [
  { key: 'blue',    label: 'Dólar Blue',    flag: '💵', highlight: true },
  { key: 'oficial', label: 'Dólar Oficial', flag: '🏛️' },
  { key: 'cripto',  label: 'Dólar Cripto',  flag: '🔶' },
];

function renderRateCards(rates, bob) {
  const grid = document.getElementById('rates-grid');
  grid.innerHTML = '';

  /* Tarjeta ARS → BOB (Ahora PRIMERA) */
  if (rates.blue && bob) {
    const arsPerBob = rates.blue.venta ? (1000 / rates.blue.venta) * bob : null;
    grid.insertAdjacentHTML('beforeend', buildBOBCard(bob, arsPerBob));
  }

  for (const cfg of CARD_CONFIG) {
    const rate = rates[cfg.key];
    if (!rate) continue;
    grid.insertAdjacentHTML('beforeend', buildRateCard(cfg, rate));
  }
}

function buildRateCard({ key, label, flag, highlight }, rate) {
  const compra = rate.compra ? `<span class="price-value buy">$${formatARS(rate.compra)}</span>` : '';
  const venta  = rate.venta  ? `<span class="price-value sell">$${formatARS(rate.venta)}</span>` : '';

  return `
  <div class="rate-card${highlight ? ' highlight' : ''}" style="background: rgba(51, 65, 85, 0.80) !important;">
    <div class="card-header">
      <span class="card-name">${label}</span>
      <span class="card-flag">${flag}</span>
    </div>
    <div class="card-prices">
      <div class="price-block">
        <div class="price-label">Compra</div>
        ${compra || '<span class="price-value buy" style="font-size:14px;color:var(--text-dim)">—</span>'}
      </div>
      <div class="price-block">
        <div class="price-label">Venta</div>
        ${venta || '<span class="price-value sell" style="font-size:14px;color:var(--text-dim)">—</span>'}
      </div>
    </div>
    <div class="card-footer">
      <span class="card-time">${timeAgo(rate.fechaActualizacion)}</span>
      <span class="card-change neutral">ARS</span>
    </div>
  </div>`;
}

function buildBOBCard(bob, arsPerBob) {
  const arsStr = arsPerBob ? formatNum(arsPerBob, 2) : '—';
  return `
  <div class="rate-card highlight" style="background: rgba(51, 65, 85, 0.80) !important; opacity: 1 !important;">
    <div class="card-header">
      <span class="card-name" style="color:var(--gold); font-weight:700">Boliviano (BOB)</span>
      <span class="card-flag">🇧🇴</span>
    </div>
    <div class="card-prices">
      <div class="price-block">
        <div class="price-label" style="font-size:12px; color:var(--text-muted)">1 DÓLAR VALE:</div>
        <span class="price-value single">${formatNum(bob, 2)} <small style="font-size:14px">Bs</small></span>
      </div>
      <div class="price-block">
        <div class="price-label" style="font-size:12px; color:var(--text-muted)">POR 1.000 PESOS:</div>
        <span class="price-value single" style="font-size:24px">${arsStr} <small style="font-size:14px">Bs</small></span>
      </div>
    </div>
    <div class="card-footer" style="border-top: 1px solid var(--border-gold); margin-top:15px; padding-top:10px">
      <span class="card-time" style="font-size:11px; color:var(--text-muted)">Referencia para cambio en frontera</span>
    </div>
  </div>
  `;
}

/* ── Render weather ── */
function renderWeather(weather) {
  renderWeatherCard('weather-oran',    weather.oran);
  renderWeatherCard('weather-bermejo', weather.bermejo);
}

function renderWeatherCard(id, data) {
  const el = document.getElementById(id);
  if (!el) return;

  const forecastHTML = (data.forecast ?? []).map(f => `
    <div class="forecast-day${f.precip > 0 ? ' forecast-rain' : ''}">
      <span class="forecast-name">${f.day}</span>
      <span class="forecast-icon">${f.icon}</span>
      <span class="forecast-max">${f.max}°</span>
      <span class="forecast-min">${f.min}°</span>
    </div>
  `).join('');

  el.innerHTML = `
    <div class="weather-city">
      <span>${data.flag}</span> ${data.label}
    </div>
    <div class="weather-main">
      <div class="weather-icon">${data.icon}</div>
      <div>
        <div class="weather-temp">${data.temp}<span>°C</span></div>
        <div class="weather-desc">${data.desc}</div>
      </div>
    </div>
    <div class="weather-details">
      <div class="weather-detail">💨 <strong>${data.wind} km/h</strong></div>
      <div class="weather-detail">💧 <strong>${data.humidity}%</strong></div>
      <div class="weather-detail">🌧️ <strong>${data.precipitation} mm</strong></div>
    </div>
    ${forecastHTML ? `<div class="weather-forecast">${forecastHTML}</div>` : ''}
  `;
}

/* ── Alerta de lluvia ── */
function handleRainAlert(weather) {
  const banner  = document.getElementById('alert-banner');
  const textEl  = document.getElementById('alert-text');
  const dismiss = document.getElementById('alert-dismiss');
  const key     = 'alertDismissed';

  if (shouldShowRainAlert(weather)) {
    if (sessionStorage.getItem(key)) return;
    textEl.innerHTML = `<strong>⚠️ Alerta de lluvia</strong>${buildAlertMessage(weather)}`;
    banner.classList.add('visible');
    dismiss.addEventListener('click', () => {
      banner.classList.remove('visible');
      sessionStorage.setItem(key, '1');
    }, { once: true });
  } else {
    banner.classList.remove('visible');
    sessionStorage.removeItem(key);
  }
}

/* ── Casas de cambio ── */
function renderCasasCambio() {
  const grid = document.getElementById('casas-grid');
  if (!grid) return;
  if (CASAS.length === 0) {
    grid.innerHTML = '';
    return;
  }
  grid.innerHTML = CASAS.map(c => `
    <div class="casa-card${c.verified ? ' verified' : ''}">
      <div class="casa-header">
        <span class="casa-name">${c.nombre}</span>
        ${c.verified ? '<span class="casa-verified">✓ Verificado</span>' : ''}
      </div>
      <div class="casa-rates">
        <div class="casa-rate-block">
          <div class="casa-rate-label">Blue Compra</div>
          ${c.blue_compra
            ? `<div class="casa-rate-value buy">$${formatARS(c.blue_compra)}</div>`
            : `<div class="casa-rate-value unknown">Consultar</div>`}
        </div>
        <div class="casa-rate-block">
          <div class="casa-rate-label">Blue Venta</div>
          ${c.blue_venta
            ? `<div class="casa-rate-value sell">$${formatARS(c.blue_venta)}</div>`
            : `<div class="casa-rate-value unknown">Consultar</div>`}
        </div>
      </div>
      <div class="casa-info">
        ${c.horario   ? `<span>🕐 ${c.horario}</span>`   : ''}
        ${c.direccion ? `<span>📍 ${c.direccion}</span>` : ''}
      </div>
      <a class="btn-whatsapp"
         href="https://wa.me/${c.whatsapp}?text=Hola%2C+quiero+saber+el+precio+del+d%C3%B3lar+hoy"
         target="_blank" rel="noopener">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
        Consultar por WhatsApp
      </a>
    </div>
  `).join('');
}

/* ── Toast notifications ── */
function showToast(msg, type = '') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast${type ? ' ' + type : ''}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

/* ── Noticias Locales ── */
const NEWS_SOURCES = [
  { name: 'El Tribuno – Orán', url: 'https://news.google.com/rss/search?q=site:eltribuno.com+Orán&hl=es-419&gl=AR&ceid=AR:es-419', icon: '📰' },
  { name: 'Noticias Orán',     url: 'https://news.google.com/rss/search?q=Orán+Salta&hl=es-419&gl=AR&ceid=AR:es-419',                icon: '🗞️' },
  { name: 'Radio Ciudad Orán', url: 'https://news.google.com/rss/search?q=site:radiociudadoran.com.ar&hl=es-419&gl=AR&ceid=AR:es-419', icon: '📻' },
  { name: 'Diario El Oránense', url: 'https://news.google.com/rss/search?q=site:diarioeloranense.com.ar&hl=es-419&gl=AR&ceid=AR:es-419', icon: '🗞️' },
  { name: 'Radio Guemes',      url: 'https://news.google.com/rss/search?q=site:radioguemes.com.ar&hl=es-419&gl=AR&ceid=AR:es-419',     icon: '📻' }
];

/* Extrae og:image de una URL usando Microlink API, con caché en sessionStorage */
async function fetchOgImage(articleUrl) {
  const key = 'ogimg_' + articleUrl;
  const cached = sessionStorage.getItem(key);
  if (cached) return cached;
  try {
    const resp = await fetch(
      `https://api.microlink.io/?url=${encodeURIComponent(articleUrl)}&meta=true`,
      { signal: AbortSignal.timeout(6000) }
    );
    const data = await resp.json();
    const imgUrl = data?.data?.image?.url || DEFAULT_IMG;
    sessionStorage.setItem(key, imgUrl);
    return imgUrl;
  } catch {
    return DEFAULT_IMG;
  }
}

async function fetchLocalNews() {
  const container = document.getElementById('news-container');
  if (!container) return;

  let allNews = [];

  for (const source of NEWS_SOURCES) {
    let fetched = false;

    // Primer intento: rss2json
    try {
      const resp = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(source.url)}`);
      const data = await resp.json();
      if (data.status === 'ok' && data.items && data.items.length > 0) {
        data.items.slice(0, 4).forEach(item => {
          allNews.push({
            title:   item.title,
            link:    item.link,
            pubDate: new Date(item.pubDate),
            source:  source.name,
            icon:    source.icon
          });
        });
        fetched = true;
      }
    } catch (e) { /* ignorar, probar siguiente */ }

    // Fallback: allorigins + parseo XML nativo
    if (!fetched) {
      try {
        const resp = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(source.url)}`);
        const json = await resp.json();
        const xml  = new DOMParser().parseFromString(json.contents, 'text/xml');
        Array.from(xml.querySelectorAll('item')).slice(0, 4).forEach(el => {
          allNews.push({
            title:   el.querySelector('title')?.textContent || '(Sin título)',
            link:    el.querySelector('link')?.textContent  || '#',
            pubDate: new Date(el.querySelector('pubDate')?.textContent || Date.now()),
            source:  source.name,
            icon:    source.icon
          });
        });
      } catch (e) { console.warn('Feed fallido:', source.name, e); }
    }
  }

  if (allNews.length === 0) {
    container.innerHTML = '<p style="color:var(--text-dim);text-align:center;grid-column:1/-1;padding:40px 0">No se pudieron cargar las noticias. Recargá la página.</p>';
    return;
  }

  // Deduplicar y ordenar
  const seen = new Set();
  allNews = allNews.filter(n => { if (seen.has(n.title)) return false; seen.add(n.title); return true; });
  allNews.sort((a, b) => b.pubDate - a.pubDate);

  const top6 = allNews.slice(0, 6);

  // Render inmediato con placeholder — las imágenes se cargan encima de forma asíncrona
  container.innerHTML = top6.map((n, i) => `
    <a href="${n.link}" target="_blank" rel="noopener noreferrer" class="news-card news-link">
      <img src="${DEFAULT_IMG}" alt="${n.title.replace(/"/g, '')}" class="news-img" id="nimg-${i}" loading="lazy">
      <div class="news-content">
        <div class="news-source">${n.icon} ${n.source}</div>
        <div class="news-title">${n.title}</div>
        <div class="news-meta">
          <span>Hace ${timeSince(n.pubDate)}</span>
          <span>Leer más →</span>
        </div>
      </div>
    </a>
  `).join('');

  // Cargar og:image de cada artículo en paralelo y actualizar cada tarjeta
  top6.forEach((n, i) => {
    fetchOgImage(n.link).then(imgUrl => {
      const el = document.getElementById(`nimg-${i}`);
      if (el) {
        el.src = imgUrl;
        el.onerror = () => { el.src = DEFAULT_IMG; };
      }
    });
  });
}

function timeSince(date) {
  const s = Math.floor((new Date() - date) / 1000);
  if (s < 60)   return `${s} seg`;
  if (s < 3600) return `${Math.floor(s/60)} min`;
  if (s < 86400) return `${Math.floor(s/3600)} horas`;
  if (s < 2592000) return `${Math.floor(s/86400)} días`;
  if (s < 31536000) return `${Math.floor(s/2592000)} meses`;
  return `${Math.floor(s/31536000)} años`;
}
