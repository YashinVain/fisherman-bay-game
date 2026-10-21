// state.js — сохранение игрока и всё, что меняет прогресс: монеты, опыт, уровни,
// альбом, рекорды, турнирные очки, сезон.
// Сохранение: localStorage (сразу) + облако Яндекса (FB.sdk.saveCloud, с ограничением частоты).
// Поля сохранения НЕ переименовываем — у игроков уже лежат старые сохранения.

(function (FB) {
    const ST = FB.state = {};
    const U = FB.U;
    FB.VERSION = '0.16.0';

    ST.fresh = () => ({
        v: 1,
        saved: 0,
        coins: 50,
        pearls: 0,
        xp: 0,
        level: 1,
        pond: 'village',
        rod: 'bamboo',
        bait: 'worm',
        rods: ['bamboo'],
        baits: ['worm'],
        owned: Object.values(FB.DEFAULT_LOOK),
        look: Object.assign({}, FB.DEFAULT_LOOK),
        who: 'boy',            // рыбак: boy | girl | grandpa — меняется бесплатно
        album: {},            // id рыбы → { n: сколько поймано, best: лучший вес, г }
        junk: {},             // id мусора → сколько
        stats: { casts: 0, catches: 0, released: 0, lost: 0, playMs: 0, totalG: 0, bestG: 0, bestId: null },
        week: { idx: -1, best: [], catches: 0, big: null },   // big — главный улов недели { f, g, pts }
        lastWeekReward: -1,   // за какую неделю уже выдана награда
        lastResult: null,     // { idx, rank, pts } — показать «ты занял N место»
        trophies: [],         // { idx, rank, kind }
        daily: null,          // см. quests.js
        season: { id: FB.SEASON.id, pts: 0, free: [], gold: [], pass: false },
        buy: { noAds: false, starter: false, supporter: false },
        settings: { sound: true, music: true, lang: null },
        tut: 0,               // шаг обучения (tutor.js): 0 — не начато, 99 — пройдено
        tips: {},             // разовые подсказки, которые уже показаны
        luck: 0,              // серия удачи: уловов подряд без срыва (отличная подсечка — за два)
        aqua: FB.aqua ? FB.aqua.fresh() : null   // домашний аквариум (game/aqua.js)
    });

    // Дополнить загруженное сохранение недостающими полями (после обновлений игры)
    ST.merge = (base, loaded) => {
        if (!loaded || typeof loaded !== 'object') return base;
        const out = base;
        for (const k of Object.keys(loaded)) {
            const b = base[k], l = loaded[k];
            if (b && typeof b === 'object' && !Array.isArray(b) && l && typeof l === 'object' && !Array.isArray(l)) out[k] = ST.merge(b, l);
            else if (l !== undefined && l !== null) out[k] = l;
            else if (l === null && b === null) out[k] = null;
        }
        return out;
    };

    // ---------- Загрузка и запись ----------
    const key = () => 'fishbay_save_' + (FB.sdk.playerId() || 'local');

    ST.loadLocal = () => {
        try {
            const raw = localStorage.getItem(key()) || (FB.sdk.playerId() ? localStorage.getItem('fishbay_save_local') : null);
            return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
    };

    ST.load = async () => {
        const local = ST.loadLocal();
        const cloud = await FB.sdk.loadCloud();
        let pick = local;
        // Берём более свежее; при равенстве — где больше опыта
        if (cloud.ok && cloud.data) {
            const c = cloud.data;
            if (!local || (c.saved || 0) > (local.saved || 0) || ((c.saved || 0) === (local.saved || 0) && (c.xp || 0) > (local.xp || 0))) pick = c;
        }
        FB.S = ST.merge(ST.fresh(), pick);
        ST.fix();
        return FB.S;
    };

    // Защита от «сломанных» значений после обновлений
    ST.fix = () => {
        const S = FB.S;
        if (!FB.pondById[S.pond]) S.pond = 'village';
        if (!FB.rodById[S.rod]) S.rod = 'bamboo';
        if (!FB.baitById[S.bait]) S.bait = 'worm';
        if (!S.rods.includes('bamboo')) S.rods.push('bamboo');
        if (!S.baits.includes('worm')) S.baits.push('worm');
        Object.values(FB.DEFAULT_LOOK).forEach(id => { if (!S.owned.includes(id)) S.owned.push(id); });
        FB.COSMETIC_CATS.forEach(cat => {
            const id = S.look[cat];
            if (!FB.cosById[id] || !S.owned.includes(id)) S.look[cat] = FB.DEFAULT_LOOK[cat];
        });
        if (!['boy', 'girl', 'grandpa'].includes(S.who)) S.who = 'boy';
        S.level = ST.levelFromXp(S.xp);
        if (S.season.id !== FB.SEASON.id) S.season = { id: FB.SEASON.id, pts: 0, free: [], gold: [], pass: false };
    };

    let saveTimer = null;
    ST.save = (urgent) => {
        const S = FB.S;
        if (!S) return;
        S.saved = FB.sdk.now();
        try { localStorage.setItem(key(), JSON.stringify(S)); } catch (e) { /* место кончилось — облако спасёт */ }
        if (urgent) {
            clearTimeout(saveTimer);
            saveTimer = null;
            FB.sdk.saveCloud(S, urgent);
        } else if (!saveTimer) {
            saveTimer = setTimeout(() => { saveTimer = null; FB.sdk.saveCloud(FB.S); }, 1500);
        }
    };

    // ---------- Уровни ----------
    // Опыт до следующего уровня растёт плавно
    ST.need = (level) => Math.round(60 * Math.pow(level, 1.45));
    ST.MAX_LEVEL = 60;
    ST.levelFromXp = (xp) => {
        let lvl = 1, left = xp;
        while (lvl < ST.MAX_LEVEL && left >= ST.need(lvl)) { left -= ST.need(lvl); lvl++; }
        return lvl;
    };
    ST.levelProgress = () => {
        let lvl = 1, left = FB.S.xp;
        while (lvl < ST.MAX_LEVEL && left >= ST.need(lvl)) { left -= ST.need(lvl); lvl++; }
        return lvl >= ST.MAX_LEVEL ? 1 : left / ST.need(lvl);
    };

    ST.addXp = (n) => {
        const S = FB.S;
        const before = S.level;
        S.xp += Math.round(n);
        S.level = ST.levelFromXp(S.xp);
        if (S.level > before) {
            const unlocked = FB.PONDS.filter(p => p.unlock > before && p.unlock <= S.level);
            const reward = { coins: 0, pearls: 0 };
            for (let l = before + 1; l <= S.level; l++) {
                const r = ST.levelReward(l);
                reward.coins += r.coins;
                reward.pearls += r.pearls;
            }
            ST.giveReward(reward);
            FB.emit('levelUp', { level: S.level, ponds: unlocked, reward });
        }
    };
    ST.FISHER_SPECIES = 20;

    // ---------- Серия удачи ----------
    ST.STREAK_MAX = 10;
    ST.streakMul = () => 1 + 0.05 * Math.min(FB.S.luck || 0, ST.STREAK_MAX);
    ST.streakUp = (perfect) => {
        const S = FB.S, before = S.luck || 0;
        S.luck = Math.min(ST.STREAK_MAX, before + (perfect ? 2 : 1));
        S.stats.bestLuck = Math.max(S.stats.bestLuck || 0, S.luck);
        if (S.luck !== before) FB.emit('streak', { n: S.luck, up: true });
    };
    ST.streakBreak = () => {
        const S = FB.S;
        if ((S.luck || 0) >= 2) FB.emit('streak', { n: 0, lost: S.luck });
        S.luck = 0;
    };

    // Подарок за новый уровень: монеты всегда, каждый пятый — ещё и жемчуг
    ST.levelReward = (l) => ({ coins: 20 + l * 10, pearls: l % 5 === 0 ? 10 : 0 });
    // Что откроется дальше (для окна нового уровня, если сейчас ничего не открылось)
    ST.nextUnlock = () => {
        const L = FB.S.level;
        const all = [].concat(
            FB.PONDS.filter(p => p.unlock > L).map(p => ({ lvl: p.unlock, kind: 'pond', item: p })),
            FB.RODS.filter(r => r.level > L).map(r => ({ lvl: r.level, kind: 'rod', item: r })),
            FB.BAITS.filter(b => b.level > L).map(b => ({ lvl: b.level, kind: 'bait', item: b })));
        all.sort((a, b) => a.lvl - b.lvl);
        return all[0] || null;
    };
    ST.addCoins = (n) => { FB.S.coins = Math.max(0, FB.S.coins + Math.round(n)); FB.emit('money'); };
    ST.addPearls = (n) => { FB.S.pearls = Math.max(0, FB.S.pearls + Math.round(n)); FB.emit('money'); };

    ST.pondOpen = (id) => {
        const p = FB.pondById[id];
        if (!p) return false;
        // Турнирная бухта открыта всем — соревноваться может каждый
        if (p.arena) return true;
        return FB.S.level >= p.unlock;
    };
    // Чья рыба водится в месте: в турнирной бухте — рыба «места недели»
    ST.fishPondOf = (id) => id === 'arena' ? ST.weekCfg().pond : id;
    ST.atTourney = () => FB.S.pond === 'arena';
    ST.rodObj = () => FB.rodById[FB.S.rod];

    // ---------- Турнир ----------
    ST.weekIdx = () => FB.week.index(FB.sdk.now());
    ST.weekCfg = () => FB.week.config(ST.weekIdx());
    // Новая неделя: старые очки уходят (награду за неё выдаёт tourney.js раньше этого)
    ST.syncWeek = () => {
        const idx = ST.weekIdx();
        if (FB.S.week.idx !== idx) FB.S.week = { idx, best: [], catches: 0, big: null };
    };
    ST.weekScore = () => FB.week.sum(FB.S.week.best);

    // «Слава рыбака» — для постоянного топа: каждый новый вид даёт очки по редкости,
    // плюс понемногу за каждый улов
    ST.fame = () => {
        let s = 0;
        for (const id in FB.S.album) {
            const f = FB.fishById[id];
            if (f) s += FB.RARITY[f.r].base * 10;
        }
        return s + FB.S.stats.catches * 2;
    };

    // ---------- Улов ----------
    // res — из catcher.roll. keep: true — «Забрать» (монеты), false — «Отпустить» (опыт)
    // Возвращает сводку для карточки улова
    ST.applyCatch = (res, ctx, keep) => {
        const S = FB.S;
        ST.syncWeek();
        ctx.released = !keep;
        const out = { kind: res.kind, coins: 0, xp: 0, pts: 0, newSpecies: false, record: false, weekPts: 0, tourney: false };
        S.stats.catches++;
        if (res.kind === 'junk') {
            const j = res.junk;
            S.junk[j.id] = (S.junk[j.id] || 0) + 1;
            out.coins = j.coins || 2;
            out.xp = 2;
            ST.addCoins(out.coins);
            ST.addXp(out.xp);
            FB.quests && FB.quests.onCatch(res, ctx, out);
            ST.save();
            return out;
        }
        const f = res.fish, g = res.g;
        const cfg = ST.weekCfg();
        const inTourney = ctx.pond === 'arena';
        const isWeekFish = inTourney && f.id === cfg.fish;
        out.pts = FB.catcher.points(f, g, isWeekFish);
        out.isWeekFish = isWeekFish;
        const basePts = FB.catcher.points(f, g, false);

        // Альбом и рекорды
        const a = S.album[f.id] || (S.album[f.id] = { n: 0, best: 0 });
        out.newSpecies = a.n === 0;
        out.record = !out.newSpecies && g > a.best;
        a.n++;
        if (g > a.best) a.best = g;
        // Рамки за достижения
        const award = (id) => { if (!S.owned.includes(id)) { S.owned.push(id); out.newFrame = id; FB.emit('award', id); } };
        if (Object.keys(S.album).length >= ST.FISHER_SPECIES) award('fr_fisher');
        if (f.r === 'legendary') award('fr_legend');
        S.stats.totalG += g;
        if (g > S.stats.bestG) { S.stats.bestG = g; S.stats.bestId = f.id; out.bigRecord = true; }

        // Монеты и опыт
        const coins = basePts * 0.8 + 2;
        const xp = basePts * 0.6 + 4;
        if (keep) { out.coins = Math.round(coins); out.xp = Math.round(xp); }
        else { out.coins = Math.round(coins * 0.5); out.xp = Math.round(xp * 1.6); S.stats.released++; }
        if (out.newSpecies) out.xp += 20;
        ST.addCoins(out.coins);
        ST.addXp(out.xp);

        // Турнир: только в пруду недели
        if (inTourney) {
            const before = ST.weekScore();
            S.week.best = FB.week.addCatch(S.week.best, out.pts);
            S.week.catches++;
            if (!S.week.big || out.pts > S.week.big.pts) S.week.big = { f: f.id, g, pts: out.pts };
            out.tourney = true;
            out.weekPts = ST.weekScore() - before;   // насколько вырос турнирный счёт
        }

        // Сезон
        S.season.pts += out.pts;

        FB.quests && FB.quests.onCatch(res, ctx, out);
        FB.tourney && FB.tourney.submit();
        ST.save();
        return out;
    };

    // ---------- Покупки за монеты/жемчуг ----------
    ST.canAfford = (cost) => !cost || (cost.coins ? FB.S.coins >= cost.coins : FB.S.pearls >= cost.pearls);
    ST.pay = (cost) => {
        if (!ST.canAfford(cost)) return false;
        if (cost.coins) ST.addCoins(-cost.coins);
        if (cost.pearls) ST.addPearls(-cost.pearls);
        return true;
    };
    // Выдать предмет косметики; если уже есть — компенсировать монетами
    ST.giveItem = (id) => {
        if (!FB.cosById[id]) return false;
        if (FB.S.owned.includes(id)) { ST.addCoins(300); return false; }
        FB.S.owned.push(id);
        return true;
    };
    // Награда вида { coins } | { pearls } | { item }
    ST.giveReward = (r) => {
        if (!r) return;
        if (r.coins) ST.addCoins(r.coins);
        if (r.pearls) ST.addPearls(r.pearls);
        if (r.item) ST.giveItem(r.item);
    };

    // ---------- Сезон ----------
    ST.seasonTier = () => Math.min(FB.SEASON.tiers.length, Math.floor(FB.S.season.pts / FB.SEASON.perTier));
    ST.claimSeason = (i, track) => {
        const s = FB.S.season;
        if (i >= ST.seasonTier()) return false;
        if (track === 'gold' && !s.pass) return false;
        const list = s[track];
        if (list.includes(i)) return false;
        list.push(i);
        ST.giveReward(FB.SEASON.tiers[i][track]);
        ST.save();
        return true;
    };
    ST.seasonUnclaimed = () => {
        const s = FB.S.season, n = ST.seasonTier();
        let c = 0;
        for (let i = 0; i < n; i++) {
            if (!s.free.includes(i)) c++;
            if (s.pass && !s.gold.includes(i)) c++;
        }
        return c;
    };
})(window.FB);
