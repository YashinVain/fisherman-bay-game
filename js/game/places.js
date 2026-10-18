// places.js — у каждого места своя особенность. Рыбалка та же, но в каждом
// водоёме есть, на что смотреть и чем пользоваться:
//   • Деревенский пруд — утки ныряют за рыбой: где нырнула утка, там клюёт.
//   • Лесная речка — течение: поплавок плывёт вдоль берега и быстрее находит рыбу.
//   • Горное озеро — вода прозрачная: видны тени рыб. Забросишь к тени —
//     клюнет именно она (крупная тень — крупная рыба).
//   • Тихое болото — блуждающие огоньки: забрось под огонёк — клюёт редкая рыба.
//     Ночью, вечером и в тумане огоньков больше.
//   • Морская пристань — чайки кружат над косяком: в косяке клюёт сразу, и
//     косяк держится несколько забросов.
//   • Тропическая лагуна — прилив: раз в несколько минут вода поднимается, и
//     рыба с глубины подходит к берегу.
// На уроке рыбалки особенности не работают — там всё должно быть предсказуемо.

(function (FB) {
    const PL = FB.places = {};
    const U = FB.U;

    PL.FEATURES = { village: 'ducks', river: 'current', mountain: 'shadows', swamp: 'wisp', pier: 'school', lagoon: 'tide' };
    PL.feature = (pond) => PL.FEATURES[pond || (FB.S && FB.S.pond)] || null;

    // ---------- Прилив по часам сервера (одинаково у всех игроков) ----------
    PL.TIDE_PERIOD = 8 * 60000;      // полный цикл
    PL.TIDE_HIGH = 3 * 60000;        // из него — прилив
    PL.tideAt = (t) => {
        const ph = ((t % PL.TIDE_PERIOD) + PL.TIDE_PERIOD) % PL.TIDE_PERIOD;
        const high = ph < PL.TIDE_HIGH;
        return { high, left: high ? PL.TIDE_HIGH - ph : PL.TIDE_PERIOD - ph };
    };
    PL.TIDE_SHIFT = 0.28;            // в прилив ближний заброс — как дальний

    // Состояние текущего места
    let st = null;
    PL.state = () => st;
    PL.reset = () => {
        const f = PL.feature();
        st = { f, t: 0, next: U.rand(6, 12), ducks: [], shadows: [], wisp: null, school: null, flow: [] };
        if (f === 'current') for (let i = 0; i < 26; i++) st.flow.push({ tx: U.rand(-1.4, 1.4), dist: U.rand(0.04, 0.95), k: Math.random() });
        if (f === 'shadows') st.next = 1.5;
    };

    const F = () => FB.fishing;
    const near = (a, tx, dist, r) => Math.abs(a.tx - tx) < (r || 0.14) + a.dist * 0.12 && Math.abs(a.dist - dist) < 0.08;
    // Случайная точка на воде, куда удочка достаёт
    function spotInReach(minK, maxK) {
        const fi = F(), o = fi.origin(), reach = FB.state.rodObj().reach;
        for (let i = 0; i < 30; i++) {
            const tx = U.rand(o.tx + 0.3, 0.85), dist = U.rand(0.08, 0.9);
            const e = fi.reachOf(tx, dist, o);
            if (e > reach * (minK || 0.35) && e < reach * (maxK || 0.9)) return { tx, dist };
        }
        return null;
    }

    // ---------- Каждый кадр ----------
    PL.update = (dt) => {
        if (!st || st.f !== PL.feature()) PL.reset();
        st.t += dt;
        const fi = F();
        const calm = fi.phase === 'idle' || fi.phase === 'wait';
        switch (st.f) {
            case 'ducks': {
                st.ducks = st.ducks.filter(d => {
                    d.t += dt;
                    if (d.state === 'swim') {
                        d.tx += d.v * dt;
                        if (Math.abs(d.tx - d.goal) < 0.02) { d.state = 'dive'; d.dt = 0; FB.audio.play('nibble'); }
                    } else if (d.state === 'dive') {
                        d.dt += dt;
                        if (d.dt > 1.6 && !d.made) {
                            d.made = true;
                            fi.spots.push({ tx: d.goal, dist: d.dist, t: 0, life: 12, duck: true });
                            FB.emit('placeEvent', 'ducks');
                        }
                        if (d.dt > 2.4) { d.state = 'away'; d.v = d.v || 0.05; }
                    } else {
                        d.tx += d.v * 1.4 * dt;
                    }
                    return d.tx > -1.6 && d.tx < 1.6 && d.t < 40;
                });
                st.next -= dt;
                if (st.next <= 0 && calm && st.ducks.length === 0) {
                    st.next = U.rand(22, 38);
                    const p = spotInReach(0.35, 0.85);
                    if (p) {
                        const fromRight = Math.random() < 0.6;
                        const start = fromRight ? 1.35 : -1.35;
                        st.ducks.push({ tx: start, dist: p.dist, goal: p.tx, v: (p.tx - start) / U.rand(5, 7), t: 0, state: 'swim' });
                    }
                }
                break;
            }
            case 'current': {
                st.flow.forEach(f => {
                    f.tx += 0.05 * (1 - f.dist * 0.6) * dt;
                    f.k = (f.k + dt * 0.35) % 1;
                    if (f.tx > 1.5) f.tx = -1.5;
                });
                // Пузыри тоже уносит течением
                fi.spots.forEach(s => { s.tx += 0.012 * dt; });
                break;
            }
            case 'shadows': {
                st.shadows = st.shadows.filter(s => {
                    s.t += dt;
                    s.tx += s.v * dt;
                    s.dist += Math.sin(s.t * 0.7 + s.ph) * 0.004 * dt;
                    if (s.tx < s.lo || s.tx > s.hi) s.v = -s.v;
                    return s.t < s.life;
                });
                st.next -= dt;
                if (st.next <= 0 && st.shadows.length < 2) {
                    st.next = U.rand(6, 11);
                    const p = spotInReach(0.3, 0.92);
                    if (p) {
                        const ctx = PL.rollCtx(p.dist);
                        let res = FB.catcher.roll(ctx);
                        for (let i = 0; i < 4 && res.kind !== 'fish'; i++) res = FB.catcher.roll(ctx);
                        if (res.kind === 'fish') st.shadows.push({ tx: p.tx, dist: p.dist, v: (Math.random() < 0.5 ? -1 : 1) * U.rand(0.02, 0.04), lo: p.tx - 0.18, hi: p.tx + 0.18, t: 0, life: U.rand(16, 24), ph: Math.random() * 6, res });
                    }
                }
                break;
            }
            case 'wisp': {
                const w = st.wisp;
                if (w) {
                    w.t += dt;
                    if (w.t > w.life || w.gone) st.wisp = null;
                }
                st.next -= dt;
                if (st.next <= 0 && !st.wisp && calm) {
                    const wx = FB.scene.weather;
                    const often = wx === 'night' || wx === 'fog' || wx === 'evening';
                    st.next = often ? U.rand(16, 28) : U.rand(32, 50);
                    const p = spotInReach(0.35, 0.9);
                    if (p) { st.wisp = { tx: p.tx, dist: p.dist, t: 0, life: 13, ph: Math.random() * 6 }; FB.emit('placeEvent', 'wisp'); }
                }
                break;
            }
            case 'school': {
                const sc = st.school;
                if (sc) {
                    sc.t += dt;
                    if (sc.t > sc.life || sc.left <= 0) st.school = null;
                }
                st.next -= dt;
                if (st.next <= 0 && !st.school && calm) {
                    st.next = U.rand(28, 45);
                    const p = spotInReach(0.4, 0.9);
                    if (p) { st.school = { tx: p.tx, dist: p.dist, t: 0, life: 30, left: 3 }; FB.emit('placeEvent', 'school'); }
                }
                break;
            }
            case 'tide': {
                const tide = PL.tideAt(FB.sdk.now());
                if (st.high !== undefined && tide.high !== st.high) FB.emit('placeEvent', tide.high ? 'tide_in' : 'tide_out');
                st.high = tide.high;
                st.level = U.lerp(st.level === undefined ? (tide.high ? 1 : 0) : st.level, tide.high ? 1 : 0, Math.min(1, dt * 0.5));
                break;
            }
        }
    };

    // Условия для броска «как будто здесь заброс» (для теней)
    PL.rollCtx = (dist) => {
        const cfg = FB.state.weekCfg();
        const o = F().origin();
        return { pond: FB.S.pond, dist: Math.max(0.05, dist - o.dist), bait: FB.S.bait, rod: FB.state.rodObj(), weather: FB.scene.weather, bubble: true, weekFish: FB.S.pond === cfg.pond ? cfg.fish : null };
    };

    // ---------- Заброс ----------
    // До броска: меняем условия (удача, «глубина», ожидание). Возвращает
    // готовый результат, если он уже известен (тень в горном озере)
    PL.beforeRoll = (ctx, tx, dist) => {
        if (!st || ctx.tut) return null;
        ctx.waitMul = 1;
        switch (st.f) {
            case 'current':
                ctx.drift = 0.014;
                ctx.waitMul = 0.85;
                break;
            case 'shadows': {
                const i = st.shadows.findIndex(s => near(s, tx, dist, 0.12));
                if (i >= 0) {
                    const s = st.shadows.splice(i, 1)[0];
                    ctx.waitMul = 0.5;
                    ctx.place = 'shadow';
                    return s.res;
                }
                break;
            }
            case 'wisp':
                if (st.wisp && !st.wisp.gone && near(st.wisp, tx, dist, 0.13)) {
                    st.wisp.gone = true;
                    ctx.luckMul = 3;
                    ctx.waitMul = 0.6;
                    ctx.place = 'wisp';
                }
                break;
            case 'school':
                if (st.school && near(st.school, tx, dist, 0.16)) {
                    st.school.left--;
                    ctx.waitMul = 0.3;
                    ctx.noNibble = true;
                    ctx.place = 'school';
                }
                break;
            case 'tide':
                if (PL.tideAt(FB.sdk.now()).high) { ctx.tide = PL.TIDE_SHIFT; ctx.place = 'tide'; }
                break;
        }
        return null;
    };

    // Что пишем на плашке места (короткое состояние)
    PL.chip = () => {
        const f = PL.feature();
        if (!f) return null;
        if (f === 'tide') {
            const t = PL.tideAt(FB.sdk.now());
            return { f, text: FB.t(t.high ? 'pl_tide_high' : 'pl_tide_low', { t: clock(t.left) }), hot: t.high };
        }
        return { f, text: FB.t('pl_' + f) };
    };
    const clock = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

    // Куда смотреть подсказке «смотри, вот оно» (точка на экране) — или null
    PL.focus = () => {
        if (!st) return null;
        const SC = FB.scene;
        let a = null;
        if (st.f === 'ducks') a = st.ducks[0];
        else if (st.f === 'shadows') a = st.shadows.find(s => s.t > 1.5);
        else if (st.f === 'wisp') a = st.wisp && st.wisp.t > 0.8 ? st.wisp : null;
        else if (st.f === 'school') a = st.school;
        if (!a) return null;
        return SC.project(a.tx, a.dist);
    };

    // ---------- Рисование (слой воды) ----------
    PL.draw = (ctx) => {
        if (!st) return;
        const SC = FB.scene, u = SC.unit();
        switch (st.f) {
            case 'ducks': st.ducks.forEach(d => drawDuck(ctx, d, SC, u)); break;
            case 'current': drawFlow(ctx, SC, u); break;
            case 'shadows': st.shadows.forEach(s => drawShadow(ctx, s, SC, u)); break;
            case 'wisp': if (st.wisp) drawWisp(ctx, st.wisp, SC, u); break;
            case 'school': if (st.school) drawSchool(ctx, st.school, SC, u); break;
            case 'tide': drawTide(ctx, SC, u); break;
        }
    };

    function drawDuck(ctx, d, SC, u) {
        const p = SC.project(d.tx, d.dist);
        const s = u * 4.5 * Math.max(0.55, p.s * 1.6);
        const dir = d.v >= 0 ? 1 : -1;
        const night = SC.weather === 'night';
        ctx.save();
        ctx.translate(p.x, p.y + Math.sin(d.t * 3) * s * 0.05);
        ctx.scale(dir, 1);
        // Круги на воде
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = Math.max(1, s * 0.06);
        ctx.beginPath(); ctx.ellipse(0, s * 0.15, s * 1.4, s * 0.3, 0, 0, Math.PI * 2); ctx.stroke();
        const body = night ? '#8a8270' : '#f4eee0', head = night ? '#2e5a3a' : '#2f8a4a', beak = '#f2a23a';
        if (d.state === 'dive') {
            // Нырнула: торчит только хвостик, вокруг — брызги
            const k = Math.min(1, d.dt / 0.4);
            ctx.fillStyle = body;
            ctx.beginPath(); ctx.ellipse(-s * 0.1, -s * 0.15 * (1 - k * 0.5), s * 0.45, s * 0.3, -0.9, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#c8a878';
            ctx.beginPath(); ctx.moveTo(-s * 0.35, -s * 0.5); ctx.lineTo(-s * 0.6, -s * 0.85); ctx.lineTo(-s * 0.15, -s * 0.55); ctx.closePath(); ctx.fill();
            for (let i = 0; i < 4; i++) {
                const kk = (d.dt * 1.4 + i * 0.25) % 1;
                ctx.fillStyle = 'rgba(255,255,255,' + (0.7 * (1 - kk)) + ')';
                ctx.beginPath(); ctx.arc(Math.cos(i * 1.7) * s * 0.7 * kk, -kk * s * 0.6, s * 0.08, 0, Math.PI * 2); ctx.fill();
            }
        } else {
            ctx.fillStyle = body;
            ctx.beginPath(); ctx.ellipse(0, 0, s * 0.75, s * 0.38, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#c8a878';
            ctx.beginPath(); ctx.moveTo(-s * 0.65, -s * 0.1); ctx.lineTo(-s * 0.95, -s * 0.35); ctx.lineTo(-s * 0.55, -s * 0.25); ctx.closePath(); ctx.fill();
            ctx.fillStyle = U.shade(body, -0.12);
            ctx.beginPath(); ctx.ellipse(-s * 0.05, -s * 0.05, s * 0.4, s * 0.18, -0.2, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = head;
            ctx.beginPath(); ctx.arc(s * 0.55, -s * 0.45, s * 0.26, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = beak;
            ctx.beginPath(); ctx.ellipse(s * 0.85, -s * 0.4, s * 0.17, s * 0.07, 0.1, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#1a1a22';
            ctx.beginPath(); ctx.arc(s * 0.62, -s * 0.5, s * 0.045, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }

    function drawFlow(ctx, SC, u) {
        ctx.lineCap = 'round';
        st.flow.forEach(f => {
            const p = SC.project(f.tx, f.dist);
            const a = Math.sin(f.k * Math.PI) * 0.35;
            const len = u * 5 * p.s * 1.6;
            ctx.strokeStyle = 'rgba(255,255,255,' + a + ')';
            ctx.lineWidth = Math.max(1, 1.5 * p.s);
            ctx.beginPath();
            ctx.moveTo(p.x - len, p.y);
            ctx.quadraticCurveTo(p.x - len * 0.3, p.y - 1.5 * p.s, p.x + len * 0.4, p.y);
            ctx.stroke();
        });
    }

    // Тень рыбы под прозрачной водой: размер — по весу рыбы
    function drawShadow(ctx, s, SC, u) {
        const p = SC.project(s.tx, s.dist);
        const f = s.res.fish;
        const big = U.clamp(Math.log(s.res.g / f.w[0]) / Math.log(f.w[1] / f.w[0]), 0, 1);
        const sw = u * (4 + big * 4 + FB.RARITY[f.r].order * 1.2) * Math.max(0.55, p.s * 1.6);
        const a = Math.min(1, s.t / 1.5, (s.life - s.t) / 2) * 0.45;
        const dir = s.v >= 0 ? 1 : -1;
        ctx.save();
        ctx.translate(p.x, p.y + u * 0.8 * p.s);
        ctx.scale(dir, 1);
        ctx.fillStyle = 'rgba(8,30,50,' + a + ')';
        ctx.beginPath(); ctx.ellipse(0, 0, sw, sw * 0.27, 0, 0, Math.PI * 2); ctx.fill();
        const tw = Math.sin(s.t * 6) * sw * 0.12;
        ctx.beginPath(); ctx.moveTo(-sw * 0.85, 0); ctx.lineTo(-sw * 1.3, -sw * 0.24 + tw); ctx.lineTo(-sw * 1.3, sw * 0.24 + tw); ctx.closePath(); ctx.fill();
        ctx.restore();
    }

    function drawWisp(ctx, w, SC, u) {
        const p = SC.project(w.tx, w.dist);
        const a = Math.min(1, w.t / 0.8, (w.life - w.t) / 1.5);
        const r = u * 2.2 * Math.max(0.6, p.s);
        const y = p.y - u * 6 * Math.max(0.6, p.s) + Math.sin(w.t * 2 + w.ph) * r * 0.6;
        const x = p.x + Math.sin(w.t * 1.3 + w.ph) * r * 0.8;
        ctx.save();
        ctx.globalAlpha = a;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
        g.addColorStop(0, 'rgba(200,255,220,0.95)');
        g.addColorStop(0.25, 'rgba(120,240,190,0.55)');
        g.addColorStop(1, 'rgba(80,220,170,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, r * 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f2fff6';
        ctx.beginPath(); ctx.arc(x, y, r * 0.55, 0, Math.PI * 2); ctx.fill();
        // Отражение огонька в воде
        const rg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3);
        rg.addColorStop(0, 'rgba(160,255,210,0.4)');
        rg.addColorStop(1, 'rgba(160,255,210,0)');
        ctx.fillStyle = rg;
        ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1, 0.3);
        ctx.beginPath(); ctx.arc(0, 0, r * 3, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        // Искорки вокруг
        for (let i = 0; i < 5; i++) {
            const k = (w.t * 0.6 + i * 0.2) % 1;
            ctx.fillStyle = 'rgba(210,255,230,' + (0.8 * (1 - k)) + ')';
            ctx.beginPath(); ctx.arc(x + Math.cos(i * 2.4 + w.t) * r * 2 * k, y - k * r * 2.5, r * 0.15, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }

    // Косяк: вода кипит от мелкой рыбёшки, сверху кружат чайки
    function drawSchool(ctx, sc, SC, u) {
        const p = SC.project(sc.tx, sc.dist);
        const a = Math.min(1, sc.t / 1, (sc.life - sc.t) / 2);
        const R = u * 6 * Math.max(0.6, p.s) * 1.4;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = 'rgba(20,50,80,0.26)';
        ctx.beginPath(); ctx.ellipse(p.x, p.y, R, R * 0.28, 0, 0, Math.PI * 2); ctx.fill();
        // Рыбки выпрыгивают
        for (let i = 0; i < 6; i++) {
            const k = (sc.t * 0.9 + i * 0.37) % 1;
            if (k > 0.5) continue;
            const q = k / 0.5;
            const x = p.x + Math.cos(i * 2.1) * R * 0.7 + (q - 0.5) * R * 0.25;
            const y = p.y + Math.sin(i * 1.3) * R * 0.15 - Math.sin(q * Math.PI) * R * 0.35;
            ctx.fillStyle = 'rgba(220,235,245,0.9)';
            ctx.save(); ctx.translate(x, y); ctx.rotate((q - 0.5) * 1.6);
            ctx.beginPath(); ctx.ellipse(0, 0, R * 0.09, R * 0.035, 0, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }
        for (let i = 0; i < 5; i++) {
            const k = (sc.t * 1.3 + i * 0.2) % 1;
            ctx.strokeStyle = 'rgba(255,255,255,' + (0.5 * (1 - k)) + ')';
            ctx.lineWidth = Math.max(1, p.s * 1.4);
            ctx.beginPath(); ctx.ellipse(p.x + Math.cos(i * 2.7) * R * 0.6, p.y + Math.sin(i * 1.9) * R * 0.12, R * 0.15 * (0.3 + k), R * 0.05 * (0.3 + k), 0, 0, Math.PI * 2); ctx.stroke();
        }
        // Чайки кружат
        const night = SC.weather === 'night';
        ctx.strokeStyle = night ? '#c8d0e8' : SC.weather === 'evening' ? '#4a2a4a' : '#ffffff';
        ctx.lineWidth = Math.max(1.5, u * 0.35);
        ctx.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
            const ang = sc.t * (0.9 + i * 0.15) + i * 2.1;
            const gx = p.x + Math.cos(ang) * R * 1.2;
            const gy = p.y - R * (1.6 + i * 0.35) + Math.sin(ang) * R * 0.35;
            const w = u * 2.2, flap = Math.sin(sc.t * 8 + i * 2) * 0.5;
            ctx.beginPath();
            ctx.moveTo(gx - w, gy - w * (0.2 + flap * 0.4));
            ctx.quadraticCurveTo(gx - w * 0.4, gy - w * 0.5, gx, gy);
            ctx.quadraticCurveTo(gx + w * 0.4, gy - w * 0.5, gx + w, gy - w * (0.2 + flap * 0.4));
            ctx.stroke();
        }
        ctx.restore();
    }

    // Прилив: у берегов поднимается пена, по воде бегут длинные волны
    function drawTide(ctx, SC, u) {
        const lv = st.level || 0;
        if (lv < 0.02) return;
        const W = SC.W;
        ctx.save();
        ctx.globalAlpha = lv;
        for (let i = 0; i < 4; i++) {
            const d = ((st.t * 0.05 + i * 0.25) % 1);
            const p = SC.project(0, 1 - d);
            const a = Math.sin(d * Math.PI) * 0.35;
            ctx.strokeStyle = 'rgba(255,255,255,' + a + ')';
            ctx.lineWidth = Math.max(1, 2 * p.s);
            ctx.beginPath();
            for (let x = 0; x <= W; x += 16) ctx.lineTo(x, p.y + Math.sin(x * 0.02 + st.t + i) * 2 * p.s);
            ctx.stroke();
        }
        ctx.restore();
    }
})(window.FB);
