import { NextResponse } from "next/server";

import type { MrpLiveDemand, MrpLiveSnapshot, MrpLiveTransit } from "../../lib/mrp-live";
import { getMrpPrincipal } from "../../lib/shared-auth";

export const dynamic = "force-dynamic";

type Row = Record<string, unknown>;

const PAGE_SIZE = 1000;
const TERMINAL_WORK_ORDER_STATUSES = new Set([
  "FINALIZADA", "ENTREGUE", "RETIRADA", "CANCELADA", "ARQUIVADA",
]);
const COMMITMENT_TYPES = new Set(["EMPENHO", "SAIDA"]);

function text(value: unknown) {
  return String(value ?? "").trim();
}

function upper(value: unknown) {
  return text(value).toUpperCase();
}

function numberOf(value: unknown) {
  const raw = typeof value === "string" ? value.replace(",", ".") : value;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function uuidKey(value: unknown) {
  return text(value).toLowerCase().replace(/[^0-9a-f]/g, "");
}

function codeKey(value: unknown) {
  return upper(value);
}

function isOpenWorkOrder(row: Row) {
  const technical = upper(row.technical_status || "ABERTA");
  const status = upper(row.status);
  return technical === "ABERTA" && !TERMINAL_WORK_ORDER_STATUSES.has(status);
}

function isoDate(value: unknown) {
  const match = text(value).match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
}

function parseComposition(value: unknown): Row[] {
  if (Array.isArray(value)) return value.filter((item): item is Row => Boolean(item) && typeof item === "object");
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is Row => Boolean(item) && typeof item === "object") : [];
  } catch {
    return [];
  }
}

