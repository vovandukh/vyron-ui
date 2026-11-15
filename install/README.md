# Встановлення Vyron

Потрібно: принтер із Klipper, Moonraker і nginx (стандартна установка Mainsail або Fluidd через KIAUH).

```bash
cd ~ && git clone https://github.com/vovandukh/vyron-ecosystem.git
~/vyron-ecosystem/install/install.sh --dry-run   # подивитися, що буде зроблено
~/vyron-ecosystem/install/install.sh             # встановити
```

Після встановлення:

| Що | Адреса |
|---|---|
| Vyron Web | `http://IP-принтера/` |
| Vyron Screen | `http://IP-принтера/screen.html` |
| Mainsail (перенесений) | `http://IP-принтера:66/` |

## Що робить `install.sh`

1. **Сайт nginx `vyron`** на порту 80. Mainsail/Fluidd, що стояли на 80, переходять на порт 66 —
   їхні файли й оновлення не змінюються. Віддаються лише готові сторінки (`*.html` у корені репозиторію),
   решта репозиторію назовні не видно.
2. **`[update_manager vyron]`** у `moonraker.conf` — оновлення через Mainsail або Vyron. Блок позначений
   маркерами; старий запис на цю саму теку (наприклад `[update_manager voron_ui]`) замінюється.
3. **Vyron Core** — лише з `--core`.

Не чіпає Klipper і `printer.cfg`, нічого не рухає й не гріє. Кожен змінений файл спершу копіюється
(`*.vyron-bak-ДАТА`). Якщо nginx не приймає нову конфігурацію — усе повертається назад.
Під час друку Moonraker не перезапускається. Скрипт можна запускати повторно — він лише полагодить
те, що зламалося (наприклад, якщо KIAUH повернув Mainsail на порт 80).

| Параметр | |
|---|---|
| `--dry-run` | нічого не змінювати, лише показати кроки |
| `--port N` | Vyron на власному порту; Mainsail лишається на 80 |
| `--mainsail-port N` | куди перенести Mainsail (за замовчуванням 66) |
| `--no-updates` | не додавати запис в Update Manager |
| `--core` | також встановити службу Vyron Core |

## Видалення

```bash
~/vyron-ecosystem/install/uninstall.sh --dry-run
~/vyron-ecosystem/install/uninstall.sh            # тека репозиторію лишається
~/vyron-ecosystem/install/uninstall.sh --purge    # і видалити теку
```

Повертає Mainsail на порт 80, прибирає сайт `vyron`, запис з `moonraker.conf` і службу Vyron Core.
