#!/usr/bin/env bash
# Vyron — встановлення на принтер (Klipper + Moonraker + nginx).
#
#   ~/vyron-ui/install/install.sh             — встановити або полагодити (можна запускати повторно)
#   ~/vyron-ui/install/install.sh --dry-run   — лише показати, що буде зроблено
#
# Що робить:
#   1. Сайт nginx «vyron»: Vyron Web на http://IP/ (порт 80), Vyron Screen на http://IP/screen.html.
#      Mainsail/Fluidd приховує — вимикає їхні сайти nginx (файли й оновлення не чіпає, uninstall поверне).
#      З --mainsail-port N Mainsail не ховається, а переїжджає на порт N.
#      З --port N Vyron стає на власний порт, а Mainsail лишається як був.
#   2. Запис [update_manager vyron] у moonraker.conf — оновлення з Mainsail/Vyron одним кліком.
#   3. Служба Vyron Core (миттєва синхронізація теми й оновлень між екранами); --no-core — без неї.
#   4. Екран принтера: Vyron Screen замість KlipperScreen (KlipperScreen лише ховається; див. screen.sh).
# Чого НЕ робить: не чіпає Klipper, printer.cfg, не рухає принтер і не гріє. Усе, що змінює, спершу
# копіює в резервні файли; якщо nginx не приймає нову конфігурацію — усе повертається назад.
# Видалити: install/uninstall.sh
set -euo pipefail

PORT=80
MAINSAIL_PORT=""
DRY=0
UPDATES=1
CORE=1
SCREEN=1
CHANNEL=""
SCREEN_ARGS=()
ARGS=("$@")

usage() { sed -n '2,17p' "$0" | sed 's/^# \{0,1\}//'; cat <<'EOF'
Параметри:
  --dry-run           нічого не змінювати, лише показати кроки
  --port N            порт для Vyron (за замовчуванням 80); якщо не 80 — Mainsail не чіпається
  --mainsail-port N   не ховати Mainsail/Fluidd, а перенести на порт N (наприклад 66)
  --no-updates        не додавати запис в Update Manager
  --no-core           не встановлювати службу Vyron Core
  --no-screen         не чіпати екран принтера (KlipperScreen лишається)
  --gpu               плата з відеокартою (Raspberry Pi 4/5, CM4, Orange Pi 5): прискорення для екрана.
                      Без нього (за замовчуванням) екран малює процесор — для CB1, Pi 3, SPI-екранів
  --no-gpu            вимкнути прискорення, якщо раніше ставили з --gpu
  --screen-app web    ЕКСПЕРИМЕНТАЛЬНО, лише разом з --gpu: на екрані принтера повний Vyron Web (з 3D)
                      замість Vyron Screen. Назад: --screen-app screen
  --channel stable|dev  канал оновлень: stable — перевірені випуски (гілка stable),
                      dev — кожна зміна одразу (гілка main). Без параметра — канал поточної гілки.
  --stable / --dev    те саме коротше
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY=1 ;;
    --port) PORT="${2:-}"; shift ;;
    --mainsail-port) MAINSAIL_PORT="${2:-}"; shift ;;
    --no-updates) UPDATES=0 ;;
    --core) CORE=1 ;;
    --no-core) CORE=0 ;;
    --no-screen) SCREEN=0 ;;
    --gpu) SCREEN_ARGS+=(--gpu) ;;
    --no-gpu) SCREEN_ARGS+=(--no-gpu) ;;
    --screen-app) SCREEN_ARGS+=(--app "${2:-}"); shift ;;
    --channel) CHANNEL="${2:-}"; shift ;;
    --stable) CHANNEL=stable ;;
    --dev) CHANNEL=dev ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Невідомий параметр: $1 (див. --help)" >&2; exit 2 ;;
  esac
  shift
done

# ---------- спільне ----------
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=lib.sh
. "$REPO/install/lib.sh"

