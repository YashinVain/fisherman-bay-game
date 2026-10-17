// shopui.js — окно магазина: снасти (за монеты), образ рыбака (косметика)
// и жемчуг (за реальные деньги через Яндекс). Никаких всплывающих «купи!» —
// игрок приходит сюда сам.

(function (FB) {
    const SU = FB.shopUI = {};
    const UI = FB.ui, U = FB.U;
    let tab = 'gear', cat = 'who';
    let catalog = null;

    SU.open = (which) => {
        tab = which || tab;
        FB.hud.seenStarter = true;
        FB.hud.update();
        if (!catalog) FB.sdk.getCatalog().then(c => { catalog = c; if (tab === 'pearls') UI.refresh(); });
        const render = () => {
            const box = UI.el('div');
            box.appendChild(UI.tabs([['gear', FB.t('shop_gear')], ['look', FB.t('shop_look')], ['pearls', FB.t('shop_pearls')]], tab, (id) => { tab = id; UI.refresh(); }));
            if (tab === 'gear') box.appendChild(gear());
            else if (tab === 'look') box.appendChild(look());
            else box.appendChild(pearls());
            return box;
        };
        UI.open({ title: FB.t('nav_shop'), body: render(), render });
    };

    const rodSvg = (r) => '<svg viewBox="0 0 70 70" width="70" height="70"><path d="M10 62L60 8" stroke="#2a3550" stroke-width="7" stroke-linecap="round"/><path d="M10 62L60 8" stroke="' + r.color + '" stroke-width="4" stroke-linecap="round"/><path d="M10 62l10-11" stroke="#3a2a22" stroke-width="7" stroke-linecap="round"/><circle cx="22" cy="52" r="7" fill="#5a6470" stroke="#2a3550" stroke-width="2.5"/><circle cx="22" cy="52" r="3" fill="#c8d0d8"/><path d="M60 8v34" stroke="#fff" stroke-width="1.5" stroke-dasharray="3 2"/><circle cx="60" cy="44" r="4" fill="#e8402a" stroke="#2a3550" stroke-width="2"/></svg>';

    function gear() {
        const box = UI.el('div');
        const S = FB.S;
        box.appendChild(UI.el('div.sec-title', { html: FB.ic('rod') + FB.t('rods') }));
        FB.RODS.forEach(r => {
            const owned = S.rods.includes(r.id), on = S.rod === r.id;
            const card = UI.el('div.card.rodcard' + (on ? '.sel' : ''));
            card.appendChild(UI.el('div.prev', { html: rodSvg(r) }));
            const bar = (v) => '<div class="progress"><i style="width:' + Math.round(v * 100) + '%"></i></div>';
            card.appendChild(UI.el('div.body', { html: '<div class="nm">' + U.esc(FB.name(r)) + '</div>' +
                '<div class="bars"><span>' + FB.t('st_reach') + '</span>' + bar(r.reach) +
                '<span>' + FB.t('st_control') + '</span>' + bar(U.clamp((1.08 - r.ctrl) / 0.42, 0.1, 1)) +
                '<span>' + FB.t('st_luck') + '</span>' + bar(U.clamp((r.luck - 0.85) / 0.6, 0.1, 1)) + '</div>' }));
            const act = UI.el('div.act');
            if (on) act.appendChild(UI.el('span.owned', { html: FB.ic('check') + FB.t('equipped') }));
            else if (owned) act.appendChild(UI.btn('small', FB.t('take'), () => { S.rod = r.id; FB.state.save(); UI.refresh(); }));
            else if (S.level < r.level) act.appendChild(UI.btn('small grey off', FB.ic('lock') + FB.t('lvl_n', { n: r.level })));
            else act.appendChild(UI.btn('small yellow', UI.price({ coins: r.price }), (e) => {
                if (FB.shop.buyRod(r.id)) { bought(e, FB.name(r)); UI.refresh(); }
                else UI.toast(FB.t('not_enough'), 'coin');
            }));
            card.appendChild(act);
            box.appendChild(card);
        });
        box.appendChild(UI.el('div.sec-title', { html: FB.ic('worm') + FB.t('bait') }));
        box.appendChild(UI.el('p.muted', { text: FB.t('bait_hint'), style: 'margin:0 4px 10px;font-size:14px' }));
        const grid = UI.el('div.grid.small');
        FB.BAITS.forEach(b => {
            const owned = S.baits.includes(b.id), on = S.bait === b.id;
            const card = UI.el('div.card.item' + (on ? '.on' : ''), { html: '<div class="prev">' + FB.ic(b.icon) + '</div><div class="nm">' + U.esc(FB.name(b)) + '</div>' });
            if (on) card.appendChild(UI.el('span.owned', { html: FB.ic('check') + FB.t('equipped') }));
            else if (owned) card.appendChild(UI.btn('small', FB.t('take'), () => { S.bait = b.id; FB.state.save(); FB.hud.update(); UI.refresh(); }));
            else if (S.level < b.level) card.appendChild(UI.btn('small grey off', FB.ic('lock') + FB.t('lvl_n', { n: b.level })));
            else card.appendChild(UI.btn('small yellow', UI.price({ coins: b.price }), (e) => {
                if (FB.shop.buyBait(b.id)) { bought(e, FB.name(b)); FB.hud.update(); UI.refresh(); }
                else UI.toast(FB.t('not_enough'), 'coin');
            }));
            grid.appendChild(card);
        });
        box.appendChild(grid);
        return box;
    }

    function look() {
        const box = UI.el('div');
        const S = FB.S;
        const chips = UI.tabs([['who', FB.t('cat_who')]].concat(FB.COSMETIC_CATS.map(c => [c, FB.t('cat_' + c)])), cat, (id) => { cat = id; UI.refresh(); });
        chips.style.paddingTop = '0';
        box.appendChild(chips);
        const grid = UI.el('div.grid.small');
        if (cat === 'who') {
            // Рыбак — выбирается бесплатно, в любой момент
            ['boy', 'girl', 'grandpa'].forEach(id => {
                const on = (S.who || 'boy') === id;
                const card = UI.el('div.card.item' + (on ? '.on' : ''));
                const c = document.createElement('canvas');
                c.width = 192; c.height = 160;
                FB.person.preview(c, { cat: 'who', id, c: {} });
                card.appendChild(UI.el('div.prev', {}, [c]));
                card.appendChild(UI.el('div.nm', { text: FB.t('who_' + id) }));
                if (on) card.appendChild(UI.el('span.owned', { html: FB.ic('check') + FB.t('equipped') }));
                else card.appendChild(UI.btn('small', FB.t('choose'), () => { S.who = id; FB.state.save(); UI.refresh(); }));
                grid.appendChild(card);
            });
            box.appendChild(grid);
            return box;
        }
        FB.COSMETICS.filter(c => c.cat === cat).forEach(item => {
            const owned = S.owned.includes(item.id), on = S.look[item.cat] === item.id;
            const card = UI.el('div.card.item' + (on ? '.on' : ''));
            const prev = UI.el('div.prev');
            if (item.cat === 'frame') {
                const a = UI.avatar(FB.sdk.playerName() || FB.t('angler'), FB.sdk.playerPhoto(), item.id);
                a.style.width = a.style.height = '58px';
                prev.appendChild(a);
            } else {
                const c = document.createElement('canvas');
                c.width = 192; c.height = 160;
                FB.person.preview(c, item);
                prev.appendChild(c);
            }
            card.appendChild(prev);
            card.appendChild(UI.el('div.nm', { text: FB.name(item) }));
            if (on) card.appendChild(UI.el('span.owned', { html: FB.ic('check') + FB.t('equipped') }));
            else if (owned) card.appendChild(UI.btn('small', FB.t('wear'), () => { FB.shop.equip(item.id); UI.refresh(); }));
            else if (item.cost) card.appendChild(UI.btn('small ' + (item.cost.pearls ? 'violet' : 'yellow'), UI.price(item.cost), (e) => {
                if (FB.shop.buyCos(item.id)) { bought(e, FB.name(item)); FB.scene.burst(FB.scene.W / 2, FB.scene.H / 2, 'fx_stars'); UI.refresh(); }
                else if (item.cost.pearls) { UI.toast(FB.t('not_enough_pearls'), 'pearl'); tab = 'pearls'; UI.refresh(); }
                else UI.toast(FB.t('not_enough'), 'coin');
            }));
            else card.appendChild(UI.el('div.src', { text: FB.t('src_' + item.src) }));
            grid.appendChild(card);
        });
        box.appendChild(grid);
        return box;
    }

    // Цена из каталога Яндекса со значком валюты (обязательно по правилам)
    function realPrice(id) {
        const c = catalog && catalog[id];
        if (!c) return FB.sdk.paymentsAvailable() ? '…' : '—';
        return '<span class="price">' + U.esc(c.price) + (c.icon ? ' <img src="' + U.esc(c.icon) + '" alt="">' : ' ' + FB.t('yan')) + '</span>';
    }

    function pearls() {
        const box = UI.el('div');
        const S = FB.S;
        if (!FB.sdk.paymentsAvailable()) {
            box.appendChild(UI.el('div.notice', { text: FB.t('pay_unavailable') }));
        }
        const grid = UI.el('div.grid');
        // Набор новичка — один раз, выгодно, сверху
        if (!S.buy.starter) {
            const p = FB.productById.starter;
            const card = UI.el('div.card.product.wide');
            const pv = UI.el('div', { style: 'display:flex;gap:4px;flex:none' });
            p.items.forEach(id => { const c = document.createElement('canvas'); c.width = 144; c.height = 120; c.style.width = '72px'; c.style.height = '60px'; FB.person.preview(c, FB.cosById[id]); pv.appendChild(c); });
            card.appendChild(pv);
            card.appendChild(UI.el('div.txt', { html: '<div class="nm">' + U.esc(FB.name(p)) + '</div><div class="muted">' + p.items.map(id => U.esc(FB.name(FB.cosById[id]))).join(' + ') + ' + ' + p.pearls + ' ' + FB.t('pearls_word') + '</div>' }));
            card.appendChild(UI.btn('coral small', realPrice(p.id), () => buy(p.id)));
            card.appendChild(UI.el('div.tagline', { text: FB.t('once') }));
            grid.appendChild(card);
        }
        ['pearls_s', 'pearls_m', 'pearls_l'].forEach((id, i) => {
            const p = FB.productById[id];
            const card = UI.el('div.card.product', { html:
                '<div class="big-ic">' + pearlPile(i) + '</div><div class="amount">' + p.pearls + '</div><div class="nm">' + U.esc(FB.name(p)) + '</div>' });
            card.appendChild(UI.btn('violet small', realPrice(p.id), () => buy(p.id)));
            if (p.tag) card.appendChild(UI.el('div.tagline', { text: FB.t('tag_' + p.tag) }));
            grid.appendChild(card);
        });
        // Без рекламы
        const na = UI.el('div.card.product.wide', { html: '<div class="big-ic" style="width:64px;height:64px">' + FB.ic('video') + '</div><div class="txt"><div class="nm">' + FB.t('no_ads') + '</div><div class="muted">' + FB.t('no_ads_desc') + '</div></div>' });
        na.appendChild(S.buy.noAds ? UI.el('span.owned', { html: FB.ic('check') + FB.t('bought') }) : UI.btn('blue small', realPrice('no_ads'), () => buy('no_ads')));
        grid.appendChild(na);
        // Золотой пропуск — ведёт в задания
        const gp = UI.el('div.card.product.wide', { html: '<div class="big-ic" style="width:64px;height:64px">' + FB.ic('crown') + '</div><div class="txt"><div class="nm">' + FB.t('golden_pass') + '</div><div class="muted">' + FB.t('golden_pass_desc') + '</div></div>' });
        gp.appendChild(S.season.pass ? UI.el('span.owned', { html: FB.ic('check') + FB.t('bought') }) : UI.btn('yellow small', FB.t('look_at'), () => { UI.close(); FB.tasks.open('season'); }));
        grid.appendChild(gp);
        box.appendChild(grid);
        box.appendChild(UI.el('p.muted.center', { text: FB.t('pearls_note'), style: 'font-size:13px;margin-top:12px' }));
        return box;
    }

    function pearlPile(n) {
        const balls = [[24, 30, 9], [14, 34, 7], [34, 34, 7], [19, 24, 6], [30, 24, 6], [24, 18, 5], [10, 26, 5], [38, 26, 5]].slice(0, 3 + n * 2 + (n === 2 ? 1 : 0));
        return '<svg viewBox="0 0 48 48"><ellipse cx="24" cy="40" rx="18" ry="5" fill="#7cc4e8" stroke="#2a3550" stroke-width="2"/>' +
            balls.reverse().map(([x, y, r]) => '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="#f3eeff" stroke="#2a3550" stroke-width="2"/><circle cx="' + (x - r * 0.35) + '" cy="' + (y - r * 0.35) + '" r="' + (r * 0.3) + '" fill="#fff"/>').join('') + '</svg>';
    }

    async function buy(id) {
        if (!FB.sdk.paymentsAvailable()) return UI.toast(FB.t('pay_unavailable'), 'info');
        const ok = await FB.shop.buyProduct(id);
        if (ok) {
            FB.audio.play('level');
            UI.toast(FB.t('thanks_buy'), 'heart', 3000);
            FB.scene.burst(FB.scene.W / 2, FB.scene.H / 2, 'fx_confetti');
            FB.hud.update();
            UI.refresh();
        }
    }

    function bought(e, name) {
        FB.audio.play('coin');
        UI.toast(FB.t('bought_x', { name }), 'check');
        FB.hud.update();
    }
})(window.FB);
