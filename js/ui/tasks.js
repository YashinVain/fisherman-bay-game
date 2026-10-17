// tasks.js — окно «Задания»: подарок за вход, три задания дня и сезонный пропуск.

(function (FB) {
    const TK = FB.tasks = {};
    const UI = FB.ui, U = FB.U;
    let tab = 'daily';

    TK.open = (which) => {
        tab = which || tab;
        FB.quests.sync();
        const render = () => {
            const box = UI.el('div');
            const d = FB.S.daily;
            const dots = { daily: FB.quests.giftReady() || d.quests.some(q => q.done && !q.got), season: FB.state.seasonUnclaimed() > 0 };
            box.appendChild(UI.tabs([['daily', FB.t('tasks_daily')], ['season', FB.t('tasks_season')]], tab, (id) => { tab = id; UI.refresh(); }, dots));
            box.appendChild(tab === 'daily' ? daily() : season());
            return box;
        };
        UI.open({ title: FB.t('nav_tasks'), body: render(), render, width: 'min(96vw, 600px)', onClose: () => FB.hud.update() });
    };

    // ---------- Подарок и задания ----------
    function daily() {
        const box = UI.el('div');
        const Q = FB.quests, d = FB.S.daily;
        // Сегодняшний день в круге: если подарок уже забран, серия ушла на шаг вперёд
        const got = d.gift && d.streak > 0;
        const step = got ? d.streak - 1 : d.streak;
        const idx = step % 7, shownCycle = Math.floor(step / 7);
        box.appendChild(UI.el('div.sec-title', { html: FB.ic('gift') + FB.t('daily_gift') + (shownCycle > 0 ? '<span class="round-n">' + FB.t('round_n', { n: shownCycle + 1 }) + '</span>' : '') }));
        const row = UI.el('div.gift-row');
        Q.GIFTS.forEach((g0, i) => {
            const g = Q.giftAt(i, shownCycle);
            const done = i < idx || (i === idx && got);
            const cls = (done ? '.done' : (i === idx && !got ? '.today' : '')) + (i === 6 ? '.big' : '');
            row.appendChild(UI.el('div.gift-day' + cls, { html: '<div class="dn">' + FB.t('day_n', { n: i + 1 }) + '</div>' + FB.ic(g.pearls ? 'pearl' : 'coin') + '<b>' + (g.coins || g.pearls) + '</b>' + (done ? '<span class="ok">✓</span>' : '') }));
        });
        box.appendChild(row);
        if (Q.giftReady()) {
            const r = Q.giftToday();
            const acts = UI.el('div.choice', { style: 'margin:0 0 6px' });
            const claim = (double) => (e) => {
                const got = Q.claimGift(double);
                if (!got) return;
                const rr = e.target.getBoundingClientRect ? e.target.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0 };
                UI.fly(got.pearls ? 'pearl' : 'coin', rr.left + rr.width / 2, rr.top, 6);
                FB.hud.update();
                UI.refresh();
            };
            acts.appendChild(UI.btn('yellow', FB.t('take_gift') + ' ' + UI.reward(r), claim(false)));
            if (FB.sdk.adsAvailable()) acts.appendChild(UI.btn('violet', FB.ic('video') + FB.t('take_x2'), async (e) => {
                const ev = { target: e.currentTarget };
                const res = await FB.sdk.showRewarded(() => {});
                if (res === 'rewarded') claim(true)(ev);
            }));
            box.appendChild(acts);
        } else {
            box.appendChild(UI.el('p.muted.center', { text: FB.t('gift_tomorrow'), style: 'margin:0 0 6px;font-size:14px' }));
        }

        box.appendChild(UI.el('div.sec-title', { html: FB.ic('tasks') + FB.t('daily_quests') }));
        d.quests.forEach((q, i) => {
            const card = UI.el('div.card.quest' + (q.got ? '.got' : ''));
            card.appendChild(UI.el('div.qic', { html: questIcon(q) }));
            const body = UI.el('div.body', { html: '<div class="txt">' + questText(q) + '</div>' +
                '<div class="progress' + (q.done ? '' : ' blue') + '"><i style="width:' + Math.round(q.p / q.n * 100) + '%"></i><span>' + U.fmt(q.p) + ' / ' + U.fmt(q.n) + '</span></div>' +
                '<div class="rw">' + FB.t('reward') + ': ' + UI.reward(q.rw) + ' + 30 ' + FB.t('xp') + '</div>' });
            card.appendChild(body);
            if (q.got) card.appendChild(UI.el('span.owned', { html: FB.ic('check') }));
            else if (q.done) card.appendChild(UI.btn('small pulse', FB.t('claim'), (e) => {
                if (Q.claim(i)) {
                    const r = e.currentTarget ? e.currentTarget.getBoundingClientRect() : null;
                    if (r) UI.fly('coin', r.left + r.width / 2, r.top, 6);
                    FB.audio.play('coin');
                    FB.hud.update();
                    UI.refresh();
                }
            }));
            else if (!d.swapped && FB.sdk.adsAvailable()) card.appendChild(UI.el('button.swap', { title: FB.t('swap_quest'), html: FB.ic('swap'), onclick: async () => {
                FB.audio.play('click');
                const res = await FB.sdk.showRewarded(() => {});
                if (res === 'rewarded') { Q.swap(i); UI.refresh(); }
            } }));
            box.appendChild(card);
        });
        box.appendChild(UI.el('p.muted.center', { text: FB.t('quests_reset'), style: 'font-size:13px' }));
        return box;
    }

    function questText(q) {
        const f = q.arg && FB.fishById[q.arg];
        return FB.t('q_' + q.type, { n: U.fmt(q.n), name: f ? FB.name(f) : '', w: q.type === 'heavy' ? U.weight(q.arg) : '' });
    }
    function questIcon(q) {
        if (q.type === 'species') return '<img src="' + FB.fishArt.url(q.arg, 60) + '" style="width:46px;height:46px;object-fit:contain" alt="">';
        return FB.ic({ catch: 'fish', heavy: 'trophy', rare: 'sparkle', release: 'heart', tourney: 'trophy', points: 'star' }[q.type] || 'fish');
    }

    // ---------- Сезон ----------
    function rewardBox(r, state, gold) {
        const b = UI.el('div.rw-box' + (gold ? '.gold' : '') + (state ? '.' + state : ''));
        if (r.item) {
            const c = document.createElement('canvas');
            c.width = 96; c.height = 80;
            const item = FB.cosById[r.item];
            if (item.cat === 'frame') b.appendChild(UI.avatar('★', '', item.id));
            else { FB.person.preview(c, item); c.style.width = '48px'; c.style.height = '40px'; b.appendChild(c); }
            b.appendChild(UI.el('div.rw-nm', { text: FB.name(item) }));
        } else {
            b.innerHTML = FB.ic(r.pearls ? 'pearl' : 'coin') + '<div class="rw-n">' + U.fmt(r.coins || r.pearls) + '</div>';
        }
        if (state === 'claim') b.appendChild(UI.el('span.rw-take', { text: FB.t('claim') }));
        if (state === 'got') b.appendChild(UI.el('span.rw-ok', { text: '✓' }));
        if (gold && !FB.S.season.pass) b.appendChild(UI.el('span.lk', { html: FB.ic('lock') }));
        return b;
    }

    function season() {
        const box = UI.el('div');
        const S = FB.S, SE = FB.SEASON;
        const tier = FB.state.seasonTier();
        const inTier = S.season.pts % SE.perTier;
        const done = tier >= SE.tiers.length;
        const pct = done ? 100 : Math.round(inTier / SE.perTier * 100);
        // Карточка сезона: ступень, прогресс до следующей и как это работает
        box.appendChild(UI.el('div.season-card', { html:
            '<div class="sc-head">' + FB.ic('crown') + '<div><div class="sc-name">' + U.esc(FB.name(SE)) + '</div>' +
            '<div class="sc-sub">' + (done ? FB.t('season_done') : FB.t('season_step', { n: tier, m: SE.tiers.length })) + '</div></div></div>' +
            '<div class="progress gold"><i style="width:' + pct + '%"></i><span>' + (done ? '★' : FB.t('season_left', { a: U.fmt(inTier), b: U.fmt(SE.perTier) })) + '</span></div>' +
            '<div class="sc-how">' +
            '<div>' + FB.ic('fish') + '<span>' + FB.t('season_how1') + '</span></div>' +
            '<div>' + FB.ic('star') + '<span>' + FB.t('season_how2', { n: SE.perTier }) + '</span></div>' +
            '<div>' + FB.ic('gift') + '<span>' + FB.t('season_how3') + '</span></div></div>' }));
        const strip = UI.el('div.tiers');
        SE.tiers.forEach((t, i) => {
            const reached = i < tier;
            const col = UI.el('div.tier' + (reached ? '.reached' : ''));
            const st = (track) => {
                const got = S.season[track].includes(i);
                if (got) return 'got';
                if (!reached) return 'locked';
                if (track === 'gold' && !S.season.pass) return 'locked';
                return 'claim';
            };
            const make = (track) => {
                const s = st(track);
                const b = rewardBox(t[track], s, track === 'gold');
                b.addEventListener('click', () => {
                    FB.audio.play('click');
                    if (s === 'claim' && FB.state.claimSeason(i, track)) {
                        const r = b.getBoundingClientRect();
                        UI.fly(t[track].pearls ? 'pearl' : 'coin', r.left + r.width / 2, r.top, 5);
                        FB.hud.update();
                        UI.refresh();
                    } else if (track === 'gold' && !S.season.pass) UI.toast(FB.t('need_pass'), 'crown');
                    else if (s === 'locked') UI.toast(FB.t('tier_locked'), 'lock');
                });
                return b;
            };
            col.appendChild(make('free'));
            col.appendChild(UI.el('div.num', { html: '<i></i><span>' + (i + 1) + '</span>' }));
            col.appendChild(make('gold'));
            strip.appendChild(col);
        });
        const wrap = UI.el('div.tiers-wrap', { html: '<div class="track-lab free">' + FB.t('track_free') + '</div>' });
        wrap.appendChild(strip);
        wrap.appendChild(UI.el('div.track-lab.gold', { html: FB.ic('crown') + FB.t('track_gold') }));
        box.appendChild(wrap);
        // Колёсико мыши листает ступени вбок
        strip.addEventListener('wheel', (e) => {
            if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
            e.preventDefault();
            strip.scrollLeft += e.deltaY;
        }, { passive: false });
        // Прокрутить к текущей ступени
        setTimeout(() => { strip.style.scrollBehavior = 'auto'; strip.scrollLeft = Math.max(0, Math.min(tier, SE.tiers.length - 1) * 104 + 53 - strip.clientWidth / 2); strip.style.scrollBehavior = ''; }, 30);
        if (!S.season.pass) {
            const card = UI.el('div.card.product.wide', { html: '<div class="big-ic" style="width:64px;height:64px">' + FB.ic('crown') + '</div><div class="txt"><div class="nm">' + FB.t('golden_pass') + '</div><div class="muted">' + FB.t('golden_pass_desc') + '</div></div>' });
            card.appendChild(UI.btn('yellow', FB.t('buy_pass'), async () => {
                if (!FB.sdk.paymentsAvailable()) return UI.toast(FB.t('pay_unavailable'), 'info');
                if (await FB.shop.buyProduct('season_pass')) {
                    FB.audio.play('level');
                    FB.scene.burst(FB.scene.W / 2, FB.scene.H / 2, 'fx_confetti');
                    UI.toast(FB.t('thanks_buy'), 'heart', 3000);
                    FB.hud.update();
                    UI.refresh();
                }
            }));
            box.appendChild(card);
        }
        return box;
    }
})(window.FB);
