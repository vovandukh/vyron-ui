"""Головний цикл: підключитися до Moonraker, запустити можливості ядра, при обриві — тихо чекати й повторити.

Якщо Moonraker вимкнений або перезапускається, ядро просто чекає (з наростаючою паузою до хвилини)
і нічого не робить. Помилка в будь-якій можливості не зачіпає ні принтер, ні інші можливості.
"""

import asyncio
import logging

from .design_sync import DesignSync
from .moonraker import MoonrakerClient

log = logging.getLogger("vyron.core")


class App:
    def __init__(self, config):
        self.config = config
        self.features = []
        if config.getbool("design_sync", "enabled"):
            self.features.append(DesignSync(interval=config.getfloat("design_sync", "interval", minimum=1.0)))
        self._stop = None

    def stop(self):
        if self._stop is not None and not self._stop.done():
            self._stop.set_result(True)

    async def _session(self, client):
        tasks = [asyncio.ensure_future(self._guard(f, client)) for f in self.features]
        try:
            await asyncio.wait([client.closed, self._stop], return_when=asyncio.FIRST_COMPLETED)
        finally:
            for t in tasks:
                t.cancel()
            for t in tasks:
                try:
                    await t
                except asyncio.CancelledError:
                    pass

    async def _guard(self, feature, client):
        name = feature.__class__.__name__
        try:
            await feature.run(client)
        except asyncio.CancelledError:
            raise
        except ConnectionError:
            log.debug("%s: connection lost", name)  # звичайний обрив — перепідключення зробить run()
        except Exception:
            # Падіння однієї можливості не зупиняє ядро; повтор — після перепідключення
            log.exception("%s stopped with an error", name)

    async def run(self):
        self._stop = asyncio.get_event_loop().create_future()
        socket = self.config.path_of("moonraker", "socket")
        delay = 2
        while not self._stop.done():
            client = MoonrakerClient(socket)
            try:
                await client.connect()
                delay = 2
                await self._session(client)
            except (OSError, ConnectionError, asyncio.TimeoutError) as e:
                log.info("Moonraker not available (%s), retrying in %ss", e.__class__.__name__, delay)
            finally:
                await client.close()
            if self._stop.done():
                break
            try:
                await asyncio.wait_for(asyncio.shield(self._stop), delay)
            except asyncio.TimeoutError:
                pass
            delay = min(delay * 2, 60)
        log.info("Vyron Core stopped")
