// quests.js — ежедневный подарок за вход и три задания в день.
// День считается по Москве и по времени сервера Яндекса.

(function (FB) {
    const Q = FB.quests = {};
    const U = FB.U;

    Q.dayKey = (t) => {
        const d = new Date(t + 3 * 3600000);
        return d.getUTCFullYear() + '-' + (d.getUTCMonth() + 1) + '-' + d.getUTCDate();
    };
    Q.dayNum = (t) => Math.floor((t + 3 * 3600000) / 86400000);

    // Подарки за дни подряд (7-й — жемчуг), потом круг заново
    Q.GIFTS = [{ coins: 60 }, { coins: 90 }, { coins: 130 }, { coins: 170 }, { coins: 220 }, { coins: 280 }, { pearls: 10 }];

    // Типы заданий. make(level, rnd) → { type, n, arg, rw }
    const TYPES = {
        catch: (lvl, rnd) => ({ n: 5 + Math.floor(rnd() * 6) }),
        species: (lvl, rnd) => {
            const open = FB.PONDS.filter(p => p.unlock <= lvl).map(p => p.id);
            const pool = FB.FISH.filter(f => open.includes(f.pond) && (f.r === 'common' || f.r === 'uncommon'));
            const f = U.pick(pool, rnd);
            return { n: f.r === 'common' ? 3 : 2, arg: f.id };
        },
        heavy: (lvl, rnd) => ({ n: 1, arg: [500, 1000, 2000, 3000, 5000][Math.min(4, Math.floor(lvl / 4))] }),
        rare: () => ({ n: 1 }),
        release: (lvl, rnd) => ({ n: 2 + Math.floor(rnd() * 2) }),
        tourney: (lvl, rnd) => ({ n: 3 + Math.floor(rnd() * 3) }),
        points: (lvl, rnd) => ({ n: Math.round((150 + lvl * 25 + rnd() * 100) / 10) * 10 })
    };
    Q.TYPES = Object.keys(TYPES);

    const reward = (type, lvl) => {
        const coins = Math.round((80 + lvl * 12) / 10) * 10;
        if (type === 'rare') return { coins, pearls: 3 };
        return { coins };
    };

    Q.make = (lvl, rnd, exclude) => {
        const types = Q.TYPES.filter(t => !exclude.includes(t));
        const type = U.pick(types, rnd);
        const q = Object.assign({ type, p: 0, done: false, got: false }, TYPES[type](lvl, rnd));
        q.rw = reward(type, lvl);
        return q;
    };

    // Новый день: подарок становится доступен, задания обновляются
    Q.sync = () => {
        const S = FB.S, now = FB.sdk.now();
        const today = Q.dayNum(now);
        const d = S.daily;
        if (d && d.day === today) return false;
        const rnd = U.seeded(today * 31 + S.level);
        const quests = [];
        for (let i = 0; i < 3; i++) quests.push(Q.make(S.level, rnd, quests.map(q => q.type)));
        // Серия продолжается, только если вчера подарок был забран
        const gotYesterday = d && d.day === today - 1 && d.gift;
        S.daily = { day: today, streak: gotYesterday ? d.streak : 0, gift: false, quests, swapped: false };
        FB.state.save();
        return true;
    };

    Q.giftReady = () => FB.S.daily && !FB.S.daily.gift;
    Q.giftToday = () => Q.GIFTS[FB.S.daily.streak % 7];
    Q.claimGift = (double) => {
        const d = FB.S.daily;
        if (!d || d.gift) return null;
        const r = Q.giftToday();
        const got = double ? { coins: (r.coins || 0) * 2, pearls: (r.pearls || 0) * 2 } : r;
        FB.state.giveReward(got);
        d.gift = true;
        d.streak++;
        FB.state.save();
        return got;
    };

    // Прогресс заданий после улова
    Q.onCatch = (res, ctx, out) => {
        const d = FB.S.daily;
        if (!d) return;
        const fish = res.kind === 'fish' ? res.fish : null;
        d.quests.forEach(q => {
            if (q.done) return;
            switch (q.type) {
                case 'catch': if (fish) q.p++; break;
                case 'species': if (fish && fish.id === q.arg) q.p++; break;
                case 'heavy': if (fish && res.g >= q.arg) q.p++; break;
                case 'rare': if (fish && FB.RARITY[fish.r].order >= 2) q.p++; break;
                case 'release': if (fish && ctx.released) q.p++; break;
                case 'tourney': if (fish && out.tourney) q.p++; break;
                case 'points': if (fish) q.p += out.pts; break;
            }
            if (q.p >= q.n) { q.p = q.n; q.done = true; FB.emit('questDone', q); }
        });
    };

    Q.claim = (i) => {
        const q = FB.S.daily && FB.S.daily.quests[i];
        if (!q || !q.done || q.got) return false;
        q.got = true;
        FB.state.giveReward(q.rw);
        FB.state.addXp(30);
        FB.state.save();
        return true;
    };

    // Заменить задание (за просмотр рекламы, раз в день)
    Q.swap = (i) => {
        const d = FB.S.daily;
        if (!d || d.swapped) return false;
        const rnd = Math.random;
        d.quests[i] = Q.make(FB.S.level, rnd, d.quests.map(q => q.type));
        d.swapped = true;
        FB.state.save();
        return true;
    };

    Q.badge = () => {
        const d = FB.S.daily;
        if (!d) return 0;
        return (d.gift ? 0 : 1) + d.quests.filter(q => q.done && !q.got).length + FB.state.seasonUnclaimed();
    };
})(window.FB);
