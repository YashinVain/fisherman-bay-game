// week.js — недельный турнир, который идёт сам, без сервера и без нашего участия.
//
// Номер недели считается из времени сервера Яндекса (FB.sdk.now()). Неделя
// начинается в понедельник 00:00 по Москве. Из номера недели по формуле
// получаются пруд, рыба и погода недели — у всех игроков одинаковые.
//
// Лидерборды Яндекса сами не обнуляются, поэтому:
//   • их два — weekA (чётные недели) и weekB (нечётные): пока идёт новый турнир,
//     результаты прошлого ещё видны;
//   • в очки «вшит» номер недели: счёт = неделя × 1 000 000 + очки. Старые записи
//     всегда ниже новых, и в топе текущей недели сверху только её игроки.
//
// Новое место в обновлении: дать ему в fish.js поле tourneyFrom = номер будущей
// недели (FB.week.index(дата понедельника)). До этой недели оно в турнир не попадёт,
// так что у игроков со старой и новой версией турнир всегда одинаковый.

(function (FB) {
    const W = FB.week = {};
    const DAY = 86400000;
    W.WEEK_MS = 7 * DAY;
    // Понедельник 1 января 2024, 00:00 по Москве (UTC+3)
    W.EPOCH = Date.UTC(2024, 0, 1, 0, 0, 0) - 3 * 3600000;
    W.SCORE_MUL = 1000000;
    W.TOP_N = 10;                         // в зачёт идут 10 лучших уловов
    W.WEATHERS = ['sun', 'rain', 'fog', 'night'];

    W.index = (t) => Math.floor((t - W.EPOCH) / W.WEEK_MS);
    W.start = (idx) => W.EPOCH + idx * W.WEEK_MS;
    W.end = (idx) => W.start(idx + 1);

    // Места, которые могут быть турнирными на неделе idx
    W.ponds = (idx) => FB.PONDS.filter(p => (p.tourneyFrom || 0) <= idx);

    // «Кандидат» — случайный (по зерну недели) пруд. Если он совпал с прошлой
    // неделей, берём следующий по списку: два раза подряд одно место не выпадает.
    const candidate = (idx) => {
        const list = W.ponds(idx);
        const rnd = FB.U.seeded(idx * 7919 + 101);
        return list[Math.floor(rnd() * list.length)];
    };

    const cache = {};
    W.config = (idx) => {
        if (cache[idx]) return cache[idx];
        const list = W.ponds(idx);
        let pond = candidate(idx);
        const prev = candidate(idx - 1);
        if (pond.id === prev.id && list.length > 1) pond = list[(list.indexOf(pond) + 1) % list.length];

        const rnd = FB.U.seeded(idx * 104729 + 7);
        // Рыба недели: необычная или редкая — чтобы её реально ловили, но не каждый раз
        const pool = FB.fishOfPond(pond.id).filter(f => f.r === 'uncommon' || f.r === 'rare');
        const fish = FB.U.weighted(pool, f => f.r === 'uncommon' ? 2 : 1, rnd);
        // Погода: солнце чаще остальных
        const weather = FB.U.weighted(W.WEATHERS, w => w === 'sun' ? 3 : w === 'night' ? 1.2 : 1.5, rnd);
        return (cache[idx] = { idx, pond: pond.id, fish: fish.id, weather });
    };

    W.board = (idx) => (idx % 2 === 0 ? 'weekA' : 'weekB');
    W.encode = (idx, pts) => idx * W.SCORE_MUL + Math.max(0, Math.min(W.SCORE_MUL - 1, Math.floor(pts)));
    W.decode = (score) => ({ idx: Math.floor(score / W.SCORE_MUL), pts: score % W.SCORE_MUL });

    // Очки турнира = сумма 10 лучших уловов. best — массив очков (по убыванию)
    W.addCatch = (best, pts) => {
        const out = best.concat([pts]).sort((a, b) => b - a).slice(0, W.TOP_N);
        return out;
    };
    W.sum = (best) => best.reduce((s, x) => s + x, 0);

    // Погода в нетурнирных местах меняется каждые 20 минут — тоже по формуле
    W.SLOT_MS = 20 * 60000;
    W.weatherAt = (pondId, t) => {
        const idx = W.index(t);
        const cfg = W.config(idx);
        if (pondId === cfg.pond) return cfg.weather;
        const slot = Math.floor(t / W.SLOT_MS);
        let h = 0;
        for (const ch of pondId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
        const rnd = FB.U.seeded(slot * 2654435761 + h);
        return FB.U.weighted(W.WEATHERS, w => w === 'sun' ? 4 : w === 'night' ? 1 : 1.3, rnd);
    };
})(window.FB);
