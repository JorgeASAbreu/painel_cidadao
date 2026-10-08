import { BarChart3, UsersRound } from 'lucide-react';

function Indicator({ icon: Icon, title, item, unit, format }) {
  const available = item?.status === 'available' && item.value !== null;
  return (
    <div className="indicator-row">
      <span className="indicator-icon"><Icon size={18} /></span>
      <div className="indicator-data">
        <span className="indicator-title">{title}</span>
        <strong>{available ? format(item.value) : 'Indisponível'}</strong>
        {available && <small>{unit} · referência {item.year ?? '—'}</small>}
        <small>{item?.sourceName || item?.source || 'Fonte IBGE'}{item?.table ? ` · tabela ${item.table}` : ''}</small>
        {item?.sourceUrl && <a className="source-link" href={item.sourceUrl} target="_blank" rel="noreferrer">Consultar fonte</a>}
      </div>
    </div>
  );
}

export default function DemographicCard({ demographics }) {
  const numberFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
  return (
    <section className="info-card demographic-card">
      <div className="card-heading">
        <span className="icon-bubble demographic-icon"><BarChart3 size={20} /></span>
        <div><p className="eyebrow">Indicadores oficiais</p><h3>Retrato do município</h3></div>
      </div>
      <div className="indicator-list">
        <Indicator icon={UsersRound} title="População" item={demographics?.population} unit="habitantes" format={(value) => numberFormat.format(value)} />
        <Indicator icon={BarChart3} title="Densidade demográfica" item={demographics?.density} unit="hab/km²" format={(value) => numberFormat.format(value)} />
      </div>
    </section>
  );
}
