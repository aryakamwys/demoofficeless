const idnMonthMap = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  mei: "05",
  jun: "06",
  jul: "07",
  agu: "08",
  sep: "09",
  okt: "10",
  nov: "11",
  des: "12",
  januari: "01",
  februari: "02",
  maret: "03",
  april: "04",
  juni: "06",
  juli: "07",
  agustus: "08",
  september: "09",
  oktober: "10",
  november: "11",
  desember: "12",
};

function parseIdnDate(dateStr) {
  if (!dateStr) return new Date().toISOString();
  
  const parts = dateStr.trim().split(/\s+/);
  if (parts.length >= 3) {
    const day = parts[0].padStart(2, "0");
    const monthStr = parts[1].toLowerCase();
    const year = parts[2];
    
    const month = idnMonthMap[monthStr] || "01";
    return `${year}-${month}-${day}T00:00:00Z`;
  }
  return new Date().toISOString();
}

console.log(parseIdnDate("09 Mei 2025"));
