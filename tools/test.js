// test.js — проверки игры без браузера. Запуск: node tools/test.js
// Проверяет данные, тексты, турнир по неделям, шансы улова, прогресс,
// задания и баланс вываживания (бот-игрок ловит рыбу каждой редкости).

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
let passed = 0, failed = 0;
const ok = (cond, msg) => { if (cond) passed++; else { failed++; console.log('  ✗ ' + msg); } };
const section = (name) => console.log('• ' + name);

// ---------- Песочница с минимальным «браузером» ----------
const store = {};
const sandbox = {
    console, Math, Date, JSON, setTimeout: () => 0, clearTimeout: () => {}, setInterval: () => 0,
    location: { protocol: 'http:', hostname: 'localhost' },
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    navigator: { language: 'ru' }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
const load = (f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f });
['js/core/util.js', 'js/core/i18n.js', 'js/data/fish.js', 'js/data/gear.js', 'js/core/sdk.js',
    'js/game/week.js', 'js/game/catch.js', 'js/game/state.js', 'js/game/quests.js', 'js/game/tourney.js',
    'js/game/shop.js', 'js/game/fishing.js'].forEach(load);
const FB = sandbox.FB;
FB.sdk.mock = true;
FB.audio = { play() {}, pause() {}, resume() {}, apply() {} };
FB.scene = { project: () => ({ x: 0, y: 0, s: 1 }), unproject: () => ({ tx: -0.6, dist: 0.03 }), splash() {}, ripple() {}, weather: 'sun', unit: () => 1, L: { px: 200, py: 500, ph: 150, nearY: 540 } };
FB.person = { pose: { rod: 0, bend: 0, reel: false, lean: 0, look: 0 }, rodTip: () => ({ x: 0, y: 0 }) };
FB.S = FB.state.fresh();

// ---------- Данные ----------
section('Данные');
const ids = new Set();
FB.FISH.forEach(f => {
    ok(!ids.has(f.id), 'id рыбы повторяется: ' + f.id);
    ids.add(f.id);
    ok(FB.pondById[f.pond], 'нет места у ' + f.id);
    ok(f.w[0] > 0 && f.w[0] < f.w[1], 'вес ' + f.id);
    ok(f.d[0] >= 0 && f.d[1] <= 1 && f.d[0] < f.d[1], 'глубина ' + f.id);
    ok(FB.baitById[f.bait], 'наживка ' + f.id);
    ok(FB.RARITY[f.r] && f.r !== 'junk', 'редкость ' + f.id);
    ok(f.n.ru && f.n.en, 'название ' + f.id);
});
FB.PONDS.forEach(p => {
    FB.RARITY_ORDER.forEach(r => ok(FB.fishOfPond(p.id).some(f => f.r === r), p.id + ': нет рыбы редкости ' + r));
    ok(FB.fishOfPond(p.id).some(f => f.r === 'uncommon' || f.r === 'rare'), p.id + ': нечем быть рыбе недели');
});
FB.SEASON.tiers.forEach((t, i) => ['free', 'gold'].forEach(k => { if (t[k].item) ok(FB.cosById[t[k].item], 'сезон ' + i + ': нет вещи ' + t[k].item); }));
FB.PRODUCTS.forEach(p => (p.items || []).forEach(id => ok(FB.cosById[id], 'товар ' + p.id + ': нет вещи ' + id)));
FB.COSMETICS.forEach(c => ok(c.cost || c.src !== 'shop', 'вещь без цены и источника: ' + c.id));
Object.values(FB.DEFAULT_LOOK).forEach(id => ok(FB.cosById[id], 'нет вещи по умолчанию ' + id));
['hat_crown', 'fr_gold', 'fl_gold', 'fr_heart'].forEach(id => ok(FB.cosById[id], 'нет награды ' + id));

