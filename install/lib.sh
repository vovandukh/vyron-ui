# Спільні функції для install.sh / uninstall.sh. Не запускається сама по собі.
# shellcheck shell=bash

MARK_BEGIN="# >>> vyron: цей блок керується install/install.sh — не редагуй вручну >>>"
MARK_END="# <<< vyron <<<"
TS="$(date +%Y%m%d-%H%M%S)"

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
info() { printf '    %s\n' "$*"; }
ok()   { printf '    \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '    \033[33m!\033[0m %s\n' "$*" >&2; }
die()  { printf '\n\033[31mПомилка:\033[0m %s\n' "$*" >&2; exit 1; }
run()  { if [ "${DRY:-0}" = 1 ]; then info "[dry-run] $*"; else "$@"; fi; }

preflight() {
  [ "$(uname -s)" = Linux ] || die "Скрипт працює лише на Linux (на хості принтера)."
  if [ "$(id -u)" = 0 ] && [ -z "${SUDO_USER:-}" ]; then
    die "Запусти від звичайного користувача (наприклад biqu або pi) — sudo буде запитано, коли треба."
  fi
  USER_NAME="${SUDO_USER:-$(id -un)}"
  USER_HOME="$(getent passwd "$USER_NAME" | cut -d: -f6)"
  DATA="${PRINTER_DATA:-$USER_HOME/printer_data}"
  [ -d "$DATA" ] || die "Не знайдено $DATA. Вкажи шлях: PRINTER_DATA=/шлях $0"
  MR_CONF="$DATA/config/moonraker.conf"
  [ -f "$MR_CONF" ] || die "Не знайдено $MR_CONF."
  [ -d /etc/nginx/sites-enabled ] || die "Не знайдено nginx (/etc/nginx/sites-enabled). Спершу встанови Mainsail або Fluidd (KIAUH)."
  MR_PORT="$(awk '/^[[:space:]]*\[/{s=($0 ~ /^\[server\]/)} s && /^[[:space:]]*port[[:space:]]*[:=]/{v=$0; sub(/^[^:=]*[:=][[:space:]]*/,"",v); sub(/[[:space:]#].*$/,"",v); print v; exit}' "$MR_CONF")"
  MR_PORT="${MR_PORT:-7125}"
  STATE="$USER_HOME/.config/vyron/install.state"
  if [ "${DRY:-0}" = 0 ]; then sudo -v || die "Потрібен sudo."; fi
}

valid_port() { [[ "$1" =~ ^[0-9]+$ ]] && [ "$1" -ge 1 ] && [ "$1" -le 65535 ]; }
# Порти, які Chrome/Firefox відмовляються відкривати (ERR_UNSAFE_PORT)
unsafe_port() {
  case " 1 7 9 11 13 15 17 19 20 21 22 23 25 37 42 43 53 69 77 79 87 95 101 102 103 104 109 110 111 113 115 117 119 123 135 137 139 143 161 179 389 427 465 512 513 514 515 526 530 531 532 540 548 554 556 563 587 601 636 989 990 993 995 1719 1720 1723 2049 3659 4045 5060 5061 6000 6566 6665 6666 6667 6668 6669 6697 10080 " in
    *" $1 "*) return 0 ;;
  esac
  return 1
}

listens_on()  { grep -Eq "^[[:space:]]*listen[[:space:]]+(\[::\]:)?$2([[:space:];])" "$1"; }
listen_port() { sed -nE 's/^[[:space:]]*listen[[:space:]]+([0-9]+)[[:space:];].*/\1/p' "$1" | head -n1; }
is_web_ui()   { grep -Eiq '^[[:space:]]*root[[:space:]]+[^;]*(mainsail|fluidd)' "$1"; }
port_busy()   { command -v ss >/dev/null && [ -n "$(ss -ltnH "sport = :$1" 2>/dev/null)" ]; }
# Чи встановлена служба systemd (без конвеєра в grep -q: під pipefail це дає хибне «ні»)
has_unit()    { case "$(systemctl list-unit-files "$1" 2>/dev/null)" in *"$1"*) return 0 ;; esac; return 1; }
# Чи є пакет у репозиторіях apt
has_pkg()     { case "$(LC_ALL=C apt-cache policy "$1" 2>/dev/null)" in *"Candidate: "[0-9]*) return 0 ;; esac; return 1; }
backup_name() { echo "$1.vyron-bak-$TS"; }

# Чи йде друк (тоді Moonraker не перезапускаємо). Невідомо — вважаємо, що ні.
printer_busy() {
  command -v curl >/dev/null || return 1
  local r
  r="$(curl -fsS -m 3 "http://127.0.0.1:$MR_PORT/printer/objects/query?print_stats=state" 2>/dev/null)" || return 1
  [[ "$r" =~ \"state\":\ ?\"(printing|paused)\" ]]
}

# ---------- стан встановлення (що саме ми змінили — для uninstall) ----------
state_load() { [ -f "$STATE" ] || return 0; }
state_get() { [ -f "$STATE" ] && sed -n "s/^$1=//p" "$STATE" | tail -n1 || true; }
state_set() {
  [ "${DRY:-0}" = 1 ] && return 0
  mkdir -p "$(dirname "$STATE")"
  touch "$STATE"
  local tmp; tmp="$(mktemp)"
  grep -v "^$1=" "$STATE" > "$tmp" || true
  echo "$1=$2" >> "$tmp"
  cat "$tmp" > "$STATE"; rm -f "$tmp"
}

# ---------- moonraker.conf ----------
# Прибрати наш блок між маркерами
strip_block() { awk -v b="$MARK_BEGIN" -v e="$MARK_END" '$0==b{skip=1;next} $0==e{skip=0;next} !skip' "$1"; }
# Прибрати порожні рядки в кінці (stdin → stdout)
trim_tail() { awk '{a[NR]=$0} END{n=NR; while(n>0 && a[n] ~ /^[[:space:]]*$/) n--; for(i=1;i<=n;i++) print a[i]}'; }
# Назви секцій [update_manager X] (крім нашої), які вказують на ту саму теку — старі записи ручного встановлення
legacy_um_sections() {
  awk -v home="$USER_HOME" -v repo="$2" '
    /^[[:space:]]*\[/ { sec=""; if ($0 ~ /^\[update_manager[[:space:]]+[^]]+\]/) { s=$0; sub(/^\[update_manager[[:space:]]+/,"",s); sub(/\].*/,"",s); sec=s }; next }
    sec!="" && sec!="vyron" && /^[[:space:]]*path[[:space:]]*[:=]/ {
      v=$0; sub(/^[^:=]*[:=][[:space:]]*/,"",v); sub(/[[:space:]]+$/,"",v); sub(/^~/,home,v); sub(/\/+$/,"",v)
      if (v==repo) print sec
    }' "$1"
}
# Прибрати секції [update_manager X] для X зі списку (stdin → stdout)
remove_sections() {
  awk -v names=" $1 " '
    /^[[:space:]]*\[/ { drop=0; if ($0 ~ /^\[update_manager[[:space:]]+[^]]+\]/) { s=$0; sub(/^\[update_manager[[:space:]]+/,"",s); sub(/\].*/,"",s); if (index(names, " " s " ")) drop=1 } }
    !drop { print }'
}
