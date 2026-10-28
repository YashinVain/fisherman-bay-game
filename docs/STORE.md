# Страница игры в каталоге Яндекс Игр

Тексты и материалы для черновика в консоли (games.yandex.ru/console).
Длины проверены под лимиты формы (`node tools/store-check.js`).

## Материалы

| Поле | Файл |
|---|---|
| Иконка 512×512 | `docs/promo/icon-512.png` |
| Maskable иконка | `docs/promo/icon-maskable-512.png` |
| Обложка 800×470 | `docs/promo/cover-800x470.png` |
| Обложка на витрину 1560×520 | `docs/promo/cover-wide-1560x520.png` |
| Скриншоты ПК (1920×1080) | `docs/promo/desktop-1.png` … `desktop-7.png` |
| Скриншоты телефона (1080×1920) | `docs/promo/phone-1.png` … `phone-7.png` |
| Горизонтальное видео (обязательное) | `docs/promo/video/gameplay-h.mp4` — 1920×1080, 26,5 с |
| Вертикальное видео | `docs/promo/video/gameplay-v.mp4` — 1080×1920, 26,5 с |
| Рекламные видео (до 20 штук) | `docs/promo/video/ad-baika-h.mp4`, `ad-baika-v.mp4` («Рыбацкая байка», 27 с); `ad-challenge-h.mp4`, `ad-challenge-v.mp4` («Сможешь вытащить?», 20 с) |
| Английская версия (вкладка «Английский»: заполнена отдельно) | обложки `docs/promo/cover-800x470-en.png` и `cover-wide-1560x520-en.png`, скриншоты `desktop-en-1.png` … `desktop-en-7.png` и `phone-en-1.png` … `phone-en-7.png`, видео геймплея `docs/promo/video/gameplay-h-en.mp4` и `gameplay-v-en.mp4`; иконка общая |
| Лёгкие копии всех шести роликов (для загрузки через адресную строку) | `docs/promo/video/*-up.mp4` — 1280×720 или 720×1280, каждая до 4,9 МБ |

Английские материалы снимаются так же, только с переменной `FB_LANG=en` (игра на английском, подписи английские, файлы с суффиксом `-en`); обложка — `node tools/shot.js tools/scenarios/promo-en.json`.

Видео и скриншоты снимаются из самой игры (подробности — в `tools/rec/README.md`):
исходники — `node tools/rec/rec.js tools/rec/films/src-h.js` (и `src-v.js` для телефона),
монтаж — `node tools/rec/edit.js tools/rec/edits/ad-baika.js h --publish`, всё сразу —
`sh tools/rec/ads.sh` (он же делает лёгкие копии; отдельно — `node tools/rec/light.js docs/promo/video/*.mp4`).
Проверка готовых файлов: `node tools/rec/verify.js docs/promo/video/*.mp4`.
Видео в git не кладём — они большие, лежат только локально в `docs/promo/video/`.

## Основное

- **Название:** Рыбацкие байки / Fishing Tales
- **Категории:** Симуляторы, Казуальные
- **Возраст:** 0+
- **Платформы:** десктоп, мобильные. **Ориентация:** любая
- **Облачные сохранения:** да
- **Ключевые слова (RU):** рыбалка, рыба, удочка, поплавок, спиннинг, клёв, улов, турнир, аквариум, рыбак
- **Ключевые слова (EN):** fishing, fish, rod, float, spinning, catch, angler, tournament, aquarium

## Русский

**Короткое описание**

Уютная рыбалка: 44 рыбы, турнир недели и свой аквариум

**Описание для SEO**

Рыбацкие байки — уютная рыбалка онлайн: лови 44 вида рыб, соревнуйся в турнире недели, наряжай рыбака и питомца, собирай аквариум. Играй бесплатно!

**Об игре**

Рыбацкие байки — уютная рыбалка, после которой точно есть что рассказать. Садись на мостки, закидывай удочку и лови рыбу с характером: одна рвётся в сторону, другая прыгает свечкой, третья тянет на глубину или уводит в камыш.

44 вида рыб в семи местах — от деревенского пруда и лесной речки до горного озера, ночного болота с фонарём, морской пристани и тропической лагуны. Каждую неделю — турнир в Турнирной бухте с настоящими игроками.

Собирай альбом и узнавай секреты рыб, наряжай рыбака и питомца, плавай на лодке с эхолотом и украшай свой аквариум трофеями. Ловишь подряд — растёт серия удачи, а иногда начинается жор, и клюёт без остановки!

**Как играть**

Нажми на воду — рыбак забросит удочку. Когда поплавок нырнёт, сразу нажми: это подсечка, чем быстрее, тем лучше. Дальше держи палец, чтобы подматывать, и отпускай, чтобы леска не лопнула, — стрелка должна оставаться в зелёной зоне. Рыба прыгает свечкой — отпусти. Уходит в камыш — веди удочку в другую сторону. На компьютере можно играть пробелом и стрелками. Наживка решает, кто клюнет: у каждой рыбы своя любимая. С блесной и воблером подматывай рывками, чтобы хищник заметил приманку.

## English

**Short description**

Cozy fishing: 44 fish, a weekly tournament and your own aquarium

**SEO description**

Fishing Tales is a cozy online fishing game: catch 44 kinds of fish, compete in the weekly tournament, dress up your angler and pet, fill your aquarium. Free!

**About the game**

Fishing Tales is cozy fishing with a story to tell afterwards. Sit down on the pier, cast your rod and catch fish with character: one darts to the side, another leaps out of the water, a third pulls into the deep or into the reeds.

44 kinds of fish in seven places — from a village pond and a forest river to a mountain lake, a night swamp with a lantern, a sea pier and a tropical lagoon. Every week there is a tournament in Tournament Bay with real players.

Fill your album and learn the fish secrets, dress up your angler and pet, sail a boat with a sonar and decorate your aquarium with trophies. Catch in a row to grow your lucky streak, and sometimes a feeding frenzy starts — the fish bite non-stop!

**How to play**

Tap the water to cast. When the float dives, tap right away to hook the fish — the faster, the better. Then hold to reel in and let go so the line does not snap: keep the needle in the green zone. The fish leaps — let go. It heads for the reeds — lead the rod the other way. On a computer you can play with Space and the arrow keys. The bait decides who bites: every fish has a favourite one. With a spinner or a wobbler, reel in with jerks so the predator notices the lure.

## Комментарий для модерации

Игра на русском и английском, язык берётся из SDK. Таблицы лидеров: weekA, weekB (турнир недели, чередуются), anglers, record. Покупки: pearls_s, pearls_m, pearls_l, starter, captain, no_ads, season_pass — дают только украшения и удобства, очков в турнире за деньги не получить. Реклама: видео за награду — только когда игрок сам нажал кнопку; межстраничная — не раньше чем через 3 минуты после запуска, не чаще раза в 3 минуты и только в паузах (после карточки улова, при переезде). Звук и игра ставятся на паузу при сворачивании вкладки и во время рекламы. Внешних ссылок нет. Сохранения — облачные (setData).
