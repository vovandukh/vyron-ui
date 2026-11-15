#!/usr/bin/env bash
# Встановлення Vyron Core як служби systemd.
#
#   ~/voron_ui/core/install.sh            — встановити й запустити
#   ~/voron_ui/core/install.sh --dry-run  — лише показати, що буде зроблено
#
# Що робить: створює /etc/systemd/system/vyron-core.service і запускає службу.
# Чого НЕ робить: не чіпає Klipper, Moonraker, printer.cfg, moonraker.conf, nginx. Нічого не завантажує
# з інтернету — ядро використовує лише стандартну бібліотеку Python.
set -euo pipefail

DRY=0
[ "${1:-}" = "--dry-run" ] && DRY=1

CORE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
USER_NAME="${SUDO_USER:-$(id -un)}"
USER_HOME="$(getent passwd "$USER_NAME" | cut -d: -f6)"
DATA="${PRINTER_DATA:-$USER_HOME/printer_data}"
UNIT=/etc/systemd/system/vyron-core.service

say() { printf '\033[1m%s\033[0m\n' "$*"; }
run() { if [ $DRY = 1 ]; then echo "  [dry-run] $*"; else "$@"; fi; }

say "Vyron Core — встановлення"
echo "  користувач:   $USER_NAME"
echo "  код ядра:     $CORE_DIR"
echo "  printer_data: $DATA"

if [ "$(id -u)" = 0 ] && [ -z "${SUDO_USER:-}" ]; then
  echo "Запусти від звичайного користувача (sudo буде запитано, коли треба)." >&2; exit 1
fi
command -v python3 >/dev/null || { echo "Не знайдено python3." >&2; exit 1; }
python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 7) else 1)' \
  || { echo "Потрібен Python 3.7 або новіший." >&2; exit 1; }
[ -d "$DATA" ] || { echo "Не знайдено $DATA. Вкажи шлях: PRINTER_DATA=/шлях $0" >&2; exit 1; }
[ -S "$DATA/comms/moonraker.sock" ] \
  || echo "  Увага: $DATA/comms/moonraker.sock поки немає — ядро підключиться, щойно Moonraker його створить."

say "Перевірка коду ядра"
(cd "$CORE_DIR" && python3 -c 'import vyron_core.app, vyron_core.__main__') || { echo "Код ядра не завантажується." >&2; exit 1; }

say "Служба systemd: $UNIT"
TMP="$(mktemp)"
sed -e "s|@USER@|$USER_NAME|g" -e "s|@CORE_DIR@|$CORE_DIR|g" -e "s|@DATA@|$DATA|g" "$CORE_DIR/vyron-core.service" > "$TMP"
if [ $DRY = 1 ]; then sed 's/^/  | /' "$TMP"; fi
run sudo install -m 644 "$TMP" "$UNIT"
rm -f "$TMP"
run sudo systemctl daemon-reload
run sudo systemctl enable --now vyron-core.service

if [ $DRY = 0 ]; then
  sleep 2
  if systemctl is-active --quiet vyron-core.service; then
    say "Готово: Vyron Core працює."
  else
    echo "Служба не запустилась. Журнал: journalctl -u vyron-core -n 50" >&2; exit 1
  fi
fi
echo "  журнал:   $DATA/logs/vyron-core.log"
echo "  видалити: $CORE_DIR/uninstall.sh"
