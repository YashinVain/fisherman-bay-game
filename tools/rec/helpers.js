// helpers.js — помощники для записи видео прямо в игре (подключает tools/rec/rec.js
// после загрузки игры). Курсор мыши или касание пальцем, подписи-ленты, финальная
// карточка, «байка» в облачке, автопилот вываживания и журнал звуков для дорожки.
// Всё рисуется поверх игры обычными элементами — значит, попадает в кадр.

(function () {
    if (window.__rec) return;
    const R = window.__rec = {};
    const FB = window.FB;
    R.fps = 30;
    R.frame = 0;
    R.events = [];          // звуки и смены музыки: { f: кадр, fn, args }
    R.touch = false;        // true — показываем палец, false — курсор мыши

    // ---------- Слой поверх игры ----------
    const css = `
    #rec-ov { position: fixed; inset: 0; z-index: 2147483000; pointer-events: none; overflow: hidden; font-family: Nunito, sans-serif; }
    #rec-ov * { box-sizing: border-box; }
    .rec-cursor { position: absolute; left: 0; top: 0; width: 34px; height: 40px; transform-origin: 3px 3px; filter: drop-shadow(0 3px 4px rgba(0,0,0,.35)); }
    .rec-finger { position: absolute; left: 0; top: 0; width: 46px; height: 46px; margin: -23px 0 0 -23px; border-radius: 50%;
        background: rgba(255,255,255,.38); box-shadow: 0 0 0 3px rgba(255,255,255,.9), 0 4px 14px rgba(0,0,0,.3); transition: transform .12s, opacity .2s; }
    .rec-finger.down { transform: scale(.82); background: rgba(255,255,255,.55); }
    .rec-finger.hide { opacity: 0; }
    .rec-ring { position: absolute; width: 20px; height: 20px; margin: -10px 0 0 -10px; border-radius: 50%; border: 3px solid #fff;
        box-shadow: 0 0 10px rgba(255,255,255,.7); animation: recRing .55s ease-out forwards; }
    @keyframes recRing { from { transform: scale(.4); opacity: 1; } to { transform: scale(3.2); opacity: 0; } }

    .rec-cap { position: absolute; left: 50%; bottom: 8%; transform: translateX(-50%) rotate(-2deg); padding: .28em .85em .38em;
        font-size: var(--fs, 54px); font-weight: 900; line-height: 1.05; color: #fff; white-space: nowrap; text-align: center;
        background: linear-gradient(#ff9a3c, #f0502c); border-radius: .42em;
        box-shadow: 0 .14em 0 #b8321c, 0 .4em 1em rgba(20,10,40,.35), inset 0 .06em 0 rgba(255,255,255,.45);
        text-shadow: 0 .06em 0 rgba(120,30,10,.45); animation: recCapIn .55s cubic-bezier(.3,1.6,.5,1) both; }
    .rec-cap b { color: #fff36a; }
    .rec-cap.blue { background: linear-gradient(#5cc8f6, #1f86d0); box-shadow: 0 .14em 0 #13609a, 0 .4em 1em rgba(20,10,40,.35), inset 0 .06em 0 rgba(255,255,255,.45); text-shadow: 0 .06em 0 rgba(10,50,90,.45); }
    .rec-cap.green { background: linear-gradient(#8ee26a, #3fae46); box-shadow: 0 .14em 0 #26803a, 0 .4em 1em rgba(20,10,40,.35), inset 0 .06em 0 rgba(255,255,255,.45); text-shadow: 0 .06em 0 rgba(20,70,20,.45); }
    .rec-cap.violet { background: linear-gradient(#b48cff, #7a4ae0); box-shadow: 0 .14em 0 #5230a8, 0 .4em 1em rgba(20,10,40,.35), inset 0 .06em 0 rgba(255,255,255,.45); text-shadow: 0 .06em 0 rgba(40,20,90,.45); }
    .rec-cap.top { top: 7%; bottom: auto; }
    .rec-cap.wrap { white-space: normal; width: max-content; max-width: 88vw; }
    .rec-cap.out { animation: recCapOut .3s ease-in both; }
    @keyframes recCapIn { from { transform: translateX(-50%) rotate(-8deg) scale(.2); opacity: 0; } to { transform: translateX(-50%) rotate(-2deg) scale(1); opacity: 1; } }
    @keyframes recCapOut { to { transform: translateX(-50%) rotate(4deg) scale(.6); opacity: 0; } }

    .rec-bubble { position: absolute; transform: translate(-22%, -100%); padding: .45em .8em .5em; border-radius: .9em; background: #fff;
        font-size: var(--fs, 40px); font-weight: 900; color: #1f3550; white-space: nowrap; box-shadow: 0 .12em 0 #d8c8a8, 0 .35em .9em rgba(0,0,0,.25);
        animation: recBubIn .45s cubic-bezier(.3,1.7,.5,1) both; transform-origin: 22% 115%; }
    .rec-bubble::after { content: ''; position: absolute; left: 22%; bottom: -.5em; border: .3em solid transparent; border-top: .55em solid #fff; border-bottom: 0; }
    .rec-bubble.out { animation: recBubOut .25s ease-in both; }
    @keyframes recBubIn { from { transform: translate(-22%, -100%) scale(.2); opacity: 0; } to { transform: translate(-22%, -100%) scale(1); opacity: 1; } }
    @keyframes recBubOut { to { transform: translate(-22%, -100%) scale(.5); opacity: 0; } }

    .rec-card { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3vmin;
        background: radial-gradient(ellipse at 50% 45%, rgba(255,214,140,.35), rgba(40,24,80,.78) 70%); -webkit-backdrop-filter: blur(9px); backdrop-filter: blur(9px); animation: recFade .45s ease-out both; }
    .rec-card.out { animation: recFadeOut .35s ease-in both; }
    .rec-card .logo { zoom: var(--ls, 1.5); margin-bottom: 1vmin; animation: drop .8s cubic-bezier(.3,1.5,.5,1) both; }
    .rec-card .cta { font-size: var(--cs, 46px); font-weight: 900; color: #fff; padding: .35em 1.1em .45em; border-radius: .6em;
        background: linear-gradient(#8ee26a, #3fae46); box-shadow: 0 .14em 0 #26803a, 0 .45em 1.2em rgba(0,0,0,.35); text-shadow: 0 .06em 0 rgba(20,70,20,.5);
        animation: recCta 1.1s ease-in-out .6s infinite, recFade .4s ease-out .3s both; }
    .rec-card .sub { font-size: calc(var(--cs, 46px) * .62); font-weight: 900; color: #fff6d0; text-shadow: 0 .08em .3em rgba(0,0,0,.5); animation: recFade .4s ease-out .5s both; }
    @keyframes recCta { 50% { transform: scale(1.07); } }
    @keyframes recFade { from { opacity: 0; } to { opacity: 1; } }
    @keyframes recFadeOut { to { opacity: 0; } }
    .rec-flash { position: absolute; inset: 0; background: #fff; animation: recFlash .35s ease-out forwards; }
    @keyframes recFlash { from { opacity: .85; } to { opacity: 0; } }
    .rec-big { position: absolute; left: 50%; top: 42%; transform: translate(-50%, -50%); font-size: var(--fs, 120px); font-weight: 900; color: #fff36a;
        -webkit-text-stroke: .05em #3a1e48; paint-order: stroke fill; text-shadow: 0 .08em 0 #3a1e48, 0 .2em .5em rgba(0,0,0,.4); white-space: nowrap;
        animation: recBig .6s cubic-bezier(.3,1.7,.5,1) both; }
    @keyframes recBig { from { transform: translate(-50%, -50%) scale(.1) rotate(-12deg); opacity: 0; } to { transform: translate(-50%, -50%) scale(1) rotate(-3deg); opacity: 1; } }
    .rec-big.out { animation: recFadeOut .3s ease-in both; }
    .rec-big.wrap { white-space: normal; width: 94vw; text-align: center; line-height: 1.02; }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    const ov = document.createElement('div');
    ov.id = 'rec-ov';
    document.body.appendChild(ov);
    const el = (cls, html) => { const d = document.createElement('div'); d.className = cls; if (html !== undefined) d.innerHTML = html; ov.appendChild(d); return d; };
    const remove = (d, ms) => { if (!d) return; d.classList.add('out'); setTimeout(() => d.remove(), ms || 400); };

    // ---------- Курсор или палец ----------
    const P = R.ptr = { x: innerWidth * 0.6, y: innerHeight * 0.6, from: null, to: null, t: 0, dur: 0, shown: false, down: false };
    let cursorEl = null, fingerEl = null;
    function ensurePointer() {
        if (R.touch) {
            if (!fingerEl) { fingerEl = el('rec-finger hide'); }
        } else if (!cursorEl) {
            cursorEl = el('rec-cursor', '<svg viewBox="0 0 34 40" width="34" height="40"><path d="M3 3 L3 31 L10 24.5 L15.2 36 L20.4 33.6 L15.4 22.6 L25 22.6 Z" fill="#fff" stroke="#1d2433" stroke-width="2.4" stroke-linejoin="round"/></svg>');
        }
    }
    R.showPointer = (on) => { P.shown = on !== false; ensurePointer(); };
    R.moveTo = (x, y, dur) => {
        ensurePointer();
        P.from = { x: P.x, y: P.y }; P.to = { x, y }; P.t = 0; P.dur = dur === undefined ? 0.45 : dur;
        if (P.dur <= 0) { P.x = x; P.y = y; P.to = null; }
    };
    const ease = (k) => k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    function drawPointer(dt) {
        if (P.to) {
            P.t += dt;
            const k = Math.min(1, P.t / Math.max(0.001, P.dur));
            // Лёгкая дуга, как у живой руки
            const e = ease(k), arc = Math.sin(k * Math.PI) * Math.min(60, Math.hypot(P.to.x - P.from.x, P.to.y - P.from.y) * 0.12);
            P.x = P.from.x + (P.to.x - P.from.x) * e;
            P.y = P.from.y + (P.to.y - P.from.y) * e - arc;
            if (k >= 1) P.to = null;
        }
        if (cursorEl) {
            cursorEl.style.display = P.shown && !R.touch ? '' : 'none';
            cursorEl.style.transform = 'translate(' + (P.x - 3) + 'px,' + (P.y - 3) + 'px) scale(' + (P.down ? 0.88 : 1) + ')';
        }
        if (fingerEl) {
            fingerEl.classList.toggle('hide', !(P.shown && R.touch && (P.down || P.linger > 0)));
            fingerEl.classList.toggle('down', P.down);
            fingerEl.style.left = P.x + 'px'; fingerEl.style.top = P.y + 'px';
        }
        if (P.linger > 0) P.linger -= dt;
    }
    const ring = (x, y) => { if (!P.shown) return; const r = el('rec-ring'); r.style.left = x + 'px'; r.style.top = y + 'px'; setTimeout(() => r.remove(), 700); };
    const canvas = () => document.getElementById('game');
    // Нажать на воду (как игрок): pointerdown на холсте, отпускание — по up()
    R.down = (x, y) => {
        if (x !== undefined) { P.x = x; P.y = y; P.to = null; }
        P.down = true; P.linger = 0.35;
        ring(P.x, P.y);
        if (R.tapLog) R.tapLog.push(R.frame);
        const o = { clientX: P.x, clientY: P.y, bubbles: true, pointerId: 1, isPrimary: true };
        (canvas() || document.body).dispatchEvent(new PointerEvent('pointerdown', o));
    };
    R.up = () => {
        if (!P.down) return;
        P.down = false; P.linger = 0.3;
        window.dispatchEvent(new PointerEvent('pointerup', { clientX: P.x, clientY: P.y, bubbles: true, pointerId: 1 }));
    };
    R.tap = (x, y, hold) => { R.down(x, y); setTimeout(R.up, (hold || 0.12) * 1000); };
    // Провести курсор к элементу и нажать его (кнопки, вкладки, карточки)
    R.rectOf = (sel, i) => {
        const list = typeof sel === 'string' ? document.querySelectorAll(sel) : [sel];
        const e = list[i || 0];
        if (!e) return null;
        const r = e.getBoundingClientRect();
        return { e, x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };
    R.click = (sel, i, move) => {
        const t = R.rectOf(sel, i);
        if (!t) { console.warn('rec: нет элемента ' + sel); return false; }
        const go = () => {
            P.down = true; P.linger = 0.35; ring(t.x, t.y);
            if (R.tapLog) R.tapLog.push(R.frame);
            setTimeout(() => { P.down = false; }, 110);
            t.e.click();
        };
        if (move === false) { P.x = t.x; P.y = t.y; go(); return true; }
        R.moveTo(t.x, t.y, move || 0.42);
        setTimeout(go, ((move || 0.42) + 0.06) * 1000);
        return true;
    };

    // Нажать элемент, внутри которого есть текст (карточка товара, место на карте)
    R.clickText = (sel, text, inner, move) => {
        const card = [...document.querySelectorAll(sel)].find(e => e.textContent.includes(text));
        if (!card) { console.warn('rec: нет «' + text + '» в ' + sel); return false; }
        return R.click(inner ? card.querySelector(inner) : card, 0, move);
    };

    // ---------- Подписи, облачко, карточки ----------
    let cap = null;
    R.caption = (html, opt) => {
        opt = opt || {};
        if (cap) remove(cap, 300);
        cap = el('rec-cap ' + (opt.cls || '') + (R.touch ? ' wrap' : ''), html);
        cap.style.setProperty('--fs', (opt.size || Math.round(Math.min(innerWidth, innerHeight) * (R.touch ? 0.075 : 0.06))) + 'px');
        if (opt.y !== undefined) { cap.style.top = opt.y; cap.style.bottom = 'auto'; }
        if (opt.dur) { const c = cap; setTimeout(() => { remove(c, 300); if (cap === c) cap = null; }, opt.dur * 1000); }
        return cap;
    };
    R.hideCaption = () => { remove(cap, 300); cap = null; };
    let bub = null;
    R.bubble = (html, x, y, opt) => {
        opt = opt || {};
        if (bub) remove(bub, 250);
        bub = el('rec-bubble', html);
        bub.style.left = x + 'px'; bub.style.top = y + 'px';
        bub.style.setProperty('--fs', (opt.size || Math.round(Math.min(innerWidth, innerHeight) * 0.05)) + 'px');
        if (opt.dur) { const b = bub; setTimeout(() => { remove(b, 250); if (bub === b) bub = null; }, opt.dur * 1000); }
        return bub;
    };
    R.hideBubble = () => { remove(bub, 250); bub = null; };
    R.big = (html, opt) => {
        opt = opt || {};
        const b = el('rec-big' + (R.touch ? ' wrap' : ''), html);
        b.style.setProperty('--fs', (opt.size || Math.round(Math.min(innerWidth, innerHeight) * 0.16)) + 'px');
        if (opt.top) b.style.top = opt.top;
        if (opt.dur) setTimeout(() => remove(b, 300), opt.dur * 1000);
        return b;
    };
    R.flash = () => { const f = el('rec-flash'); setTimeout(() => f.remove(), 400); };
    // Финальная карточка: логотип игры и призыв
    R.endCard = (cta, sub) => {
        const m = Math.min(innerWidth, innerHeight);
        const c = el('rec-card',
            '<div class="logo"><img class="logo-fish" src="' + FB.fishArt.url('goldcarp', 140) + '" alt="">' +
            '<span class="logo-top">' + FB.t('logo_top') + '</span><span class="logo-big" data-t="' + FB.t('logo_big') + '">' + FB.t('logo_big') + '</span></div>' +
            (cta ? '<div class="cta">' + cta + '</div>' : '') + (sub ? '<div class="sub">' + sub + '</div>' : ''));
        c.style.setProperty('--ls', R.touch ? 1.45 : 1.5);
        c.style.setProperty('--cs', Math.round(m * (R.touch ? 0.075 : 0.06)) + 'px');
        return c;
    };
    R.clearOverlay = () => { [...ov.children].forEach(c => { if (c !== cursorEl && c !== fingerEl) c.remove(); }); cap = null; bub = null; };

    // ---------- Подготовка игры ----------
    // Без вступления и подсказок, звук не включаем (дорожку соберём отдельно)
    R.setup = (opt) => {
        opt = opt || {};
        const S = FB.S;
        if (document.querySelector('.title .btn')) document.querySelector('.title .btn').click();
        FB.ui.closeAll();
        S.tut = 99;
        S.tips = new Proxy({}, { get: () => 1, has: () => true });
        Object.assign(S, opt.state || {});
        FB.hud.update();
    };
    // Журнал звуков: вызовы звуков и музыки с номером кадра
    R.hookAudio = () => {
        const A = FB.audio;
        A.unlock = () => {};
        ['play', 'setScene', 'setMood'].forEach(fn => {
            const orig = A[fn];
            A[fn] = (...args) => { R.events.push({ f: R.frame, fn, args: JSON.parse(JSON.stringify(args)) }); try { return orig && orig.apply(A, args); } catch (e) { return undefined; } };
        });
        // Гул борьбы игра задаёт каждый кадр — пишем последний уровень кадра
        R.rumLog = {};
        if (A.rumble) { const orig = A.rumble; A.rumble = (level) => { R.rumLog[R.frame] = Math.round((level || 0) * 1000) / 1000; try { return orig.call(A, level); } catch (e) { return undefined; } }; }
        // Текущая сцена — первой записью, чтобы музыка сразу знала настроение
        R.events.push({ f: 0, fn: 'setScene', args: [FB.pondById[FB.S.pond] ? FB.pondById[FB.S.pond].theme : 'village', FB.scene.weather] });
    };
    R.mark = (name, data) => R.events.push({ f: R.frame, fn: 'mark', args: [name, data || null] });

    // ---------- Автопилот рыбалки ----------
    // R.plan — что будет на следующем забросе: { res, biteIn, nibbles, perfect }
    R.plan = null;
    R.bot = { on: true, hookDelay: 0.16, boost: 0.25, steerDelay: 0.35 };
    let lastPhase = null, phaseT = 0, botHold = false, runSeen = null, spinT = 0;
    function botTick(dt) {
        const F = FB.fishing;
        if (F.phase !== lastPhase) { lastPhase = F.phase; phaseT = 0; runSeen = null; }
        else phaseT += dt;
        if (!R.bot.on) return;
        // Заброс: подменяем улов на запланированный
        if (F.phase === 'cast' && R.plan && R.plan.res && phaseT === 0) F.res = R.plan.res;
        if (F.phase === 'wait' && phaseT === 0 && R.plan) {
            if (R.plan.res) F.res = R.plan.res;
            if (F.mode === 'spin' && F.spin) F.spin.need = R.plan.spinNeed || 1.2;
            else {
                F.biteAt = R.plan.biteIn || 1.6;
                F.nibbles = (R.plan.nibbles || [0.7]).slice();
            }
        }
        // Спиннинг: рывки блесной
        if (F.phase === 'wait' && F.mode === 'spin' && R.plan) {
            spinT += dt;
            if (!P.down && spinT > 0.42) { spinT = 0; R.down(); setTimeout(R.up, 140); }
        }
        // Подсечка — сразу после поклёвки
        if (F.phase === 'bite' && phaseT >= R.bot.hookDelay && !P.down) { R.down(); setTimeout(R.up, 90); }
        if (F.phase === 'fight' && F.zone) {
            const z = F.zone, mid = (z.lo + z.hi) / 2;
            let want = botHold;
            if (F.jump > 0 || F.jumpWarn > 0) want = false;
            else if (F.tension < mid - 0.03) want = true;
            else if (F.tension > mid + 0.07) want = false;
            // Рыба уходит в камыш — повести удочку в другую сторону
            if (F.run) {
                if (!runSeen) runSeen = { t: 0 };
                runSeen.t += dt;
                if (runSeen.t > R.bot.steerDelay && !runSeen.done) {
                    runSeen.done = true;
                    const x = F.run.dir > 0 ? innerWidth * 0.25 : innerWidth * 0.8;
                    R.moveTo(x, P.y, 0.25);
                    setTimeout(() => { if (F.run) F.steer(-F.run.dir); }, 260);
                }
            }
            if (want && !P.down) R.down();
            if (!want && P.down) R.up();
            botHold = want;
            // Для видео рыба выматывается чуть быстрее
            if (F.tension >= z.lo && F.tension <= z.hi) F.progress = Math.min(1, F.progress + R.bot.boost * dt);
        } else if (F.phase !== 'wait' && botHold) { botHold = false; R.up(); }
    }

    // ---------- «Живой» игрок для исходников рекламы ----------
    // Реакция человека: подсечка через 0.22–0.38 с, в борьбе палец держат и отпускают
    // с задержкой и не чаще чем раз в ~0.2 с, на свечке отпускают, когда заметили,
    // уход в камыш — ведут пальцем по экрану. Включается R.bot.human = true.
    const H = { hookAt: 0, hold: false, dur: 1, pend: 0, jumpT: 0, drag: null, spinT: 0, spinOn: 0, wob: 0, jumped: [] };
    const rr = (a, b) => a + Math.random() * (b - a);
    const move = (x, y) => {
        P.x = x; P.y = y;
        window.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, bubbles: true, pointerId: 1 }));
    };
    function humanTick(dt) {
        const F = FB.fishing, B = R.bot;
        if (F.phase !== lastPhase) {
            const prev = lastPhase;
            lastPhase = F.phase; phaseT = 0; runSeen = null;
            if (F.phase === 'bite') H.hookAt = rr(B.reaction ? B.reaction[0] : 0.22, B.reaction ? B.reaction[1] : 0.38);
            if (F.phase === 'fight') { H.hold = false; H.dur = 1; H.pend = 0; H.drag = null; H.jumped = []; }
            if (prev === 'fight' && P.down) R.up();
        } else phaseT += dt;
        if (!B.on) return;
        if (F.phase === 'cast' && R.plan && R.plan.res && phaseT === 0) F.res = R.plan.res;
        if (F.phase === 'wait' && phaseT === 0 && R.plan) {
            if (R.plan.res) F.res = R.plan.res;
            if (F.mode === 'spin' && F.spin) F.spin.need = R.plan.spinNeed || 1.6;
            else {
                F.biteAt = R.plan.biteIn || 2.2;
                F.nibbles = (R.plan.nibbles || [0.8, 1.5]).slice();
            }
            H.spinT = 0; H.spinOn = 0;
        }
        // Спиннинг: рывки блесной в живом ритме — нажал на 0.12–0.2 с, пауза 0.25–0.45 с
        if (F.phase === 'wait' && F.mode === 'spin' && R.plan) {
            H.spinT -= dt;
            if (H.spinT <= 0) {
                if (P.down) { R.up(); H.spinT = rr(0.25, 0.45); }
                else { R.down(P.x + rr(-6, 6), P.y + rr(-4, 4)); H.spinT = rr(0.12, 0.2); }
            }
        }
        if (F.phase === 'bite' && phaseT >= H.hookAt && !P.down) { R.down(P.x + rr(-8, 8), P.y + rr(-6, 6)); setTimeout(R.up, rr(90, 150)); }
        if (F.phase === 'fight' && F.zone) {
            const z = F.zone, lo = z.lo + (z.hi - z.lo) * 0.28, hi = z.lo + (z.hi - z.lo) * (F.styleId === 'dive' ? 0.55 : 0.78);
            let want = H.hold;
            // Свечка в задуманный момент борьбы (для зрелищного кадра)
            (B.jumpAt || []).forEach((t, i) => {
                if (!H.jumped[i] && phaseT >= t && F.jumpWarn <= 0 && F.jump <= 0 && F.progress < 0.9) { H.jumped[i] = true; F.jumpWarn = 0.5; }
            });
            // «Жадный» момент: держит дольше, леска уходит в красное, но не рвётся
            const greedy = B.greedy && phaseT >= B.greedy[0] && phaseT <= B.greedy[1] && F.tension < 0.82;
            if (F.jumpWarn > 0 || F.jump > 0) { H.jumpT += dt; if (H.jumpT > (B.jumpReact || 0.2)) want = false; }
            else if (greedy) { H.jumpT = 0; want = true; }
            else { H.jumpT = 0; if (F.tension < lo) want = true; else if (F.tension > hi) want = false; }
            // Задержка реакции и «не дёргать палец каждый кадр»
            if (want !== H.hold) {
                H.pend += dt;
                if (H.pend >= (B.lag || 0.12) && H.dur >= (B.minHold || 0.18)) { H.hold = want; H.dur = 0; H.pend = 0; }
            } else H.pend = 0;
            H.dur += dt;
            if (F.tension > 0.86) { H.hold = false; H.dur = 0; H.pend = 0; }
            F.strain = Math.min(F.strain, 0.4); F.over = 0; if (!(F.jump > 0)) F.slack = Math.min(F.slack, 0.6);
            if (F.tension > 0.92) F.tension = 0.92;
            if (F.tension < z.lo - 0.12 && !(F.jumpWarn > 0 || F.jump > 0)) { H.hold = true; H.dur = 0; H.pend = 0; }
            // Уход в камыш: заметил, прижал палец и повёл в другую сторону
            if (F.run && !H.drag) {
                if (!runSeen) runSeen = { t: 0 };
                runSeen.t += dt;
                if (runSeen.t > (B.steerDelay || 0.35)) {
                    const to = F.run.dir > 0 ? Math.max(innerWidth * 0.12, P.x - innerWidth * 0.32) : Math.min(innerWidth * 0.9, P.x + innerWidth * 0.32);
                    H.drag = { x0: P.x, x1: to, t: 0, dur: rr(0.28, 0.4) };
                    if (!P.down) R.down();
                    H.hold = true; H.dur = 0;
                }
            }
            if (H.drag) {
                H.drag.t += dt;
                const k = Math.min(1, H.drag.t / H.drag.dur), e = 1 - Math.pow(1 - k, 3);
                move(H.drag.x0 + (H.drag.x1 - H.drag.x0) * e, P.y + Math.sin(k * Math.PI) * -6);
                if (k >= 1 && !F.run) H.drag = null;
                if (k >= 1 && F.run && H.drag.t > H.drag.dur + 0.4) H.drag = null;
            } else {
                if (H.hold && !P.down) R.down(P.x + rr(-5, 5), P.y + rr(-5, 5));
                if (!H.hold && P.down) R.up();
                // Палец чуть «гуляет», пока держит
                if (P.down) { H.wob += dt; move(P.x + Math.sin(H.wob * 2.3) * 0.6, P.y + Math.cos(H.wob * 1.7) * 0.5); }
            }
            if (B.boost && F.tension >= z.lo && F.tension <= z.hi) F.progress = Math.min(1, F.progress + B.boost * dt);
        }
    }

    // Метки для монтажа: когда закинул, клюнуло, подсёк, свечка, вытащил
    ['cast', 'bite', 'fightStart', 'landed', 'lost'].forEach(ev => FB.on(ev, () => R.mark(ev)));
    let wasJump = false;
    function markJumps() {
        const F = FB.fishing, j = F.phase === 'fight' && (F.jump > 0);
        if (j && !wasJump) R.mark('jump');
        wasJump = j;
    }
    R.ptrLog = [];     // [кадр, x, y, нажат, виден] — палец рисует уже монтажка
    R.ancLog = [];     // [кадр, голова x, y, рыба/поплавок x, y] — камера монтажки следит за ними
    function fishPos() {
        const F = FB.fishing, SC = FB.scene;
        try {
            if (F.phase === 'fight') return SC.project(F.fishTx, F.fishDist);
            if ((F.phase === 'wait' || F.phase === 'bite' || F.phase === 'cast') && F.target) return SC.project(F.target.tx, F.target.dist);
            if (F.phase === 'land' && F.landFrom) return F.landFrom;
        } catch (e) { /* сцены ещё нет */ }
        return null;
    }
    R.tapLog = [];     // кадры касаний (кольца)

    // Голова рыбака на экране — к ней цепляем облачко с байкой
    R.heroHead = () => {
        const L = FB.scene.L, h = L.ph;
        return { x: L.px + h * 0.07, y: L.py - h * 0.765 - h * 0.26 };
    };
    // Что сделать, когда рыба вытащена (вспышка, надпись)
    R.landHook = null;
    FB.on('fightEnd', () => { if (R.landHook) { try { R.landHook(); } catch (e) { console.error(e); } } });
    // Флаг «рыба вытащена» — для снимков: сцена сбрасывает его в начале
    R.landed = false;
    FB.on('landed', () => { R.landed = true; });

    // Ловля без остановки: забросил — подсёк — вытащил — забрал — снова
    // R.auto = { plans: [[id, граммы], ...], keepAfter, castAfter }
    R.auto = null;
    function autoTick(dt) {
        const A = R.auto, F = FB.fishing;
        const btn = document.querySelector('.shade:last-child .choice .btn');
        if (btn) {
            A.cardT = (A.cardT || 0) + dt;
            if (A.cardT > (A.keepAfter || 0.55) && !A.clicked) { A.clicked = true; R.click(btn, 0, 0.28); }
            return;
        }
        A.cardT = 0; A.clicked = false;
        if (F.phase !== 'idle' || FB.ui.isOpen()) { A.idleT = 0; A.aimed = false; return; }
        A.idleT = (A.idleT || 0) + dt;
        const c = FB.tutor.castPoint();
        if (!A.aimed) {
            A.aimed = true;
            A.tx = c.x + (Math.random() - 0.4) * innerWidth * 0.12;
            A.ty = c.y + (Math.random() - 0.5) * innerHeight * 0.05;
            R.moveTo(A.tx, A.ty, 0.3);
        }
        if (A.idleT > (A.castAfter || 0.38)) {
            A.idleT = 0; A.aimed = false;
            const p = A.plans[(A.i = (A.i || 0) + 1) % A.plans.length];
            R.plan = { res: { kind: 'fish', fish: FB.fishById[p[0]], g: p[1] }, biteIn: p[2] || 0.55, nibbles: [] };
            R.tap(A.tx, A.ty);
        }
    }

    // Один кадр: курсор, автопилот, потом время игры
    R.step = async (frame, ms) => {
        ms = ms || 1000 / R.fps;
        R.frame = frame;
        const dt = ms / 1000;
        try { (R.bot.human ? humanTick : botTick)(dt); if (R.auto) autoTick(dt); markJumps(); } catch (e) { console.error(e); }
        drawPointer(dt);
        R.ptrLog.push([frame, Math.round(P.x), Math.round(P.y), P.down ? 1 : 0, (P.down || P.linger > 0) ? 1 : 0]);
        try {
            const hd = R.heroHead(), fp = fishPos();
            R.ancLog.push([frame, Math.round(hd.x), Math.round(hd.y), fp ? Math.round(fp.x) : -1, fp ? Math.round(fp.y) : -1]);
        } catch (e) { R.ancLog.push([frame, -1, -1, -1, -1]); }
        await window.__tm.step(ms);
    };
})();
