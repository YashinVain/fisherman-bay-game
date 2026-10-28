// panels.js — окна «Места», «Альбом» (и карточка рыбы), «Профиль», «Настройки».

(function (FB) {
    const PN = FB.panels = {};
    const UI = FB.ui, U = FB.U;

    // ---------- Места ----------
    PN.places = () => {
        const render = () => {
            const cfg = FB.state.weekCfg();
            const box = UI.el('div');
            // Турнирная бухта — отдельно от обычных мест
            const here = FB.state.atTourney();
            const ar = UI.el('div.card.arena-card' + (here ? '.cur' : ''));
            const pic = UI.el('div.pic');
            const th = FB.scene.thumb('arena', 260, 96);
            const tc = document.createElement('canvas');
            tc.width = th.width; tc.height = th.height;
            tc.getContext('2d').drawImage(th, 0, 0);
            pic.appendChild(tc);
            pic.appendChild(UI.el('div.ribbon', { html: FB.ic('trophy') + FB.t('tourney') }));
            ar.appendChild(pic);
            const fishW = FB.fishById[cfg.fish];
            const info = UI.el('div.info', { html:
                '<div class="nm">' + U.esc(FB.name(FB.ARENA)) + '</div>' +
                '<div class="ar-sub">' + FB.t('arena_sub', { pond: U.esc(FB.name(FB.pondById[cfg.pond])) }) + '</div>' +
                '<div class="ar-fish"><img src="' + FB.fishArt.url(fishW.id, 60) + '" alt="">' + FB.t('fish_of_week') + ': <b>' + U.esc(FB.name(fishW)) + ' ×2</b></div>' +
                '<div class="ar-time">' + FB.ic('clock') + FB.t('time_left', { t: U.duration(FB.week.end(cfg.idx) - FB.sdk.now()) }) + '</div>' });
            info.appendChild(here ? UI.el('div.ar-here', { text: FB.t('you_here') }) : UI.btn('yellow small', FB.ic('trophy') + FB.t('go_tourney'), () => { PN.goTo('arena'); UI.close(); }));
            ar.appendChild(info);
            ar.addEventListener('click', () => { if (!here) { FB.audio.play('click'); PN.goTo('arena'); UI.close(); } });
            box.appendChild(ar);
            box.appendChild(UI.el('div.sec-title', { html: FB.ic('map') + FB.t('places_regular') }));
            const grid = UI.el('div.grid');
            FB.PONDS.forEach(p => {
                const open = FB.state.pondOpen(p.id);
                const fish = FB.fishOfPond(p.id);
                const got = fish.filter(f => FB.S.album[f.id]).length;
                const card = UI.el('div.card.place' + (open ? '' : '.locked') + (FB.S.pond === p.id ? '.cur' : ''));
                const pic = UI.el('div.pic');
                const thumb = FB.scene.thumb(p.id, 200, 92);
                const c = document.createElement('canvas');
                c.width = thumb.width; c.height = thumb.height;
                c.getContext('2d').drawImage(thumb, 0, 0);
                pic.appendChild(c);
                if (FB.S.pond === p.id) pic.appendChild(UI.el('div.ribbon.green', { html: FB.t('you_here') }));
                if (!open) pic.appendChild(UI.el('div.lockbox', { html: FB.ic('lock') + FB.t('lvl_n', { n: p.unlock }) }));
                card.appendChild(pic);
                card.appendChild(UI.el('div.info', { html:
                    '<div class="nm">' + U.esc(FB.name(p)) + '</div>' +
                    '<div class="cnt">' + FB.ic('fish').replace('class="ic"', 'class="ic" style="width:18px;height:18px"') + FB.t('caught_of', { a: got, b: fish.length }) + '</div>' +
                    (FB.places.feature(p.id) ? '<div class="feat">' + FB.ic('sparkle') + '<span>' + FB.t('plf_' + FB.places.feature(p.id)) + '</span></div>' : '') }));
                card.addEventListener('click', () => {
                    FB.audio.play('click');
                    if (!open) return UI.toast(FB.t('pond_locked', { n: p.unlock }), 'lock');
                    if (FB.S.pond === p.id) return UI.close();
                    PN.goTo(p.id);
                    UI.close();
                });
                grid.appendChild(card);
            });
            box.appendChild(grid);
            return box;
        };
        UI.open({ title: FB.t('nav_places'), body: render(), render, tip: 'places' });
    };

    // Переезд на другое место: старое место уплывает, новое проявляется,
    // по центру — название места. Потом — подходящая пауза для рекламы
    PN.goTo = (id) => {
        const pond = FB.pondById[id];
        if (!pond) return;
        FB.S.pond = id;
        FB.state.save();
        FB.fishing.reset();
        if (FB.drift) FB.drift.reset();
        FB.scene.travel(id, FB.week.weatherAt(id, FB.sdk.now()));
        FB.audio.play('travel');
        FB.hud.update();
        travelCard(pond);
        setTimeout(() => FB.sdk.showInterstitial(), 1700);
    };
    function travelCard(pond) {
        const old = document.querySelector('.travel-card');
        if (old) old.remove();
        const f = FB.places.feature(pond.id);
        const sub = pond.arena ? FB.t('arena_card') : f ? FB.t('plf_' + f) : '';
        const el = UI.el('div.travel-card' + (pond.arena ? '.arena' : ''), { html:
            FB.ic(pond.arena ? 'trophy' : 'map') + '<div><div class="t">' + U.esc(FB.name(pond)) + '</div>' + (sub ? '<div class="s">' + U.esc(sub) + '</div>' : '') + '</div>' });
        UI.root().appendChild(el);
        setTimeout(() => el.remove(), 2400);
    }

    // ---------- Альбом ----------
    let albumPond = null;
    PN.album = () => {
        albumPond = albumPond || FB.S.pond;
        let entry;
        const render = () => {
            const box = UI.el('div');
            const all = FB.FISH.length, got = FB.FISH.filter(f => FB.S.album[f.id]).length;
            box.appendChild(UI.el('div.progress.blue', { html: '<i style="width:' + (got / all * 100) + '%"></i><span>' + FB.t('album_progress', { a: got, b: all }) + '</span>' }));
            box.appendChild(UI.tabs(FB.PONDS.map(p => [p.id, FB.name(p)]), albumPond, (id) => { albumPond = id; UI.refresh(); }));
            const grid = UI.el('div.grid.small');
            FB.fishOfPond(albumPond).forEach(f => {
                const a = FB.S.album[f.id];
                const card = UI.el('div.card.fishcard.rar-' + f.r + (a ? '' : '.unknown'), { html:
                    '<img src="' + FB.fishArt.url(f.id, 110, a ? null : { silhouette: true }) + '" alt="">' +
                    '<div class="nm">' + (a ? U.esc(FB.name(f)) : '???') + '</div>' +
                    '<div class="wt">' + (a ? FB.ic('trophy').replace('class="ic"', 'class="ic" style="width:14px;height:14px;vertical-align:-2px"') + ' ' + U.weight(a.best) : FB.t('r_' + f.r)) + '</div>' });
                card.addEventListener('click', () => { FB.audio.play('click'); PN.fishInfo(f); });
                grid.appendChild(card);
            });
            box.appendChild(grid);
            // Мусор тоже коллекционируется — так смешнее
            const junkGot = FB.JUNK.filter(j => FB.S.junk[j.id]).length;
            box.appendChild(UI.el('div.sec-title', { html: FB.ic('info') + FB.t('junk_collection', { a: junkGot, b: FB.JUNK.length }) }));
            const jg = UI.el('div.grid.small');
            FB.JUNK.forEach(j => {
                const n = FB.S.junk[j.id];
                jg.appendChild(UI.el('div.card.fishcard' + (n ? '' : '.unknown'), { html:
                    '<img src="' + FB.fishArt.url(j.id, 90) + '" alt="" style="' + (n ? '' : 'filter:brightness(0) opacity(.25)') + '">' +
                    '<div class="nm">' + (n ? U.esc(FB.name(j)) : '???') + '</div><div class="wt">' + (n ? '×' + n : '') + '</div>' }));
            });
            box.appendChild(jg);
            return box;
        };
        entry = UI.open({ title: FB.t('nav_album'), body: render(), render, tip: 'album' });
    };

    const depthWord = (d) => {
        const mid = (d[0] + d[1]) / 2;
        return FB.t(mid < 0.35 ? 'depth_near' : mid < 0.65 ? 'depth_mid' : 'depth_far');
    };

    PN.fishInfo = (f) => {
        const a = FB.S.album[f.id];
        const body = UI.el('div');
        const known = !!a;
        const wx = Object.keys(f.wx).filter(k => f.wx[k] > 1);
        const facts = [
            [FB.t('where'), U.esc(FB.name(FB.pondById[f.pond]))],
            [FB.t('bites'), depthWord(f.d)],
            [FB.t('weight_range'), U.weight(f.w[0]) + ' – ' + U.weight(f.w[1])],
            [FB.t('likes_bait'), known ? U.esc(FB.name(FB.baitById[f.bait])) : '???'],
            [FB.t('likes_weather'), known ? (wx.length ? wx.map(w => FB.t('wx_' + w)).join(', ') : FB.t('any_weather')) : '???'],
            [FB.t('character'), known ? FB.t('st_' + (f.st || 'calm')) : '???']
        ];
        if (known) {
            facts.push([FB.t('record'), U.weight(a.best)]);
            facts.push([FB.t('caught_times'), String(a.n)]);
        }
        body.innerHTML = '<div class="fishinfo"><img src="' + FB.fishArt.url(f.id, 240, known ? null : { silhouette: true }) + '" alt="">' +
            '<div><div style="margin-bottom:6px">' + UI.rarityTag(f.r) + '</div>' +
            '<div class="facts">' + facts.map(([k, v]) => '<b>' + k + '</b><span>' + v + '</span>').join('') + '</div></div></div>' +
            (known ? '' : '<p class="muted center">' + FB.t('catch_to_learn') + '</p>');
        UI.open({ title: known ? FB.name(f) : '???', body, width: 'min(96vw, 560px)' });
    };

    // ---------- Профиль ----------
    PN.profile = () => {
        const S = FB.S;
        const body = UI.el('div');
        const name = FB.sdk.playerName() || FB.t('angler');
        const topRow = UI.el('div.prof-top');
        topRow.appendChild(UI.avatar(name, FB.sdk.playerPhoto(), S.look.frame));
        topRow.appendChild(UI.el('div', { html: '<div class="nm">' + U.esc(name) + (S.buy.supporter ? ' ' + FB.ic('heart').replace('class="ic"', 'class="ic" style="width:22px;height:22px;vertical-align:-4px"') : '') + '</div>' +
            '<div class="muted">' + FB.t('lvl_n', { n: S.level }) + ' · ' + FB.t('fame') + ': ' + U.fmt(FB.state.fame()) + '</div>' }));
        body.appendChild(topRow);
        const sc = document.createElement('canvas');
        sc.width = 640; sc.height = 300;
        sc.className = 'pl-scene';
        FB.person.showcase(sc, S.look, S.who);
        body.appendChild(sc);
        body.appendChild(UI.el('div.progress.gold', { html: '<i style="width:' + Math.round(FB.state.levelProgress() * 100) + '%"></i><span>' + FB.t('to_next_level') + '</span>' }));
        const best = S.stats.bestId ? FB.fishById[S.stats.bestId] : null;
        const species = Object.keys(S.album).length;
        const st = [
            [FB.t('st_catches'), U.fmt(S.stats.catches)],
            [FB.t('st_species'), species + ' / ' + FB.FISH.length],
            [FB.t('st_biggest'), best ? U.esc(FB.name(best)) + ', ' + U.weight(S.stats.bestG) : '—'],
            [FB.t('st_total'), U.weight(S.stats.totalG)],
            [FB.t('st_released'), U.fmt(S.stats.released)],
            [FB.t('st_casts'), U.fmt(S.stats.casts)]
        ];
        body.appendChild(UI.el('div.sec-title', { html: FB.ic('star') + FB.t('stats') }));
        body.appendChild(UI.el('div.stats-grid', { html: st.map(([k, v]) => '<div class="stat"><b style="font-size:17px">' + v + '</b><small>' + k + '</small></div>').join('') }));
        body.appendChild(UI.el('div.sec-title', { html: FB.ic('trophy') + FB.t('trophies') }));
        if (S.trophies.length) {
            const colors = { gold: '#ffd23a', silver: '#d6dee6', bronze: '#e8a46a', top20: '#9cd4f4', top100: '#9cd4f4' };
            body.appendChild(UI.el('div.trophies', { html: S.trophies.slice(-24).reverse().map(t =>
                '<div class="trophy">' + FB.ic('medal', colors[t.kind] || '#9cd4f4') + '<div>' + FB.t('place_n', { n: t.rank }) + '</div><div class="muted">' + FB.t('week_n', { n: t.idx - FB.week.index(Date.UTC(2026, 9, 19)) + 1 }) + '</div></div>').join('') }));
        } else body.appendChild(UI.el('p.muted.trophies-empty', { text: FB.t('no_trophies') }));
        UI.open({ title: FB.t('profile'), body, width: 'min(96vw, 560px)', tip: 'profile' });
    };

    // ---------- Профиль игрока из топа ----------
    // d = { name, avatar, rank, me, ex (разобранный extraData) }. Свой профиль — из сохранения
    PN.player = (d) => {
        const S = FB.S;
        const ex = d.me ? FB.tourney.parseExtra(FB.tourney.extra(true)) : d.ex;
        const body = UI.el('div.player');
        const head = UI.el('div.pl-head');
        const ava = UI.avatar(d.name, d.avatar, ex.frame);
        head.appendChild(ava);
        head.appendChild(UI.el('div', { html: '<div class="nm' + (ex.supporter ? ' sup' : '') + '">' + U.esc(d.name || FB.t('hidden_angler')) +
            (ex.supporter ? FB.ic('heart').replace('class="ic"', 'class="ic heart"') : '') + '</div>' +
            (ex.supporter ? '<div class="badge-sup">' + FB.t('supporter_badge') + '</div>' : '') +
            (d.rank ? '<div class="muted">' + FB.t('place_n', { n: d.rank }) + (d.board ? ' · ' + FB.t('lb_' + d.board) : '') + '</div>' : '') }));
        body.appendChild(head);
        // Рыбак в своём наряде
        const c = document.createElement('canvas');
        c.width = 640; c.height = 360;
        c.className = 'pl-scene';
        const look = ex.look || { who: 'boy', look: FB.DEFAULT_LOOK };
        FB.person.showcase(c, Object.assign({}, look.look, { frame: ex.frame }), look.who);
        body.appendChild(c);
        // Что надето
        const worn = ['hat', 'jacket', 'boat', 'pet'].map(k => look.look[k]).filter(id => id && FB.cosById[id] && FB.cosById[id].src !== 'default')
            .concat(ex.frame !== 'fr_none' ? [ex.frame] : []);
        if (worn.length) body.appendChild(UI.el('div.pl-worn', { html: worn.map(id => '<span' + (FB.cosById[id].cost && FB.cosById[id].cost.pearls || ['pass', 'captain', 'starter', 'tourney', 'supporter', 'legend'].includes(FB.cosById[id].src) ? ' class="rare"' : '') + '>' + U.esc(FB.name(FB.cosById[id])) + '</span>').join('') }));
        // Статистика
        const st = ex.stats;
        if (st) {
            const best = st.bestId ? FB.fishById[st.bestId] : null;
            body.appendChild(UI.el('div.stats-grid', { html: [
                [FB.t('lvl'), st.level], [FB.t('st_catches'), U.fmt(st.catches)], [FB.t('st_species'), st.species + ' / ' + FB.FISH.length]
            ].map(([k, v]) => '<div class="stat"><b style="font-size:18px">' + v + '</b><small>' + k + '</small></div>').join('') }));
            if (best) body.appendChild(UI.el('div.pl-best', { html: '<img src="' + FB.fishArt.url(best.id, 110) + '" alt=""><div><div class="k">' + FB.t('aq_record') + '</div><div class="v">' + U.esc(FB.name(best)) + ' · ' + U.weight(st.bestG) + '</div></div>' }));
            if (ex.big) {
                const bf = FB.fishById[ex.big.f];
                body.appendChild(UI.el('div.pl-best.week', { html: '<img src="' + FB.fishArt.url(bf.id, 110) + '" alt=""><div><div class="k">' + FB.t('big_catch') + '</div><div class="v">' + U.esc(FB.name(bf)) + ' · ' + U.weight(ex.big.g) + '</div></div>' }));
            }
        } else body.appendChild(UI.el('p.muted.center', { text: FB.t('pl_no_stats') }));
        UI.open({ title: d.me ? FB.t('profile') : FB.t('pl_title'), body, width: 'min(94vw, 440px)' });
    };

    // ---------- Настройки ----------
    const lastVol = {};   // громкость до выключения значком
    PN.settings = () => {
        const render = () => {
            const S = FB.S;
            const box = UI.el('div');
            // Громкость: ползунок 0–100; нажатие на значок — выключить и вернуть как было
            const slider = (icon, key, label, kind) => {
                const st = S.settings;
                const ic = UI.el('button.vol-ic', { html: FB.ic(icon), title: label, 'aria-label': label });
                const val = UI.el('b.vol-val');
                const input = UI.el('input.vol', { type: 'range', min: '0', max: '100', step: '5', 'aria-label': label });
                input.value = st[key];
                const show = () => {
                    const v = st[key];
                    input.style.setProperty('--v', v + '%');
                    val.textContent = v ? v + '%' : FB.t('vol_off');
                    ic.classList.toggle('off', !v);
                };
                const set = (v, save) => {
                    st[key] = v;
                    st.music = st.musicVol > 0;
                    st.sound = st.soundVol > 0;
                    FB.audio.apply();
                    show();
                    if (save) FB.state.save();
                };
                input.addEventListener('input', () => set(+input.value));
                input.addEventListener('change', () => { set(+input.value, true); if (key === 'soundVol') FB.audio.play('coin'); });
                ic.addEventListener('click', () => {
                    const v = st[key];
                    if (v) lastVol[key] = v;
                    set(v ? 0 : (lastVol[key] || (key === 'musicVol' ? 60 : 80)), true);
                    input.value = st[key];
                    FB.audio.play('click');
                });
                show();
                return UI.el('div.card.set-row.vol-row.' + kind, {}, [ic, UI.el('div.vol-main', {}, [
                    UI.el('div.vol-top', {}, [UI.el('span', { text: label }), val]), input])]);
            };
            box.appendChild(slider('music', 'musicVol', FB.t('set_music'), 'm'));
            box.appendChild(slider('sound', 'soundVol', FB.t('set_sound'), 's'));
            // Тряска камеры: кому-то от неё неуютно — можно выключить
            const sw = UI.el('button.switch' + (S.settings.shake !== false ? '.on' : ''), { 'aria-label': FB.t('set_shake'), onclick: () => {
                S.settings.shake = S.settings.shake === false;
                if (!S.settings.shake) FB.cam.reset();
                FB.state.save();
                FB.audio.play('click');
                if (S.settings.shake) { FB.cam.kick(0.5); FB.cam.punch(0.03); }
                UI.refresh();
            } });
            box.appendChild(UI.el('div.card.set-row', {}, [UI.el('div.l', { html: FB.ic('fish') + '<div>' + FB.t('set_shake') + '<small>' + FB.t('set_shake_sub') + '</small></div>' }), sw]));
            const seg = UI.el('div.seg');
            [['ru', 'Русский'], ['en', 'English']].forEach(([l, n]) => {
                seg.appendChild(UI.el('button' + (FB.lang === l ? '.on' : ''), { text: n, onclick: () => {
                    S.settings.lang = l;
                    FB.state.save();
                    FB.setLang(l);
                    FB.audio.play('click');
                    location.reload();
                } }));
            });
            box.appendChild(UI.el('div.card.set-row', {}, [UI.el('div.l', { html: FB.ic('info') + FB.t('set_lang') }), seg]));
            box.appendChild(UI.el('div.card.set-row', {}, [
                UI.el('div.l', { html: FB.ic('hook') + '<div>' + FB.t('set_tut') + '<small>' + FB.t('set_tut_sub') + '</small></div>' }),
                UI.btn('small blue', FB.t('set_tut_btn'), () => FB.tutor.restart())
            ]));
            if (FB.sdk.ready && !FB.sdk.isAuthorized()) {
                box.appendChild(UI.el('div.card.set-row', {}, [
                    UI.el('div.l', { html: FB.ic('user') + '<div>' + FB.t('login') + '<small>' + FB.t('login_sub') + '</small></div>' }),
                    UI.btn('small blue', FB.t('login_btn'), async () => { if (await FB.sdk.openAuth()) location.reload(); })
                ]));
            }
            box.appendChild(UI.el('p.muted.center', { text: FB.t('version') + ' ' + FB.VERSION, style: 'font-size:13px' }));
            return box;
        };
        UI.open({ title: FB.t('settings'), body: render(), render, width: 'min(96vw, 480px)' });
    };
})(window.FB);
