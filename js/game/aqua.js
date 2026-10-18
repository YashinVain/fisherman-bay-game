// aqua.js — домашний аквариум: правила и сохранение (картинка — в ui/aquarium.js).
// В аквариум сажаешь рыб, которых уже поймал (по одной каждого вида, рекордного
// размера). Украшаешь его и раз в день забираешь «спасибо» от аквариума — монеты:
// чем больше рыб и украшений, тем больше. Первые три места — бесплатно.

(function (FB) {
    const AQ = FB.aqua = {};

    AQ.FREE = 3;
    // Цена следующего места (по номеру места, с нуля)
    AQ.SLOT_COST = [0, 0, 0, 500, 1500, 4000, 8000, 15000];
    AQ.MAX = AQ.SLOT_COST.length;

    // Украшения. place — где стоит в аквариуме (доля ширины), back — на заднем плане
    AQ.DECOR = [
        { id: 'plants', cost: null, n: { ru: 'Водоросли', en: 'Seaweed' } },
        { id: 'stones', cost: { coins: 200 }, n: { ru: 'Цветные камушки', en: 'Pebbles' } },
        { id: 'chest', cost: { coins: 1500 }, n: { ru: 'Сундук с пузырями', en: 'Bubble chest' } },
        { id: 'castle', cost: { coins: 3000 }, n: { ru: 'Замок', en: 'Castle' } },
        { id: 'diver', cost: { coins: 6000 }, n: { ru: 'Водолаз', en: 'Diver' } },
        { id: 'coral', cost: { pearls: 40 }, n: { ru: 'Кораллы', en: 'Corals' } },
        { id: 'ship', cost: { pearls: 80 }, n: { ru: 'Затонувший кораблик', en: 'Sunken ship' } }
    ];
    AQ.THEMES = [
        { id: 'pond', cost: null, n: { ru: 'Пруд', en: 'Pond' } },
        { id: 'sea', cost: { coins: 2500 }, n: { ru: 'Море', en: 'Sea' } },
        { id: 'night', cost: { pearls: 60 }, n: { ru: 'Ночной', en: 'Night' } }
    ];
    AQ.decorById = {};
    AQ.DECOR.forEach(d => { AQ.decorById[d.id] = d; });
    AQ.themeById = {};
    AQ.THEMES.forEach(d => { AQ.themeById[d.id] = d; });

    AQ.fresh = () => ({ slots: AQ.FREE, fish: [], decor: ['plants'], on: ['plants'], theme: 'pond', themes: ['pond'], day: -1 });
    AQ.st = () => {
        const S = FB.S;
        if (!S.aqua || !Array.isArray(S.aqua.fish)) S.aqua = AQ.fresh();
        const a = S.aqua;
        a.fish = a.fish.filter(id => FB.fishById[id] && S.album[id]);
        a.on = a.on.filter(id => a.decor.includes(id));
        if (!a.themes.includes(a.theme)) a.theme = 'pond';
        return a;
    };

    // ---------- Рыбы ----------
    AQ.canAdd = (id) => { const a = AQ.st(); return !!FB.S.album[id] && !a.fish.includes(id) && a.fish.length < a.slots; };
    AQ.addFish = (id) => {
        if (!AQ.canAdd(id)) return false;
        AQ.st().fish.push(id);
        FB.state.save();
        return true;
    };
    AQ.removeFish = (id) => {
        const a = AQ.st(), i = a.fish.indexOf(id);
        if (i < 0) return false;
        a.fish.splice(i, 1);
        FB.state.save();
        return true;
    };
    AQ.nextSlotCost = () => { const a = AQ.st(); return a.slots < AQ.MAX ? AQ.SLOT_COST[a.slots] : null; };
    AQ.buySlot = () => {
        const cost = AQ.nextSlotCost();
        if (cost === null || !FB.state.pay({ coins: cost })) return false;
        AQ.st().slots++;
        FB.state.save();
        return true;
    };

    // ---------- Украшения и фон ----------
    AQ.buyDecor = (id) => {
        const d = AQ.decorById[id], a = AQ.st();
        if (!d || a.decor.includes(id) || !d.cost || !FB.state.pay(d.cost)) return false;
        a.decor.push(id);
        a.on.push(id);
        FB.state.save();
        return true;
    };
    AQ.toggleDecor = (id) => {
        const a = AQ.st();
        if (!a.decor.includes(id)) return false;
        const i = a.on.indexOf(id);
        if (i >= 0) a.on.splice(i, 1); else a.on.push(id);
        FB.state.save();
        return true;
    };
    AQ.buyTheme = (id) => {
        const t = AQ.themeById[id], a = AQ.st();
        if (!t || a.themes.includes(id) || !t.cost || !FB.state.pay(t.cost)) return false;
        a.themes.push(id);
        a.theme = id;
        FB.state.save();
        return true;
    };
    AQ.setTheme = (id) => {
        const a = AQ.st();
        if (!a.themes.includes(id)) return false;
        a.theme = id;
        FB.state.save();
        return true;
    };

    // ---------- Монеты раз в день ----------
    AQ.income = () => {
        const a = AQ.st();
        if (!a.fish.length) return 0;
        // Рыбы дороже, если они редкие
        const fish = a.fish.reduce((s, id) => s + 12 + FB.RARITY[FB.fishById[id].r].order * 8, 0);
        return fish + a.on.length * 10 + (a.theme !== 'pond' ? 20 : 0);
    };
    AQ.canCollect = () => AQ.income() > 0 && AQ.st().day !== FB.quests.dayNum(FB.sdk.now());
    AQ.collect = () => {
        if (!AQ.canCollect()) return 0;
        const n = AQ.income();
        AQ.st().day = FB.quests.dayNum(FB.sdk.now());
        FB.state.addCoins(n);
        FB.state.save();
        return n;
    };

    // ---------- Трофеи: собранные коллекции мест ----------
    AQ.collections = () => FB.PONDS.map(p => {
        const fish = FB.fishOfPond(p.id);
        const got = fish.filter(f => FB.S.album[f.id]).length;
        return { pond: p, got, total: fish.length, done: got === fish.length };
    });
})(window.FB);