// ---------- Тексты ----------
section('Тексты RU/EN');
const RU = FB.DICT.ru, EN = FB.DICT.en;
Object.keys(RU).forEach(k => ok(k in EN, 'нет английского текста: ' + k));
Object.keys(EN).forEach(k => ok(k in RU, 'нет русского текста: ' + k));
const used = new Set();
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (p.endsWith('.js')) for (const m of fs.readFileSync(p, 'utf8').matchAll(/FB\.t\('([a-z0-9_]+)'/g)) if (!m[1].endsWith('_')) used.add(m[1]);
});
walk(path.join(ROOT, 'js'));
// Ключи, которые собираются из частей
FB.RARITY_ORDER.forEach(r => used.add('r_' + r));
['places', 'album', 'top', 'shop', 'tasks'].forEach(k => used.add('nav_' + k));
['tap_water', 'wait_bite', 'tap_now', 'hold_reel'].forEach(k => used.add('hint_' + k));
['snap', 'slack', 'early', 'missed'].forEach(k => used.add('lost_' + k));
FB.JUNK.forEach(j => used.add('junk_' + j.id));
FB.week.WEATHERS.forEach(w => used.add('wx_' + w));
FB.quests.TYPES.forEach(q => used.add('q_' + q));
FB.COSMETIC_CATS.forEach(c => used.add('cat_' + c));
new Set(FB.COSMETICS.map(c => c.src)).forEach(s => used.add('src_' + s));
['popular', 'best'].forEach(t => used.add('tag_' + t));
['anglers', 'record'].forEach(t => used.add('lb_desc_' + t));
used.add('too_far');
used.forEach(k => ok(k in RU, 'нет текста для ключа: ' + k));

// ---------- Турнир недели ----------
section('Турнир недели');
const W = FB.week;
const now = Date.UTC(2026, 9, 17, 12);
const cur = W.index(now);
ok(W.start(cur) <= now && now < W.end(cur), 'неделя считается верно');
ok(new Date(W.start(cur) + 3 * 3600000).getUTCDay() === 1, 'неделя начинается в понедельник по Москве');
const seen = {};
let repeats = 0;
for (let i = cur; i < cur + 520; i++) {
    const c = W.config(i), p = W.config(i - 1);
    if (c.pond === p.pond) repeats++;
    seen[c.pond] = (seen[c.pond] || 0) + 1;
    ok(FB.fishById[c.fish].pond === c.pond, 'рыба недели не из того места, неделя ' + i);
    ok(W.WEATHERS.includes(c.weather), 'погода недели ' + i);
    ok(JSON.stringify(W.config(i)) === JSON.stringify(c), 'неделя ' + i + ' не повторяется одинаково');
}
ok(repeats === 0, 'место повторяется две недели подряд: ' + repeats);
FB.PONDS.forEach(p => ok(seen[p.id] > 40, 'место редко бывает турнирным: ' + p.id + ' ' + seen[p.id]));
ok(W.board(cur) !== W.board(cur + 1), 'доски чередуются');
ok(W.decode(W.encode(cur, 12345)).pts === 12345 && W.decode(W.encode(cur, 12345)).idx === cur, 'кодирование очков');
ok(W.encode(cur + 1500, 999999) < 2147483647, 'очки помещаются в 32 бита ещё 30 лет');
ok(W.encode(cur, 5) > W.encode(cur - 1, 999999), 'новая неделя всегда выше старой');
let best = [];
[5, 50, 1, 30, 7, 9, 100, 3, 2, 8, 60, 4].forEach(x => { best = W.addCatch(best, x); });
ok(best.length === 10 && W.sum(best) === 276, 'считаются 10 лучших уловов: ' + W.sum(best));

