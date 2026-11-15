#!/usr/bin/env bash
# Видалення служби Vyron Core. Код, vyron.conf і журнал лишаються на місці.
set -euo pipefail
UNIT=/etc/systemd/system/vyron-core.service

if [ -f "$UNIT" ]; then
  sudo systemctl disable --now vyron-core.service || true
  sudo rm -f "$UNIT"
  sudo systemctl daemon-reload
  echo "Vyron Core зупинено й видалено зі служб."
else
  echo "Службу vyron-core не встановлено — нічого робити."
fi
