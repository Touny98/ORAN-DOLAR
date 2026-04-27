/* Módulo de clima usando Open-Meteo (gratuito, sin API key) */

const BASE = 'https://api.open-meteo.com/v1/forecast';
const CURRENT = 'current=temperature_2m,precipitation,weathercode,wind_speed_10m,relative_humidity_2m';
const DAILY   = 'daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum&forecast_days=7';
const PARAMS  = `${CURRENT}&${DAILY}`;

const CITIES = {
  oran:    { label: 'Orán, Salta', flag: '🇦🇷', lat: -23.13, lon: -64.32 },
  bermejo: { label: 'Bermejo, Bolivia', flag: '🇧🇴', lat: -22.77, lon: -64.35 },
};

/* WMO weather code → icono y descripción en español */
const WMO = {
  0:  { icon: '☀️',  label: 'Despejado' },
  1:  { icon: '🌤️', label: 'Mayormente despejado' },
  2:  { icon: '⛅',  label: 'Parcialmente nublado' },
  3:  { icon: '☁️',  label: 'Nublado' },
  45: { icon: '🌫️', label: 'Niebla' },
  48: { icon: '🌫️', label: 'Niebla con escarcha' },
  51: { icon: '🌧️', label: 'Llovizna leve' },
  53: { icon: '🌧️', label: 'Llovizna moderada' },
  55: { icon: '🌧️', label: 'Llovizna intensa' },
  61: { icon: '🌧️', label: 'Lluvia leve' },
  63: { icon: '🌧️', label: 'Lluvia moderada' },
  65: { icon: '🌧️', label: 'Lluvia intensa' },
  71: { icon: '🌨️', label: 'Nevada leve' },
  73: { icon: '🌨️', label: 'Nevada moderada' },
  75: { icon: '🌨️', label: 'Nevada intensa' },
  77: { icon: '🌨️', label: 'Granizo fino' },
  80: { icon: '🌦️', label: 'Lluvias aisladas' },
  81: { icon: '⛈️',  label: 'Chaparrones' },
  82: { icon: '⛈️',  label: 'Chaparrones fuertes' },
  85: { icon: '🌨️', label: 'Nevada aislada' },
  86: { icon: '🌨️', label: 'Nevada fuerte' },
  95: { icon: '⛈️',  label: 'Tormenta' },
  96: { icon: '⛈️',  label: 'Tormenta con granizo' },
  99: { icon: '⛈️',  label: 'Tormenta severa con granizo' },
};

const DAYS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function getWMO(code) {
  return WMO[code] ?? { icon: '🌡️', label: 'Sin datos' };
}

async function fetchCity(key) {
  const city = CITIES[key];
  const url = `${BASE}?latitude=${city.lat}&longitude=${city.lon}&${PARAMS}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo error (${key}): ${res.status}`);
  const data = await res.json();

  const c   = data.current;
  const d   = data.daily;
  const wmo = getWMO(c.weathercode);

  /* Pronóstico diario — 7 días, saltamos hoy (índice 0) */
  const forecast = d.time.map((dateStr, i) => {
    const date    = new Date(dateStr + 'T12:00:00');
    const dayName = i === 0 ? 'Hoy' : DAYS_ES[date.getDay()];
    const fw      = getWMO(d.weathercode[i]);
    return {
      day:    dayName,
      icon:   fw.icon,
      max:    Math.round(d.temperature_2m_max[i]),
      min:    Math.round(d.temperature_2m_min[i]),
      precip: d.precipitation_sum[i],
    };
  });

  return {
    key,
    label:         city.label,
    flag:          city.flag,
    temp:          Math.round(c.temperature_2m),
    precipitation: c.precipitation,
    weathercode:   c.weathercode,
    wind:          Math.round(c.wind_speed_10m),
    humidity:      c.relative_humidity_2m,
    icon:          wmo.icon,
    desc:          wmo.label,
    isRaining:     c.precipitation > 0 || c.weathercode >= 51,
    forecast,
  };
}

/**
 * Obtiene el clima de ambas ciudades en paralelo.
 * Retorna un objeto { oran, bermejo }.
 */
export async function fetchWeather() {
  const [oran, bermejo] = await Promise.all([fetchCity('oran'), fetchCity('bermejo')]);
  return { oran, bermejo };
}

/**
 * Determina si se debe mostrar la alerta de lluvia/río.
 */
export function shouldShowRainAlert(weatherData) {
  return weatherData.oran.isRaining || weatherData.bermejo.isRaining;
}

/**
 * Genera el mensaje de alerta según qué ciudades tienen lluvia.
 */
export function buildAlertMessage(weatherData) {
  const { oran, bermejo } = weatherData;
  const cities = [];
  if (oran.isRaining)    cities.push('Orán');
  if (bermejo.isRaining) cities.push('Bermejo');
  const cityText = cities.join(' y ');
  return `Lluvia detectada en ${cityText}. El río Bermejo puede estar crecido. Verificar el estado de la chalana antes de cruzar en Aguas Blancas.`;
}
