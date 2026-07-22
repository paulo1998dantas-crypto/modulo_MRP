"use client";

import { useEffect, useMemo, useState } from "react";

type Stage =
  | "VIDROS"
  | "A/C"
  | "PREP"
  | "SERRA."
  | "EXPE."
  | "DESMONT"
  | "ELÉTRICA"
  | "REVEST"
  | "BCO"
  | "ACESSÓ."
  | "PLOTA."
  | "LIBERA.";

type Order = {
  id: number;
  status: string;
  item: string;
  dueDate: string;
  customer: string;
  city: string;
  model: string;
  chassis: string;
  line: string;
  transformation: string;
  bank: string;
  ac: string;
  acType: string;
  accessory: string;
  plot: string;
  sequence: number;
  stages: Record<Stage, string>;
};

type TimeRule = {
  id: number;
  line: string;
  transformation: string;
  bank: string;
  acType: string;
  minutes: Record<Stage, number>;
};

type CalendarConfig = {
  startDate: string;
  dayStart: string;
  hoursPerDay: number;
  workingDays: number[];
  holidays: string;
  completeFlow: boolean;
};

type Operation = {
  id: string;
  orderId: number;
  item: string;
  customer: string;
  stage: Stage;
  line: string;
  start: Date;
  end: Date;
  minutes: number;
  dueDate: string;
};

const stages: Stage[] = [
  "VIDROS",
  "A/C",
  "PREP",
  "SERRA.",
  "EXPE.",
  "DESMONT",
  "ELÉTRICA",
  "REVEST",
  "BCO",
  "ACESSÓ.",
  "PLOTA.",
  "LIBERA.",
];

const initialCalendar: CalendarConfig = {
  startDate: "2026-07-22",
  dayStart: "07:30",
  hoursPerDay: 8.8,
  workingDays: [1, 2, 3, 4, 5],
  holidays: "2026-07-25",
  completeFlow: false,
};

const defaultMinutes: Record<Stage, number> = {
  VIDROS: 120,
  "A/C": 180,
  PREP: 90,
  "SERRA.": 80,
  "EXPE.": 60,
  DESMONT: 120,
  ELÉTRICA: 180,
  REVEST: 318,
  BCO: 240,
  "ACESSÓ.": 90,
  "PLOTA.": 75,
  "LIBERA.": 72,
};

const initialRules: TimeRule[] = [
  {
    id: 1,
    line: "LAB",
    transformation: "J I CONFORT 417 10 M SELADO PLUS",
    bank: "CJ BANCOS FIXOS - MC - LB - 4,3,3,2-1 - 2P - TECIDO - TRILHO - ELEVITTA",
    acType: "COMPLEMENTO",
    minutes: {
      ...defaultMinutes,
      VIDROS: 120,
      "A/C": 180,
      PREP: 90,
      "SERRA.": 80,
      "EXPE.": 60,
      DESMONT: 120,
      ELÉTRICA: 180,
      REVEST: 318,
      BCO: 240,
      "ACESSÓ.": 90,
      "PLOTA.": 75,
      "LIBERA.": 72,
    },
  },
  {
    id: 2,
    line: "LAB",
    transformation: "J I CONFORT 517 15 M SELADO PLUS",
    bank: "CJ BANCOS FIXOS - MC - LB - 4,2-1,2,3,3,2-1 - 2P - TECIDO - ELEVITTA - TRILHO",
    acType: "COMPLEMENTO C/ CX CONDENSADORA",
    minutes: {
      ...defaultMinutes,
      VIDROS: 120,
      "A/C": 180,
      PREP: 90,
      "SERRA.": 95,
      "EXPE.": 70,
      DESMONT: 120,
      ELÉTRICA: 210,
      REVEST: 390,
      BCO: 300,
      "ACESSÓ.": 90,
      "PLOTA.": 75,
      "LIBERA.": 72,
    },
  },
  {
    id: 3,
    line: "LB",
    transformation: "J I CONFORT E/S/J TB VITRE",
    bank: "CJ. BANCOS FIXOS  - LB - 3,2,3 - FIXO - 3P - TECIDO - EXPERT",
    acType: "COMPLEMENTO E/S/J C/ COMANDO TRASEIRO BOTÃO",
    minutes: {
      ...defaultMinutes,
      VIDROS: 0,
      "A/C": 180,
      PREP: 90,
      "SERRA.": 0,
      "EXPE.": 60,
      DESMONT: 72,
      ELÉTRICA: 180,
      REVEST: 240,
      BCO: 162,
      "ACESSÓ.": 60,
      "PLOTA.": 60,
      "LIBERA.": 72,
    },
  },
  {
    id: 4,
    line: "LB",
    transformation: "J I CONFORT B/J/D SELADO",
    bank: "CJ. BANCOS FIXOS  - LB - 4;3;3;3 - FIXO - 2P - TECIDO - NORMAL",
    acType: "COMPLEMENTO",
    minutes: {
      ...defaultMinutes,
      VIDROS: 120,
      "A/C": 180,
      PREP: 90,
      "SERRA.": 90,
      "EXPE.": 60,
      DESMONT: 120,
      ELÉTRICA: 180,
      REVEST: 270,
      BCO: 240,
      "ACESSÓ.": 60,
      "PLOTA.": 75,
      "LIBERA.": 72,
    },
  },
  {
    id: 5,
    line: "LE",
    transformation: "J I URBAN E/S/J TB VITRE",
    bank: "CJ BANCOS REC- LE - 3,3 - 3P - COURVIN PRETO/BOOMERANG/LINHA PRETA - E/S/ J - EXECUTIVO",
    acType: "COMPLEMENTO E/S/J C/ COMANDO TRASEIRO BOTÃO",
    minutes: {
      ...defaultMinutes,
      VIDROS: 0,
      "A/C": 180,
      PREP: 90,
      "SERRA.": 0,
      "EXPE.": 60,
      DESMONT: 72,
      ELÉTRICA: 180,
      REVEST: 342,
      BCO: 180,
      "ACESSÓ.": 60,
      "PLOTA.": 60,
      "LIBERA.": 72,
    },
  },
  {
    id: 6,
    line: "LAE",
    transformation: "J I URBAN E/S/J TB VITRE",
    bank: "CJ BANCOS REC- LE - 1.3 - 3P - COURVIN MARROM/BOOMERANG/LINHA DOURADA - E/S/ J - EXECUTIVO",
    acType: "COMPLEMENTO",
    minutes: {
      ...defaultMinutes,
      VIDROS: 0,
      "A/C": 180,
      PREP: 90,
      "SERRA.": 0,
      "EXPE.": 60,
      DESMONT: 72,
      ELÉTRICA: 180,
      REVEST: 342,
      BCO: 162,
      "ACESSÓ.": 75,
      "PLOTA.": 60,
      "LIBERA.": 72,
    },
  },
];

