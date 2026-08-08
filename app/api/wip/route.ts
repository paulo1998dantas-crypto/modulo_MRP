import { NextResponse } from "next/server";
import { getMrpPrincipal } from "../../lib/shared-auth";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

type WipOrder = {
  id: number;
  workOrderId: string;
  source: "WIP";
  status: "EM PÁTIO" | "EM PRODUÇÃO";
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
  stages: Record<string, string>;
};

const STAGES = [
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

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function upper(value: unknown) {
  return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

function asNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isoDate(value: unknown) {
  const raw = text(value);
  return raw ? raw.slice(0, 10) : "";
}

function stableNegativeId(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return -Math.max(1, Math.abs(hash));
}

function canonicalStage(value: unknown) {
  const normalized = upper(value).replace(/[^A-Z]/g, "");
  if (normalized === "VIDROS") return "VIDROS";
  if (normalized === "AC") return "A/C";
  if (normalized === "PREP") return "PREP";
  if (normalized === "SERRA") return "SERRA.";
  if (normalized === "EXPE") return "EXPE.";
  if (normalized === "DESMONT") return "DESMONT";
  if (normalized === "ELETRICA") return "ELÉTRICA";
  if (normalized === "REVEST") return "REVEST";
  if (normalized === "BCO" || normalized === "BANCO") return "BCO";
  if (normalized === "ACESSORIO") return "ACESSÓ.";
  if (normalized === "PLOTAGEM" || normalized === "PLOTA") return "PLOTA.";
  if (normalized === "LIBERACAO" || normalized === "LIBERA") return "LIBERA.";
  return "";
}

function stageStatus(stage: Row) {
  const compactStatus = upper(stage.status).replace(/[^A-Z]/g, "");
  if (stage.aplicavel === false || compactStatus.includes("NAOAPLICAVEL")) return "N/A";
  const status = upper(stage.status);
  if (status.includes("CONCLUID")) return "S";
  if (status.includes("ANDAMENTO") || status.includes("PARCIAL")) return "P";
  return "N";
}

function wipStatus(status: unknown): "EM PÁTIO" | "EM PRODUÇÃO" {
  return upper(status) === "ATIVA" ? "EM PÁTIO" : "EM PRODUÇÃO";
}

function getConfig() {
  const url = text(process.env.SUPABASE_URL).replace(/\/$/, "");
  const key = text(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY);
  if (!url || !key) {
    throw new Error("MRP II sem configuração de leitura do Supabase.");
  }
  return { url, key };
}

async function readRows(table: string, select: string, order = "id.asc") {
  const { url, key } = getConfig();
  const rows: Row[] = [];
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const endpoint = new URL(`${url}/rest/v1/${table}`);
    endpoint.searchParams.set("select", select);
    endpoint.searchParams.set("order", order);
    const response = await fetch(endpoint, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Range: `${offset}-${offset + pageSize - 1}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Não foi possível consultar ${table} (${response.status}).`);
    }

    const page = (await response.json()) as Row[];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

export async function GET() {
  try {
    const principal = await getMrpPrincipal();
    if (!principal) {
      return NextResponse.json(
        { error: "Sessão ausente, expirada ou sem permissão para consultar o MRP." },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }
    const [workOrders, stages, sequences, entries, vehicles] = await Promise.all([
      readRows(
        "erp_work_orders",
        "id,vehicle_entry_id,numero_os,status,cliente_nome,municipio,linha,transformacao,conjunto_bancos,ar_condicionado,tipo_sistema_ar,acessorio,plotagem,data_entrega,data_comercial_prevista",
      ),
      readRows("erp_work_order_stages", "work_order_id,stage_code,aplicavel,status,ordem"),
      readRows(
        "erp_work_order_sequences",
        "work_order_id,data_entrega_vigente,sequencia,prioridade_manual,ativo",
        "work_order_id.asc",
      ),
      readRows("erp_vehicle_entries", "id,vehicle_id,data_chegada,cliente_nome"),
      readRows("erp_vehicles", "id,chassi,marca,modelo,versao"),
    ]);

    const entriesById = new Map(entries.map((entry) => [text(entry.id), entry]));
    const vehiclesById = new Map(vehicles.map((vehicle) => [text(vehicle.id), vehicle]));
    const sequencesByWorkOrder = new Map(
      sequences
        .filter((sequence) => sequence.ativo !== false)
        .map((sequence) => [text(sequence.work_order_id), sequence]),
    );
    const stagesByWorkOrder = new Map<string, Record<string, string>>();

    for (const stage of stages) {
      const workOrderId = text(stage.work_order_id);
      const code = canonicalStage(stage.stage_code);
      if (!workOrderId || !code) continue;
      const current = stagesByWorkOrder.get(workOrderId) || Object.fromEntries(STAGES.map((item) => [item, "N"]));
      current[code] = stageStatus(stage);
      stagesByWorkOrder.set(workOrderId, current);
    }

    const active = workOrders.filter((workOrder) => {
      const status = upper(workOrder.status).replace(/[^A-Z]/g, "");
      return status === "ATIVA" || status === "EMPRODUCAO";
    });
    const unsorted = active.map((workOrder) => {
      const id = text(workOrder.id);
      const entry = entriesById.get(text(workOrder.vehicle_entry_id));
      const vehicle = entry ? vehiclesById.get(text(entry.vehicle_id)) : undefined;
      const sequence = sequencesByWorkOrder.get(id);
      const model = [text(vehicle?.marca), text(vehicle?.modelo), text(vehicle?.versao)].filter(Boolean).join(" ");
      const orderSequence = asNumber(sequence?.prioridade_manual) || asNumber(sequence?.sequencia) || Number.MAX_SAFE_INTEGER;

      return {
        id: stableNegativeId(id),
        workOrderId: id,
        source: "WIP" as const,
        status: wipStatus(workOrder.status),
        item: text(workOrder.numero_os),
        dueDate: isoDate(sequence?.data_entrega_vigente || workOrder.data_entrega || workOrder.data_comercial_prevista),
        customer: text(workOrder.cliente_nome || entry?.cliente_nome),
        city: text(workOrder.municipio),
        model,
        chassis: text(vehicle?.chassi),
        line: text(workOrder.linha),
        transformation: text(workOrder.transformacao),
        bank: text(workOrder.conjunto_bancos),
        ac: text(workOrder.ar_condicionado),
        acType: text(workOrder.tipo_sistema_ar),
        accessory: text(workOrder.acessorio),
        plot: text(workOrder.plotagem),
        sequence: orderSequence,
        stages: stagesByWorkOrder.get(id) || Object.fromEntries(STAGES.map((item) => [item, "N"])),
      } satisfies WipOrder;
    });

    unsorted.sort((left, right) => {
      if (left.sequence !== right.sequence) return left.sequence - right.sequence;
      return left.dueDate.localeCompare(right.dueDate) || left.item.localeCompare(right.item, "pt-BR", { numeric: true });
    });

    let fallbackSequence = Math.max(0, ...unsorted.filter((item) => item.sequence < Number.MAX_SAFE_INTEGER).map((item) => item.sequence));
    const orders = unsorted.map((item) => {
      if (item.sequence === Number.MAX_SAFE_INTEGER) {
        fallbackSequence += 1;
        return { ...item, sequence: fallbackSequence };
      }
      return item;
    });

    const counts = {
      total: orders.length,
      patio: orders.filter((order) => order.status === "EM PÁTIO").length,
      production: orders.filter((order) => order.status === "EM PRODUÇÃO").length,
      withSequence: orders.filter((order) => order.sequence > 0).length,
    };

    return NextResponse.json(
      { generatedAt: new Date().toISOString(), source: "SUPABASE", orders, counts, warnings: [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao carregar WIP do MES." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
