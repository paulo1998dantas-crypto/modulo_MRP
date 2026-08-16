"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { buildMrpLivePlan, type MrpLiveSnapshot, type MrpPeriodicity } from "./lib/mrp-live";
import { downloadXlsx } from "./lib/client-xlsx";

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
  source?: "WIP" | "SIMULACAO";
  workOrderId?: string;
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
  dayEnd: string;
  lunchStart: string;
  lunchEnd: string;
  horizonDays: number;
  workingDays: number[];
  holidays: string;
  calendarYear: number;
  calendarMonth: number;
  operators: Record<Stage, number>;
  completeFlow: boolean;
};

type Operation = {
  id: string;
  orderId: number;
  item: string;
  os: string;
  customer: string;
  stage: Stage;
  line: string;
  operator: number;
  start: Date;
  end: Date;
  minutes: number;
  dueDate: string;
};

type GanttLane = {
  key: string;
  stage: Stage;
  operator: number;
};

type ScheduleResult = {
  operations: Operation[];
  finishByOrder: Map<number, Date>;
};

type MrpIAnalysisRow = {
  pn: string;
  description: string;
  available: number;
  leadWeeks: number;
  totalDemand: number;
  totalIncoming: number;
  totalSuggested: number;
  safetyStock: number;
  firstSuggestedWeek: number | null;
  projected: number[];
  suggested: number[];
  demand: number[];
  incoming: number[];
};

type MrpIPlan = {
  weeks: number[];
  currentWeek: number;
  rows: MrpIAnalysisRow[];
  totalDemand: number;
  totalIncoming: number;
  totalSuggested: number;
  shortageItems: number;
  linkedRequirements: number;
  currentWeekRequirements: number;
};

type WipSnapshot = {
  generatedAt: string;
  source: "SUPABASE";
  orders: Order[];
  counts: {
    total: number;
    patio: number;
    production: number;
    withSequence: number;
  };
  warnings: string[];
};

