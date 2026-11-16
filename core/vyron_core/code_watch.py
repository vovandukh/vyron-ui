"""Ядро саме переходить на нову версію свого коду.

Update Manager оновлює репозиторій (git pull), але перезапускати службу vyron-core Moonraker не дозволяє
(managed_services приймає лише назву розділу, klipper і moonraker). Тому ядро раз на кілька секунд дивиться
на час зміни власних файлів (os.stat, без читання) і, коли вони змінились, завершується з кодом 75 —
systemd (Restart=on-failure) запускає його знову вже з новим кодом. Принтер це не зачіпає.
"""

import asyncio
import logging
import os

log = logging.getLogger("vyron.core")

EXIT_RELOAD = 75   # EX_TEMPFAIL: «перезапусти мене»
SETTLE = 3.0       # git pull пише файли не одночасно — дочекатися, поки все допишеться


def package_dir():
    return os.path.dirname(os.path.abspath(__file__))


def _default_reload():
    log.info("core code updated, restarting to load the new version")
    logging.shutdown()
    os._exit(EXIT_RELOAD)


class CodeWatch:
    def __init__(self, root=None, interval=5.0, settle=SETTLE, on_change=None):
        self.root = root or package_dir()
        self.interval = interval
        self.settle = settle
        self.on_change = on_change or _default_reload

    def snapshot(self):
        snap = {}
        try:
            names = os.listdir(self.root)
        except OSError:
            return snap
        for n in names:
            if n.endswith(".py"):
                try:
                    st = os.stat(os.path.join(self.root, n))
                    snap[n] = (st.st_mtime_ns, st.st_size)
                except OSError:
                    pass
        return snap

    async def run(self, client):
        last = self.snapshot()
        while client.connected:
            await asyncio.sleep(self.interval)
            if self.snapshot() == last:
                continue
            await asyncio.sleep(self.settle)
            self.on_change()
            return
