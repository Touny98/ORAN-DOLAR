/* Módulo de fetching de cotizaciones */

const DOLAR_API_URL    = 'https://dolarapi.com/v1/dolares';
const EXCHANGE_API_URL = 'https://api.exchangerate-api.com/v4/latest/USD';

/* Fallback si la API de forex no responde */
const BOB_FALLBACK = 6.95;

/**
 * Obtiene todas las cotizaciones del dólar desde DolarAPI.
 * Retorna un objeto indexado por casa: { blue, oficial, bolsa, contadoconliqui, cripto, tarjeta }
 */
export async function fetchDolarRates() {
  const res = await fetch(DOLAR_API_URL);
  if (!res.ok) throw new Error(`DolarAPI error: ${res.status}`);
  const data = await res.json();

  const map = {};
  for (const item of data) {
    map[item.casa] = {
      nombre:   item.nombre,
      compra:   item.compra,
      venta:    item.venta,
      fechaActualizacion: item.fechaActualizacion,
    };
  }
  return map;
}

/**
 * Obtiene la tasa USD→BOB (peso boliviano) desde exchangerate-api.
 * Retorna el valor numérico (ej: 6.95).
 */
export async function fetchBOBRate() {
  try {
    const res = await fetch(EXCHANGE_API_URL);
    if (!res.ok) throw new Error(`ExchangeRate error: ${res.status}`);
    const data = await res.json();
    return data.rates?.BOB ?? BOB_FALLBACK;
  } catch {
    return BOB_FALLBACK;
  }
}

/**
 * Formatea un número como moneda argentina.
 * Ej: 1234.5 → "1.234,50"
 */
export function formatARS(value) {
  if (value == null) return '—';
  return value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Formatea un número con N decimales, usando locale 'es-AR'.
 */
export function formatNum(value, decimals = 4) {
  if (value == null) return '—';
  return value.toLocaleString('es-AR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/**
 * Parsea la fecha de actualización de DolarAPI y devuelve texto relativo.
 * Ej: "hace 5 minutos", "hace 1 hora"
 */
export function timeAgo(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1)  return 'hace un momento';
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24)  return `hace ${diffHr}h`;
  return `hace ${Math.floor(diffHr / 24)}d`;
}
