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
    <div className="flex flex-col items-center justify-center h-full gap-1 p-4">
      <p className="text-4xl font-bold tracking-tight text-blue-600">
        {total.toLocaleString('id-ID')}
      </p>
      <div className="flex gap-4 mt-2 text-xs text-slate-500">
        <span>Rata-rata: {avg.toLocaleString('id-ID', { maximumFractionDigits: 1 })}</span>
        <span>Count: {vals.length.toLocaleString('id-ID')}</span>
      </div>
    </div>
  );
}
