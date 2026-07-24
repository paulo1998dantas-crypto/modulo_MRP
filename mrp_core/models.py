from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date


@dataclass(frozen=True)
class LeadTimeItem:
    pn: str
    group: str = ""
    description: str = ""
    supplier_days: float = 0
    transport_days: float = 0
    receiving_days: float = 0
    inspection_days: float = 0
    stocking_days: float = 0
    expedition_days: float = 0
    assembly_days: float = 0
    vehicle_days: float = 0
    release_days: float = 0

    @property
    def total_workdays(self) -> float:
        return (
            self.supplier_days
            + self.transport_days
            + self.receiving_days
            + self.inspection_days
            + self.stocking_days
            + self.expedition_days
            + self.assembly_days
            + self.vehicle_days
            + self.release_days
        )

    @property
    def calendar_days(self) -> float:
        return (self.total_workdays / 5) * 7 if self.total_workdays else 0


@dataclass(frozen=True)
class InventoryBalance:
    pn: str
    description: str = ""
    unit: str = ""
    group: str = ""
    on_hand: float = 0
    committed: float = 0
    available: float = 0


@dataclass(frozen=True)
class MrpDemand:
    pn: str
    quantity: float
    os_ref: str = ""
    need_date: date | None = None
    need_week: int | None = None
    description: str = ""


@dataclass(frozen=True)
class OpenPurchase:
    pn: str
    quantity: float
    delivery_date: date | None = None
    delivery_week: int | None = None
    purchase_order: str = ""
    supplier: str = ""
    status: str = ""


@dataclass
class MrpRecommendation:
    pn: str
    description: str
    lead_weeks: int
    safety_stock: float
    weekly_demand: dict[int, float] = field(default_factory=dict)
    weekly_incoming: dict[int, float] = field(default_factory=dict)
    projected_stock: dict[int, float] = field(default_factory=dict)
    suggested_purchase: dict[int, float] = field(default_factory=dict)

    @property
    def total_demand(self) -> float:
        return sum(self.weekly_demand.values())

    @property
    def total_incoming(self) -> float:
        return sum(self.weekly_incoming.values())

    @property
    def total_suggested_purchase(self) -> float:
        return sum(self.suggested_purchase.values())