const initialOrders: Order[] = [
  {
    id: 2992,
    status: "RETIRADA",
    item: "2992",
    dueDate: "2026-06-25",
    customer: "BRASIL PROCYCLING",
    city: "PINDAMONHANGABA",
    model: "Peugeot Expert Furgão",
    chassis: "TA004781",
    line: "LE",
    transformation: "J I URBAN E/S/J TB SELADO",
    bank: "AG",
    ac: "-",
    acType: "-",
    accessory: "NÃO",
    plot: "NÃO",
    sequence: 56,
    stages: {
      VIDROS: "S",
      "A/C": "N/A",
      PREP: "S",
      "SERRA.": "N/A",
      "EXPE.": "",
      DESMONT: "S",
      ELÉTRICA: "",
      REVEST: "",
      BCO: "",
      "ACESSÓ.": "N/A",
      "PLOTA.": "N/A",
      "LIBERA.": "",
    },
  },
  {
    id: 3063,
    status: "FINALIZADO",
    item: "3063",
    dueDate: "2026-07-17",
    customer: "BELISA",
    city: "FELÍCIO DOS SANTOS",
    model: "Mercedes-Benz Sprinter 417 10,5 m³",
    chassis: "VE279805",
    line: "LAB",
    transformation: "J I CONFORT 417 10 M SELADO PLUS",
    bank: "CJ BANCOS FIXOS - MC - LB - 4,3,3,2-1 - 2P - TECIDO - TRILHO - ELEVITTA",
    ac: "CLIM",
    acType: "COMPLEMENTO",
    accessory: "SJ",
    plot: "NÃO",
    sequence: 37,
    stages: {
      VIDROS: "S",
      "A/C": "S",
      PREP: "S",
      "SERRA.": "S",
      "EXPE.": "S",
      DESMONT: "S",
      ELÉTRICA: "S",
      REVEST: "S",
      BCO: "S",
      "ACESSÓ.": "S",
      "PLOTA.": "N/A",
      "LIBERA.": "S",
    },
  },
  {
    id: 3039,
    status: "PÁTIO",
    item: "3039",
    dueDate: "2026-07-20",
    customer: "GAMMAPAR NEGOCIOS",
    city: "PORTO RICO",
    model: "Citroën Jumpy Furgão",
    chassis: "TA004006",
    line: "LB",
    transformation: "J I CONFORT E/S/J TB SELADO",
    bank: "CJ. BANCOS REC - LB - 3,2,3 - REC - 3P - TECIDO - EXPERT",
    ac: "GE",
    acType: "COMPLEMENTO E/S/J C/ COMANDO TRASEIRO BOTÃO",
    accessory: "NÃO",
    plot: "SIM",
    sequence: 30,
    stages: {
      VIDROS: "S",
      "A/C": "S",
      PREP: "S",
      "SERRA.": "N/A",
      "EXPE.": "S",
      DESMONT: "S",
      ELÉTRICA: "S",
      REVEST: "S",
      BCO: "S",
      "ACESSÓ.": "N/A",
      "PLOTA.": "S",
      "LIBERA.": "N",
    },
  },
  {
    id: 3064,
    status: "PÁTIO",
    item: "3064",
    dueDate: "2026-07-20",
    customer: "BELISA",
    city: "JARDIM DO SERIDÓ",
    model: "Mercedes-Benz Sprinter 417 10,5 m³",
    chassis: "VE279701",
    line: "LAB",
    transformation: "J I CONFORT 417 10 M SELADO PLUS",
    bank: "CJ BANCOS FIXOS - MC - LB - 4,3,3,2-1 - 2P - TECIDO - TRILHO - ELEVITTA",
    ac: "CLIM",
    acType: "COMPLEMENTO",
    accessory: "SJ",
    plot: "NÃO",
    sequence: 31,
    stages: {
      VIDROS: "S",
      "A/C": "S",
      PREP: "S",
      "SERRA.": "S",
      "EXPE.": "S",
      DESMONT: "S",
      ELÉTRICA: "S",
      REVEST: "S",
      BCO: "S",
      "ACESSÓ.": "S",
      "PLOTA.": "N/A",
      "LIBERA.": "S",
    },
  },
  {
    id: 3078,
    status: "PÁTIO",
    item: "3078",
    dueDate: "2026-07-20",
    customer: "SANTA CATARINA",
    city: "CHAPECÓ",
    model: "Ford Transit L3H2 vitrê",
    chassis: "TU021788",
    line: "LAB",
    transformation: "J I CONFORT TRANSIT L3H2 VITRE",
    bank: "CJ BANCOS FIXOS - MC - LB - 4,3 - 2P - TECIDO",
    ac: "GE",
    acType: "COMPLEMENTO",
    accessory: "NÃO",
    plot: "NÃO",
    sequence: 32,
    stages: {
      VIDROS: "N/A",
      "A/C": "S",
      PREP: "S",
      "SERRA.": "N/A",
      "EXPE.": "S",
      DESMONT: "S",
      ELÉTRICA: "N",
      REVEST: "S",
      BCO: "?",
      "ACESSÓ.": "N/A",
      "PLOTA.": "N/A",
      "LIBERA.": "N",
    },
  },
  {
    id: 2996,
    status: "PÁTIO",
    item: "2996",
    dueDate: "2026-07-20",
    customer: "STELUTI",
    city: "SÃO PAULO",
    model: "Citroën Jumpy Vitrê",
    chassis: "TA004277",
    line: "LE",
    transformation: "J I URBAN E/S/J TB VITRE",
    bank: "CJ BANCOS REC- LE - 3,2 - 3P - COURVIN PRETO/DIAMANTE/LINHA PRETA - E/S/ J - EXECUTIVO",
    ac: "GE",
    acType: "COMPLEMENTO E/S/J C/ COMANDO TRASEIRO BOTÃO",
    accessory: "SJ",
    plot: "NÃO",
    sequence: 33,
    stages: {
      VIDROS: "N/A",
      "A/C": "S",
      PREP: "S",
      "SERRA.": "N/A",
      "EXPE.": "N",
      DESMONT: "S",
      ELÉTRICA: "N",
      REVEST: "S",
      BCO: "N",
      "ACESSÓ.": "N",
      "PLOTA.": "N/A",
      "LIBERA.": "N",
    },
  },
  {
    id: 2994,
    status: "PÁTIO",
    item: "2994",
    dueDate: "2026-07-21",
    customer: "MARILDA AVIAMENTOS",
    city: "IBITINGA",
    model: "Fiat Scudo Vitrê",
    chassis: "TA007830",
    line: "LE",
    transformation: "J I URBAN E/S/J TB VITRE",
    bank: "CJ BANCOS REC- LE - 3,3 - 3P - COURVIN PRETO/CINZA/DIAMANTE/LINHA CINZA - E/S/ J - EXECUTIVO",
    ac: "GE",
    acType: "COMPLEMENTO E/S/J C/ COMANDO TRASEIRO BOTÃO",
    accessory: "NÃO",
    plot: "NÃO",
    sequence: 34,
    stages: {
      VIDROS: "N/A",
      "A/C": "S",
      PREP: "S",
      "SERRA.": "N/A",
      "EXPE.": "S",
      DESMONT: "S",
      ELÉTRICA: "N",
      REVEST: "S",
      BCO: "S",
      "ACESSÓ.": "N/A",
      "PLOTA.": "N/A",
      "LIBERA.": "N",
    },
  },
  {
    id: 3069,
    status: "PÁTIO",
    item: "3069",
    dueDate: "2026-07-22",
    customer: "BELISA",
    city: "SÃO ROQUE DO CANAÃ",
    model: "Mercedes-Benz Sprinter 417 14 m³",
    chassis: "VE277832",
    line: "LAB",
    transformation: "J I CONFORT 417 14 M SELADO PLUS",
    bank: "CJ BANCOS REC - MC - LB - 4,2,3,3,2-1 - 2P - TECIDO - ELEVITTA - TRILHO",
    ac: "CLIM",
    acType: "COMPLEMENTO C/ CX CONDENSADORA",
    accessory: "SJ",
    plot: "NÃO",
    sequence: 35,
    stages: {
      VIDROS: "S",
      "A/C": "N",
      PREP: "S",
      "SERRA.": "N",
      "EXPE.": "N",
      DESMONT: "N",
      ELÉTRICA: "N",
      REVEST: "N",
      BCO: "N",
      "ACESSÓ.": "N",
      "PLOTA.": "N/A",
      "LIBERA.": "N",
    },
  },
  {
    id: 3081,
    status: "PÁTIO",
    item: "3081",
    dueDate: "2026-07-23",
    customer: "BELISA",
    city: "PONTO DOS VOLANTES",
    model: "Mercedes-Benz Sprinter 517 15,5 m³",
    chassis: "VE278661",
    line: "LAB",
    transformation: "J I CONFORT 517 15 M SELADO PLUS",
    bank: "CJ BANCOS FIXOS - MC - LB - 4,2-1,2,3,3,2-1 - 2P - TECIDO - ELEVITTA - TRILHO",
    ac: "CLIM",
    acType: "COMPLEMENTO C/ CX CONDENSADORA",
    accessory: "SJ",
    plot: "NÃO",
    sequence: 36,
    stages: {
      VIDROS: "S",
      "A/C": "?",
      PREP: "S",
      "SERRA.": "N",
      "EXPE.": "N",
      DESMONT: "S",
      ELÉTRICA: "N",
      REVEST: "?",
      BCO: "N",
      "ACESSÓ.": "N",
      "PLOTA.": "N/A",
      "LIBERA.": "N",
    },
  },
  {
    id: 3086,
    status: "PÁTIO",
    item: "3086",
    dueDate: "2026-07-24",
    customer: "BELISA",
    city: "BELA CRUZ",
    model: "Mercedes-Benz Sprinter 517 15,5 m³",
    chassis: "VE281116",
    line: "LB",
    transformation: "J I CONFORT 517 15 M SELADO PLUS",
    bank: "CJ BANCOS FIXOS - MC - LB - 4,2-1,2,3,3,3 - 2P - TECIDO - TRILHO",
    ac: "CLIM",
    acType: "COMPLEMENTO C/ CX CONDENSADORA",
    accessory: "SJ",
    plot: "NÃO",
    sequence: 38,
    stages: {
      VIDROS: "S",
      "A/C": "?",
      PREP: "S",
      "SERRA.": "N",
      "EXPE.": "N",
      DESMONT: "N",
      ELÉTRICA: "N",
      REVEST: "N",
      BCO: "N",
      "ACESSÓ.": "N",
      "PLOTA.": "N/A",
      "LIBERA.": "N",
    },
  },
];

