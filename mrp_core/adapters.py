from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class SupabaseSettings:
    url: str
    service_role_key: str

    @classmethod
    def from_env(cls) -> "SupabaseSettings":
        return cls(
            url=os.environ["SUPABASE_URL"],
            service_role_key=os.environ["SUPABASE_SERVICE_ROLE_KEY"],
        )


@dataclass(frozen=True)
class ExternalModuleSettings:
    estoque_url: str = "https://moduloestoque-cni2.onrender.com"
    suprimentos_url: str = "https://modulo-suprimentos.onrender.com"

    @classmethod
    def from_env(cls) -> "ExternalModuleSettings":
        return cls(
            estoque_url=os.getenv("MODULO_ESTOQUE_URL", cls.estoque_url),
            suprimentos_url=os.getenv("MODULO_SUPRIMENTOS_URL", cls.suprimentos_url),
        )


class MrpDataAdapter:
    """Boundary for replacing workbook uploads with Supabase/Render data sources."""

    def fetch_inventory(self):
        raise NotImplementedError("Connect to ModuloEstoque balance tables or API.")

    def fetch_open_purchases(self):
        raise NotImplementedError("Connect to ModuloSuprimentos purchase orders.")

    def fetch_active_demands(self):
        raise NotImplementedError("Connect to active O.S/O.C item requirements.")

    def fetch_mrp_ii_forecast(self):
        raise NotImplementedError("Read calculated finish dates from the MRP II scheduler.")
