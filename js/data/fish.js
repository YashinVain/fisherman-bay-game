// fish.js — редкости, места (пруды), рыба и мусор.
//
// Как добавить новое место в обновлении: дописать объект в PONDS и рыб с его id
// в FISH. Турнир недели сам начнёт выбирать это место (см. game/week.js).
// ВАЖНО: id рыб и мест никогда не меняем и не удаляем — по ним хранится сохранение.
//
// Поля рыбы:
//   id, pond, r (редкость), n {ru,en} (название)
//   w [мин, макс] — вес в граммах
//   d [от, до]    — где клюёт: 0 = у самого берега, 1 = дальше всего
//   bait          — любимая наживка (worm | maggot | spinner | shrimp): шанс ×3
//   wx            — погода, в которую клюёт охотнее: { rain: 2, night: 3 ... }
//   art           — как рисовать (см. view/fishart.js)

(function (FB) {
    FB.RARITY = {
        common:    { order: 0, weight: 60, base: 10,  color: '#9aa7b1', glow: null },
        uncommon:  { order: 1, weight: 25, base: 25,  color: '#5cbf5a', glow: null },
        rare:      { order: 2, weight: 10, base: 60,  color: '#3f8fe8', glow: '#7cc0ff' },
        epic:      { order: 3, weight: 4,  base: 150, color: '#a35de0', glow: '#d6a8ff' },
        legendary: { order: 4, weight: 1,  base: 400, color: '#f2b51d', glow: '#ffe28a' },
        junk:      { order: -1, weight: 0, base: 1,   color: '#a08060', glow: null }
    };
    FB.RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

    // Места. unlock — уровень рыбака. theme — как рисовать фон (view/scene.js)
    FB.PONDS = [
        { id: 'village', unlock: 1, n: { ru: 'Деревенский пруд', en: 'Village Pond' }, theme: 'village' },
        { id: 'river', unlock: 3, n: { ru: 'Лесная речка', en: 'Forest River' }, theme: 'river' },
        { id: 'mountain', unlock: 6, n: { ru: 'Горное озеро', en: 'Mountain Lake' }, theme: 'mountain' },
        { id: 'swamp', unlock: 9, n: { ru: 'Тихое болото', en: 'Quiet Swamp' }, theme: 'swamp' },
        { id: 'pier', unlock: 13, n: { ru: 'Морская пристань', en: 'Sea Pier' }, theme: 'sea' },
        { id: 'lagoon', unlock: 17, n: { ru: 'Тропическая лагуна', en: 'Tropical Lagoon' }, theme: 'tropic' }
    ];

    // Короткие помощники для таблицы ниже
    const F = (id, pond, r, ru, en, w, d, bait, wx, art) => ({ id, pond, r, n: { ru, en }, w, d, bait, wx: wx || {}, art });
    // art: shape, back (спина), belly (брюхо), fin (плавники), pat (узор), pc (цвет узора)
    const A = (shape, back, belly, fin, pat, pc, extra) => Object.assign({ shape, back, belly, fin, pat: pat || null, pc: pc || null }, extra || {});

    FB.FISH = [
        // ---------- Деревенский пруд ----------
        F('crucian', 'village', 'common', 'Карась', 'Crucian Carp', [80, 900], [0, 0.6], 'worm', null, A('round', '#b8902e', '#f3d98a', '#c9862e')),
        F('rotan', 'village', 'common', 'Ротан', 'Sleeper Goby', [30, 350], [0, 0.45], 'worm', { rain: 1.5 }, A('goby', '#5b5a3a', '#a9a27a', '#4a4630', 'spots', '#3a3a24')),
        F('perch', 'village', 'common', 'Окунь', 'Perch', [60, 1200], [0.2, 0.8], 'spinner', null, A('perch', '#6f8f3a', '#e9e2b0', '#e4672d', 'bars', '#3c4f22')),
        F('rudd', 'village', 'uncommon', 'Краснопёрка', 'Rudd', [50, 600], [0, 0.5], 'maggot', null, A('oval', '#8a8f5a', '#f0e6c0', '#e0392a')),
        F('tench', 'village', 'uncommon', 'Линь', 'Tench', [200, 2500], [0.3, 0.9], 'worm', { rain: 1.6 }, A('long', '#55682a', '#c8b86a', '#4a5a22')),
        F('bream', 'village', 'rare', 'Лещ', 'Bream', [500, 4500], [0.5, 1], 'maggot', { night: 1.5 }, A('tall', '#7d6a3e', '#d9c792', '#5d4a2a')),
        F('carp', 'village', 'epic', 'Зеркальный карп', 'Mirror Carp', [1500, 14000], [0.6, 1], 'maggot', { fog: 1.6 }, A('round', '#8f6d2a', '#e8c66a', '#7a4f1e', 'scales', '#f6dc8c')),
        F('goldcarp', 'village', 'legendary', 'Золотой карп', 'Golden Carp', [3000, 16000], [0.7, 1], 'maggot', null, A('round', '#f0a81e', '#ffe48a', '#f27b1a', 'scales', '#fff1b0', { shine: true })),

        // ---------- Лесная речка ----------
        F('bleak', 'river', 'common', 'Уклейка', 'Bleak', [10, 90], [0, 0.4], 'maggot', null, A('slim', '#7f97a6', '#eef3f5', '#c0ccd2')),
        F('roach', 'river', 'common', 'Плотва', 'Roach', [40, 700], [0, 0.6], 'maggot', null, A('oval', '#5f7a8a', '#e9eef0', '#d8452e')),
        F('gudgeon', 'river', 'common', 'Пескарь', 'Gudgeon', [20, 130], [0, 0.5], 'worm', null, A('goby', '#8a7d5e', '#e4dcc4', '#9d8b62', 'spots', '#4d4330')),
        F('chub', 'river', 'uncommon', 'Голавль', 'Chub', [200, 3000], [0.3, 0.9], 'spinner', null, A('long', '#4c5e6e', '#e2e6dc', '#c9612e', 'scales', '#7d8c98')),
        F('ide', 'river', 'uncommon', 'Язь', 'Ide', [300, 3200], [0.4, 0.9], 'worm', { rain: 1.5 }, A('oval', '#56606a', '#e6dcc0', '#d06a3a')),
        F('trout', 'river', 'rare', 'Ручьевая форель', 'Brook Trout', [200, 2500], [0.3, 1], 'spinner', { rain: 2.2 }, A('trout', '#5c6e3c', '#f2d7b6', '#c96a3a', 'dots', '#d63a2a')),
        F('grayling', 'river', 'epic', 'Хариус', 'Grayling', [200, 2000], [0.5, 1], 'maggot', { fog: 2 }, A('sail', '#606e86', '#d8dde6', '#8b5ca8', 'dots', '#2c3446')),
        F('salmon', 'river', 'legendary', 'Серебряный лосось', 'Silver Salmon', [3000, 22000], [0.7, 1], 'spinner', { rain: 1.8 }, A('trout', '#7c95a8', '#f3f6f8', '#8aa0b0', 'dots', '#3c4a58', { shine: true })),

        // ---------- Горное озеро ----------
        F('vendace', 'mountain', 'common', 'Ряпушка', 'Vendace', [30, 200], [0, 0.6], 'maggot', null, A('slim', '#5d7e9a', '#eef2f6', '#b6c6d4')),
        F('whitefish', 'mountain', 'common', 'Сиг', 'Whitefish', [200, 2500], [0.2, 0.8], 'maggot', null, A('oval', '#6a8296', '#f0f2f2', '#9eb0be')),
        F('char', 'mountain', 'uncommon', 'Голец', 'Arctic Char', [150, 2000], [0.2, 0.9], 'spinner', { fog: 1.5 }, A('trout', '#4f6676', '#f08a4a', '#f0743a', 'dots', '#f6d6c0')),
        F('peled', 'mountain', 'uncommon', 'Пелядь', 'Peled', [200, 2800], [0.4, 0.9], 'worm', null, A('tall', '#5c7486', '#e8ecef', '#93a4b2')),
        F('laketrout', 'mountain', 'rare', 'Озёрная форель', 'Lake Trout', [800, 8000], [0.5, 1], 'spinner', { night: 1.5 }, A('trout', '#4a5c4a', '#e6dcc4', '#7a8a6a', 'dots', '#e8e0c8')),
        F('nelma', 'mountain', 'epic', 'Нельма', 'Nelma', [2000, 15000], [0.65, 1], 'spinner', { fog: 1.6 }, A('long', '#6b8396', '#f4f6f6', '#9fb2c0')),
        F('taimen', 'mountain', 'legendary', 'Таймень', 'Taimen', [5000, 40000], [0.75, 1], 'spinner', { rain: 1.5 }, A('pike', '#6e4a3a', '#e8b49a', '#c0402a', 'dots', '#3a221a', { shine: true })),

        // ---------- Тихое болото ----------
        F('loach', 'swamp', 'common', 'Вьюн', 'Weatherfish', [20, 150], [0, 0.6], 'worm', { rain: 2 }, A('eel', '#7a6440', '#d6c290', '#6a5434', 'stripe', '#3e3020')),
        F('bullhead', 'swamp', 'common', 'Сомик', 'Bullhead', [50, 600], [0.1, 0.7], 'worm', { night: 2 }, A('cat', '#4b4136', '#b9a988', '#3d342a')),
        F('frog', 'swamp', 'uncommon', 'Лягушка', 'Frog', [20, 300], [0, 0.4], 'worm', { rain: 2 }, A('frog', '#5aa83a', '#e6efa0', '#3f8a2a', 'spots', '#2f6a20')),
        F('eel', 'swamp', 'uncommon', 'Угорь', 'Eel', [200, 3500], [0.3, 1], 'worm', { night: 2.5 }, A('eel', '#3d4630', '#c8c49a', '#2e3424')),
        F('pike', 'swamp', 'rare', 'Щука', 'Pike', [500, 12000], [0.3, 1], 'spinner', { fog: 1.5 }, A('pike', '#5a7038', '#e6e2b4', '#8a6a2a', 'dots', '#d6d8a0')),
        F('catfish', 'swamp', 'epic', 'Сом', 'Catfish', [3000, 60000], [0.6, 1], 'worm', { night: 3 }, A('cat', '#3c3a34', '#cfc6ae', '#2c2a26', 'spots', '#26241f')),
        F('spirit', 'swamp', 'legendary', 'Болотный дух', 'Swamp Spirit', [1000, 9000], [0.7, 1], 'maggot', { fog: 2, night: 2 }, A('oval', '#4fd6b4', '#c6fff0', '#2aa88c', 'dots', '#eafff8', { shine: true, glowBody: true })),

        // ---------- Морская пристань ----------
        F('goby', 'pier', 'common', 'Бычок', 'Round Goby', [30, 400], [0, 0.6], 'shrimp', null, A('goby', '#6a5638', '#d8c69c', '#4e3e28', 'spots', '#3a2c1a')),
        F('scad', 'pier', 'common', 'Ставрида', 'Horse Mackerel', [80, 800], [0.2, 0.8], 'spinner', null, A('slim', '#5c7e8e', '#e8eef0', '#c8b44a')),
        F('mullet', 'pier', 'uncommon', 'Кефаль', 'Mullet', [300, 3000], [0.2, 0.8], 'shrimp', null, A('long', '#6c7c88', '#eef0f0', '#8a98a2', 'stripe', '#4a5866')),
        F('flounder', 'pier', 'uncommon', 'Камбала', 'Flounder', [200, 4000], [0.3, 0.9], 'shrimp', { fog: 1.5 }, A('flat', '#8a7454', '#e4d4b0', '#6e5a3e', 'spots', '#e8b06a')),
        F('stingray', 'pier', 'rare', 'Скат', 'Stingray', [1000, 15000], [0.5, 1], 'shrimp', { night: 1.6 }, A('ray', '#6e6a62', '#e6e0d4', '#5a564e', 'dots', '#c8c0b0')),
        F('dogfish', 'pier', 'epic', 'Катран', 'Spiny Dogfish', [2000, 14000], [0.6, 1], 'shrimp', { night: 2 }, A('shark', '#6c7a86', '#e6eaec', '#56626c', 'dots', '#e8eef2')),
        F('tuna', 'pier', 'legendary', 'Синий тунец', 'Bluefin Tuna', [20000, 120000], [0.8, 1], 'spinner', null, A('tuna', '#203e7a', '#e6eef4', '#f2c43a', null, null, { shine: true })),

        // ---------- Тропическая лагуна ----------
        F('clown', 'lagoon', 'common', 'Рыба-клоун', 'Clownfish', [30, 250], [0, 0.6], 'shrimp', null, A('clown', '#f27a1e', '#f9a050', '#e8661a', 'clown', '#ffffff')),
        F('tang', 'lagoon', 'common', 'Голубой хирург', 'Blue Tang', [100, 600], [0.1, 0.7], 'shrimp', null, A('tall', '#2a6ad8', '#3a86f0', '#f2d23a', 'stripe', '#132c5a')),
        F('puffer', 'lagoon', 'uncommon', 'Рыба-ёж', 'Pufferfish', [200, 2500], [0.2, 0.8], 'shrimp', null, A('puffer', '#d8b65a', '#f6ecc4', '#c09a3a', 'dots', '#6a5222')),
        F('butterfly', 'lagoon', 'uncommon', 'Рыба-бабочка', 'Butterflyfish', [50, 500], [0, 0.7], 'maggot', null, A('tall', '#f6d23a', '#fff4b0', '#f2a81a', 'stripe', '#2a2a2a')),
        F('barracuda', 'lagoon', 'rare', 'Барракуда', 'Barracuda', [1000, 18000], [0.4, 1], 'spinner', null, A('pike', '#6a7e8a', '#e6eef2', '#5a6c78', 'bars', '#3e4e58')),
        F('swordfish', 'lagoon', 'epic', 'Рыба-меч', 'Swordfish', [15000, 150000], [0.7, 1], 'spinner', null, A('sword', '#3a4a7a', '#dfe6f0', '#2c3860')),
        F('mola', 'lagoon', 'legendary', 'Рыба-луна', 'Ocean Sunfish', [50000, 600000], [0.8, 1], 'shrimp', { fog: 1.5 }, A('mola', '#9aa6b8', '#e8eef4', '#7e8ca0', 'dots', '#c0cad8', { shine: true }))
    ];

    // Мусор: попадается везде, немного смешно, иногда приятно (сундук с монетами)
    FB.JUNK = [
        { id: 'boot', n: { ru: 'Старый сапог', en: 'Old Boot' }, art: 'boot' },
        { id: 'can', n: { ru: 'Жестяная банка', en: 'Tin Can' }, art: 'can' },
        { id: 'weed', n: { ru: 'Пучок водорослей', en: 'Bunch of Weeds' }, art: 'weed' },
        { id: 'tire', n: { ru: 'Покрышка', en: 'Tire' }, art: 'tire' },
        { id: 'bottle', n: { ru: 'Бутылка с запиской', en: 'Message in a Bottle' }, art: 'bottle', coins: 30 },
        { id: 'duck', n: { ru: 'Резиновая уточка', en: 'Rubber Duck' }, art: 'duck', coins: 10 },
        { id: 'hat', n: { ru: 'Чья-то шляпа', en: 'Someone\'s Hat' }, art: 'hat' },
        { id: 'chest', n: { ru: 'Маленький сундук', en: 'Little Chest' }, art: 'chest', coins: 120, rare: true }
    ];
    FB.JUNK_CHANCE = 0.07;

    // Быстрый доступ по id
    FB.fishById = {};
    FB.FISH.forEach(f => {
        f.avg = Math.sqrt(f.w[0] * f.w[1]);   // «средний» вес — середина в логарифме
        FB.fishById[f.id] = f;
    });
    FB.junkById = {};
    FB.JUNK.forEach(j => { FB.junkById[j.id] = j; });
    FB.pondById = {};
    FB.PONDS.forEach(p => { FB.pondById[p.id] = p; });
    FB.fishOfPond = (pondId) => FB.FISH.filter(f => f.pond === pondId);
    FB.name = (obj) => obj.n[FB.lang] || obj.n.ru;
})(window.FB);
