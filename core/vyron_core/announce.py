"""Ядро повідомляє про себе: після кожного підключення записує версію й час старту у власний простір
бази Moonraker (vyron_core/info). Vyron Web і Vyron Screen показують це в «Про систему».
Пише лише у свій простір імен (дозволено safety.py), нічого іншого не чіпає.
"""

import asyncio
import logging
import time

from . import __version__

log = logging.getLogger("vyron.core")

NAMESPACE = "vyron_core"
KEY = "info"


class Announce:
    def __init__(self, started=None):
        self.started = started or int(time.time())

    async def run(self, client):
        await client.call("server.database.post_item", {
            "namespace": NAMESPACE, "key": KEY,
            "value": {"version": __version__, "started": self.started},
        })
        log.info("announced version %s", __version__)
        # Більше нічого робити не треба — чекаємо до кінця сесії
        while client.connected:
            await asyncio.sleep(3600)
