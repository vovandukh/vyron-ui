#!/usr/bin/env bash
# Vyron Screen на екрані принтера замість KlipperScreen.
#
#   ~/vyron-ecosystem/install/screen.sh             — поставити Vyron Screen на екран
#   ~/vyron-ecosystem/install/screen.sh --dry-run   — лише показати, що буде зроблено
#   ~/vyron-ecosystem/install/screen.sh --remove    — повернути KlipperScreen
#
# Що робить:
#   1. Локальний сайт nginx «vyron-screen» на 127.0.0.1:7136 (лише для екрана; з мережі недоступний,
#      Mainsail і сайт vyron не чіпає). Окремий install.sh для цього не потрібен.
#   2. Браузер Chromium (apt), якщо його ще немає.
#   3. Служба vyron-screen: Chromium на весь екран з тими самими налаштуваннями дисплея й тачу, що
#      й у KlipperScreen. KlipperScreen лише вимикається (не видаляється); якщо Vyron Screen не
#      запуститься — KlipperScreen повертається автоматично.
# Klipper, Moonraker, printer.cfg не чіпає, принтер не рухає й не гріє.
set -euo pipefail

DRY=0
REMOVE=0
LPORT=7136
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY=1 ;;
    --remove|--uninstall) REMOVE=1 ;;
    -h|--help) sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Невідомий параметр: $1 (див. --help)" >&2; exit 2 ;;
  esac
  shift
done

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=lib.sh
. "$REPO/install/lib.sh"

UNIT=/etc/systemd/system/vyron-screen.service
SITE_AV=/etc/nginx/sites-available/vyron-screen
SITE_EN=/etc/nginx/sites-enabled/vyron-screen
URL="http://127.0.0.1:$LPORT/screen.html"
KS=KlipperScreen.service
has_ks() { systemctl list-unit-files "$KS" 2>/dev/null | grep -q "^$KS"; }

# ---------- повернути KlipperScreen ----------
if [ $REMOVE = 1 ]; then
  say "Vyron Screen — повернення KlipperScreen$([ $DRY = 1 ] && echo ' (dry-run)')"
  preflight
  if [ -f "$UNIT" ]; then
    run sudo systemctl disable --now vyron-screen.service
    run sudo rm -f "$UNIT"
    run sudo systemctl daemon-reload
    run sudo systemctl reset-failed vyron-screen.service || true
    ok "службу vyron-screen прибрано"
  fi
  if has_ks; then
    run sudo systemctl enable "$KS"
    run sudo systemctl restart "$KS"
    ok "KlipperScreen увімкнено"
  fi
  if [ -e "$SITE_EN" ] || [ -e "$SITE_AV" ]; then
    run sudo rm -f "$SITE_EN" "$SITE_AV"
    if [ $DRY = 0 ]; then sudo nginx -t >/dev/null 2>&1 && sudo systemctl reload nginx; fi
    ok "локальний сайт vyron-screen прибрано"
  fi
  state_set SCREEN 0
  info "Chromium лишився встановленим. Видалити: sudo apt remove chromium"
  exit 0
fi

# ---------- встановлення ----------
say "Vyron Screen — на екран принтера$([ $DRY = 1 ] && echo ' (dry-run: нічого не змінюю)')"
preflight
[ -f "$REPO/screen.html" ] || die "У $REPO немає screen.html — онови репозиторій (git pull)."
has_ks || die "Не знайдено KlipperScreen. Від нього беремо налаштування дисплея й тачскріна — спершу встанови KlipperScreen (KIAUH) і переконайся, що екран працює."
[ -x /usr/bin/xinit ] || die "Не знайдено xinit (пакет xinit)."
UID_N="$(id -u "$USER_NAME")"

info "екран:        $(for f in /sys/class/graphics/fb*; do [ -e "$f/name" ] && printf '%s(%s %s) ' "$(basename "$f")" "$(cat "$f/name")" "$(cat "$f/virtual_size" 2>/dev/null)"; done)"
info "пам'ять:      $(free -m | awk '/^Mem:/{print $2" МБ, вільно "$7" МБ"}')"
info "сторінка:     $URL"

# Групи, з якими працює KlipperScreen (доступ до дисплея, тачу, вимкнення) — даємо ті самі
KS_USER="$(systemctl show -p User --value "$KS" 2>/dev/null || true)"
KS_GROUPS="$(systemctl show -p SupplementaryGroups --value "$KS" 2>/dev/null || true)"
[ -z "$KS_USER" ] || [ "$KS_USER" = "$USER_NAME" ] || warn "KlipperScreen працює від користувача $KS_USER, а Vyron Screen буде від $USER_NAME"

# 1. nginx
say "1. Локальний сайт nginx (127.0.0.1:$LPORT)"
if port_busy "$LPORT" && [ ! -e "$SITE_EN" ]; then die "Порт $LPORT уже зайнятий іншою програмою."; fi
CONF="$(mktemp)"; UNITF="$(mktemp)"
trap 'rm -f "$CONF" "$UNITF"' EXIT
sed -e "s|@PORT@|$LPORT|g" -e "s|@ROOT@|$REPO|g" -e "s|@MOONRAKER_PORT@|$MR_PORT|g" "$REPO/install/nginx-vyron-screen.conf" > "$CONF"
if [ $DRY = 1 ]; then
  info "буде створено $SITE_AV (слухає лише 127.0.0.1:$LPORT)"
