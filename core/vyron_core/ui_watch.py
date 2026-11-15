"""Нова версія інтерфейсу — одразу на всіх відкритих екранах.

Update Manager оновлює репозиторій Vyron (git pull), і готові сторінки index.html (Vyron Web) та
screen.html (Vyron Screen) змінюються на диску. Ядро раз на кілька секунд перевіряє лише їхній час
зміни й розмір (os.stat — без читання файлів і без звернень до Moonraker) і, коли щось змінилось,
розсилає подію ui_updated. Відкриті сторінки самі перезавантажуються, щойно ними ніхто не користується.
Без ядра сторінки помічають нову версію самі, але із запізненням до ~20 с.
"""

import asyncio
import logging
import os

log = logging.getLogger("vyron.ui")

EVENT = "ui_updated"
FILES = ("index.html", "screen.html")
# Скільки чекати, поки файли «втихнуть»: git pull пише їх не одночасно — одна подія на все оновлення
SETTLE = 2.0


def repo_root():
    """Корінь репозиторію Vyron: core/vyron_core/ui_watch.py → два рівні вгору від пакета."""
    return os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class UiWatch:
    def __init__(self, root=None, interval=3.0, settle=SETTLE):
        self.root = os.path.expanduser(root) if root else repo_root()
        self.interval = interval
        self.settle = settle

    def snapshot(self):
        snap = {}
        for name in FILES:
            try:
                st = os.stat(os.path.join(self.root, name))
                snap[name] = (st.st_mtime_ns, st.st_size)
            except OSError:
                snap[name] = None
        return snap

    async def run(self, client):
        last = self.snapshot()
        log.info("ui watch started (%s)", self.root)
        while client.connected:
            await asyncio.sleep(self.interval)
            if not client.connected:
                break
            cur = self.snapshot()
            if cur == last:
                continue
            # Дати git pull дописати решту файлів, потім одна подія
            await asyncio.sleep(self.settle)
            cur = self.snapshot()
            changed = sorted(n for n in FILES if cur.get(n) != last.get(n) and cur.get(n) is not None)
            last = cur
            if changed:
                await client.send_event(EVENT, {"files": changed})
                log.info("ui updated (%s), notified clients", ", ".join(changed))
