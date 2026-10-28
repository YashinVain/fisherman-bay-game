// _common.js — общая подготовка для всех роликов: рыбак со снаряжением,
// погода по местам (красивая, а не случайная), без вступления и подсказок.

// Погода для каждого места в роликах
const WEATHER = { village: 'evening', river: 'sun', mountain: 'sun', swamp: 'night', pier: 'sun', lagoon: 'sun', arena: 'sun' };

const setup = (opt) => `
    const o = ${JSON.stringify(opt || {})};
    const W = Object.assign(${JSON.stringify(WEATHER)}, o.weather || {});
    const orig = FB.week.weatherAt;
    FB.week.weatherAt = (id, t) => W[id] || orig(id, t);
    __rec.weather = W;
    __rec.setup();
    const S = FB.S;
    // В ролике — без рекламы, окон нового уровня и тестовых пометок
    FB.sdk.showInterstitial = async () => false;
    FB.sdk.showRewarded = async () => 'closed';
    FB.state.addXp = () => {};
    const st = document.createElement('style');
    st.textContent = '.lb-mock, .mock-ad { display: none !important; }';
    document.head.appendChild(st);
    // Аквариум с трофеями и украшениями
    S.aqua = { slots: 6, fish: ['goldcarp', 'pike', 'catfish', 'perch', 'trout', 'bream'].filter(id => FB.fishById[id]), decor: ['plants', 'stones', 'chest', 'castle', 'coral'], on: ['plants', 'stones', 'chest', 'castle', 'coral'], theme: 'sea', themes: ['pond', 'sea'], day: FB.week ? -1 : -1 };
    S.who = o.who || 'boy';
    S.xp = o.xp || 52000;
    S.level = FB.state.levelFromXp(S.xp);
    S.coins = o.coins || 12480;
    S.pearls = o.pearls || 145;
    ['hat_straw', 'hat_viking', 'hat_frog', 'hat_sailor', 'hat_fisher', 'jk_hawaii', 'jk_life', 'jk_overalls', 'jk_hoodie', 'jk_sweater',
     'bt_rowboat', 'pet_cat', 'pet_penguin', 'pet_otter', 'fl_duck', 'fl_glow', 'rod_carbon', 'rod_sea'].forEach(id => { if (!S.owned.includes(id)) S.owned.push(id); });
    ['spinner', 'wobbler', 'corn', 'shrimp', 'squid', 'maggot', 'dough'].forEach(id => { if (!S.baits.includes(id)) S.baits.push(id); });
    if (S.rods && !S.rods.includes('carbon')) S.rods.push('carbon');
    Object.assign(S.look, o.look || { hat: 'hat_straw', jacket: 'jk_hawaii', pet: 'pet_cat', float: 'fl_duck', boat: 'bt_pier' });
    if (o.rod) S.rod = o.rod;
    S.bait = o.bait || 'corn';
    // Немного пойманного — альбом и статистика выглядят живыми
    ['crucian', 'roach', 'perch', 'bream', 'carp', 'tench', 'rudd', 'goldcarp', 'pike', 'trout', 'grayling', 'catfish', 'eel', 'zander'].forEach((id, i) => {
        if (FB.fishById[id]) S.album[id] = S.album[id] || { n: 3 + i, best: 400 + i * 380 };
    });
    S.stats.catches = Math.max(S.stats.catches, 214);
    S.pond = o.pond || 'village';
    FB.scene.setPlace(S.pond, W[S.pond]);
    FB.fishing.reset();
    FB.hud.update();
`;

// Точка заброса: на воде, справа от рыбака, удочка точно достанет
const castPoint = (dx, dy) => `const p = FB.tutor.castPoint(); return { x: p.x + (${dx || 0}) * innerWidth, y: p.y + (${dy || 0}) * innerHeight };`;

// Запланировать улов и забросить в точку (курсор плавно едет туда заранее)
const cast = (fishId, grams, opt) => {
    opt = opt || {};
    return `
    const p = FB.tutor.castPoint();
    const x = p.x + ${opt.dx || 0} * innerWidth, y = p.y + ${opt.dy || 0} * innerHeight;
    __rec.plan = { res: { kind: 'fish', fish: FB.fishById['${fishId}'], g: ${grams} }, biteIn: ${opt.biteIn || 1.4}, nibbles: ${JSON.stringify(opt.nibbles || [0.6])}, spinNeed: ${opt.spinNeed || 1.1} };
    __rec.tap(x, y);`;
};
const aim = (opt) => {
    opt = opt || {};
    return `const p = FB.tutor.castPoint(); __rec.moveTo(p.x + ${opt.dx || 0} * innerWidth, p.y + ${opt.dy || 0} * innerHeight, ${opt.dur || 0.6});`;
};
// Нажать «Забрать» в карточке улова
const keep = `__rec.click('.shade:last-child .choice .btn', 0);`;

// Сразу оказаться в месте (без анимации переезда) — для склейки сцен
const go = (pond, extra) => `
    FB.ui.closeAll();
    FB.S.pond = '${pond}';
    FB.fishing.reset();
    if (FB.drift) FB.drift.reset();
    FB.scene.setPlace('${pond}', __rec.weather['${pond}']);
    ${extra || ''}
    FB.hud.update();`;

module.exports = { setup, castPoint, cast, aim, keep, go, WEATHER };
