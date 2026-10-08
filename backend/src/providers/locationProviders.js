import { requestJson } from './http.js';
import { getCurrentWeather } from './weatherProvider.js';

const BRASIL_API = 'https://brasilapi.com.br';
const IBGE_API = 'https://servicodados.ibge.gov.br';
const REGION_ID_BY_SIGLA = { N: 1, NE: 2, SE: 3, S: 4, CO: 5 };

export function createLocationService({ fetchImpl = fetch } = {}) {
  const getJson = (url) => requestJson(url, { fetchImpl });

  return {
    async lookup(rawCep) {
      const cep = String(rawCep).replace(/\D/g, '');
      if (!/^\d{8}$/.test(cep)) {
        const error = new Error('Digite um CEP válido com oito números.');
        error.code = 'INVALID_CEP';
        throw error;
      }

      let cepV1 = null;
      let cepV2 = null;
      let cepError = null;
      try {
        cepV1 = await getJson(`${BRASIL_API}/api/cep/v1/${cep}`);
      } catch (error) {
        cepError = error;
      }

      let location = cepV1 ? normalizeCepV1(cepV1, cep) : null;
      if (!location || !hasCoordinates(location)) {
        try {
          cepV2 = await getJson(`${BRASIL_API}/api/cep/v2/${cep}`);
        } catch (error) {
          if (!location) cepError = error;
        }
      }

      if (!location && cepV2) location = normalizeCepV2(cepV2, cep);
      if (location && cepV2) location = mergeCoordinates(location, cepV2);
      if (!location) {
        const error = new Error(cepError?.status === 404 || cepError?.status === 400
          ? 'Não encontramos esse CEP.'
          : 'Não foi possível consultar o CEP agora. Tente novamente.');
        error.code = cepError?.status === 404 || cepError?.status === 400 ? 'CEP_NOT_FOUND' : 'LOCATION_PROVIDER_ERROR';
        throw error;
      }

      const warnings = [];
      const municipality = await resolveMunicipality(location, getJson).catch(() => null);
      if (municipality) {
        location.ibgeCode = String(municipality.id);
        location.city = municipality.nome;
        location.state = municipality.state;
        location.regionCode = municipality.regionCode;
        location.region = await resolveRegion(municipality.regionCode, getJson).catch(() => null);
      } else {
        location.ibgeCode = null;
        warnings.push('Código IBGE municipal não confirmado; os indicadores municipais podem não estar disponíveis.');
      }

      if (location.regionCode && !location.region) warnings.push('Região brasileira indisponível no momento.');

      const [weather, demographics] = await Promise.all([
        getWeather(location, fetchImpl),
        getDemographics(location.ibgeCode, getJson),
      ]);

      if (weather.status === 'unavailable_no_coordinates') warnings.push('Clima indisponível: o CEP não forneceu coordenadas geográficas.');
      else if (weather.status === 'unavailable_provider_error') warnings.push('Não foi possível consultar as condições meteorológicas.');
      if (demographics.population.status !== 'available') warnings.push('População oficial indisponível para este município.');
      if (demographics.density.status !== 'available') warnings.push('Densidade demográfica oficial indisponível para este município.');

      return {
        location,
        weather,
        demographics,
        collectedAt: new Date().toISOString(),
        status: warnings.length ? 'partial' : 'available',
        warnings,
      };
    },
  };
}

function normalizeCepV1(data, cep) {
  if (!data?.city || !data?.state) return null;
  return {
    cep: data.cep || cep,
    street: data.street || null,
    district: data.neighborhood || null,
    city: data.city,
    state: data.state,
    ibgeCode: data.ibge?.city ? String(data.ibge.city) : null,
    latitude: finiteCoordinate(data.latitude),
    longitude: finiteCoordinate(data.longitude),
    regionCode: null,
    region: null,
  };
}

function normalizeCepV2(data, cep) {
  if (!data?.city || !data?.state) return null;
  return {
    cep: data.cep || cep,
    street: data.street || null,
    district: data.neighborhood || null,
    city: data.city,
    state: data.state,
    ibgeCode: data.ibge?.city ? String(data.ibge.city) : null,
    latitude: finiteCoordinate(data.location?.coordinates?.latitude),
    longitude: finiteCoordinate(data.location?.coordinates?.longitude),
    regionCode: null,
    region: null,
  };
}

function mergeCoordinates(location, data) {
  const v2 = normalizeCepV2(data, location.cep);
  return {
    ...location,
    latitude: v2?.latitude ?? location.latitude,
    longitude: v2?.longitude ?? location.longitude,
    ibgeCode: location.ibgeCode || v2?.ibgeCode,
    street: location.street || v2?.street,
    district: location.district || v2?.district,
  };
}

