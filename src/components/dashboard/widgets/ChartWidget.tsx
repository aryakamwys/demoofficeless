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

    const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#6366f1', '#ec4899'];

    const baseOption = {
      color: colors,
      tooltip: { 
        trigger: 'axis',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#e2e8f0',
        textStyle: { color: '#334155', fontSize: 12 },
        padding: [8, 12],
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        borderRadius: 8
      },
      grid: { left: '3%', right: '5%', bottom: '5%', top: '10%', containLabel: true },
      xAxis: { 
        type: 'category', 
        data: labels, 
        axisLabel: { interval: 0, rotate: 30, fontSize: 10, color: '#64748b' },
        axisLine: { lineStyle: { color: '#cbd5e1' } },
        axisTick: { show: false }
      },
      yAxis: { 
        type: 'value',
        splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } },
        axisLabel: { color: '#64748b', fontSize: 10 }
      },
      series: [{ 
        data: values, 
        type: widget.type, 
        smooth: true,
        itemStyle: { color: '#3b82f6' }
      }]
    };

    if (widget.type === 'pie' || widget.type === 'donut') {
      return {
        color: colors,
        tooltip: { 
          trigger: 'item',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          borderColor: '#e2e8f0',
          textStyle: { color: '#334155' },
          borderRadius: 8
        },
        legend: {
          orient: 'vertical',
          right: '5%',
          top: 'center',
          itemWidth: 10,
          itemHeight: 10,
          textStyle: { color: '#64748b', fontSize: 11 }
        },
        series: [
          {
            type: 'pie',
            radius: widget.type === 'donut' ? ['45%', '70%'] : '70%',
            center: ['40%', '50%'],
            avoidLabelOverlap: false,
            itemStyle: {
              borderRadius: widget.type === 'donut' ? 5 : 0,
              borderColor: '#fff',
              borderWidth: 2
            },
            label: { show: false, position: 'center' },
            emphasis: {
              label: {
                show: widget.type === 'donut',
                fontSize: 14,
                fontWeight: 'bold',
                color: '#334155'
              },
              itemStyle: {
                shadowBlur: 10,
                shadowOffsetX: 0,
                shadowColor: 'rgba(0, 0, 0, 0.2)'
              }
            },
            labelLine: { show: false },
            data: entries.map(e => ({ name: e[0], value: e[1] }))
          }
        ]
      };
    }

    if (widget.type === 'bar') {
      return {
        ...baseOption,
        xAxis: { 
          type: 'value',
          splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } },
          axisLabel: { color: '#64748b', fontSize: 10 }
        },
        yAxis: { 
          type: 'category', 
          data: labels.reverse(), 
          axisLabel: { fontSize: 11, width: 100, overflow: 'truncate', color: '#475569' },
          axisLine: { lineStyle: { color: '#cbd5e1' } },
          axisTick: { show: false }
        },
        series: [{ 
          data: values.reverse(), 
          type: 'bar', 
          barMaxWidth: 30,
          itemStyle: { 
            borderRadius: [0, 4, 4, 0], 
            color: '#3b82f6',
            shadowColor: 'rgba(59, 130, 246, 0.2)',
            shadowBlur: 10
          } 
        }]
      };
    }

    if (widget.type === 'gauge') {
      const avgValue = values.length ? (values.reduce((a, b) => a + b, 0) / values.length) : 0;
      // Assume a scale of 0-100 for gauge if not specified. We'll just display the avg value.
      const gaugeValue = Number(avgValue.toFixed(1));
      
      return {
        tooltip: { formatter: '{a} <br/>{b} : {c}%' },
        series: [
          {
            name: labelCol || 'Metric',
            type: 'gauge',
            radius: '90%',
            center: ['50%', '55%'],
            progress: { show: true, width: 12, itemStyle: { color: '#3b82f6' } },
            axisLine: { lineStyle: { width: 12, color: [[1, '#e2e8f0']] } },
            axisTick: { show: false },
            splitLine: { show: false },
            axisLabel: { show: false },
            pointer: { width: 4, itemStyle: { color: '#64748b' } },
            title: { show: false },
            detail: {
              valueAnimation: true,
              fontSize: 24,
              fontWeight: 'bold',
              color: '#334155',
              offsetCenter: [0, '60%'],
              formatter: '{value}'
            },
            data: [{ value: gaugeValue, name: labelCol || 'Score' }]
          }
        ]
      };
    }

    if (widget.type === 'line') {
      return {
        ...baseOption,
        series: [{ 
          data: values, 
          type: 'line', 
          smooth: true,
          symbolSize: 8,
          lineStyle: { width: 3, shadowColor: 'rgba(59, 130, 246, 0.3)', shadowBlur: 10 },
          itemStyle: { color: '#3b82f6', borderColor: '#fff', borderWidth: 2 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(59, 130, 246, 0.4)' },
                { offset: 1, color: 'rgba(59, 130, 246, 0.0)' }
              ]
            }
          }
        }]
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
