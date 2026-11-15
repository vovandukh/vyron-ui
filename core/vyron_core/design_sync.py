"""Жива синхронізація дизайну між пристроями.

Vyron Web зберігає тему в базі Moonraker (vyron_ui/design, поле updated — час зміни). Moonraker
не повідомляє клієнтам про зміни в базі, тому ядро раз на кілька секунд читає цей запис (дешевий
локальний запит) і, коли updated змінився, розсилає подію design_changed. Усі відкриті клієнти
(браузери, Vyron Screen) одразу підтягують нову тему. Ядро тему не змінює — лише повідомляє.
"""

import asyncio
import logging

from .moonraker import MoonrakerError

log = logging.getLogger("vyron.design")

NAMESPACE = "vyron_ui"
KEY = "design"
EVENT = "design_changed"


class DesignSync:
    def __init__(self, interval=2.0):
        self.interval = interval

    async def _updated(self, client):
        try:
            r = await client.call("server.database.get_item", {"namespace": NAMESPACE, "key": KEY})
        except MoonrakerError:
            return None  # запису ще немає — тему ніхто не зберігав
        value = (r or {}).get("value") or {}
        return value.get("updated") if isinstance(value, dict) else None

    async def run(self, client):
        last = await self._updated(client)
        log.info("design sync started (updated=%s)", last)
        while client.connected:
            await asyncio.sleep(self.interval)
            if not client.connected:
                break
            cur = await self._updated(client)
            if cur is not None and cur != last:
                last = cur
                await client.send_event(EVENT, {"updated": cur})
                log.info("design changed, notified clients (updated=%s)", cur)
