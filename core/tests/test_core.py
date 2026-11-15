"""Тести Vyron Core з імітацією Moonraker на Unix-сокеті (лише Linux/macOS).

Запуск із теки core:  python3 -m unittest discover -s tests -v
"""

import asyncio
import json
import os
import shutil
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from vyron_core import safety  # noqa: E402
from vyron_core.design_sync import DesignSync  # noqa: E402
from vyron_core.moonraker import MoonrakerClient  # noqa: E402

ETX = b"\x03"


class FakeMoonraker:
    """Мінімальний Moonraker: JSON-RPC через Unix-сокет, база даних у пам'яті, журнал усіх викликів."""

    def __init__(self, path):
        self.path = path
        self.calls = []
        self.events = []
        self.db = {}
        self.server = None
        self.writers = []

    async def start(self):
        self.server = await asyncio.start_unix_server(self._client, path=self.path)

    async def stop(self):
        for w in self.writers:
            w.close()
        self.server.close()
        await self.server.wait_closed()

    def drop_clients(self):
        for w in self.writers:
            w.close()
        self.writers = []

    async def _client(self, reader, writer):
        self.writers.append(writer)
        try:
            while True:
                raw = await reader.readuntil(ETX)
                msg = json.loads(raw[:-1].decode())
                self.calls.append(msg["method"])
                writer.write(json.dumps(self._answer(msg)).encode() + ETX)
                await writer.drain()
        except (asyncio.IncompleteReadError, ConnectionError):
            pass

    def _answer(self, msg):
        m, p, rid = msg["method"], msg.get("params") or {}, msg["id"]
        if m == "server.connection.identify":
            self.identity = p
            return {"jsonrpc": "2.0", "id": rid, "result": {"connection_id": 1}}
        if m == "connection.send_event":
            self.events.append(p)
            return {"jsonrpc": "2.0", "id": rid, "result": "ok"}
        if m == "server.database.get_item":
            k = (p["namespace"], p["key"])
            if k not in self.db:
                return {"jsonrpc": "2.0", "id": rid, "error": {"code": 404, "message": "Key not found"}}
            return {"jsonrpc": "2.0", "id": rid, "result": {"namespace": p["namespace"], "key": p["key"], "value": self.db[k]}}
        return {"jsonrpc": "2.0", "id": rid, "error": {"code": -32601, "message": "Method not found"}}


class Base(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.sock = os.path.join(self.dir, "moonraker.sock")
        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)
        self.mr = FakeMoonraker(self.sock)
        self.loop.run_until_complete(self.mr.start())

    def tearDown(self):
        self.loop.run_until_complete(self.mr.stop())
        self.loop.close()
        shutil.rmtree(self.dir, ignore_errors=True)

    def run_async(self, coro, timeout=5):
        return self.loop.run_until_complete(asyncio.wait_for(coro, timeout))


class SafetyTest(unittest.TestCase):
    def test_printer_control_is_blocked(self):
        for m in ("printer.gcode.script", "printer.print.start", "printer.print.pause", "printer.print.cancel",
                  "printer.emergency_stop", "printer.restart", "printer.firmware_restart", "machine.reboot",
                  "machine.shutdown", "machine.services.restart", "server.files.delete_file", "machine.update.full"):
            with self.assertRaises(safety.SafetyError, msg=m):
                safety.check(m, {})

    def test_database_writes_only_own_namespace(self):
        safety.check("server.database.post_item", {"namespace": "vyron_ui", "key": "x", "value": 1})
        safety.check("server.database.post_item", {"namespace": "vyron_core", "key": "x", "value": 1})
        for ns in ("mainsail", "fluidd", "moonraker", None, 5):
            with self.assertRaises(safety.SafetyError):
                safety.check("server.database.post_item", {"namespace": ns, "key": "x", "value": 1})

    def test_reads_allowed(self):
        safety.check("printer.objects.query", {"objects": {"print_stats": None}})
        safety.check("server.database.get_item", {"namespace": "mainsail", "key": "x"})


class ClientTest(Base):
    def test_identifies_as_agent(self):
        c = MoonrakerClient(self.sock)
        self.run_async(c.connect())
        self.assertEqual(self.mr.identity["type"], "agent")
        self.assertEqual(self.mr.identity["client_name"], "vyron-core")
        self.run_async(c.close())

    def test_blocked_call_never_reaches_moonraker(self):
        c = MoonrakerClient(self.sock)
        self.run_async(c.connect())
        before = list(self.mr.calls)
        with self.assertRaises(safety.SafetyError):
            self.run_async(c.call("printer.gcode.script", {"script": "G28"}))
        self.run_async(asyncio.sleep(0.05))
        self.assertEqual(self.mr.calls, before)
        self.run_async(c.close())

    def test_connection_loss_is_detected(self):
        c = MoonrakerClient(self.sock)
        self.run_async(c.connect())
        self.mr.drop_clients()
        self.run_async(c.closed)
        self.assertFalse(c.connected)
        self.run_async(c.close())


class DesignSyncTest(Base):
    def test_broadcasts_once_per_change(self):
        self.mr.db[("vyron_ui", "design")] = {"updated": 100, "accent": "#ff6b5a"}
        c = MoonrakerClient(self.sock)
        self.run_async(c.connect())
        task = self.loop.create_task(DesignSync(interval=0.05).run(c))
        self.run_async(asyncio.sleep(0.2))
        self.assertEqual(self.mr.events, [], "no event for the design that was already there")
        self.mr.db[("vyron_ui", "design")] = {"updated": 200, "accent": "#3a7bfd"}
        self.run_async(asyncio.sleep(0.3))
        self.assertEqual(self.mr.events, [{"event": "design_changed", "data": {"updated": 200}}])
        task.cancel()
        self.run_async(c.close())

    def test_missing_design_is_quiet(self):
        c = MoonrakerClient(self.sock)
        self.run_async(c.connect())
        task = self.loop.create_task(DesignSync(interval=0.05).run(c))
        self.run_async(asyncio.sleep(0.2))
        self.assertEqual(self.mr.events, [])
        self.assertFalse(task.done(), "keeps running while the design record does not exist")
        task.cancel()
        self.run_async(c.close())


if __name__ == "__main__":
    unittest.main()
