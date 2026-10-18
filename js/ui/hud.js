// hud.js — то, что видно поверх рыбалки: уровень, монеты, жемчуг, плашка
// турнира, нижние кнопки, наживка, подсказки, полоска вываживания и титульный экран.

(function (FB) {
    const H = FB.hud = {};
    const UI = FB.ui, U = FB.U;
    let els = {};

    // ---------- Титульный экран ----------
    H.showTitle = (onPlay) => {
        const cfg = FB.state.weekCfg();
        const fish = FB.fishById[cfg.fish];
        const title = UI.el('div.title', {}, [
            UI.el('div.logo', { html:
                '<img class="logo-fish" src="' + FB.fishArt.url('goldcarp', 140) + '" alt="">' +
                '<span class="logo-top">' + FB.t('logo_top') + '</span>' +
                '<span class="logo-big" data-t="' + FB.t('logo_big') + '">' + FB.t('logo_big') + '</span>' }),
            UI.el('div.mid', {}, [
                UI.el('div.week-card', { html:
                    '<img src="' + FB.fishArt.url(fish.id, 90) + '" alt="">' +
                    '<div><div class="k">' + FB.t('week_tourney') + ' · ' + U.duration(FB.week.end(cfg.idx) - FB.sdk.now()) + '</div>' +
                    '<div class="v">' + U.esc(FB.name(FB.pondById[cfg.pond])) + '</div>' +
                    '<div class="v">' + FB.t('fish_of_week') + ': <b style="color:var(--sun)">' + U.esc(FB.name(fish)) + ' ×2</b></div></div>' })
            ]),
            UI.el('div.btns', {}, [
                UI.btn('big pulse', FB.ic('play') + FB.t('play'), () => {
                    title.classList.add('out');
                    setTimeout(() => title.remove(), 500);
                    onPlay();
                }),
                UI.el('div.row', {}, [
                    UI.btn('blue small', FB.ic('trophy') + FB.t('nav_top'), () => FB.top.open()),
                    UI.el('button.round', { html: FB.ic('gear'), onclick: () => { FB.audio.play('click'); FB.panels.settings(); } })
                ])
            ])
        ]);
        UI.root().appendChild(title);
    };

    // ---------- Основной интерфейс ----------
    H.build = () => {
        const root = UI.root();
        const top = UI.el('div.hud-top');
        els.lvl = UI.el('button.lvl', { onclick: () => { FB.audio.play('click'); FB.panels.profile(); } });
        els.coins = UI.el('div.pill.coins');
        els.pearls = UI.el('button.pill.pearls', { onclick: () => { FB.audio.play('click'); FB.shopUI.open('pearls'); } });
        els.streak = UI.el('button.pill.streak.hidden', { onclick: () => { FB.audio.play('click'); UI.toast(FB.t('streak_info', { n: FB.S.luck, p: Math.round((FB.state.streakMul() - 1) * 100) }), 'sparkle', 3500); } });
        const pills = UI.el('div.pills', {}, [els.coins, els.pearls, els.streak]);
        els.aqua = UI.el('button.round.aqua-btn', { title: FB.t('aqua'), html: FB.ic('tank'), onclick: () => { FB.audio.play('click'); FB.aquaUI.open(); } });
        const right = UI.el('div.hud-right', {}, [els.aqua, UI.el('button.round', { html: FB.ic('gear'), onclick: () => { FB.audio.play('click'); FB.panels.settings(); } })]);
        top.append(els.lvl, pills, right);

        els.chip = UI.el('button.tourney-chip', { onclick: () => { FB.audio.play('click'); FB.top.open('week'); } });
        els.frenzy = UI.el('div.frenzy.hidden');

        els.nav = UI.el('div.nav');
        const nav = [
            ['places', 'map', () => FB.panels.places()],
            ['album', 'album', () => FB.panels.album()],
            ['top', 'trophy', () => FB.top.open()],
            ['shop', 'shop', () => FB.shopUI.open()],
            ['tasks', 'tasks', () => FB.tasks.open()]
        ];
        els.navBtn = {};
        nav.forEach(([id, icon, fn]) => {
            const b = UI.el('button.nb-' + id, { title: FB.t('nav_' + id), html: FB.ic(icon) + '<span>' + FB.t('nav_' + id) + '</span>', onclick: () => { FB.audio.play('click'); fn(); } });
            els.navBtn[id] = b;
            els.nav.appendChild(b);
        });

        els.bait = UI.el('button.bait-chip', { onclick: () => { FB.audio.play('click'); H.baitPicker(); } });
        // Особенность места: короткая плашка, нажатие — объяснение
        els.place = UI.el('button.place-chip', { onclick: () => {
            FB.audio.play('click');
            const f = FB.places.feature();
            if (f) UI.toast(FB.t('pld_' + f), 'sparkle', 4500);
        } });
        els.hint = UI.el('div.hint.soft');
        els.fight = buildFight();

        root.append(top, els.chip, els.frenzy, els.nav, els.bait, els.place, els.hint, els.fight);
        els.pills = pills; els.right = right;
        FB.sonar.mount(root);
        window.addEventListener('resize', placeChip);
        H.update();
    };

    // Панель вываживания: шкала лески (красное — зелёное — красное) и путь рыбы к крючку.
    // Ширина зелёной зоны своя у каждой рыбы — выставляется в начале вываживания
    function buildFight() {
        const f = UI.el('div.fight.away');
        f.innerHTML =
            '<div class="row"><div class="lab">' + FB.t('tension') + '</div><div class="meter"><i class="zone z-left"></i><i class="zone z-good"></i><i class="zone z-right"></i><i class="needle"></i></div></div>' +
            '<div class="row"><div class="lab">' + FB.t('distance') + '</div><div class="track"><i class="fill"></i><span class="fishmark">' + FB.ic('fish') + '</span><span class="goal">' + FB.ic('hook') + '</span></div></div>';
        return f;
    }
    function setZone(info) {
        const m = els.fight.querySelector('.meter');
        if (m.dataset.lo === String(info.lo)) return;
        m.dataset.lo = info.lo;
        m.querySelector('.z-left').style.width = (info.lo * 100) + '%';
        const g = m.querySelector('.z-good');
        g.style.left = (info.lo * 100) + '%';
        g.style.width = ((info.hi - info.lo) * 100) + '%';
        m.querySelector('.z-right').style.width = ((1 - info.hi) * 100) + '%';
    }

    // Обновить цифры и плашки (зовётся при изменениях)
    H.update = () => {
        if (!els.lvl) return;
        const S = FB.S;
        els.lvl.style.setProperty('--p', Math.round(FB.state.levelProgress() * 100));
        els.lvl.innerHTML = '<b>' + S.level + '</b><small>' + FB.t('lvl') + '</small>';
        els.coins.innerHTML = FB.ic('coin') + U.fmt(S.coins);
        els.pearls.innerHTML = FB.ic('pearl') + U.fmt(S.pearls) + '<span class="plus">+</span>';
        const lk = S.luck || 0;
        els.streak.classList.toggle('hidden', lk < 2);
        els.streak.innerHTML = flame() + '<b>' + lk + '</b><small>+' + Math.round((FB.state.streakMul() - 1) * 100) + '%</small>';
        const bait = FB.baitById[S.bait];
        els.bait.innerHTML = FB.ic(bait.icon) + '<span>' + U.esc(FB.name(bait)) + '</span>';
        H.updateChip();
        placeChip();
        const n = FB.quests.badge();
        setBadge(els.navBtn.tasks, n);
        setBadge(els.aqua, FB.aqua.canCollect() ? 1 : 0);
        setBadge(els.navBtn.shop, FB.S.buy.starter ? 0 : (FB.S.stats.catches >= 5 && !H.seenStarter ? 1 : 0));
    };
    function setBadge(btn, n) {
        let b = btn.querySelector('.badge');
        if (n > 0) {
            if (!b) { b = UI.el('span.badge'); btn.appendChild(b); }
            b.textContent = n;
        } else if (b) b.remove();
    }

    // Плашка турнира поднимается в верхнюю строку, если там хватает места
    // между счётчиками и кнопками справа
    function placeChip() {
        const c = els.chip;
        if (!c || !els.pills) return;
        let left = 0;
        [...els.pills.children].forEach(p => { if (!p.classList.contains('hidden')) left = Math.max(left, p.getBoundingClientRect().right); });
        const right = els.right.getBoundingClientRect().left;
        const w = c.offsetWidth, mid = innerWidth / 2;
        const up = w > 0 && mid - w / 2 >= left + 14 && mid + w / 2 <= right - 14;
        c.classList.toggle('up', up);
        document.body.classList.toggle('chip-up', up);
    }

    // Плашка турнира: где и какая рыба недели, а в месте турнира — мои очки
    H.updateChip = () => {
        if (!els.chip) return;
        const cfg = FB.state.weekCfg();
        const fish = FB.fishById[cfg.fish];
        const here = FB.S.pond === cfg.pond;
        els.chip.classList.toggle('here', here);
        const left = FB.t('time_left', { t: U.duration(FB.week.end(cfg.idx) - FB.sdk.now()) });
        els.chip.innerHTML = FB.ic('trophy') + '<span><span class="t1">' + (here ? FB.t('you_in_tourney') : FB.t('week_tourney')) + ' · ' + left + '</span>' +
            '<span class="t2">' + (here
                ? FB.t('my_score') + ': <b>' + U.fmt(FB.state.weekScore()) + '</b> · ' + U.esc(FB.name(fish)) + ' ×2'
                : U.esc(FB.name(FB.pondById[cfg.pond])) + ' · ' + U.esc(FB.name(fish)) + ' ×2') + '</span></span>' +
            '<span class="fishw"><img src="' + FB.fishArt.url(fish.id, 60) + '" alt=""></span>';
        placeChip();
    };

    // ---------- Подсказки ----------
    let hintKey = null;
    H.hint = (key) => {
        hintKey = key;
        if (!els.hint) return;
        // Во время обучения говорит подсказчик (tutor.js), а не эта строка
        const show = key && !FB.tutor.active() && (key === 'tap_now' || key === 'wait_bite' || key === 'spin');
        els.hint.className = 'hint' + (key === 'tap_now' ? ' big' : '') + (show ? '' : ' soft');
        if (key) els.hint.textContent = FB.t('hint_' + key);
        if (key === 'hold_reel') els.hint.className = 'hint soft';
    };

    // Огонёк серии удачи
    const flame = () => '<svg class="ic" viewBox="0 0 48 48"><path d="M24 4c3 8 13 12 13 25a13 13 0 01-26 0c0-6 3-10 6-13 0 5 2 8 5 8-2-7 0-14 2-20z" fill="#ff8a2a" stroke="#2a3550" stroke-width="2.6" stroke-linejoin="round"/><path d="M24 22c2 4 6 6 6 12a6 6 0 01-12 0c0-3 2-5 3-6 0 2 1 3 2 3-1-3 0-6 1-9z" fill="#ffd23a"/></svg>';
    const PLACE_IC = { ducks: 'sparkle', current: 'swap', shadows: 'fish', wisp: 'star', school: 'fish', tide: 'clock' };

    // ---------- Каждый кадр ----------
    let lastT = 0;
    H.frame = () => {
        if (!els.nav) return;
        const F = FB.fishing;
        const now = performance.now(), dt = Math.min(0.05, (now - (lastT || now)) / 1000);
        lastT = now;
        FB.sonar.frame(dt);
        const calm = F.phase === 'idle' || F.phase === 'lost';
        els.nav.classList.toggle('away', !calm);
        els.bait.classList.toggle('away', !calm);
        const fz = FB.events.frenzyOn();
        els.frenzy.classList.toggle('hidden', !fz);
        document.body.classList.toggle('frenzy-on', fz);
        if (fz) {
            const left = Math.ceil(FB.events.frenzyLeft());
            const html = FB.ic('fish') + '<span><b>' + FB.t('frenzy') + '</b> ' + FB.t('frenzy_sub') + ' · 0:' + String(left).padStart(2, '0') + '</span>';
            if (els.frenzy.dataset.h !== html) { els.frenzy.innerHTML = html; els.frenzy.dataset.h = html; }
        }
        const pc = FB.places.chip();
        els.place.classList.toggle('away', !calm || !pc);
        if (pc) {
            const html = FB.ic(PLACE_IC[pc.f] || 'sparkle') + '<span>' + U.esc(pc.text) + '</span>';
            if (els.place.dataset.h !== html) { els.place.innerHTML = html; els.place.dataset.h = html; }
            els.place.classList.toggle('hot', !!pc.hot);
        }
        // Плашка турнира не прыгает после каждого улова: во время вываживания только притухает
        els.chip.classList.toggle('dim', !calm);
        const info = F.fightInfo();
        els.fight.classList.toggle('away', !info);
        if (info) {
            setZone(info);
            const m = els.fight.querySelector('.meter');
            m.querySelector('.needle').style.left = (U.clamp(info.tension, 0, 1) * 100) + '%';
            // Стрелка в красной — эта сторона мигает тем чаще, чем ближе срыв
            const hotL = info.tension < info.lo, hotR = info.tension > info.hi;
            m.classList.toggle('hot-l', hotL);
            m.classList.toggle('hot-r', hotR);
            m.classList.toggle('good', !hotL && !hotR);
            m.classList.toggle('shake', hotR && info.strain > 0.45);
            m.style.setProperty('--danger', (hotR ? info.strain : hotL ? info.slack : 0).toFixed(2));
            const p = U.clamp(info.progress, 0, 1);
            els.fight.querySelector('.fishmark').style.left = 'calc(' + (p * 100) + '% - ' + (p * 30) + 'px)';
            els.fight.querySelector('.fill').style.width = 'calc(' + (p * 100) + '% - ' + (p * 30) + 'px)';
        }
    };

    // ---------- Выбор наживки ----------
    H.baitPicker = () => {
        const render = () => {
            const box = UI.el('div');
            box.appendChild(UI.el('p.muted.center', { text: FB.t('bait_hint') }));
            const grid = UI.el('div.grid.small');
            FB.BAITS.forEach(b => {
                const owned = FB.S.baits.includes(b.id);
                const on = FB.S.bait === b.id;
                const likes = FB.FISH.filter(f => f.bait === b.id && FB.S.album[f.id]).length;
                const card = UI.el('div.card.item' + (on ? '.on' : ''), { html:
                    '<div class="prev">' + FB.ic(b.icon) + '</div><div class="nm">' + U.esc(FB.name(b)) + '</div>' +
                    '<div class="mode">' + FB.t('mode_' + (b.mode || 'float')) + '</div>' +
                    '<div class="src">' + FB.t('bait_likes', { n: likes }) + '</div>' });
                if (owned) card.appendChild(UI.btn(on ? 'small grey' : 'small', on ? FB.t('equipped') : FB.t('take'), () => { FB.S.bait = b.id; FB.state.save(); H.update(); UI.close(); }));
                else if (FB.S.level < b.level) card.appendChild(UI.btn('small grey off', FB.ic('lock') + FB.t('lvl_n', { n: b.level }), null));
                else card.appendChild(UI.btn('small yellow', UI.price({ coins: b.price }), () => {
                    if (FB.shop.buyBait(b.id)) { FB.audio.play('coin'); H.update(); UI.refresh(); }
                    else UI.toast(FB.t('not_enough'), 'coin');
                }));
                grid.appendChild(card);
            });
            box.appendChild(grid);
            return box;
        };
        UI.open({ title: FB.t('bait'), body: render(), render, width: 'min(96vw, 520px)' });
    };
})(window.FB);