function finiteCoordinate(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function hasCoordinates(location) {
  return Number.isFinite(location.latitude) && Number.isFinite(location.longitude)
    && Math.abs(location.latitude) <= 90 && Math.abs(location.longitude) <= 180;
}

async function resolveMunicipality(location, getJson) {
  const code = location.ibgeCode;
  if (code && /^\d{7}$/.test(code)) {
    try {
      const result = await getJson(`${IBGE_API}/api/v1/localidades/municipios/${code}`);
      const state = municipalityState(result);
      if (result?.nome && state === location.state && normalizeName(result.nome) === normalizeName(location.city)) {
        return { id: result.id, nome: result.nome, state, regionCode: municipalityRegion(result) };
      }
    } catch {
      // Fallback to a verified lookup by municipality and state.
    }
  }

  const municipalities = await getJson(`${IBGE_API}/api/v1/localidades/estados/${encodeURIComponent(location.state)}/municipios`);
  const match = municipalities.find((item) => normalizeName(item.nome) === normalizeName(location.city));
  if (!match) return null;
  const state = municipalityState(match);
  return state === location.state
    ? { id: match.id, nome: match.nome, state, regionCode: municipalityRegion(match) }
    : null;
}

function municipalityState(item) {
  return item?.['regiao-imediata']?.['regiao-intermediaria']?.UF?.sigla
    || item?.microrregiao?.mesorregiao?.UF?.sigla
    || null;
}

function municipalityRegion(item) {
  return item?.['regiao-imediata']?.['regiao-intermediaria']?.UF?.regiao?.sigla
    || item?.microrregiao?.mesorregiao?.UF?.regiao?.sigla
    || null;
}

async function resolveRegion(regionSigla, getJson) {
  const id = REGION_ID_BY_SIGLA[regionSigla];
  if (!id) return null;
  const regions = await getJson(`${BRASIL_API}/api/ibge/regioes/v1`);
  const matched = regions.find((region) => Number(region.id) === id);
  if (!matched) return null;
  return getJson(`${BRASIL_API}/api/ibge/regioes/v1/${id}`);
}

async function getWeather(location, fetchImpl) {
  if (!hasCoordinates(location)) {
    return {
      status: 'unavailable_no_coordinates', temperatureC: null, humidityPercent: null, windKmh: null,
      condition: null, weatherCode: null, observedAt: null, source: 'Open-Meteo', sourceUrl: null,
    };
  }
  try {
    return await getCurrentWeather({ latitude: location.latitude, longitude: location.longitude, fetchImpl });
  } catch {
    return {
      status: 'unavailable_provider_error', temperatureC: null, humidityPercent: null, windKmh: null,
      condition: null, weatherCode: null, observedAt: null, source: 'Open-Meteo', sourceUrl: null,
    };
  }
}

async function getDemographics(ibgeCode, getJson) {
  if (!ibgeCode) return unavailableDemographics();
  const [population, density] = await Promise.all([
    fetchIndicator({ code: ibgeCode, aggregate: '6579', variable: '9324', getJson, label: 'Estimativas de População' }),
    fetchIndicator({ code: ibgeCode, aggregate: '4714', variable: '614', getJson, label: 'Censo Demográfico' }),
  ]);
  return { population, density };
}

async function fetchIndicator({ code, aggregate, variable, getJson, label }) {
  const url = `${IBGE_API}/api/v3/agregados/${aggregate}/periodos/-6/variaveis/${variable}?localidades=N6[${code}]`;
  try {
    const response = await getJson(url);
    const series = response?.[0]?.resultados?.[0]?.series?.[0]?.serie || {};
    const latest = Object.entries(series)
      .filter(([, value]) => value !== '...' && value !== '..' && value !== 'X' && Number.isFinite(Number(value)))
      .sort(([yearA], [yearB]) => Number(yearB) - Number(yearA))[0];
    if (!latest) throw new Error('Nenhum valor publicado.');
    const isDensity = variable === '614';
    return {
      status: 'available', value: Number(latest[1]), unit: isDensity ? 'hab/km²' : 'pessoas',
      year: Number(latest[0]), source: 'IBGE', sourceName: label, table: aggregate, variable, sourceUrl: url,
    };
  } catch {
    return {
      status: 'unavailable', value: null, unit: variable === '614' ? 'hab/km²' : 'pessoas',
      year: null, source: 'IBGE', sourceName: label, table: aggregate, variable, sourceUrl: url,
    };
  }
}

function unavailableDemographics() {
  return {
    population: { status: 'unavailable', value: null, unit: 'pessoas', year: null, source: 'IBGE', sourceName: 'Estimativas de População', sourceUrl: null },
    density: { status: 'unavailable', value: null, unit: 'hab/km²', year: null, source: 'IBGE', sourceName: 'Censo Demográfico', sourceUrl: null },
  };
}

function normalizeName(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}
