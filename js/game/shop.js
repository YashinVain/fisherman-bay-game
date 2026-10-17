// shop.js — покупки: снасти за монеты, косметика за монеты/жемчуг,
// товары за реальные деньги через Яндекс.

(function (FB) {
    const SH = FB.shop = {};
    const ST = () => FB.state;

    SH.buyRod = (id) => {
        const r = FB.rodById[id], S = FB.S;
        if (!r || S.rods.includes(id) || S.level < r.level || !ST().pay({ coins: r.price })) return false;
        S.rods.push(id);
        S.rod = id;
        ST().save();
        return true;
    };
    SH.buyBait = (id) => {
        const b = FB.baitById[id], S = FB.S;
        if (!b || S.baits.includes(id) || S.level < b.level || !ST().pay({ coins: b.price })) return false;
        S.baits.push(id);
        S.bait = id;
        ST().save();
        return true;
    };
    SH.buyCos = (id) => {
        const c = FB.cosById[id], S = FB.S;
        if (!c || !c.cost || S.owned.includes(id) || !ST().pay(c.cost)) return false;
        S.owned.push(id);
        S.look[c.cat] = id;
        ST().save();
        FB.tourney.submit();
        return true;
    };
    SH.equip = (id) => {
        const c = FB.cosById[id], S = FB.S;
        if (!c || !S.owned.includes(id)) return false;
        S.look[c.cat] = id;
        ST().save();
        if (c.cat === 'frame') FB.tourney.submit();
        return true;
    };

    // ---------- Реальные деньги ----------
    // Выдать товар. Повторный вызов для постоянных товаров ничего не удваивает
    SH.grant = (id) => {
        const p = FB.productById[id], S = FB.S;
        if (!p) return false;
        if (id === 'no_ads') S.buy.noAds = true;
        else if (id === 'starter') {
            if (S.buy.starter) return false;
            S.buy.starter = true;
            ST().addPearls(p.pearls);
            p.items.forEach(it => ST().giveItem(it));
        } else if (id === 'season_pass') S.season.pass = true;
        else if (p.pearls) ST().addPearls(p.pearls);
        // Любая покупка — значок «Поддержал игру» и рамка-сердце
        if (!S.buy.supporter) {
            S.buy.supporter = true;
            ST().giveItem('fr_heart');
        }
        ST().save(true);
        FB.tourney.submit();
        FB.emit('money');
        return true;
    };

    SH.buyProduct = async (id) => {
        const p = FB.productById[id];
        if (!p) return false;
        const r = await FB.sdk.purchase(id);
        if (!r.ok) return false;
        SH.grant(id);
        if (p.kind === 'consumable') await FB.sdk.consume(r.token);
        return true;
    };

    // При запуске: вернуть постоянные покупки и выдать то, что не успели выдать
    SH.restore = async () => {
        const list = await FB.sdk.getPurchases();
        for (const it of list) {
            const p = FB.productById[it.id];
            if (!p) continue;
            if (p.kind === 'permanent') {
                if (it.id === 'no_ads') FB.S.buy.noAds = true;
                if (it.id === 'starter' && !FB.S.buy.starter) SH.grant('starter');
                FB.S.buy.supporter = true;
                if (!FB.S.owned.includes('fr_heart')) FB.S.owned.push('fr_heart');
            } else {
                SH.grant(it.id);
                await FB.sdk.consume(it.token);
            }
        }
        if (list.length) ST().save(true);
    };
})(window.FB);
