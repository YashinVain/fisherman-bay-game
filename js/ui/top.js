// top.js — окно «Топ»: турнир недели, слава рыбака за всё время, рыба-рекорд.
// Рядом с именами видны рамки и сердечки поддержки — это то, ради чего
// приятно наряжаться в магазине. Таблица открывается сразу на твоём месте,
// а к первому месту можно долистать кнопкой.

(function (FB) {
    const TP = FB.top = {};
    const UI = FB.ui, U = FB.U;
    let tab = 'week';

    TP.open = (which) => {
        tab = which || tab;
        const render = () => {
            const box = UI.el('div');
            const tabs = UI.tabs([['week', FB.t('lb_week')], ['anglers', FB.t('lb_anglers')], ['record', FB.t('lb_record')]], tab, (id) => { tab = id; UI.refresh(); });
            box.appendChild(tabs);
            if (tab === 'week') box.appendChild(weekHead());
            else box.appendChild(UI.el('div.lb-desc', { html: FB.ic(tab === 'record' ? 'fish' : 'star') + '<span>' + FB.t('lb_desc_' + tab) + '</span>' }));
            const mine = UI.el('div.lb-me-card.hidden');
            const big = UI.el('div.lb-big.hidden');
            const list = UI.el('div.lb-list', { html: '<div class="notice">' + FB.t('loading') + '</div>' });
            // Сначала моё место и таблица, ниже — главный улов и правила
            if (tab === 'week') box.append(mine, list, big, weekRules());
            else box.appendChild(list);
            if (FB.sdk.mock) box.appendChild(UI.el('p.lb-mock', { text: FB.t('mock_top') }));
            if (tab === 'week') myCard(mine, 0);
            fill(list, mine, big);
            return box;
        };
        UI.open({ title: FB.t('nav_top'), body: render(), render, width: 'min(96vw, 560px)', tip: 'top' });
    };

    function weekHead() {
        const box = UI.el('div');
        const S = FB.S;
        if (S.lastResult && S.lastResult.idx === FB.state.weekIdx() - 1) {
            const r = S.lastResult;
            box.appendChild(UI.el('div.result-banner', { html: FB.ic('medal', r.rank && r.rank <= 3 ? '#ffd23a' : '#9cd4f4') +
                '<div><b>' + FB.t('last_week') + '</b><div>' + (r.rank ? FB.t('place_n', { n: r.rank }) + ' · ' : '') + FB.t('week_points', { n: U.fmt(r.pts) }) + '</div></div>' }));
        }
        const cfg = FB.state.weekCfg();
        const fish = FB.fishById[cfg.fish];
        box.appendChild(UI.el('div.lb-head', { html:
            '<img src="' + FB.fishArt.url(fish.id, 120) + '" alt="">' +
            '<div><div class="k">' + FB.t('pond_of_week') + '</div><div class="v">' + U.esc(FB.name(FB.pondById[cfg.pond])) + '</div>' +
            '<div class="k" style="margin-top:4px">' + FB.t('fish_of_week') + '</div><div class="v">' + U.esc(FB.name(fish)) + ' ×2</div></div>' +
            '<div class="time"><div class="k">' + FB.t('ends_in') + '</div><div class="v">' + U.duration(FB.week.end(cfg.idx) - FB.sdk.now()) + '</div>' +
            '<div style="margin-top:4px">' + FB.ic('weather_' + cfg.weather).replace('class="ic"', 'class="ic" style="width:30px;height:30px"') + '</div></div>' }));
        if (S.pond !== cfg.pond) {
            box.appendChild(UI.btn('yellow', FB.ic('map') + FB.t('go_tourney'), () => { UI.closeAll(); FB.panels.goTo(cfg.pond); }));
        }
        return box;
    }

    // Как победить — раскрывается по нажатию; пока уловов в турнире нет — открыто сразу
    function weekRules() {
        const S = FB.S, cfg = FB.state.weekCfg();
        const rules = UI.el('details.lb-rules', { html: '<summary>' + FB.ic('info') + FB.t('tw_title') + '</summary>' +
            ['map', 'star', 'fish', 'trophy'].map((ic, i) => '<div class="tw">' + FB.ic(ic) + '<span>' + FB.t('tw_' + (i + 1)) + '</span></div>').join('') });
        if (!(S.week.idx === cfg.idx && S.week.catches)) rules.open = true;
        return rules;
    }

    // Мой результат недели: место, очки и сколько уловов уже считается
    function myCard(el, rank) {
        const S = FB.S, cfg = FB.state.weekCfg();
        const best = S.week.idx === cfg.idx ? S.week.best : [];
        el.classList.remove('hidden');
        el.innerHTML =
            '<div class="cell"><div class="k">' + FB.t('my_place') + '</div><div class="v">' + (rank ? '#' + rank : '—') + '</div></div>' +
            '<div class="cell"><div class="k">' + FB.t('my_points') + '</div><div class="v">' + U.fmt(FB.week.sum(best)) + '</div></div>' +
            '<div class="note">' + (!best.length ? FB.t('week_rules') : best.length < FB.week.TOP_N
                ? FB.t('counted', { n: best.length })
                : FB.t('counted_full', { min: U.fmt(Math.min.apply(null, best)) })) + '</div>';
    }

    // Главный улов недели среди тех, кто в таблице
    function bigCard(el, entries) {
        let top = null;
        entries.forEach(e => {
            const b = FB.tourney.parseExtra(e.extra).big;
            if (b && (!top || b.pts > top.b.pts || (b.pts === top.b.pts && b.g > top.b.g))) top = { b, e };
        });
        el.classList.remove('hidden');
        if (!top) {
            el.innerHTML = FB.ic('trophy') + '<div><div class="k">' + FB.t('big_catch') + '</div><div class="who">' + FB.t('no_big_catch') + '</div></div>';
            return;
        }
        const fish = FB.fishById[top.b.f];
        el.innerHTML =
            '<img src="' + FB.fishArt.url(fish.id, 140) + '" alt="">' +
            '<div><div class="k">' + FB.t('big_catch') + '</div>' +
            '<div class="v">' + U.esc(FB.name(fish)) + ' · ' + U.weight(top.b.g) + '</div>' +
            '<div class="who">' + (top.e.me ? FB.t('big_is_you') : FB.t('big_by', { name: U.esc(top.e.name || FB.t('hidden_angler')) })) + ' · ' + FB.t('pts_n', { n: U.fmt(top.b.pts) }) + '</div></div>';
    }

    async function fill(list, mine, big) {
        if (!FB.sdk.isAuthorized() && FB.sdk.ready) {
            const n = UI.el('div.notice', { html: '<p style="margin:0 0 10px">' + FB.t('login_for_top') + '</p>' });
            n.appendChild(UI.btn('blue', FB.ic('user') + FB.t('login_btn'), async () => { if (await FB.sdk.openAuth()) location.reload(); }));
            list.innerHTML = '';
            list.appendChild(n);
        }
        const cfg = FB.state.weekCfg();
        const board = tab === 'week' ? FB.week.board(cfg.idx) : tab;
        FB.tourney.submit();
        const data = await FB.sdk.getEntries(board);
        if (!list.isConnected) return;
        if (!data) {
            if (FB.sdk.isAuthorized() || !FB.sdk.ready) list.innerHTML = '<div class="notice">' + FB.t('top_unavailable') + '</div>';
            return;
        }
        let entries = data.entries;
        // В недельной доске остаются записи прошлых недель — показываем только эту
        if (tab === 'week') entries = entries.filter(e => FB.week.decode(e.score).idx === cfg.idx);
        const keepNotice = list.querySelector('.notice') && !FB.sdk.isAuthorized();
        if (!keepNotice) list.innerHTML = '';
        const me = entries.find(e => e.me);
        if (tab === 'week') { myCard(mine, me ? me.rank : 0); bigCard(big, entries); }
        if (!entries.length) { list.appendChild(UI.el('div.notice', { text: FB.t('top_empty') })); return; }
        const rows = UI.el('div.lb-rows');
        let prev = 0, meRow = null, firstRow = null;
        entries.forEach((e, i) => {
            const ex = FB.tourney.parseExtra(e.extra);
            // Старые недели всегда ниже текущей, поэтому место Яндекса верное и тут
            const rank = e.rank || i + 1;
            // Яндекс отдаёт топ-20 и соседей игрока — между ними пропуск
            if (prev && rank > prev + 1) rows.appendChild(UI.el('div.lb-gap', { html: '<i></i><i></i><i></i>' }));
            prev = rank;
            const row = UI.el('div.lb-row' + (e.me ? '.me' : ''));
            row.appendChild(UI.el('div.lb-rank' + (rank <= 3 ? '.r' + rank : ''), { text: rank }));
            row.appendChild(UI.avatar(e.name, e.avatar, ex.frame));
            row.appendChild(UI.el('div.lb-name', { html: U.esc(e.name || FB.t('hidden_angler')) + (ex.supporter ? FB.ic('heart').replace('class="ic"', 'class="ic heart"') : '') }));
            const v = tab === 'week' ? U.fmt(FB.week.decode(e.score).pts) : tab === 'record' ? U.weight(e.score) : U.fmt(e.score);
            row.appendChild(UI.el('div.lb-score', { text: v }));
            rows.appendChild(row);
            if (e.me) meRow = row;
            if (!firstRow) firstRow = row;
        });
        list.appendChild(rows);
        if (!meRow || (me && me.rank <= 4)) return;
        // Сразу показываем своё место, а кнопкой можно долистать до первого и обратно
        const jump = UI.el('button.lb-jump');
        list.appendChild(jump);
        const toRow = (row, smooth) => {
            const top = row.offsetTop - list.clientHeight / 2 + row.offsetHeight / 2;
            list.scrollTo({ top: Math.max(0, top), behavior: smooth ? 'smooth' : 'auto' });
        };
        const sync = () => {
            const atMe = Math.abs(list.scrollTop - Math.max(0, meRow.offsetTop - list.clientHeight / 2)) < list.clientHeight * 0.6;
            jump.innerHTML = atMe ? FB.ic('trophy') + FB.t('go_first') : FB.ic('user') + FB.t('go_me');
            jump.dataset.to = atMe ? 'first' : 'me';
        };
        jump.addEventListener('click', (e) => {
            e.stopPropagation();
            FB.audio.play('click');
            if (jump.dataset.to === 'first') list.scrollTo({ top: 0, behavior: 'smooth' });
            else toRow(meRow, true);
        });
        list.addEventListener('scroll', sync, { passive: true });
        requestAnimationFrame(() => { toRow(meRow, false); sync(); });
    }
})(window.FB);
