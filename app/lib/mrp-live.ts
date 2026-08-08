export type MrpDemandSource = "FIRME" | "FORECAST_FIRME" | "FORECAST_PREDITIVO" | "SIMULACAO";
export type MrpPeriodicity = "DIA" | "SEMANA" | "MES";

export type MrpLiveInventory = { pn: string; description: string; unit: string; group: string; available: number };
export type MrpLiveTransit = {
  pn: string; description: string; unit: string; quantity: number;
  deliveryDate: string | null; purchaseOrder: string; supplier: string;
};
export type MrpLiveDemand = {
  pn: string; description: string; unit: string; quantity: number;
  needDate: string | null; source: MrpDemandSource; reference: string;
};
export type MrpLiveSnapshot = {
  generatedAt: string;
  source: "SUPABASE";
  inventory: MrpLiveInventory[];
  transit: MrpLiveTransit[];
  demands: MrpLiveDemand[];
  counts: {
    activeWorkOrders: number; firmDemandLines: number; forecastFirmLines: number;
    forecastPredictiveLines: number; transitLines: number; skippedNoSku: number;
  };
  warnings: string[];
};

export type MrpLiveWeek = { key: string; label: string; startDate: string };
export type MrpLiveAnalysisRow = {
  pn: string; description: string; unit: string; available: number;
  firmDemand: number; forecastFirmDemand: number; forecastPredictiveDemand: number; simulationDemand: number;
  totalDemand: number; totalIncoming: number; totalSuggested: number;
  firstSuggestedWeek: string | null; projected: number[]; suggested: number[];
  firmByWeek: number[]; forecastFirmByWeek: number[]; forecastPredictiveByWeek: number[]; simulationByWeek: number[]; incoming: number[];
};
export type MrpLivePlan = {
  weeks: MrpLiveWeek[]; rows: MrpLiveAnalysisRow[];
  totalFirmDemand: number; totalForecastFirmDemand: number; totalForecastPredictiveDemand: number; totalSimulationDemand: number;
  totalIncoming: number; totalSuggested: number; shortageItems: number; outsideHorizonDemand: number;
  sourceCounts: MrpLiveSnapshot["counts"];
};

const DAY = 24 * 60 * 60 * 1000;

function numberOf(value: unknown) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function localDate(value: string | null | undefined) {
  const match = String(value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12) : null;
}

function dateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function startOfWeek(value: Date) {
  const copy = new Date(value);
  copy.setHours(12, 0, 0, 0);
  copy.setDate(copy.getDate() - copy.getDay());
  return copy;
}

function excelWeekNumber(value: Date) {
  const first = new Date(value.getFullYear(), 0, 1, 12);
  const days = Math.floor((startOfWeek(value).getTime() - first.getTime()) / DAY);
  return Math.ceil((days + first.getDay() + 1) / 7);
}

function startOfPeriod(value: Date, periodicity: MrpPeriodicity) {
  const copy = new Date(value);
  copy.setHours(12, 0, 0, 0);
  if (periodicity === "DIA") return copy;
  if (periodicity === "MES") {
    copy.setDate(1);
    return copy;
  }
  return startOfWeek(copy);
}

function addPeriod(value: Date, index: number, periodicity: MrpPeriodicity) {
  const copy = new Date(value);
  if (periodicity === "DIA") copy.setDate(copy.getDate() + index);
  else if (periodicity === "MES") copy.setMonth(copy.getMonth() + index);
  else copy.setDate(copy.getDate() + index * 7);
  return copy;
}

function periodLabel(value: Date, periodicity: MrpPeriodicity) {
  if (periodicity === "DIA") return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(value);
  if (periodicity === "MES") return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" }).format(value).replace(".", "");
  return `S${String(excelWeekNumber(value)).padStart(2, "0")}/${value.getFullYear()}`;
}

function bucketIndex(value: string | null, start: Date, length: number, periodicity: MrpPeriodicity) {
  const due = localDate(value);
  const target = due && due.getTime() >= start.getTime() ? due : start;
  let index = 0;
  if (periodicity === "DIA") index = Math.floor((startOfPeriod(target, periodicity).getTime() - start.getTime()) / DAY);
  else if (periodicity === "MES") index = (target.getFullYear() - start.getFullYear()) * 12 + target.getMonth() - start.getMonth();
  else index = Math.floor((startOfWeek(target).getTime() - start.getTime()) / (DAY * 7));
  return index >= 0 && index < length ? index : -1;
}

function add(bucket: Map<string, number[]>, pn: string, index: number, quantity: number, size: number) {
  if (!pn || index < 0 || quantity <= 0) return;
  const values = bucket.get(pn) ?? Array.from({ length: size }, () => 0);
  values[index] += quantity;
  bucket.set(pn, values);
}

function read(bucket: Map<string, number[]>, pn: string, size: number) {
  return bucket.get(pn) ?? Array.from({ length: size }, () => 0);
}

