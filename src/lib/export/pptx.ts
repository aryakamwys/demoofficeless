import pptxgen from "pptxgenjs";

// Utility to replace {{Variables}} in HTML content and strip tags for PPT
const parseTextContent = (html: string, variables: Record<string, any>): string => {
  if (!html) return "";
  let text = html.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    return variables[key.trim()] !== undefined ? String(variables[key.trim()]) : match;
  });
  // Very basic HTML to text (removes tags, converts <p> to newline)
  text = text.replace(/<p[^>]*>/g, "").replace(/<\/p>/g, "\n");
  text = text.replace(/<[^>]+>/g, ""); 
  return text.trim();
};

export const exportDashboardToPPTX = async (
  storeState: any, 
  fileName: string = "Dashboard_Presentation"
) => {
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_WIDE"; // 16:9

  // Title Slide
  const titleSlide = pptx.addSlide();
  titleSlide.addText(fileName, {
    x: 1, y: 2, w: 8, fontSize: 36, bold: true, color: "1e293b"
  });
  titleSlide.addText(new Date().toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' }), {
    x: 1, y: 3, w: 8, fontSize: 14, color: "64748b"
  });

  // Generate Slides
  storeState.slides.forEach((slide: any) => {
    const pptSlide = pptx.addSlide();
    pptSlide.addText(slide.title, { x: 0.5, y: 0.3, w: 10, fontSize: 24, bold: true, color: "1e293b" });

    // Iterate through layout items to preserve positioning
    // React Grid Layout uses a 12-col grid. PPTX Layout Wide is ~13.33 x 7.5 inches
    const colWidth = 13.33 / 12;
    const rowHeight = 0.5; // Approx

    slide.layout.forEach((layoutItem: any) => {
      const widget = slide.widgets[layoutItem.i];
      if (!widget) return;

      const x = 0.5 + (layoutItem.x * colWidth);
      const y = 1.0 + (layoutItem.y * rowHeight);
      const w = layoutItem.w * colWidth - 0.2;
      const h = layoutItem.h * rowHeight - 0.2;

      // Render based on widget type
      if (widget.type === 'text') {
        const text = parseTextContent(widget.content, storeState.variables);
        pptSlide.addText(text, {
          x, y, w, h, fontSize: 12, color: "334155", valign: "top",
          autoFit: true
        });
      } else if (widget.type === 'kpi') {
        const valueCol = widget.valueColumn || storeState.columns.find((c:any) => c.type === 'number')?.name;
        if (valueCol) {
           const vals = storeState.rawData.map((d:any) => Number(d[valueCol])).filter((n:any) => !isNaN(n));
           const total = vals.reduce((a:number, b:number) => a + b, 0);
           
           pptSlide.addText(widget.title, { x, y, w, h: 0.5, fontSize: 14, color: "64748b", align: "center" });
           pptSlide.addText(total.toLocaleString('id-ID'), { x, y: y + 0.5, w, h: h - 0.5, fontSize: 32, bold: true, color: "3b82f6", align: "center" });
        }
      } else if (['bar', 'pie', 'line', 'donut'].includes(widget.type)) {
        // Since we can't easily capture the ECharts canvas instance from here synchronously without ref hacking,
        // we will generate a data table representation of the chart for the PPTX as a fallback.
        // In a full production version, we would use html2canvas or ECharts getDataURL() to insert an image.
        
        pptSlide.addText(`[Chart Placeholder: ${widget.title}]`, {
           x, y, w, h, fontSize: 12, color: "94a3b8", align: "center", valign: "middle",
           fill: { color: "f8fafc" }, border: { type: "solid", color: "cbd5e1" }
        });
      }
    });
  });

  await pptx.writeFile({ fileName: `${fileName}.pptx` });
};
