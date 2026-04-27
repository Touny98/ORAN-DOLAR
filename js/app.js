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
  //   whatsapp:   '5493877000000',
  // },
];

/* ── Bootstrap ── */
document.addEventListener('DOMContentLoaded', async () => {
  initNavbar();
  initAccordion();
  initConverter();
  renderCasasCambio();
  await fetchAll();
  startAutoRefresh();
});

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

  for (const cfg of CARD_CONFIG) {
    const rate = rates[cfg.key];
    if (!rate) continue;
    grid.insertAdjacentHTML('beforeend', buildRateCard(cfg, rate));
  }

  /* Tarjeta ARS → BOB */
  if (rates.blue && bob) {
    const arsPerBob = rates.blue.venta ? (1000 / rates.blue.venta) * bob : null;
    grid.insertAdjacentHTML('beforeend', buildBOBCard(bob, arsPerBob));
  }
}

function buildRateCard({ key, label, flag, highlight }, rate) {
  const compra = rate.compra ? `<span class="price-value buy">$${formatARS(rate.compra)}</span>` : '';
  const venta  = rate.venta  ? `<span class="price-value sell">$${formatARS(rate.venta)}</span>` : '';

  return `
  <div class="rate-card${highlight ? ' highlight' : ''}">
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
  <div class="rate-card">
    <div class="card-header">
      <span class="card-name">Boliviano (BOB)</span>
      <span class="card-flag">🇧🇴</span>
    </div>
    <div class="card-prices">
      <div class="price-block">
        <div class="price-label">1 USD</div>
        <span class="price-value single">${formatNum(bob, 2)}</span>
      </div>
      <div class="price-block">
        <div class="price-label">1.000 ARS Blue</div>
        <span class="price-value single" style="font-size:20px">${arsStr}</span>
      </div>
    </div>
    <div class="card-footer">
      <span class="card-time"></span>
      <span class="card-change neutral">BOB</span>
    </div>
  </div>`;
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
