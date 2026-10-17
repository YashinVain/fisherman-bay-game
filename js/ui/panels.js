// panels.js — окна «Места», «Альбом» (и карточка рыбы), «Профиль», «Настройки».

(function (FB) {
    const PN = FB.panels = {};
    const UI = FB.ui, U = FB.U;

    // ---------- Места ----------
    PN.places = () => {
        const render = () => {
            const cfg = FB.state.weekCfg();
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
                if (p.id === cfg.pond) pic.appendChild(UI.el('div.ribbon', { html: FB.ic('trophy') + FB.t('tourney') }));
                else if (FB.S.pond === p.id) pic.appendChild(UI.el('div.ribbon.green', { html: FB.t('you_here') }));
                if (!open) pic.appendChild(UI.el('div.lockbox', { html: FB.ic('lock') + FB.t('lvl_n', { n: p.unlock }) }));
                card.appendChild(pic);
                card.appendChild(UI.el('div.info', { html:
                    '<div class="nm">' + U.esc(FB.name(p)) + '</div>' +
                    '<div class="cnt">' + FB.ic('fish').replace('class="ic"', 'class="ic" style="width:18px;height:18px"') + FB.t('caught_of', { a: got, b: fish.length }) + '</div>' }));
                card.addEventListener('click', () => {
                    FB.audio.play('click');
                    if (!open) return UI.toast(FB.t('pond_locked', { n: p.unlock }), 'lock');
                    if (FB.S.pond === p.id) return UI.close();
                    PN.goTo(p.id);
                    UI.close();
                });
                grid.appendChild(card);
            });
            const box = UI.el('div', {}, [grid]);
            box.appendChild(UI.el('p.muted.center', { html: FB.t('tourney_open_hint'), style: 'font-size:14px;margin:12px 0 0' }));
            return box;
        };
        UI.open({ title: FB.t('nav_places'), body: render(), render });
    };

    // Переезд на другое место — подходящая пауза для рекламы
    PN.goTo = (id) => {
        FB.S.pond = id;
        FB.state.save();
        FB.fishing.reset();
        FB.scene.setPlace(id, FB.week.weatherAt(id, FB.sdk.now()));
        FB.hud.update();
        UI.toast(FB.name(FB.pondById[id]), 'map');
        FB.sdk.showInterstitial();
    };

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
        entry = UI.open({ title: FB.t('nav_album'), body: render(), render });
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
            [FB.t('likes_weather'), known ? (wx.length ? wx.map(w => FB.t('wx_' + w)).join(', ') : FB.t('any_weather')) : '???']
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
            const colors = { gold: '#ffd23a', silver: '#d6dee6', bronze: '#e8a46a', top100: '#9cd4f4' };
            body.appendChild(UI.el('div.trophies', { html: S.trophies.slice(-24).reverse().map(t =>
                '<div class="trophy">' + FB.ic('medal', colors[t.kind] || '#9cd4f4') + '<div>' + FB.t('place_n', { n: t.rank }) + '</div><div class="muted">' + FB.t('week_n', { n: t.idx - FB.week.index(Date.UTC(2026, 9, 19)) + 1 }) + '</div></div>').join('') }));
        } else body.appendChild(UI.el('p.muted', { text: FB.t('no_trophies') }));
        UI.open({ title: FB.t('profile'), body, width: 'min(96vw, 560px)' });
    };

    // ---------- Настройки ----------
    PN.settings = () => {
        const render = () => {
            const S = FB.S;
            const box = UI.el('div');
            const toggle = (icon, key, label, sub) => {
                const sw = UI.el('button.switch' + (S.settings[key] ? '.on' : ''), { onclick: () => {
                    S.settings[key] = !S.settings[key];
                    FB.audio.apply();
                    FB.state.save();
                    FB.audio.play('click');
                    UI.refresh();
                } });
                return UI.el('div.card.set-row', {}, [UI.el('div.l', { html: FB.ic(icon) + '<div>' + label + (sub ? '<small>' + sub + '</small>' : '') + '</div>' }), sw]);
            };
            box.appendChild(toggle('sound', 'sound', FB.t('set_sound')));
            box.appendChild(toggle('music', 'music', FB.t('set_music')));
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
