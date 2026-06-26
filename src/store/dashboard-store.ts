import { create } from 'zustand';

export type ChartType = "kpi" | "bar" | "pie" | "donut" | "line" | "table" | "text" | "gauge";

export interface DashboardWidget {
  id: string;
  type: ChartType;
  title: string;
  // Chart specific
  labelColumn?: string;
  valueColumn?: string;
  xAxisColumn?: string;
  yAxisColumn?: string;
  // Text specific
  content?: string;
}

export interface GridLayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  maxW?: number;
  minH?: number;
  maxH?: number;
  static?: boolean;
  isDraggable?: boolean;
  isResizable?: boolean;
}

export interface SlideLayout {
  id: string; // slide id
  title: string;
  layout: GridLayoutItem[]; // react-grid-layout items
  widgets: Record<string, DashboardWidget>; // widgetId -> widget properties
}

export interface DetectedColumn {
  name: string;
  type: "number" | "date" | "category" | "text";
}

interface DashboardState {
  // Global Data
  file: File | null;
  rawData: any[];
  columns: DetectedColumn[];
  variables: Record<string, any>; // Extracted variables like {{TotalRows}}
  
  // Slides & Layouts
  slides: SlideLayout[];
  activeSlideId: string | null;
  
  // Selection State
  selectedWidgetId: string | null;
  
  // Actions
  setFileData: (file: File, data: any[], cols: DetectedColumn[]) => void;
  updateVariables: (vars: Record<string, any>) => void;
  
  addSlide: (slide: SlideLayout) => void;
  setActiveSlide: (id: string) => void;
  
  addWidgetToSlide: (slideId: string, widget: DashboardWidget, layoutItem: GridLayoutItem) => void;
  updateWidget: (slideId: string, widgetId: string, updates: Partial<DashboardWidget>) => void;
  updateSlideLayout: (slideId: string, layout: GridLayoutItem[]) => void;
  removeWidget: (slideId: string, widgetId: string) => void;
  
  setSelectedWidget: (id: string | null) => void;
  
  resetStore: () => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  file: null,
  rawData: [],
  columns: [],
  variables: {},
  
  slides: [],
  activeSlideId: null,
  
  selectedWidgetId: null,
  
  setFileData: (file, rawData, columns) => set({ file, rawData, columns }),
  
  updateVariables: (vars) => set((state) => ({ variables: { ...state.variables, ...vars } })),
  
  addSlide: (slide) => set((state) => {
    const isFirst = state.slides.length === 0;
    return {
      slides: [...state.slides, slide],
      activeSlideId: isFirst ? slide.id : state.activeSlideId
    };
  }),
  
  setActiveSlide: (id) => set({ activeSlideId: id, selectedWidgetId: null }),
  
  addWidgetToSlide: (slideId, widget, layoutItem) => set((state) => ({
    slides: state.slides.map(slide => {
      if (slide.id !== slideId) return slide;
      return {
        ...slide,
        layout: [...slide.layout, layoutItem],
        widgets: { ...slide.widgets, [widget.id]: widget }
      };
    })
  })),
  
  updateWidget: (slideId, widgetId, updates) => set((state) => ({
    slides: state.slides.map(slide => {
      if (slide.id !== slideId) return slide;
      const widget = slide.widgets[widgetId];
      if (!widget) return slide;
      return {
        ...slide,
        widgets: {
          ...slide.widgets,
          [widgetId]: { ...widget, ...updates }
        }
      };
    })
  })),
  
  updateSlideLayout: (slideId, layout) => set((state) => ({
    slides: state.slides.map(slide => {
      if (slide.id !== slideId) return slide;
      return { ...slide, layout };
    })
  })),
  
  removeWidget: (slideId, widgetId) => set((state) => ({
    slides: state.slides.map(slide => {
      if (slide.id !== slideId) return slide;
      const newWidgets = { ...slide.widgets };
      delete newWidgets[widgetId];
      return {
        ...slide,
        layout: slide.layout.filter(l => l.i !== widgetId),
        widgets: newWidgets
      };
    }),
    selectedWidgetId: state.selectedWidgetId === widgetId ? null : state.selectedWidgetId
  })),
  
  setSelectedWidget: (id) => set({ selectedWidgetId: id }),
  
  resetStore: () => set({
    file: null,
    rawData: [],
    columns: [],
    variables: {},
    slides: [],
    activeSlideId: null,
    selectedWidgetId: null
  })
}));
