/**
 * Assignment engineer deterministik dari data CSV (Openclaw).
 * Pure function — dipakai route /api/automation/assign.
 *
 * Aturan (urutan filter lalu rank):
 *  1. available = true
 *  2. sites engineer mencakup site customer ( "*" = semua site )
 *  3. skills engineer cocok dengan service/skills yang dibutuhkan
 *  4. rank: kecocokan skill terbanyak, lalu beban (active_tickets) terkecil
 * Tidak ada kandidat lolos → Needs Assignment (JANGAN nebak engineer).
 */

export interface EngineerRow {
  name: string;
  email: string;
  /** dipisah ";" pada CSV */
  skills: string[];
  /** dipisah ";" pada CSV; "*" berarti mencakup semua site */
  sites: string[];
  available: boolean;
  active_tickets: number;
  /** id user InvGate asli bila email ter-resolve — null = belum */
  invgate_agent_id?: number | null;
}

export interface CustomerRow {
  name: string;
  email: string;
  site: string;
  service: string;
}

export interface AssignmentResult {
  engineer: EngineerRow | null;
  /** null bila belum kverifikasi ke InvGate — bukan karangan */
  invgate_agent_id: number | null;
  needs_assignment: boolean;
  rationale: string[];
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function assignEngineer(
  engineers: EngineerRow[],
  need: { site: string; required_skills: string[]; customer: string }
): AssignmentResult {
  const rationale: string[] = [];
  if (engineers.length === 0) {
    return {
      engineer: null,
      invgate_agent_id: null,
      needs_assignment: true,
      rationale: ["Data engineer (CSV) belum diimpor — tidak ada kandidat."],
    };
  }
  rationale.push(`Kandidat awal: ${engineers.length} engineer dari CSV.`);

  const available = engineers.filter((e) => e.available);
  rationale.push(
    `Filter ketersediaan: ${available.length} tersedia (${
      engineers.length - available.length
    } tidak tersedia).`
  );

  const bySite = available.filter((e) => {
    const sites = e.sites.map(norm);
    return sites.includes("*") || sites.includes(norm(need.site));
  });
  rationale.push(
    `Filter site "${need.site}": ${bySite.length} engineer mencakup lokasi customer.`
  );

  const needTokens = new Set(
    [need.site, ...need.required_skills].map(norm).filter(Boolean)
  );
  const scored = bySite
    .map((e) => {
      const skillTokens = new Set([...e.skills, ...e.sites].map(norm));
      let matches = 0;
      for (const t of needTokens) if (skillTokens.has(t)) matches++;
      return { engineer: e, matches };
    })
    .sort(
      (a, b) =>
        b.matches - a.matches ||
        a.engineer.active_tickets - b.engineer.active_tickets ||
        a.engineer.name.localeCompare(b.engineer.name)
    );

  const best = scored[0];
  if (!best || bySite.length === 0) {
    return {
      engineer: null,
      invgate_agent_id: null,
      needs_assignment: true,
      rationale: [
        ...rationale,
        "Tidak ada engineer yang lolos semua filter → Needs Assignment.",
      ],
    };
  }

  rationale.push(
    `Rank: kecocokan skill ${best.matches} token, beban ${best.engineer.active_tickets} tiket aktif — terpilih ${best.engineer.name}.`
  );
  if (best.matches === 0) {
    rationale.push(
      "Catatan: tidak ada skill yang cocok persis — dipilih dari kandidat site terbersih beban."
    );
  }
  rationale.push(
    best.engineer.invgate_agent_id
      ? `Email ${best.engineer.email} ter-resolve ke agen InvGate id ${best.engineer.invgate_agent_id}.`
      : `Email ${best.engineer.email} belum ter-resolve ke ID agen InvGate — assignment dicatat lokal saja.`
  );

  return {
    engineer: best.engineer,
    invgate_agent_id: best.engineer.invgate_agent_id ?? null,
    needs_assignment: false,
    rationale,
  };
}
