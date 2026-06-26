import { useDashboardStore } from '@/store/dashboard-store';
import ReactECharts from 'echarts-for-react';
import { useMemo } from 'react';

export default function ChartWidget({ widgetId, slideId }: { widgetId: string, slideId: string }) {
  const store = useDashboardStore();
  const widget = store.slides.find(s => s.id === slideId)?.widgets[widgetId];
  const rawData = store.rawData;

  const option = useMemo(() => {
    if (!widget || rawData.length === 0) return {};

    const labelCol = widget.labelColumn || store.columns[0]?.name;
    const valueCol = widget.valueColumn || store.columns.find(c => c.type === 'number')?.name;

    if (!labelCol || !valueCol) return {};

    // Aggregate data
    const agg: Record<string, number> = {};
    rawData.forEach(r => {
      const l = String(r[labelCol] || '—');
      agg[l] = (agg[l] || 0) + (Number(r[valueCol]) || 0);
    });

    const entries = Object.entries(agg).sort((a, b) => b[1] - a[1]).slice(0, 15);
    const labels = entries.map(e => e[0]);
    const values = entries.map(e => e[1]);

    const baseOption = {
      tooltip: { trigger: 'axis' },
      grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
      xAxis: { type: 'category', data: labels, axisLabel: { interval: 0, rotate: 30, fontSize: 10 } },
      yAxis: { type: 'value' },
      series: [{ data: values, type: widget.type, smooth: true }]
    };

    if (widget.type === 'pie') {
      return {
        tooltip: { trigger: 'item' },
        series: [
          {
            type: 'pie',
            radius: '50%',
            data: entries.map(e => ({ name: e[0], value: e[1] })),
            emphasis: {
              itemStyle: {
                shadowBlur: 10,
                shadowOffsetX: 0,
                shadowColor: 'rgba(0, 0, 0, 0.5)'
              }
            }
          }
        ]
      };
    }

    if (widget.type === 'bar') {
      // Use horizontal bar to match the previous aesthetic
      return {
        ...baseOption,
        xAxis: { type: 'value' },
        yAxis: { type: 'category', data: labels.reverse(), axisLabel: { fontSize: 10, width: 80, overflow: 'truncate' } },
        series: [{ data: values.reverse(), type: 'bar', itemStyle: { borderRadius: [0, 4, 4, 0], color: '#3b82f6' } }]
      };
    }

    return baseOption;
  }, [widget, rawData, store.columns]);

  if (!widget) return null;

  return (
    <div className="h-full w-full">
      <ReactECharts option={option} style={{ height: '100%', width: '100%' }} opts={{ renderer: 'svg' }} />
    </div>
  );
}
