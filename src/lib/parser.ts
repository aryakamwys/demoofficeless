import Papa from "papaparse";
import { ParsedTrip, GroupedTrips } from "@/types";

/**
 * Parse a Grab Business CSV statement.
 * Expected columns may include:
 *   - Passenger/Employee Name
 *   - Booking Code / Booking ID
 *   - Date/Pickup Time
 *   - Pickup Location
 *   - Dropoff Location
 *   - Total Fare / Amount
 *
 * The parser is flexible — it tries to match column names case-insensitively.
 */
export function parseGrabCSV(csvText: string): ParsedTrip[] {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (parsed.errors.length > 0 || parsed.data.length === 0) {
    throw new Error("Format CSV tidak valid atau file kosong");
  }

  // Try to detect column names from the first row
  const sampleKeys = Object.keys(parsed.data[0]);
  const findCol = (patterns: string[]): string | undefined => {
    return sampleKeys.find((key) =>
      patterns.some((p) => key.toLowerCase().includes(p.toLowerCase()))
    );
  };

  const nameCol = findCol(["passenger", "employee", "name", "nama"]);
  const bookingCol = findCol(["booking", "code", "id"]);
  const dateCol = findCol(["date", "time", "tanggal", "pickup time"]);
  const pickupCol = findCol(["pickup", "origin", "dari"]);
  const dropoffCol = findCol(["dropoff", "destination", "drop", "tujuan"]);
  const fareCol = findCol(["fare", "amount", "total", "biaya", "cost"]);
  const serviceCol = findCol(["service", "layanan", "type"]);
  const paymentCol = findCol(["payment", "pembayaran", "method"]);
  const groupCol = findCol(["group", "grup"]);
  const costCodeCol = findCol(["cost code", "description", "keterangan", "trip code"]);

  if (!nameCol || !fareCol) {
    throw new Error(
      "Kolom wajib tidak ditemukan. Pastikan ada kolom nama dan fare/amount."
    );
  }

  const trips: ParsedTrip[] = parsed.data
    .filter((row) => row[nameCol!] && row[fareCol!])
    .map((row) => ({
      employee_name: row[nameCol!].trim(),
      booking_id: bookingCol ? row[bookingCol].trim() : "",
      trip_date: dateCol ? row[dateCol].trim() : "",
      service_type: serviceCol ? row[serviceCol].trim() : "Car Standard",
      payment_method: paymentCol ? row[paymentCol].trim() : "Corporate Billing",
      employee_group: groupCol ? row[groupCol].trim() : "General",
      cost_code: costCodeCol ? row[costCodeCol].trim() : "",
      pickup: pickupCol ? row[pickupCol].trim() : "",
      dropoff: dropoffCol ? row[dropoffCol].trim() : "",
      fare: parseFare(row[fareCol!]),
    }));

  return trips;
}

/**
 * Parse a Grab Business PDF statement.
 * Since the PDF may be image-based, this uses pdf-parse for text-based PDFs.
 * For image-based PDFs, the admin should convert to CSV first.
 */
