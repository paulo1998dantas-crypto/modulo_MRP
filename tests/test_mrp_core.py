from datetime import date
import unittest

from mrp_core import (
    InventoryBalance,
    LeadTimeItem,
    MrpDemand,
    MrpPlanConfig,
    OpenPurchase,
    build_mrp_plan,
)
from mrp_core.planner import excel_weeknum


class MrpCoreTest(unittest.TestCase):
    def test_excel_weeknum_matches_default_excel_shape(self):
        self.assertEqual(excel_weeknum(date(2026, 1, 1)), 1)
        self.assertEqual(excel_weeknum(date(2026, 7, 22)), 30)

    def test_build_mrp_plan_offsets_purchase_by_lead_time(self):
        plan = build_mrp_plan(
            lead_times=[LeadTimeItem(pn="PN1", supplier_days=10)],
            inventory=[InventoryBalance(pn="PN1", available=0)],
            demands=[MrpDemand(pn="PN1", quantity=5, need_week=32)],
            purchases=[],
            config=MrpPlanConfig(start_date=date(2026, 7, 22), horizon_weeks=4),
        )

        row = plan[0]
        self.assertEqual(row.lead_weeks, 2)
        self.assertEqual(row.weekly_demand[32], 5)
        self.assertEqual(row.suggested_purchase[30], 5)

    def test_completed_purchase_is_ignored(self):
        plan = build_mrp_plan(
            lead_times=[LeadTimeItem(pn="PN1", supplier_days=5)],
            inventory=[InventoryBalance(pn="PN1", available=0)],
            demands=[MrpDemand(pn="PN1", quantity=5, need_week=30)],
            purchases=[OpenPurchase(pn="PN1", quantity=5, delivery_week=30, status="CONCLUIDO")],
            config=MrpPlanConfig(start_date=date(2026, 7, 22), horizon_weeks=2),
        )

        row = plan[0]
        self.assertEqual(row.total_incoming, 0)
        self.assertEqual(row.total_suggested_purchase, 5)


if __name__ == "__main__":
    unittest.main()