/** Read-only MRP I projection: it never changes purchase orders, stock or reservations. */
export function buildMrpLivePlan(
  snapshot: MrpLiveSnapshot,
  options: { startDate?: Date; horizonWeeks?: number; safetyFactor?: number; periodicity?: MrpPeriodicity; horizon?: number } = {}
): MrpLivePlan {
  const periodicity = options.periodicity ?? "SEMANA";
  const defaultHorizon = periodicity === "DIA" ? 31 : periodicity === "MES" ? 6 : 16;
  const maxHorizon = periodicity === "DIA" ? 120 : periodicity === "MES" ? 24 : 26;
  const minHorizon = periodicity === "DIA" ? 7 : periodicity === "MES" ? 3 : 4;
  const start = startOfPeriod(options.startDate ?? new Date(), periodicity);
  const count = Math.max(minHorizon, Math.min(maxHorizon, Math.floor(options.horizon ?? options.horizonWeeks ?? defaultHorizon)));
  const safety = Math.max(0, numberOf(options.safetyFactor));
  const weeks = Array.from({ length: count }, (_, index) => {
    const date = addPeriod(start, index, periodicity);
    return { key: dateKey(date), label: periodLabel(date, periodicity), startDate: dateKey(date) };
  });
  const firm = new Map<string, number[]>();
  const forecastFirm = new Map<string, number[]>();
  const forecastPredictive = new Map<string, number[]>();
  const simulation = new Map<string, number[]>();
  const incoming = new Map<string, number[]>();
  const meta = new Map<string, { description: string; unit: string; available: number }>();
  let outsideHorizonDemand = 0;

  snapshot.inventory.forEach((item) => meta.set(item.pn, {
    description: item.description, unit: item.unit, available: numberOf(item.available),
  }));
  snapshot.demands.forEach((item) => {
    const quantity = numberOf(item.quantity);
    const index = bucketIndex(item.needDate, start, count, periodicity);
    if (index < 0) { outsideHorizonDemand += quantity; return; }
    const bucket = item.source === "FIRME" ? firm : item.source === "FORECAST_FIRME" ? forecastFirm : item.source === "FORECAST_PREDITIVO" ? forecastPredictive : simulation;
    add(bucket, item.pn, index, quantity, count);
    const known = meta.get(item.pn);
    meta.set(item.pn, { description: known?.description || item.description, unit: known?.unit || item.unit, available: known?.available ?? 0 });
  });
  snapshot.transit.forEach((item) => {
    const index = bucketIndex(item.deliveryDate, start, count, periodicity);
    if (index < 0) return;
    add(incoming, item.pn, index, numberOf(item.quantity), count);
    const known = meta.get(item.pn);
    meta.set(item.pn, { description: known?.description || item.description, unit: known?.unit || item.unit, available: known?.available ?? 0 });
  });

  const pns = new Set([...meta.keys(), ...firm.keys(), ...forecastFirm.keys(), ...forecastPredictive.keys(), ...simulation.keys(), ...incoming.keys()]);
  const rows = [...pns].map((pn) => {
    const firmByWeek = read(firm, pn, count);
    const forecastFirmByWeek = read(forecastFirm, pn, count);
    const forecastPredictiveByWeek = read(forecastPredictive, pn, count);
    const simulationByWeek = read(simulation, pn, count);
    const incomingByWeek = read(incoming, pn, count);
    const totalByWeek = weeks.map((_, index) => firmByWeek[index] + forecastFirmByWeek[index] + forecastPredictiveByWeek[index] + simulationByWeek[index]);
    const projected: number[] = [];
    const suggested = Array.from({ length: count }, () => 0);
    let balance = meta.get(pn)?.available ?? 0;
    totalByWeek.forEach((demand, index) => {
      balance = balance - demand + incomingByWeek[index] - demand * safety;
      if (balance < 0) { suggested[index] = -balance; balance = 0; }
      projected.push(balance);
    });
    const totalSuggested = suggested.reduce((total, value) => total + value, 0);
    const first = suggested.findIndex((value) => value > 0);
    return {
      pn, description: meta.get(pn)?.description || "SKU sem descrição", unit: meta.get(pn)?.unit || "UN", available: meta.get(pn)?.available ?? 0,
      firmDemand: firmByWeek.reduce((total, value) => total + value, 0),
      forecastFirmDemand: forecastFirmByWeek.reduce((total, value) => total + value, 0),
      forecastPredictiveDemand: forecastPredictiveByWeek.reduce((total, value) => total + value, 0),
      simulationDemand: simulationByWeek.reduce((total, value) => total + value, 0),
      totalDemand: totalByWeek.reduce((total, value) => total + value, 0), totalIncoming: incomingByWeek.reduce((total, value) => total + value, 0), totalSuggested,
      firstSuggestedWeek: first >= 0 ? weeks[first].label : null,
      projected, suggested, firmByWeek, forecastFirmByWeek, forecastPredictiveByWeek, simulationByWeek, incoming: incomingByWeek,
    } satisfies MrpLiveAnalysisRow;
  }).filter((row) => row.totalDemand > 0 || row.totalIncoming > 0 || row.totalSuggested > 0)
    .sort((a, b) => b.totalSuggested - a.totalSuggested || b.totalDemand - a.totalDemand || a.pn.localeCompare(b.pn));

  return {
    weeks, rows,
    totalFirmDemand: rows.reduce((total, row) => total + row.firmDemand, 0),
    totalForecastFirmDemand: rows.reduce((total, row) => total + row.forecastFirmDemand, 0),
    totalForecastPredictiveDemand: rows.reduce((total, row) => total + row.forecastPredictiveDemand, 0),
    totalSimulationDemand: rows.reduce((total, row) => total + row.simulationDemand, 0),
    totalIncoming: rows.reduce((total, row) => total + row.totalIncoming, 0),
    totalSuggested: rows.reduce((total, row) => total + row.totalSuggested, 0),
    shortageItems: rows.filter((row) => row.totalSuggested > 0).length,
    outsideHorizonDemand, sourceCounts: snapshot.counts,
  };
}
