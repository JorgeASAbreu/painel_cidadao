const DEFAULT_NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';
const DEFAULT_NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
const REQUEST_INTERVAL_MS = 1000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_LIMIT = 256;

const STATE_NAMES = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará',
  DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso',
  MS: 'Mato Grosso do Sul', MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná',
  PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul',
  RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
};

export function createReverseGeocodeProvider({
  fetchImpl = fetch,
  timeoutMs = 9000,
  reverseEndpoint = process.env.NOMINATIM_REVERSE_URL || DEFAULT_NOMINATIM_REVERSE_URL,
  searchEndpoint = process.env.NOMINATIM_SEARCH_URL || DEFAULT_NOMINATIM_SEARCH_URL,
} = {}) {
  let nextRequestAt = 0;
  let requestQueue = Promise.resolve();
  const cache = new Map();
  const pendingRequests = new Map();

  async function requestNominatim(url) {
    const cacheKey = url.toString();
    const cached = cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      cache.delete(cacheKey);
      cache.set(cacheKey, cached);
      return cached.value;
    }
    if (cached) cache.delete(cacheKey);
    if (pendingRequests.has(cacheKey)) return pendingRequests.get(cacheKey);

    const operation = requestQueue.then(async () => {
      const waitMs = Math.max(0, nextRequestAt - Date.now());
      if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
      nextRequestAt = Date.now() + REQUEST_INTERVAL_MS;

      const response = await fetchImpl(url, {
        headers: {
          'User-Agent': 'PainelCivicoMunicipal/1.0 (interactive municipal map lookup)',
          Accept: 'application/json',
        },
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw new Error(`Nominatim respondeu com HTTP ${response.status}.`);
      const payload = await response.json();
      cache.set(cacheKey, { value: payload, expiresAt: Date.now() + CACHE_TTL_MS });
      while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
      return payload;
    });

    pendingRequests.set(cacheKey, operation);
    requestQueue = operation.then(() => undefined, () => undefined);
    try {
      return await operation;
    } finally {
      pendingRequests.delete(cacheKey);
    }
  }

  async function reverseGeocode({ latitude, longitude }) {
    const url = new URL(reverseEndpoint);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('countrycodes', 'br');
    url.searchParams.set('zoom', '18');
    url.searchParams.set('accept-language', 'pt-BR');
    url.searchParams.set('lat', String(latitude));
    url.searchParams.set('lon', String(longitude));
    return { cep: postcodeFrom(await requestNominatim(url)) };
  }

  async function searchCity({ city, state }) {
    const stateName = STATE_NAMES[state];
    const normalizedCity = normalizeName(city);
    const stateUrl = new URL(searchEndpoint);
    stateUrl.searchParams.set('format', 'jsonv2');
    stateUrl.searchParams.set('addressdetails', '1');
    stateUrl.searchParams.set('countrycodes', 'br');
    stateUrl.searchParams.set('limit', '10');
    stateUrl.searchParams.set('q', `${city}, ${stateName}, Brasil`);

    const cityCandidates = await requestNominatim(stateUrl);
    const cityPlace = (Array.isArray(cityCandidates) ? cityCandidates : [])
      .filter((candidate) => matchesMunicipality(candidate, normalizedCity, stateName))
      .sort((a, b) => Number(b.importance || 0) - Number(a.importance || 0))[0];
    if (!cityPlace) return null;

    const centerCoordinates = coordinatesFrom(cityPlace);
    if (!centerCoordinates) return null;

    const civicUrl = new URL(searchEndpoint);
    civicUrl.searchParams.set('format', 'jsonv2');
    civicUrl.searchParams.set('addressdetails', '1');
    civicUrl.searchParams.set('countrycodes', 'br');
    civicUrl.searchParams.set('limit', '10');
    civicUrl.searchParams.set('q', `prefeitura de ${city}, ${stateName}, Brasil`);
    const civicCandidates = await requestNominatim(civicUrl).catch(() => []);
    const civicPlace = (Array.isArray(civicCandidates) ? civicCandidates : [])
      .filter((candidate) => isCivicCenter(candidate) && matchesMunicipality(candidate, normalizedCity, stateName))
      .sort((a, b) => Number(b.importance || 0) - Number(a.importance || 0))[0];

    const geographicCenter = {
      name: cityPlace.name || cityPlace.address?.city || cityPlace.address?.town || city,
      ...centerCoordinates,
      cep: postcodeFrom(cityPlace),
      pointType: cityPlace.type || null,
    };
    const civicCoordinates = civicPlace ? coordinatesFrom(civicPlace) : null;
    const civicCenter = civicPlace && civicCoordinates ? {
      name: civicPlace.name || 'Prefeitura',
      ...civicCoordinates,
      cep: postcodeFrom(civicPlace),
      pointType: civicPlace.type || null,
    } : null;

    const [geographicCep, civicCep] = await Promise.all([
      resolvePointCep(geographicCenter.cep, centerCoordinates, reverseGeocode),
      civicCenter ? resolvePointCep(civicCenter.cep, civicCoordinates, reverseGeocode) : null,
    ]);
    geographicCenter.cep = geographicCep;
    if (civicCenter) civicCenter.cep = civicCep;

    return {
      city: cityPlace.name || city,
      state,
      geographicCenter,
      civicCenter,
      source: 'OpenStreetMap / Nominatim',
      attribution: '© OpenStreetMap contributors',
    };
  }

  reverseGeocode.searchCity = searchCity;
  return reverseGeocode;
}

function postcodeFrom(place) {
  const digits = typeof place?.address?.postcode === 'string'
    ? place.address.postcode.replace(/\D/g, '')
    : '';
  return /^\d{8}$/.test(digits) ? digits : null;
}

async function resolvePointCep(postcode, coordinates, reverseGeocode) {
  if (postcode) return postcode;
  try {
    return (await reverseGeocode(coordinates)).cep;
  } catch {
    return null;
  }
}

function coordinatesFrom(place) {
  const latitude = Number(place?.lat);
  const longitude = Number(place?.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
    || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

function isCivicCenter(place) {
  const name = normalizeName(place?.name || '');
  return (place?.class === 'amenity' && place?.type === 'townhall')
    || place?.type === 'townhall'
    || name.includes('prefeitura')
    || name.includes('paço municipal');
}

function matchesMunicipality(place, normalizedCity, stateName) {
  const address = place?.address || {};
  const localityNames = [place?.name, address.city, address.town, address.village, address.municipality]
    .filter(Boolean).map(normalizeName);
  const state = normalizeName(address.state || '');
  return localityNames.includes(normalizedCity) && state === normalizeName(stateName);
}

function normalizeName(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}
