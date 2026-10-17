// top.js — окно «Топ»: турнир недели, лучшие рыбаки за всё время, рыба-рекорд.
// Рядом с именами видны рамки и сердечки поддержки — это то, ради чего
// приятно наряжаться в магазине.

(function (FB) {
    const TP = FB.top = {};
    const UI = FB.ui, U = FB.U;
    let tab = 'week';

    TP.open = (which) => {
        tab = which || tab;
        let entry;
        const render = () => {
            const box = UI.el('div');
            const tabs = UI.tabs([['week', FB.t('lb_week')], ['anglers', FB.t('lb_anglers')], ['record', FB.t('lb_record')]], tab, (id) => { tab = id; UI.refresh(); });
            box.appendChild(tabs);
            if (tab === 'week') box.appendChild(weekHead());
            else box.appendChild(UI.el('p.muted.center', { text: FB.t('lb_desc_' + tab), style: 'margin:0 0 10px;font-size:14px' }));
            const list = UI.el('div', { html: '<div class="notice">' + FB.t('loading') + '</div>' });
            box.appendChild(list);
            fill(list);
            return box;
        };
        entry = UI.open({ title: FB.t('nav_top'), body: render(), render, width: 'min(96vw, 560px)' });
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
        const best = S.week.idx === cfg.idx ? S.week.best : [];
        box.appendChild(UI.el('div.sec-title', { html: FB.ic('star') + FB.t('my_week', { n: U.fmt(FB.week.sum(best)) }) }));
        box.appendChild(UI.el('div.lb-mine', { html: best.length
            ? best.map(p => '<span>' + U.fmt(p) + '</span>').join('') + (best.length < FB.week.TOP_N ? '<span class="muted">' + FB.t('slots_left', { n: FB.week.TOP_N - best.length }) + '</span>' : '')
            : '<span class="muted">' + FB.t('week_rules') + '</span>' }));
        if (S.pond !== cfg.pond) {
            box.appendChild(UI.btn('yellow', FB.ic('map') + FB.t('go_tourney'), () => { UI.closeAll(); FB.panels.goTo(cfg.pond); }));
        }
        return box;
    }

    async function fill(list) {
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
        if (!entries.length) { list.appendChild(UI.el('div.notice', { text: FB.t('top_empty') })); return; }
        entries.forEach((e, i) => {
            const ex = FB.tourney.parseExtra(e.extra);
            // Старые недели всегда ниже текущей, поэтому место Яндекса верное и тут
            const rank = e.rank || i + 1;
            const row = UI.el('div.lb-row' + (e.me ? '.me' : ''));
            row.appendChild(UI.el('div.lb-rank' + (rank <= 3 ? '.r' + rank : ''), { text: rank }));
            row.appendChild(UI.avatar(e.name, e.avatar, ex.frame));
            row.appendChild(UI.el('div.lb-name', { html: U.esc(e.name || FB.t('hidden_angler')) + (ex.supporter ? FB.ic('heart').replace('class="ic"', 'class="ic heart"') : '') }));
            const v = tab === 'week' ? U.fmt(FB.week.decode(e.score).pts) : tab === 'record' ? U.weight(e.score) : U.fmt(e.score);
            row.appendChild(UI.el('div.lb-score', { text: v }));
            list.appendChild(row);
        });
    }
})(window.FB);
