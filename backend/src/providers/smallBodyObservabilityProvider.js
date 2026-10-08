import { requestJson } from './http.js';

const NASA_SB_WOBS_URL = 'https://ssd-api.jpl.nasa.gov/sbwobs.api';
const API_VERSION = '1.0';

export function createSmallBodyObservabilityProvider({ fetchImpl = fetch, timeoutMs = 15000 } = {}) {
  return async function findObservableBodies({ latitude, longitude, date, nearEarthOnly = false }) {
    const url = new URL(NASA_SB_WOBS_URL);
    url.searchParams.set('lat', String(latitude));
    url.searchParams.set('lon', String(longitude));
    // 23:00 UT corresponds approximately to the beginning of the evening in Brazil.
    url.searchParams.set('obs-time', `${date}_23:00:00`);
    url.searchParams.set('optical', 'true');
    url.searchParams.set('elev-min', '30');
    url.searchParams.set('time-min', '15');
    url.searchParams.set('vmag-max', '25');
    url.searchParams.set('mag-required', 'true');
    url.searchParams.set('maxoutput', '25');
    url.searchParams.set('output-sort', 'vmag');
    url.searchParams.set('fmt-ra-dec', 'true');
    if (nearEarthOnly) url.searchParams.set('sb-group', 'neo');

    const payload = await requestJson(url, { fetchImpl, timeoutMs });
    if (payload?.signature?.version !== API_VERSION || !Array.isArray(payload.fields) || !Array.isArray(payload.data)) {
      throw new Error('A resposta da NASA/JPL não corresponde ao formato suportado.');
    }

    const objects = payload.data.map((row) => Object.fromEntries(
      payload.fields.map((field, index) => [field, row[index] ?? null]),
    ));

    return {
      source: 'NASA/JPL Small-Body Observability API',
      sourceUrl: NASA_SB_WOBS_URL,
      version: payload.signature.version,
      observer: {
        latitude,
        longitude,
        altitudeKm: 0,
      },
      observationDate: date,
      nearEarthOnly,
      totalObjects: Number(payload.total_objects) || 0,
      shownObjects: Number(payload.shown_objects) || objects.length,
      night: payload.obs_night || null,
      objects,
    };
  };
}
