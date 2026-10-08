import { requestJson } from './http.js';

const WEATHER_LABELS = new Map([
  [0, 'Céu limpo'], [1, 'Predominantemente limpo'], [2, 'Parcialmente nublado'], [3, 'Nublado'],
  [45, 'Neblina'], [48, 'Neblina com geada'], [51, 'Garoa leve'], [53, 'Garoa moderada'], [55, 'Garoa intensa'],
  [56, 'Garoa congelante leve'], [57, 'Garoa congelante intensa'], [61, 'Chuva leve'], [63, 'Chuva moderada'],
  [65, 'Chuva intensa'], [66, 'Chuva congelante leve'], [67, 'Chuva congelante intensa'], [71, 'Neve leve'],
  [73, 'Neve moderada'], [75, 'Neve intensa'], [77, 'Grãos de neve'], [80, 'Pancadas de chuva leves'],
  [81, 'Pancadas de chuva moderadas'], [82, 'Pancadas de chuva fortes'], [85, 'Pancadas de neve leves'],
  [86, 'Pancadas de neve fortes'], [95, 'Trovoada'], [96, 'Trovoada com granizo leve'], [99, 'Trovoada com granizo forte'],
]);

export function describeWeatherCode(code) {
  return WEATHER_LABELS.get(Number(code)) || 'Condição não identificada';
}

export async function getCurrentWeather({ latitude, longitude, fetchImpl = fetch }) {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(latitude));
  url.searchParams.set('longitude', String(longitude));
  url.searchParams.set('current', 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m');
  url.searchParams.set('timezone', 'America/Sao_Paulo');
  const response = await requestJson(url, { fetchImpl });
  const current = response.current;
  if (!current) throw new Error('O serviço meteorológico não retornou condições atuais.');

  return {
    status: 'available',
    temperatureC: finiteOrNull(current.temperature_2m),
    humidityPercent: finiteOrNull(current.relative_humidity_2m),
    windKmh: finiteOrNull(current.wind_speed_10m),
    weatherCode: finiteOrNull(current.weather_code),
    condition: describeWeatherCode(current.weather_code),
    observedAt: current.time || null,
    source: 'Open-Meteo',
    sourceUrl: url.toString(),
  };
}

function finiteOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
