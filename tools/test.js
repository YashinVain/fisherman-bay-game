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
['js/core/util.js', 'js/core/i18n.js', 'js/data/fish.js', 'js/data/gear.js', 'js/core/sdk.js', 'js/core/music.js',
    'js/game/week.js', 'js/game/catch.js', 'js/game/state.js', 'js/game/quests.js', 'js/game/tourney.js',
    'js/game/shop.js', 'js/game/fishing.js', 'js/game/drift.js', 'js/game/places.js', 'js/game/events.js', 'js/game/aqua.js'].forEach(load);
const FB = sandbox.FB;
FB.sdk.mock = true;
FB.audio = { play() {}, pause() {}, resume() {}, apply() {} };
FB.scene = { W: 1000, H: 700, fx: [], project: () => ({ x: 0, y: 0, s: 1 }), unproject: () => ({ tx: -0.6, dist: 0.03 }), splash() {}, ripple() {}, weather: 'sun', unit: () => 1, L: { px: 200, py: 500, ph: 150, nearY: 540 } };
FB.person = { pose: { rod: 0, bend: 0, reel: false, lean: 0, look: 0 }, rodTip: () => ({ x: 0, y: 0 }), boatType: () => 'pier' };
FB.S = FB.state.fresh();

// ---------- Все файлы игры разбираются без ошибок ----------
section('Синтаксис');
const allJs = [];
const walkJs = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach(e => { const p = path.join(dir, e.name); if (e.isDirectory()) walkJs(p); else if (p.endsWith('.js')) allJs.push(p); });
walkJs(path.join(ROOT, 'js'));
allJs.forEach(p => { try { new vm.Script(fs.readFileSync(p, 'utf8'), { filename: p }); ok(true); } catch (e) { ok(false, 'ошибка в ' + path.relative(ROOT, p) + ': ' + e.message); } });
const htmlScripts = [...fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').matchAll(/<script src="([^"]+)">/g)].map(m => m[1]);
allJs.forEach(p => ok(htmlScripts.includes(path.relative(ROOT, p).split(path.sep).join('/')), 'файл не подключён в index.html: ' + path.relative(ROOT, p)));

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
['tap_water', 'wait_bite', 'tap_now', 'hold_reel', 'spin'].forEach(k => used.add('hint_' + k));
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
const tctx = Object.assign({}, ctx, { pond: 'arena', fishPond: cfg.pond });
ok(!FB.state.applyCatch({ kind: 'fish', fish: FB.fishById.crucian, g: 300 }, Object.assign({}, ctx, { pond: cfg.pond }), true).tourney, 'в обычном месте очки турнира не идут');
FB.S.week.best = []; FB.S.week.catches = 0;
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
    ok(FB.tourney.rewardFor(20).kind === 'top20' && FB.tourney.rewardFor(21).kind === 'top100', 'медаль — за топ-20');
    fightSim();
    lessonSim();
    newChecks();
    driftChecks();
    placeChecks();
    excitementChecks();
    modeChecks();
    aquaChecks();
    sonarChecks();
    packChecks();
    musicChecks();
    finish();
});

