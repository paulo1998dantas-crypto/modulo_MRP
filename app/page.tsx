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
  dayEnd: string;
  lunchStart: string;
  lunchEnd: string;
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

const STATE_VERSION = "operators-capacity-2026-07-22";

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
  startDate: "2026-07-22",
  dayStart: "07:30",
  dayEnd: "17:18",
  lunchStart: "12:00",
  lunchEnd: "13:00",
  workingDays: [1, 2, 3, 4, 5],
  holidays: "2026-07-25",
  calendarYear: 2026,
  calendarMonth: 6,
  operators: initialOperators,
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

const uploadedSequenceRows: UploadSequenceRow[] = [
  ["SA001849", "Citroën Jumpy Vitrê", "LE", "GE", "CJ BANCOS REC- LE - 3,3 - 3P - COURVIN PRETO/BOOMERANG/LINHA PRETA - E/S/ J - EXECUTIVO", "MADEIREIRA SANTA RITA", "ITU", "2026-07-20", "N/A", "S", "S", "N/A", "S", "S", "N", "S", "S", "N/A", "N/A", "N"],
  ["VE279701", "Mercedes-Benz Sprinter 417 10,5 m³", "LB", "CLIM", "CJ BANCOS FIXOS - MC - LB - 4,3,3,2-1 - 2P - TECIDO - TRILHO - ELEVITTA", "BELISA", "JARDIM DO SERIDÓ (CIOP - ITEM 04)", "2026-07-20", "S", "S", "S", "S", "S", "S", "S", "S", "?", "N", "N/A", "N"],
  ["TA004006", "Citroën Jumpy Furgão", "LB", "GE", "CJ. BANCOS REC - LB - 3,2,3 - REC - 3P - TECIDO - EXPERT", "GAMMAPAR NEGOCIOS", "PORTO RICO", "2026-07-20", "S", "S", "S", "N/A", "S", "S", "N", "S", "S", "N/A", "N", "N"],
  ["TU021788", "Ford Transit L3H2 vitrê", "LB", "GE", "CJ BANCOS FIXOS - MC - LB - 4,3 - 2P - TECIDO", "SANTA CATARINA", "CHAPECO", "2026-07-20", "N/A", "S", "S", "N/A", "S", "S", "N", "S", "N", "N/A", "N/A", "N"],
  ["TU021789", "Ford Transit L3H2 vitrê", "LB", "GE", "CJ BANCOS FIXOS - MC - LB - 4,3 - 2P - TECIDO", "SANTA CATARINA", "CHAPECO", "2026-07-20", "N/A", "S", "S", "N/A", "S", "S", "N", "S", "?", "N/A", "N/A", "N"],
  ["TU020681", "Ford Transit L3H2 vitrê", "LB", "GE", "CJ BANCOS FIXOS - MC - LB - 4,3 - 2P - TECIDO", "SANTA CATARINA", "CHAPECO", "2026-07-20", "N/A", "S", "S", "N/A", "S", "S", "N", "S", "N", "N/A", "N/A", "N"],
  ["TA004277", "Citroën Jumpy Vitrê", "LE", "GE", "CJ BANCOS REC- LE - 3,2 - 3P - COURVIN PRETO/DIAMANTE/LINHA PRETA - E/S/ J - EXECUTIVO", "STELUTI", "SÃO PAULO", "2026-07-20", "N/A", "S", "S", "N/A", "N", "S", "N", "S", "N", "N", "N/A", "N"],
  ["TA007830", "Fiat Scudo Vitrê", "LE", "GE", "CJ BANCOS REC- LE - 3,3 - 3P - COURVIN PRETO/CINZA/DIAMANTE/LINHA CINZA - E/S/ J - EXECUTIVO", "MARILDA AVIAMENTOS", "IBITINGA", "2026-07-21", "N/A", "S", "S", "N/A", "S", "S", "N", "S", "S", "N/A", "N/A", "N"],
  ["VE277832", "Mercedes-Benz Sprinter 417 14 m³", "LB", "CLIM", "CJ BANCOS REC - MC - LB - 4,2,3,3,2-1 - 2P - TECIDO - ELEVITTA - TRILHO", "BELISA", "SÃO ROQUE DO CANAÃ (ADESÃO CISAVH ITEM 8)", "2026-07-22", "S", "N", "N", "N", "N", "N", "N", "N", "N", "N", "N/A", "N"],
  ["VE278661", "Mercedes-Benz Sprinter 517 15,5 m³", "LB", "CLIM", "CJ BANCOS FIXOS - MC - LB - 4,2-1,2,3,3,2-1 - 2P - TECIDO - ELEVITTA - TRILHO", "BELISA", "PONTO DOS VOLANTES (CISARP ITEM 23)", "2026-07-23", "S", "?", "S", "N", "N", "S", "N", "N", "N", "N", "N/A", "N"],
  ["VE281116", "Mercedes-Benz Sprinter 517 15,5 m³", "LB", "CLIM", "CJ BANCOS FIXOS - MC - LB - 4,2-1,2,3,3,3 - 2P - TECIDO - TRILHO", "BELISA", "BELA CRUZ (ADESAO CISARP ITEM 22)", "2026-07-24", "N", "?", "S", "N", "N", "N", "N", "N", "N", "N", "N/A", "N"],
  ["VE280965", "Mercedes-Benz Sprinter 417 14 m³", "LB", "CLIM", "CJ BANCOS FIXOS - MC - LB - 4,3,3,3,4 - 3P - TECIDO - NORMAL", "LIZARD", "CONGONHAS", "2026-07-24", "S", "N", "S", "N/A", "N", "N", "N", "N", "N", "N/A", "N/A", "N"],
  ["VE281194", "Mercedes-Benz Sprinter 517 15,5 m³", "LB", "CLIM", "CJ BANCOS FIXOS - MC - LB - 4,2-1,2,3,3,2-1 - 2P - TECIDO - ELEVITTA - TRILHO", "BELISA", "MONTE SANTO DE MINAS (ADESÃO CISARP ITEM 23)", "2026-07-24", "N", "?", "S", "N", "N", "N", "N", "N", "N", "N", "N/A", "N"],
  ["TA008272", "Fiat Scudo Vitrê", "LE", "GE", "CJ BANCOS REC- LE - 3,3 - 3P - COURVIN PRETO/CINZA/DIAMANTE/LINHA CINZA - E/S/ J - EXECUTIVO", "RTR", "SÃO PAULO", "2026-07-24", "N/A", "S", "S", "N/A", "N", "N", "N", "N", "N", "N", "N/A", "N"],
  ["TA008271", "Fiat Scudo Vitrê", "LE", "GE", "CJ BANCOS REC- LE - 3,3 - 3P - COURVIN PRETO/CINZA/DIAMANTE/LINHA CINZA - E/S/ J - EXECUTIVO", "RTR", "SÃO PAULO", "2026-07-24", "N/A", "S", "S", "N/A", "N", "N", "N", "N", "N", "N", "N/A", "N"],
  ["VE278805", "Mercedes-Benz Sprinter 517 15,5 m³", "LB", "CLIM", "CJ BANCOS FIXOS - MC - LB - 4,2-1,2,3,3,2-1 - 2P - TECIDO - ELEVITTA - TRILHO", "BELISA", "SÃO ROQUE DO CANAÃ (CISARP ITEM 23)", "2026-07-24", "S", "?", "S", "N", "N", "S", "N", "N", "N", "N", "N/A", "N"],
  ["TE277239", "Mercedes-Benz Sprinter 417 14 m³", "LB", "CLIM", "CJ BANCOS REC - MC - LB - 4;2;3;3;3 - 2P - TECIDO - TRILHO", "BELISA", "SÃO ROQUE DO CANAÃ (ADESÃO CISAVH ITEM 7)", "2026-07-25", "S", "N", "N", "N", "N", "N", "N", "N", "N", "N", "N/A", "N"],
  ["TA005694", "Citroën Jumper Furgão", "LB", "CLIM", "CJ BANCOS REC - MC - LB - 4,3,2,2-1 - 2P - TECIDO - PME 2A - BJD - FOCA", "FRP", "SÃO JOÃO DO OESTE", "2026-07-26", "S", "S", "N", "N", "N", "N", "N", "N", "N", "N", "N/A", "N"],
  ["VE277821", "Mercedes-Benz Sprinter 417 14 m³", "LB", "CLIM", "CJ BANCOS FIXOS - LB - 1 E, 1 E, 1 E, 1 D - FIXO - 2P - TEIDO - NORMAL", "BELISA", "NOVA PONTE (CRAVINHOS - ITEM 08)", "2026-07-31", "S", "?", "S", "N", "N", "S", "N", "N", "N", "N", "N/A", "N"],
  ["VJ666369", "Renault Master L3H2", "LB", "GE", "CJ BANCOS FIXOS - MC - LB - 4,3,3,3 - 3P - TECIDO - NORMAL", "ASSOC. PROP. RES. PORTO SÃO PEDRO", "PORTO FELIZ", "2026-07-31", "S", "N", "S", "N/A", "S", "S", "N", "S", "S", "N/A", "N/A", "N"],
  ["TA009754", "Citroën Jumpy Furgão", "LE", "GE", "CJ BANCOS REC- LE - 3,3 - 3P - COURVIN PRETO/DIAMANTE/LINHA BRANCA - E/S/ J - EXECUTIVO", "PJ MOBILIDADE", "SÃO PAULO", "2026-08-02", "S", "N", "N", "N/A", "N", "N", "N", "N", "N", "N", "N/A", "N"],
  ["TA004272", "Citroën Jumpy Vitrê", "LE", "GE", "CJ BANCOS REC- LE - 3,3 - 3P - COURVIN PRETO/BOOMERANG/LINHA PRETA - E/S/ J - EXECUTIVO", "VM CALÇADOS", "GUARULHOS", "2026-08-03", "N/A", "S", "N", "N/A", "N", "N", "N", "N", "N", "N", "N/A", "N"],
  ["VJ665708", "Renault Master L3H2", "LB", "CLIM", "CJ BANCOS FIXOS - MC - LB - 4,3,3,2-1 - 2P - TECIDO - NORMAL - FOCA", "BR PRIME", " BURITIS (ADESAO BALSAS)", "2026-08-05", "S", "S", "S", "N/A", "N", "S", "N", "S", "N", "N", "N/A", "N"],
  ["TE270315", "Mercedes-Benz Sprinter 417 10,5 m³", "LB", "CLIM", "CJ BANCOS FIXOS - MC - LB - 4,3,3,2-1 - 2P - TECIDO - TRILHO - ELEVITTA", "BELISA", "SIDROLÂNDIA (ADESAO CIDASG)", "2026-08-05", "S", "N", "N", "N", "N", "N", "N", "N", "N", "N", "N/A", "N"],
  ["TA009491", "Fiat Scudo Vitrê", "LB", "GE", "CJ BANCOS FIXOS - MC - LB - 3,3 - 3P - TECIDO - E/S/ J", "FMIS", "DOURADO", "2026-08-07", "N/A", "N", "N", "N/A", "N", "N", "N", "N", "N", "N/A", "N/A", "N"],
  ["TA008270", "Fiat Scudo Vitrê", "LE", "CLIM", "CJ BANCOS REC- LE - 3,3 - 3P - COURVIN PRETO/RETILINEA/LINHA PRETA - E/S/ J - EXECUTIVO", "HI SERVICE", "SÃO PAULO", "2026-08-07", "N/A", "S", "N", "N/A", "N", "N", "N", "N", "N", "N/A", "N/A", "N"],
  ["TA009749", "Citroën Jumpy Furgão", "LE", "CLIM", "CJ BANCOS REC- LE - 3,3 - 3P - COURVIN PRETO/RETILINEA/LINHA PRETA - E/S/ J - EXECUTIVO", "HI SERVICE", "SÃO PAULO", "2026-08-07", "S", "S", "N", "N/A", "N", "N", "N", "N", "N", "N/A", "N/A", "N"],
  ["TA007442", "Peugeot Expert Furgão", "LE", "GE", "CJ BANCOS REC- LE - 3,3 - 3P - COURVIN MARROM/BOOMERANG/LINHA DOURADA - E/S/ J - EXECUTIVO", "FRIENDSHIP", "RIO DE JANEIRO", "2026-08-08", "S", "N", "N", "N/A", "N", "N", "N", "N", "N", "N", "N/A", "N"],
  ["TA000944", "Peugeot Expert Furgão", "LE", "GE", "CJ BANCOS REC- LE - 3,2-1 - 3P - COURVIN PRETO/BOOMERANG/LINHA PRETA - E/S/ J - EXECUTIVO", "RECANTO SÃO BENEDITO", "SÃO BENTO DO SAPUCAI", "2026-08-09", "S", "N", "N", "N/A", "N", "N", "N", "N", "N", "N", "N/A", "N"],
  ["TA008976", "Peugeot Expert Furgão", "LE", "CLIM", "CJ BANCOS REC- LE - 3,3 - 3P - COURVIN MARROM/BOOMERANG/LINHA DOURADA - E/S/ J - EXECUTIVO", "COMODITA 3 TRANSPORTE", "SÃO PAULO", "2026-08-14", "S", "N", "N", "N/A", "N", "N", "N", "N", "N", "N/A", "N/A", "N"],
];

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

