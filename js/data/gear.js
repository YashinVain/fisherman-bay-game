// gear.js — удочки, наживка, косметика, товары за реальные деньги, сезон.
// Удочки и наживка покупаются ТОЛЬКО за игровые монеты — деньги не дают очков.
// Косметика — за жемчуг (премиум), монеты или как награда (турнир, пропуск сезона).

(function (FB) {
    // ---------- Удочки ----------
    // reach — как далеко достаёт заброс (0..1), ctrl — рост натяжения (меньше = легче),
    // reel — скорость подмотки, luck — множитель шанса редкой рыбы.
    // look — как рисовать в магазине (view/rodart.js): обмотка, рукоять, катушка, узор
    FB.RODS = [
        { id: 'bamboo', price: 0, level: 1, reach: 0.42, ctrl: 1.0, reel: 1.0, luck: 1.0, color: '#d8b46a', n: { ru: 'Бамбуковая', en: 'Bamboo Rod' }, look: { style: 'bamboo', wrap: '#3a7a3a', handle: '#c8955a', reel: '#7a6a5a', bend: 0.08 } },
        { id: 'light', price: 400, level: 3, reach: 0.56, ctrl: 0.92, reel: 1.1, luck: 1.1, color: '#4a8ad0', n: { ru: 'Лёгкий спиннинг', en: 'Light Spinner' }, look: { wrap: '#ffffff', reel: '#5a7aa8' } },
        { id: 'glass', price: 900, level: 5, reach: 0.63, ctrl: 0.88, reel: 1.15, luck: 1.15, color: '#3aa87a', n: { ru: 'Стеклопластиковая', en: 'Fiberglass Rod' }, look: { wrap: '#f2c43a', reel: '#4a8a6a' } },
        { id: 'carbon', price: 1600, level: 7, reach: 0.7, ctrl: 0.84, reel: 1.2, luck: 1.2, color: '#3a3a44', n: { ru: 'Карбоновая', en: 'Carbon Rod' }, look: { style: 'carbon', wrap: '#e8402a', handle: '#2a2a30', seat: '#e8402a', reel: '#3a3a44' } },
        { id: 'feeder', price: 3200, level: 9, reach: 0.78, ctrl: 0.8, reel: 1.26, luck: 1.25, color: '#7a4ac8', n: { ru: 'Фидерная', en: 'Feeder Rod' }, look: { wrap: '#ffd23a', ring: '#ffd23a', reel: '#5a3a90', bend: 0.1 } },
        { id: 'sea', price: 5000, level: 11, reach: 0.85, ctrl: 0.76, reel: 1.32, luck: 1.3, color: '#d0503a', n: { ru: 'Морская', en: 'Sea Rod' }, look: { thick: 1.25, wrap: '#ffffff', handle: '#2a3a5a', reel: '#c8d0d8', bend: 0.03 } },
        { id: 'ice', price: 9000, level: 14, reach: 0.92, ctrl: 0.72, reel: 1.38, luck: 1.36, color: '#6ad0f0', n: { ru: 'Ледяная', en: 'Ice Rod' }, look: { style: 'ice', wrap: '#ffffff', ring: '#e8fbff', handle: '#e8f4fa', reel: '#3a8ac8' } },
        { id: 'star', price: 15000, level: 16, reach: 1.0, ctrl: 0.68, reel: 1.45, luck: 1.42, color: '#f2c43a', n: { ru: 'Звёздная', en: 'Star Rod' }, look: { style: 'star', wrap: '#2a3a8a', ring: '#fff3a8', handle: '#2a3a8a', seat: '#f2c43a', reel: '#f2c43a' } }
    ];

    // ---------- Наживка (покупается один раз навсегда) ----------
    FB.BAITS = [
        { id: 'worm', price: 0, level: 1, n: { ru: 'Червь', en: 'Worm' }, icon: 'worm', mode: 'float' },
        { id: 'maggot', price: 150, level: 2, n: { ru: 'Опарыш', en: 'Maggot' }, icon: 'maggot', mode: 'float' },
        { id: 'dough', price: 300, level: 3, n: { ru: 'Тесто', en: 'Dough Ball' }, icon: 'dough', mode: 'float' },
        { id: 'spinner', price: 700, level: 4, n: { ru: 'Блесна', en: 'Spinner' }, icon: 'spinner', mode: 'spin' },
        { id: 'corn', price: 900, level: 5, n: { ru: 'Кукуруза', en: 'Sweet Corn' }, icon: 'corn', mode: 'float' },
        { id: 'wobbler', price: 1800, level: 8, n: { ru: 'Воблер', en: 'Wobbler' }, icon: 'wobbler', mode: 'spin' },
        { id: 'shrimp', price: 2500, level: 12, n: { ru: 'Креветка', en: 'Shrimp' }, icon: 'shrimp', mode: 'bottom' },
        { id: 'squid', price: 4000, level: 15, n: { ru: 'Кальмар', en: 'Squid' }, icon: 'squid', mode: 'bottom' }
    ];

    FB.rodById = {}; FB.RODS.forEach(r => { FB.rodById[r.id] = r; });
    FB.baitById = {}; FB.BAITS.forEach(b => { FB.baitById[b.id] = b; });

    // ---------- Косметика ----------
    // cat: hat | jacket | float | boat | pet | frame | effect
    // cost: { coins: N } или { pearls: N }; src: 'shop' | 'pass' | 'starter' | 'tourney' | 'supporter'
    //   | 'album' (20 видов в альбоме) | 'legend' (поймать легендарную рыбу) | 'captain' (набор капитана)
    // c — цвета для рисования
    const C = (id, cat, ru, en, cost, src, c) => ({ id, cat, n: { ru, en }, cost: cost || null, src: src || 'shop', c: c || {} });
    FB.COSMETICS = [
        // Шапки
        C('hat_cap', 'hat', 'Кепка', 'Cap', null, 'default', { a: '#d84a3a', b: '#b23a2c' }),
        C('hat_panama', 'hat', 'Панама', 'Bucket Hat', { coins: 600 }, 'shop', { a: '#e8d6a0', b: '#c8b47a' }),
        C('hat_beanie', 'hat', 'Шапка с помпоном', 'Bobble Hat', { coins: 1200 }, 'shop', { a: '#3a7ad8', b: '#f2f2f2' }),
        C('hat_straw', 'hat', 'Соломенная шляпа', 'Straw Hat', { pearls: 40 }, 'shop', { a: '#f0cc6a', b: '#d84a3a' }),
        C('hat_captain', 'hat', 'Капитанская фуражка', 'Captain Hat', { pearls: 80 }, 'shop', { a: '#f6f6f6', b: '#1e2c4a' }),
        C('hat_crown', 'hat', 'Корона рыбака', 'Angler Crown', null, 'tourney', { a: '#f2c43a', b: '#d8402a' }),
        C('hat_pirate', 'hat', 'Пиратская треуголка', 'Pirate Hat', null, 'pass', { a: '#2a2a30', b: '#f2f2f2' }),
        // Куртки
        C('jk_green', 'jacket', 'Зелёная жилетка', 'Green Vest', null, 'default', { a: '#4f8a3a', b: '#3a6a2a' }),
        C('jk_yellow', 'jacket', 'Жёлтый дождевик', 'Yellow Raincoat', { coins: 900 }, 'shop', { a: '#f2c42a', b: '#d8a81a' }),
        C('jk_plaid', 'jacket', 'Клетчатая рубашка', 'Plaid Shirt', { coins: 1800 }, 'shop', { a: '#c83a3a', b: '#2a2a2a' }),
        C('jk_navy', 'jacket', 'Морской бушлат', 'Navy Coat', { pearls: 60 }, 'shop', { a: '#24365c', b: '#f2c43a' }),
        C('jk_hawaii', 'jacket', 'Гавайская рубашка', 'Hawaiian Shirt', { pearls: 70 }, 'shop', { a: '#2ab0c8', b: '#f27a8a' }),
        C('jk_gold', 'jacket', 'Золотая куртка', 'Golden Jacket', null, 'pass', { a: '#e8b42a', b: '#fff0a0' }),
        // Поплавки
        C('fl_classic', 'float', 'Классический', 'Classic', null, 'default', { a: '#e8402a', b: '#ffffff' }),
        C('fl_green', 'float', 'Лесной', 'Forest', { coins: 300 }, 'shop', { a: '#3aa84a', b: '#f6f0c0' }),
        C('fl_duck', 'float', 'Уточка', 'Duckling', { coins: 1500 }, 'shop', { a: '#f6d23a', b: '#f28a1a', shape: 'duck' }),
        C('fl_star', 'float', 'Звёздочка', 'Little Star', { pearls: 30 }, 'shop', { a: '#f2c43a', b: '#fff6c0', shape: 'star' }),
        C('fl_glow', 'float', 'Светлячок', 'Firefly', { pearls: 50 }, 'shop', { a: '#7af0c8', b: '#e8fff6', glow: true }),
        C('fl_heart', 'float', 'Сердечко', 'Heart', null, 'pass', { a: '#f24a6a', b: '#ffd0da', shape: 'heart' }),
        C('fl_gold', 'float', 'Золотой', 'Golden', null, 'tourney', { a: '#f2b51d', b: '#fff1b0', glow: true }),
        // Лодки и мостки (на чём стоит рыбак)
        C('bt_pier', 'boat', 'Деревянные мостки', 'Wooden Pier', null, 'default', { a: '#a8743a', b: '#7a5228' }),
        C('bt_raft', 'boat', 'Плот', 'Raft', { coins: 2500 }, 'shop', { a: '#c8964a', b: '#8a6230', type: 'raft' }),
        C('bt_rowboat', 'boat', 'Лодка', 'Rowboat', { pearls: 90 }, 'shop', { a: '#3a7ad8', b: '#f2f2f2', type: 'boat' }),
        C('bt_red', 'boat', 'Красная лодка', 'Red Boat', null, 'starter', { a: '#d8402a', b: '#f6e6c8', type: 'boat' }),
        C('bt_yacht', 'boat', 'Белая яхта', 'White Yacht', null, 'pass', { a: '#f6f6f6', b: '#2a5ab0', type: 'yacht' }),
        // Питомцы
        C('pet_none', 'pet', 'Без питомца', 'No Pet', null, 'default', {}),
        C('pet_cat', 'pet', 'Рыжий кот', 'Ginger Cat', { coins: 3000 }, 'shop', { a: '#f0903a', b: '#fff0dc', type: 'cat' }),
        C('pet_duck', 'pet', 'Утка', 'Duck', { pearls: 60 }, 'shop', { a: '#f6f6f0', b: '#f2a81a', type: 'duck' }),
        C('pet_raccoon', 'pet', 'Енот', 'Raccoon', { pearls: 120 }, 'shop', { a: '#8a8a90', b: '#2a2a30', type: 'raccoon' }),
        C('pet_dog', 'pet', 'Пёс', 'Puppy', null, 'starter', { a: '#c89a5a', b: '#7a5430', type: 'dog' }),
        // Рамки аватара в топе
        C('fr_none', 'frame', 'Обычная', 'Plain', null, 'default', { a: '#c8d6e0' }),
        C('fr_wood', 'frame', 'Деревянная', 'Wooden', { coins: 800 }, 'shop', { a: '#a8743a' }),
        C('fr_wave', 'frame', 'Волна', 'Wave', { pearls: 40 }, 'shop', { a: '#3ab0e8' }),
        C('fr_rainbow', 'frame', 'Радуга', 'Rainbow', { pearls: 100 }, 'shop', { a: 'rainbow' }),
        C('fr_gold', 'frame', 'Золотая', 'Golden', null, 'tourney', { a: '#f2b51d' }),
        C('fr_heart', 'frame', 'Сердце поддержки', 'Supporter Heart', null, 'supporter', { a: '#f24a6a' }),
        C('fr_rope', 'frame', 'Канат', 'Rope', { coins: 1500 }, 'shop', { a: '#e2c08a' }),
        C('fr_lily', 'frame', 'Кувшинки', 'Water Lilies', { coins: 2500 }, 'shop', { a: '#5ab85a' }),
        C('fr_shells', 'frame', 'Ракушки', 'Seashells', { coins: 4000 }, 'shop', { a: '#f2dca0' }),
        C('fr_anchor', 'frame', 'Якорь', 'Anchor', { pearls: 60 }, 'shop', { a: '#24365c' }),
        C('fr_stars', 'frame', 'Звёздная ночь', 'Starry Night', { pearls: 80 }, 'shop', { a: '#3a4a9a' }),
        C('fr_fire', 'frame', 'Огненная', 'Fire', { pearls: 120 }, 'shop', { a: '#ff7a1a' }),
        C('fr_crystal', 'frame', 'Кристаллы', 'Crystals', { pearls: 150 }, 'shop', { a: '#7ad0f0' }),
        C('fr_fisher', 'frame', 'Рыбья карусель', 'Fish Carousel', null, 'album', { a: '#3a9ad8' }),
        C('fr_legend', 'frame', 'Легенда', 'Legend', null, 'legend', { a: '#d88aff' }),
        C('fr_royal', 'frame', 'Королевская', 'Royal', null, 'captain', { a: '#f2b51d' }),
        // Эффекты улова
        C('fx_splash', 'effect', 'Брызги', 'Splash', null, 'default', { a: '#ffffff' }),
        C('fx_stars', 'effect', 'Звёзды', 'Stars', { coins: 2000 }, 'shop', { a: '#f2c43a' }),
        C('fx_hearts', 'effect', 'Сердечки', 'Hearts', { pearls: 50 }, 'shop', { a: '#f24a6a' }),
        C('fx_confetti', 'effect', 'Конфетти', 'Confetti', null, 'pass', { a: 'multi' }),
        C('fx_rainbow', 'effect', 'Радуга', 'Rainbow', { pearls: 110 }, 'shop', { a: 'rainbow' })
    ];
    FB.COSMETIC_CATS = ['hat', 'jacket', 'float', 'boat', 'pet', 'frame', 'effect'];
    FB.cosById = {};
    FB.COSMETICS.forEach(c => { FB.cosById[c.id] = c; });
    FB.DEFAULT_LOOK = { hat: 'hat_cap', jacket: 'jk_green', float: 'fl_classic', boat: 'bt_pier', pet: 'pet_none', frame: 'fr_none', effect: 'fx_splash' };

    // ---------- Покупки за реальные деньги (Яндекс) ----------
    // id должны совпадать с товарами, созданными в консоли Яндекс Игр (docs/YANDEX_SETUP.md).
    // kind: 'consumable' — можно покупать много раз (жемчуг), 'permanent' — один раз
    FB.PRODUCTS = [
        { id: 'pearls_s', kind: 'consumable', pearls: 60, price: 29, n: { ru: 'Горсть жемчуга', en: 'Handful of Pearls' } },
        { id: 'pearls_m', kind: 'consumable', pearls: 180, price: 79, n: { ru: 'Мешочек жемчуга', en: 'Bag of Pearls' }, tag: 'popular' },
        { id: 'pearls_l', kind: 'consumable', pearls: 500, price: 199, n: { ru: 'Сундук жемчуга', en: 'Chest of Pearls' }, tag: 'best' },
        { id: 'starter', kind: 'permanent', pearls: 100, price: 49, n: { ru: 'Набор новичка', en: 'Starter Pack' }, items: ['bt_red', 'pet_dog'] },
        { id: 'captain', kind: 'permanent', pearls: 200, price: 149, n: { ru: 'Набор капитана', en: 'Captain Pack' }, items: ['fr_royal', 'hat_captain', 'jk_navy', 'pet_raccoon'] },
        { id: 'no_ads', kind: 'permanent', price: 99, n: { ru: 'Без рекламы', en: 'No Ads' } },
        // Пропуск привязан к сезону: после покупки он «расходуется» (consume), чтобы
        // в следующем сезоне его можно было купить снова. Хранится в сохранении.
        { id: 'season_pass', kind: 'consumable', price: 149, n: { ru: 'Золотой пропуск', en: 'Golden Pass' } }
    ];
    FB.productById = {}; FB.PRODUCTS.forEach(p => { FB.productById[p.id] = p; });

    // ---------- Сезон (пропуск) ----------
    // Сезон = крупное обновление раз в ~3 месяца. Новому сезону — новый id и награды.
    // Если дата прошла, а обновления нет — сезон просто продолжается.
    // Пропуск сезона покупается под конкретный id (season_pass_<id> не нужен: покупка
    // 'season_pass' привязывается к сезону в сохранении).
    FB.SEASON = {
        id: 's1',
        n: { ru: 'Сезон 1: Открытие бухты', en: 'Season 1: Bay Opening' },
        perTier: 300,          // очков сезона на ступень
        // free / gold: { coins } | { pearls } | { item }
        tiers: [
            { free: { coins: 100 }, gold: { pearls: 20 } },
            { free: { coins: 150 }, gold: { item: 'fl_heart' } },
            { free: { pearls: 5 }, gold: { coins: 500 } },
            { free: { coins: 200 }, gold: { pearls: 25 } },
            { free: { item: 'fl_green' }, gold: { item: 'hat_pirate' } },
            { free: { coins: 250 }, gold: { coins: 800 } },
            { free: { pearls: 5 }, gold: { pearls: 30 } },
            { free: { coins: 300 }, gold: { item: 'fx_confetti' } },
            { free: { coins: 300 }, gold: { coins: 1000 } },
            { free: { pearls: 10 }, gold: { item: 'jk_gold' } },
            { free: { coins: 400 }, gold: { pearls: 40 } },
            { free: { coins: 400 }, gold: { coins: 1500 } },
            { free: { item: 'fr_wood' }, gold: { pearls: 40 } },
            { free: { coins: 500 }, gold: { coins: 2000 } },
            { free: { pearls: 10 }, gold: { item: 'bt_yacht' } }
        ]
    };
})(window.FB);