function updatedAtValue(value: unknown) {
  const parsed = Date.parse(text(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function readEnv(name: string) {
  return text(process.env[name]);
}

async function readRows(table: string, select: string): Promise<Row[]> {
  const baseUrl = readEnv("SUPABASE_URL").replace(/\/$/, "");
  // Keep compatibility with the secret-key name already used by the ERP services.
  // This value is read exclusively by this local server route, never by the browser.
  const serviceKey = readEnv("SUPABASE_SERVICE_ROLE_KEY") || readEnv("SUPABASE_SECRET_KEY");
  if (!baseUrl || !serviceKey) {
    throw new Error("MRP I não configurado: informe SUPABASE_URL e uma chave secreta somente no ambiente local.");
  }

  const rows: Row[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const endpoint = new URL(`${baseUrl}/rest/v1/${table}`);
    endpoint.searchParams.set("select", select);
    endpoint.searchParams.set("order", "id.asc");
    const response = await fetch(endpoint, {
      cache: "no-store",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Range: `${offset}-${offset + PAGE_SIZE - 1}`,
      },
    });
    if (!response.ok) {
      throw new Error(`Falha ao ler ${table}: ${response.status} ${response.statusText}`);
    }
    const page = (await response.json()) as Row[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

function explodeCoverage(
  code: string,
  quantity: number,
  bomByParent: Map<string, Array<{ code: string; quantity: number }>>,
  result = new Map<string, number>(),
  ancestry = new Set<string>()
) {
  if (!code || quantity <= 0) return result;
  result.set(code, (result.get(code) ?? 0) + quantity);
  if (ancestry.has(code)) return result;
  const nextAncestry = new Set(ancestry);
  nextAncestry.add(code);
  (bomByParent.get(code) ?? []).forEach((child) => {
    if (!nextAncestry.has(child.code) && child.quantity > 0) {
      explodeCoverage(child.code, quantity * child.quantity, bomByParent, result, nextAncestry);
    }
  });
  return result;
}

function activePurchase(row: Row) {
  const status = upper(row.status);
  return status === "EMITIDA" || status === "PARCIALMENTE_RECEBIDA";
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
    const [skus, balances, bom, cadastroBom, orders, documents, movements, purchaseOrders, purchaseLines, forecasts, forecastNeeds] = await Promise.all([
      readRows("skus", "id,sku,descricao,unidade,grupo,active"),
      readRows("stock_balances", "sku_id,saldo_atual"),
      readRows("bom_components", "item_sku_id,component_sku_id,quantidade"),
      readRows("cadastro_bom_componentes", "parent_sku,component_sku,quantidade"),
      readRows("erp_work_orders", "id,numero_os,status,technical_status,data_entrega,data_comercial_prevista"),
      readRows("suprimentos_documentos", "id,tipo,numero,erp_work_order_id,composicao,updated_at"),
      readRows("movements", "id,sku_id,tipo,quantidade,related_movement_id,work_order_id,movement_status"),
      readRows("erp_purchase_orders", "id,numero_oc,fornecedor_nome,status,technical_status,data_necessidade"),
      readRows("erp_purchase_order_lines", "purchase_order_id,sku_id,sku_codigo,descricao_original,unidade,quantidade_pedida,quantidade_recebida,data_necessidade,status"),
      readRows("suprimentos_forecasts", "id,numero_forecast,tipo_demanda,status,data_confirmacao,data_prevista_chegada,data_entrega_prevista"),
      readRows("suprimentos_forecast_necessidades", "forecast_id,sku_codigo,descricao,unidade,quantidade_planejada"),
    ]);

    const skuById = new Map<number, Row>();
    const skuByCode = new Map<string, Row>();
    skus.forEach((sku) => {
      const id = numberOf(sku.id);
      const code = codeKey(sku.sku);
      if (id) skuById.set(id, sku);
      if (code) skuByCode.set(code, sku);
    });

    const bomByParent = new Map<string, Array<{ code: string; quantity: number }>>();
    bom.forEach((component) => {
      const parent = skuById.get(numberOf(component.item_sku_id));
      const child = skuById.get(numberOf(component.component_sku_id));
      const parentCode = codeKey(parent?.sku);
      const childCode = codeKey(child?.sku);
      const quantity = numberOf(component.quantidade);
      if (!parentCode || !childCode || quantity <= 0) return;
      const values = bomByParent.get(parentCode) ?? [];
      values.push({ code: childCode, quantity });
      bomByParent.set(parentCode, values);
    });

    // Cadastro is the source used when a B.O.M. was associated after the SKU
    // already existed.  The normal inventory B.O.M. remains authoritative when
    // it is present; this fallback is keyed only by the SKU code and therefore
    // does not depend on a manually maintained flag or a browser cache.
    const cadastroBomByParent = new Map<string, Array<{ code: string; quantity: number }>>();
    cadastroBom.forEach((component) => {
      const parentCode = codeKey(component.parent_sku);
      const childCode = codeKey(component.component_sku);
      const quantity = numberOf(component.quantidade);
      if (!parentCode || !childCode || quantity <= 0 || !skuByCode.has(parentCode)) return;
      const values = cadastroBomByParent.get(parentCode) ?? [];
      values.push({ code: childCode, quantity });
      cadastroBomByParent.set(parentCode, values);
    });
    let cadastroBomFallbackParents = 0;
    cadastroBomByParent.forEach((components, parentCode) => {
      if (bomByParent.has(parentCode)) return;
      bomByParent.set(parentCode, components);
      cadastroBomFallbackParents += 1;
    });

    const balanceBySku = new Map<number, number>();
    balances.forEach((balance) => {
      const skuId = numberOf(balance.sku_id);
      if (!skuId) return;
      balanceBySku.set(skuId, (balanceBySku.get(skuId) ?? 0) + numberOf(balance.saldo_atual));
    });
    const inventory = skus
      .filter((sku) => Boolean(sku.active))
      .map((sku) => ({
        pn: codeKey(sku.sku),
        description: text(sku.descricao),
        unit: text(sku.unidade) || "UN",
        group: text(sku.grupo),
        available: balanceBySku.get(numberOf(sku.id)) ?? 0,
      }))
      .filter((sku) => sku.pn);

    const activeOrders = orders.filter(isOpenWorkOrder);
    const activeById = new Map(activeOrders.map((order) => [uuidKey(order.id), order]));
    const documentCandidates = new Map<string, Array<Row>>();
    documents.filter((document) => upper(document.tipo) === "OS").forEach((document) => {
      const linkedId = uuidKey(document.erp_work_order_id);
      if (linkedId && activeById.has(linkedId)) {
        const values = documentCandidates.get(linkedId) ?? [];
        values.push(document);
        documentCandidates.set(linkedId, values);
      }
      activeOrders.forEach((order) => {
        const id = uuidKey(order.id);
        if (!linkedId && text(document.numero) === text(order.numero_os)) {
          const values = documentCandidates.get(id) ?? [];
          values.push(document);
          documentCandidates.set(id, values);
        }
      });
    });

    const selectedDocuments = new Map<string, Row>();
    activeOrders.forEach((order) => {
      const key = uuidKey(order.id);
      const selected = [...(documentCandidates.get(key) ?? [])].sort((left, right) => {
        const directRight = uuidKey(right.erp_work_order_id) === key ? 1 : 0;
        const directLeft = uuidKey(left.erp_work_order_id) === key ? 1 : 0;
        return directRight - directLeft || updatedAtValue(right.updated_at) - updatedAtValue(left.updated_at);
      })[0];
      if (selected) selectedDocuments.set(key, selected);
    });

    const activeMovements = movements.filter((movement) => {
      const type = upper(movement.tipo);
      return (
        upper(movement.movement_status) === "ATIVA" &&
        Boolean(activeById.get(uuidKey(movement.work_order_id))) &&
        (COMMITMENT_TYPES.has(type) || type === "BAIXA")
      );
    });
    const activeCommitments = new Set(
      activeMovements.filter((movement) => COMMITMENT_TYPES.has(upper(movement.tipo))).map((movement) => numberOf(movement.id))
    );
    const coverageByOrder = new Map<string, Map<string, number>>();
    activeMovements.forEach((movement) => {
      const type = upper(movement.tipo);
      if (type === "BAIXA" && activeCommitments.has(numberOf(movement.related_movement_id))) return;
      const sku = skuById.get(numberOf(movement.sku_id));
      const sourceCode = codeKey(sku?.sku);
      if (!sourceCode) return;
      const orderKey = uuidKey(movement.work_order_id);
      const coverage = coverageByOrder.get(orderKey) ?? new Map<string, number>();
      explodeCoverage(sourceCode, numberOf(movement.quantidade), bomByParent).forEach((quantity, code) => {
        coverage.set(code, (coverage.get(code) ?? 0) + quantity);
      });
      coverageByOrder.set(orderKey, coverage);
    });

    const demands: MrpLiveDemand[] = [];
    let skippedNoSku = 0;
    activeOrders.forEach((order) => {
      const document = selectedDocuments.get(uuidKey(order.id));
      if (!document) return;
      const required = new Map<string, { quantity: number; description: string; unit: string }>();
      parseComposition(document.composicao).forEach((line) => {
        const code = codeKey(line.codigo);
        const quantity = numberOf(line.qtd ?? line.quantidade);
        if (!code || quantity <= 0) return;
        const current = required.get(code) ?? { quantity: 0, description: text(line.descricao), unit: text(line.unidade) || "UN" };
        current.quantity += quantity;
        required.set(code, current);
      });
      const coverage = coverageByOrder.get(uuidKey(order.id)) ?? new Map<string, number>();
      required.forEach((line, code) => {
        const pending = Math.max(0, line.quantity - (coverage.get(code) ?? 0));
        if (pending <= 0) return;
        const sku = skuByCode.get(code);
        demands.push({
          pn: code,
          description: text(sku?.descricao) || line.description,
          unit: text(sku?.unidade) || line.unit || "UN",
          quantity: pending,
          needDate: isoDate(order.data_entrega) || isoDate(order.data_comercial_prevista),
          source: "FIRME",
          reference: `O.S. ${text(order.numero_os)}`,
        });
      });
    });

    const forecastById = new Map(
      forecasts.filter((forecast) => upper(forecast.status) === "ATIVO").map((forecast) => [uuidKey(forecast.id), forecast])
    );
    forecastNeeds.forEach((need) => {
      const forecast = forecastById.get(uuidKey(need.forecast_id));
      if (!forecast) return;
      const pn = codeKey(need.sku_codigo);
      const quantity = numberOf(need.quantidade_planejada);
      if (!pn || quantity <= 0) { skippedNoSku += 1; return; }
      const sku = skuByCode.get(pn);
      const kind = upper(forecast.tipo_demanda);
      demands.push({
        pn,
        description: text(sku?.descricao) || text(need.descricao),
        unit: text(sku?.unidade) || text(need.unidade) || "UN",
        quantity,
        needDate: isoDate(forecast.data_entrega_prevista) || isoDate(forecast.data_prevista_chegada) || isoDate(forecast.data_confirmacao),
        source: kind.includes("AGUARDANDO") || kind.includes("CONFIRM") ? "FORECAST_FIRME" : "FORECAST_PREDITIVO",
        reference: `Forecast ${text(forecast.numero_forecast)}`,
      });
    });

    const openPurchaseById = new Map(
      purchaseOrders.filter((order) => activePurchase(order) && upper(order.technical_status || "ABERTA") !== "CONCLUIDA")
        .map((order) => [uuidKey(order.id), order])
    );
    const transit: MrpLiveTransit[] = [];
    purchaseLines.forEach((line) => {
      const order = openPurchaseById.get(uuidKey(line.purchase_order_id));
      if (!order) return;
      const pending = Math.max(0, numberOf(line.quantidade_pedida) - numberOf(line.quantidade_recebida));
      const pn = codeKey(line.sku_codigo || skuById.get(numberOf(line.sku_id))?.sku);
      if (!pn || pending <= 0) { if (pending > 0) skippedNoSku += 1; return; }
      const sku = skuByCode.get(pn);
      transit.push({
        pn,
        description: text(sku?.descricao) || text(line.descricao_original),
        unit: text(sku?.unidade) || text(line.unidade) || "UN",
        quantity: pending,
        deliveryDate: isoDate(line.data_necessidade) || isoDate(order.data_necessidade),
        purchaseOrder: text(order.numero_oc),
        supplier: text(order.fornecedor_nome),
      });
    });

    const counts = {
      activeWorkOrders: activeOrders.length,
      firmDemandLines: demands.filter((demand) => demand.source === "FIRME").length,
      forecastFirmLines: demands.filter((demand) => demand.source === "FORECAST_FIRME").length,
      forecastPredictiveLines: demands.filter((demand) => demand.source === "FORECAST_PREDITIVO").length,
      transitLines: transit.length,
      skippedNoSku,
    };
    const warnings = [
      selectedDocuments.size < activeOrders.length
        ? `${activeOrders.length - selectedDocuments.size} O.S. ativa(s) sem documento de composição não entrou(aram) na necessidade.`
        : "",
      skippedNoSku ? `${skippedNoSku} linha(s) sem SKU válido foi(ram) ignorada(s).` : "",
      cadastroBomFallbackParents
        ? `${cadastroBomFallbackParents} B.O.M.(s) do Cadastro foi(ram) vinculada(s) automaticamente pelo SKU.`
        : "",
    ].filter(Boolean);

    const snapshot: MrpLiveSnapshot = {
      generatedAt: new Date().toISOString(),
      source: "SUPABASE",
      inventory,
      transit,
      demands,
      counts,
      warnings,
    };
    return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao carregar o MRP I.";
    return NextResponse.json({ error: message }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