const stageColors: Record<Stage, string> = {
  VIDROS: "#0f766e",
  "A/C": "#2563eb",
  PREP: "#7c3aed",
  "SERRA.": "#d97706",
  "EXPE.": "#c2410c",
  DESMONT: "#be123c",
  ELÉTRICA: "#0891b2",
  REVEST: "#4d7c0f",
  BCO: "#9333ea",
  "ACESSÓ.": "#0d9488",
  "PLOTA.": "#ea580c",
  "LIBERA.": "#16a34a",
};

function parseDate(date: string) {
  return new Date(`${date}T00:00:00`);
}

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function normalize(value: string) {
  return value
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function shouldSchedule(value: string, completeFlow: boolean) {
  const status = normalize(value || "");
  if (status === "N A" || status === "NA" || status === "") return false;
  if (completeFlow) return status !== "N";
  return status !== "S" && status !== "SIM";
}

function dayKey(date: Date) {
  return toDateInput(date);
}

function getStartDate(calendar: CalendarConfig) {
  const [hour, minute] = calendar.dayStart.split(":").map(Number);
  const start = parseDate(calendar.startDate);
  start.setHours(hour || 7, minute || 0, 0, 0);
  return nextWorkingMinute(start, calendar);
}

function isWorkingDay(date: Date, calendar: CalendarConfig) {
  const holidays = calendar.holidays
    .split(/[\s,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  return (
    calendar.workingDays.includes(date.getDay()) &&
    !holidays.includes(dayKey(date))
  );
}

function dayBounds(date: Date, calendar: CalendarConfig) {
  const [hour, minute] = calendar.dayStart.split(":").map(Number);
  const start = new Date(date);
  start.setHours(hour || 7, minute || 0, 0, 0);
  const end = new Date(start.getTime() + calendar.hoursPerDay * 60 * 60 * 1000);
  return { start, end };
}

function nextWorkingMinute(date: Date, calendar: CalendarConfig): Date {
  let cursor = new Date(date);
  for (let guard = 0; guard < 370; guard += 1) {
    const bounds = dayBounds(cursor, calendar);
    if (!isWorkingDay(cursor, calendar) || cursor >= bounds.end) {
      cursor = new Date(cursor);
      cursor.setDate(cursor.getDate() + 1);
      cursor = dayBounds(cursor, calendar).start;
      continue;
    }
    if (cursor < bounds.start) return bounds.start;
    return cursor;
  }
  return cursor;
}

function addWorkMinutes(date: Date, minutes: number, calendar: CalendarConfig) {
  let remaining = Math.max(0, minutes);
  let cursor = nextWorkingMinute(date, calendar);

  while (remaining > 0) {
    cursor = nextWorkingMinute(cursor, calendar);
    const { end } = dayBounds(cursor, calendar);
    const available = Math.max(0, (end.getTime() - cursor.getTime()) / 60000);
    const used = Math.min(available, remaining);
    cursor = new Date(cursor.getTime() + used * 60000);
    remaining -= used;
  }

  return cursor;
}

function findRule(order: Order, rules: TimeRule[]) {
  const exact = rules.find(
    (rule) =>
      normalize(rule.line) === normalize(order.line) &&
      normalize(rule.transformation) === normalize(order.transformation) &&
      normalize(rule.bank) === normalize(order.bank)
  );
  if (exact) return exact;

  const byLineAndTransform = rules.find(
    (rule) =>
      normalize(rule.line) === normalize(order.line) &&
      normalize(rule.transformation) === normalize(order.transformation)
  );
  if (byLineAndTransform) return byLineAndTransform;

  return rules.find((rule) => normalize(rule.line) === normalize(order.line));
}

function getStageMinutes(order: Order, stage: Stage, rules: TimeRule[]) {
  const rule = findRule(order, rules);
  const base = rule?.minutes[stage] ?? defaultMinutes[stage];
  const acBoost = stage === "A/C" && normalize(order.acType).includes("CONDENSADORA") ? 45 : 0;
  const accessoryBoost = stage === "ACESSÓ." && normalize(order.accessory).includes("SJ") ? 30 : 0;
  const plotBoost = stage === "PLOTA." && normalize(order.plot).includes("SIM") ? 45 : 0;
  return Math.max(0, Math.round(base + acBoost + accessoryBoost + plotBoost));
}

function buildSchedule(orders: Order[], rules: TimeRule[], calendar: CalendarConfig) {
  const resourceCursor = new Map<Stage, Date>();
  const operations: Operation[] = [];
  const start = getStartDate(calendar);
  stages.forEach((stage) => resourceCursor.set(stage, new Date(start)));

  const sorted = [...orders].sort((a, b) => {
    const due = parseDate(a.dueDate).getTime() - parseDate(b.dueDate).getTime();
    return due || a.sequence - b.sequence || Number(a.item) - Number(b.item);
  });

  for (const order of sorted) {
    let ready = new Date(start);
    for (const stage of stages) {
      if (!shouldSchedule(order.stages[stage], calendar.completeFlow)) continue;

      const minutes = getStageMinutes(order, stage, rules);
      if (minutes <= 0) continue;

      const stageReady = resourceCursor.get(stage) ?? new Date(start);
      const operationStart = nextWorkingMinute(
        new Date(Math.max(ready.getTime(), stageReady.getTime())),
        calendar
      );
      const end = addWorkMinutes(operationStart, minutes, calendar);
      operations.push({
        id: `${order.id}-${stage}`,
        orderId: order.id,
        item: order.item,
        customer: order.customer,
        stage,
        line: order.line,
        start: operationStart,
        end,
        minutes,
        dueDate: order.dueDate,
      });
      resourceCursor.set(stage, end);
      ready = end;
    }
  }

  return operations;
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(parseDate(date));
}

function weekLabel(date: Date) {
  const first = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - first.getTime()) / 86400000);
  return `S${Math.ceil((days + first.getDay() + 1) / 7)}`;
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function formatDayHeader(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  })
    .format(date)
    .replace(".", "");
}