else
  HAD=0; [ -f "$SITE_AV" ] && HAD=1 && sudo cp -a "$SITE_AV" "$(backup_name "$SITE_AV")"
  sudo install -m 644 "$CONF" "$SITE_AV"
  sudo ln -sfn "$SITE_AV" "$SITE_EN"
  case "$(stat -c %A "$USER_HOME")" in *[xt]) ;; *) sudo chmod o+x "$USER_HOME"; state_set HOME_OX 1 ;; esac
  if sudo nginx -t >/dev/null 2>&1; then
    sudo systemctl reload nginx
  else
    sudo nginx -t 2>&1 | sed 's/^/      /' || true
    if [ $HAD = 1 ]; then sudo cp -a "$(backup_name "$SITE_AV")" "$SITE_AV"; else sudo rm -f "$SITE_AV" "$SITE_EN"; fi
    die "nginx не прийняв конфігурацію — нічого не змінено."
  fi
  for i in 1 2 3 4 5; do
    code="$(curl -s -o /dev/null -w '%{http_code}' "$URL" || true)"; [ "$code" = 200 ] && break; sleep 1
  done
  [ "$code" = 200 ] || die "Сторінка $URL не відкривається (код $code)."
  ok "сторінка відкривається"
  # Moonraker міг щойно перезапуститися (install.sh) — чекаємо до 30 с
  for i in $(seq 1 15); do
    api="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$LPORT/server/info" || true)"; [ "$api" = 200 ] && break; sleep 2
  done
  if [ "$api" = 200 ]; then ok "Moonraker відповідає"
  else warn "Moonraker через локальний сайт відповідає кодом $api — екран підключиться, щойно Moonraker запрацює"; fi
fi

# 2. Chromium
say "2. Браузер"
if command -v chromium >/dev/null || command -v chromium-browser >/dev/null; then
  ok "Chromium уже встановлено"
else
  has_pkg() { apt-cache policy "$1" 2>/dev/null | grep -q 'Candidate: [0-9]'; }
  FREE_MB="$(df -m / | awk 'NR==2{print $4}')"
  [ "$FREE_MB" -gt 600 ] || die "Мало місця на диску: вільно $FREE_MB МБ, для Chromium треба ~600 МБ."
  # На свіжій системі списки пакетів apt ще порожні — спершу оновити їх, потім шукати Chromium
  if ! has_pkg chromium && ! has_pkg chromium-browser; then
    if [ $DRY = 1 ]; then
      info "списки пакетів apt ще не оновлені — під час встановлення виконаю apt-get update і поставлю chromium"
    else
      info "оновлюю списки пакетів (apt-get update)…"
      sudo apt-get update -qq || warn "apt-get update завершився з помилкою — пробую далі"
    fi
  fi
  PKG=chromium
  has_pkg chromium || PKG=chromium-browser
  if [ $DRY = 0 ] && ! has_pkg "$PKG"; then
    die "У репозиторіях системи немає Chromium (пакет chromium). Перевір: apt-cache policy chromium"
  fi
  info "встановлюю $PKG (~100 МБ завантаження, кілька хвилин)"
  run sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends "$PKG" x11-xserver-utils x11-utils
fi

# 3. служба
say "3. Служба vyron-screen (замість KlipperScreen)"
GROUPS_LINE=""; [ -n "$KS_GROUPS" ] && GROUPS_LINE="SupplementaryGroups=$KS_GROUPS"
sed -e "s|@USER@|$USER_NAME|g" -e "s|@UID@|$UID_N|g" -e "s|@GROUPS@|$GROUPS_LINE|" \
    -e "s|@KIOSK@|$REPO/install/screen-kiosk.sh|g" -e "s|@URL@|$URL|g" "$REPO/install/vyron-screen.service" > "$UNITF"
if [ $DRY = 1 ]; then
  info "$UNIT буде таким:"; sed 's/^/      | /' "$UNITF"
  info "KlipperScreen: вимкнеться (не видаляється), на екрані запуститься Vyron Screen"
else
  chmod +x "$REPO/install/screen-kiosk.sh"
  sudo install -m 644 "$UNITF" "$UNIT"
  sudo systemctl daemon-reload
  sudo systemctl disable "$KS" >/dev/null 2>&1 || true
  sudo systemctl enable vyron-screen.service >/dev/null 2>&1
  sudo systemctl stop "$KS" || true
  sudo systemctl reset-failed vyron-screen.service 2>/dev/null || true
  sudo systemctl start vyron-screen.service
  state_set SCREEN 1
  info "чекаю запуску браузера (до 40 с)…"
  up=0
  for i in $(seq 1 20); do
    sleep 2
    if systemctl is-active --quiet vyron-screen.service && pgrep -u "$USER_NAME" -f 'vyron-screen' >/dev/null; then up=$((up+1)); [ $up -ge 4 ] && break; else up=0; fi
  done
  if [ $up -ge 4 ]; then
    ok "Vyron Screen працює на екрані"
  else
    warn "Vyron Screen не запустився — повертаю KlipperScreen. Журнал:"
    journalctl -u vyron-screen -n 25 --no-pager 2>/dev/null | sed 's/^/      /' || true
    sudo systemctl disable --now vyron-screen.service >/dev/null 2>&1 || true
    sudo systemctl enable "$KS" >/dev/null 2>&1 || true
    sudo systemctl start "$KS" || true
    state_set SCREEN 0
    die "KlipperScreen повернуто. Надішли журнал вище розробникам."
  fi
fi

say "Готово$([ $DRY = 1 ] && echo ' (dry-run — нічого не змінено)')"
info "Повернути KlipperScreen: $REPO/install/screen.sh --remove"
