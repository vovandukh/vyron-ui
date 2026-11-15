# @vyron/shared

Логіка, спільна для Vyron Web і Vyron Screen, щоб нічого не писати двічі.

- `klipperErrors` — розбір повідомлень Klipper («!! Move out of range», state_message після shutdown) у категорію, параметри й ключ перекладу.

Далі сюди переїдуть клієнт Moonraker, визначення плат і датчиків, теми оформлення.
Підключення: `import { classify } from '@vyron/shared/klipperErrors'`.