export async function parseGrabPDF(buffer: Buffer, employees: any[] = []): Promise<ParsedTrip[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfParseModule = await import("pdf-parse-new") as any;
  const pdfParse = pdfParseModule.default || pdfParseModule;
  const data = await pdfParse(buffer);

  const text = data.text;
  if (!text || text.trim().length < 10) {
    throw new Error(
      "PDF tidak memiliki teks yang dapat diekstrak. Gunakan format CSV."
    );
  }

  // Try to extract trip data from text
  // This is a best-effort parser — structure depends on Grab's PDF format
  const trips: ParsedTrip[] = [];

  // Strip all whitespace and newlines to handle word-wrapping in narrow columns
  const normalizedText = text.replace(/\n/g, " ").replace(/\s+/g, " ");

  // Find all booking IDs (Grab format usually A-[A-Z0-9\s]{12,25}V)
  const bookingRegex = /A-[A-Z0-9\s]{12,25}V/g;
  const matches = [...normalizedText.matchAll(bookingRegex)];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const bookingId = match[0].replace(/\s+/g, "");

    // Find date (backwards from booking ID)
    const textBefore = normalizedText.substring(0, match.index);
    const dateMatches = [...textBefore.matchAll(/(\d{2}\s+[A-Za-z]+\s+\d{4})/g)];
    const dateStr = dateMatches.length > 0 ? dateMatches[dateMatches.length - 1][1] : "";

    let isoDate = new Date().toISOString();
    if (dateStr) {
      const parts = dateStr.trim().split(/\s+/);
      if (parts.length >= 3) {
        const idnMonthMap: Record<string, string> = {
          jan: "01", feb: "02", mar: "03", apr: "04", mei: "05", jun: "06",
          jul: "07", agu: "08", sep: "09", okt: "10", nov: "11", des: "12",
          januari: "01", februari: "02", maret: "03", april: "04",
          juni: "06", juli: "07", agustus: "08", september: "09",
          oktober: "10", november: "11", desember: "12",
        };
        const day = parts[0].padStart(2, "0");
        const monthStr = parts[1].toLowerCase();
        const year = parts[2];
        const month = idnMonthMap[monthStr] || "01";
        isoDate = `${year}-${month}-${day}T00:00:00Z`;
      }
    }

    // Find fare (forwards) up to the next booking ID or end
    const nextIndex = i + 1 < matches.length ? matches[i + 1].index : normalizedText.length;
    let textAfter = normalizedText.substring(match.index + match[0].length, nextIndex);

    // Cut off at the next date to avoid matching next trip's dates as fares
    const trailingDateMatch = textAfter.match(/\d{2}\s+[A-Za-z]+\s+\d{4}/);
    let textForFare = textAfter;
    if (trailingDateMatch) {
      textForFare = textAfter.substring(0, trailingDateMatch.index);
    }

    // Extract fare by finding all numbers formatted as thousands (e.g., 313.700)
    // We preserve the dot but remove spaces (313.7 00 -> 313.700)
    const noSpaceText = textForFare.replace(/\s+/g, "");
    const fareMatchesList = [...noSpaceText.matchAll(/(\d{1,3}(?:\.\d{3})+)/g)];
    let fare = 0;
    for (const fMatch of fareMatchesList) {
      const val = parseInt(fMatch[1].replace(/\./g, ""));
      if (val > fare) fare = val;
    }

    // Find service type
    const serviceTypeMatch = textForFare.match(/(Car Standard|Bike Standard|Car Premium|Bike Hemat|GrabCar\.|GrabBike|GrabCar|Bike)/i);
    const service_type = serviceTypeMatch ? serviceTypeMatch[0] : "Car Standard";

    // Find payment method
    const paymentMethodMatch = textForFare.match(/(Corporate Billing)/i);
    const payment_method = paymentMethodMatch ? paymentMethodMatch[0] : "Corporate Billing";

    const employee_group = "General";

    // Extract cost_code, pickup, dropoff (text between "Billing" and the fare/time)
    let cost_code = "";
    let pickup = "Rute Perjalanan Grab";
    let dropoff = "";

    const billMatch = textForFare.match(/Billing/i);
    if (billMatch) {
      const start = billMatch.index + billMatch[0].length;
      let cleanedAfter = textForFare.substring(start).trim();
      // remove trailing numbers and times
      cleanedAfter = cleanedAfter.replace(/[\d\.\sA-Z:]+$/, "");
      
      const pickupStartMatch = cleanedAfter.match(/(Jl\.|Jalan|Cluster|Gedung|Kawasan|Ruko|Mid Plaza|Jatiluhur|CBD|Perumahan|Podomoro|Stasiun|Soekarno-Hatta|Terminal|Alfamidi|South Quarter|De Lovina|Jasmine Garden)/i);
      
      if (pickupStartMatch) {
         cost_code = cleanedAfter.substring(0, pickupStartMatch.index).trim();
         let addresses = cleanedAfter.substring(pickupStartMatch.index).trim();
         
         const secondJl = addresses.substring(10).match(/(Jl\.|Jalan|Cluster|Kawasan|Ruko|Perumahan|Mid Plaza|Jatiluhur|CBD|Podomoro|Stasiun|Soekarno-Hatta|Terminal|Alfamidi|South Quarter|De Lovina|Jasmine Garden)/i);
         if (secondJl) {
            const splitIndex = 10 + secondJl.index;
            pickup = addresses.substring(0, splitIndex).trim();
            dropoff = addresses.substring(splitIndex).trim();
         } else {
            pickup = addresses;
         }
      } else {
         cost_code = cleanedAfter.trim();
      }
    }

    // Find the employee for THIS specific trip
    let tripEmployee = "Unknown Employee";
    const cleanTextAfter = textAfter.toLowerCase().replace(/\s+/g, "");
    
    for (const emp of employees) {
      if (!emp.employee_name) continue;
      const normalizedEmp = emp.employee_name.replace(/\s+/g, "").toLowerCase();
      // Check if textAfter starts with or contains the employee name close to the booking ID
      if (cleanTextAfter.includes(normalizedEmp) && cleanTextAfter.indexOf(normalizedEmp) < 50) {
        tripEmployee = emp.employee_name;
        break;
      }
    }

    if (fare > 0) {
      trips.push({
        employee_name: tripEmployee,
        booking_id: bookingId,
        trip_date: isoDate,
        service_type,
        payment_method,
        employee_group,
        cost_code,
        pickup,
        dropoff,
        fare,
      });
    }
  }

  return trips;
}

/**
 * Group trips by employee name and calculate totals.
 */
export function groupTripsByEmployee(trips: ParsedTrip[]): GroupedTrips[] {
  const groups = new Map<string, ParsedTrip[]>();

  for (const trip of trips) {
    const key = trip.employee_name.toLowerCase().trim();
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(trip);
  }

  return Array.from(groups.entries()).map(([, tripList]) => ({
    employee_name: tripList[0].employee_name,
    trips: tripList,
    trip_count: tripList.length,
    total_amount: tripList.reduce((sum, t) => sum + t.fare, 0),
  }));
}

/**
 * Parse fare string to number. Handles "Rp", dots, commas.
 */
function parseFare(value: string): number {
  const cleaned = value
    .replace(/[Rp\s.IDR]/gi, "")
    .replace(",", ".")
    .trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}
