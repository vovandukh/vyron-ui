"""Налаштування з vyron.conf (поруч із printer.cfg). Файл необов'язковий — без нього діють значення за замовчуванням.

    [core]
    log_level: info

    [moonraker]
    socket: ~/printer_data/comms/moonraker.sock

    [design_sync]
    enabled: true
    interval: 2
"""

import configparser
import os

DEFAULTS = {
    "core": {"log_level": "info"},
    "moonraker": {"socket": "~/printer_data/comms/moonraker.sock"},
    "design_sync": {"enabled": "true", "interval": "2"},
}


class Config:
    def __init__(self, path=None):
        self.path = path
        self._cp = configparser.ConfigParser(interpolation=None)
        self._cp.read_dict(DEFAULTS)
        self.loaded = False
        if path and os.path.isfile(os.path.expanduser(path)):
            self._cp.read(os.path.expanduser(path), encoding="utf-8")
            self.loaded = True

    def get(self, section, key):
        return self._cp.get(section, key)

    def getbool(self, section, key):
        return self._cp.getboolean(section, key)

    def getfloat(self, section, key, minimum=None):
        v = self._cp.getfloat(section, key)
        return max(v, minimum) if minimum is not None else v

    def path_of(self, section, key):
        return os.path.expanduser(self.get(section, key))
