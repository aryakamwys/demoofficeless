// Elemen visual bergaya halaman ticket InvGate — dipakai halaman EnvGate Test
// dan report klaim. Tanpa "use client": aman untuk Server Component (report).

/** Docs InvGate: 1=Incident, 2=Service Request, 3=Question, 4=Problem, 5=Change, 6=Major Incident */
export const TYPE_NAMES: Record<number, string> = {
  1: "Incident",
  2: "Service Request",
  3: "Question",
  4: "Problem",
  5: "Change",
  6: "Major Incident",
};

/** Docs InvGate (fixed): 1=Low..5=Critical — fallback kalau /priorities tidak terjangkau. */
export const PRIORITY_NAMES: Record<number, string> = {
  1: "Low",
  2: "Medium",
  3: "High",
  4: "Urgent",
  5: "Critical",
};

/** pretty_id dari API bisa sudah ber-awalan # — normalisasi supaya tidak jadi "##PIM-x". */
export function invPrettyId(inv: { pretty_id?: string; id: number }): string {
  return `#${(inv.pretty_id || `PIM-${inv.id}`).replace(/^#*/, "")}`;
}

/**
 * Description ticket EnvGate berisi HTML mentah (<p>, <br>, &nbsp;).
 * Ubah ke teks polos: <br>/<p> jadi baris baru, tag dibuang, entity didecode.
 */
export function stripInvHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const TYPE_STYLES: Record<number, { bg: string; label: string }> = {
  1: { bg: "bg-orange-500", label: "!" },
  2: { bg: "bg-blue-500", label: "»" },
  3: { bg: "bg-teal-500", label: "?" },
  4: { bg: "bg-pink-500", label: "!" },
  5: { bg: "bg-purple-500", label: "↻" },
  6: { bg: "bg-red-600", label: "!!" },
};

const AVATAR_BG = [
  "bg-slate-500",
  "bg-blue-400",
  "bg-amber-600",
  "bg-teal-500",
  "bg-indigo-400",
  "bg-rose-400",
];

export function invInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "?"
  );
}

export function invAvatarBg(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_BG[h % AVATAR_BG.length];
}

export function InvAvatar({
  name,
  className = "h-6 w-6 text-[10px]",
}: {
  name: string;
  className?: string;
}) {
  if (!name) return <span className="text-slate-300">—</span>;
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${invAvatarBg(
        name
      )} ${className}`}
    >
      {invInitials(name)}
    </span>
  );
}

export function InvTypeIcon({ typeId }: { typeId?: number }) {
  const type = TYPE_STYLES[typeId ?? 0] ?? { bg: "bg-slate-400", label: "•" };
  return (
    <span
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] text-[10px] font-bold text-white ${type.bg}`}
    >
      {type.label}
    </span>
  );
}
