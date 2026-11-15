"""Білий список викликів Moonraker — гарантія, що Vyron Core не втручається в роботу принтера.

Кожен виклик ядра проходить через check(). Дозволено лише:
  * читати стан (інформація, об'єкти Klipper, база даних);
  * писати й видаляти записи бази тільки у власних просторах імен, що починаються з "vyron";
  * ідентифікуватися як агент і розсилати події клієнтам.

Усе інше — G-code, старт/пауза/скасування друку, аварійна зупинка, перезапуски Klipper і хоста,
служби, файли, оновлення — заблоковано. Новий метод потрапляє сюди лише свідомим рішенням
з окремим перемикачем у vyron.conf (наприклад, майбутня автопауза) і тестом.
"""

READ_ONLY = frozenset({
    "server.info",
    "server.config",
    "printer.info",
    "printer.objects.list",
    "printer.objects.query",
    "printer.objects.subscribe",
    "server.database.list",
    "server.database.get_item",
    "server.history.list",
    "server.history.totals",
})

AGENT = frozenset({
    "server.connection.identify",
    "connection.send_event",
})

DB_WRITE = frozenset({
    "server.database.post_item",
    "server.database.delete_item",
})

OWN_NAMESPACE_PREFIX = "vyron"


class SafetyError(Exception):
    """Спроба викликати метод, якого ядру не дозволено."""


def check(method, params=None):
    """Пропускає дозволений виклик; інакше кидає SafetyError і нічого не надсилається."""
    if method in READ_ONLY or method in AGENT:
        return
    if method in DB_WRITE:
        ns = (params or {}).get("namespace")
        if isinstance(ns, str) and ns.startswith(OWN_NAMESPACE_PREFIX):
            return
        raise SafetyError("Vyron Core may only write its own database namespaces (vyron*), not %r" % (ns,))
    raise SafetyError("Vyron Core is not allowed to call %r" % (method,))
