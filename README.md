# Vyron Ecosystem

Відкрита екосистема для 3D-принтерів на Klipper: вебінтерфейс і застосунок для сенсорного екрана принтера
в одному дизайні, плюс невелика служба на хості. Без підписок і хмар — усе працює на принтері через Moonraker.

**[Демо](https://vovandukh.github.io/vyron-demo/)** — працює в браузері без принтера.

> **Ранній проєкт.** Перевірено на кількох принтерах автора (Voron, CAN-голови, BTT TFT35). На іншому
> залізі можуть вилізти нюанси — пиши в [Issues](https://github.com/vovandukh/vyron-ecosystem/issues).
> Mainsail, Fluidd і KlipperScreen не видаляються, тож повернутися можна будь-коли.

*English: Vyron is a web UI and a touchscreen UI for Klipper printers sharing one design, talking only to Moonraker.
Early stage; the UI is available in Ukrainian and English. Install instructions below work the same way.*

| Частина | Тека | Що це |
|---|---|---|
| **Vyron Web** | [`apps/web`](apps/web) | Вебінтерфейс для ПК, планшета й телефона (Vue 3) |
| **Vyron Screen** | [`apps/screen`](apps/screen) | Застосунок для сенсорного екрана принтера (поки 480×320, TFT35) |
| **Vyron Core** | [`core`](core) | Служба на хості: миттєво доносить зміну теми й нову версію до всіх екранів |
| **@vyron/shared** | [`packages/shared`](packages/shared) | Спільна логіка Web і Screen: клієнт Moonraker, помилки Klipper, теми, переклади |
| **Встановлення** | [`install`](install) | `install.sh` / `uninstall.sh` |

## Встановлення

**Що потрібно:** принтер із Klipper, Moonraker і Mainsail або Fluidd (звичайна установка через KIAUH).
Команди виконуються на принтері через SSH (наприклад, `ssh pi@192.168.1.50` — логін і IP твої).

```bash
cd ~ && git clone -b stable https://github.com/vovandukh/vyron-ecosystem.git
~/vyron-ecosystem/install/install.sh --dry-run   # подивитися, що буде зроблено (нічого не змінює)
~/vyron-ecosystem/install/install.sh             # встановити
```

Скрипт може попросити пароль (для `sudo`). Після встановлення:

| Що | Адреса |
|---|---|
| Vyron Web | `http://IP-принтера/` |
| Vyron Screen | на екрані принтера замість KlipperScreen; у браузері — `http://IP-принтера/screen.html` |

Mainsail/Fluidd і KlipperScreen лише ховаються. Якщо Vyron Screen на екрані не запуститься, скрипт сам
поверне KlipperScreen.

- Mainsail потрібен поруч — `--mainsail-port 66` (буде на `http://IP-принтера:66/`).
- Екран не чіпати — `--no-screen`.
- Уперше скрипт докачує Chromium для екрана (~100 МБ, кілька хвилин).

Скрипт не чіпає Klipper і `printer.cfg`, не рухає принтер і не гріє. Кожен змінений файл спершу копіюється
(`*.vyron-bak-ДАТА`). Під час друку Moonraker не перезапускається. Усі параметри — у [install/README.md](install/README.md).

## Оновлення і канали

Оновлення — через Update Manager: у Vyron → Налаштування → Оновлення → `vyron` (або в Mainsail/Fluidd).

| Канал | Гілка | Що приходить |
|---|---|---|
| **stable** | `stable` | Перевірені випуски ([Releases](https://github.com/vovandukh/vyron-ecosystem/releases)). Для звичайного користування. |
| **dev** | `main` | Кожна зміна одразу після збірки. Для тих, хто хоче тестувати нове й готовий до багів. |

Перемкнути канал:

```bash
~/vyron-ecosystem/install/install.sh --dev      # на dev
~/vyron-ecosystem/install/install.sh --stable   # назад на stable
```

## Видалення

Повертає все як було (Mainsail знову на `http://IP-принтера/`, KlipperScreen на екрані):

```bash
~/vyron-ecosystem/install/uninstall.sh --purge
```

## Як це влаштовано

Web і Screen працюють лише через API Moonraker — як Mainsail і Fluidd. Друк веде Klipper сам, тож якщо
інтерфейс зависне чи впаде, друк це не зачепить. Спільні налаштування (тема, прозорість скла) лежать у базі
Moonraker на принтері, тому тема, змінена в браузері, одразу діє і на екрані принтера.

Vyron Core підключається до Moonraker як агент і лише повідомляє клієнтам про зміни. Він має список дозволених
викликів: керувати друком, нагрівом, рухом чи файлами не може.

## Розробка

npm workspaces: одна команда в корені встановлює залежності всіх JS-частин.

```bash
npm install
npm run dev          # Vyron Web з проксі на принтер (PRINTER_URL у apps/web/.env.local)
npm run build        # Web → apps/web/dist/
npm run build:screen # Screen → apps/screen/dist/
npm run build:demo   # демо → apps/web/dist-demo/
python3 -m unittest discover -s core/tests   # тести Vyron Core
```

Після кожного push у `main` CI збирає Web і Screen в однофайлові `index.html` і `screen.html` у корені
репозиторію — їх віддає nginx на принтері. Випуск у `stable` — вручну: Actions → **Release to stable**
(ставить тег `vX`, переводить `stable` і створює GitHub Release).

Код пишеться не без допомоги Claude (AI): ідея, дизайн, рішення й тестування на залізі — автора.

## Ліцензія

[GPL-3.0](LICENSE) — як у Mainsail. Можна користуватися, змінювати й поширювати; похідні проєкти мають
лишатися відкритими під тією самою ліцензією.
