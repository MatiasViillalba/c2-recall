import { Link } from 'react-router-dom';
import { ChevronRight, FileCheck2, Layers, PlusCircle, Settings, Smartphone } from 'lucide-react';
import { Logo, SyncBadge } from '../components/Layout';
import { Panel } from '../components/ui';

const ITEMS = [
  { to: '/add', label: 'Agregar e importar', sub: 'Manual, JSON/CSV de Claude, bandeja', icon: PlusCircle, tone: 'bg-sage-soft text-sage' },
  { to: '/decks', label: 'Mazos', sub: 'KWT, Open Cloze, idioms, errores…', icon: Layers, tone: 'bg-lavender-soft text-lavender' },
  { to: '/settings', label: 'Ajustes', sub: 'Estudio, voz, sincronización, copias', icon: Settings, tone: 'bg-primary-soft text-primary' },
  { to: '/coverage', label: 'Informe de cobertura', sub: 'Cómo se procesaron tus tres PDF', icon: FileCheck2, tone: 'bg-amber-soft text-amber' },
];

export default function More() {
  const standalone = typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone);
  return (
    <div className="mx-auto max-w-xl px-4 pt-[calc(env(safe-area-inset-top)+20px)]">
      <div className="mb-6 flex items-center justify-between"><Logo /><SyncBadge compact /></div>
      <Panel className="divide-y divide-line overflow-hidden">
        {ITEMS.map(({ to, label, sub, icon: Icon, tone }) => (
          <Link key={to} to={to} className="flex items-center gap-4 px-4 py-4 transition hover:bg-surface-2">
            <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${tone}`}><Icon size={19} /></span>
            <span className="flex-1">
              <span className="block font-medium text-ink">{label}</span>
              <span className="block text-sm text-muted">{sub}</span>
            </span>
            <ChevronRight size={18} className="text-faint" />
          </Link>
        ))}
      </Panel>
      {!standalone && (
        <Panel className="mt-4 p-4">
          <p className="flex items-center gap-2 font-medium text-ink"><Smartphone size={18} className="text-lavender" /> Instalala como app</p>
          <p className="mt-1 text-sm text-muted">En iPhone (Safari): botón Compartir → «Agregar a pantalla de inicio». En Windows (Edge o Chrome): ícono de instalar en la barra de direcciones.</p>
        </Panel>
      )}
    </div>
  );
}
