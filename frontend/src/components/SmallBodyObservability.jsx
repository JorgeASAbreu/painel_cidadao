import { useEffect, useRef, useState } from 'react';
import { CalendarDays, Moon, Telescope } from 'lucide-react';
import { api } from '../services/api.js';

function todayAtOffset(offset) {
  const localNow = new Date(Date.now() + offset * 60 * 60 * 1000);
  return `${localNow.getUTCFullYear()}-${String(localNow.getUTCMonth() + 1).padStart(2, '0')}-${String(localNow.getUTCDate()).padStart(2, '0')}`;
}

function isValidCoordinates(latitude, longitude) {
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
}

function estimatedUtcOffset(state, latitude, longitude) {
  if (state === 'PE' && latitude > -5 && longitude > -34.5) return -2;
  if (state === 'AC' || (state === 'AM' && longitude < -63)) return -5;
  if (['AM', 'MT', 'MS', 'RO', 'RR'].includes(state)) return -4;
  return -3;
}

function formatUtcTime(value, offset) {
  if (!value) return '—';
  const match = String(value).trim().match(/^(\d{1,2}):(\d{2})(.*)$/);
  if (!match) return String(value).trim();
  const minutes = (Number(match[1]) * 60 + Number(match[2]) + offset * 60 + 1440) % 1440;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}${match[3]}`;
}

function formatUtcDateTime(value, offset) {
  if (!value) return '—';
  const timestamp = Date.parse(`${String(value).trim().replace(' ', 'T')}Z`);
  if (!Number.isFinite(timestamp)) return String(value).trim();
  const local = new Date(timestamp + offset * 60 * 60 * 1000);
  return `${String(local.getUTCDate()).padStart(2, '0')}/${String(local.getUTCMonth() + 1).padStart(2, '0')} ${String(local.getUTCHours()).padStart(2, '0')}:${String(local.getUTCMinutes()).padStart(2, '0')}`;
}

function present(value) {
  return value === null || value === undefined || value === '' ? '—' : value;
}

export default function SmallBodyObservability({ latitude, longitude, state, locality }) {
  const hasCoordinates = isValidCoordinates(latitude, longitude);
  const offset = hasCoordinates ? estimatedUtcOffset(state, latitude, longitude) : -3;
  const offsetLabel = `UTC${offset < 0 ? '' : '+'}${offset}`;
  const [date, setDate] = useState(() => todayAtOffset(offset));
  const [nearEarthOnly, setNearEarthOnly] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestSequence = useRef(0);
  useEffect(() => {
    if (!hasCoordinates || !date) {
      setResult(null);
      setLoading(false);
      setError('');
      return undefined;
    }

    const sequence = ++requestSequence.current;
    let active = true;
    setLoading(true);
    setError('');
    api.smallBodyObservability({ latitude, longitude, date, nearEarthOnly })
      .then(({ data }) => {
        if (active && requestSequence.current === sequence) setResult(data);
      })
      .catch((requestError) => {
        if (active && requestSequence.current === sequence) setError(requestError.message);
      })
      .finally(() => {
        if (active && requestSequence.current === sequence) setLoading(false);
      });

    return () => { active = false; };
  }, [latitude, longitude, date, nearEarthOnly, hasCoordinates]);

  const objects = result?.objects || [];
  const night = result?.night;

  return (
    <section className="info-card astronomy-card" aria-labelledby="astronomy-title" aria-live="polite">
      <div className="card-heading astronomy-heading">
        <span className="icon-bubble astronomy-icon"><Telescope size={20} /></span>
        <div><p className="eyebrow">NASA / JPL</p><h3 id="astronomy-title">Pequenos corpos observáveis</h3></div>
        <span className="astronomy-locality">{locality}</span>
      </div>

      <div className="astronomy-controls">
        <label className="astronomy-date"><CalendarDays size={16} /><span>Noite de</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} aria-label="Data da noite de observação" /></label>
        <label className="neo-filter"><input type="checkbox" checked={nearEarthOnly} onChange={(event) => setNearEarthOnly(event.target.checked)} /><span>Somente objetos próximos da Terra (NEOs)</span></label>
      </div>

      {!hasCoordinates ? (
        <div className="astronomy-empty" role="status">Indisponível: esta consulta não possui coordenadas válidas para definir o observador.</div>
      ) : loading ? (
        <div className="astronomy-loading" role="status"><span className="spinner" />Calculando alvos para esta noite…</div>
      ) : error ? (
        <div className="astronomy-error" role="status">{error}</div>
      ) : result ? (
        <>
          <div className="astronomy-summary">
            <span><strong>{result.totalObjects.toLocaleString('pt-BR')}</strong> alvos encontrados · exibindo {result.shownObjects}</span>
            {night?.dark_time && <span className="dark-duration"><Moon size={15} /> Céu escuro: {night.dark_time}</span>}
            {night?.sun_set && <span>Pôr do Sol: {formatUtcDateTime(night.sun_set, offset)} · nascer: {formatUtcDateTime(night.sun_rise, offset)} ({offsetLabel})</span>}
          </div>
          {objects.length ? (
            <div className="astronomy-table-wrap">
              <table className="astronomy-table">
                <thead><tr><th>Asteroide / cometa</th><th>Mag. V</th><th>Nascer</th><th>Trânsito</th><th>Ocaso</th><th>Duração máxima</th><th>Ascensão reta</th><th>Declinação</th></tr></thead>
                <tbody>{objects.map((object, index) => (
                  <tr key={`${object.Designation || 'obj'}-${index}`}>
                    <td><strong>{present(object['Full name'] || object.Designation)}</strong><small>{present(object.Designation)}</small></td>
                    <td>{present(object.Vmag)}</td>
                    <td>{formatUtcTime(object['Rise time'], offset)}</td>
                    <td>{formatUtcTime(object['Transit time'], offset)}</td>
                    <td>{formatUtcTime(object['Set time'], offset)}</td>
                    <td>{present(object['Max. time observable'])}</td>
                    <td>{present(object['R.A.'])}</td>
                    <td>{present(object.Dec)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : (
            <div className="astronomy-empty" role="status">Nenhum pequeno corpo corresponde aos critérios para esta noite. Tente outra data ou desmarque o filtro NEO.</div>
          )}
          <p className="astronomy-footnote">Horários convertidos de UT para o fuso local estimado ({offsetLabel}). A lista admite magnitude V até 25; objetos mais tênues podem exigir telescópio. É uma estimativa matemática: nuvens, poluição luminosa e equipamento não são considerados. <a href={result.sourceUrl} target="_blank" rel="noreferrer">Fonte NASA/JPL</a></p>
        </>
      ) : null}
    </section>
  );
}
