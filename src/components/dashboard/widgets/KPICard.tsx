import { Activity, ArrowUpRight, TrendingUp } from 'lucide-react';
import { useDashboardStore } from '@/store/dashboard-store';

export default function KPICard({ widgetId, slideId }: { widgetId: string, slideId: string }) {
  const store = useDashboardStore();
  const widget = store.slides.find(s => s.id === slideId)?.widgets[widgetId];
  const rawData = store.rawData;

  if (!widget) return null;

  const valueCol = widget.valueColumn || store.columns.find(c => c.type === 'number')?.name;
  
  if (!valueCol) {
    return <div className="flex items-center justify-center h-full text-sm text-slate-400">Pilih kolom numerik</div>;
  }

  const vals = rawData.map(d => Number(d[valueCol])).filter(n => !isNaN(n));
  const total = vals.reduce((a, b) => a + b, 0);
  const avg = vals.length ? total / vals.length : 0;

  return (
    <div className="flex flex-col justify-center h-full gap-2 p-2 relative">
      <div className="absolute top-2 right-2 bg-blue-50 text-blue-500 p-2 rounded-full">
        <TrendingUp className="h-5 w-5" />
      </div>
      
      <div className="flex items-baseline gap-2">
        <p className="text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-800">
          {total.toLocaleString('id-ID')}
        </p>
      </div>

      <div className="flex items-center gap-3 mt-1 text-[11px] font-medium text-slate-500">
        <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded">
          <Activity className="h-3 w-3 text-slate-400" />
          <span>Avg: {avg.toLocaleString('id-ID', { maximumFractionDigits: 1 })}</span>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded">
          <ArrowUpRight className="h-3 w-3 text-slate-400" />
          <span>Count: {vals.length.toLocaleString('id-ID')}</span>
        </div>
      </div>
    </div>
  );
}
