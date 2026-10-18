// catch.js — кто клюнет и сколько он весит. Чистые функции без картинок и DOM,
// поэтому их проверяют тесты (tools/test.js) и симуляция баланса.
//
// ctx = { pond, dist (0..1), bait, rod (объект удочки), weather, bubble (bool),
//         weekFish (id рыбы недели или null),
//         luckMul (огонёк на болоте), tide (прилив: ближний заброс — как дальний) }

(function (FB) {
    const C = FB.catcher = {};
    const U = FB.U;

    // Насколько рыба «на месте»: внутри своей полосы глубины — 1, за её краем быстро падает
    C.depthFactor = (f, dist) => {
        const gap = dist < f.d[0] ? f.d[0] - dist : dist > f.d[1] ? dist - f.d[1] : 0;
        return Math.max(0.03, Math.exp(-Math.pow(gap / 0.12, 2)));
    };

    C.weightOf = (f, ctx, counts) => {
        const R = FB.RARITY[f.r];
        let w = R.weight / counts[f.r];
        const order = R.order;
        if (order >= 2) w *= ctx.rod.luck * (ctx.bubble ? 2.6 : 1) * (ctx.luckMul || 1);
        else if (order === 1 && ctx.bubble) w *= 1.5;
        w *= C.depthFactor(f, Math.min(1, ctx.dist + (ctx.tide || 0)));
        if (f.bait === ctx.bait) w *= 3;
        w *= f.wx[ctx.weather] || 1;
        if (ctx.weekFish === f.id) w *= 1.5;
        return w;
    };

    // Шансы всех рыб места (для подсказок и тестов): [{fish, p}]
    C.chances = (ctx) => {
        const list = FB.fishOfPond(ctx.pond);
        const counts = {};
        list.forEach(f => { counts[f.r] = (counts[f.r] || 0) + 1; });
        const ws = list.map(f => C.weightOf(f, ctx, counts));
        const total = ws.reduce((a, b) => a + b, 0);
        return list.map((f, i) => ({ fish: f, p: ws[i] / total }));
    };

    // Бросок: { kind: 'fish', fish, g } или { kind: 'junk', junk }
    C.roll = (ctx, rnd) => {
        rnd = rnd || Math.random;
        const junkChance = FB.JUNK_CHANCE * (ctx.bubble ? 0.3 : 1);
        if (rnd() < junkChance) {
            const junk = U.weighted(FB.JUNK, j => j.rare ? 0.25 : 1, rnd);
            return { kind: 'junk', junk };
        }
        const ch = C.chances(ctx);
        const pick = U.weighted(ch, c => c.p, rnd).fish;
        return { kind: 'fish', fish: pick, g: C.rollWeight(pick, ctx, rnd) };
    };

    // Вес: чаще мелкие, иногда крупные. Удочка получше и «пузыри» чуть сдвигают к крупным
    C.rollWeight = (f, ctx, rnd) => {
        rnd = rnd || Math.random;
        let k = 1.7 / Math.sqrt(ctx.rod.luck);
        if (ctx.bubble) k *= 0.8;
        if (ctx.heavy) k *= 0.75;      // донка: крупная рыба чаще
        const t = Math.pow(rnd(), k);
        const g = Math.exp(U.lerp(Math.log(f.w[0]), Math.log(f.w[1]), t));
        return Math.max(f.w[0], Math.min(f.w[1], Math.round(g)));
    };

    // Очки за рыбу: база редкости × (вес / средний вес), ×2 за рыбу недели в пруду недели
    C.points = (f, g, isWeekFish) => {
        const ratio = U.clamp(g / f.avg, 0.3, 4);
        return Math.max(1, Math.round(FB.RARITY[f.r].base * ratio * (isWeekFish ? 2 : 1)));
    };

    // Сила рыбы в вываживании 0..1: редкость + насколько она крупная для своего вида
    C.strength = (f, g) => {
        const order = FB.RARITY[f.r].order;
        const big = U.clamp(Math.log(g / f.w[0]) / Math.log(f.w[1] / f.w[0]), 0, 1);
        return U.clamp(0.14 + order * 0.12 + big * 0.18, 0.1, 0.95);
    };

    C.junkStrength = (j) => j.id === 'tire' || j.id === 'chest' ? 0.3 : 0.12;
})(window.FB);
