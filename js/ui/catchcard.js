// catchcard.js — окна после рыбалки: карточка улова, «рыба сорвалась»,
// новый уровень, итоги прошлого турнира. Окна-поздравления встают в очередь
// и показываются, когда закрыто текущее окно.

(function (FB) {
    const CC = FB.catchCard = {};
    const UI = FB.ui, U = FB.U;
    let catchesSinceAd = 0;

    // ---------- Очередь поздравлений ----------
    const queue = [];
    CC.later = (fn) => { queue.push(fn); CC.flush(); };
    CC.flush = () => {
        if (UI.isOpen() || !queue.length || FB.fishing.phase === 'land') return;
        queue.shift()();
    };
    FB.on('modal', (open) => { if (!open) setTimeout(CC.flush, 250); });

    // Что игрок получит — считаем заранее, чтобы показать на кнопках
    function preview(res, ctx) {
        const f = res.fish, g = res.g;
        const cfg = FB.state.weekCfg();
        const inTourney = ctx.pond === cfg.pond;
        const isWeekFish = inTourney && f.id === cfg.fish;
        const pts = FB.catcher.points(f, g, isWeekFish);
        const base = FB.catcher.points(f, g, false);
        const a = FB.S.album[f.id];
        const coins = Math.round(base * 0.8 + 2), xp = Math.round(base * 0.6 + 4);
        const isNew = !a || a.n === 0;
        let weekGain = 0, weekMin = 0;
        if (inTourney) {
            FB.state.syncWeek();
            weekGain = FB.week.sum(FB.week.addCatch(FB.S.week.best, pts)) - FB.state.weekScore();
            weekMin = FB.S.week.best.length ? Math.min.apply(null, FB.S.week.best) : 0;
        }
        return {
            pts, isWeekFish, inTourney, weekGain, weekMin, isNew,
            record: !isNew && g > a.best,
            keep: { coins, xp: xp + (isNew ? 20 : 0) },
            release: { coins: Math.round(coins * 0.5), xp: Math.round(xp * 1.6) + (isNew ? 20 : 0) }
        };
    }

    CC.show = (res, ctx) => {
        if (res.kind === 'junk') return showJunk(res, ctx);
        const f = res.fish;
        const R = FB.RARITY[f.r];
        const pv = preview(res, ctx);
        FB.audio.play('catch', R.order);
        const body = UI.el('div');
        body.style.position = 'relative';
        body.innerHTML =
            '<div class="rays" style="--rc:' + U.rgba(R.glow || R.color, R.order >= 2 ? 0.9 : 0.5) + '"></div>' +
            '<div class="pic"><img src="' + FB.fishArt.url(f.id, 260) + '" alt=""></div>' +
            '<div style="position:relative;z-index:1">' + UI.rarityTag(f.r) + '</div>' +
            '<div class="nm">' + U.esc(FB.name(f)) + '</div>' +
            '<div class="flags">' +
            (pv.isNew ? '<span class="flag new" style="animation-delay:.3s">' + FB.t('new_species') + '</span>' : '') +
            (pv.record ? '<span class="flag rec" style="animation-delay:.4s">' + FB.t('new_record') + '</span>' : '') +
            (pv.isWeekFish ? '<span class="flag week" style="animation-delay:.5s">' + FB.t('week_fish_x2') + '</span>' : '') +
            (pv.inTourney && pv.weekGain > 0 ? '<span class="flag tour" style="animation-delay:.6s">' + FB.t('tourney_plus', { n: pv.weekGain }) + '</span>' : '') +
            (pv.inTourney && pv.weekGain <= 0 ? '<span class="flag miss" style="animation-delay:.6s">' + FB.t('tourney_miss', { n: U.fmt(pv.weekMin) }) + '</span>' : '') +
            '</div>' +
            '<div class="stats">' +
            '<div class="stat"><b>' + U.weight(res.g) + '</b><small>' + FB.t('weight') + '</small></div>' +
            '<div class="stat"><b>' + U.fmt(pv.pts) + '</b><small>' + FB.t('points') + '</small></div>' +
            '</div>';
        const choice = UI.el('div.choice');
        const finish = (keep, doubled) => {
            const out = FB.state.applyCatch(res, ctx, keep);
            if (doubled && out.coins) FB.state.addCoins(out.coins);
            const r = entry.sheet.getBoundingClientRect();
            const cx = r.left + r.width / 2, cy = r.top + r.height * 0.35;
            if (out.coins) UI.fly('coin', cx, cy, Math.round(out.coins / 10));
            UI.floater(cx, cy - 40, '+' + out.xp + ' ' + FB.t('xp'), 'var(--sea-d)');
            const SC = FB.scene;
            if (keep) SC.burst(SC.W / 2, SC.H * 0.45, FB.S.look.effect);
            else {
                const p = SC.project(0.05, 0.08);
                SC.splash(p.x, p.y, 1.1);
                FB.audio.play('splash');
                UI.toast(FB.t('released_toast'), 'heart');
            }
            if (out.newSpecies) UI.toast(FB.t('album_added'), 'album');
            FB.hud.update();
            UI.close();
        };
        choice.appendChild(UI.btn('', FB.t('keep') + '<span class="sub">+' + pv.keep.coins + ' ' + FB.t('coins_short') + ' · +' + pv.keep.xp + ' ' + FB.t('xp') + '</span>', () => finish(true)));
        choice.appendChild(UI.btn('blue', FB.t('release') + '<span class="sub">+' + pv.release.coins + ' ' + FB.t('coins_short') + ' · +' + pv.release.xp + ' ' + FB.t('xp') + '</span>', () => finish(false)));
        // Первый улов на уроке: объясняем выбор прямо в карточке
        if (FB.tutor.inLesson()) body.appendChild(UI.el('div.coach-note', { html: FB.ic('info') + '<span>' + FB.tutor.nb(FB.t('tut_card')) + '</span>' }));
        body.appendChild(choice);
        if (FB.sdk.adsAvailable()) {
            const ad = UI.el('button.adlink', { html: FB.ic('video') + FB.t('keep_x2', { n: pv.keep.coins * 2 }), onclick: async () => {
                FB.audio.play('click');
                const r = await FB.sdk.showRewarded(() => {});
                if (r === 'rewarded') finish(true, true);
                else UI.toast(FB.t('ad_failed'), 'info');
            } });
            const wrap = UI.el('div', { style: 'position:relative;z-index:1' }, [ad]);
            body.appendChild(wrap);
        }
        const entry = UI.open({ body, noClose: true, cls: 'catch', onClose: afterCard });
        if (R.order >= 3) FB.scene.sparkle(FB.scene.W / 2, FB.scene.H * 0.3, 30, R.glow);
    };

    function showJunk(res, ctx) {
        const j = res.junk;
        FB.audio.play('junk');
        const body = UI.el('div');
        body.style.position = 'relative';
        body.innerHTML =
            '<div class="pic"><img src="' + FB.fishArt.url(j.id, 200) + '" alt=""></div>' +
            '<div class="nm">' + U.esc(FB.name(j)) + '</div>' +
            '<p class="muted">' + FB.t('junk_' + j.id) + '</p>';
        const choice = UI.el('div.choice');
        choice.appendChild(UI.btn('yellow', FB.t('ok') + ' <span class="price">+' + FB.ic('coin') + (j.coins || 2) + '</span>', () => {
            const out = FB.state.applyCatch(res, ctx, true);
            const r = entry.sheet.getBoundingClientRect();
            UI.fly('coin', r.left + r.width / 2, r.top + r.height * 0.3, Math.max(3, Math.round(out.coins / 15)));
            FB.hud.update();
            UI.close();
        }));
        body.appendChild(choice);
        const entry = UI.open({ body, noClose: true, cls: 'catch', onClose: afterCard });
    }

    function afterCard() {
        FB.fishing.done();
        catchesSinceAd++;
        FB.tutor.afterCatch();
        // Межстраничная реклама — только здесь, в спокойной паузе между уловами
        if (catchesSinceAd >= 5) {
            FB.sdk.showInterstitial().then(shown => { if (shown) catchesSinceAd = 0; });
        }
    }

    // ---------- Рыба сорвалась ----------
    CC.lost = ({ reason, res }) => {
        const rare = res && res.kind === 'fish' && FB.RARITY[res.fish.r].order >= 2;
        if ((reason === 'snap' || reason === 'slack') && rare && FB.sdk.adsAvailable()) {
            const f = res.fish;
            const body = UI.el('div.center');
            body.innerHTML =
                '<div class="pic" style="height:150px;display:flex;align-items:center;justify-content:center"><img style="max-height:150px;max-width:90%;opacity:.9" src="' + FB.fishArt.url(f.id, 200) + '" alt=""></div>' +
                '<p style="font-size:18px">' + FB.t('lost_' + reason) + '</p>' +
                '<p class="muted">' + FB.t('lost_rescue', { name: FB.name(f) }) + '</p>';
            const row = UI.el('div.choice');
            row.appendChild(UI.btn('violet', FB.ic('video') + FB.t('rescue'), async () => {
                const r = await FB.sdk.showRewarded(() => {});
                UI.close();
                if (r === 'rewarded') FB.fishing.restore();
            }));
            row.appendChild(UI.btn('grey', FB.t('no_thanks'), () => UI.close()));
            body.appendChild(row);
            UI.open({ title: FB.t('oh_no'), body, noClose: true, width: 'min(94vw, 440px)' });
        } else {
            UI.toast(FB.t('lost_' + reason), reason === 'early' ? 'info' : 'fish', 1800);
        }
    };

    // ---------- Новый уровень ----------
    // Окно небольшое: звезда с номером, подарок за уровень, что открылось
    // (или что откроется дальше, если сейчас ничего)
    CC.levelUp = ({ level, ponds, reward }) => {
        CC.later(() => {
            FB.audio.play('level');
            const body = UI.el('div.congrats.lvlup');
            const opened = [];
            ponds.forEach(p => opened.push(['map', FB.name(p), FB.t('kind_pond')]));
            FB.RODS.filter(r => r.level === level).forEach(r => opened.push(['rod', FB.name(r), FB.t('kind_rod')]));
            FB.BAITS.filter(b => b.level === level).forEach(b => opened.push([b.icon, FB.name(b), FB.t('kind_bait')]));
            const item = ([ic, name, kind]) => '<div class="lv-item">' + FB.ic(ic) + '<div><b>' + U.esc(name) + '</b><small>' + kind + '</small></div></div>';
            let html = '<div class="lv-star">' + FB.ic('star') + '<span class="outline">' + level + '</span></div>' +
                '<p class="lv-title">' + FB.t('level_up') + '</p>';
            const gift = [];
            if (reward && reward.coins) gift.push(UI.price({ coins: reward.coins }));
            if (reward && reward.pearls) gift.push(UI.price({ pearls: reward.pearls }));
            if (gift.length) html += '<div class="lv-sec">' + FB.t('level_reward') + '</div><div class="lv-gift">' + gift.join('') + '</div>';
            if (opened.length) {
                html += '<div class="lv-sec">' + FB.t('unlocked') + '</div><div class="lv-items">' + opened.map(item).join('') + '</div>';
            } else {
                const nx = FB.state.nextUnlock();
                if (nx) html += '<div class="lv-next">' + FB.t('next_unlock', { name: U.esc(FB.name(nx.item)), n: nx.lvl }) + '</div>';
            }
            body.innerHTML = html;
            body.appendChild(UI.btn('', FB.t('hooray'), () => UI.close()));
            const entry = UI.open({ body, noClose: true, title: FB.t('new_level'), gold: true, width: 'min(92vw, 380px)' });
            if (reward && reward.coins) {
                const r = entry.sheet.getBoundingClientRect();
                setTimeout(() => UI.fly('coin', r.left + r.width / 2, r.top + r.height * 0.45, 6), 450);
            }
            FB.hud.update();
            FB.scene.burst(FB.scene.W / 2, FB.scene.H * 0.35, 'fx_confetti');
        });
    };

    // ---------- Итоги прошлой недели ----------
    CC.weekResult = (r) => {
        CC.later(() => {
            const rw = r.reward;
            const body = UI.el('div.congrats');
            const medal = r.rank === 1 ? '#ffd23a' : r.rank && r.rank <= 3 ? '#d6dee6' : r.rank && r.rank <= 10 ? '#e8a46a' : '#9cd4f4';
            body.innerHTML = FB.ic('medal', medal).replace('class="ic"', 'class="ic hero"') +
                (r.rank ? '<div class="big outline">' + FB.t('place_n', { n: r.rank }) + '</div>' : '<div class="big outline" style="font-size:40px">' + FB.t('thanks_member') + '</div>') +
                '<p>' + FB.t('week_points', { n: U.fmt(r.pts) }) + '</p>' +
                '<p class="muted">' + FB.t('your_reward') + '</p>' +
                '<div class="unlock-list">' +
                (rw.coins ? '<div>' + UI.price({ coins: rw.coins }) + '</div>' : '') +
                (rw.pearls ? '<div>' + UI.price({ pearls: rw.pearls }) + '</div>' : '') +
                rw.items.map(id => '<div>' + U.esc(FB.name(FB.cosById[id])) + '</div>').join('') + '</div>';
            body.appendChild(UI.btn('big yellow', FB.t('great'), () => { UI.close(); FB.hud.update(); }));
            UI.open({ body, noClose: true, title: FB.t('tourney_results'), gold: true, width: 'min(92vw, 420px)' });
            if (r.rank && r.rank <= 10) FB.scene.burst(FB.scene.W / 2, FB.scene.H * 0.35, 'fx_confetti');
        });
    };
})(window.FB);