type SimulationVehicle = {
  id: string;
  reference: string;
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

type SimulationMaterial = {
  id: string;
  pn: string;
  description: string;
  unit: string;
  needDate: string;
  quantity: number;
  note: string;
};

type Scenario = {
  id: string;
  name: string;
  createdAt: string;
  vehicles: SimulationVehicle[];
  materials: SimulationMaterial[];
};

type WorkspaceView = "overview" | "mrp2" | "mrp1" | "scenarios" | "settings";

type MrpSessionUser = {
  username: string;
  roles: string[];
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

const schedulingStages: Stage[] = [
  "PREP",
  "SERRA.",
  "EXPE.",
  "VIDROS",
  "A/C",
  "DESMONT",
  "REVEST",
  "ELÉTRICA",
  "BCO",
  "ACESSÓ.",
  "PLOTA.",
  "LIBERA.",
];

const stageDependencies: Record<Stage, Stage[]> = {
  VIDROS: [],
  "A/C": [],
  PREP: [],
  "SERRA.": [],
  "EXPE.": [],
  DESMONT: ["VIDROS", "A/C"],
  REVEST: ["DESMONT"],
  ELÉTRICA: ["REVEST"],
  BCO: ["REVEST"],
  "ACESSÓ.": ["REVEST"],
  "PLOTA.": ["VIDROS"],
  "LIBERA.": [
    "VIDROS",
    "A/C",
    "PREP",
    "SERRA.",
    "EXPE.",
    "DESMONT",
    "REVEST",
    "ELÉTRICA",
    "BCO",
    "ACESSÓ.",
    "PLOTA.",
  ],
};

const STATE_VERSION = "supabase-only-2026-08-15";
const GANTT_DAY_WIDTH = 210;
const GANTT_MIN_WIDTH = 1180;

const initialOperators: Record<Stage, number> = {
  VIDROS: 1,
  "A/C": 1,
  PREP: 1,
  "SERRA.": 1,
  "EXPE.": 1,
  DESMONT: 1,
  ELÉTRICA: 1,
  REVEST: 1,
  BCO: 1,
  "ACESSÓ.": 1,
  "PLOTA.": 1,
  "LIBERA.": 1,
};

const initialCalendar: CalendarConfig = {
  startDate: toDateInput(new Date()),
  dayStart: "08:00",
  dayEnd: "18:00",
  lunchStart: "12:00",
  lunchEnd: "13:00",
  horizonDays: 30,
  workingDays: [1, 2, 3, 4, 5],
  holidays: "",
  calendarYear: new Date().getFullYear(),
  calendarMonth: new Date().getMonth(),
  operators: initialOperators,
  completeFlow: false,
};

function planningHorizonDays(calendar: CalendarConfig) {
  return Math.max(1, Math.min(365, Math.floor(Number(calendar.horizonDays) || 30)));
}

function operatorCountForStage(calendar: CalendarConfig, stage: Stage) {
  return Math.max(1, Math.floor(Number(calendar.operators?.[stage]) || 1));
}

function restoreCalendarConfig(calendar: Partial<CalendarConfig>) {
  const merged: CalendarConfig = {
    ...initialCalendar,
    ...calendar,
    workingDays: calendar.workingDays?.length ? calendar.workingDays : initialCalendar.workingDays,
    operators: {
      ...initialOperators,
      ...(calendar.operators ?? {}),
    },
  };
  return operationalCalendar(merged);
}

function operationalCalendar(calendar: CalendarConfig = initialCalendar): CalendarConfig {
  const today = new Date();
  return {
    ...calendar,
    startDate: toDateInput(today),
    dayStart: "08:00",
    dayEnd: "18:00",
    lunchStart: "12:00",
    lunchEnd: "13:00",
    horizonDays: 30,
    calendarYear: today.getFullYear(),
    calendarMonth: today.getMonth(),
  };
}

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

/*
 * Carteira de exemplo aposentada em 06/08/2026.
 * A programação padrão agora é construída exclusivamente a partir do WIP do
 * Supabase; veículos hipotéticos entram apenas por um cenário explícito.
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
*/

type UploadSequenceRow = [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string
];

/* Carga de teste aposentada: não participa mais do MRP nem da interface.
const legacyUploadedSequenceRows: UploadSequenceRow[] = [
  ["VE278661", "Mercedes-Benz Sprinter 517 15,5 m³", "LB", "CLIM", "CJ BANCOS FIXOS - MC - LB - 4,2-1,2,3,3,2-1 - 2P - TECIDO - ELEVITTA - TRILHO", "BELISA", "PONTO DOS VOLANTES (CISARP ITEM 23)", "2026-07-23", "S", "S", "S", "S", "S", "S", "S", "S", "S", "N", "N/A", "N"],
  ["VE277832", "Mercedes-Benz Sprinter 417 14 m³", "LB", "CLIM", "CJ BANCOS REC - MC - LB - 4,2,3,3,2-1 - 2P - TECIDO - ELEVITTA - TRILHO", "BELISA", "SÃO ROQUE DO CANAÃ (ADESÃO CISAVH ITEM 8)", "2026-07-24", "S", "N", "S", "N", "N", "S", "N", "N", "N", "N", "N/A", "N"],
  ["VE278805", "Mercedes-Benz Sprinter 517 15,5 m³", "LB", "CLIM", "CJ BANCOS FIXOS - MC - LB - 4,2-1,2,3,3,2-1 - 2P - TECIDO - ELEVITTA - TRILHO", "BELISA", "SÃO ROQUE DO CANAÃ (CISARP ITEM 23)", "2026-07-24", "S", "?", "S", "S", "S", "S", "S", "S", "S", "N", "N/A", "N"],
  ["TE277239", "Mercedes-Benz Sprinter 417 14 m³", "LB", "CLIM", "CJ BANCOS REC - MC - LB - 4;2;3;3;3 - 2P - TECIDO - TRILHO", "BELISA", "SÃO ROQUE DO CANAÃ (ADESÃO CISAVH ITEM 7)", "2026-07-25", "S", "N", "S", "N", "N", "N", "N", "N", "N", "N", "N/A", "N"],
  ["TU021788", "Ford Transit L3H2 vitrê", "LB", "GE", "CJ BANCOS FIXOS - MC - LB - 4,3 - 2P - TECIDO", "SANTA CATARINA", "CHAPECO", "2026-07-27", "N/A", "S", "S", "N/A", "S", "S", "N", "S", "S", "N/A", "N/A", "N"],
  ["TU021789", "Ford Transit L3H2 vitrê", "LB", "GE", "CJ BANCOS FIXOS - MC - LB - 4,3 - 2P - TECIDO", "SANTA CATARINA", "CHAPECO", "2026-07-27", "N/A", "S", "S", "N/A", "S", "S", "N", "S", "S", "N/A", "N/A", "N"],
  ["TU020681", "Ford Transit L3H2 vitrê", "LB", "GE", "CJ BANCOS FIXOS - MC - LB - 4,3 - 2P - TECIDO", "SANTA CATARINA", "CHAPECO", "2026-07-27", "N/A", "S", "S", "N/A", "S", "S", "N", "S", "S", "N/A", "N/A", "N"],
  ["TA004277", "Citroën Jumpy Vitrê", "LE", "GE", "CJ BANCOS REC- LE - 3,2 - 3P - COURVIN PRETO/DIAMANTE/LINHA PRETA - E/S/ J - EXECUTIVO", "STELUTI", "SÃO PAULO", "2026-07-27", "N/A", "S", "S", "N/A", "S", "S", "N", "S", "N", "N", "N/A", "N"],
  ["VE281116", "Mercedes-Benz Sprinter 517 15,5 m³", "LB", "CLIM", "CJ BANCOS FIXOS - MC - LB - 4,2-1,2,3,3,3 - 2P - TECIDO - TRILHO", "BELISA", "BELA CRUZ (ADESAO CISARP ITEM 22)", "2026-07-29", "S", "?", "S", "N", "S", "S", "N", "S", "N", "N", "N/A", "N"],
  ["VE281194", "Mercedes-Benz Sprinter 517 15,5 m³", "LB", "CLIM", "CJ BANCOS FIXOS - MC - LB - 4,2-1,2,3,3,2-1 - 2P - TECIDO - ELEVITTA - TRILHO", "BELISA", "MONTE SANTO DE MINAS (ADESÃO CISARP ITEM 23)", "2026-07-29", "S", "?", "S", "N", "N", "S", "N", "N", "N", "N", "N/A", "N"],
  ["VE280965", "Mercedes-Benz Sprinter 417 14 m³", "LB", "CLIM", "CJ BANCOS FIXOS - MC - LB - 4,3,3,3,4 - 3P - TECIDO - NORMAL", "LIZARD", "CONGONHAS", "2026-07-30", "S", "N", "S", "N/A", "N", "N", "N", "N", "N", "N/A", "N/A", "N"],
  ["TA008272", "Fiat Scudo Vitrê", "LE", "GE", "CJ BANCOS REC- LE - 3,3 - 3P - COURVIN PRETO/CINZA/DIAMANTE/LINHA CINZA - E/S/ J - EXECUTIVO", "RTR", "SÃO PAULO", "2026-07-30", "N/A", "S", "S", "N/A", "N", "N", "N", "N", "N", "N", "N/A", "N"],
  ["TA008271", "Fiat Scudo Vitrê", "LE", "GE", "CJ BANCOS REC- LE - 3,3 - 3P - COURVIN PRETO/CINZA/DIAMANTE/LINHA CINZA - E/S/ J - EXECUTIVO", "RTR", "SÃO PAULO", "2026-07-30", "N/A", "S", "S", "N/A", "N", "N", "N", "N", "N", "N", "N/A", "N"],
  ["TA005694", "Citroën Jumper Furgão", "LB", "CLIM", "CJ BANCOS REC - MC - LB - 4,3,2,2-1 - 2P - TECIDO - PME 2A - BJD - FOCA", "FRP", "SÃO JOÃO DO OESTE", "2026-07-30", "S", "S", "S", "N", "N", "S", "S", "S", "N", "N", "N/A", "N"],
  ["TA001716", "Peugeot Expert Vitrê", "LB", "GE", "CJ BANCOS FIXOS - MC - LB - 3,2,3 - 2P - TECIDO - E/S/ J", "SANTA CATARINA", "ITAPERUÇU", "2026-07-31", "N/A", "N", "N", "N/A", "N", "N", "N", "N", "N", "N", "N", "N"],
  ["TA001731", "Peugeot Expert Vitrê", "LB", "GE", "CJ BANCOS REC - MC - LB - 3,3 - 3P - COURVIN - E/S/J", "SANTA CATARINA", "RIBEIRÃO BRANCO", "2026-07-31", "N/A", "N", "N", "N/A", "N", "N", "N", "N", "N", "N/A", "N", "N"],
  ["VE277821", "Mercedes-Benz Sprinter 417 14 m³", "LB", "CLIM", "CJ BANCOS REC - MC - LB - 4,2,3,3,2-1 - 2P - TECIDO - ELEVITTA - TRILHO", "BELISA", "NOVA PONTE (CRAVINHOS - ITEM 08)", "2026-07-31", "S", "?", "S", "N", "S", "S", "N", "N", "N", "N", "N/A", "N"],
  ["VJ666369", "Renault Master L3H2", "LB", "GE", "CJ BANCOS FIXOS - MC - LB - 4,3,3,3 - 3P - TECIDO - NORMAL", "ASSOC. PROP. RES. PORTO SÃO PEDRO", "PORTO FELIZ", "2026-07-31", "S", "S", "S", "N/A", "S", "S", "S", "S", "S", "N/A", "N/A", "N"],
  ["TA009754", "Citroën Jumpy Furgão", "LE", "GE", "CJ BANCOS REC- LE - 3,3 - 3P - COURVIN PRETO/DIAMANTE/LINHA BRANCA - E/S/ J - EXECUTIVO", "PJ MOBILIDADE", "SÃO PAULO", "2026-08-02", "S", "S", "S", "N/A", "N", "N", "N", "N", "N", "N", "N/A", "N"],
  ["TA004272", "Citroën Jumpy Vitrê", "LE", "GE", "CJ BANCOS REC- LE - 3,3 - 3P - COURVIN PRETO/BOOMERANG/LINHA PRETA - E/S/ J - EXECUTIVO", "VM CALÇADOS", "GUARULHOS", "2026-08-03", "N/A", "S", "S", "N/A", "N", "N", "N", "N", "N", "N", "N/A", "N"],
  ["TE270315", "Mercedes-Benz Sprinter 417 10,5 m³", "LB", "CLIM", "CJ BANCOS FIXOS - MC - LB - 4,3,3,2-1 - 2P - TECIDO - TRILHO - ELEVITTA", "BELISA", "SIDROLÂNDIA (ADESAO CIDASG)", "2026-08-05", "S", "N", "N", "N", "N", "N", "N", "N", "N", "N", "N/A", "N"],
  ["TA009491", "Fiat Scudo Vitrê", "LB", "GE", "CJ BANCOS FIXOS - MC - LB - 3,3 - 3P - TECIDO - E/S/ J", "FMIS", "DOURADO", "2026-08-07", "N/A", "N", "N", "N/A", "N", "N", "N", "N", "N", "N/A", "N/A", "N"],
  ["TA008270", "Fiat Scudo Vitrê", "LE", "CLIM", "CJ BANCOS REC- LE - 3,3 - 3P - COURVIN PRETO/RETILINEA/LINHA PRETA - E/S/ J - EXECUTIVO", "HI SERVICE", "SÃO PAULO", "2026-08-07", "N/A", "S", "S", "N/A", "N", "N", "N", "N", "N", "N/A", "N/A", "N"],
  ["TA009749", "Citroën Jumpy Furgão", "LE", "CLIM", "CJ BANCOS REC- LE - 3,3 - 3P - COURVIN PRETO/RETILINEA/LINHA PRETA - E/S/ J - EXECUTIVO", "HI SERVICE", "SÃO PAULO", "2026-08-07", "S", "S", "S", "N/A", "N", "N", "N", "N", "N", "N/A", "N/A", "N"],
  ["TA007442", "Peugeot Expert Furgão", "LE", "GE", "CJ BANCOS REC- LE - 3,3 - 3P - COURVIN MARROM/BOOMERANG/LINHA DOURADA - E/S/ J - EXECUTIVO", "FRIENDSHIP", "RIO DE JANEIRO", "2026-08-08", "S", "N", "S", "N/A", "N", "N", "N", "N", "N", "N", "N/A", "N"],
  ["TA000944", "Peugeot Expert Furgão", "LE", "GE", "CJ BANCOS REC- LE - 3,2-1 - 3P - COURVIN PRETO/BOOMERANG/LINHA PRETA - E/S/ J - EXECUTIVO", "RECANTO SÃO BENEDITO", "SÃO BENTO DO SAPUCAI", "2026-08-09", "S", "N", "S", "N/A", "N", "N", "N", "N", "N", "N", "N/A", "N"],
  ["TA008976", "Peugeot Expert Furgão", "LE", "CLIM", "CJ BANCOS REC- LE - 3,3 - 3P - COURVIN MARROM/BOOMERANG/LINHA DOURADA - E/S/ J - EXECUTIVO", "COMODITA 3 TRANSPORTE", "SÃO PAULO", "2026-08-14", "S", "N", "S", "N/A", "N", "N", "N", "N", "N", "N/A", "N/A", "N"],
  ["TMB71567", "Peugeot Boxer Furgão", "LB", "GE", "CJ BANCOS FIXOS - MC - LB - 4,3,3,3 - 2P - TECIDO - BJD (INCORPOL)", "D+ SAÚDE", "PERDIGÃO", "2026-08-20", "S", "N", "S", "N/A", "N", "N", "N", "N", "N", "N/A", "N/A", "N"],
  ["TA011315", "Peugeot Expert Furgão", "LE", "CLIM", "CJ BANCOS REC- LE - 3,3 - 3P - COURVIN PRETO/CINZA/DIAMANTE/LINHA CINZA - E/S/ J - EXECUTIVO", "OURO VANS TRANSPORTE", "SÃO PAULO", "2026-08-28", "N", "N", "N", "N/A", "N", "N", "N", "N", "N", "N", "N/A", "N"],
];
*/

function sequenceStages(row: UploadSequenceRow): Record<Stage, string> {
  return {
    VIDROS: row[8],
    "A/C": row[9],
    PREP: row[10],
    "SERRA.": row[11],
    "EXPE.": row[12],
    DESMONT: row[13],
    ELÉTRICA: row[14],
    REVEST: row[15],
    BCO: row[16],
    "ACESSÓ.": row[17],
    "PLOTA.": row[18],
    "LIBERA.": row[19],
  };
}

function createOrdersFromRows(rows: UploadSequenceRow[], firstId = 30001): Order[] {
  return rows.map((row, index) => ({
    id: firstId + index,
    status: "PÁTIO",
    item: String(index + 1).padStart(2, "0"),
    dueDate: row[7],
    customer: row[5],
    city: row[6],
    model: row[1],
    chassis: row[0],
    line: mapProductionLine(row[2]),
    transformation: row[1],
    bank: row[4],
    ac: row[3],
    acType: row[3],
    accessory: isNoLoadStageStatus(row[17]) ? "NÃO" : "SJ",
    plot: row[18],
    sequence: index + 1,
    stages: sequenceStages(row),
  }));
}

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
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function normalize(value: string) {
  return value
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function planningMatchKey(value: string) {
  return normalize(value).replace(/\s+/g, "");
}

function mergePlanningOrders(localOrders: Order[], wipOrders: Order[]) {
  const wipChassis = new Set(wipOrders.map((order) => planningMatchKey(order.chassis)).filter(Boolean));
  const wipNumbers = new Set(wipOrders.map((order) => planningMatchKey(order.item)).filter(Boolean));
  const localOnly = localOrders.filter((order) => {
    if (order.source === "WIP") return false;
    return !wipChassis.has(planningMatchKey(order.chassis)) && !wipNumbers.has(planningMatchKey(order.item));
  });
  return [...wipOrders, ...localOnly];
}

type SpreadsheetRecord = Record<string, string>;

type SequenceImportResult = {
  rows: UploadSequenceRow[];
  skipped: number;
};

type DecompressionStreamConstructor = new (format: string) => TransformStream<Uint8Array, Uint8Array>;

function mapProductionLine(value: string) {
  const line = normalize(value);
  if (line === "LAB" || (line.includes("ACESS") && line.includes("BASICA"))) return "LAB";
  if (line === "LAE" || (line.includes("ACESS") && line.includes("EXECUTIVA"))) return "LAE";
  if (line === "LB" || line.includes("BASICA")) return "LB";
  if (line === "LE" || line.includes("EXECUTIVA")) return "LE";
  return value.trim().toUpperCase() || "LB";
}

function parseSpreadsheetDate(value: string) {
  const raw = value.trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);

  const brazilianDate = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (brazilianDate) {
    const [, day, month, year] = brazilianDate;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const serial = Number(raw);
  if (Number.isFinite(serial) && serial > 20000 && serial < 90000) {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000);
    return date.toISOString().slice(0, 10);
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? "" : toDateInput(parsed);
}

function spreadsheetValue(record: SpreadsheetRecord, aliases: string[]) {
  for (const [header, value] of Object.entries(record)) {
    const normalizedHeader = normalize(header);
    if (aliases.some((alias) => normalizedHeader === alias || normalizedHeader.startsWith(`${alias} `))) {
      return value.trim();
    }
  }
  return "";
}

function stageStatus(record: SpreadsheetRecord, aliases: string[]) {
  return spreadsheetValue(record, aliases) || "N/A";
}

function sequenceRowsFromSpreadsheet(records: SpreadsheetRecord[]): SequenceImportResult {
  const rows: UploadSequenceRow[] = [];
  let skipped = 0;

  records.forEach((record) => {
    const chassis = spreadsheetValue(record, ["CHASSI"]);
    const dueDate = parseSpreadsheetDate(spreadsheetValue(record, ["DATA DE ENTREGA", "ENTREGA"]));
    if (!chassis || !dueDate) {
      skipped += 1;
      return;
    }

    rows.push([
      chassis,
      spreadsheetValue(record, ["MMMV", "MODELO"]) || "Modelo não informado",
      mapProductionLine(spreadsheetValue(record, ["LINHA"])),
      spreadsheetValue(record, ["AR CONDICIONADO", "A C"]),
      spreadsheetValue(record, ["CJ BCO", "CJ BANCO", "CONJUNTO DE BANCOS"]),
      spreadsheetValue(record, ["CLIENTE"]) || "Cliente não informado",
      spreadsheetValue(record, ["DESTINO", "CIDADE"]),
      dueDate,
      stageStatus(record, ["VIDROS"]),
      stageStatus(record, ["A C"]),
      stageStatus(record, ["PREP"]),
      stageStatus(record, ["SERRA"]),
      stageStatus(record, ["EXPE"]),
      stageStatus(record, ["DESMONT"]),
      stageStatus(record, ["ELETRICA"]),
      stageStatus(record, ["REVEST"]),
      stageStatus(record, ["BCO"]),
      stageStatus(record, ["ACESSO"]),
      stageStatus(record, ["PLOTA"]),
      stageStatus(record, ["LIBERA"]),
    ]);
  });

  return { rows, skipped };
}

function directChild(element: Element, localName: string) {
  return Array.from(element.children).find((child) => child.localName === localName);
}

function xlsxColumnIndex(reference: string) {
  const letters = reference.replace(/\d/g, "");
  return [...letters].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

async function readXlsxEntries(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  let endOfCentralDirectory = -1;

  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      endOfCentralDirectory = offset;
      break;
    }
  }
  if (endOfCentralDirectory < 0) throw new Error("O arquivo não possui uma estrutura XLSX válida.");

  const entryCount = view.getUint16(endOfCentralDirectory + 10, true);
  let centralOffset = view.getUint32(endOfCentralDirectory + 16, true);
  const decoder = new TextDecoder("utf-8");
  const entries = new Map<string, string>();
  const decompression = (globalThis as typeof globalThis & {
    DecompressionStream?: DecompressionStreamConstructor;
  }).DecompressionStream;

  for (let index = 0; index < entryCount; index += 1) {
    if (view.getUint32(centralOffset, true) !== 0x02014b50) {
      throw new Error("A planilha possui um índice ZIP inválido.");
    }
    const compression = view.getUint16(centralOffset + 10, true);
    const compressedSize = view.getUint32(centralOffset + 20, true);
    const nameLength = view.getUint16(centralOffset + 28, true);
    const extraLength = view.getUint16(centralOffset + 30, true);
    const commentLength = view.getUint16(centralOffset + 32, true);
    const localOffset = view.getUint32(centralOffset + 42, true);
    const name = decoder.decode(bytes.slice(centralOffset + 46, centralOffset + 46 + nameLength));

    if (view.getUint32(localOffset, true) !== 0x04034b50) {
      throw new Error("A planilha possui um arquivo interno inválido.");
    }
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(dataOffset, dataOffset + compressedSize);
    let contents: Uint8Array;

    if (compression === 0) {
      contents = compressed;
    } else if (compression === 8 && decompression) {
      const stream = new Blob([compressed]).stream().pipeThrough(new decompression("deflate-raw"));
      contents = new Uint8Array(await new Response(stream).arrayBuffer());
    } else {
      throw new Error("Este XLSX usa uma compactação não suportada pelo navegador.");
    }

    entries.set(name, decoder.decode(contents));
    centralOffset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

function xlsxSharedStrings(xml: string | undefined) {
  if (!xml) return [];
  const document = new DOMParser().parseFromString(xml, "application/xml");
  return Array.from(document.getElementsByTagName("si")).map((item) => item.textContent ?? "");
}

function xlsxRows(xml: string, sharedStrings: string[]) {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.getElementsByTagName("parsererror").length) {
    throw new Error("Não foi possível ler a primeira aba da planilha.");
  }

  return Array.from(document.getElementsByTagName("row")).map((row) => {
    const values: string[] = [];
    Array.from(row.children)
      .filter((cell) => cell.localName === "c")
      .forEach((cell) => {
        const column = xlsxColumnIndex(cell.getAttribute("r") ?? "A1");
        const type = cell.getAttribute("t");
        const value = directChild(cell, "v")?.textContent ?? "";
        if (type === "s") values[column] = sharedStrings[Number(value)] ?? "";
        else if (type === "inlineStr") values[column] = directChild(cell, "is")?.textContent ?? "";
        else values[column] = value;
      });
    return values;
  });
}

async function readXlsxRecords(file: File, requiredHeader?: string): Promise<SpreadsheetRecord[]> {
  const entries = await readXlsxEntries(await file.arrayBuffer());
  const worksheetName = [...entries.keys()].find((name) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name));
  if (!worksheetName) throw new Error("Não encontrei uma aba de dados no XLSX.");

  const rows = xlsxRows(entries.get(worksheetName) ?? "", xlsxSharedStrings(entries.get("xl/sharedStrings.xml")));
  const headers = rows[0]?.map((header) => header.trim()) ?? [];
  if (requiredHeader && !headers.some((header) => normalize(header) === normalize(requiredHeader))) {
    throw new Error(`A primeira linha precisa ter a coluna ${requiredHeader}.`);
  }

  return rows.slice(1).map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]))
  );
}

