export default {
  'nav.main': 'Керування', 'nav.tools': 'Головки', 'nav.console': 'Консоль', 'nav.mesh': 'Карта столу',
  'nav.hist': 'Історія', 'nav.eng': 'Інженерне', 'nav.cfg': 'Конфіг',

  'common.set': 'Задати', 'common.off': 'Вимкнути', 'common.cancel': 'Скасувати', 'common.save': 'Зберегти', 'common.ok': 'Так',
  'fmt.hm': '{h} г {m} хв', 'fmt.m': '{m} хв',
  'unit.mm': '{v} мм', 'unit.m': '{v} м',
  'eta.left': 'залишилось {t}',

  'menu.label': 'Меню', 'menu.settings': 'Налаштування', 'menu.updates': 'Оновлення', 'menu.net': 'Мережа та Wi‑Fi',
  'menu.restartMoonraker': 'Перезапустити Moonraker', 'menu.reboot': 'Перезавантажити хост', 'menu.shutdown': 'Вимкнути хост',
  'confirm.restartMoonraker': 'Перезапустити Moonraker?', 'confirm.reboot': 'Перезавантажити хост?',
  'confirm.shutdown': 'Вимкнути хост? Для повторного запуску потрібне живлення.',

  'estop.label': 'Аварійна зупинка', 'estop.title': 'Аварійна зупинка (M112)',
  'estop.confirm': 'Аварійна зупинка? Klipper перейде в стан помилки, після неї потрібен firmware restart.',

  'state.printing': 'Друк', 'state.paused': 'Пауза', 'state.standby': 'Очікування', 'state.complete': 'Готово',
  'state.cancelled': 'Скасовано', 'state.error': 'Помилка', 'state.connecting': 'Підключення…', 'state.connected': 'З’єднано',
  'state.ready': 'Готовий', 'state.klipperError': 'Помилка Klipper', 'state.lost': 'Немає зв’язку', 'state.demo': 'Демо',

  'conn.placeholder': 'адреса принтера', 'conn.aria': 'Адреса принтера', 'conn.connect': 'Підключити', 'conn.demo': 'Демо',
  'conn.connectingTo': 'Підключення до {host}…', 'conn.connectedTo': 'Підключено · {host}',
  'conn.wsError': 'Помилка WebSocket · перевір адресу та доступ', 'conn.lost': 'Зв’язок втрачено · повторне підключення…',
  'conn.addrError': 'Помилка адреси: {msg}',

  'meta.notConnected': 'Не підключено', 'meta.noFile': 'Немає активного файлу',
  'meta.gcodeError': 'Не вдалося завантажити G-code: {msg}', 'meta.demo': 'Демо · імітація друку',

  'status.nozzle': 'Активне сопло', 'status.bed': 'Стіл', 'status.chamber': 'Камера', 'status.speed': 'Швидкість',
  'status.fan': 'Обдув', 'status.z': 'Висота Z', 'status.layer': 'Шар', 'status.qgl': 'QGL',
  'status.setNozzle': 'Задати температуру сопла', 'status.setBed': 'Задати температуру столу',
  'status.qglDone': 'вирівняно', 'status.qglNot': 'не виконано',

  'jog.home': 'Home усіх осей', 'jog.motorsOff': 'Вимкнути мотори (M84)', 'jog.motorsOffAria': 'Вимкнути мотори',
  'jog.badDistance': 'Введи коректну відстань більше 0',

  'msg.demoNoExec': 'Демо: команда не виконується', 'msg.notConnected': 'Немає підключення',
  'msg.notConnectedPrinter': 'Немає підключення до принтера', 'msg.notWhilePrinting': 'Не під час друку',
  'msg.invalidWs': 'Некоректна відповідь WebSocket',

  'tools.title': 'Шість інструментів', 'tools.waiting': 'Очікування конфігурації Klipper',
  'tools.hintSummary': 'Як показати температуру плат EBB36', 'tools.hintMcu': '# назва [mcu …] цієї плати',
  'tools.hintSame': '# те саме для ebb_t1 … ebb_t5',
  'tools.hintText': 'Назва датчика має містити ebb, can, board, head або tool і закінчуватись номером голови 0–5 (наприклад, ebb_t3).',
  'tools.selectHint': 'Вибір головки надсилає T0–T5',
  'tools.footer': 'Назви екструдерів визначаються через printer.objects.list. Для T0–T5 мають бути налаштовані відповідні екструдери та команди вибору інструмента у Klipper.',
  'tools.found': '{n} / 6 екструдерів знайдено',
  'tools.notEnough': 'У Klipper знайдено {n} екструдер(ів). Для шести головок потрібні шість секцій extruder.',
  'tools.demoMode': 'Демо-режим · команди до принтера не надсилаються',
  'tools.notFoundCfg': 'Головка T{i} не знайдена в конфігурації Klipper', 'tools.demoSelected': 'Демо · вибрано T{i}',
  'tools.sent': 'Надіслано вибір T{i}', 'tools.notFoundTitle': 'Екструдер не знайдений', 'tools.cardNotFound': 'не знайдено',
  'tools.tempOf': 'Температура {name}', 'tools.addSection': 'Додай {sec} у printer.cfg', 'tools.board': 'Плата EBB36 ·',
  'tools.noSensor': 'датчик не знайдено', 'tools.placeholder': 'Цільова температура', 'tools.aria': 'Температура T{i}',
  'tools.activate': 'Активувати', 'tools.badTemp': 'Вкажи температуру 0–320 °C',

  'console.placeholder': 'G-code, наприклад G28', 'console.send': 'Надіслати',

  'mesh.calibrate': 'Калібрувати', 'mesh.none': 'Карти столу ще немає.', 'mesh.front': 'Передня сторона столу знизу.',
  'mesh.calSent': 'Команду надіслано. Хід калібрування — у консолі.',
  'mesh.info': '{name}{saved} · {lo}…{hi} мм · розмах {range} мм · ×{k}', 'mesh.savedSuffix': ' · збережений профіль',

  'hist.refresh': 'Оновити список', 'hist.prevTitle': 'Попередні друки', 'hist.empty': 'Історії ще немає',
  'hist.completed': 'Завершено', 'hist.interrupted': 'Перервано', 'hist.inProgress': 'Друкується',
  'hist.started': 'Початок', 'hist.duration': 'Тривалість', 'hist.total': 'Загальний час', 'hist.filament': 'Філамент',
  'hist.layers': 'Шарів', 'hist.height': 'Висота',
  'hist.totals': 'Всього друків: {n} · Час друку: {time} · Філамент: {fil} м',
  'hist.unavailable': 'Історія недоступна: {msg} (потрібен [history] у moonraker.conf)',

  'eng.klipper': 'Klipper', 'eng.host': 'Хост', 'eng.state': 'Стан', 'eng.cpu': 'Процесор', 'eng.cpuTemp': 'Температура CPU',
  'eng.mem': 'Пам’ять', 'eng.uptime': 'Аптайм', 'eng.memVal': '{p}% з {gb} ГБ', 'eng.demoUptime': '3 доби',
  'eng.confirmRestart': 'Перезапустити Klipper?', 'eng.confirmFw': 'Виконати firmware restart?',

  'cfg.search': 'Пошук файлу', 'cfg.new': '+ Нова', 'cfg.unsaved': '● не збережено', 'cfg.find': 'Знайти',
  'cfg.saveRestart': 'Зберегти й перезапустити', 'cfg.replaceWith': 'Замінити на', 'cfg.replace': 'Замінити', 'cfg.all': 'Усі',
  'cfg.prev': 'Назад', 'cfg.next': 'Далі', 'cfg.editor': 'Редактор конфігурації',
  'cfg.stat': 'Рядок {l}, колонка {c} · {n} рядків', 'cfg.matches': '{n} збігів', 'cfg.noChanges': 'Немає змін',
  'cfg.saved': 'Збережено (копію попередньої версії лишено в backups/)', 'cfg.discard': 'Є незбережені зміни. Відкинути?',
  'cfg.newName': 'Назва файлу (наприклад, macros.cfg)', 'cfg.saveError': 'Не вдалося зберегти: {msg}',
  'cfg.connect': 'Підключи принтер', 'cfg.connectToEdit': 'Підключи принтер для редагування конфігурації',
  'cfg.badName': 'Назва має закінчуватись на .cfg або .conf', 'cfg.listError': 'Не вдалося отримати список файлів: {msg}',
  'cfg.openError': 'Не вдалося відкрити: {msg}', 'cfg.confirmSaveRestart': 'Зберегти й перезапустити Klipper?',

  'upd.check': 'Перевірити оновлення', 'upd.all': 'Оновити все', 'upd.update': 'Оновити', 'upd.available': 'Є оновлення',
  'upd.upToDate': 'Актуально', 'upd.dirty': 'є локальні зміни', 'upd.invalid': 'конфігурація невалідна',
  'upd.packages': '{n} пакетів до оновлення', 'upd.finished': 'Оновлення завершено',
  'upd.confirmOne': 'Оновити {name}? Під час оновлення Klipper і Moonraker перезапускаються.',
  'upd.confirmAll': 'Оновити все? Під час оновлення Klipper і Moonraker перезапускаються.',
  'upd.updating': 'Оновлення {name}…', 'upd.updatingAll': 'Оновлення всього…',

  'net.interfaces': 'Мережеві інтерфейси хоста', 'net.scan': 'Сканувати мережі', 'net.scanning': 'Сканування…',
  'net.none': 'Мереж не знайдено. Перевір налаштування WIFI_SCAN (див. нижче).',
  'net.found': 'Знайдено мереж: {n}. Натисни на мережу, щоб підставити назву.', 'net.open': 'відкрита',
  'net.ssid': 'Назва мережі (SSID)', 'net.ssidAria': 'Назва мережі', 'net.pass': 'Пароль', 'net.passAria': 'Пароль Wi-Fi',
  'net.needBoth': 'Введи назву мережі й пароль',
  'net.badChars': 'Лапки, фігурні дужки й зворотна скісна в назві чи паролі не підтримуються',
  'net.confirm': 'Підключити принтер до мережі {ssid}? Якщо дані хибні, доступ до принтера по Wi-Fi може зникнути.',
  'net.sent': 'Команду надіслано. Якщо підключення вдасться, сторінка втратить зв’язок: відкрий принтер за новою IP-адресою.',
  'net.setupSummary': 'Одноразове налаштування для підключення',
  'net.setupNote': 'Потрібне розширення gcode_shell_command (ставиться через KIAUH). Це приклад, його не перевірено на твоєму принтері; якщо nmcli попросить права, знадобиться налаштування sudo або polkit.',
  'net.demoIface': 'wlan0 · 192.168.0.232 (демо)',

  'set.lang': 'Мова', 'set.cEstop': 'Запитувати підтвердження аварійної зупинки',
  'set.cSys': 'Запитувати підтвердження системних дій (перезапуск, вимкнення)',
  'set.invX': 'Інвертувати напрямок X', 'set.invY': 'Інвертувати напрямок Y', 'set.invZ': 'Інвертувати напрямок Z',
  'set.fxy': 'Швидкість руху X/Y, мм/хв', 'set.fz': 'Швидкість руху Z, мм/хв',
  'set.note': 'Налаштування зберігаються в цьому браузері.',

  'temp.nozzle': 'Температура сопла', 'temp.bed': 'Температура столу', 'temp.now': 'Зараз', 'temp.target': 'ціль',
  'temp.aria': 'Цільова температура', 'temp.range': 'Вкажи температуру 0–{max} °C'
}
