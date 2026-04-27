/* Módulo del conversor de monedas */

/*
 * Monedas disponibles: ARS (oficial), USD_blue, USD_oficial, BOB
 *
 * Reglas de conversión (perspectiva del usuario):
 *   - Comprar dólares con ARS → usar tasa "venta" (precio al que la casa vende)
 *   - Vender dólares por ARS  → usar tasa "compra" (precio al que la casa compra)
 *   - BOB se convierte vía la tasa forex USD/BOB internacional
 */

let _rates = null;
let _bob   = null;

export function setRates(rates, bob) {
  _rates = rates;
  _bob   = bob;
}

export function getCurrencyOptions() {
  return [
    { value: 'ARS',         label: 'Pesos ARS (Oficial)' },
    { value: 'USD_blue',    label: 'Dólares USD (Blue)' },
    { value: 'USD_oficial', label: 'Dólares USD (Oficial)' },
    { value: 'BOB',         label: 'Bolivianos BOB' },
  ];
}

/**
 * Convierte `amount` de la moneda `from` a la moneda `to`.
 * Retorna null si los datos aún no están disponibles.
 */
export function convert(amount, from, to) {
  if (!_rates || !_bob || amount === '' || isNaN(Number(amount))) return null;
  const n = Number(amount);
  if (n < 0) return null;
  if (from === to) return n;

  /* ARS → USD Blue */
  if (from === 'ARS' && to === 'USD_blue') {
    const v = _rates.blue?.venta;
    return v ? n / v : null;
  }
  /* USD Blue → ARS */
  if (from === 'USD_blue' && to === 'ARS') {
    const c = _rates.blue?.compra ?? _rates.blue?.venta;
    return c ? n * c : null;
  }
  /* ARS → USD Oficial */
  if (from === 'ARS' && to === 'USD_oficial') {
    const v = _rates.oficial?.venta;
    return v ? n / v : null;
  }
  /* USD Oficial → ARS */
  if (from === 'USD_oficial' && to === 'ARS') {
    const c = _rates.oficial?.compra ?? _rates.oficial?.venta;
    return c ? n * c : null;
  }
  /* USD Blue ↔ USD Oficial: cruzamos por ARS usando compra/venta */
  if (from === 'USD_blue' && to === 'USD_oficial') {
    const enARS = _rates.blue?.compra ?? _rates.blue?.venta;
    const v = _rates.oficial?.venta;
    return (enARS && v) ? (n * enARS) / v : null;
  }
  if (from === 'USD_oficial' && to === 'USD_blue') {
    const enARS = _rates.oficial?.compra ?? _rates.oficial?.venta;
    const v = _rates.blue?.venta;
    return (enARS && v) ? (n * enARS) / v : null;
  }
  /* USD (blue u oficial) → BOB */
  if ((from === 'USD_blue' || from === 'USD_oficial') && to === 'BOB') {
    return n * _bob;
  }
  /* BOB → USD (blue u oficial) */
  if (from === 'BOB' && (to === 'USD_blue' || to === 'USD_oficial')) {
    return _bob > 0 ? n / _bob : null;
  }
  /* ARS → BOB: vía tipo oficial */
  if (from === 'ARS' && to === 'BOB') {
    const v = _rates.oficial?.venta;
    return (v && _bob) ? (n / v) * _bob : null;
  }
  /* BOB → ARS: vía tipo oficial */
  if (from === 'BOB' && to === 'ARS') {
    const c = _rates.oficial?.compra ?? _rates.oficial?.venta;
    return (c && _bob) ? (n / _bob) * c : null;
  }

  return null;
}

export function resultDecimals(to) {
  return 2;
}