const uploadedSequenceOrders: Order[] = uploadedSequenceRows.map((row, index) => ({
  id: 30001 + index,
  status: "PÁTIO",
  item: String(index + 1).padStart(2, "0"),
  dueDate: row[7],
  customer: row[5],
  city: row[6],
  model: row[1],
  chassis: row[0],
  line: row[2],
  transformation: row[1],
  bank: row[4],
  ac: row[3],
  acType: row[3],
  accessory: row[17] === "N/A" ? "NÃO" : "SJ",
  plot: row[18],
  sequence: index + 1,
  stages: sequenceStages(row),
}));

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

function buildSchedule(orders: Order[], rules: TimeRule[], calendar: CalendarConfig) {
  const resourceCursor = new Map<Stage, Date[]>();
  const operations: Operation[] = [];
  if (!hasProductiveCalendar(calendar)) return operations;
  const start = getStartDate(calendar);
  stages.forEach((stage) => {
    const count = Math.max(1, Math.floor(calendar.operators?.[stage] ?? 1));
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

function weekRangeLabel(date: Date) {
  return `${weekLabel(date)} · ${date.getFullYear()}`;
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
  const marks = [
    calendar.dayStart,
    calendar.lunchStart,
    calendar.lunchEnd,
    calendar.dayEnd,
  ].filter(hasTimeValue);
  return [...new Set(marks)].sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
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

export default function Home() {
  const [orders, setOrders] = useState<Order[]>(uploadedSequenceOrders);
  const [rules, setRules] = useState<TimeRule[]>(initialRules);
  const [calendar, setCalendar] = useState<CalendarConfig>(initialCalendar);
  const [selectedStage, setSelectedStage] = useState<Stage>("REVEST");
  const [filter, setFilter] = useState("todos");

  useEffect(() => {
    const saved = window.localStorage.getItem("ji-mrp-state");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as {
        version?: string;
        orders?: Order[];
        rules?: TimeRule[];
        calendar?: CalendarConfig;
      };
      if (parsed.version !== STATE_VERSION) {
        window.localStorage.removeItem("ji-mrp-state");
        return;
      }
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
      JSON.stringify({ version: STATE_VERSION, orders, rules, calendar })
    );
  }, [orders, rules, calendar]);

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
    const capacityStart = getStartDate(calendar);
    const capacityEnd = addDays(startOfDay(capacityStart), 9);
    const byStage = stages.map((stage) => {
      const minutes = operations
        .filter((operation) => operation.stage === stage)
        .reduce((total, operation) => total + operation.minutes, 0);
      const workingDays = countWorkingDays(capacityStart, capacityEnd, calendar);
      const operators = Math.max(1, Math.floor(calendar.operators?.[stage] ?? 1));
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

  function updateOrder(orderId: number, field: keyof Order, value: string) {
    setOrders((current) =>
      current.map((order) =>
        order.id === orderId ? { ...order, [field]: value } : order
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
    setOrders(uploadedSequenceOrders);
    setRules(initialRules);
    setCalendar(initialCalendar);
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
              <span className="legend-off">Sem produção</span>
              <span className="legend-lunch">Almoço</span>
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
                }}
              >
                <div
                  className="cm25-week-row"
                  style={{
                    gridTemplateColumns: ganttWeekGroups
                      .map((group) => `${group.days * 150}px`)
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
                  style={{ gridTemplateColumns: `repeat(${ganttDays.length}, 150px)` }}
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
                  style={{ gridTemplateColumns: `repeat(${ganttDays.length}, 150px)` }}
                >
                  {ganttDays.map((day) => (
                    <div
                      className={isWorkingDay(day, calendar) ? "cm25-hour-day" : "cm25-hour-day off"}
                      key={`hours-${dayKey(day)}`}
                      style={{
                        gridTemplateColumns: `repeat(${Math.max(1, ganttHourMarks.length)}, 1fr)`,
                      }}
                    >
                      {isWorkingDay(day, calendar) ? (
                        ganttHourMarks.map((hour) => <span key={`${dayKey(day)}-${hour}`}>{hour}</span>)
                      ) : (
                        <span>parado</span>
                      )}
                    </div>
                  ))}
                </div>
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
                      {ganttDays.map((day, index) => {
                        if (isWorkingDay(day, calendar)) return null;
                        return (
                          <span
                            aria-hidden="true"
                            className="cm25-off-column"
                            key={`off-${stage}-${dayKey(day)}`}
                            style={{ left: `${index * 150}px`, width: "150px" }}
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
                            key={`lunch-${stage}-${dayKey(day)}`}
                            style={{
                              left: `${Math.max(0, left)}px`,
                              width: `${Math.max(4, width)}px`,
                            }}
                          />
                        );
                      })}
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
                              width: `${Math.max(112, width)}px`,
                              backgroundColor: stageColors[stage],
                            }}
                            title={`${operation.stage} · O.S ${operation.os} · Pedido ${operation.item} · ${
                              operation.customer
                            } · ${formatDateTime(operation.start)} até ${formatDateTime(
                              operation.end
                            )} · tempo produtivo ${formatDuration(operation.minutes)} · entrega ${formatDate(operation.dueDate)}`}
                          >
                            <strong>{operation.os}</strong>
                            <span>#{operation.item} · OP{operation.operator} · prod. {formatDuration(operation.minutes)}</span>
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
            <span>10 dias corridos desde {weekLabel(getStartDate(calendar))}, descontando paradas</span>
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
                          title={`O.S ${operation.os} · Pedido ${operation.item} · ${operation.customer} · ${formatDateTime(
                            operation.start
                          )} - ${formatDateTime(operation.end)} · tempo produtivo ${formatDuration(operation.minutes)}`}
                        >
                          {operation.os}
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
            <span>10 dias corridos desde {weekLabel(getStartDate(calendar))}, descontando paradas</span>
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
            <span>Sequência importada do modelo_upload (18).xlsx</span>
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
