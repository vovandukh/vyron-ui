#!/bin/sh
# Vyron Screen — програма, яку xinit запускає на екрані принтера (замість KlipperScreen).
# Браузер на весь екран без рамок, курсору, підказок і перекладача. Налаштування дисплея й тачскріна
# (xorg.conf.d) — ті самі, що й у KlipperScreen.
URL="${1:-http://127.0.0.1:7136/screen.html}"

# Екран не гасне й не засинає
xset s off 2>/dev/null
xset s noblank 2>/dev/null
xset -dpms 2>/dev/null

for b in chromium chromium-browser; do
  command -v "$b" >/dev/null && BROWSER="$b" && break
done
[ -n "${BROWSER:-}" ] || { echo "vyron-screen: chromium не знайдено" >&2; exit 1; }

# Відеокарта: VYRON_GPU=1 (install.sh --gpu) — прискорення; інакше все малює процесор у легкому режимі
# (на CB1 і подібних браузер без цього не може створити WebGL і зайво навантажує процесор)
if [ "${VYRON_GPU:-0}" = 1 ]; then
  GPU_FLAGS="--ignore-gpu-blocklist --enable-gpu-rasterization"
else
  GPU_FLAGS="--disable-gpu --enable-low-end-device-mode"
fi

# Розмір екрана — щоб вікно точно стало на весь дисплей
SIZE="$(xdpyinfo 2>/dev/null | sed -n 's/.*dimensions: *\([0-9]*\)x\([0-9]*\).*/\1,\2/p')"

exec "$BROWSER" \
  --kiosk "$URL" \
  ${SIZE:+--window-size=$SIZE} --window-position=0,0 \
  --user-data-dir="$HOME/.config/vyron-screen" \
  --noerrdialogs --no-first-run --disable-infobars \
  --disable-session-crashed-bubble --hide-crash-restore-bubble \
  --password-store=basic --disable-translate --disable-features=Translate,TranslateUI \
  --check-for-update-interval=31536000 --disable-background-networking --disable-sync \
  --disable-pinch --overscroll-history-navigation=0 --touch-events=enabled \
  $GPU_FLAGS --renderer-process-limit=1
