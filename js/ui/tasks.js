// tasks.js — окно «Задания»: подарок за вход, три задания дня и сезонный пропуск.
// Всё нарочно простое: подарки — дорожка из семи кружков, задания — строки
// в одной карточке, сезон — вертикальная лесенка (слева бесплатно, справа золото).

(function (FB) {
    const TK = FB.tasks = {};
    const UI = FB.ui, U = FB.U;
    let tab = 'daily';
    let jump = false;   // прокрутить сезон к текущей ступени (при открытии вкладки)

    TK.open = (which) => {
        tab = which || tab;
        jump = true;
        FB.quests.sync();
        const render = () => {
            const box = UI.el('div');
            const d = FB.S.daily;
            const dots = { daily: FB.quests.giftReady() || d.quests.some(q => q.done && !q.got), season: FB.state.seasonUnclaimed() > 0 };
            box.appendChild(UI.tabs([['daily', FB.t('tasks_daily')], ['season', FB.t('tasks_season')]], tab, (id) => {
                tab = id;
                jump = true;
                UI.refresh();
                const top = UI.stack[UI.stack.length - 1];
                if (top && id === 'daily') top.body.scrollTop = 0;
            }, dots));
            box.appendChild(tab === 'daily' ? daily() : season());
            return box;
        };
        UI.open({ title: FB.t('nav_tasks'), body: render(), render, width: 'min(96vw, 560px)', onClose: () => FB.hud.update(), tip: () => 'tasks-' + tab });
    };

    const flyFrom = (el, kind, n) => {
        const r = el && el.getBoundingClientRect ? el.getBoundingClientRect() : null;
        if (r) UI.fly(kind, r.left + r.width / 2, r.top, n || 6);
    };

    // ---------- Подарок и задания ----------
    function daily() {
        const box = UI.el('div');
        const Q = FB.quests, d = FB.S.daily;
        // Сегодняшний день в круге: если подарок уже забран, серия ушла на шаг вперёд
        const got = d.gift && d.streak > 0;
        const step = got ? d.streak - 1 : d.streak;
        const idx = step % 7, shownCycle = Math.floor(step / 7);

        const gift = UI.el('div.card.gift-card');
        gift.appendChild(UI.el('div.gc-head', { html: FB.ic('gift') + '<b>' + FB.t('daily_gift') + '</b>' +
            '<span class="gc-day">' + FB.t('day_of', { n: idx + 1 }) + (shownCycle > 0 ? ' · ' + FB.t('round_n', { n: shownCycle + 1 }) : '') + '</span>' }));
        // Дорожка из семи дней: пройденные — зелёные, сегодняшний — жёлтый
        const track = UI.el('div.gift-row');
        track.appendChild(UI.el('i.gr-line', { style: '--p:' + (idx / 6) }));
        Q.GIFTS.forEach((g0, i) => {
            const g = Q.giftAt(i, shownCycle);
            const done = i < idx || (i === idx && got);
            const cls = (done ? '.done' : (i === idx ? '.today' : '')) + (i === 6 ? '.big' : '');
            track.appendChild(UI.el('div.gd' + cls, { html: '<div class="gd-c">' + FB.ic(g.pearls ? 'pearl' : 'coin') + (done ? '<span class="ok">✓</span>' : '') + '</div><b>' + U.fmt(g.coins || g.pearls) + '</b>' }));
        });
        gift.appendChild(track);
        if (Q.giftReady()) {
            const r = Q.giftToday();
            const acts = UI.el('div.gc-acts');
            const claim = (double) => (e) => {
                const res = Q.claimGift(double);
                if (!res) return;
                flyFrom(e.target, res.pearls ? 'pearl' : 'coin');
                FB.hud.update();
                UI.refresh();
            };
            acts.appendChild(UI.btn('yellow', FB.t('take_gift') + ' ' + UI.reward(r), claim(false)));
            if (FB.sdk.adsAvailable()) acts.appendChild(UI.btn('violet', FB.ic('video') + '×2', async (e) => {
                const ev = { target: e.currentTarget };
                const res = await FB.sdk.showRewarded(() => {});
                if (res === 'rewarded') claim(true)(ev);
            }));
            gift.appendChild(acts);
        } else {
            gift.appendChild(UI.el('div.gc-later', { text: FB.t('gift_tomorrow') }));
        }
        box.appendChild(gift);

        box.appendChild(UI.el('div.sec-title', { html: FB.ic('tasks') + FB.t('daily_quests') + '<span class="sec-note">' + FB.t('quests_reset') + '</span>' }));
        const list = UI.el('div.card.qlist');
        d.quests.forEach((q, i) => {
            const row = UI.el('div.quest' + (q.got ? '.got' : q.done ? '.ready' : ''));
            row.appendChild(UI.el('div.qic', { html: questIcon(q) }));
            row.appendChild(UI.el('div.body', { html: '<div class="txt">' + questText(q) + '</div>' +
                '<div class="qbar"><i style="width:' + Math.round(q.p / q.n * 100) + '%"></i></div>' +
                '<div class="qn">' + U.fmt(q.p) + ' / ' + U.fmt(q.n) + '</div>' }));
            const side = UI.el('div.qside' + (q.done && !q.got ? '.go' : ''));
            if (q.got) side.appendChild(UI.el('span.q-ok', { html: FB.ic('check') }));
            else if (q.done) side.appendChild(UI.btn('small pulse', FB.t('claim') + ' ' + UI.reward(q.rw), (e) => {
                if (Q.claim(i)) {
                    flyFrom(e.currentTarget, 'coin');
                    FB.audio.play('coin');
                    FB.hud.update();
                    UI.refresh();
                }
            }));
            else {
                side.appendChild(UI.el('span.q-rw', { html: UI.reward(q.rw) }));
                if (!d.swapped && FB.sdk.adsAvailable()) side.appendChild(UI.el('button.q-swap', { title: FB.t('swap_quest'), html: FB.ic('swap'), onclick: async () => {
                    FB.audio.play('click');
                    const res = await FB.sdk.showRewarded(() => {});
                    if (res === 'rewarded') { Q.swap(i); UI.refresh(); }
                } }));
            }
            row.appendChild(side);
            list.appendChild(row);
        });
        box.appendChild(list);
        return box;
    }

    function questText(q) {
        const f = q.arg && FB.fishById[q.arg];
        return FB.t('q_' + q.type, { n: U.fmt(q.n), name: f ? FB.name(f) : '', w: q.type === 'heavy' ? U.weight(q.arg) : '' });
    }
    function questIcon(q) {
        if (q.type === 'species') return '<img src="' + FB.fishArt.url(q.arg, 60) + '" alt="">';
        return FB.ic({ catch: 'fish', heavy: 'trophy', rare: 'sparkle', release: 'heart', tourney: 'trophy', points: 'star' }[q.type] || 'fish');
    }

    // ---------- Сезон ----------
    // Награда в лесенке: картинка, подпись и состояние (забрать / ✓ / замок)
    function rewardCell(r, state, gold) {
        const c = UI.el('div.rc' + (gold ? '.gold' : '') + '.' + state);
        const pic = UI.el('div.rc-pic');
        let label;
        if (r.item) {
            const item = FB.cosById[r.item];
            if (item.cat === 'frame') pic.appendChild(UI.avatar('★', '', item.id));
            else {
                const cv = document.createElement('canvas');
                cv.width = 96; cv.height = 80;
                FB.person.preview(cv, item);
                pic.appendChild(cv);
            }
            label = U.esc(FB.name(item));
        } else {
            pic.innerHTML = FB.ic(r.pearls ? 'pearl' : 'coin');
            label = '<b>' + U.fmt(r.coins || r.pearls) + '</b>';
        }
        c.appendChild(pic);
        c.appendChild(UI.el('div.rc-nm', { html: label }));
        if (state === 'claim') c.appendChild(UI.el('span.rc-take', { text: FB.t('claim') }));
        else if (state === 'got') c.appendChild(UI.el('span.rc-ok', { text: '✓' }));
        return c;
    }

    function season() {
        const box = UI.el('div');
        const S = FB.S, SE = FB.SEASON;
        const tier = FB.state.seasonTier();
        const inTier = S.season.pts % SE.perTier;
        const done = tier >= SE.tiers.length;
        const pct = done ? 100 : Math.round(inTier / SE.perTier * 100);
        // Шапка: сезон, ступень, полоска до следующей и одна строка «как это работает»
        box.appendChild(UI.el('div.season-card', { html:
            '<div class="sc-head">' + FB.ic('crown') + '<div class="sc-t"><div class="sc-name">' + U.esc(FB.name(SE)) + '</div>' +
            '<div class="sc-sub">' + (done ? FB.t('season_done') : FB.t('season_step', { n: tier, m: SE.tiers.length })) + '</div></div></div>' +
            '<div class="progress gold"><i style="width:' + pct + '%"></i><span>' + (done ? '★' : FB.t('season_left', { a: U.fmt(inTier), b: U.fmt(SE.perTier) })) + '</span></div>' +
            '<div class="sc-how">' + FB.ic('fish') + '<span>' + FB.t('season_how', { n: SE.perTier }) + '</span></div>' }));
        // Золотой пропуск — короткой плашкой сверху, пока его нет
        if (!S.season.pass) {
            const pass = UI.el('div.pass-bar', { html: FB.ic('crown') + '<div class="pb-t"><b>' + FB.t('golden_pass') + '</b><span>' + FB.t('pass_short') + '</span></div>' });
            pass.appendChild(UI.btn('yellow small', FB.t('buy_pass'), async () => {
                if (!FB.sdk.paymentsAvailable()) return UI.toast(FB.t('pay_unavailable'), 'info');
                if (await FB.shop.buyProduct('season_pass')) {
                    FB.audio.play('level');
                    FB.scene.burst(FB.scene.W / 2, FB.scene.H / 2, 'fx_confetti');
                    UI.toast(FB.t('thanks_buy'), 'heart', 3000);
                    FB.hud.update();
                    UI.refresh();
                }
            }));
            box.appendChild(pass);
        }
        // Лесенка: строка на ступень — бесплатная награда | номер | золотая
        const ladder = UI.el('div.ladder');
        ladder.appendChild(UI.el('div.ld-head', { html: '<span>' + FB.t('track_free') + '</span><span></span><span class="g">' + FB.ic(S.season.pass ? 'crown' : 'lock') + FB.t('track_gold') + '</span>' }));
        let current = null;
        SE.tiers.forEach((t, i) => {
            const reached = i < tier;
            const now = i === tier && !done;
            const row = UI.el('div.ld-row' + (reached ? '.reached' : '') + (now ? '.now' : ''));
            const st = (track) => {
                if (S.season[track].includes(i)) return 'got';
                if (!reached) return 'locked';
                if (track === 'gold' && !S.season.pass) return 'locked';
                return 'claim';
            };
            const make = (track) => {
                const s = st(track);
                const cell = rewardCell(t[track], s, track === 'gold');
                cell.addEventListener('click', () => {
                    FB.audio.play('click');
                    if (s === 'claim' && FB.state.claimSeason(i, track)) {
                        flyFrom(cell, t[track].pearls ? 'pearl' : 'coin', 5);
                        FB.hud.update();
                        UI.refresh();
                    } else if (track === 'gold' && !S.season.pass) UI.toast(FB.t('need_pass'), 'crown');
                    else if (s === 'locked') UI.toast(FB.t('tier_locked'), 'lock');
                });
                return cell;
            };
            row.appendChild(make('free'));
            // Номер ступени на линии; у текущей линия заполнена настолько, сколько набрано
            row.appendChild(UI.el('div.ld-mid', { html: '<i class="ln"' + (now ? ' style="--p:' + (pct / 100) + '"' : '') + '></i><span>' + (i + 1) + '</span>' }));
            row.appendChild(make('gold'));
            ladder.appendChild(row);
            if (now || (done && i === SE.tiers.length - 1)) current = row;
        });
        box.appendChild(ladder);
        // При открытии вкладки — прокрутить к текущей ступени (без рывков при «Забрать»)
        if (jump && current) {
            setTimeout(() => {
                const body = current.closest('.sheet-body');
                if (!body) return;
                // Только если текущая ступень не видна — тогда шапка сезона остаётся на виду
                const r = current.getBoundingClientRect(), b = body.getBoundingClientRect();
                if (r.bottom > b.bottom - 16) body.scrollTop += r.bottom - b.bottom + b.height * 0.35;
            }, 30);
        }
        jump = false;
        return box;
    }
})(window.FB);
