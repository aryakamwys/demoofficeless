---
tokens:
  color:
    primary: blue-600
    primary_soft_bg: blue-50
    text_active: blue-700
    neutral: slate (50–700)
    border: slate-200 (layout) / slate-300 (table)
    success: emerald-700 on emerald-50
    warning: amber-700 on amber-50
    muted: slate-500
  typography:
    page_title: text-lg font-semibold
    nav_item: text-sm font-medium
    table: text-[11px]
  spacing:
    table_cell: px-2 py-2
    table_header: px-3 py-3
  component:
    active_item: bg-blue-50/50 text-blue-700 + absolute left bar w-1 bg-blue-600
    table_header: bg-slate-100 border-slate-300 font-semibold text-slate-700
    badge: tinted pill (bg-*-50 text-*-700)
---

# DESIGN.md — Perkom Dashboard

Token di atas diekstrak dari UI existing (sidebar, header, tabel Request EnvGate).
Semua UI baru wajib pakai token ini — jangan introduce warna/spacing baru.