// ---------- Шансы улова ----------
section('Шансы улова');
const bamboo = FB.rodById.bamboo, star = FB.rodById.star;
FB.PONDS.forEach(p => {
    const ch = FB.catcher.chances({ pond: p.id, dist: 0.5, bait: 'worm', rod: bamboo, weather: 'sun', bubble: false });
    const sum = ch.reduce((a, c) => a + c.p, 0);
    ok(Math.abs(sum - 1) < 1e-9, 'шансы складываются в 1: ' + p.id);
});
const rarityShare = (ctx) => {
    const out = {};
    FB.catcher.chances(ctx).forEach(c => { out[c.fish.r] = (out[c.fish.r] || 0) + c.p; });
    return out;
};
const plain = rarityShare({ pond: 'village', dist: 0.55, bait: 'worm', rod: bamboo, weather: 'sun', bubble: false });
const bub = rarityShare({ pond: 'village', dist: 0.55, bait: 'maggot', rod: star, weather: 'sun', bubble: true });
console.log('    деревня, бамбук, середина: ' + Object.entries(plain).map(([k, v]) => k + ' ' + (v * 100).toFixed(1) + '%').join(', '));
console.log('    деревня, звёздная, пузыри: ' + Object.entries(bub).map(([k, v]) => k + ' ' + (v * 100).toFixed(1) + '%').join(', '));
ok(plain.common > 0.4, 'обычной рыбы большинство');
ok(plain.legendary > 0.001 && plain.legendary < 0.03, 'легендарная — редкость');
ok(bub.legendary > plain.legendary * 2, 'пузыри и хорошая удочка помогают');
for (let i = 0; i < 2000; i++) {
    const f = FB.FISH[i % FB.FISH.length];
    const g = FB.catcher.rollWeight(f, { rod: bamboo, bubble: false });
    if (g < f.w[0] || g > f.w[1]) { ok(false, 'вес вне границ: ' + f.id + ' ' + g); break; }
}
ok(FB.catcher.points(FB.fishById.crucian, 400, false) >= 1, 'очки положительные');
ok(Math.abs(FB.catcher.points(FB.fishById.perch, 600, true) - 2 * FB.catcher.points(FB.fishById.perch, 600, false)) <= 1, 'рыба недели ×2');

// ---------- Прогресс ----------
section('Прогресс и сохранение');
let lvlOk = true;
for (let x = 0; x < 200000; x += 37) if (FB.state.levelFromXp(x) > FB.state.levelFromXp(x + 37)) lvlOk = false;
ok(lvlOk, 'уровень не убывает');
FB.S = FB.state.fresh();
FB.sdk.mockShift = now - Date.now();
FB.quests.sync();
ok(FB.S.daily.quests.length === 3 && new Set(FB.S.daily.quests.map(q => q.type)).size === 3, 'три разных задания');
const ctx = { pond: 'village', dist: 0.5, bait: 'worm', rod: bamboo, weather: 'sun', bubble: false };
const out1 = FB.state.applyCatch({ kind: 'fish', fish: FB.fishById.crucian, g: 500 }, Object.assign({}, ctx), true);
ok(out1.newSpecies && FB.S.album.crucian.n === 1 && FB.S.album.crucian.best === 500, 'первый карась в альбоме');
const out2 = FB.state.applyCatch({ kind: 'fish', fish: FB.fishById.crucian, g: 700 }, Object.assign({}, ctx), false);
ok(out2.record && !out2.newSpecies && FB.S.album.crucian.best === 700, 'рекорд вида');
ok(FB.S.stats.released === 1, 'счётчик отпущенных');
FB.state.applyCatch({ kind: 'fish', fish: FB.fishById.perch, g: 300 }, Object.assign({}, ctx), true);
const keepXp = FB.state.applyCatch({ kind: 'fish', fish: FB.fishById.perch, g: 300 }, Object.assign({}, ctx), true).xp;
const relXp = FB.state.applyCatch({ kind: 'fish', fish: FB.fishById.perch, g: 300 }, Object.assign({}, ctx), false).xp;
ok(relXp > keepXp, 'отпустить — больше опыта');
const cfg = FB.state.weekCfg();
const tctx = Object.assign({}, ctx, { pond: cfg.pond });
const fishW = FB.fishById[cfg.fish];
const o3 = FB.state.applyCatch({ kind: 'fish', fish: fishW, g: fishW.w[1] }, tctx, true);
ok(o3.tourney && o3.isWeekFish && FB.state.weekScore() === o3.pts, 'улов в турнире засчитан');
const o4 = FB.state.applyCatch({ kind: 'junk', junk: FB.junkById.chest }, Object.assign({}, ctx), true);
ok(o4.coins === 120 && FB.S.junk.chest === 1, 'сундук даёт монеты');
// Сохранение и загрузка через слияние
const saved = JSON.parse(JSON.stringify(FB.S));
delete saved.season;
const merged = FB.state.merge(FB.state.fresh(), saved);
ok(merged.season && merged.album.crucian.best === 700, 'старое сохранение без новых полей дополняется');