// ---------- Баланс вываживания ----------
// Бот держит палец, пока стрелка в нижней части зелёной зоны, отпускает в верхней
// и реагирует с задержкой. Сильная рыба должна быть труднее, но не невозможной
function fightSim() {
    section('Баланс вываживания (бот с реакцией 0,25 с — как обычный игрок)');
    // Одинаковые случайности при каждом запуске — чтобы цифры не прыгали
    const realRandom = Math.random;
    Math.random = FB.U.seeded(20261018);
    const F = FB.fishing;
    const runOne = (fish, g, rod, react, perfect) => {
        FB.S = FB.state.fresh();
        FB.S.rod = rod.id; FB.S.rods = [rod.id];
        FB.S.stats.catches = 5;
        F.reset();
        F.res = { kind: 'fish', fish, g };
        F.ctx = { pond: fish.pond, dist: 0.6, bait: 'worm', rod, weather: 'sun', bubble: false };
        F.target = { tx: 0, dist: 0.6 };
        F.phase = 'bite';
        F.window = 0.85;
        // Подсекает с обычной скоростью человека — не всегда «отлично»
        F.update(perfect ? 0.05 : 0.32);
        F.press(0, 0);
        F.release();
        let want = false, delay = 0, t = 0, result = 'timeout', runSeen = 0, nextSteer = 0;
        const dt = 1 / 60;
        while (t < 90) {
            t += dt;
            const z = F.zone, w = z.hi - z.lo;
            let target = F.tension < z.lo + w * 0.35 ? true : F.tension > z.hi - w * 0.3 ? false : want;
            if (F.jump > 0 || F.jumpWarn > 0) target = false;
            if (F.run) { runSeen += dt; if (runSeen > react + 0.3) { F.steer(-F.run.dir); runSeen = 0; } } else runSeen = 0;
            if (t >= nextSteer) { F.steerKey = Math.abs(F.face) > 0.35 ? -Math.sign(F.face) : 0; nextSteer = t + react; }
            if (target !== want) { delay += dt; if (delay >= react) { want = target; delay = 0; } } else delay = 0;
            F.holding = want;
            F.update(dt);
            if (F.phase === 'land') { result = 'caught'; break; }
            if (F.phase === 'lost') { result = F.lostReason; break; }
        }
        F.steerKey = 0;
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
                for (let i = 0; i < (r === 'legendary' || r === 'epic' ? 14 : 6); i++) {
                    const g = FB.catcher.rollWeight(f, { rod, bubble: false });
                    const res = runOne(f, g, rod, 0.25, i % 3 === 0);
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
    // По характерам: редкие рыбы на карбоновой
    FB.STYLES.forEach(stl => {
        const list = FB.FISH.filter(f => f.st === stl && FB.RARITY[f.r].order >= 1);
        if (!list.length) return;
        let c = 0, n = 0;
        list.forEach(f => { for (let i = 0; i < 5; i++) { n++; if (runOne(f, FB.catcher.rollWeight(f, { rod: FB.rodById.carbon }), FB.rodById.carbon, 0.25).result === 'caught') c++; } });
        rate['style/' + stl] = c / n;
        lines.push('    характер ' + stl.padEnd(6) + ' (необычные и реже, карбон): поймано ' + Math.round(c / n * 100) + '%');
    });
    lines.forEach(l => console.log(l));
    ['bamboo', 'carbon', 'star'].forEach(rod => {
        if (rate['common/' + rod] < 0.95) fails.push('обычную рыбу ловить слишком трудно: ' + rod);
        if (rate['uncommon/' + rod] < 0.85) fails.push('необычную рыбу ловить слишком трудно: ' + rod);
    });
    if (rate['legendary/star'] < 0.7) fails.push('легендарную даже со звёздной удочкой почти не поймать');
    // Бот почти идеальный (реакция 0,25 с, никогда не ошибается со свечкой) — живой игрок ловит заметно хуже
    if (rate['legendary/bamboo'] > 0.8) fails.push('легендарная с бамбуковой — слишком легко');
    if (rate['legendary/bamboo'] >= rate['epic/bamboo'] || rate['epic/bamboo'] > rate['rare/bamboo'] + 0.05) fails.push('чем реже рыба, тем должно быть труднее');
    if (hc / ht < 0.1) fails.push('самую сильную рыбу на бамбуковую не поймать вовсе');
    FB.STYLES.forEach(stl => { if (rate['style/' + stl] !== undefined && rate['style/' + stl] < 0.6) fails.push('рыбу с характером ' + stl + ' почти не поймать: ' + rate['style/' + stl]); });
    fails.forEach(f => ok(false, f));
    if (!fails.length) passed++;
    Math.random = realRandom;
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
    FB.state.applyCatch({ kind: 'fish', fish: small, g: small.w[0] }, { pond: 'arena' }, true);
    FB.state.applyCatch({ kind: 'fish', fish: large, g: large.w[1] }, { pond: 'arena' }, true);
    const big = FB.S.week.big;
    ok(big && big.f === large.id, 'главный улов недели — самый ценный');
    const ex = FB.tourney.parseExtra(FB.tourney.extra(true));
    ok(ex.big && big && ex.big.f === big.f && ex.big.g === big.g && ex.big.pts === big.pts, 'главный улов уходит в топ и читается обратно');
    ok(!FB.tourney.parseExtra('f:fr_none;b:nofish.10.5').big, 'чужой мусор в extraData не ломает топ');
    // Образ и статистика уходят в топ и читаются обратно
    FB.S.who = 'grandpa';
    Object.assign(FB.S.look, { hat: 'hat_captain', jacket: 'jk_hawaii', boat: 'bt_rowboat', pet: 'pet_raccoon', frame: 'fr_crystal' });
    FB.S.buy.supporter = true;
    FB.S.stats.catches = 99999; FB.S.stats.bestId = 'swordfish'; FB.S.stats.bestG = 600000; FB.S.level = 60;
    FB.FISH.forEach(f => { FB.S.album[f.id] = { n: 1, best: 1 }; });
    FB.S.week.big = { f: 'swordfish', g: 150000, pts: 4000 };
    const exs = FB.tourney.extra(true);
    ok(exs.length <= 120, 'extraData короткий (' + exs.length + ' символов)');
    const px = FB.tourney.parseExtra(exs);
    ok(px.frame === 'fr_crystal' && px.supporter && px.look && px.look.who === 'grandpa' && px.look.look.hat === 'hat_captain' && px.look.look.pet === 'pet_raccoon', 'образ рыбака читается из топа');
    ok(px.stats && px.stats.level === 60 && px.stats.catches === 99999 && px.stats.species === FB.FISH.length && px.stats.bestId === 'swordfish', 'статистика читается из топа');
    ok(FB.tourney.parseExtra('f:fr_gold').frame === 'fr_gold' && FB.tourney.parseExtra('f:gold').frame === 'fr_gold', 'старый и новый формат рамки');
    ok(!FB.tourney.parseExtra('o:x.nohat.nojk.noboat.nopet').look.look.hat.startsWith('hat_no'), 'чужой мусор в образе заменяется обычным');
}

// ---------- Характер, подсечка, серия, жор ----------
function excitementChecks() {
    section('Характер рыб, подсечка, серия, жор');
    const F = FB.fishing;
    ok(FB.FISH.every(f => FB.STYLES.includes(f.st)), 'у каждой рыбы есть характер');
    FB.STYLES.forEach(stl => ok(FB.FISH.some(f => f.st === stl), 'нет рыб с характером ' + stl));
    ok(FB.FISH.filter(f => f.st === 'calm').every(f => FB.RARITY[f.r].order <= 1), 'спокойные — только простые рыбы');
    // Серия
    FB.S = FB.state.fresh();
    ok(FB.state.streakMul() === 1, 'без серии — без бонуса');
    FB.state.streakUp(false); FB.state.streakUp(true);
    ok(FB.S.luck === 3 && Math.abs(FB.state.streakMul() - 1.15) < 1e-9, 'серия: улов +1, отличная подсечка +2');
    for (let i = 0; i < 20; i++) FB.state.streakUp(true);
    ok(FB.S.luck === FB.state.STREAK_MAX && FB.state.streakMul() <= 1.5 + 1e-9, 'серия не растёт бесконечно');
    FB.state.streakBreak();
    ok(FB.S.luck === 0, 'срыв — серия с нуля');
    // Подсечка: сразу — отличная, поздно — обычная
    const hookAt = (delay) => {
        FB.S = FB.state.fresh(); FB.S.stats.catches = 5; FB.S.tut = 99;
        F.reset();
        F.res = { kind: 'fish', fish: FB.fishById.perch, g: 300 };
        F.ctx = { pond: 'village', dist: 0.4, bait: 'worm', rod: FB.rodById.bamboo, weather: 'sun', bubble: false };
        F.target = { tx: 0, dist: 0.4 };
        F.phase = 'bite'; F.window = 0.8;
        F.update(delay);
        F.press(0, 0); F.release();
        return F.perfect;
    };
    ok(hookAt(0.05) === true && hookAt(0.6) === false, 'отличная подсечка — только если сразу');
    // Свечка: держал в прыжке — натяжение растёт, отпустил — рыба устаёт
    FB.S = FB.state.fresh(); FB.S.stats.catches = 5; FB.S.tut = 99;
    F.reset();
    F.res = { kind: 'fish', fish: FB.fishById.trout, g: 1200 };
    F.ctx = { pond: 'river', dist: 0.5, bait: 'spinner', rod: FB.rodById.carbon, weather: 'sun', bubble: false };
    F.target = { tx: 0, dist: 0.5 }; F.phase = 'bite'; F.window = 9;
    F.press(0, 0); F.release();
    F.surgeIn = 99; F.jumpWarn = 0.01; F.tension = 0.5;
    const p0 = F.progress;
    for (let t = 0; t < 1.2; t += 1 / 60) F.update(1 / 60);
    ok(F.progress > p0, 'отпустил в свечку — рыба устала');
    // Камыш: развернул — бонус, не успел — рыба отвоевала леску
    F.run = { dir: 1, t: 0, x0: 0 };
    const p1 = F.progress;
    F.steer(1);
    ok(F.run, 'вести в ту же сторону — не помогает');
    F.steer(-1);
    ok(!F.run && F.progress > p1, 'повёл в другую сторону — развернул');
    F.run = { dir: -1, t: 0, x0: 0 }; F.surgeIn = 99; F.progress = 0.5;
    let tangled = false;
    for (let t = 0; t < F.TUNE.runLen + 0.2; t += 1 / 60) { F.holding = F.tension < 0.5; F.update(1 / 60); if (F.call && F.call.key === 'tangled') { tangled = true; break; } if (F.phase !== 'fight') break; }
    ok(tangled && F.phase === 'fight' && F.progress < 0.5, 'не развернул — запуталась, но не сорвалась');
    // Ведение: против хода рыбы подмотка быстрее, по ходу — медленнее
    const lead = (side) => {
        FB.S = FB.state.fresh(); FB.S.stats.catches = 5; FB.S.tut = 99;
        F.reset();
        F.res = { kind: 'fish', fish: FB.fishById.perch, g: 300 };
        F.ctx = { pond: 'village', dist: 0.4, bait: 'worm', rod: FB.rodById.bamboo, weather: 'sun', bubble: false };
        F.target = { tx: 0, dist: 0.4 }; F.phase = 'bite'; F.window = 9;
        F.press(0, 0);
        F.surgeIn = 99; F.face = 1; F.tension = 0.5; F.stam = 1;
        F.steerKey = side; F.holding = true;
        const p0 = F.progress;
        F.update(0.1);
        F.steerKey = 0;
        return F.progress - p0;
    };
    ok(lead(-1) > lead(0) && lead(0) > lead(1), 'против хода рыбы тянуть быстрее, по ходу — медленнее');
    // Силы рыбы: кончились — «выдохлась», тянуть легче
    F.stam = 0.001; F.tension = 0.5; F.holding = true; F.steerKey = -1; F.surgeIn = 99;
    F.update(0.05);
    ok(F.tired > 0 && F.stam === 0, 'рыба выдыхается, когда силы кончились');
    F.steerKey = 0; F.holding = false;
    // Жор
    const E = FB.events;
    FB.S = FB.state.fresh(); FB.S.tut = 99; FB.S.stats.catches = 10;
    F.reset();
    E.startFrenzy();
    ok(E.frenzyOn() && E.frenzyLeft() > 30, 'жор начался');
    for (let t = 0; t < E.FRENZY_LEN + 1; t += 0.5) E.update(0.5);
    ok(!E.frenzyOn(), 'жор кончается');
}

// ---------- Эхолот и находки ----------
function sonarChecks() {
    section('Эхолот');
    const code = fs.readFileSync(path.join(ROOT, 'js/ui/sonar.js'), 'utf8');
    vm.runInContext(code, sandbox, { filename: 'sonar.js' });
    const SN = FB.sonar;
    const keepBoat = FB.person.boatType;
    FB.person.boatType = () => 'pier';
    ok(!SN.has(), 'с мостков эхолота нет');
    FB.person.boatType = () => 'raft';
    ok(SN.level() === 1, 'на плоту — простой эхолот');
    const big = { kind: 'fish', fish: FB.fishById.catfish, g: 40000 }, small = { kind: 'fish', fish: FB.fishById.bleak, g: 15 };
    ok(SN.read(big, 1).text !== SN.read(small, 1).text, 'плот отличает крупную рыбу от мелочи');
    ok(SN.read({ kind: 'junk', junk: FB.JUNK[0] }, 1).junk, 'эхолот видит мусор');
    ok(SN.read(big, 2).text.indexOf(FB.t('r_epic')) === 0, 'лодка показывает редкость');
    ok(SN.read(big, 3).text.indexOf('~') > 0, 'яхта показывает и вес');
    FB.person.boatType = keepBoat;
    // Находки плывут через весь экран и не исчезают посреди воды
    const D = FB.drift;
    const keepP = FB.scene.project, keepU = FB.scene.unproject;
    FB.scene.project = (tx, dist) => ({ x: 500 + tx * 400, y: 400 + dist * 100, s: 1 });
    FB.scene.unproject = (x, y) => ({ tx: (x - 500) / 400, dist: (y - 400) / 100 });
    const it = D.spawn('bottle', 0.3);
    ok(FB.scene.project(it.tx, it.dist).x > FB.scene.W && FB.scene.project(it.t1, 0.3).x < 0, 'находка появляется и уплывает за краем экрана');
    ok(Math.abs((it.t1 - it.tx) / it.v - D.CROSS) < 1e-6, 'плывёт с постоянной скоростью');
    FB.scene.project = keepP; FB.scene.unproject = keepU;
    D.item = null;
    ok(['bottle', 'duck', 'shell', 'chest'].every(k => typeof D.ART[k] === 'function'), 'у каждой находки своя картинка');
}

// ---------- Аквариум ----------
function aquaChecks() {
    section('Аквариум');
    const AQ = FB.aqua;
    FB.S = FB.state.fresh();
    const a = AQ.st();
    ok(a.slots === AQ.FREE && a.fish.length === 0, 'аквариум пустой, три места');
    ok(AQ.income() === 0 && !AQ.canCollect(), 'пустой аквариум ничего не приносит');
    ok(!AQ.addFish('crucian'), 'непойманную рыбу посадить нельзя');
    ['crucian', 'perch', 'bream', 'carp'].forEach(id => { FB.S.album[id] = { n: 1, best: 500 }; });
    ok(AQ.addFish('crucian') && AQ.addFish('perch') && AQ.addFish('bream'), 'пойманных — можно');
    ok(!AQ.addFish('crucian'), 'одну и ту же дважды — нельзя');
    ok(!AQ.addFish('carp'), 'больше мест нет');
    FB.S.coins = 100;
    ok(!AQ.buySlot(), 'без денег место не купить');
    FB.S.coins = 10000;
    ok(AQ.buySlot() && AQ.addFish('carp'), 'купил место — посадил');
    const inc = AQ.income();
    ok(inc > 0 && AQ.canCollect(), 'аквариум приносит монеты');
    const c0 = FB.S.coins;
    ok(AQ.collect() === inc && FB.S.coins === c0 + inc && !AQ.canCollect(), 'монеты — раз в день');
    ok(AQ.buyDecor('castle') && a.on.includes('castle'), 'купил украшение — оно стоит');
    ok(AQ.income() > inc, 'украшения прибавляют монет');
    AQ.toggleDecor('castle');
    ok(!a.on.includes('castle'), 'украшение можно убрать');
    FB.S.pearls = 0;
    ok(!AQ.buyTheme('night'), 'без жемчуга ночной фон не купить');
    ok(AQ.DECOR.every(d => d.id === 'plants' || d.cost), 'у всех украшений есть цена');
    ok(AQ.collections().length === FB.PONDS.length, 'коллекции по всем местам');
}

// ---------- Способы ловли ----------
function modeChecks() {
    section('Поплавок, спиннинг, донка');
    const F = FB.fishing;
    ok(FB.BAITS.every(b => ['float', 'spin', 'bottom'].includes(b.mode)), 'у каждой наживки есть способ ловли');
    FB.tutor = { inLesson: () => false };
    // Заброс в точку на середине воды, куда бамбуковая достаёт
    const keepUn = FB.scene.unproject;
    FB.scene.unproject = (x, y) => (x === 100 && y === 100 ? { tx: -0.2, dist: 0.3 } : keepUn(x, y));
    const setup = (bait) => {
        FB.S = FB.state.fresh(); FB.S.tut = 99; FB.S.stats.catches = 5; FB.S.bait = bait; FB.S.baits.push(bait);
        F.reset();
        F.press(100, 100); F.release();
        for (let t = 0; t < 1; t += 1 / 60) F.update(1 / 60);
    };
    // Спиннинг: стоять без дела — не клюёт; рывки — клюёт
    setup('spinner');
    ok(F.mode === 'spin' && F.phase === 'wait', 'с блесной — спиннинг');
    for (let t = 0; t < 8; t += 1 / 60) F.update(1 / 60);
    ok(F.phase === 'wait', 'блесна без проводки — поклёвки нет');
    let bit = false;
    for (let i = 0; i < 60 && !bit; i++) {
        F.press(100, 100);
        for (let t = 0; t < 0.25; t += 1 / 60) F.update(1 / 60);
        F.release();
        for (let t = 0; t < 0.15; t += 1 / 60) F.update(1 / 60);
        if (F.phase === 'bite') bit = true;
        if (F.phase === 'idle') break;
    }
    ok(bit, 'рывками блесной — хищник хватает');
    // Довести до берега без рывков — пусто, но без срыва
    setup('spinner');
    const lost0 = FB.S.stats.lost;
    F.press(100, 100);
    for (let t = 0; t < 30 && F.phase === 'wait'; t += 1 / 60) { F.spin.attract = 0; F.update(1 / 60); }
    F.release();
    ok(F.phase === 'idle' && FB.S.stats.lost === lost0, 'довёл до берега — пусто, но не срыв');
    // Донка: дольше ждать, рыба тяжелее
    setup('shrimp');
    ok(F.mode === 'bottom' && F.ctx.heavy, 'с креветкой — донка');
    ok(F.biteAt > 1.5, 'на донке ждать дольше');
    const avg = (heavy) => { let s = 0; const f = FB.fishById.mullet; for (let i = 0; i < 3000; i++) s += FB.catcher.rollWeight(f, { rod: FB.rodById.bamboo, heavy }); return s / 3000; };
    ok(avg(true) > avg(false) * 1.1, 'на донке рыба крупнее');
    FB.scene.unproject = keepUn;
}

// ---------- Особенности мест ----------
function placeChecks() {
    section('Особенности мест');
    const PL = FB.places;
    FB.PONDS.forEach(p => ok(PL.FEATURES[p.id], 'у места нет особенности: ' + p.id));
    ok(new Set(Object.values(PL.FEATURES)).size === FB.PONDS.length, 'особенности у мест разные');
    const base = Date.UTC(2026, 9, 18, 0, 0, 0) - (Date.UTC(2026, 9, 18) % PL.TIDE_PERIOD);
    ok(PL.tideAt(base + 60000).high && !PL.tideAt(base + PL.TIDE_HIGH + 60000).high, 'прилив и отлив по расписанию');
    ok(PL.tideAt(base + 1000).left > 0 && PL.tideAt(base + PL.TIDE_HIGH + 1000).left > 0, 'видно, сколько ждать');
    // Прилив: близкий заброс в лагуне чаще приносит глубинную рыбу
    const rod = FB.rodById.bamboo;
    const deep = (tide) => FB.catcher.chances({ pond: 'lagoon', dist: 0.15, bait: 'worm', rod, weather: 'sun', bubble: false, tide })
        .filter(c => c.fish.d[0] >= 0.4).reduce((a, c) => a + c.p, 0);
    ok(deep(PL.TIDE_SHIFT) > deep(0) * 1.5, 'в прилив глубинная рыба ближе к берегу');
    // Огонёк: редкая рыба чаще
    const rare = (luckMul) => FB.catcher.chances({ pond: 'swamp', dist: 0.5, bait: 'worm', rod, weather: 'night', bubble: false, luckMul })
        .filter(c => FB.RARITY[c.fish.r].order >= 2).reduce((a, c) => a + c.p, 0);
    ok(rare(3) > rare(1) * 1.8, 'под огоньком редкая рыба клюёт чаще');
    // Горное озеро: заброс к тени — клюёт именно она
    FB.S = FB.state.fresh(); FB.S.pond = 'mountain'; FB.S.stats.catches = 5;
    PL.reset();
    const shadowRes = { kind: 'fish', fish: FB.fishById.char, g: 900 };
    PL.state().shadows.push({ tx: 0.2, dist: 0.4, v: 0, lo: 0, hi: 1, t: 3, life: 20, ph: 0, res: shadowRes });
    const ctx = { pond: 'mountain', dist: 0.4, bait: 'worm', rod, weather: 'sun', bubble: false };
    ok(PL.beforeRoll(ctx, 0.21, 0.41) === shadowRes && ctx.waitMul < 1, 'заброс к тени — клюёт эта рыба');
    ok(PL.state().shadows.length === 0, 'тень уплывает после заброса');
    ok(PL.beforeRoll({ pond: 'mountain', tut: true }, 0.2, 0.4) === null, 'на уроке особенности не работают');
    // Турнирная бухта — отдельное место
    const wcfg = FB.state.weekCfg();
    ok(FB.pondById.arena && !FB.PONDS.includes(FB.pondById.arena), 'турнирная бухта — отдельно от обычных мест');
    FB.S = FB.state.fresh();
    ok(FB.state.pondOpen('arena'), 'турнирная бухта открыта с первого уровня');
    ok(FB.FISH.every(fi => FB.pondById[fi.pond] && fi.pond !== 'arena'), 'у рыб дом — обычные места');
    ok(FB.week.weatherAt('arena', FB.sdk.now()) === wcfg.weather, 'погода в бухте — погода недели');
    const ach = FB.catcher.chances({ pond: 'arena', fishPond: FB.state.fishPondOf('arena'), dist: 0.5, bait: 'worm', rod: FB.rodById.bamboo, weather: 'sun', bubble: false });
    ok(ach.length && ach.every(c => c.fish.pond === wcfg.pond), 'в бухте ловится рыба места недели');
    const locked = FB.PONDS.find(pp => pp.unlock > 1);
    ok(!FB.state.pondOpen(locked.id), 'обычные места открываются только по уровню');
}

// ---------- Находки на воде ----------
function driftChecks() {
    section('Находки на воде');
    const D = FB.drift;
    ok(!D.BOATS.pier, 'с мостков находок нет');
    ok(D.BOATS.yacht.every[1] < D.BOATS.raft.every[0] + 1, 'с яхты находки чаще, чем с плота');
    for (let i = 0; i < 200; i++) {
        const k = FB.U.pick(Object.keys(D.FINDS));
        const r = D.reward(k);
        const f = D.FINDS[k];
        if (!(r.coins >= f.coins[0] && r.coins <= f.coins[1])) { ok(false, 'монеты за находку вне диапазона: ' + k); break; }
        if (r.pearls && !f.pearls) { ok(false, 'жемчуг там, где не положено: ' + k); break; }
    }
    ok(true, 'награды за находки в своих пределах');
}

// ---------- Наборы и рамки ----------
function packChecks() {
    section('Наборы и рамки');
    FB.S = FB.state.fresh();
    ok(FB.shop.grant('captain') && FB.S.buy.captain && FB.S.owned.includes('fr_royal') && FB.S.pearls === FB.productById.captain.pearls, 'набор капитана выдаётся');
    ok(!FB.shop.grant('captain'), 'набор не выдаётся дважды');
    ok(FB.S.buy.supporter && FB.S.owned.includes('fr_heart'), 'любая покупка — бонусы поддержки');
    FB.COSMETICS.filter(c => c.cat === 'frame').forEach(c => ok(c.cost || c.src !== 'shop', 'у рамки нет цены: ' + c.id));
    ok(FB.COSMETICS.filter(c => c.cat === 'frame' && c.cost && c.cost.coins).length >= 4, 'есть рамки за монеты');
    ok(FB.COSMETICS.filter(c => c.cat === 'frame' && c.cost && c.cost.pearls).length >= 4, 'есть рамки за жемчуг');
    // Рамки за достижения
    FB.S = FB.state.fresh();
    FB.state.applyCatch({ kind: 'fish', fish: FB.fishById.goldcarp, g: 5000 }, { pond: 'village' }, true);
    ok(FB.S.owned.includes('fr_legend'), 'легендарная рыба — рамка «Легенда»');
    FB.FISH.slice(0, 19).forEach(f => { FB.S.album[f.id] = { n: 1, best: 1 }; });
    const fresh = FB.FISH.find(f => !FB.S.album[f.id]);
    FB.state.applyCatch({ kind: 'fish', fish: fresh, g: fresh.w[0] }, { pond: fresh.pond }, true);
    ok(Object.keys(FB.S.album).length >= 20 && FB.S.owned.includes('fr_fisher'), '20 видов — рамка «Рыбья карусель»');
}

// ---------- Музыка и громкость ----------
function musicChecks() {
    section('Музыка');
    const MU = FB.music;
    ok(MU && MU.compose && MU.styleFor, 'музыка подключена');
    ['day', 'evening', 'night', 'rain', 'fog', 'arena'].forEach(k => ok(MU.STYLES[k], 'есть стиль ' + k));
    ok(MU.styleFor('village', 'sun') === 'day' && MU.styleFor('river', 'evening') === 'evening' && MU.styleFor('sea', 'night') === 'night', 'стиль по погоде');
    ok(MU.styleFor('swamp', 'rain') === 'rain' && MU.styleFor('mountain', 'fog') === 'fog' && MU.styleFor('arena', 'night') === 'arena', 'дождь, туман, турнир');
    const INST = Object.keys(MU._instruments).concat(['pad']);
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const SC = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10] };
    Object.keys(MU.STYLES).forEach(k => {
        ['village', 'sea', 'mountain'].forEach(theme => {
            for (let n = 0; n < 4; n++) {
                const song = MU.compose(k, theme, rnd);
                const sec = song.steps * 60 / song.bpm / 2;
                const tag = k + '/' + theme + '#' + n;
                if (!(sec > 60 && sec < 170)) { ok(false, tag + ': длина песни ' + Math.round(sec) + ' с'); return; }
                const bad = song.ev.find(e => !(e[0] >= 0 && e[0] < song.steps) || !INST.includes(e[1]) || !(e[3] > 0 && e[3] <= 0.3) || !(e[4] > 0) ||
                    (Array.isArray(e[2]) ? e[2].some(m => !(m >= 28 && m <= 100)) : (e[1] !== 'kick' && e[1] !== 'rim' && e[1] !== 'shaker' && !(e[2] >= 28 && e[2] <= 100))));
                if (bad) { ok(false, tag + ': кривая нота ' + JSON.stringify(bad)); return; }
                const lead = song.ev.filter(e => e[6] === 'lead');
                const introEnd = song.form[0][1] * 8;
                if (lead.length < 20 || lead.some(e => e[0] < introEnd)) { ok(false, tag + ': мелодия ' + lead.length + ' нот или звучит во вступлении'); return; }
                // Сильные доли мелодии — ноты аккорда; все ноты — из лада
                const off = lead.filter(e => e[0] % 4 === 0).filter(e => {
                    const pcs = song.bars[Math.floor(e[0] / 8)];
                    return !pcs.some(p => (p % 12) === (((e[2] - song.key) % 12) + 12) % 12);
                });
                const outScale = lead.filter(e => !SC[song.mode].includes((((e[2] - song.key) % 12) + 12) % 12));
                if (off.length || outScale.length) { ok(false, tag + ': мелодия мимо аккордов (' + off.length + ') или лада (' + outScale.length + ')'); return; }
                // Плотность: в такте не больше ~12 событий на голос (не «каша»)
                const perBar = {};
                song.ev.forEach(e => { const b = Math.floor(e[0] / 8); perBar[b] = (perBar[b] || 0) + 1; });
                const maxBar = Math.max.apply(null, Object.values(perBar));
                if (maxBar > 60) { ok(false, tag + ': слишком густо — ' + maxBar + ' нот в такте'); return; }
                ok(true);
            }
        });
    });
    const a = MU.compose('day', 'village', rnd), b = MU.compose('day', 'village', rnd);
    ok(a.key !== b.key || JSON.stringify(a.ev.slice(40, 80)) !== JSON.stringify(b.ev.slice(40, 80)), 'песни не повторяются');
    ok(MU.compose('day', 'sea', rnd).ev.some(e => e[1] === 'uke') && !MU.compose('day', 'village', rnd).ev.some(e => e[1] === 'uke'), 'у моря — укулеле');
    ok(MU.compose('arena', 'arena', rnd).ev.some(e => e[1] === 'kick') && MU.compose('rain', 'river', rnd).ev.some(e => e[1] === 'kick'), 'на турнире и в дождь есть ритм');
    ok(!MU.compose('night', 'village', rnd).ev.some(e => e[1] === 'kick'), 'ночью без барабанов');

    section('Громкость');
    const old = FB.state.merge(FB.state.fresh(), FB.state.migrate({ settings: { sound: true, music: false, lang: 'ru' } }));
    FB.S = old; FB.state.fix();
    ok(FB.S.settings.musicVol === 0 && FB.S.settings.soundVol === 80 && !FB.S.settings.music && FB.S.settings.sound, 'выключенная музыка из старого сохранения — громкость 0');
    const old2 = FB.state.merge(FB.state.fresh(), FB.state.migrate({ settings: { sound: false, music: true } }));
    FB.S = old2; FB.state.fix();
    ok(FB.S.settings.soundVol === 0 && FB.S.settings.musicVol === 60 && !FB.S.settings.sound, 'выключенные звуки — громкость 0');
    const kept = FB.state.merge(FB.state.fresh(), FB.state.migrate({ settings: { sound: true, music: true, musicVol: 35, soundVol: 100 } }));
    FB.S = kept; FB.state.fix();
    ok(FB.S.settings.musicVol === 35 && FB.S.settings.soundVol === 100, 'своя громкость сохраняется');
    FB.S = FB.state.fresh(); FB.S.settings.musicVol = 250; FB.S.settings.soundVol = -5; FB.state.fix();
    ok(FB.S.settings.musicVol === 100 && FB.S.settings.soundVol === 0 && !FB.S.settings.sound, 'громкость в пределах 0–100');
    FB.S = FB.state.fresh(); FB.state.fix();
    ok(FB.S.settings.musicVol === 60 && FB.S.settings.soundVol === 80 && FB.S.settings.music && FB.S.settings.sound, 'новый игрок: музыка 60, звуки 80');
    ok(FB.DICT.ru.vol_off && FB.DICT.en.vol_off, 'текст «выкл»');
}

function finish() {
    console.log('\n' + (failed ? '✗' : '✓') + ' Проверок: ' + passed + ' прошло, ' + failed + ' с ошибкой');
    process.exit(failed ? 1 : 0);
}
