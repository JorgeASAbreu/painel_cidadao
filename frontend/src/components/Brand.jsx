import { MapPinned } from 'lucide-react';

export default function Brand({ compact = false }) {
  return (
    <div className={`brand ${compact ? 'brand-compact' : ''}`}>
      <span className="brand-mark"><MapPinned size={21} strokeWidth={2.2} /></span>
      <span className="brand-copy"><strong>Painel Cívico</strong><small>Municipal</small></span>
    </div>
  );
}
