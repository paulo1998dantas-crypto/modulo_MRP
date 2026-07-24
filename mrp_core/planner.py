from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from math import ceil

from .models import InventoryBalance, LeadTimeItem, MrpDemand, MrpRecommendation, OpenPurchase


@dataclass(frozen=True)
class MrpPlanConfig:
    start_date: date
    horizon_weeks: int = 8
    safety_days: float = 7
    safety_factor: float = 0


def excel_weeknum(day: date) -> int:
    """Match Excel WEEKNUM default behavior, where weeks start on Sunday."""
    jan_1 = date(day.year, 1, 1)
    sunday_based_weekday = (jan_1.weekday() + 1) % 7
    return ceil(((day - jan_1).days + sunday_based_weekday + 1) / 7)


def week_sequence(start_date: date, horizon_weeks: int) -> list[int]:
    weeks: list[int] = []
    cursor = start_date
    while len(weeks) < horizon_weeks:
        week = excel_weeknum(cursor)
        if week not in weeks:
            weeks.append(week)
        cursor += timedelta(days=7)
    return weeks


def _active_purchase(purchase: OpenPurchase) -> bool:
    status = purchase.status.upper()
    blocked = ("CONCLUID", "FINALIZ", "CANCEL", "RECEBID")
    return not any(word in status for word in blocked)


def _lead_weeks(item: LeadTimeItem | None) -> int:
    if item is None:
        return 1
    return max(1, ceil(item.calendar_days / 7))


def build_mrp_plan(
    lead_times: list[LeadTimeItem],
    inventory: list[InventoryBalance],
    demands: list[MrpDemand],
    purchases: list[OpenPurchase],
    config: MrpPlanConfig,
) -> list[MrpRecommendation]:
    weeks = week_sequence(config.start_date, config.horizon_weeks)
    current_week = weeks[0]
    lead_by_pn = {item.pn: item for item in lead_times}
    inventory_by_pn = {item.pn: item for item in inventory}

    pn_set = set(lead_by_pn) | set(inventory_by_pn)
    pn_set.update(demand.pn for demand in demands)
    pn_set.update(purchase.pn for purchase in purchases)

    recommendations: list[MrpRecommendation] = []
    for pn in sorted(pn_set):
        lead = lead_by_pn.get(pn)
        balance = inventory_by_pn.get(pn)
        description = (lead.description if lead else "") or (balance.description if balance else "")
        lead_weeks = _lead_weeks(lead)

        weekly_demand = {week: 0.0 for week in weeks}
        for demand in demands:
            if demand.pn != pn:
                continue
            week = demand.need_week
            if week is None and demand.need_date:
                week = excel_weeknum(demand.need_date)
            week = week if week in weekly_demand else current_week
            weekly_demand[week] += demand.quantity

        weekly_incoming = {week: 0.0 for week in weeks}
        for purchase in purchases:
            if purchase.pn != pn or not _active_purchase(purchase):
                continue
            week = purchase.delivery_week
            if week is None and purchase.delivery_date:
                week = excel_weeknum(purchase.delivery_date)
            week = week if week in weekly_incoming else current_week
            weekly_incoming[week] += purchase.quantity

        total_demand = sum(weekly_demand.values())
        average_future = total_demand / len(weeks) if weeks else 0
        safety_stock = (average_future / 22) * config.safety_days

        projected: dict[int, float] = {}
        suggested: dict[int, float] = {week: 0.0 for week in weeks}
        available = balance.available if balance else 0
        previous_stock = available
        previous_shortage = 0.0

        for index, week in enumerate(weeks):
            if index == 0:
                stock = previous_stock - weekly_demand[week] + weekly_incoming[week]
            else:
                stock = previous_stock - weekly_demand[week] + weekly_incoming[week]
            stock += safety_stock * config.safety_factor
            projected[week] = stock

            shortage = max(0.0, -stock)
            incremental_shortage = max(0.0, shortage - previous_shortage)
            if incremental_shortage:
                purchase_index = max(0, index - lead_weeks)
                suggested[weeks[purchase_index]] += incremental_shortage

            previous_stock = stock
            previous_shortage = shortage

        recommendations.append(
            MrpRecommendation(
                pn=pn,
                description=description,
                lead_weeks=lead_weeks,
                safety_stock=safety_stock,
                weekly_demand=weekly_demand,
                weekly_incoming=weekly_incoming,
                projected_stock=projected,
                suggested_purchase=suggested,
            )
        )

    return recommendations
