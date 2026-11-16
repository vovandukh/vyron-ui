#!/usr/bin/env bash
# Vyron — видалення. Повертає принтер до стану «до Vyron»:
#   - прибирає сайт nginx «vyron», повертає Mainsail/Fluidd на їхній порт (80) і стандартний сайт nginx, якщо його вимикали;
#   - прибирає [update_manager vyron] з moonraker.conf (з копією файлу);
#   - зупиняє й прибирає службу Vyron Core, якщо вона є.
# Теку репозиторію не видаляє (тільки з --purge). Klipper і printer.cfg не чіпає.
#
#   ~/vyron/install/uninstall.sh [--dry-run] [--purge]
set -euo pipefail

DRY=0
PURGE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY=1 ;;
    --purge) PURGE=1 ;;
    -h|--help) sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Невідомий параметр: $1" >&2; exit 2 ;;
  esac
  shift
done

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=lib.sh
. "$REPO/install/lib.sh"

say "Vyron — видалення$([ $DRY = 1 ] && echo ' (dry-run: нічого не змінюю)')"
preflight

# ---------- Vyron Core ----------
say "1. Vyron Core"
if [ -f /etc/systemd/system/vyron-core.service ]; then
  if [ -f "$REPO/core/uninstall.sh" ]; then
    run bash "$REPO/core/uninstall.sh"
  else
    run sudo systemctl disable --now vyron-core.service
    run sudo rm -f /etc/systemd/system/vyron-core.service
    run sudo systemctl daemon-reload
  fi
  ok "службу vyron-core прибрано"
else
  info "службу не встановлено"
fi

# ---------- екран: повернути KlipperScreen ----------
if [ -f /etc/systemd/system/vyron-screen.service ] || [ -e /etc/nginx/sites-enabled/vyron-screen ]; then
  if [ $DRY = 1 ]; then bash "$REPO/install/screen.sh" --remove --dry-run; else bash "$REPO/install/screen.sh" --remove; fi
fi

# ---------- nginx ----------
say "2. Сайт nginx"
SITE_AV=/etc/nginx/sites-available/vyron
SITE_EN=/etc/nginx/sites-enabled/vyron
MOVED="$(state_get MOVED)"
DISABLED="$(state_get DISABLED)"

# Без запису стану (встановлення вручну): Mainsail/Fluidd не на 80, а сайт vyron є — повернути на 80
if [ -z "$MOVED" ] && [ -e "$SITE_EN" ] && listens_on "$(readlink -f "$SITE_EN")" 80; then
  for f in /etc/nginx/sites-enabled/*; do
    [ -e "$f" ] || continue
    [ "$(basename "$f")" = vyron ] && continue
    real="$(readlink -f "$f")"
    is_web_ui "$real" || continue
    p="$(listen_port "$real")"
    [ -n "$p" ] && [ "$p" != 80 ] && MOVED="$MOVED $real|80|$p"
  done
fi

UNDO=()
if [ -e "$SITE_EN" ] || [ -e "$SITE_AV" ]; then
  info "прибираю $SITE_EN і $SITE_AV (копія: $(backup_name "$SITE_AV"))"
  if [ $DRY = 0 ]; then
    if [ -f "$SITE_AV" ]; then
      b="$(backup_name "$SITE_AV")"; sudo mv "$SITE_AV" "$b"
      UNDO+=("sudo mv $(printf %q "$b") $(printf %q "$SITE_AV")")
    fi
    if [ -L "$SITE_EN" ] || [ -e "$SITE_EN" ]; then
      sudo rm -f "$SITE_EN"; UNDO+=("sudo ln -sfn $(printf %q "$SITE_AV") $(printf %q "$SITE_EN")")
    fi
  fi
else
  info "сайту vyron немає"
fi

for m in $MOVED; do
  file="${m%%|*}"; rest="${m#*|}"; from="${rest%%|*}"; to="${rest#*|}"
  [ -f "$file" ] || { warn "$file не знайдено — пропускаю"; continue; }
  info "$(basename "$file"): порт $to → $from"
  if [ $DRY = 0 ]; then
    b="$(backup_name "$file")"; sudo cp -a "$file" "$b"
    UNDO+=("sudo cp -a $(printf %q "$b") $(printf %q "$file")")
    sudo sed -i -E "s/^([[:space:]]*listen[[:space:]]+(\[::\]:)?)$to([[:space:];])/\1$from\3/" "$file"
  fi
done
for d in $DISABLED; do
  link="${d%%|*}"; target="${d#*|}"
  [ -f "$target" ] || continue
  info "повертаю стандартний сайт nginx $link"
  if [ $DRY = 0 ]; then sudo ln -sfn "$target" "$link"; UNDO+=("sudo rm -f $(printf %q "$link")"); fi
done

if [ $DRY = 0 ]; then
  if sudo nginx -t >/dev/null 2>&1; then
    sudo systemctl reload nginx
    ok "nginx перезавантажено"
  else
    warn "nginx не прийняв конфігурацію — повертаю як було:"
    sudo nginx -t 2>&1 | sed 's/^/      /' || true
    for ((i=${#UNDO[@]}-1; i>=0; i--)); do eval "${UNDO[$i]}"; done
    die "Сайт nginx не змінено. Решту кроків пропущено."
  fi
  if [ "$(state_get HOME_OX)" = 1 ]; then sudo chmod o-x "$USER_HOME"; fi
fi

# ---------- moonraker.conf ----------
say "3. Update Manager (moonraker.conf)"
MR_CHANGED=0
if grep -qxF "$MARK_BEGIN" "$MR_CONF"; then
  b="$(backup_name "$MR_CONF")"
  info "прибираю [update_manager vyron] (копія: $b)"
  if [ $DRY = 0 ]; then
    cp -a "$MR_CONF" "$b"
    NEW="$(mktemp)"; strip_block "$MR_CONF" | trim_tail > "$NEW"; cat "$NEW" > "$MR_CONF"; rm -f "$NEW"
    MR_CHANGED=1
  fi
else
  info "запису немає"
fi
ASVC="$DATA/moonraker.asvc"
if [ -f "$ASVC" ] && grep -qx "vyron-core" "$ASVC"; then
  info "прибираю vyron-core з moonraker.asvc"
  if [ $DRY = 0 ]; then sed -i '/^vyron-core$/d' "$ASVC"; MR_CHANGED=1; fi
fi
if [ $MR_CHANGED = 1 ]; then
  if printer_busy; then
    warn "Іде друк — Moonraker не перезапускаю. Після друку: sudo systemctl restart moonraker"
  else
    sudo systemctl restart moonraker && ok "Moonraker перезапущено"
  fi
fi

[ $DRY = 1 ] || rm -f "$STATE"

# ---------- тека ----------
if [ $PURGE = 1 ]; then
  say "4. Тека $REPO"
  run rm -rf "$REPO"
fi

IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
say "Готово$([ $DRY = 1 ] && echo ' (dry-run — нічого не змінено)')"
info "Mainsail знову на http://${IP:-<IP принтера>}/"
[ $PURGE = 1 ] || info "Тека $REPO лишилась — видалити: rm -rf $REPO"