// ---------- Задания и подарок ----------
section('Задания и подарок');
FB.S = FB.state.fresh();
FB.sdk.mockShift = now - Date.now();
FB.quests.sync();
const g1 = FB.quests.claimGift(false);
ok(g1 && g1.coins === 60 && FB.S.daily.streak === 1, 'подарок первого дня');
ok(!FB.quests.claimGift(false), 'второй раз за день подарок не дают');
FB.sdk.mockShift += 86400000;
FB.quests.sync();
ok(FB.S.daily.streak === 1 && FB.quests.giftToday().coins === 90, 'второй день подряд — подарок больше');
FB.quests.claimGift(false);
FB.sdk.mockShift += 3 * 86400000;
FB.quests.sync();
ok(FB.S.daily.streak === 0, 'пропуск дня — серия сначала');
{
    const Q = FB.quests;
    ok(Q.giftAt(6, 0).pearls === 10 && Q.giftAt(6, 1).pearls === 15 && Q.giftAt(6, 2).pearls === 20, 'жемчуг за 7-й день растёт с каждым кругом');
    ok(Q.giftAt(0, 1).coins > Q.giftAt(0, 0).coins, 'на новом круге монет больше');
    ok(Q.giftAt(6, 99).pearls === Q.giftAt(6, Q.MAX_CYCLE).pearls, 'рост подарков ограничен');
    const keepD = FB.S.daily;
    FB.S.daily = Object.assign({}, keepD, { streak: 7, gift: false });
    ok(Q.cycle() === 1 && Q.giftToday().coins === Q.giftAt(0, 1).coins, 'после 7-го дня — второй круг с первого дня');
    FB.S.daily = keepD;
}
const q = FB.S.daily.quests[0];
q.type = 'catch'; q.n = 2; q.p = 0; q.done = false;
FB.quests.onCatch({ kind: 'fish', fish: FB.fishById.crucian, g: 100 }, {}, { pts: 10 });
FB.quests.onCatch({ kind: 'fish', fish: FB.fishById.crucian, g: 100 }, {}, { pts: 10 });
ok(q.done, 'задание «поймай 2 рыбы» выполнено');
ok(FB.quests.claim(0) && !FB.quests.claim(0), 'награда за задание — один раз');

// ---------- Награда за неделю ----------
section('Награда за прошлую неделю');
FB.S = FB.state.fresh();
FB.sdk.mockShift = now - Date.now();
const wi = FB.state.weekIdx();
FB.S.week = { idx: wi - 1, best: [100, 50], catches: 2 };
FB.tourney.checkWeek().then(r => {
    ok(r && r.idx === wi - 1 && r.pts === 150, 'итоги прошлой недели посчитаны');
    ok(FB.S.week.idx === wi && FB.S.week.best.length === 0, 'новая неделя начата с нуля');
    return FB.tourney.checkWeek();
}).then(r2 => {
    ok(r2 === null, 'награда не выдаётся дважды');
    ok(FB.tourney.rewardFor(1).items.includes('hat_crown') && FB.tourney.rewardFor(250).kind === 'member', 'награды по местам');
    fightSim();
    lessonSim();
    newChecks();
    finish();
});