say "Vyron — встановлення$([ $DRY = 1 ] && echo ' (dry-run: нічого не змінюю)')"
preflight
valid_port "$PORT" || die "Порт Vyron «$PORT» некоректний."
unsafe_port "$PORT" && die "Порт $PORT браузери блокують як небезпечний — обери інший."
# Режим для Mainsail/Fluidd: hide — вимкнути; move — перенести на MAINSAIL_PORT; keep — не чіпати (Vyron не на 80)
if [ "$PORT" != 80 ]; then
  MODE=keep
  [ -z "$MAINSAIL_PORT" ] || warn "--mainsail-port ігнорується: Vyron стає на порт $PORT, Mainsail лишається як був"
elif [ -n "$MAINSAIL_PORT" ]; then
  MODE=move
  valid_port "$MAINSAIL_PORT" || die "Порт Mainsail «$MAINSAIL_PORT» некоректний."
  unsafe_port "$MAINSAIL_PORT" && die "Порт $MAINSAIL_PORT браузери блокують як небезпечний — обери інший (наприклад 66 або 8081)."
  [ "$PORT" != "$MAINSAIL_PORT" ] || die "Порти Vyron і Mainsail мають бути різні."
else
  MODE=hide
fi

# ---------- канал оновлень: stable (гілка stable) або dev (гілка main) ----------
CUR_BRANCH="$(git -C "$REPO" symbolic-ref --short HEAD 2>/dev/null || true)"
case "$CHANNEL" in
  "") case "$CUR_BRANCH" in stable) CHANNEL=stable ;; *) CHANNEL=dev ;; esac ;;
  stable|dev) ;;
  *) die "Канал «$CHANNEL» невідомий — stable або dev." ;;
esac
WANT_BRANCH="$([ "$CHANNEL" = stable ] && echo stable || echo main)"
TARGET_BRANCH="${CUR_BRANCH:-main}"  # гілка, на якій репозиторій буде після цього кроку
if [ -n "$CUR_BRANCH" ] && [ "$CUR_BRANCH" != "$WANT_BRANCH" ] && { [ "$CHANNEL" = stable ] || [ "$CUR_BRANCH" = stable ]; }; then
  # Перемикаємо репозиторій на гілку каналу. Інша гілка розробки (не main/stable) з --dev лишається як є.
  say "Канал $CHANNEL: перемикаю $REPO з $CUR_BRANCH на $WANT_BRANCH"
  [ -z "$(git -C "$REPO" status --porcelain --untracked-files=no 2>/dev/null)" ] ||
    die "У $REPO є змінені файли — перемикання каналу їх затерло б. Збережи або скасуй зміни (git status)."
  TARGET_BRANCH="$WANT_BRANCH"
  if [ $DRY = 1 ]; then
    info "[dry-run] git fetch origin $WANT_BRANCH && git checkout -B $WANT_BRANCH origin/$WANT_BRANCH"
  else
    git -C "$REPO" fetch -q origin "$WANT_BRANCH" || die "Не вдалося завантажити гілку $WANT_BRANCH з GitHub."
    git -C "$REPO" checkout -q -B "$WANT_BRANCH" "origin/$WANT_BRANCH"
    git -C "$REPO" branch -q --set-upstream-to="origin/$WANT_BRANCH" "$WANT_BRANCH"
    ok "репозиторій на гілці $WANT_BRANCH"
    # Скрипт міг змінитися разом із гілкою — продовжуємо вже новою версією
    exec bash "$REPO/install/install.sh" "${ARGS[@]}"
  fi
fi
[ -f "$REPO/index.html" ] || die "У $REPO немає index.html — це не репозиторій Vyron або збірка ще не готова."
info "канал:        $CHANNEL (гілка $TARGET_BRANCH)"

info "репозиторій:  $REPO"
info "користувач:   $USER_NAME"
info "printer_data: $DATA"
info "Moonraker:    порт $MR_PORT"

state_load

# ---------- 1. nginx ----------
say "1. Сайт nginx"
SITE_AV=/etc/nginx/sites-available/vyron
SITE_EN=/etc/nginx/sites-enabled/vyron