function numericSpreadsheetValue(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function scenarioStages(record: SpreadsheetRecord): Record<Stage, string> {
  return {
    VIDROS: stageStatus(record, ["VIDROS"]),
    "A/C": stageStatus(record, ["A C", "AR CONDICIONADO ETAPA"]),
    PREP: stageStatus(record, ["PREP"]),
    "SERRA.": stageStatus(record, ["SERRA"]),
    "EXPE.": stageStatus(record, ["EXPE"]),
    DESMONT: stageStatus(record, ["DESMONT"]),
    /* Legacy malformed keys retained only in source history:
    ELÃ‰TRICA: stageStatus(record, ["ELETRICA"]),
    REVEST: stageStatus(record, ["REVEST"]),
    BCO: stageStatus(record, ["BCO", "BANCO"]),
    "ACESSÃ“.": stageStatus(record, ["ACESSORIO ETAPA"]),
    "PLOTA.": stageStatus(record, ["PLOTAGEM ETAPA"]),
    */
    ["EL\u00C9TRICA"]: stageStatus(record, ["ELETRICA"]),
    REVEST: stageStatus(record, ["REVEST"]),
    BCO: stageStatus(record, ["BCO", "BANCO"]),
    ["ACESS\u00D3."]: stageStatus(record, ["ACESSORIO ETAPA"]),
    "PLOTA.": stageStatus(record, ["PLOTAGEM ETAPA"]),
    "LIBERA.": stageStatus(record, ["LIBERACAO"]),
  };
}

function scenarioVehicleRows(records: SpreadsheetRecord[], startSequence: number): SimulationVehicle[] {
  return records.flatMap((record, index) => {
    const reference = spreadsheetValue(record, ["REFERENCIA", "REFERENCIA SIMULACAO", "OS", "ITEM"]) || `SIM-${index + 1}`;
    const dueDate = parseSpreadsheetDate(spreadsheetValue(record, ["DATA ENTREGA", "DATA DE ENTREGA", "ENTREGA"]));
    if (!dueDate) return [];
    return [{
      id: `${Date.now()}-${index}-${reference}`,
      reference,
      dueDate,
      customer: spreadsheetValue(record, ["CLIENTE"]) || "Cliente simulado",
      city: spreadsheetValue(record, ["DESTINO", "CIDADE"]),
      model: spreadsheetValue(record, ["MODELO", "VEICULO"]) || "VeÃ­culo simulado",
      chassis: spreadsheetValue(record, ["CHASSI"]),
      line: mapProductionLine(spreadsheetValue(record, ["LINHA"])),
      transformation: spreadsheetValue(record, ["TRANSFORMACAO"]) || "SimulaÃ§Ã£o",
      bank: spreadsheetValue(record, ["CONJUNTO BANCOS", "CJ BCO", "BANCO"]),
      ac: spreadsheetValue(record, ["FORNECEDOR AR", "AR CONDICIONADO"]),
      acType: spreadsheetValue(record, ["TIPO AR", "TIPO SISTEMA AR"]),
      accessory: spreadsheetValue(record, ["ACESSORIO"]),
      plot: spreadsheetValue(record, ["PLOTAGEM"]),
      sequence: Math.max(1, numericSpreadsheetValue(spreadsheetValue(record, ["SEQUENCIA"])) || startSequence + index),
      stages: scenarioStages(record),
    }];
  });
}

function scenarioMaterialRows(records: SpreadsheetRecord[]): SimulationMaterial[] {
  return records.flatMap((record, index) => {
    const pn = spreadsheetValue(record, ["SKU", "CODIGO", "PN"]);
    const quantity = numericSpreadsheetValue(spreadsheetValue(record, ["QUANTIDADE", "QTD"]));
    const needDate = parseSpreadsheetDate(spreadsheetValue(record, ["DATA NECESSIDADE", "DATA", "ENTREGA"]));
    if (!pn || quantity <= 0 || !needDate) return [];
    return [{
      id: `${Date.now()}-${index}-${pn}`,
      pn,
      description: spreadsheetValue(record, ["DESCRICAO", "MATERIAL"]) || "Material simulado",
      unit: spreadsheetValue(record, ["UNIDADE", "UN"]) || "UN",
      needDate,
      quantity,
      note: spreadsheetValue(record, ["OBSERVACAO", "NOTA"]),
    }];
  });
}

function isNoLoadStageStatus(value: string) {
  const status = normalize(value || "");
  return status === "N A" || status === "NA" || status === "";
}

function isCompletedStageStatus(value: string) {
  const status = normalize(value || "");
  return status === "S" || status === "SIM";
}

function isPartialStageStatus(value: string) {
  const status = normalize(value || "");
  return status === "P" || status === "PARCIAL";
}

function shouldSchedule(value: string, completeFlow: boolean) {
  if (isNoLoadStageStatus(value)) return false;
  if (completeFlow) return true;
  return !isCompletedStageStatus(value);
}

function stageDependencyLabel(stage: Stage) {
  const dependencies = stageDependencies[stage];
  if (!dependencies.length) return "Paralela/inicial";
  if (stage === "DESMONT") return "Depende de VIDROS + A/C";
  if (stage === "LIBERA.") return "Depende de todas as etapas aplicáveis";
  return `Depende de ${dependencies.join(" + ")}`;
}

function dayKey(date: Date) {
  return toDateInput(date);
}

function timeToMinutes(value: string) {
  const [hour = 0, minute = 0] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function setTimeFromMinutes(date: Date, minutes: number) {
  const copy = new Date(date);
  copy.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return copy;
}

function productiveMinutesPerDay(calendar: CalendarConfig) {
  const dayStart = timeToMinutes(calendar.dayStart);
  const dayEnd = timeToMinutes(calendar.dayEnd);
  const lunchStart = timeToMinutes(calendar.lunchStart);
  const lunchEnd = timeToMinutes(calendar.lunchEnd);
  const base = Math.max(0, dayEnd - dayStart);
  const lunch =
    lunchEnd > lunchStart
      ? Math.max(0, Math.min(dayEnd, lunchEnd) - Math.max(dayStart, lunchStart))
      : 0;
  return Math.max(0, base - lunch);
}

function hasTimeValue(value: string) {
  return /^\d{2}:\d{2}$/.test(value);
}

function calendarValidationMessage(calendar: CalendarConfig) {
  const dayStart = timeToMinutes(calendar.dayStart);
  const dayEnd = timeToMinutes(calendar.dayEnd);
  if (!hasTimeValue(calendar.dayStart) || !hasTimeValue(calendar.dayEnd)) {
    return "Preencha os horários de entrada e saída.";
  }
  if (!calendar.workingDays.length) return "Selecione ao menos um dia trabalhado.";
  if (dayEnd <= dayStart) return "O horário de saída precisa ser maior que o horário de entrada.";
  if (productiveMinutesPerDay(calendar) <= 0) {
    return "A jornada ficou sem tempo produtivo. Ajuste entrada, saída ou almoço.";
  }
  return "";
}

function hasProductiveCalendar(calendar: CalendarConfig) {
  return calendarValidationMessage(calendar) === "";
}

function holidaySet(calendar: CalendarConfig) {
  return new Set(
    calendar.holidays
      .split(/[\s,;]+/)
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function getStartDate(calendar: CalendarConfig) {
  const start = parseDate(calendar.startDate);
  const dayStart = timeToMinutes(calendar.dayStart);
  start.setHours(Math.floor(dayStart / 60), dayStart % 60, 0, 0);
  return nextWorkingMinute(start, calendar);
}

function isWorkingDay(date: Date, calendar: CalendarConfig) {
  return (
    calendar.workingDays.includes(date.getDay()) &&
    !holidaySet(calendar).has(dayKey(date))
  );
}

function workingIntervals(date: Date, calendar: CalendarConfig) {
  if (!isWorkingDay(date, calendar)) return [];

  const dayStart = timeToMinutes(calendar.dayStart);
  const dayEnd = timeToMinutes(calendar.dayEnd);
  const lunchStart = timeToMinutes(calendar.lunchStart);
  const lunchEnd = timeToMinutes(calendar.lunchEnd);
  if (dayEnd <= dayStart) return [];

  const intervals: Array<{ start: Date; end: Date }> = [];
  const hasLunch = lunchEnd > lunchStart && lunchStart < dayEnd && lunchEnd > dayStart;
  if (!hasLunch) {
    intervals.push({
      start: setTimeFromMinutes(date, dayStart),
      end: setTimeFromMinutes(date, dayEnd),
    });
    return intervals;
  }

  const firstEnd = Math.max(dayStart, Math.min(dayEnd, lunchStart));
  const secondStart = Math.min(dayEnd, Math.max(dayStart, lunchEnd));
  if (firstEnd > dayStart) {
    intervals.push({
      start: setTimeFromMinutes(date, dayStart),
      end: setTimeFromMinutes(date, firstEnd),
    });
  }
  if (dayEnd > secondStart) {
    intervals.push({
      start: setTimeFromMinutes(date, secondStart),
      end: setTimeFromMinutes(date, dayEnd),
    });
  }
  return intervals;
}

function nextCalendarDayStart(date: Date, calendar: CalendarConfig) {
  const cursor = new Date(date);
  cursor.setDate(cursor.getDate() + 1);
  const dayStart = timeToMinutes(calendar.dayStart);
  cursor.setHours(Math.floor(dayStart / 60), dayStart % 60, 0, 0);
  return cursor;
}

function nextWorkingMinute(date: Date, calendar: CalendarConfig): Date {
  let cursor = new Date(date);
  if (!hasProductiveCalendar(calendar)) return cursor;
  for (let guard = 0; guard < 370; guard += 1) {
    const intervals = workingIntervals(cursor, calendar);
    for (const interval of intervals) {
      if (cursor < interval.start) return interval.start;
      if (cursor < interval.end) return cursor;
    }
    cursor = nextCalendarDayStart(cursor, calendar);
  }
  return cursor;
}

function addWorkMinutes(date: Date, minutes: number, calendar: CalendarConfig) {
  let remaining = Math.max(0, minutes);
  if (!hasProductiveCalendar(calendar)) return new Date(date);
  let cursor = nextWorkingMinute(date, calendar);

  for (let guard = 0; remaining > 0 && guard < 20000; guard += 1) {
    cursor = nextWorkingMinute(cursor, calendar);
    const interval = workingIntervals(cursor, calendar).find(
      (item) => cursor >= item.start && cursor < item.end
    );
    if (!interval) {
      cursor = nextCalendarDayStart(cursor, calendar);
      continue;
    }
    const available = Math.max(0, (interval.end.getTime() - cursor.getTime()) / 60000);
    const used = Math.min(available, remaining);
    cursor = new Date(cursor.getTime() + used * 60000);
    remaining -= used;
  }

  return cursor;
}

function productiveSegments(start: Date, end: Date, calendar: CalendarConfig) {
  const segments: Array<{ start: Date; end: Date }> = [];
  let cursor = startOfDay(start);
  const lastDay = startOfDay(end);

  for (let guard = 0; cursor <= lastDay && guard < 370; guard += 1) {
    for (const interval of workingIntervals(cursor, calendar)) {
      const segmentStart = new Date(Math.max(start.getTime(), interval.start.getTime()));
      const segmentEnd = new Date(Math.min(end.getTime(), interval.end.getTime()));
      if (segmentEnd > segmentStart) segments.push({ start: segmentStart, end: segmentEnd });
    }
    cursor = addDays(cursor, 1);
  }

  return segments;
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
  const fullMinutes = Math.max(0, Math.round(base + acBoost + accessoryBoost + plotBoost));
  if (fullMinutes > 0 && isPartialStageStatus(order.stages[stage])) {
    return Math.max(1, Math.round(fullMinutes / 2));
  }
  return fullMinutes;
}

function buildSchedule(orders: Order[], rules: TimeRule[], calendar: CalendarConfig): ScheduleResult {
  const resourceCursor = new Map<Stage, Date[]>();
  const operations: Operation[] = [];
  const finishByOrder = new Map<number, Date>();
  if (!hasProductiveCalendar(calendar)) return { operations, finishByOrder };
  const start = getStartDate(calendar);
  stages.forEach((stage) => {
    const count = operatorCountForStage(calendar, stage);
    resourceCursor.set(
      stage,
      Array.from({ length: count }, () => new Date(start))
    );
  });

  const sorted = [...orders].sort((a, b) => {
    const due = parseDate(a.dueDate).getTime() - parseDate(b.dueDate).getTime();
    return a.sequence - b.sequence || due || Number(a.item) - Number(b.item);
  });

  for (const order of sorted) {
    const stageFinish = new Map<Stage, Date>();
    const orderOperationEnds: Date[] = [];
    stages.forEach((stage) => {
      if (!shouldSchedule(order.stages[stage], calendar.completeFlow)) {
        stageFinish.set(stage, new Date(start));
      }
    });

    for (const stage of schedulingStages) {
      const dependenciesReadyAt = (stageDependencies[stage] ?? []).reduce(
        (latest, dependency) => {
          const dependencyFinish = stageFinish.get(dependency) ?? start;
          return dependencyFinish > latest ? dependencyFinish : latest;
        },
        new Date(start)
      );

      if (!shouldSchedule(order.stages[stage], calendar.completeFlow)) {
        if (!stageFinish.has(stage)) stageFinish.set(stage, dependenciesReadyAt);
        continue;
      }

      const minutes = getStageMinutes(order, stage, rules);
      if (minutes <= 0) {
        stageFinish.set(stage, dependenciesReadyAt);
        continue;
      }

      const stageOperators = resourceCursor.get(stage) ?? [new Date(start)];
      let selectedOperator = 0;
      let operationStart = nextWorkingMinute(
        new Date(Math.max(dependenciesReadyAt.getTime(), stageOperators[0].getTime())),
        calendar
      );
      stageOperators.forEach((operatorReady, index) => {
        const candidateStart = nextWorkingMinute(
          new Date(Math.max(dependenciesReadyAt.getTime(), operatorReady.getTime())),
          calendar
        );
        if (candidateStart < operationStart) {
          operationStart = candidateStart;
          selectedOperator = index;
        }
      });
      const end = addWorkMinutes(operationStart, minutes, calendar);
      operations.push({
        id: `${order.id}-${stage}`,
        orderId: order.id,
        item: order.item,
        os: order.chassis,
        customer: order.customer,
        stage,
        line: order.line,
        operator: selectedOperator + 1,
        start: operationStart,
        end,
        minutes,
        dueDate: order.dueDate,
      });
      stageOperators[selectedOperator] = end;
      resourceCursor.set(stage, stageOperators);
      stageFinish.set(stage, end);
      orderOperationEnds.push(end);
    }

    if (orderOperationEnds.length) {
      finishByOrder.set(
        order.id,
        new Date(Math.max(...orderOperationEnds.map((finish) => finish.getTime())))
      );
    }
  }

  return { operations, finishByOrder };
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

function weekRangeLabel(date: Date) {
  return `${weekLabel(date)} · ${date.getFullYear()}`;
}

function excelWeekNumber(date: Date) {
  const first = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((startOfDay(date).getTime() - first.getTime()) / 86400000);
  return Math.ceil((days + first.getDay() + 1) / 7);
}

function mrpWeekSequence(start: Date, horizonDays: number) {
  const weeks: number[] = [];
  const horizonWeeks = Math.max(7, Math.min(26, Math.ceil(horizonDays / 7)));
  let cursor = startOfDay(start);
  while (weeks.length < horizonWeeks) {
    const week = excelWeekNumber(cursor);
    if (!weeks.includes(week)) weeks.push(week);
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

/* Planejador local de exemplo aposentado: o MRP I usa app/lib/mrp-live.ts
 * e a leitura direta do Supabase, com cenários locais opcionais.
function activePurchaseStatus(status: string) {
  const value = normalize(status);
  return (
    !value.includes("CONCLUID") &&
    !value.includes("FINALIZ") &&
    !value.includes("CANCEL") &&
    !value.includes("RECEBID")
  );
}

function addToBucket(
  bucket: Map<string, Map<number, number>>,
  pn: string,
  week: number,
  quantity: number
) {
  if (!bucket.has(pn)) bucket.set(pn, new Map());
  const byWeek = bucket.get(pn);
  if (!byWeek) return;
  byWeek.set(week, (byWeek.get(week) ?? 0) + quantity);
}

function readBucket(bucket: Map<string, Map<number, number>>, pn: string, week: number) {
  return bucket.get(pn)?.get(week) ?? 0;
}

function buildMrpIPlan(
  finishByItem: Map<string, Date>,
  calendar: CalendarConfig,
  safetyFactor: number
): MrpIPlan {
  const start = getStartDate(calendar);
  const weeks = mrpWeekSequence(start, planningHorizonDays(calendar));
  const currentWeek = weeks[0] ?? excelWeekNumber(start);
  const demandByPn = new Map<string, Map<number, number>>();
  const incomingByPn = new Map<string, Map<number, number>>();
  let linkedRequirements = 0;
  let currentWeekRequirements = 0;

  mrpISeed.requirements.forEach((requirement) => {
    const quantity = Number(requirement.quantity) || 0;
    if (!requirement.pn || quantity <= 0) return;
    const finish = finishByItem.get(normalize(requirement.osRef));
    if (finish) {
      const week = excelWeekNumber(finish);
      if (!weeks.includes(week)) return;
      linkedRequirements += 1;
      addToBucket(demandByPn, requirement.pn, week, quantity);
      return;
    }
    currentWeekRequirements += 1;
    addToBucket(demandByPn, requirement.pn, currentWeek, quantity);
  });

  mrpISeed.purchases.forEach((purchase) => {
    const quantity = Number(purchase.quantity) || 0;
    if (!purchase.pn || quantity <= 0 || !activePurchaseStatus(purchase.status)) return;
    const week = Number(purchase.deliveryWeek) || currentWeek;
    if (!weeks.includes(week)) return;
    addToBucket(incomingByPn, purchase.pn, week, quantity);
  });

  const inventoryByPn = new Map(mrpISeed.inventory.map((item) => [item.pn, item]));
  const leadByPn = new Map(mrpISeed.leadTimes.map((item) => [item.pn, item]));
  const pnSet = new Set<string>();
  mrpISeed.leadTimes.forEach((item) => pnSet.add(item.pn));
  mrpISeed.inventory.forEach((item) => pnSet.add(item.pn));
  demandByPn.forEach((_, pn) => pnSet.add(pn));
  incomingByPn.forEach((_, pn) => pnSet.add(pn));

  const rows = [...pnSet].map((pn) => {
    const inventory = inventoryByPn.get(pn);
    const lead = leadByPn.get(pn);
    const leadWeeks = Math.max(1, Math.ceil((Number(lead?.calendarDays) || 7) / 7));
    const available = Number(inventory?.available) || 0;
    const demand = weeks.map((week) => readBucket(demandByPn, pn, week));
    const incoming = weeks.map((week) => readBucket(incomingByPn, pn, week));
    const totalDemand = demand.reduce((total, value) => total + value, 0);
    const totalIncoming = incoming.reduce((total, value) => total + value, 0);
    const averageFuture = weeks.length ? totalDemand / weeks.length : 0;
    const safetyStock = (averageFuture / 22) * 7;
    const projected: number[] = [];
    const suggested = Array.from({ length: weeks.length }, () => 0);
    let stock = available;
    let previousShortage = 0;

    weeks.forEach((_, index) => {
      stock = stock - demand[index] + incoming[index] + safetyStock * safetyFactor;
      projected.push(stock);
      const shortage = Math.max(0, -stock);
      const incrementalShortage = Math.max(0, shortage - previousShortage);
      if (incrementalShortage > 0) {
        const purchaseIndex = Math.max(0, index - leadWeeks);
        suggested[purchaseIndex] += incrementalShortage;
      }
      previousShortage = shortage;
    });

    const totalSuggested = suggested.reduce((total, value) => total + value, 0);
    const firstSuggestedIndex = suggested.findIndex((value) => value > 0);
    return {
      pn,
      description: lead?.description || inventory?.description || "",
      available,
      leadWeeks,
      totalDemand,
      totalIncoming,
      totalSuggested,
      safetyStock,
      firstSuggestedWeek: firstSuggestedIndex >= 0 ? weeks[firstSuggestedIndex] : null,
      projected,
      suggested,
      demand,
      incoming,
    };
  });

  const relevantRows = rows
    .filter(
      (row) =>
        row.totalDemand > 0 ||
        row.totalIncoming > 0 ||
        row.totalSuggested > 0 ||
        row.projected.some((value) => value < 0)
    )
    .sort((a, b) => {
      if (b.totalSuggested !== a.totalSuggested) return b.totalSuggested - a.totalSuggested;
      if (b.totalDemand !== a.totalDemand) return b.totalDemand - a.totalDemand;
      return a.pn.localeCompare(b.pn);
    });

  return {
    weeks,
    currentWeek,
    rows: relevantRows,
    totalDemand: relevantRows.reduce((total, row) => total + row.totalDemand, 0),
    totalIncoming: relevantRows.reduce((total, row) => total + row.totalIncoming, 0),
    totalSuggested: relevantRows.reduce((total, row) => total + row.totalSuggested, 0),
    shortageItems: relevantRows.filter((row) => row.projected.some((value) => value < 0)).length,
    linkedRequirements,
    currentWeekRequirements,
  };
}
*/

function formatQuantity(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: value % 1 ? 2 : 0,
  }).format(value);
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

function calendarTimeMarks(calendar: CalendarConfig) {
  const start = timeToMinutes(calendar.dayStart);
  const end = timeToMinutes(calendar.dayEnd);
  const marks = new Set([calendar.dayStart, calendar.lunchStart, calendar.lunchEnd, calendar.dayEnd]);
  const firstEvenHour = Math.ceil(start / 120) * 120;

  for (let minute = firstEvenHour; minute < end; minute += 120) {
    marks.add(`${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`);
  }

  return [...marks]
    .filter(hasTimeValue)
    .filter((value) => timeToMinutes(value) >= start && timeToMinutes(value) <= end)
    .sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (!hours) return `${mins}min`;
  if (!mins) return `${hours}h`;
  return `${hours}h${String(mins).padStart(2, "0")}`;
}

function monthName(monthIndex: number) {
  return new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(
    new Date(2026, monthIndex, 1)
  );
}

function monthDates(year: number, month: number) {
  const dates: Date[] = [];
  const first = new Date(year, month, 1);
  const startPadding = first.getDay();
  for (let i = startPadding; i > 0; i -= 1) {
    dates.push(new Date(year, month, 1 - i));
  }
  const cursor = new Date(year, month, 1);
  while (cursor.getMonth() === month) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  while (dates.length % 7 !== 0) {
    const next = addDays(dates[dates.length - 1], 1);
    dates.push(next);
  }
  return dates;
}

function MrpAccess({ onAuthenticated }: { onAuthenticated: (user: MrpSessionUser) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const payload = (await response.json()) as { error?: string; user?: MrpSessionUser };
      if (!response.ok || !payload.user) {
        throw new Error(payload.error || "Não foi possível iniciar a sessão.");
      }
      setPassword("");
      onAuthenticated(payload.user);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível iniciar a sessão.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mrp-auth-shell">
      <section className="mrp-auth-card" aria-labelledby="mrp-login-title">
        <div className="mrp-auth-brand">
          <span className="brand-mark">JI</span>
          <div>
            <strong>JI Montadora</strong>
            <span>Planejamento de materiais e capacidade</span>
          </div>
        </div>
        <h1 id="mrp-login-title">Acesso ao MRP</h1>
        <p>Use o mesmo usuário e senha do ERP. Este módulo é destinado aos perfis PCP e ADMIN.</p>
        <form className="mrp-auth-form" onSubmit={signIn}>
          <label>
            Usuário
            <input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required />
          </label>
          <label>
            Senha
            <input autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          {message ? <p className="mrp-auth-error" role="alert">{message}</p> : null}
          <button className="button primary mrp-auth-submit" disabled={submitting} type="submit">
            {submitting ? "Validando acesso..." : "Entrar no MRP"}
          </button>
        </form>
      </section>
    </main>
  );
}

export default function Home() {
  const [user, setUser] = useState<MrpSessionUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let active = true;
    void fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        const payload = (await response.json()) as { user?: MrpSessionUser };
        return payload.user ?? null;
      })
      .then((sessionUser) => {
        if (active) setUser(sessionUser);
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });
    return () => { active = false; };
  }, []);

  if (checkingSession) {
    return <main className="mrp-auth-shell"><p className="mrp-auth-loading">Validando acesso ao MRP...</p></main>;
  }
  if (!user) return <MrpAccess onAuthenticated={setUser} />;
  return <MrpWorkspace user={user} onSignOut={() => setUser(null)} />;
}

function MrpWorkspace({ user, onSignOut }: { user: MrpSessionUser; onSignOut: () => void }) {
  const [rules, setRules] = useState<TimeRule[]>(initialRules);
  const [calendar, setCalendar] = useState<CalendarConfig>(() => operationalCalendar());
  const [selectedStage, setSelectedStage] = useState<Stage>("REVEST");
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceView>("overview");
  const [filter, setFilter] = useState("todos");
  const [mrpSearch, setMrpSearch] = useState("");
  const [mrpSafetyFactor, setMrpSafetyFactor] = useState(0);
  const [mrpPeriodicity, setMrpPeriodicity] = useState<MrpPeriodicity>("DIA");
  const [mrpHorizonDays, setMrpHorizonDays] = useState(30);
  const [mrpSnapshot, setMrpSnapshot] = useState<MrpLiveSnapshot | null>(null);
  const [mrpLoading, setMrpLoading] = useState(true);
  const [mrpLoadMessage, setMrpLoadMessage] = useState("Carregando dados operacionais...");
  const [wipSnapshot, setWipSnapshot] = useState<WipSnapshot | null>(null);
  const [wipLoading, setWipLoading] = useState(true);
  const [wipLoadMessage, setWipLoadMessage] = useState("Carregando O.S. em WIP...");
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [activeScenarioId, setActiveScenarioId] = useState("");
  const [scenarioStorageReady, setScenarioStorageReady] = useState(false);
  const [scenarioName, setScenarioName] = useState("");
  const [scenarioMessage, setScenarioMessage] = useState("");
  const vehicleInputRef = useRef<HTMLInputElement>(null);
  const materialInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // The former state included local test O.S. and imported spreadsheets.
    // Clear it once; only planning preferences remain persisted locally.
    window.localStorage.removeItem("ji-mrp-state");
    const saved = window.localStorage.getItem("ji-mrp-settings");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as {
        version?: string;
        rules?: TimeRule[];
        calendar?: Partial<CalendarConfig>;
      };
      if (parsed.version !== STATE_VERSION) {
        window.localStorage.removeItem("ji-mrp-settings");
        return;
      }
      if (parsed.rules) setRules(parsed.rules);
      if (parsed.calendar) setCalendar(restoreCalendarConfig(parsed.calendar));
    } catch {
      window.localStorage.removeItem("ji-mrp-settings");
    }
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem("ji-mrp-scenarios-v1");
    if (!saved) {
      setScenarioStorageReady(true);
      return;
    }
    try {
      const parsed = JSON.parse(saved) as { scenarios?: Scenario[]; activeScenarioId?: string };
      const safeScenarios = Array.isArray(parsed.scenarios) ? parsed.scenarios : [];
      setScenarios(safeScenarios);
      setActiveScenarioId(safeScenarios.some((scenario) => scenario.id === parsed.activeScenarioId) ? parsed.activeScenarioId || "" : "");
    } catch {
      window.localStorage.removeItem("ji-mrp-scenarios-v1");
    } finally {
      setScenarioStorageReady(true);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "ji-mrp-settings",
      JSON.stringify({ version: STATE_VERSION, rules, calendar })
    );
  }, [rules, calendar]);

  useEffect(() => {
    if (!scenarioStorageReady) return;
    window.localStorage.setItem("ji-mrp-scenarios-v1", JSON.stringify({ scenarios, activeScenarioId }));
  }, [activeScenarioId, scenarioStorageReady, scenarios]);

  const refreshMrpI = async () => {
    setCalendar((current) => ({ ...current, startDate: toDateInput(new Date()) }));
    setMrpLoading(true);
    setMrpLoadMessage("Atualizando necessidade, tr\u00e2nsito e estoque...");
    try {
      const response = await fetch("/api/mrp-i", { cache: "no-store" });
      const payload = (await response.json()) as MrpLiveSnapshot & { error?: string };
      if (!response.ok || payload.error) {
        throw new Error(payload.error || "N\u00e3o foi poss\u00edvel atualizar o MRP I.");
      }
      setMrpSnapshot(payload);
      setMrpLoadMessage("Dados operacionais atualizados.");
    } catch (error) {
      setMrpLoadMessage(error instanceof Error ? error.message : "N\u00e3o foi poss\u00edvel atualizar o MRP I.");
    } finally {
      setMrpLoading(false);
    }
  };

  useEffect(() => {
    void refreshMrpI();
  }, []);

  const refreshWip = async () => {
    setCalendar((current) => ({ ...current, startDate: toDateInput(new Date()) }));
    setWipLoading(true);
    setWipLoadMessage("Atualizando O.S. em WIP e seus apontamentos...");
    try {
      const response = await fetch("/api/wip", { cache: "no-store" });
      const payload = (await response.json()) as WipSnapshot & { error?: string };
      if (!response.ok || payload.error) {
        throw new Error(payload.error || "Não foi possível atualizar o WIP do MES.");
      }
      setWipSnapshot(payload);
      setWipLoadMessage("WIP do MES atualizado.");
    } catch (error) {
      setWipLoadMessage(error instanceof Error ? error.message : "Não foi possível atualizar o WIP do MES.");
    } finally {
      setWipLoading(false);
    }
  };

  useEffect(() => {
    void refreshWip();
  }, []);

  const selectedMonthDates = useMemo(
    () => monthDates(calendar.calendarYear, calendar.calendarMonth),
    [calendar.calendarMonth, calendar.calendarYear]
  );

  const holidayDates = useMemo(() => holidaySet(calendar), [calendar]);

  const monthlyStops = selectedMonthDates.filter(
    (date) =>
      date.getMonth() === calendar.calendarMonth &&
      (!calendar.workingDays.includes(date.getDay()) || holidayDates.has(dayKey(date)))
  ).length;
  const calendarWarning = calendarValidationMessage(calendar);
  const horizonDays = planningHorizonDays(calendar);

  const activeScenario = useMemo(
    () => scenarios.find((scenario) => scenario.id === activeScenarioId) || null,
    [activeScenarioId, scenarios]
  );
  const scenarioOrders = useMemo<Order[]>(() => (activeScenario?.vehicles || []).map((vehicle, index) => ({
    id: 9_000_000 + index,
    source: "SIMULACAO",
    status: "SIMULAÃ‡ÃƒO",
    item: vehicle.reference,
    dueDate: vehicle.dueDate,
    customer: vehicle.customer,
    city: vehicle.city,
    model: vehicle.model,
    chassis: vehicle.chassis || "SEM CHASSI (SIMULAÃ‡ÃƒO)",
    line: vehicle.line,
    transformation: vehicle.transformation,
    bank: vehicle.bank,
    ac: vehicle.ac,
    acType: vehicle.acType,
    accessory: vehicle.accessory,
    plot: vehicle.plot,
    sequence: vehicle.sequence,
    stages: vehicle.stages,
  })), [activeScenario]);
  const planningOrders = useMemo(() => [...(wipSnapshot?.orders || []), ...scenarioOrders], [scenarioOrders, wipSnapshot]);

  const filteredOrders = useMemo(() => {
    if (filter === "todos") return planningOrders;
    return planningOrders.filter((order) => normalize(order.line) === normalize(filter));
  }, [filter, planningOrders]);

  const schedule = useMemo(
    () => buildSchedule(filteredOrders, rules, calendar),
    [filteredOrders, rules, calendar]
  );
  const operations = schedule.operations;
  const finishByOrder = schedule.finishByOrder;
  const finishByItem = useMemo(() => {
    const mapped = new Map<string, Date>();
    filteredOrders.forEach((order) => {
      const finish = finishByOrder.get(order.id);
      if (finish) {
        mapped.set(normalize(order.item), finish);
        mapped.set(normalize(order.chassis), finish);
      }
    });
    return mapped;
  }, [filteredOrders, finishByOrder]);

  const mrpSnapshotWithScenario = useMemo(() => {
    if (!mrpSnapshot) return null;
    const simulatedDemands = (activeScenario?.materials || []).map((material) => ({
      pn: material.pn,
      description: material.description,
      unit: material.unit,
      quantity: material.quantity,
      needDate: material.needDate,
      source: "SIMULACAO" as const,
      reference: `CenÃ¡rio ${activeScenario?.name || "local"}: ${material.note || material.id}`,
    }));
    return { ...mrpSnapshot, demands: [...mrpSnapshot.demands, ...simulatedDemands] };
  }, [activeScenario, mrpSnapshot]);
  const mrpIPlan = useMemo(
    () => mrpSnapshotWithScenario
      ? buildMrpLivePlan(mrpSnapshotWithScenario, {
          startDate: getStartDate(calendar),
          horizonDays: mrpHorizonDays,
          periodicity: mrpPeriodicity,
          safetyFactor: mrpSafetyFactor,
        })
      : null,
    [calendar, mrpHorizonDays, mrpPeriodicity, mrpSafetyFactor, mrpSnapshotWithScenario]
  );

  const mrpFilteredRows = useMemo(() => {
    const search = normalize(mrpSearch);
    const sourceRows = mrpIPlan?.rows ?? [];
    return search
      ? sourceRows.filter(
          (row) => normalize(row.pn).includes(search) || normalize(row.description).includes(search)
        )
      : sourceRows;
  }, [mrpIPlan, mrpSearch]);

  const mrpRows = useMemo(() => mrpFilteredRows.slice(0, 80), [mrpFilteredRows]);

  const mrpVisibleSummary = useMemo(() => (
    mrpFilteredRows.reduce((summary, row) => ({
      firmDemand: summary.firmDemand + row.firmDemand,
      forecastFirmDemand: summary.forecastFirmDemand + row.forecastFirmDemand,
      forecastPredictiveDemand: summary.forecastPredictiveDemand + row.forecastPredictiveDemand,
      simulationDemand: summary.simulationDemand + row.simulationDemand,
      incoming: summary.incoming + row.totalIncoming,
      suggested: summary.suggested + row.totalSuggested,
      shortages: summary.shortages + (row.totalSuggested > 0 ? 1 : 0),
    }), {
      firmDemand: 0,
      forecastFirmDemand: 0,
      forecastPredictiveDemand: 0,
      simulationDemand: 0,
      incoming: 0,
      suggested: 0,
      shortages: 0,
    })
  ), [mrpFilteredRows]);

  const capacity = useMemo(() => {
    const capacityStart = getStartDate(calendar);
    const capacityEnd = addDays(startOfDay(capacityStart), planningHorizonDays(calendar) - 1);
    const byStage = stages.map((stage) => {
      const minutes = operations
        .filter((operation) => operation.stage === stage)
        .reduce((total, operation) => total + operation.minutes, 0);
      const workingDays = countWorkingDays(capacityStart, capacityEnd, calendar);
      const operators = operatorCountForStage(calendar, stage);
      const perOperatorAvailable = workingDays * productiveMinutesPerDay(calendar);
      const available = perOperatorAvailable * operators;
      const requiredOperators = perOperatorAvailable
        ? Math.max(1, Math.ceil(minutes / perOperatorAvailable))
        : 1;
      return {
        stage,
        minutes,
        hours: minutes / 60,
        available: available / 60,
        operators,
        requiredOperators,
        perOperatorAvailable: perOperatorAvailable / 60,
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
    const start = startOfDay(getStartDate(calendar));
    const horizonEnd = addDays(start, planningHorizonDays(calendar) - 1);
    const days: Date[] = [];
    let cursor = start;
    while (cursor <= horizonEnd && days.length < 370) {
      days.push(cursor);
      cursor = addDays(cursor, 1);
    }
    return days;
  }, [calendar]);

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
      dayWidth: Math.max(170, Math.min(GANTT_DAY_WIDTH, Math.floor(6600 / Math.max(1, ganttDays.length)))),
      width: Math.max(GANTT_MIN_WIDTH, ganttDays.length * Math.max(170, Math.min(GANTT_DAY_WIDTH, Math.floor(6600 / Math.max(1, ganttDays.length))))),
    };
  }, [ganttBounds.start, ganttDays]);

  const ganttWindowEnd = useMemo(() => {
    const lastDay = ganttDays[ganttDays.length - 1] ?? startOfDay(getStartDate(calendar));
    return setTimeFromMinutes(lastDay, timeToMinutes(calendar.dayEnd));
  }, [calendar, ganttDays]);

  const ganttWeekGroups = useMemo(() => {
    const groups: Array<{ key: string; label: string; days: number }> = [];
    ganttDays.forEach((day) => {
      const key = weekRangeLabel(day);
      const current = groups[groups.length - 1];
      if (current?.key === key) {
        current.days += 1;
      } else {
        groups.push({ key, label: key, days: 1 });
      }
    });
    return groups;
  }, [ganttDays]);

  const ganttHourMarks = useMemo(() => calendarTimeMarks(calendar), [calendar]);

  const ganttLanes = useMemo(
    () =>
      stages.flatMap((stage) =>
        Array.from({ length: operatorCountForStage(calendar, stage) }, (_, index) => ({
          key: `${stage}-${index + 1}`,
          stage,
          operator: index + 1,
        }))
      ),
    [calendar]
  );

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
  const informedOperators = capacity.reduce((total, row) => total + row.operators, 0);
  const requiredOperators = capacity.reduce((total, row) => total + row.requiredOperators, 0);

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

  function updateOperators(stage: Stage, value: string) {
    const operators = Math.max(1, Math.floor(Number(value) || 1));
    setCalendar({
      ...calendar,
      operators: {
        ...calendar.operators,
        [stage]: operators,
      },
    });
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

  function toggleHoliday(date: Date) {
    const key = dayKey(date);
    const next = new Set(holidayDates);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setCalendar({
      ...calendar,
      holidays: [...next].sort().join(", "),
    });
  }

  function shiftCalendarMonth(direction: number) {
    const next = new Date(calendar.calendarYear, calendar.calendarMonth + direction, 1);
    setCalendar({
      ...calendar,
      calendarYear: next.getFullYear(),
      calendarMonth: next.getMonth(),
    });
  }

  const workspaceMeta: Record<WorkspaceView, { label: string; title: string; subtitle: string }> = {
    overview: {
      label: "Visão geral",
      title: "Controle de programação",
      subtitle: "Cenário, disponibilidade e sinais de capacidade.",
    },
    mrp2: {
      label: "MRP II",
      title: "Programação da fábrica",
      subtitle: "Sequenciamento finito por posto, dependência e calendário.",
    },
    mrp1: {
      label: "MRP I",
      title: "Planejamento de materiais",
      subtitle: "Necessidades, estoque, trânsito e sugestão de compra por período.",
    },
    scenarios: {
      label: "Cenários",
      title: "Simulações de demanda e capacidade",
      subtitle: "Crie, carregue, compare e remova cenários sem alterar a operação real.",
    },
    settings: {
      label: "Parâmetros",
      title: "Carteira real e tempos padrão",
      subtitle: "WIP do MES em leitura e regras do mix produtivo.",
    },
  };

  function openWorkspace(view: WorkspaceView) {
    setActiveWorkspace(view);
    window.requestAnimationFrame(() => {
      document.getElementById(view)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function createScenario() {
    const name = scenarioName.trim() || `CenÃ¡rio ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date())}`;
    const scenario: Scenario = {
      id: `scenario-${Date.now()}`,
      name,
      createdAt: new Date().toISOString(),
      vehicles: [],
      materials: [],
    };
    setScenarios((current) => [scenario, ...current]);
    setActiveScenarioId(scenario.id);
    setScenarioName("");
    setScenarioMessage(`CenÃ¡rio “${name}” criado. Ele estÃ¡ vazio e nÃ£o altera o Supabase.`);
  }

  function updateActiveScenario(mutator: (scenario: Scenario) => Scenario) {
    if (!activeScenario) {
      setScenarioMessage("Crie ou selecione um cenÃ¡rio antes de importar dados simulados.");
      return false;
    }
    setScenarios((current) => current.map((scenario) => scenario.id === activeScenario.id ? mutator(scenario) : scenario));
    return true;
  }

  function deleteActiveScenario() {
    if (!activeScenario) return;
    const deletedName = activeScenario.name;
    setScenarios((current) => current.filter((scenario) => scenario.id !== activeScenario.id));
    setActiveScenarioId("");
    setScenarioMessage(`CenÃ¡rio “${deletedName}” excluÃ­do. Nenhum dado real foi alterado.`);
  }

  function clearActiveScenario(kind: "vehicles" | "materials") {
    if (!activeScenario) return;
    updateActiveScenario((scenario) => ({ ...scenario, [kind]: [] }));
    setScenarioMessage(kind === "vehicles" ? "VeÃ­culos simulados removidos do cenÃ¡rio." : "Demandas simuladas removidas do cenÃ¡rio.");
  }

  function downloadVehicleTemplate() {
    downloadXlsx("Template_MRP_II_Simulacao_Veiculos.xlsx", [
      {
        name: "VEICULOS",
        rows: [["REFERENCIA", "DATA_ENTREGA", "CLIENTE", "DESTINO", "MODELO", "CHASSI", "LINHA", "TRANSFORMACAO", "CONJUNTO_BANCOS", "FORNECEDOR_AR", "TIPO_AR", "ACESSORIO", "PLOTAGEM", "SEQUENCIA", "VIDROS", "A_C", "PREP", "SERRA", "EXPE", "DESMONT", "ELETRICA", "REVEST", "BCO", "ACESSORIO_ETAPA", "PLOTAGEM_ETAPA", "LIBERACAO"]],
      },
      {
        name: "INSTRUCOES",
        rows: [
          ["TEMPLATE DE SIMULACAO DE VEICULOS"],
          ["Preencha uma linha por veÃ­culo simulado. Nenhuma linha desta planilha cria veÃ­culo, O.S., apontamento ou estoque no Supabase."],
          ["DATA_ENTREGA", "ObrigatÃ³ria, no formato dd/mm/aaaa ou aaaa-mm-dd."],
          ["CHASSI", "Opcional. Use uma referÃªncia quando o chassi ainda nÃ£o existir."],
          ["ETAPAS", "Use N (pendente), P (parcial), S (concluÃ­da) ou N/A. N e P geram carga; S e N/A nÃ£o geram carga."],
          ["SEQUENCIA", "Opcional. Se vazio, a ordem segue a sequÃªncia do arquivo."],
        ],
      },
    ]);
  }

  function downloadMaterialTemplate() {
    downloadXlsx("Template_MRP_I_Simulacao_Materiais.xlsx", [
      {
        name: "MATERIAIS",
        rows: [["SKU", "DESCRICAO", "UNIDADE", "DATA_NECESSIDADE", "QUANTIDADE", "OBSERVACAO"]],
      },
      {
        name: "INSTRUCOES",
        rows: [
          ["TEMPLATE DE SIMULACAO DE MATERIAIS"],
          ["Preencha uma linha por necessidade adicional. A simulaÃ§Ã£o somente aparece enquanto o cenÃ¡rio estiver selecionado."],
          ["SKU", "ObrigatÃ³rio. Deve usar o mesmo cÃ³digo do cadastro para consolidar com estoque, trÃ¢nsito e necessidade real."],
          ["DATA_NECESSIDADE", "ObrigatÃ³ria, no formato dd/mm/aaaa ou aaaa-mm-dd."],
          ["QUANTIDADE", "ObrigatÃ³ria e maior que zero."],
        ],
      },
    ]);
  }

  async function importVehicleScenario(file?: File) {
    if (!file || !activeScenario) return;
    try {
      const records = await readXlsxRecords(file, "DATA_ENTREGA");
      const rows = scenarioVehicleRows(records, activeScenario.vehicles.length + 1);
      if (!rows.length) throw new Error("Nenhum veÃ­culo vÃ¡lido foi encontrado. Informe ao menos DATA_ENTREGA.");
      updateActiveScenario((scenario) => ({ ...scenario, vehicles: [...scenario.vehicles, ...rows] }));
      setScenarioMessage(`${rows.length} veÃ­culo(s) simulado(s) incluÃ­do(s) em “${activeScenario.name}”.`);
    } catch (error) {
      setScenarioMessage(error instanceof Error ? error.message : "NÃ£o foi possÃ­vel importar os veÃ­culos simulados.");
    } finally {
      if (vehicleInputRef.current) vehicleInputRef.current.value = "";
    }
  }

  async function importMaterialScenario(file?: File) {
    if (!file || !activeScenario) return;
    try {
      const records = await readXlsxRecords(file, "SKU");
      const rows = scenarioMaterialRows(records);
      if (!rows.length) throw new Error("Nenhuma necessidade vÃ¡lida foi encontrada. Informe SKU, DATA_NECESSIDADE e QUANTIDADE.");
      updateActiveScenario((scenario) => ({ ...scenario, materials: [...scenario.materials, ...rows] }));
      setScenarioMessage(`${rows.length} necessidade(s) de material incluÃ­da(s) em “${activeScenario.name}”.`);
    } catch (error) {
      setScenarioMessage(error instanceof Error ? error.message : "NÃ£o foi possÃ­vel importar os materiais simulados.");
    } finally {
      if (materialInputRef.current) materialInputRef.current.value = "";
    }
  }

  function exportMrpII() {
    const ganttRows = [
      ["PROCESSO", "POSTO", "O.S. / REFERENCIA", "CLIENTE", "ENTREGA", ...ganttDays.map((day) => formatDate(dayKey(day)))],
      ...operations.map((operation) => {
        const days = ganttDays.map((day) => {
          const start = startOfDay(day);
          const end = addDays(start, 1);
          return operation.start < end && operation.end > start ? "■" : "";
        });
        return [operation.stage, `Posto ${operation.operator}`, operation.os, operation.customer, formatDate(operation.dueDate), ...days];
      }),
    ];
    const forecastRows = [
      ["FONTE", "ITEM / O.S.", "CHASSI", "CLIENTE", "LINHA", "TRANSFORMACAO", "DATA ENTREGA", "FIM PROJETADO", "SITUACAO", "CARGA (H)"],
      ...filteredOrders.map((order) => {
        const finish = finishByOrder.get(order.id);
        const orderHours = operations.filter((operation) => operation.orderId === order.id).reduce((total, operation) => total + operation.minutes / 60, 0);
        const late = finish ? finish > parseDate(order.dueDate) : false;
        return [order.source === "SIMULACAO" ? `SIMULACAO: ${activeScenario?.name || ""}` : "SUPABASE / MES", order.item, order.chassis, order.customer, order.line, order.transformation, formatDate(order.dueDate), finish ? formatDateTime(finish) : "Sem carga pendente", late ? "ATRASO PROJETADO" : "NO PRAZO / SEM CARGA", Number(orderHours.toFixed(2))];
      }),
    ];
    downloadXlsx("MRP_II_Previsao_Entregas.xlsx", [
      { name: "Gantt_Capacidade", rows: ganttRows },
      { name: "Previsao_Entregas", rows: forecastRows },
    ]);
  }

  function exportMrpI() {
    if (!mrpIPlan) return;
    const periods = mrpIPlan.weeks;
    const purchaseSummary = [
      ["PERIODO", "SKU", "DESCRICAO", "UN", "SUGERIDO COMPRAR", "DEMANDA REAL O.S.", "FORECAST FIRME", "FORECAST PREDITIVO", "SIMULACAO", "TRANSITO"],
      ...mrpIPlan.rows.flatMap((row) => periods.map((period, index) => {
        const suggested = row.suggested[index] || 0;
        const demand = row.firmByWeek[index] || 0;
        const forecast = row.forecastFirmByWeek[index] || 0;
        const predictive = row.forecastPredictiveByWeek[index] || 0;
        const simulation = row.simulationByWeek[index] || 0;
        const transit = row.incoming[index] || 0;
        if (!suggested && !demand && !forecast && !predictive && !simulation && !transit) return [];
        return [[period.label, row.pn, row.description, row.unit, suggested, demand, forecast, predictive, simulation, transit]];
      }).filter((row) => row.length > 0)),
    ];
    const summaryRows = [
      ["SKU", "DESCRICAO", "UN", "DISPONIVEL", "DEMANDA REAL O.S.", "FORECAST FIRME", "FORECAST PREDITIVO", "SIMULACAO", "TRANSITO", "SUGERIDO COMPRAR", "PRIMEIRO PERIODO"],
      ...mrpIPlan.rows.map((row) => [row.pn, row.description, row.unit, row.available, row.firmDemand, row.forecastFirmDemand, row.forecastPredictiveDemand, row.simulationDemand, row.totalIncoming, row.totalSuggested, row.firstSuggestedWeek || "—"]),
    ];
    downloadXlsx(`MRP_I_Resumo_Compras_${mrpPeriodicity.toLowerCase()}.xlsx`, [
      { name: "Resumo_Compras", rows: summaryRows },
      { name: `${mrpPeriodicity}_Compras`, rows: purchaseSummary },
    ]);
  }

  async function signOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      onSignOut();
    }
  }

  return (
    <main className="app-shell">
      <aside className="app-sidebar" aria-label="Navegação principal">
        <div className="brand-lockup">
          <span className="brand-mark">JI</span>
          <div>
            <strong>JI Montadora</strong>
            <span>PCP · planejamento integrado</span>
          </div>
        </div>

        <nav className="workspace-nav" aria-label="Módulos do MRP">
          <span className="nav-label">Área de trabalho</span>
          {(
            [
              ["overview", "Visão geral", "Cenário e capacidade"],
              ["mrp2", "MRP II", "Programação da fábrica"],
              ["mrp1", "MRP I", "Materiais e compras"],
              ["scenarios", "Cenários", "Simulações e templates"],
              ["settings", "Parâmetros", "WIP real e tempos"],
            ] as Array<[WorkspaceView, string, string]>
          ).map(([view, label, detail]) => (
            <button
              className={activeWorkspace === view ? "nav-item active" : "nav-item"}
              key={view}
              type="button"
              onClick={() => openWorkspace(view)}
            >
              <b>{label}</b>
              <span>{detail}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-status">
          <span>Conectado como</span>
          <strong>{user.username}</strong>
          <small>{user.roles.join(" · ")}</small>
          <button className="sidebar-signout" type="button" onClick={() => void signOut()}>Sair</button>
          <hr />
          <span>Cenário ativo</span>
          <strong>{activeScenario ? activeScenario.name : "Somente operação real"}</strong>
          <small>{horizonDays} dias · {wipSnapshot?.counts.total || 0} O.S. reais no WIP</small>
        </div>
      </aside>

      <div className="app-workspace">
        <header className="app-topbar">
          <div className="topbar-title">
            <span>PCP / {workspaceMeta[activeWorkspace].label}</span>
            <h1>{workspaceMeta[activeWorkspace].title}</h1>
            <p>{workspaceMeta[activeWorkspace].subtitle}</p>
            <small className="topbar-source">
              Carteira operacional: Supabase · WIP MES: {wipSnapshot?.counts.total || 0} O.S.
              {activeScenario ? ` · Cenário: ${activeScenario.name}` : ""}
            </small>
          </div>
          <div className="topbar-actions">
            <button className="tool-button secondary" disabled={wipLoading} type="button" onClick={refreshWip}>
              {wipLoading ? "Atualizando WIP..." : "Atualizar WIP"}
            </button>
          </div>
        </header>

        <div className="app-content">

      <section id="overview" hidden={activeWorkspace !== "overview"} className="workspace-section scenario-section mx-auto grid max-w-7xl gap-4 px-5 py-5 lg:grid-cols-[1.05fr_1.95fr]">
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
                aria-invalid={calendarWarning ? "true" : "false"}
                onChange={(event) =>
                  setCalendar({ ...calendar, dayStart: event.target.value })
                }
              />
            </label>
            <label>
              Saída
              <input
                type="time"
                value={calendar.dayEnd}
                aria-invalid={calendarWarning ? "true" : "false"}
                onChange={(event) =>
                  setCalendar({ ...calendar, dayEnd: event.target.value })
                }
              />
            </label>
            <label>
              Almoço início
              <input
                type="time"
                value={calendar.lunchStart}
                aria-invalid={calendarWarning ? "true" : "false"}
                onChange={(event) =>
                  setCalendar({ ...calendar, lunchStart: event.target.value })
                }
              />
            </label>
            <label>
              Almoço fim
              <input
                type="time"
                value={calendar.lunchEnd}
                aria-invalid={calendarWarning ? "true" : "false"}
                onChange={(event) =>
                  setCalendar({ ...calendar, lunchEnd: event.target.value })
                }
              />
            </label>
            <label>
              Horizonte (dias)
              <input
                min="1"
                max="365"
                step="1"
                type="number"
                value={horizonDays}
                onChange={(event) =>
                  setCalendar({
                    ...calendar,
                    horizonDays: Math.max(
                      1,
                      Math.min(365, Math.floor(Number(event.target.value) || 10))
                    ),
                  })
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
          {calendarWarning ? <div className="calendar-warning">{calendarWarning}</div> : null}
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
          <div className="calendar-editor">
            <div className="calendar-editor-head">
              <button type="button" onClick={() => shiftCalendarMonth(-1)}>
                ‹
              </button>
              <strong>
                {monthName(calendar.calendarMonth)} {calendar.calendarYear}
              </strong>
              <button type="button" onClick={() => shiftCalendarMonth(1)}>
                ›
              </button>
            </div>
            <div className="form-grid compact">
              <label>
                Mês
                <select
                  value={calendar.calendarMonth}
                  onChange={(event) =>
                    setCalendar({ ...calendar, calendarMonth: Number(event.target.value) })
                  }
                >
                  {Array.from({ length: 12 }, (_, index) => (
                    <option key={index} value={index}>
                      {monthName(index)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Ano
                <input
                  type="number"
                  min="2026"
                  max="2040"
                  value={calendar.calendarYear}
                  onChange={(event) =>
                    setCalendar({ ...calendar, calendarYear: Number(event.target.value) })
                  }
                />
              </label>
            </div>
            <div className="calendar-weeknames">
              {["D", "S", "T", "Q", "Q", "S", "S"].map((day, index) => (
                <span key={`${day}-${index}`}>{day}</span>
              ))}
            </div>
            <div className="calendar-month-grid">
              {selectedMonthDates.map((date) => {
                const key = dayKey(date);
                const inMonth = date.getMonth() === calendar.calendarMonth;
                const regularOff = !calendar.workingDays.includes(date.getDay());
                const explicitOff = holidayDates.has(key);
                const productive = inMonth && !regularOff && !explicitOff;
                return (
                  <button
                    key={key}
                    type="button"
                    className={[
                      "calendar-day",
                      inMonth ? "" : "muted",
                      productive ? "productive" : "off",
                      explicitOff ? "explicit" : "",
                    ].join(" ")}
                    onClick={() => inMonth && toggleHoliday(date)}
                  >
                    <span>{date.getDate()}</span>
                  </button>
                );
              })}
            </div>
            <div className="calendar-summary">
              <span>{(productiveMinutesPerDay(calendar) / 60).toFixed(1)}h produtivas/dia</span>
              <span>{monthlyStops} dias sem produção no mês</span>
            </div>
          </div>
          <label className="switch-row">
            <input
              type="checkbox"
              checked={calendar.completeFlow}
              onChange={(event) =>
                setCalendar({ ...calendar, completeFlow: event.target.checked })
              }
            />
            Simular fluxo completo em vez de somente pendências apontadas
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
            <span>Operadores informados</span>
            <strong>{informedOperators}</strong>
            <small>{totalHours.toFixed(1)}h carregadas | necessário: {requiredOperators}</small>
          </div>
          <div className="metric accent-orange">
            <span>Gargalo</span>
            <strong>{bottleneck?.stage ?? "-"}</strong>
            <small>
              {bottleneck
                ? `${Math.round(bottleneck.load * 100)}% de carga | op. ${bottleneck.operators}`
                : "-"}
            </small>
          </div>
        </div>
      </section>

      <section id="scenarios" hidden={activeWorkspace !== "scenarios"} className="workspace-section mx-auto grid max-w-[1200px] gap-4 px-5 py-5">
        <div className="panel wide">
          <div className="section-head">
            <div>
              <h2>Cenários de simulação</h2>
              <span>Dados locais e descartáveis. A carteira real, estoque, trânsito e O.S. continuam em leitura direta do Supabase.</span>
            </div>
          </div>
          <div className="scenario-toolbar">
            <label>
              Nome do novo cenário
              <input value={scenarioName} onChange={(event) => setScenarioName(event.target.value)} placeholder="Ex.: Projeção Setembro / Licitação X" />
            </label>
            <button className="button primary" type="button" onClick={createScenario}>+ Criar cenário</button>
            <label>
              Cenário aplicado no MRP
              <select value={activeScenarioId} onChange={(event) => setActiveScenarioId(event.target.value)}>
                <option value="">Somente operação real (Supabase)</option>
                {scenarios.map((scenario) => <option key={scenario.id} value={scenario.id}>{scenario.name}</option>)}
              </select>
            </label>
            <button className="button danger" disabled={!activeScenario} type="button" onClick={deleteActiveScenario}>Excluir cenário</button>
          </div>
          {scenarioMessage ? <p className="mrp-data-state">{scenarioMessage}</p> : null}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <article className="panel">
            <div className="section-head">
              <div>
                <h2>Simular entrada de veículos</h2>
                <span>Acrescenta carros hipotéticos ao MRP II para enxergar carga, capacidade e previsão de entrega.</span>
              </div>
            </div>
            <ol className="scenario-steps">
              <li>Baixe o template de veículos.</li>
              <li>Informe uma referência, data de entrega e as etapas previstas.</li>
              <li>Selecione um cenário e importe o arquivo.</li>
            </ol>
            <div className="button-row">
              <button className="button secondary" type="button" onClick={downloadVehicleTemplate}>Baixar template de veículos</button>
              <input ref={vehicleInputRef} accept=".xlsx" hidden type="file" onChange={(event) => void importVehicleScenario(event.target.files?.[0])} />
              <button className="button primary" disabled={!activeScenario} type="button" onClick={() => vehicleInputRef.current?.click()}>Importar veículos</button>
              <button className="button danger-outline" disabled={!activeScenario?.vehicles.length} type="button" onClick={() => clearActiveScenario("vehicles")}>Limpar veículos</button>
            </div>
            <p className="scenario-count"><strong>{activeScenario?.vehicles.length || 0}</strong> veículo(s) simulados no cenário selecionado.</p>
          </article>

          <article className="panel">
            <div className="section-head">
              <div>
                <h2>Simular demanda de materiais</h2>
                <span>Acrescenta necessidades locais ao MRP I, separadas de O.S., Forecast real, estoque e trânsito.</span>
              </div>
            </div>
            <ol className="scenario-steps">
              <li>Baixe o template de materiais.</li>
              <li>Use o SKU real, data de necessidade e quantidade.</li>
              <li>Importe dentro do cenário selecionado.</li>
            </ol>
            <div className="button-row">
              <button className="button secondary" type="button" onClick={downloadMaterialTemplate}>Baixar template de materiais</button>
              <input ref={materialInputRef} accept=".xlsx" hidden type="file" onChange={(event) => void importMaterialScenario(event.target.files?.[0])} />
              <button className="button primary" disabled={!activeScenario} type="button" onClick={() => materialInputRef.current?.click()}>Importar materiais</button>
              <button className="button danger-outline" disabled={!activeScenario?.materials.length} type="button" onClick={() => clearActiveScenario("materials")}>Limpar materiais</button>
            </div>
            <p className="scenario-count"><strong>{activeScenario?.materials.length || 0}</strong> necessidade(s) simulada(s) no cenário selecionado.</p>
          </article>
        </div>

        <div className="panel wide">
          <div className="section-head">
            <h2>Regras de segurança</h2>
            <span>O cenário não emite O.C., não reserva material, não cria O.S. e não movimenta estoque.</span>
          </div>
          <div className="mrp-source-strip">
            <span>Base padrão: Supabase</span>
            <span>Simulação: somente quando selecionada</span>
            <span>Exclusão: remove apenas dados locais do cenário</span>
          </div>
        </div>
      </section>

      <section id="mrp1" hidden={activeWorkspace !== "mrp1"} className="workspace-section mrp-material-section mx-auto grid w-full max-w-[1600px] gap-4 px-5 pb-5">
        <div className="panel wide mrp-panel">
          <div className="section-head mrp-head">
            <div>
              <h2>MRP I | Necessidade líquida de materiais</h2>
              <span>
                {mrpSnapshot
                  ? `${mrpFilteredRows.length} de ${mrpIPlan?.rows.length ?? 0} materiais | ${mrpHorizonDays} dias a partir de ${formatDate(getStartDate(calendar))} | atualizado ${new Intl.DateTimeFormat("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(new Date(mrpSnapshot.generatedAt))}`
                  : "Aguardando a leitura do Supabase"}
              </span>
            </div>
            <div className="mrp-controls">
              <label>
                Busca
                <input
                  type="search"
                  value={mrpSearch}
                  onChange={(event) => setMrpSearch(event.target.value)}
                  placeholder="PN ou descricao"
                />
              </label>
              <label>
                Reserva de segurança
                <input
                  min="0"
                  max="3"
                  step="0.25"
                  type="number"
                  value={mrpSafetyFactor}
                  onChange={(event) =>
                    setMrpSafetyFactor(Math.max(0, Number(event.target.value) || 0))
                  }
                />
              </label>
              <label>
                Visão
                <select value={mrpPeriodicity} onChange={(event) => {
                  const periodicity = event.target.value as MrpPeriodicity;
                  setMrpPeriodicity(periodicity);
                }}>
                  <option value="DIA">Dias</option>
                  <option value="SEMANA">Semanas</option>
                  <option value="MES">Meses</option>
                </select>
              </label>
              <label>
                Horizonte (dias)
                <input min="1" max="365" type="number" value={mrpHorizonDays} onChange={(event) => setMrpHorizonDays(Math.max(1, Math.min(365, Math.floor(Number(event.target.value) || 1))))} />
              </label>
              <button className="button secondary" type="button" onClick={refreshMrpI} disabled={mrpLoading}>
                {mrpLoading ? "Atualizando..." : "Atualizar dados"}
              </button>
              <button className="button primary" type="button" disabled={!mrpIPlan} onClick={exportMrpI}>Exportar compras</button>
            </div>
          </div>

          <div className="mrp-kpis">
            <div>
              <span>Necessidade O.S.</span>
              <strong>{formatQuantity(mrpVisibleSummary.firmDemand)}</strong>
            </div>
            <div>
              <span>Forecast firme</span>
              <strong>{formatQuantity(mrpVisibleSummary.forecastFirmDemand)}</strong>
            </div>
            <div>
              <span>Forecast preditivo</span>
              <strong>{formatQuantity(mrpVisibleSummary.forecastPredictiveDemand)}</strong>
            </div>
            <div>
              <span>Simulação local</span>
              <strong>{formatQuantity(mrpVisibleSummary.simulationDemand)}</strong>
            </div>
            <div>
              <span>Compras em trânsito</span>
              <strong>{formatQuantity(mrpVisibleSummary.incoming)}</strong>
            </div>
            <div>
              <span>Sugestão de compra</span>
              <strong>{formatQuantity(mrpVisibleSummary.suggested)}</strong>
            </div>
            <div>
              <span>Itens com déficit</span>
              <strong>{mrpVisibleSummary.shortages}</strong>
            </div>
          </div>

          <div className="mrp-source-strip">
            <span>Exibindo: {mrpRows.length === mrpFilteredRows.length ? mrpRows.length : `${mrpRows.length} de ${mrpFilteredRows.length}`} linha(s)</span>
            <span>O.S. abertas: {mrpSnapshot?.counts.activeWorkOrders ?? 0}</span>
            <span>Linhas líquidas de O.S.: {mrpSnapshot?.counts.firmDemandLines ?? 0}</span>
            <span>Linhas de trânsito: {mrpSnapshot?.counts.transitLines ?? 0}</span>
            <span>Forecast firme: {mrpSnapshot?.counts.forecastFirmLines ?? 0}</span>
            <span>Forecast preditivo: {mrpSnapshot?.counts.forecastPredictiveLines ?? 0}</span>
            <span>Simulação local: {activeScenario?.materials.length || 0} linha(s)</span>
            <span>Leitura somente: não cria compra, reserva ou movimento</span>
          </div>

          {mrpSnapshot?.warnings.map((warning) => (
            <p className="mrp-warning" key={warning}>{warning}</p>
          ))}
          {!mrpSnapshot ? <p className="mrp-data-state">{mrpLoadMessage}</p> : null}

          <div className="table-wrap mrp-table-wrap">
            <table className="mrp-table">
              <thead>
                <tr>
                  <th>PN</th>
                  <th>Material</th>
                  <th>UN</th>
                  <th>Disp.</th>
                  <th>O.S. firme</th>
                  <th>Forecast firme</th>
                  <th>Forecast preditivo</th>
                  <th>Simulação</th>
                  <th>Trânsito</th>
                  <th>Comprar</th>
                  <th>{mrpPeriodicity === "DIA" ? "Dias" : mrpPeriodicity === "MES" ? "Meses" : "Semanas"}</th>
                </tr>
              </thead>
              <tbody>
                {mrpRows.map((row) => (
                  <tr key={row.pn}>
                    <td>
                      <strong>{row.pn}</strong>
                    </td>
                    <td>
                      {row.description}
                      <small>Necessidade líquida, já coberta por empenhos e baixas vinculados</small>
                    </td>
                    <td>{row.unit}</td>
                    <td>{formatQuantity(row.available)}</td>
                    <td>{formatQuantity(row.firmDemand)}</td>
                    <td>{formatQuantity(row.forecastFirmDemand)}</td>
                    <td>{formatQuantity(row.forecastPredictiveDemand)}</td>
                    <td>{formatQuantity(row.simulationDemand)}</td>
                    <td>{formatQuantity(row.totalIncoming)}</td>
                    <td className={row.totalSuggested > 0 ? "need-cell" : ""}>
                      {formatQuantity(row.totalSuggested)}
                      <small>{row.firstSuggestedWeek ? `déficit ${row.firstSuggestedWeek}` : "sem déficit"}</small>
                    </td>
                    <td>
                      <div className="mrp-week-strip">
                        {(mrpIPlan?.weeks ?? []).map((week, index) => (
                          <span
                            className={[
                              "mrp-week-chip",
                              row.projected[index] < 0 ? "negative" : "",
                              row.suggested[index] > 0 ? "buy" : "",
                            ].join(" ")}
                            key={`${row.pn}-${week.key}`}
                            title={`${week.label} | O.S. ${formatQuantity(
                              row.firmByWeek[index]
                            )} | Forecast firme ${formatQuantity(row.forecastFirmByWeek[index])} | Forecast preditivo ${formatQuantity(
                              row.forecastPredictiveByWeek[index]
                            )} | Simulação ${formatQuantity(
                              row.simulationByWeek[index]
                            )} | trânsito ${formatQuantity(row.incoming[index])} | saldo ${formatQuantity(
                              row.projected[index]
                            )} | comprar ${formatQuantity(row.suggested[index])}`}
                          >
                            <b>{week.label}</b>
                            <em>{formatQuantity(row.projected[index])}</em>
                            {row.suggested[index] > 0 ? (
                              <small>+{formatQuantity(row.suggested[index])}</small>
                            ) : null}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section id="mrp2" hidden={activeWorkspace !== "mrp2"} className="workspace-section mx-auto grid max-w-[1600px] gap-4 px-5 pb-5">
        <div className="panel wide cm25-panel">
          <div className="section-head cm25-head">
            <div>
              <h2>MRP II | Programação e capacidade</h2>
              <span>
                Janela de {planningHorizonDays(calendar)} dias: {formatDateTime(getStartDate(calendar))} até {formatDateTime(ganttWindowEnd)}
              </span>
            </div>
            <div className="cm25-legend" aria-label="Legenda do Gantt">
              <b>CM25</b>
              <span>Barra = operação produtiva</span>
              <span className="legend-flow">continuidade da operação</span>
              <span className="legend-off">Sem produção</span>
              <span className="legend-lunch">Almoço</span>
              <span className="legend-late">Atraso</span>
            </div>
          </div>

          <div className="mrp-source-strip" aria-live="polite">
            <strong>WIP do MES</strong>
            <span>{wipSnapshot?.counts.total || 0} O.S. em processo</span>
            <span>{wipSnapshot?.counts.patio || 0} em pátio</span>
            <span>{wipSnapshot?.counts.production || 0} em produção</span>
            <span>{activeScenario ? `${activeScenario.vehicles.length} veículo(s) do cenário` : "sem veículos simulados"}</span>
            <span>Sequência persistida do MES preservada</span>
            <span>S e N/A não geram carga; P considera apenas a carga restante.</span>
            <button className="button secondary" disabled={wipLoading} type="button" onClick={refreshWip}>
              {wipLoading ? "Atualizando..." : "Atualizar WIP"}
            </button>
            <button className="button primary" type="button" onClick={exportMrpII}>Exportar previsão de entregas</button>
          </div>
          {!wipSnapshot ? <div className="mrp-data-state">{wipLoadMessage}</div> : null}
          {wipSnapshot?.warnings.length ? (
            <div className="mrp-data-state">{wipSnapshot.warnings.join(" · ")}</div>
          ) : null}

          <div className="cm25-scroll" role="region" aria-label="Gantt com datas e processos">
            <div
              className="cm25-grid"
              style={{ gridTemplateColumns: `230px ${ganttScale.width}px` }}
            >
              <div className="cm25-corner">
                <strong>Processo / posto</strong>
                <span>Carga / operações</span>
              </div>
              <div
                className="cm25-timeline-head"
                style={{
                  width: `${ganttScale.width}px`,
                }}
              >
                <div
                  className="cm25-week-row"
                  style={{
                    gridTemplateColumns: ganttWeekGroups
                      .map((group) => `${group.days * ganttScale.dayWidth}px`)
                      .join(" "),
                  }}
                >
                  {ganttWeekGroups.map((group) => (
                    <div className="cm25-week" key={group.key}>
                      {group.label}
                    </div>
                  ))}
                </div>
                <div
                  className="cm25-day-row"
                  style={{ gridTemplateColumns: `repeat(${ganttDays.length}, ${ganttScale.dayWidth}px)` }}
                >
                  {ganttDays.map((day) => (
                    <div
                      className={isWorkingDay(day, calendar) ? "cm25-day" : "cm25-day off"}
                      key={dayKey(day)}
                    >
                      <strong>{formatDayHeader(day)}</strong>
                      <span>{isWorkingDay(day, calendar) ? "produtivo" : "sem produção"}</span>
                    </div>
                  ))}
                </div>
                <div
                  className="cm25-hour-row"
                  style={{ gridTemplateColumns: `repeat(${ganttDays.length}, ${ganttScale.dayWidth}px)` }}
                >
                  {ganttDays.map((day) => (
                    <div
                      className={isWorkingDay(day, calendar) ? "cm25-hour-day" : "cm25-hour-day off"}
                      key={`hours-${dayKey(day)}`}
                    >
                      {isWorkingDay(day, calendar) ? (
                        ganttHourMarks.map((hour) => {
                          const start = timeToMinutes(calendar.dayStart);
                          const end = timeToMinutes(calendar.dayEnd);
                          const left = ((timeToMinutes(hour) - start) / Math.max(1, end - start)) * 100;
                          return <span key={`${dayKey(day)}-${hour}`} style={{ left: `${Math.max(0, Math.min(100, left))}%` }}>{hour}</span>;
                        })
                      ) : (
                        <span>parado</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {ganttLanes.map((lane) => {
                const laneOps = operations.filter(
                  (operation) =>
                    operation.stage === lane.stage && operation.operator === lane.operator
                );
                const laneHours = laneOps.reduce(
                  (total, operation) => total + operation.minutes / 60,
                  0
                );
                return (
                  <div className="cm25-row-shell" key={lane.key}>
                    <button
                      type="button"
                      className={lane.stage === selectedStage ? "cm25-process selected" : "cm25-process"}
                      onClick={() => setSelectedStage(lane.stage)}
                    >
                      <strong>{lane.stage} {lane.operator}</strong>
                      <span>Posto {lane.operator} · {laneHours.toFixed(1)}h · {laneOps.length} ops</span>
                    </button>
                    <div
                      className="cm25-track"
                      style={{
                        width: `${ganttScale.width}px`,
                        backgroundSize: `${ganttScale.dayWidth}px 100%, 100% 100%`,
                      }}
                    >
                      {ganttDays.map((day, index) => {
                        if (isWorkingDay(day, calendar)) return null;
                        return (
                          <span
                            aria-hidden="true"
                            className="cm25-off-column"
                            key={`off-${lane.key}-${dayKey(day)}`}
                            style={{ left: `${index * ganttScale.dayWidth}px`, width: `${ganttScale.dayWidth}px` }}
                          />
                        );
                      })}
                      {ganttDays.map((day) => {
                        if (!isWorkingDay(day, calendar)) return null;
                        const lunchStart = timeToMinutes(calendar.lunchStart);
                        const lunchEnd = timeToMinutes(calendar.lunchEnd);
                        if (lunchEnd <= lunchStart) return null;
                        const lunchStartDate = setTimeFromMinutes(day, lunchStart);
                        const lunchEndDate = setTimeFromMinutes(day, lunchEnd);
                        const left =
                          ((lunchStartDate.getTime() - ganttScale.start.getTime()) /
                            ganttScale.span) *
                          ganttScale.width;
                        const width =
                          ((lunchEndDate.getTime() - lunchStartDate.getTime()) /
                            ganttScale.span) *
                          ganttScale.width;
                        return (
                          <span
                            aria-hidden="true"
                            className="cm25-lunch-column"
                            key={`lunch-${lane.key}-${dayKey(day)}`}
                            style={{
                              left: `${Math.max(0, left)}px`,
                              width: `${Math.max(4, width)}px`,
                            }}
                          />
                        );
                      })}
                      {ganttDays.flatMap((day, dayIndex) => {
                        if (!isWorkingDay(day, calendar)) return [];
                        const dayStart = timeToMinutes(calendar.dayStart);
                        const dayEnd = timeToMinutes(calendar.dayEnd);
                        return ganttHourMarks.map((hour) => {
                          const minute = timeToMinutes(hour);
                          const withinDay = ((minute - dayStart) / Math.max(1, dayEnd - dayStart)) * ganttScale.dayWidth;
                          return (
                            <span
                              aria-hidden="true"
                              className="cm25-time-tick"
                              key={`tick-${lane.key}-${dayKey(day)}-${hour}`}
                              style={{ left: `${dayIndex * ganttScale.dayWidth + Math.max(0, Math.min(ganttScale.dayWidth, withinDay))}px` }}
                            />
                          );
                        });
                      })}
                      {laneOps.map((operation) => {
                        const left = ((operation.start.getTime() - ganttScale.start.getTime()) / ganttScale.span) * ganttScale.width;
                        const width = ((operation.end.getTime() - operation.start.getTime()) / ganttScale.span) * ganttScale.width;
                        return (
                          <span
                            aria-hidden="true"
                            className="cm25-operation-flow"
                            key={`flow-${operation.id}`}
                            style={{ left: `${Math.max(0, left)}px`, width: `${Math.max(3, width)}px`, borderColor: stageColors[lane.stage] }}
                          />
                        );
                      })}
                      {laneOps
                        .flatMap((operation) => {
                          const segments = productiveSegments(operation.start, operation.end, calendar);
                          return segments.map((segment, index) => ({
                            operation,
                            segment,
                            primary: index === 0,
                            final: index === segments.length - 1,
                          }));
                        })
                        .map(({ operation, segment, primary, final }) => {
                          const left =
                            ((segment.start.getTime() - ganttScale.start.getTime()) /
                              ganttScale.span) *
                            ganttScale.width;
                          const width =
                            ((segment.end.getTime() - segment.start.getTime()) /
                              ganttScale.span) *
                            ganttScale.width;
                          const late = operation.end > parseDate(operation.dueDate);
                          const showLabel = (primary && width >= 52) || width >= 104;
                          return (
                            <button
                              className={[
                                "cm25-op",
                                "segmented",
                                width < 68 ? "compact" : "",
                                primary ? "starts-operation" : "",
                                final ? "ends-operation" : "",
                                late ? "late" : "",
                              ].filter(Boolean).join(" ")}
                              key={`${operation.id}-${segment.start.toISOString()}`}
                              type="button"
                              onClick={() => setSelectedStage(lane.stage)}
                              style={{
                                left: `${Math.max(0, left)}px`,
                                width: `${Math.max(3, width)}px`,
                                backgroundColor: stageColors[lane.stage],
                              }}
                              title={`${operation.stage} | O.S. ${operation.os} | Pedido ${operation.item} | ${
                                operation.customer
                              } | trecho produtivo ${formatDateTime(segment.start)} até ${formatDateTime(
                                segment.end
                              )} | total produtivo ${formatDuration(operation.minutes)} | entrega ${formatDate(operation.dueDate)}`}
                            >
                              {showLabel ? (
                                <>
                                  <strong>{operation.os}</strong>
                                  <span>#{operation.item} · OP{operation.operator} · prod. {formatDuration(operation.minutes)}</span>
                                </>
                              ) : null}
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
              <span>{stageDependencyLabel(selectedStage)}</span>
              <span>Operações planejadas em ordem de início</span>
            </div>
            <div className="cm25-detail-list">
              {selectedOperations.slice(0, 8).map((operation) => {
                const late = operation.end > parseDate(operation.dueDate);
                return (
                  <span className={late ? "detail-chip late" : "detail-chip"} key={operation.id}>
                    <b>O.S {operation.os}</b>
                    #{operation.item} · OP{operation.operator} · prod. {formatDuration(operation.minutes)} · {formatDateTime(operation.start)} - {formatDateTime(operation.end)}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        <div className="panel capacity-panel">
          <div className="section-head">
            <h2>Capacidade</h2>
            <span>{horizonDays} dias corridos desde {weekLabel(getStartDate(calendar))}, descontando paradas</span>
          </div>
          <div className="capacity-list">
            {capacity.map((row) => (
              <article
                key={row.stage}
                className={row.stage === selectedStage ? "capacity-row selected" : "capacity-row"}
              >
                <button type="button" onClick={() => setSelectedStage(row.stage)}>
                  <span>{row.stage}</span>
                  <small>{row.hours.toFixed(1)}h carga</small>
                </button>
                <label>
                  Oper.
                  <input
                    min="1"
                    max="50"
                    type="number"
                    value={row.operators}
                    onChange={(event) => updateOperators(row.stage, event.target.value)}
                  />
                </label>
                <i>
                  <span style={{ width: `${Math.min(100, row.load * 100)}%` }} />
                </i>
                <em>{Math.round(row.load * 100)}%</em>
                <strong className={row.requiredOperators > row.operators ? "labor-alert" : ""}>
                  Necessário: {row.requiredOperators}
                </strong>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="settings" hidden={activeWorkspace !== "settings"} className="workspace-section mx-auto grid max-w-7xl gap-4 px-5 pb-5 xl:grid-cols-[1.35fr_1.05fr]">
        <div className="panel wide">
          <div className="section-head">
            <h2>Carteira de O.S.</h2>
            <span>Supabase / MES {activeScenario ? `+ cenário ${activeScenario.name}` : ""}</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Fonte</th>
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
                        <span className="status">{order.source === "SIMULACAO" ? "SIMULAÇÃO" : "WIP · MES"}</span>
                        <small>{order.status}</small>
                      </td>
                      <td>
                        {order.customer}
                        <small>{order.model}</small>
                      </td>
                      <td>{order.line || "—"}</td>
                      <td>{order.dueDate ? formatDate(order.dueDate) : "—"}</td>
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
            <h2>Tempos padrão por mix</h2>
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
        </div>
      </div>
    </main>
  );
}

function countWorkingDays(start: Date, end: Date, calendar: CalendarConfig) {
  const cursor = new Date(start);
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