// ---------- Баланс вываживания ----------
// Бот держит палец, пока стрелка в нижней части зелёной зоны, отпускает в верхней
// и реагирует с задержкой. Сильная рыба должна быть труднее, но не невозможной
function fightSim() {
    section('Баланс вываживания (бот с реакцией 0,25 с — как обычный игрок)');
    const F = FB.fishing;
    const runOne = (fish, g, rod, react) => {
        FB.S = FB.state.fresh();
        FB.S.rod = rod.id; FB.S.rods = [rod.id];
        FB.S.stats.catches = 5;
        F.reset();
        F.res = { kind: 'fish', fish, g };
        F.ctx = { pond: fish.pond, dist: 0.6, bait: 'worm', rod, weather: 'sun', bubble: false };
        F.target = { tx: 0, dist: 0.6 };
        F.phase = 'bite';
        F.window = 9;
        F.press(0, 0);
        F.release();
        let want = false, delay = 0, t = 0, result = 'timeout';
        const dt = 1 / 60;
        while (t < 90) {
            t += dt;
            const z = F.zone, w = z.hi - z.lo;
            const target = F.tension < z.lo + w * 0.35 ? true : F.tension > z.hi - w * 0.3 ? false : want;
            if (target !== want) { delay += dt; if (delay >= react) { want = target; delay = 0; } } else delay = 0;
            F.holding = want;
            F.update(dt);
            if (F.phase === 'land') { result = 'caught'; break; }
            if (F.phase === 'lost') { result = F.lostReason; break; }
        }
        return { result, t };
    };
    const lines = [];
    const fails = [];
    const rate = {};
    FB.RARITY_ORDER.forEach(r => {
        [FB.rodById.bamboo, FB.rodById.carbon, FB.rodById.star].forEach(rod => {
            const list = FB.FISH.filter(f => f.r === r);
            let caught = 0, total = 0, time = 0;
            const why = {};
            list.forEach(f => {
                for (let i = 0; i < 6; i++) {
                    const g = FB.catcher.rollWeight(f, { rod, bubble: false });
                    const res = runOne(f, g, rod, 0.25);
                    total++;
                    if (res.result === 'caught') { caught++; time += res.t; } else why[res.result] = (why[res.result] || 0) + 1;
                }
            });
            const k = caught / total;
            rate[r + '/' + rod.id] = k;
            const z = F.zoneFor(FB.catcher.strength(list[0], list[0].avg), rod);
            lines.push('    ' + r.padEnd(10) + rod.id.padEnd(7) + ' зелёная ' + Math.round((z.hi - z.lo) * 100) + '%, поймано ' + (k * 100).toFixed(0).padStart(3) + '%, в среднем ' + (caught ? (time / caught).toFixed(1) : '-') + ' с' + (Object.keys(why).length ? '  срывы: ' + JSON.stringify(why) : ''));
        });
    });
    // Самые тяжёлые легендарные рыбы на бамбуковой удочке
    let hc = 0, ht = 0;
    FB.FISH.filter(f => f.r === 'legendary').forEach(f => {
        for (let i = 0; i < 10; i++) { ht++; if (runOne(f, f.w[1], FB.rodById.bamboo, 0.15).result === 'caught') hc++; }
    });
    lines.push('    самые тяжёлые легендарные на бамбуковой: поймано ' + Math.round(hc / ht * 100) + '%');
    lines.forEach(l => console.log(l));
    ['bamboo', 'carbon', 'star'].forEach(rod => {
        if (rate['common/' + rod] < 0.95) fails.push('обычную рыбу ловить слишком трудно: ' + rod);
        if (rate['uncommon/' + rod] < 0.85) fails.push('необычную рыбу ловить слишком трудно: ' + rod);
    });
    if (rate['legendary/star'] < 0.7) fails.push('легендарную даже со звёздной удочкой почти не поймать');
    if (rate['legendary/bamboo'] > 0.7) fails.push('легендарная с бамбуковой — слишком легко');
    if (rate['legendary/bamboo'] >= rate['epic/bamboo'] || rate['epic/bamboo'] > rate['rare/bamboo'] + 0.05) fails.push('чем реже рыба, тем должно быть труднее');
    if (hc / ht < 0.1) fails.push('самую сильную рыбу на бамбуковую не поймать вовсе');
    fails.forEach(f => ok(false, f));
    if (!fails.length) passed++;
}

// ---------- Урок рыбалки ----------
// На уроке рыбу нельзя упустить: рано нажал — не беда, поклёвка ждёт, леска не рвётся
function lessonSim() {
    section('Урок рыбалки');
    const F = FB.fishing;
    let lessonOn = true;
    FB.tutor = { inLesson: () => lessonOn };
    FB.S = FB.state.fresh();
    F.reset();
    let lost = 0;
    FB.on('lost', () => { lost++; });
    const run = (sec, fn) => { for (let t = 0; t < sec; t += 1 / 60) { if (fn) fn(); F.update(1 / 60); } };
    F.press(100, 100); F.release();
    ok(F.phase === 'cast' && F.ctx.tut, 'урок: заброс помечен как учебный');
    ok(F.res.kind === 'fish' && F.res.fish.id === 'crucian', 'урок: на крючке карась');
    run(1);
    ok(F.phase === 'wait', 'урок: ждём поклёвку');
    F.press(0, 0); F.release();
    ok(F.phase === 'wait', 'урок: раннее нажатие не сматывает удочку');
    run(4);
    ok(F.phase === 'bite', 'урок: поклёвка через ~4 с');
    run(10);
    ok(F.phase === 'bite', 'урок: поклёвка ждёт сколько нужно');
    F.press(0, 0);
    ok(F.phase === 'fight', 'урок: подсекли');
    run(5, () => { F.holding = false; });
    ok(F.phase === 'fight' && lost === 0, 'урок: провисшая леска не упускает рыбу');
    run(2.5, () => { F.holding = true; });
    ok((F.phase === 'fight' || F.phase === 'land') && lost === 0, 'урок: леска на пределе не рвётся');
    run(30, () => { F.holding = F.tension < 0.6; });
    ok(F.phase === 'land' || F.phase === 'idle', 'урок: рыба поймана');
    ok(lost === 0, 'урок: ни одного срыва');
    lessonOn = false;
    FB.S.stats.catches = 1;
    F.reset();
    F.press(100, 100); F.release();
    ok(!F.ctx.tut, 'после урока заброс обычный');
}