function formatHour(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function Home() {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [rules, setRules] = useState<TimeRule[]>(initialRules);
  const [calendar, setCalendar] = useState<CalendarConfig>(initialCalendar);
  const [selectedStage, setSelectedStage] = useState<Stage>("REVEST");
  const [filter, setFilter] = useState("todos");

  useEffect(() => {
    const saved = window.localStorage.getItem("ji-mrp-state");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as {
        orders?: Order[];
        rules?: TimeRule[];
        calendar?: CalendarConfig;
      };
      if (parsed.orders) setOrders(parsed.orders);
      if (parsed.rules) setRules(parsed.rules);
      if (parsed.calendar) setCalendar(parsed.calendar);
    } catch {
      window.localStorage.removeItem("ji-mrp-state");
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "ji-mrp-state",
      JSON.stringify({ orders, rules, calendar })
    );
  }, [orders, rules, calendar]);

  const filteredOrders = useMemo(() => {
    if (filter === "todos") return orders;
    return orders.filter((order) => normalize(order.line) === normalize(filter));
  }, [filter, orders]);

  const operations = useMemo(
    () => buildSchedule(filteredOrders, rules, calendar),
    [filteredOrders, rules, calendar]
  );

  const finishByOrder = useMemo(() => {
    const map = new Map<number, Date>();
    operations.forEach((operation) => {
      const current = map.get(operation.orderId);
      if (!current || operation.end > current) map.set(operation.orderId, operation.end);
    });
    return map;
  }, [operations]);

  const capacity = useMemo(() => {
    const byStage = stages.map((stage) => {
      const minutes = operations
        .filter((operation) => operation.stage === stage)
        .reduce((total, operation) => total + operation.minutes, 0);
      const workingDays = countWorkingDays(getStartDate(calendar), addWorkMinutes(getStartDate(calendar), 10 * 24 * 60, calendar), calendar);
      const available = workingDays * calendar.hoursPerDay * 60;
      return {
        stage,
        minutes,
        hours: minutes / 60,
        available: available / 60,
        load: available ? minutes / available : 0,
      };
    });
    return byStage;
  }, [calendar, operations]);

  const ganttBounds = useMemo(() => {
    if (!operations.length) {
      const start = getStartDate(calendar);
      return { start, end: addWorkMinutes(start, 8 * 60, calendar), span: 1 };
    }
    const start = new Date(Math.min(...operations.map((operation) => operation.start.getTime())));
    const end = new Date(Math.max(...operations.map((operation) => operation.end.getTime())));
    return {
      start,
      end,
      span: Math.max(1, end.getTime() - start.getTime()),
    };
  }, [calendar, operations]);

  const ganttDays = useMemo(() => {
    const start = startOfDay(ganttBounds.start);
    const end = addDays(startOfDay(ganttBounds.end), 1);
    const days: Date[] = [];
    let cursor = start;
    while (cursor <= end && days.length < 90) {
      days.push(cursor);
      cursor = addDays(cursor, 1);
    }
    return days;
  }, [ganttBounds.end, ganttBounds.start]);

  const ganttScale = useMemo(() => {
    const start = ganttDays[0] ?? startOfDay(ganttBounds.start);
    const end =
      ganttDays.length > 0
        ? addDays(ganttDays[ganttDays.length - 1], 1)
        : addDays(start, 1);
    return {
      start,
      end,
      span: Math.max(1, end.getTime() - start.getTime()),
      width: Math.max(960, ganttDays.length * 150),
    };
  }, [ganttBounds.start, ganttDays]);

  const selectedOperations = useMemo(
    () =>
      operations
        .filter((operation) => operation.stage === selectedStage)
        .sort((a, b) => a.start.getTime() - b.start.getTime()),
    [operations, selectedStage]
  );

  const lateOrders = filteredOrders.filter((order) => {
    const finish = finishByOrder.get(order.id);
    return finish ? finish > parseDate(order.dueDate) : false;
  });
  const bottleneck = [...capacity].sort((a, b) => b.load - a.load)[0];
  const totalHours = operations.reduce((total, operation) => total + operation.minutes / 60, 0);

  function updateRule(ruleId: number, field: keyof TimeRule, value: string) {
    setRules((current) =>
      current.map((rule) =>
        rule.id === ruleId ? { ...rule, [field]: value } : rule
      )
    );
  }

  function updateRuleMinute(ruleId: number, stage: Stage, value: string) {
    const numeric = Number(value);
    setRules((current) =>
      current.map((rule) =>
        rule.id === ruleId
          ? {
              ...rule,
              minutes: {
                ...rule.minutes,
                [stage]: Number.isFinite(numeric) ? numeric : 0,
              },
            }
          : rule
      )
    );
  }

  function updateOrder(orderId: number, field: keyof Order, value: string) {
    setOrders((current) =>
      current.map((order) =>
        order.id === orderId ? { ...order, [field]: value } : order
      )
    );
  }

  function addRule() {
    const template = rules[0];
    setRules((current) => [
      {
        ...template,
        id: Math.max(...current.map((rule) => rule.id)) + 1,
        transformation: "Nova transformação",
        bank: "Novo conjunto de bancos",
      },
      ...current,
    ]);
  }

  function addOrder() {
    const nextId = Math.max(...orders.map((order) => order.id)) + 1;
    setOrders((current) => [
      {
        ...current[0],
        id: nextId,
        item: String(nextId),
        status: "PÁTIO",
        dueDate: calendar.startDate,
        customer: "Novo cliente",
        chassis: `NOVO${nextId}`,
        sequence: nextId,
        stages: { ...current[0].stages },
      },
      ...current,
    ]);
  }

  function resetData() {
    setOrders(initialOrders);
    setRules(initialRules);
    setCalendar(initialCalendar);
  }

  return (
    <main className="min-h-screen bg-[#f6f7f4] text-[#1d241f]">
      <section className="border-b border-[#d9ddcf] bg-[#fbfcf8]">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.14em] text-[#647067]">
              JI Montadora · PCP
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-[#17201a] md:text-4xl">
              Módulo MRP II
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-[#5d685f] md:text-base">
              Sequenciamento por data de entrega, mix de linha, transformação,
              conjunto de bancos, tipo de A/C, calendário produtivo e tempos por etapa.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="tool-button" type="button" onClick={addOrder}>
              + Pedido
            </button>
            <button className="tool-button" type="button" onClick={addRule}>
              + Regra
            </button>
            <button className="tool-button secondary" type="button" onClick={resetData}>
              Restaurar base
            </button>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-5 py-5 lg:grid-cols-[1.05fr_1.95fr]">
        <div className="panel">
          <h2>Calendário e cenário</h2>
          <div className="form-grid">
            <label>
              Início
              <input
                type="date"
                value={calendar.startDate}
                onChange={(event) =>
                  setCalendar({ ...calendar, startDate: event.target.value })
                }
              />
            </label>
            <label>
              Entrada
              <input
                type="time"
                value={calendar.dayStart}
                onChange={(event) =>
                  setCalendar({ ...calendar, dayStart: event.target.value })
                }
              />
            </label>
            <label>
              Horas/dia
              <input
                min="1"
                max="24"
                step="0.1"
                type="number"
                value={calendar.hoursPerDay}
                onChange={(event) =>
                  setCalendar({ ...calendar, hoursPerDay: Number(event.target.value) })
                }
              />
            </label>
            <label>
              Linha
              <select value={filter} onChange={(event) => setFilter(event.target.value)}>
                <option value="todos">Todas</option>
                {["LB", "LE", "LAB", "LAE"].map((line) => (
                  <option key={line} value={line}>
                    {line}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="weekday-grid" aria-label="Dias trabalhados">
            {[
              ["D", 0],
              ["S", 1],
              ["T", 2],
              ["Q", 3],
              ["Q", 4],
              ["S", 5],
              ["S", 6],
            ].map(([label, day]) => {
              const numericDay = Number(day);
              const selected = calendar.workingDays.includes(numericDay);
              return (
                <button
                  key={`${label}-${day}`}
                  className={selected ? "weekday active" : "weekday"}
                  type="button"
                  onClick={() =>
                    setCalendar({
                      ...calendar,
                      workingDays: selected
                        ? calendar.workingDays.filter((item) => item !== numericDay)
                        : [...calendar.workingDays, numericDay].sort(),
                    })
                  }
                >
                  {label}
                </button>
              );
            })}
          </div>
          <label className="stacked">
            Dias não trabalhados
            <textarea
              rows={2}
              value={calendar.holidays}
              onChange={(event) =>
                setCalendar({ ...calendar, holidays: event.target.value })
              }
              placeholder="2026-07-25, 2026-08-01"
            />
          </label>
          <label className="switch-row">
            <input
              type="checkbox"
              checked={calendar.completeFlow}
              onChange={(event) =>
                setCalendar({ ...calendar, completeFlow: event.target.checked })
              }
            />
            Simular fluxo completo em vez de somente pendências
          </label>
        </div>

        <div className="metric-grid">
          <div className="metric accent-green">
            <span>Pedidos no cenário</span>
            <strong>{filteredOrders.length}</strong>
            <small>{operations.length} operações sequenciadas</small>
          </div>
          <div className="metric accent-red">
            <span>Em atraso projetado</span>
            <strong>{lateOrders.length}</strong>
            <small>comparando fim calculado com data entrega</small>
          </div>
          <div className="metric accent-blue">
            <span>Horas carregadas</span>
            <strong>{totalHours.toFixed(1)}h</strong>
            <small>após regras e calendário</small>
          </div>
          <div className="metric accent-orange">
            <span>Gargalo</span>
            <strong>{bottleneck?.stage ?? "-"}</strong>
            <small>{bottleneck ? `${Math.round(bottleneck.load * 100)}% de carga` : "-"}</small>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1600px] gap-4 px-5 pb-5">
        <div className="panel wide cm25-panel">
          <div className="section-head cm25-head">
            <div>
              <h2>Gantt de capacidade</h2>
              <span>
                {formatDateTime(ganttBounds.start)} até {formatDateTime(ganttBounds.end)}
              </span>
            </div>
            <div className="cm25-legend" aria-label="Legenda do Gantt">
              <b>CM25</b>
              <span>Barra = pedido + processo</span>
              <span className="legend-late">Atraso</span>
            </div>
          </div>

          <div className="cm25-scroll" role="region" aria-label="Gantt com datas e processos">
            <div
              className="cm25-grid"
              style={{ gridTemplateColumns: `230px ${ganttScale.width}px` }}
            >
              <div className="cm25-corner">
                <strong>Processo</strong>
                <span>Carga / operações</span>
              </div>
              <div
                className="cm25-timeline-head"
                style={{
                  width: `${ganttScale.width}px`,
                  gridTemplateColumns: `repeat(${ganttDays.length}, 150px)`,
                }}
              >
                {ganttDays.map((day) => (
                  <div
                    className={isWorkingDay(day, calendar) ? "cm25-day" : "cm25-day off"}
                    key={dayKey(day)}
                  >
                    <strong>{formatDayHeader(day)}</strong>
                    <span>{weekLabel(day)}</span>
                  </div>
                ))}
              </div>

              {stages.map((stage) => {
                const laneOps = operations.filter((operation) => operation.stage === stage);
                const stageHours = laneOps.reduce(
                  (total, operation) => total + operation.minutes / 60,
                  0
                );
                return (
                  <div className="cm25-row-shell" key={stage}>
                    <button
                      type="button"
                      className={stage === selectedStage ? "cm25-process selected" : "cm25-process"}
                      onClick={() => setSelectedStage(stage)}
                    >
                      <strong>{stage}</strong>
                      <span>{stageHours.toFixed(1)}h · {laneOps.length} ops</span>
                    </button>
                    <div
                      className="cm25-track"
                      style={{
                        width: `${ganttScale.width}px`,
                        backgroundSize: "150px 100%, 100% 100%",
                      }}
                    >
                      {laneOps.map((operation) => {
                        const left =
                          ((operation.start.getTime() - ganttScale.start.getTime()) /
                            ganttScale.span) *
                          ganttScale.width;
                        const width =
                          ((operation.end.getTime() - operation.start.getTime()) /
                            ganttScale.span) *
                          ganttScale.width;
                        const late = operation.end > parseDate(operation.dueDate);
                        return (
                          <button
                            className={late ? "cm25-op late" : "cm25-op"}
                            key={operation.id}
                            type="button"
                            onClick={() => setSelectedStage(stage)}
                            style={{
                              left: `${Math.max(0, left)}px`,
                              width: `${Math.max(74, width)}px`,
                              backgroundColor: stageColors[stage],
                            }}
                            title={`${operation.stage} · Pedido ${operation.item} · ${
                              operation.customer
                            } · ${formatDateTime(operation.start)} até ${formatDateTime(
                              operation.end
                            )} · entrega ${formatDate(operation.dueDate)}`}
                          >
                            <strong>{operation.item}</strong>
                            <span>{formatHour(operation.start)}-{formatHour(operation.end)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="cm25-detail">
            <div>
              <strong>{selectedStage}</strong>
              <span>Operações planejadas em ordem de início</span>
            </div>
            <div className="cm25-detail-list">
              {selectedOperations.slice(0, 8).map((operation) => {
                const late = operation.end > parseDate(operation.dueDate);
                return (
                  <span className={late ? "detail-chip late" : "detail-chip"} key={operation.id}>
                    <b>{operation.item}</b>
                    {formatDateTime(operation.start)} - {formatDateTime(operation.end)}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        <div className="panel capacity-panel">
          <div className="section-head">
            <h2>Capacidade</h2>
            <span>{weekLabel(getStartDate(calendar))} em diante</span>
          </div>
          <div className="capacity-list">
            {capacity.map((row) => (
              <button
                key={row.stage}
                className={row.stage === selectedStage ? "capacity-row selected" : "capacity-row"}
                type="button"
                onClick={() => setSelectedStage(row.stage)}
              >
                <span>{row.stage}</span>
                <b>{row.hours.toFixed(1)}h</b>
                <i>
                  <span style={{ width: `${Math.min(100, row.load * 100)}%` }} />
                </i>
                <em>{Math.round(row.load * 100)}%</em>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="legacy-gantt-section mx-auto grid max-w-7xl gap-4 px-5 pb-5 xl:grid-cols-[1.45fr_1fr]">
        <div className="panel wide">
          <div className="section-head">
            <h2>Gantt por etapa</h2>
            <span>
              {formatDateTime(ganttBounds.start)} até {formatDateTime(ganttBounds.end)}
            </span>
          </div>
          <div className="gantt">
            {stages.map((stage) => {
              const laneOps = operations.filter((operation) => operation.stage === stage);
              return (
                <div className="gantt-lane" key={stage}>
                  <button
                    type="button"
                    className={stage === selectedStage ? "lane-label selected" : "lane-label"}
                    onClick={() => setSelectedStage(stage)}
                  >
                    {stage}
                  </button>
                  <div className="lane-track">
                    {laneOps.slice(0, 18).map((operation) => {
                      const left =
                        ((operation.start.getTime() - ganttBounds.start.getTime()) /
                          ganttBounds.span) *
                        100;
                      const width =
                        ((operation.end.getTime() - operation.start.getTime()) /
                          ganttBounds.span) *
                        100;
                      const late = operation.end > parseDate(operation.dueDate);
                      return (
                        <span
                          className={late ? "bar late" : "bar"}
                          key={operation.id}
                          style={{
                            left: `${Math.max(0, left)}%`,
                            width: `${Math.max(2.5, width)}%`,
                            backgroundColor: stageColors[stage],
                          }}
                          title={`${operation.item} · ${operation.customer} · ${formatDateTime(
                            operation.start
                          )} - ${formatDateTime(operation.end)}`}
                        >
                          {operation.item}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel">
          <div className="section-head">
            <h2>Capacidade</h2>
            <span>{weekLabel(getStartDate(calendar))} em diante</span>
          </div>
          <div className="capacity-list">
            {capacity.map((row) => (
              <button
                key={row.stage}
                className={row.stage === selectedStage ? "capacity-row selected" : "capacity-row"}
                type="button"
                onClick={() => setSelectedStage(row.stage)}
              >
                <span>{row.stage}</span>
                <b>{row.hours.toFixed(1)}h</b>
                <i>
                  <span style={{ width: `${Math.min(100, row.load * 100)}%` }} />
                </i>
                <em>{Math.round(row.load * 100)}%</em>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-5 pb-5 xl:grid-cols-[1.35fr_1.05fr]">
        <div className="panel wide">
          <div className="section-head">
            <h2>Pedidos sequenciados</h2>
            <span>Dados iniciais lidos da Agenda_R02</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Cliente</th>
                  <th>Linha</th>
                  <th>Entrega</th>
                  <th>Fim calculado</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => {
                  const finish = finishByOrder.get(order.id);
                  const late = finish ? finish > parseDate(order.dueDate) : false;
                  return (
                    <tr key={order.id}>
                      <td>
                        <strong>{order.item}</strong>
                        <small>{order.chassis}</small>
                      </td>
                      <td>
                        {order.customer}
                        <small>{order.model}</small>
                      </td>
                      <td>
                        <select
                          value={order.line}
                          onChange={(event) =>
                            updateOrder(order.id, "line", event.target.value)
                          }
                        >
                          {["LB", "LE", "LAB", "LAE", "-"].map((line) => (
                            <option key={line}>{line}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="date"
                          value={order.dueDate}
                          onChange={(event) =>
                            updateOrder(order.id, "dueDate", event.target.value)
                          }
                        />
                      </td>
                      <td className={late ? "late-text" : ""}>
                        {finish ? formatDateTime(finish) : "Sem pendência"}
                      </td>
                      <td>
                        <span className={late ? "status late" : "status"}>{order.status}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="section-head">
            <h2>Tempos por mix</h2>
            <span>{selectedStage}</span>
          </div>
          <div className="rule-list">
            {rules.map((rule) => (
              <article className="rule-row" key={rule.id}>
                <div className="rule-title">
                  <select
                    value={rule.line}
                    onChange={(event) => updateRule(rule.id, "line", event.target.value)}
                  >
                    {["LB", "LE", "LAB", "LAE"].map((line) => (
                      <option key={line}>{line}</option>
                    ))}
                  </select>
                  <label>
                    {selectedStage}
                    <input
                      min="0"
                      step="1"
                      type="number"
                      value={rule.minutes[selectedStage]}
                      onChange={(event) =>
                        updateRuleMinute(rule.id, selectedStage, event.target.value)
                      }
                    />
                  </label>
                </div>
                <input
                  value={rule.transformation}
                  onChange={(event) =>
                    updateRule(rule.id, "transformation", event.target.value)
                  }
                />
                <input
                  value={rule.bank}
                  onChange={(event) => updateRule(rule.id, "bank", event.target.value)}
                />
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function countWorkingDays(start: Date, end: Date, calendar: CalendarConfig) {
  let cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const finish = new Date(end);
  finish.setHours(0, 0, 0, 0);
  let total = 0;

  while (cursor <= finish) {
    if (isWorkingDay(cursor, calendar)) total += 1;
    cursor.setDate(cursor.getDate() + 1);
  }

  return Math.max(total, 1);
}
