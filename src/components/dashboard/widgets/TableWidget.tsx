import { useDashboardStore } from '@/store/dashboard-store';

export default function TableWidget({ widgetId, slideId }: { widgetId: string, slideId: string }) {
  const store = useDashboardStore();
  const widget = store.slides.find(s => s.id === slideId)?.widgets[widgetId];
  const rawData = store.rawData;

  if (!widget || rawData.length === 0) return null;

  // Render a clean table of the first 5 columns and 10 rows
  const displayCols = store.columns.slice(0, 4);
  const displayData = rawData.slice(0, 10);

  return (
    <div className="h-full w-full overflow-auto pt-2">
      <table className="w-full text-left text-sm text-slate-600 border-collapse">
        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
          <tr>
            {displayCols.map(c => (
              <th key={c.name} className="px-3 py-2 whitespace-nowrap">{c.name}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {displayData.map((row, i) => (
            <tr key={i} className="hover:bg-slate-50/50">
              {displayCols.map(c => (
                <td key={c.name} className="px-3 py-2 whitespace-nowrap truncate max-w-[150px]">
                  {String(row[c.name] || '-')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
