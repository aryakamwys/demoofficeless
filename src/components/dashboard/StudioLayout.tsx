import { useDashboardStore } from "@/store/dashboard-store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  BarChart3, Hash, Type, Image as ImageIcon, Layout as LayoutIcon, 
  Presentation, Settings, Layers, Download, Plus, Trash2, X, LayoutGrid
} from "lucide-react";
import { Responsive } from "react-grid-layout";
import { useRef, useState, useEffect } from "react";
import 'react-resizable/css/styles.css';
import ChartWidget from './widgets/ChartWidget';
import TextWidget from './widgets/TextWidget';
import KPICard from './widgets/KPICard';
import TableWidget from './widgets/TableWidget';
import { exportDashboardToPPTX } from '@/lib/export/pptx';

function useContainerWidth(ref: React.RefObject<HTMLDivElement | null>) {
  const [width, setWidth] = useState(1200);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(entries => setWidth(entries[0].contentRect.width));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

export default function StudioLayout({ onPresent }: { onPresent: () => void }) {
  const store = useDashboardStore();
  const { slides, activeSlideId, selectedWidgetId, variables } = store;
  const activeSlide = slides.find(s => s.id === activeSlideId);
  const containerRef = useRef<HTMLDivElement>(null);
  const width = useContainerWidth(containerRef);

  const addWidget = (type: "chart" | "kpi" | "text" | "table") => {
    if (!activeSlideId) return;
    const id = `widget-${Date.now()}`;
    
    // Default layout position
    const yMax = activeSlide?.layout.reduce((acc, l: any) => Math.max(acc, l.y + l.h), 0) || 0;
    const h = type === 'kpi' ? 2 : type === 'text' ? 2 : 4;
    const w = type === 'kpi' ? 3 : type === 'text' ? 6 : 6;

    store.addWidgetToSlide(activeSlideId, {
      id,
      type: type === 'chart' ? 'bar' : type,
      title: `New ${type}`,
    }, {
      i: id, x: 0, y: yMax, w, h
    });
  };

  const handleLayoutChange = (layout: readonly any[]) => {
    if (activeSlideId) {
      // Cast back to any[] to match the store if needed, or simply pass as any
      store.updateSlideLayout(activeSlideId, layout as any[]);
    }
  };

  return (
    <div className="flex h-[calc(100vh-100px)] w-full overflow-hidden bg-slate-50 border rounded-xl shadow-sm">
      
      {/* ── Left Sidebar (Palette & Slides) ── */}
      <div className="w-64 bg-white border-r flex flex-col shrink-0">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <LayoutIcon className="h-4 w-4" /> Studio
          </h2>
        </div>
        
        <ScrollArea className="flex-1">
          {/* Add Elements */}
          <div className="p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Add Elements</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-20 flex flex-col gap-2 bg-slate-50 hover:bg-slate-100" onClick={() => addWidget('chart')}>
                <BarChart3 className="h-5 w-5 text-blue-600" />
                <span className="text-xs text-slate-600">Chart</span>
              </Button>
              <Button variant="outline" className="h-20 flex flex-col gap-2 bg-slate-50 hover:bg-slate-100" onClick={() => addWidget('kpi')}>
                <Hash className="h-5 w-5 text-emerald-600" />
                <span className="text-xs text-slate-600">KPI</span>
              </Button>
              <Button variant="outline" className="h-20 flex flex-col gap-2 bg-slate-50 hover:bg-slate-100" onClick={() => addWidget('text')}>
                <Type className="h-5 w-5 text-amber-600" />
                <span className="text-xs text-slate-600">Text</span>
              </Button>
              <Button variant="outline" className="h-20 flex flex-col gap-2 bg-slate-50 hover:bg-slate-100" onClick={() => addWidget('table')}>
                <LayoutGrid className="h-5 w-5 text-purple-600" />
                <span className="text-xs text-slate-600">Table</span>
              </Button>
            </div>
          </div>

          <Separator />

          {/* Slides Management */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Slides</p>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                const newId = `slide-${Date.now()}`;
                store.addSlide({ id: newId, title: `Slide ${slides.length + 1}`, layout: [], widgets: {} });
              }}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-2">
              {slides.map((s, i) => (
                <div 
                  key={s.id} 
                  className={`flex items-center justify-between p-2 rounded cursor-pointer border transition-colors ${
                    activeSlideId === s.id ? "bg-blue-50 border-blue-200" : "bg-white border-slate-100 hover:border-slate-300"
                  }`}
                  onClick={() => store.setActiveSlide(s.id)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-400 w-4">{i + 1}.</span>
                    <span className={`text-sm ${activeSlideId === s.id ? "font-medium text-blue-700" : "text-slate-600"}`}>
                      {s.title}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* ── Center Canvas ── */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-100/50">
        <div className="h-12 bg-white border-b flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-600">{activeSlide?.title || "Select a slide"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onPresent}>
              <Presentation className="h-4 w-4 mr-2" /> Present
            </Button>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => exportDashboardToPPTX(store, store.file?.name || "Dashboard")}>
              <Download className="h-4 w-4 mr-2" /> Export PPTX
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 p-6">
          {activeSlide ? (
            <div className="bg-white rounded-lg shadow-sm border min-h-[600px] max-w-5xl mx-auto"
                 ref={containerRef}
                 onClick={(e) => {
                   if (e.target === e.currentTarget) store.setSelectedWidget(null);
                 }}>
              <Responsive
                width={width}
                className="layout"
                layouts={{ lg: activeSlide.layout }}
                breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                cols={{ lg: 12, md: 12, sm: 12, xs: 12, xxs: 12 }}
                rowHeight={40}
                onLayoutChange={handleLayoutChange}
                // @ts-ignore
                isDraggable={true}
                isResizable={true}
                margin={[16, 16]}
              >
                {activeSlide.layout.map(l => {
                  const widget = activeSlide.widgets[l.i];
                  if (!widget) return <div key={l.i}></div>;
                  const isSelected = selectedWidgetId === l.i;

                  return (
                    <div 
                      key={l.i} 
                      className={`relative bg-white border rounded shadow-sm hover:shadow-md transition-shadow group ${
                        isSelected ? "ring-2 ring-blue-500 border-transparent" : "border-slate-200"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        store.setSelectedWidget(l.i);
                      }}
                    >
                      {/* Widget Header & Actions */}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-white/90 p-1 rounded border shadow-sm z-10">
                         <button className="p-1 hover:bg-slate-100 rounded text-slate-500" onClick={(e) => {
                           e.stopPropagation();
                           store.removeWidget(activeSlide.id, l.i);
                         }}>
                           <Trash2 className="h-3 w-3 text-red-500" />
                         </button>
                      </div>
                      
                      <div className="h-full w-full pt-8 pb-2 px-4 overflow-hidden flex flex-col">
                        <div className="text-xs font-semibold text-slate-500 mb-2 absolute top-2 left-4">{widget.title}</div>
                        <div className="flex-1 w-full h-full relative">
                           {widget.type === 'text' && <TextWidget widgetId={l.i} slideId={activeSlide.id} />}
                           {widget.type === 'kpi' && <KPICard widgetId={l.i} slideId={activeSlide.id} />}
                           {['bar', 'pie', 'line', 'donut', 'gauge'].includes(widget.type) && <ChartWidget widgetId={l.i} slideId={activeSlide.id} />}
                           {widget.type === 'table' && <TableWidget widgetId={l.i} slideId={activeSlide.id} />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </Responsive>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400">
              No slide selected
            </div>
          )}
        </ScrollArea>
      </div>

      {/* ── Right Sidebar (Properties & Variables) ── */}
      <div className="w-72 bg-white border-l flex flex-col shrink-0">
        <div className="p-4 border-b flex items-center gap-2">
          <Settings className="h-4 w-4 text-slate-500" />
          <h2 className="font-semibold text-slate-800">Properties</h2>
        </div>
        
        <ScrollArea className="flex-1">
          {selectedWidgetId && activeSlide ? (
            <div className="p-4 space-y-4">
              {/* Title */}
              <div>
                 <label className="text-xs font-medium text-slate-600 block mb-1">Title</label>
                 <input 
                   type="text" 
                   className="w-full text-sm border rounded p-1.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                   value={activeSlide.widgets[selectedWidgetId]?.title || ""}
                   onChange={(e) => store.updateWidget(activeSlide.id, selectedWidgetId, { title: e.target.value })}
                 />
              </div>

              {/* Chart Properties */}
              {['bar', 'pie', 'line', 'kpi', 'donut', 'gauge', 'table'].includes(activeSlide.widgets[selectedWidgetId]?.type) && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">Data Config</h3>
                  
                  {activeSlide.widgets[selectedWidgetId]?.type !== 'kpi' && activeSlide.widgets[selectedWidgetId]?.type !== 'table' && (
                    <div>
                      <label className="text-xs font-medium text-slate-600 block mb-1">Chart Type</label>
                      <select 
                        className="w-full text-sm border rounded p-1.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                        value={activeSlide.widgets[selectedWidgetId]?.type || "bar"}
                        onChange={(e) => store.updateWidget(activeSlide.id, selectedWidgetId, { type: e.target.value as any })}
                      >
                        <option value="bar">Bar Chart</option>
                        <option value="line">Line Chart</option>
                        <option value="pie">Pie Chart</option>
                        <option value="donut">Donut Chart</option>
                        <option value="gauge">Gauge Chart</option>
                      </select>
                    </div>
                  )}

                  {activeSlide.widgets[selectedWidgetId]?.type !== 'table' && (
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1">
                      {activeSlide.widgets[selectedWidgetId]?.type === 'kpi' ? 'Label (Optional)' : 'X-Axis (Label)'}
                    </label>
                    <select 
                      className="w-full text-sm border rounded p-1.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                      value={activeSlide.widgets[selectedWidgetId]?.labelColumn || ""}
                      onChange={(e) => store.updateWidget(activeSlide.id, selectedWidgetId, { labelColumn: e.target.value })}
                    >
                      <option value="">-- Select Column --</option>
                      {store.columns.map(c => (
                        <option key={c.name} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  )}

                  {activeSlide.widgets[selectedWidgetId]?.type !== 'table' && (
                  <div>
                    <label className="text-xs font-medium text-slate-600 block mb-1">
                      {activeSlide.widgets[selectedWidgetId]?.type === 'kpi' ? 'Metric Value' : 'Y-Axis (Value)'}
                    </label>
                    <select 
                      className="w-full text-sm border rounded p-1.5 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                      value={activeSlide.widgets[selectedWidgetId]?.valueColumn || ""}
                      onChange={(e) => store.updateWidget(activeSlide.id, selectedWidgetId, { valueColumn: e.target.value })}
                    >
                      <option value="">-- Select Column --</option>
                      {store.columns.filter(c => c.type === 'number').map(c => (
                        <option key={c.name} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 text-center text-sm text-slate-500 mt-10">
              Select an element on the canvas to edit its properties.
            </div>
          )}

          <Separator className="my-4" />

          {/* Variables Panel */}
          <div className="p-4">
            <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-3">Variables</h3>
            <p className="text-[10px] text-slate-500 mb-3">Drag or type <code>{`{{Variable}}`}</code> into text blocks to make them dynamic.</p>
            
            <div className="space-y-1">
              {Object.entries(variables).map(([k, v]) => (
                <div key={k} className="flex flex-col bg-slate-50 border rounded p-2">
                  <span className="text-xs font-medium text-slate-700">{`{{${k}}}`}</span>
                  <span className="text-xs text-slate-500 truncate" title={String(v)}>{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>
      </div>
      
    </div>
  );
}
