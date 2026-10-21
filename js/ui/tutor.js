// tutor.js — обучение. Обязательный только урок рыбалки: привет и выбор рыбака →
// заброс → поплавок → подсечка → вываживание → улов. Всё остальное подсказчик
// объясняет тогда, когда игрок впервые до этого добирается: первый раз зашёл
// в топ — рассказываем про топ, в задания — про задания, получил уровень —
// про уровень. Каждая подсказка показывается один раз (S.tips).
//
// Шаг урока лежит в сохранении (S.tut). Внутри урока шаг не храним — его
// видно по фазе рыбалки. Перезагрузил страницу посреди урока — начнём с заброса.
// Во время урока рыбу нельзя упустить: поклёвка ждёт, леска не рвётся.

(function (FB) {
    const TU = FB.tutor = {};
    const UI = FB.ui, U = FB.U;

    // Номера лежат в сохранениях — не менять
    const STEP = TU.STEP = { hello: 0, lesson: 1, done: 99 };

    // Подсказки «при первой встрече». where: 'main' — на экране рыбалки (когда всё
    // спокойно и выполнено cond), иначе — ключ окна (opt.tip у UI.open).
    // Тексты: tut_<id>_t — заголовок, tut_<id> — текст
    const TIPS = [
        { id: 'chip', where: 'main', target: '.tourney-chip', wide: true, cond: (S) => S.stats.catches >= 1 },
        { id: 'profile', where: 'main', target: '.lvl', cond: (S) => S.level >= 2 },
        { id: 'bait', where: 'main', target: '.bait-chip', cond: (S) => S.stats.catches >= 4 },
        { id: 'places', where: 'places', target: '.sheet .card.place.cur' },
        { id: 'album', where: 'album', target: '.sheet .card.fishcard' },
        { id: 'top', where: 'top', target: '.sheet .tabs' },
        { id: 'shop', where: 'shop-gear', target: '.sheet .tabs' },
        { id: 'rods', where: 'shop-gear', target: () => document.querySelectorAll('.sheet .rodcard')[1] },
        { id: 'look', where: 'shop-look', target: '.sheet .grid' },
        { id: 'baits', where: 'shop-bait', target: '.sheet .bait-grid' },
        { id: 'gift', where: 'tasks-daily', target: '.sheet .gift-row' },
        { id: 'quests', where: 'tasks-daily', target: '.sheet .card.quest' },
        { id: 'season', where: 'tasks-season', target: '.sheet .season-card .sc-head' },
        { id: 'tiers', where: 'tasks-season', target: '.sheet .tiers' },
        { id: 'medals', where: 'profile', target: '.sheet .trophies, .sheet .trophies-empty' },
        { id: 'aqua_btn', where: 'main', target: '.hud-right .aqua-btn', cond: (S) => Object.keys(S.album).length >= 3 },
        { id: 'aqua', where: 'aqua', target: '.sheet .aq-tank' },
        { id: 'arena', where: 'main', target: '.tourney-chip', wide: true, cond: (S) => S.pond === 'arena' }
    ];
    // Особенность каждого места — когда игрок впервые там рыбачит
    Object.keys({ village: 1, river: 1, mountain: 1, swamp: 1, pier: 1, lagoon: 1 }).forEach(pond => {
        const f = FB.places.FEATURES[pond];
        TIPS.push({ id: 'pl_' + f, where: 'main', target: '.place-chip', cond: (S) => S.pond === pond && S.stats.catches >= (pond === 'village' ? 3 : 0) });
    });
    TU.TIPS = TIPS;

    let layer, hole, hand, box, tail;
    let shown = null;          // ключ того, что сейчас на экране
    let since = 0;             // сколько секунд он показан
    let blocking = false;      // игра стоит, пока игрок читает
    let fightIntro = false;    // объяснение вываживания уже прочитано
    let nibbled = false;       // поплавок уже дёргался в этом забросе
    let earlyT = 0;            // сколько ещё висит «рано!»
    let freeT = 0;             // сколько игрок не держит палец во время вываживания
    let calmT = 0;             // сколько всё спокойно (подсказки на экране — не сразу)
    let tip = null;            // подсказка про пузыри { spot, t }
    let shownV = null;         // то, что сейчас на экране (для «липких» подсказок)
    let scrolledFor = null;    // к какой подсказке уже прокрутили окно

    TU.active = () => !!FB.S && FB.S.tut < STEP.done;
    TU.inLesson = () => !!FB.S && FB.S.tut === STEP.lesson;
    TU.blocking = () => blocking;

    TU.init = () => {
        if (layer) return;
        layer = UI.el('div.coach-layer');
        hole = UI.el('div.coach-hole.hidden');
        hand = UI.el('div.coach-hand.hidden', { html: '<i></i>' + handSvg() });
        box = UI.el('div.coach.hidden');
        layer.append(hole, hand, box);
        UI.root().appendChild(layer);
        FB.on('cast', () => { nibbled = false; earlyT = 0; });
        FB.on('nibble', () => { nibbled = true; });
        FB.on('tutEarly', () => { earlyT = 1.8; });
        // Старые сохранения (была экскурсия 2…13) — урок уже пройден
        const t = FB.S.tut;
        if (t > STEP.lesson && t < STEP.done) FB.S.tut = STEP.done;
        else if (t !== STEP.hello && t !== STEP.lesson && t !== STEP.done) FB.S.tut = STEP.lesson;
        FB.S.tips = FB.S.tips || {};
    };

    function go(step) {
        FB.S.tut = step;
        FB.state.save();
        if (step === STEP.done) {
            UI.toast(FB.t('tut_end'), 'fish', 2400);
            FB.hud.hint(null);
        }
    }

    // После карточки первого улова урок закончен — дальше подсказки по ходу игры
    TU.afterCatch = () => {
        if (FB.S.tut !== STEP.lesson) return;
        go(STEP.done);
    };

    // «Пройти обучение ещё раз» из настроек: урок и все подсказки заново
    TU.restart = () => {
        UI.closeAll();
        FB.fishing.reset();
        fightIntro = false;
        FB.S.tips = {};
        go(STEP.hello);
    };

    function seen(id) {
        FB.S.tips[id] = 1;
        FB.state.save();
    }

    // Куда показывать первый заброс: правее рыбака и поближе к нам — чтобы
    // поплавок был крупным, а пузырь с подсказкой не закрывал удочку
    TU.castPoint = () => {
        const SC = FB.scene, L = SC.L, F = FB.fishing, o = F.origin(), reach = FB.state.rodObj().reach;
        const x = L.px + (SC.W - L.px) * 0.5;
        const y = L.hy + (L.nearY - L.hy) * (L.portrait ? 0.36 : 0.42);
        let w = SC.unproject(x, y) || { tx: 0.2, dist: 0.3 };
        const e = F.reachOf(w.tx, w.dist, o);
        if (e > reach * 0.85) {
            const k = reach * 0.85 / e;
            w = { tx: o.tx + (w.tx - o.tx) * k, dist: o.dist + (w.dist - o.dist) * k };
        }
        return SC.project(w.tx, w.dist);
    };

    // ---------- Что показать сейчас ----------
    function view() {
        const S = FB.S, F = FB.fishing, SC = FB.scene;
        if (S.tut >= STEP.done) return fightTipView() || tipsView() || driftView() || placeView() || bubblesView();
        if (UI.isOpen()) return null;

        if (S.tut === STEP.hello) {
            return { key: 'hello', center: true, block: true, dim: true, heroes: true, noAva: true,
                title: FB.t('tut_hello_t'), text: FB.t('tut_hello'),
                btns: [[FB.t('tut_go'), 'big', () => go(STEP.lesson)]], skip: true };
        }

        if (S.tut === STEP.lesson) {
            switch (F.phase) {
                case 'idle':
                case 'lost': {
                    const p = TU.castPoint();
                    return { key: 'cast', point: p, hand: p, text: FB.t('tut_cast') };
                }
                case 'wait': {
                    const f = floatAt();
                    if (earlyT > 0) return { key: 'early', point: f.top, text: FB.t('tut_early'), warn: true };
                    return nibbled ? { key: 'nibble', point: f.top, text: FB.t('tut_nibble') } : { key: 'wait', point: f.top, text: FB.t('tut_wait') };
                }
                case 'bite': {
                    const f = floatAt();
                    return { key: 'bite', point: f.mark, hand: f.base, text: FB.t('tut_bite'), warn: true };
                }
                case 'fight': {
                    if (!fightIntro) {
                        return { key: 'fight', rect: document.querySelector('.fight'), block: true, dim: true, delay: 0.45,
                            title: FB.t('tut_fight_t'), text: FB.t('tut_fight') + '<br><br>' + FB.t('tut_meter'),
                            btns: [[FB.t('tut_got'), 'small', () => { fightIntro = true; }]] };
                    }
                    // Дальше подсказываем по стрелке: перетянул — отпусти, провисла — держи
                    const m = document.querySelector('.fight .meter');
                    const r = m && m.getBoundingClientRect();
                    const z = F.zone;
                    if (r && F.tension > z.hi) {
                        return { key: 'f-release', point: { x: r.left + r.width * (z.hi + 1) / 2, y: r.top - 8 }, text: FB.t('tut_release'), warn: true, sticky: 0.6, urgent: true };
                    }
                    if (F.tension < z.lo || (freeT > 0.6 && !F.holding)) {
                        const p = { x: SC.W * 0.64, y: SC.H * 0.44 };
                        return { key: 'f-hold', point: p, hand: p, hold: true, text: FB.t('tut_hold'), sticky: 0.9 };
                    }
                    if (r && F.holding) {
                        return { key: 'f-good', point: { x: r.left + r.width * (z.lo + z.hi) / 2, y: r.top - 8 }, text: FB.t('tut_good'), sticky: 0.9 };
                    }
                    return null;
                }
            }
            return null;
        }

        return null;
    }

    // Подсказка «при первой встрече»: на экране рыбалки или в открытом окне
    function tipsView() {
        const S = FB.S, F = FB.fishing;
        S.tips = S.tips || {};
        let where = 'main';
        if (UI.isOpen()) {
            const top = UI.stack[UI.stack.length - 1];
            const t = top.opt.tip;
            where = typeof t === 'function' ? t() : t;
            if (!where) return null;
        } else if (F.phase !== 'idle' || calmT < 0.8) return null;
        const list = TIPS.filter(t => t.where === where && !S.tips[t.id] && (!t.cond || t.cond(S)));
        const st = list[0];
        if (!st) return null;
        const el = typeof st.target === 'function' ? st.target() : document.querySelector(st.target);
        if (!el || (where === 'main' && !visible(el))) { seen(st.id); return null; }
        if (where !== 'main' && scrolledFor !== st.id) {
            scrolledFor = st.id;
            try { el.scrollIntoView({ block: 'center' }); } catch (e) { /* старые браузеры */ }
        }
        const more = list.length > 1;
        const v = { key: 'tip-' + st.id, rect: el, block: true, dim: true, wide: st.wide, delay: where === 'main' ? 0 : 0.4,
            btns: [[more ? FB.t('tut_next') : FB.t('tut_got'), 'small', () => seen(st.id)]],
            title: FB.t('tut_' + st.id + '_t'), text: FB.t('tut_' + st.id, { n: FB.SEASON.perTier }) };
        if (st.id === 'chip') {
            const cfg = FB.state.weekCfg();
            const li = (ic, html) => '<li>' + FB.ic(ic) + '<span>' + html + '</span></li>';
            v.text = '<div class="c-lead">' + FB.t('tut_chip') + '</div><ul class="c-list">' +
                li('map', FB.t('tut_chip_pond', { pond: '<b>' + U.esc(FB.name(FB.pondById[cfg.pond])) + '</b>' })) +
                li('fish', FB.t('tut_chip_fish', { fish: '<b>' + U.esc(FB.name(FB.fishById[cfg.fish])) + '</b>' })) +
                li('star', FB.t('tut_chip_best')) +
                li('sparkle', FB.t('tut_chip_win')) +
                li('trophy', FB.t('tut_chip_prize')) + '</ul>';
        }
        return v;
    }

    // Эхолот: первый раз — как он работает, первый спиннинг с эхолотом — как с блесной
    function sonarTip() {
        const S = FB.S, F = FB.fishing;
        if (!FB.sonar.has() || F.phase !== 'wait') return null;
        const el = document.querySelector('.sonar');
        if (!el || el.classList.contains('off')) return null;
        const li = (ic, html) => '<li>' + FB.ic(ic) + '<span>' + html + '</span></li>';
        const k = F.waitK();
        if (!S.tips.sonar && F.mode !== 'spin' && k >= FB.sonar.REVEAL + 0.05) {
            const lv = FB.sonar.level();
            return { key: 'tip-sonar', rect: el, block: true, dim: true, wide: true, title: FB.t('tut_sonar_t'),
                text: '<div class="c-lead">' + FB.t('tut_sonar') + '</div><ul class="c-list">' +
                    li('fish', FB.t(['sn_lv1', 'sn_lv2', 'sn_lv3'][lv - 1] || 'sn_lv1')) +
                    li('swap', FB.t('sn_skip')) +
                    li('sparkle', FB.t('sn_spin_hint')) + '</ul>',
                btns: [[FB.t('tut_got'), 'small', () => { seen('sonar'); F.release(); }]] };
        }
        if (!S.tips.sonar_spin && S.tips.ev_spin && F.mode === 'spin' && F.spin && F.spin.attract > 0.25) {
            return { key: 'tip-sonar-spin', rect: el, block: true, dim: true, wide: true, title: FB.t('tut_sonar_spin_t'),
                text: '<ul class="c-list">' +
                    li('sparkle', FB.t('sn_spin1')) +
                    li('clock', FB.t('sn_spin2')) +
                    li('hook', FB.t('sn_spin3')) + '</ul>',
                btns: [[FB.t('tut_got'), 'small', () => { seen('sonar_spin'); seen('sonar'); F.release(); }]] };
        }
        return null;
    }

    // Первая свечка, уход в камыш, тяга на глубину, отличная подсечка — игра
    // встаёт на паузу и объясняет, что делать. Жор — без паузы
    function fightTipView() {
        const S = FB.S, F = FB.fishing;
        if (UI.isOpen()) return null;
        if (FB.events.frenzyOn() && !S.tips.ev_frenzy && F.phase === 'idle') {
            const el = document.querySelector('.frenzy');
            if (el && visible(el)) return { key: 'ev-frenzy', rect: el, block: true, dim: true, title: FB.t('tut_ev_frenzy_t'), text: FB.t('tut_ev_frenzy'), btns: [[FB.t('tut_got'), 'small', () => seen('ev_frenzy')]] };
        }
        // Эхолот: объясняем в деле — когда он уже узнал, кто подплывает
        const sv = sonarTip();
        if (sv) return sv;
        if (F.phase === 'wait' && (F.mode === 'spin' || F.mode === 'bottom') && !S.tips['ev_' + F.mode]) {
            const p = FB.scene.project(F.target.tx, F.target.dist);
            const id = F.mode;
            return { key: 'ev-' + id, point: { x: p.x, y: p.y - FB.scene.unit() * 3 }, block: true, dim: true, wide: true,
                title: FB.t('tut_ev_' + id + '_t'), text: FB.t('tut_ev_' + id), btns: [[FB.t('tut_got'), 'small', () => { seen('ev_' + id); FB.fishing.release(); }]] };
        }
        if (F.phase !== 'fight') return null;
        let id = null;
        if (F.jumpWarn > 0) id = 'jump';
        else if (F.run) id = 'run';
        else if (F.surge > 0 && F.styleId === 'dive') id = 'dive';
        else if (F.perfect && F.call && F.call.key === 'perfect') id = 'perfect';
        else if (F.tired > 0) id = 'tired';
        else if (F.res && F.res.kind === 'fish' && F.progress > 0.18 && Math.abs(F.face) > 0.6 && !F.run && !F.jump) id = 'steer';
        if (!id || S.tips['ev_' + id]) return null;
        const p = FB.scene.project(F.fishTx, F.fishDist);
        return { key: 'ev-' + id, point: { x: p.x, y: p.y - FB.scene.unit() * 4 }, block: true, dim: true, wide: true,
            title: FB.t('tut_ev_' + id + '_t'), text: FB.t('tut_ev_' + id), btns: [[FB.t('tut_got'), 'small', () => { seen('ev_' + id); FB.fishing.release(); }]] };
    }

    // Первая встреча с уткой, тенью, огоньком или косяком: «смотри, вот оно»
    let seeT = 0;
    function placeView() {
        const S = FB.S, f = FB.places.feature();
        if (!f || S.tips['see_' + f] || !S.tips['pl_' + f] || UI.isOpen() || FB.fishing.phase !== 'idle') { seeT = 0; return null; }
        const p = FB.places.focus();
        if (!p) { seeT = 0; return null; }
        seeT += 1 / 60;
        if (seeT > 7) { seen('see_' + f); return null; }
        const u = FB.scene.unit();
        return { key: 'see-' + f, point: { x: p.x, y: p.y - u * (f === 'wisp' ? 10 : 5) }, hand: { x: p.x, y: p.y }, text: FB.t('see_' + f) };
    }
    FB.on('cast', () => { const f = FB.places.feature(); if (FB.S && f && FB.S.tips['pl_' + f] && !FB.S.tips['see_' + f] && FB.places.focus()) seen('see_' + f); });

    // Первая находка на воде: показываем, что её можно забрать
    function driftView() {
        const S = FB.S, D = FB.drift;
        if (S.tips.drift || UI.isOpen() || !D.item || D.item.got) return null;
        const p = D.pos();
        if (!p || D.item.t < 0.8) return null;
        if (D.item.t > 12) { seen('drift'); return null; }
        return { key: 'tip-drift', point: { x: p.x, y: p.y - p.r * 2 }, hand: { x: p.x, y: p.y }, text: FB.t('tip_drift') };
    }
    FB.on('driftFound', () => { if (FB.S && !FB.S.tips.drift) seen('drift'); });

    // Разовая подсказка про пузыри на воде
    function bubblesView() {
        const S = FB.S, F = FB.fishing, SC = FB.scene;
        if (!tip && !S.tips.bubbles && F.phase === 'idle' && !UI.isOpen() && S.stats.catches >= 1) {
            const s = F.spots.find(s => s.t > 0.8 && s.life - s.t > 5);
            if (s) tip = { spot: s, t: 0 };
        }
        if (!tip) return null;
        if (tip.t > 8 || F.phase !== 'idle' || UI.isOpen() || !F.spots.includes(tip.spot)) {
            // Засчитываем, только если игрок успел прочитать (или сразу забросил)
            if (tip.t > 1.5 || F.phase === 'cast') seen('bubbles');
            tip = null;
            return null;
        }
        const p = SC.project(tip.spot.tx, tip.spot.dist);
        return { key: 'tip-bubbles', point: { x: p.x, y: p.y - SC.unit() * 3 * p.s }, hand: p, text: FB.t('tip_bubbles') };
    }

    // Поплавок на экране: верхушка (для пузыря с текстом), «!» над ним
    // при поклёвке (fishing.js рисует его на высоте 7u) и место у воды (для руки)
    function floatAt() {
        const F = FB.fishing, SC = FB.scene, u = SC.unit();
        const p = SC.project(F.target.tx, F.target.dist);
        return {
            top: { x: p.x, y: p.y - FB.person.floatTop(p.s) - u * 0.5 },
            mark: { x: p.x, y: p.y - u * 7 * Math.max(0.6, p.s) - u * 3.8 },
            base: { x: p.x, y: p.y + u * 1.2 * p.s }
        };
    }

    function visible(el) {
        if (!el || el.classList.contains('away')) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight;
    }

    // Тире не должно уезжать в начало строки
    TU.nb = (s) => String(s).replace(/ —/g, '\u00a0—');

    // ---------- Каждый кадр ----------
    TU.frame = (dt) => {
        if (!layer || !FB.S) return;
        const F = FB.fishing;
        if (earlyT > 0) earlyT -= dt;
        if (tip) tip.t += dt;
        calmT = F.phase === 'idle' && !UI.isOpen() ? calmT + dt : 0;
        freeT = F.phase === 'fight' && !F.holding ? freeT + dt : 0;
        render(view(), dt);
    };

    function render(v, dt) {
        // «Липкие» подсказки висят хотя бы немного — чтобы не мелькали
        if (v && shownV && v.key !== shownV.key && shownV.sticky && since < shownV.sticky && !v.urgent && v.sticky) v = shownV;
        shownV = v;
        blocking = !!(v && v.block);
        layer.classList.toggle('block', blocking);
        if (!v) {
            if (shown) { box.classList.add('hidden'); hole.classList.add('hidden'); hand.classList.add('hidden'); }
            shown = null;
            return;
        }
        if (v.key !== shown) { build(v); shown = v.key; since = 0; } else since += dt;
        const ready = !v.delay || since >= v.delay;
        box.classList.toggle('hidden', !ready);

        // Затемнение с «окошком» вокруг того, о чём рассказываем
        const r = v.rect ? v.rect.getBoundingClientRect() : null;
        if (v.dim && ready) {
            hole.classList.remove('hidden');
            hole.classList.toggle('none', !r);
            const pad = 8;
            const x = r ? r.left - pad : innerWidth / 2, y = r ? r.top - pad : innerHeight / 2;
            const w = r ? r.width + pad * 2 : 0, h = r ? r.height + pad * 2 : 0;
            hole.style.cssText = 'left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px;border-radius:' + Math.min(30, h / 2 + 4) + 'px';
        } else hole.classList.add('hidden');

        // Рука: палец касается точки
        if (v.hand && ready) {
            hand.classList.remove('hidden');
            hand.classList.toggle('hold', !!v.hold);
            hand.style.left = Math.round(v.hand.x - 31) + 'px';
            hand.style.top = Math.round(v.hand.y - 6) + 'px';
        } else hand.classList.add('hidden');

        if (ready) place(v, r);
    }

    function build(v) {
        box.className = 'coach' + (v.center ? ' center' : '') + (v.btns ? ' btns' : '') + (v.warn ? ' warn' : '') + (v.wide ? ' wide' : '') + (v.delay ? ' hidden' : '');
        box.innerHTML = '';
        tail = UI.el('i.tail');
        box.appendChild(tail);
        if (!v.noAva) box.appendChild(avatar(v.center ? 104 : 48));
        const tx = UI.el('div.tx');
        if (v.title) tx.appendChild(UI.el('div.tt', { text: v.title }));
        tx.appendChild(UI.el('div.tb', { html: TU.nb(v.text) }));
        if (v.heroes) tx.appendChild(heroPicker());
        if (v.btns || v.skip || v.step) {
            const row = UI.el('div.row');
            if (v.step) row.appendChild(UI.el('span.step', { text: v.step }));
            (v.btns || []).forEach(([label, cls, fn]) => row.appendChild(UI.btn(cls, label, fn)));
            tx.appendChild(row);
            if (v.skip) tx.appendChild(UI.el('button.skip', { text: FB.t('tut_skip'), onclick: (e) => { e.stopPropagation(); FB.audio.play('click'); go(STEP.done); } }));
        }
        box.appendChild(tx);
    }

    // Пузырь — над целью (или под ней, если сверху тесно), хвостик смотрит на цель
    function place(v, r) {
        const W = innerWidth, H = innerHeight, m = 10;
        const bw = box.offsetWidth, bh = box.offsetHeight;
        let x, y, side = null, tx = 0;
        if (v.center) {
            x = (W - bw) / 2; y = (H - bh) / 2;
        } else {
            const t = r ? { l: r.left, r: r.right, t: r.top - 8, b: r.bottom + 8 } : { l: v.point.x, r: v.point.x, t: v.point.y, b: v.point.y };
            const cx = (t.l + t.r) / 2, gap = 16;
            const below = v.hand && !r ? 64 : 0;          // под точкой — рука, пузырь ниже неё
            const roomUp = t.t - gap - bh >= m + 60;      // сверху — счётчики
            const roomDown = t.b + gap + below + bh <= H - m;
            if (roomUp || !roomDown) { y = t.t - gap - bh; side = 'down'; } else { y = t.b + gap + below; side = 'up'; }
            y = U.clamp(y, m, H - m - bh);
            x = U.clamp(cx - bw / 2, m, W - m - bw);
            tx = U.clamp(cx - x, 26, bw - 26);
        }
        box.style.left = Math.round(x) + 'px';
        box.style.top = Math.round(y) + 'px';
        tail.className = 'tail' + (side ? ' ' + side : ' hidden');
        tail.style.left = Math.round(tx) + 'px';
    }

    // Лицо рыбака в кружке — «он и подсказывает»
    function face(size, who) {
        const c = document.createElement('canvas');
        const d = Math.min(2, window.devicePixelRatio || 1);
        c.width = c.height = Math.round(size * d);
        try { FB.person.portrait(c, who); } catch (e) { /* без лица тоже понятно */ }
        return c;
    }
    function avatar(size) {
        const a = UI.el('div.c-ava');
        a.style.width = a.style.height = size + 'px';
        a.appendChild(face(size));
        return a;
    }

    // Выбор рыбака в приветствии: мальчик, девочка, дедушка
    function heroPicker() {
        const row = UI.el('div.c-heroes');
        ['boy', 'girl', 'grandpa'].forEach(id => {
            const b = UI.el('button.c-hero' + (FB.S.who === id ? '.on' : ''), { onclick: (e) => {
                e.stopPropagation();
                FB.audio.play('click');
                if (FB.S.who === id) return;
                FB.S.who = id;
                FB.state.save();
                row.querySelectorAll('.c-hero').forEach(x => x.classList.toggle('on', x === b));
            } });
            const ring = UI.el('div.c-ava');
            ring.appendChild(face(84, id));
            b.append(ring, UI.el('span', { text: FB.t('who_' + id) }));
            row.appendChild(b);
        });
        return row;
    }

    function handSvg() {
        return '<svg viewBox="0 0 64 64" width="64" height="64"><path d="M26 30V10a5 5 0 0110 0v16l12 3c4 1 6 4 5 8l-3 14c-1 5-5 8-10 8H31c-4 0-7-2-9-5l-9-14c-2-3 0-7 4-7 2 0 4 1 5 3l4 5z" fill="#fff" stroke="#2a3550" stroke-width="3" stroke-linejoin="round"/><path d="M36 30v8M42 31v7" stroke="#2a3550" stroke-width="2.5" stroke-linecap="round"/></svg>';
    }
})(window.FB);