// ---------- Заброс, уровни, главный улов, зелёная зона ----------
function newChecks() {
    section('Дальность, уровни, главный улов');
    const F = FB.fishing;
    FB.tutor = { inLesson: () => false };
    FB.S = FB.state.fresh();
    FB.S.stats.catches = 3;
    F.reset();
    // Сцена-заглушка: всё, что нажато, — далеко-далеко
    const keep = FB.scene.unproject;
    FB.scene.unproject = (x, y) => (x === 0 && y === 0 ? { tx: 0.9, dist: 0.95 } : keep(x, y));
    F.press(0, 0); F.release();
    ok(F.phase === 'idle' && F.reachFlash > 0, 'слишком далеко — заброса нет, показана граница');
    FB.scene.unproject = keep;
    ok(FB.RODS.every((r, i) => i === 0 || r.reach > FB.RODS[i - 1].reach), 'каждая следующая удочка достаёт дальше');
    ok(FB.rodById.bamboo.reach <= 0.45, 'бамбуковая не достаёт далеко');

    const bamboo = FB.rodById.bamboo, star = FB.rodById.star;
    const zw = (s, r) => { const z = F.zoneFor(s, r); return z.hi - z.lo; };
    ok(zw(0.14, bamboo) > zw(0.5, bamboo) && zw(0.5, bamboo) > zw(0.8, bamboo), 'чем сильнее рыба, тем уже зелёная зона');
    ok(zw(0.95, bamboo) >= F.TUNE.zoneMin - 1e-9, 'зелёная зона не уже предела');
    ok(zw(0.8, star) > zw(0.8, bamboo), 'хорошая удочка расширяет зелёную зону');

    FB.S = FB.state.fresh();
    let lv = null;
    FB.on('levelUp', (e) => { lv = e; });
    const coins = FB.S.coins;
    FB.state.addXp(FB.state.need(1));
    ok(lv && lv.level === 2 && lv.reward.coins === FB.state.levelReward(2).coins, 'подарок за уровень');
    ok(lv && FB.S.coins === coins + lv.reward.coins, 'монеты за уровень начислены');
    ok(FB.state.levelReward(5).pearls > 0 && FB.state.levelReward(4).pearls === 0, 'жемчуг — каждый пятый уровень');
    ok(FB.state.nextUnlock() && FB.state.nextUnlock().lvl > FB.S.level, 'известно, что откроется дальше');

    FB.S = FB.state.fresh();
    FB.state.syncWeek();
    const cfg = FB.state.weekCfg();
    const fish = FB.fishOfPond(cfg.pond);
    const small = fish[0], large = fish[fish.length - 1];
    FB.state.applyCatch({ kind: 'fish', fish: small, g: small.w[0] }, { pond: cfg.pond }, true);
    FB.state.applyCatch({ kind: 'fish', fish: large, g: large.w[1] }, { pond: cfg.pond }, true);
    const big = FB.S.week.big;
    ok(big && big.f === large.id, 'главный улов недели — самый ценный');
    const ex = FB.tourney.parseExtra(FB.tourney.extra(true));
    ok(ex.big && big && ex.big.f === big.f && ex.big.g === big.g && ex.big.pts === big.pts, 'главный улов уходит в топ и читается обратно');
    ok(!FB.tourney.parseExtra('f:fr_none;b:nofish.10.5').big, 'чужой мусор в extraData не ломает топ');
}

function finish() {
    console.log('\n' + (failed ? '✗' : '✓') + ' Проверок: ' + passed + ' прошло, ' + failed + ' с ошибкой');
    process.exit(failed ? 1 : 0);
}
