import { CloudSun, Droplets, Wind } from 'lucide-react';

function display(value, suffix) {
  return value === null || value === undefined ? '—' : `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)}${suffix}`;
}

export default function WeatherCard({ weather, historical = false }) {
  const available = weather?.status === 'available';
  return (
    <section className="info-card weather-card">
      <div className="card-heading">
        <span className="icon-bubble weather-icon"><CloudSun size={20} /></span>
        <div><p className="eyebrow">{historical ? 'Última condição registrada' : 'Condições atuais'}</p><h3>Clima</h3></div>
      </div>
      {available ? (
        <>
          <div className="weather-main"><strong>{display(weather.temperatureC, '°')}</strong><span>{weather.condition}</span></div>
          <div className="weather-stats">
            <div><Droplets size={16} /><span>Umidade</span><b>{display(weather.humidityPercent, '%')}</b></div>
            <div><Wind size={16} /><span>Vento</span><b>{display(weather.windKmh, ' km/h')}</b></div>
          </div>
          <p className="source-note">Open-Meteo · medido em {formatDateTime(weather.observedAt)}</p>
        </>
      ) : (
        <p className="unavailable-note">{weather?.status === 'unavailable_no_coordinates' ? 'Sem coordenadas disponíveis para consultar o clima.' : 'Condições meteorológicas indisponíveis no momento.'}</p>
      )}
    </section>
  );
}

export function formatDateTime(value) {
  if (!value) return 'horário indisponível';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}
