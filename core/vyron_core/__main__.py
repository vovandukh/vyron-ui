"""Запуск: python3 -m vyron_core [-c ~/printer_data/config/vyron.conf] [-l ~/printer_data/logs/vyron-core.log]"""

import argparse
import asyncio
import logging
import logging.handlers
import os
import signal
import sys

from . import __version__
from .app import App
from .config import Config


def setup_logging(level, logfile):
    fmt = logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s")
    root = logging.getLogger()
    root.setLevel(getattr(logging, level.upper(), logging.INFO))
    out = logging.StreamHandler(sys.stderr)
    out.setFormatter(fmt)
    root.addHandler(out)
    if logfile:
        path = os.path.expanduser(logfile)
        if os.path.isdir(os.path.dirname(path) or "."):
            # Невеликий журнал з ротацією: не більше ~3 МБ на картці пам'яті принтера
            fh = logging.handlers.RotatingFileHandler(path, maxBytes=1 << 20, backupCount=2, encoding="utf-8")
            fh.setFormatter(fmt)
            root.addHandler(fh)


def main(argv=None):
    p = argparse.ArgumentParser(prog="vyron-core", description="Vyron Core — helper service that runs next to Moonraker")
    p.add_argument("-c", "--config", default="~/printer_data/config/vyron.conf")
    p.add_argument("-l", "--logfile", default="~/printer_data/logs/vyron-core.log")
    p.add_argument("--version", action="version", version=__version__)
    args = p.parse_args(argv)

    cfg = Config(args.config)
    setup_logging(cfg.get("core", "log_level"), args.logfile)
    log = logging.getLogger("vyron.core")
    log.info("Vyron Core %s starting (config: %s)", __version__, args.config if cfg.loaded else "defaults")

    app = App(cfg)
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    for sig in (signal.SIGTERM, signal.SIGINT):
        try:
            loop.add_signal_handler(sig, app.stop)
        except (NotImplementedError, RuntimeError):
            pass
    try:
        loop.run_until_complete(app.run())
    finally:
        loop.close()


if __name__ == "__main__":
    main()
