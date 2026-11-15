"""Нова версія інтерфейсу — одразу на всіх відкритих екранах.

Update Manager оновлює репозиторій Vyron (git pull), і готові сторінки index.html (Vyron Web) та
screen.html (Vyron Screen) змінюються на диску. Ядро раз на кілька секунд перевіряє лише їхній час
зміни й розмір (os.stat — без читання файлів) і, коли щось змінилось, розсилає подію ui_updated.
Відкриті сторінки самі перезавантажуються, щойно ними ніхто не користується. Відбиток збірки ядро
зберігає у своєму просторі бази, щоб не пропустити оновлення, яке сталося під час його перезапуску.
Без ядра сторінки помічають нову версію самі, але із запізненням до ~20 с.
"""

import asyncio
import logging
import os

from .moonraker import MoonrakerError

log = logging.getLogger("vyron.ui")

EVENT = "ui_updated"
# Відбиток останньої баченої збірки — у власному просторі бази (дозволено safety.py)
DB_NS = "vyron_core"
DB_KEY = "build"
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

    @staticmethod
    def _sig(snap):
        """Відбиток збірки для бази: {"index.html": "mtime_ns:size", ...}"""
        return {n: ("%d:%d" % v if v else None) for n, v in sorted(snap.items())}

    async def _remember(self, client, snap):
        try:
            await client.call("server.database.post_item", {"namespace": DB_NS, "key": DB_KEY, "value": self._sig(snap)})
        except MoonrakerError:
            pass

    async def run(self, client):
        last = self.snapshot()
        log.info("ui watch started (%s)", self.root)
        # Update Manager після git pull перезапускає ядро — зміну файлів старе ядро могло не встигнути помітити.
        # Тому порівнюємо зі збіркою, яку бачили до перезапуску (збережена в базі), і за потреби повідомляємо зараз.
        try:
            prev = (await client.call("server.database.get_item", {"namespace": DB_NS, "key": DB_KEY}) or {}).get("value")
        except MoonrakerError:
            prev = None
        cur_sig = self._sig(last)
        if isinstance(prev, dict) and prev != cur_sig:
            changed = sorted(n for n in FILES if cur_sig.get(n) and prev.get(n) != cur_sig.get(n))
            if changed:
                await client.send_event(EVENT, {"files": changed})
                log.info("ui updated while core was restarting (%s), notified clients", ", ".join(changed))
        if prev != cur_sig:
            await self._remember(client, last)
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
                await self._remember(client, cur)