# Інші сайти: Mainsail/Fluidd ховаємо (усі, на будь-якому порту) або переносимо з нашого порту;
# стандартний сайт nginx на нашому порту вимикаємо; чужі сайти не чіпаємо.
TO_MOVE=()
TO_DISABLE=()
for f in /etc/nginx/sites-enabled/*; do
  [ -e "$f" ] || continue
  [ "$(basename "$f")" = vyron ] && continue
  real="$(readlink -f "$f")"
  if is_web_ui "$real"; then
    if [ $MODE = hide ]; then TO_DISABLE+=("$f"); continue; fi
    listens_on "$real" "$PORT" || continue
    [ $MODE = move ] || die "Порт $PORT зайнятий $(basename "$f"). Обери вільний порт (--port)."
    TO_MOVE+=("$real")
  elif listens_on "$real" "$PORT"; then
    [ "$(basename "$f")" = default ] || die "Порт $PORT уже зайнятий сайтом $f (це не Mainsail/Fluidd). Запусти з --port 8080 або звільни порт."
    TO_DISABLE+=("$f")
  fi
done

# Перенесення Mainsail на MAINSAIL_PORT — лише коли Vyron займає 80
for real in "${TO_MOVE[@]+"${TO_MOVE[@]}"}"; do
  if port_busy "$MAINSAIL_PORT"; then
    die "Порт $MAINSAIL_PORT зайнятий іншою програмою — вкажи інший: --mainsail-port N"
  fi
  info "$(basename "$real"): порт $PORT → $MAINSAIL_PORT (копія: $(backup_name "$real"))"
done
for f in "${TO_DISABLE[@]+"${TO_DISABLE[@]}"}"; do info "$(basename "$f"): приховується — сайт nginx вимикається, файли лишаються (повернеться при видаленні)"; done

# Встановлення вручну (до цього скрипта): Mainsail уже на іншому порту — запам'ятати, щоб uninstall повернув його на 80
if [ "$PORT" = 80 ] && [ -z "$(state_get MOVED)" ]; then
  for f in /etc/nginx/sites-enabled/*; do
    [ -e "$f" ] || continue
    real="$(readlink -f "$f")"
    [ "$(basename "$f")" = vyron ] && continue
    is_web_ui "$real" || continue
    p="$(listen_port "$real")"
    if [ -n "$p" ] && [ "$p" != 80 ]; then
      info "$(basename "$real") уже на порту $p (перенесено раніше вручну) — запам'ятовую для відновлення"
      LEGACY_MOVED="$real|80|$p"
    fi
  done
fi

ROOT_OK=1
case "$(stat -c %A "$USER_HOME")" in
  *[xt]) ;;
  *) ROOT_OK=0
     warn "nginx не зможе зайти в $USER_HOME — додаю право на прохід (chmod o+x, без права читати список файлів)." ;;
esac

CONF="$(mktemp)"
trap 'rm -f "$CONF"' EXIT
DEF=""; [ "$PORT" = 80 ] && DEF=" default_server"
sed -e "s|@PORT@|$PORT|g" -e "s|@DEFAULT@|$DEF|g" -e "s|@ROOT@|$REPO|g" -e "s|@MOONRAKER_PORT@|$MR_PORT|g" \
  "$REPO/install/nginx-vyron.conf" > "$CONF"

if [ $DRY = 1 ]; then
  info "$SITE_AV буде таким:"; sed 's/^/      | /' "$CONF"
else
  UNDO=()
  # Старий сайт vyron (ручне встановлення) — у копію
  if [ -f "$SITE_AV" ] && ! cmp -s "$CONF" "$SITE_AV"; then
    b="$(backup_name "$SITE_AV")"; sudo cp -a "$SITE_AV" "$b"
    UNDO+=("sudo cp -a $(printf %q "$b") $(printf %q "$SITE_AV")")
  elif [ ! -f "$SITE_AV" ]; then
    UNDO+=("sudo rm -f $(printf %q "$SITE_AV") $(printf %q "$SITE_EN")")
  fi
  sudo install -m 644 "$CONF" "$SITE_AV"
  sudo ln -sfn "$SITE_AV" "$SITE_EN"

  MOVED_NOW=""
  for real in "${TO_MOVE[@]+"${TO_MOVE[@]}"}"; do
    b="$(backup_name "$real")"; sudo cp -a "$real" "$b"
    UNDO+=("sudo cp -a $(printf %q "$b") $(printf %q "$real")")
    sudo sed -i -E "s/^([[:space:]]*listen[[:space:]]+(\[::\]:)?)$PORT([[:space:];])/\1$MAINSAIL_PORT\3/" "$real"
    MOVED_NOW="$MOVED_NOW $real|$PORT|$MAINSAIL_PORT"
  done
  DISABLED_NOW=""
  for f in "${TO_DISABLE[@]+"${TO_DISABLE[@]}"}"; do
    t="$(readlink -f "$f")"
    UNDO+=("sudo ln -sfn $(printf %q "$t") $(printf %q "$f")")
    sudo rm -f "$f"
    DISABLED_NOW="$DISABLED_NOW $f|$t"
  done
  [ $ROOT_OK = 1 ] || sudo chmod o+x "$USER_HOME"

  if sudo nginx -t >/dev/null 2>&1; then
    sudo systemctl reload nginx
    ok "nginx прийняв конфігурацію й перезавантажився"
  else
    warn "nginx не прийняв нову конфігурацію — повертаю все назад:"
    sudo nginx -t 2>&1 | sed 's/^/      /' || true
    for ((i=${#UNDO[@]}-1; i>=0; i--)); do eval "${UNDO[$i]}"; done
    die "Нічого не змінено. Надішли текст помилки вище розробникам."
  fi
  state_set PORT "$PORT"
  ALL_MOVED="$MOVED_NOW ${LEGACY_MOVED:-}"
  [ -n "${ALL_MOVED// /}" ] && state_set MOVED "$(echo "$(state_get MOVED) $ALL_MOVED" | xargs)"
  [ -n "$DISABLED_NOW" ] && state_set DISABLED "$(echo "$(state_get DISABLED)$DISABLED_NOW" | xargs)"
  [ $ROOT_OK = 1 ] || state_set HOME_OX 1
fi

# ---------- 2. Update Manager ----------
MR_CHANGED=0
if [ $UPDATES = 1 ]; then
  say "2. Update Manager (moonraker.conf)"
  ORIGIN="$(git -C "$REPO" remote get-url origin 2>/dev/null || true)"
  BRANCH="$TARGET_BRANCH"
  if [ -z "$ORIGIN" ]; then
    warn "у $REPO немає git origin — пропускаю (оновлення вручну через git pull)"
  else
    BLOCK="$(mktemp)"
    {
      echo "$MARK_BEGIN"
      echo "[update_manager vyron]"
      echo "type: git_repo"
      echo "channel: dev"
      echo "path: $REPO"
      echo "origin: $ORIGIN"
      echo "primary_branch: $BRANCH"
      echo "$MARK_END"
    } > "$BLOCK"
    LEGACY="$(legacy_um_sections "$MR_CONF" "$REPO")"
    NEW="$(mktemp)"
    # Конфіг без нашого блоку й без старих записів на цей самий шлях, потім порожній рядок і наш блок
    strip_block "$MR_CONF" | remove_sections "$LEGACY" | trim_tail > "$NEW"
    [ -s "$NEW" ] && echo >> "$NEW"
    cat "$BLOCK" >> "$NEW"
    for s in $LEGACY; do info "старий запис [update_manager $s] з тим самим шляхом — прибираю (його замінює [update_manager vyron])"; done
    if cmp -s "$NEW" "$MR_CONF"; then
      ok "запис уже актуальний"
    elif [ $DRY = 1 ]; then
      info "буде додано в $MR_CONF:"; sed 's/^/      | /' "$BLOCK"
    else
      b="$(backup_name "$MR_CONF")"; cp -a "$MR_CONF" "$b"
      cat "$NEW" > "$MR_CONF"
      ok "додано [update_manager vyron] (копія старого файлу: $b)"
      MR_CHANGED=1
    fi
    # Старі встановлення додавали vyron-core в moonraker.asvc і managed_services — Moonraker такого не приймає
    # (попередження). Core тепер сам перезапускається, коли оновлюється його код, тож запис прибираємо.
    ASVC="$DATA/moonraker.asvc"
    if [ -f "$ASVC" ] && grep -qx "vyron-core" "$ASVC"; then
      info "прибираю vyron-core з moonraker.asvc (більше не потрібен)"
      [ $DRY = 1 ] || { sed -i '/^vyron-core$/d' "$ASVC"; MR_CHANGED=1; }
    fi
    rm -f "$BLOCK" "$NEW"
  fi
else
  say "2. Update Manager — пропущено (--no-updates)"
fi

# ---------- 3. Vyron Core ----------
if [ $CORE = 1 ]; then
  say "3. Vyron Core"
  if [ -f "$REPO/core/install.sh" ]; then
    if [ $DRY = 1 ]; then bash "$REPO/core/install.sh" --dry-run; else bash "$REPO/core/install.sh"; fi
    [ $DRY = 1 ] || state_set CORE 1
  else
    warn "у цій версії Vyron Core ще немає — пропускаю"
  fi
fi

# ---------- Moonraker: перечитати конфігурацію ----------
if [ $MR_CHANGED = 1 ]; then
  if printer_busy; then
    warn "Іде друк — Moonraker не перезапускаю. Після друку: sudo systemctl restart moonraker"
  else
    sudo systemctl restart moonraker && ok "Moonraker перезапущено (Klipper не перезапускався)"
  fi
fi

# ---------- 4. Екран принтера: Vyron Screen замість KlipperScreen ----------
SCREEN_RES="не змінювався (--no-screen)"
if [ $SCREEN = 1 ]; then
  say "4. Екран принтера"
  if ! has_unit KlipperScreen.service; then
    info "KlipperScreen не встановлено — екран не чіпаю"
    SCREEN_RES="немає KlipperScreen — не змінювався"
  elif [ $DRY = 1 ]; then
    if bash "$REPO/install/screen.sh" --dry-run ${SCREEN_ARGS[@]+"${SCREEN_ARGS[@]}"}; then SCREEN_RES="Vyron Screen замість KlipperScreen"
    else warn "перевірка екрана завершилась помилкою (див. вище)"; SCREEN_RES="перевірка не пройшла — див. вище"; fi
  elif bash "$REPO/install/screen.sh" ${SCREEN_ARGS[@]+"${SCREEN_ARGS[@]}"}; then
    SCREEN_RES="Vyron Screen (KlipperScreen приховано)"
  else
    # screen.sh сам повертає KlipperScreen, якщо щось не так; Vyron Web при цьому вже працює
    warn "Vyron Screen не запустився — на екрані лишився KlipperScreen. Решта встановлення в порядку."
    SCREEN_RES="KlipperScreen (Vyron Screen не запустився — див. вище)"
  fi
fi

# ---------- підсумок ----------
IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
URL="http://${IP:-<IP принтера>}$([ "$PORT" = 80 ] || echo ":$PORT")"
say "Готово$([ $DRY = 1 ] && echo ' (dry-run — нічого не змінено)')"
info "Vyron Web:    $URL/"
info "Vyron Screen: $URL/screen.html"
info "Екран:        $SCREEN_RES"
info "Оновлення:    канал $CHANNEL$([ "$CHANNEL" = stable ] && echo ' (перевірені випуски)' || echo ' (кожна зміна одразу)')"
if [ $MODE = hide ]; then
  info "Mainsail:     приховано (повернути: uninstall.sh, або встановити з --mainsail-port 66)"
elif [ $MODE = move ]; then
  info "Mainsail:     http://${IP:-<IP>}:$MAINSAIL_PORT/"
fi
info "Видалити:     $REPO/install/uninstall.sh"
