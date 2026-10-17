// fishing.js — сама рыбалка: заброс → ожидание → поклёвка → подсечка →
// вываживание → улов. Здесь же «пузыри» на воде (место, где клюёт лучше)
// и рисование всего, что связано с поплавком и рыбой.
//
// Управление одним пальцем:
//   • нажал на воду — заброс туда;
//   • поплавок нырнул — нажми (подсечка);
//   • вываживание — держи палец, чтобы подматывать. Стрелку натяжения надо
//     держать в зелёной зоне: слева красное — леска провисла, справа — вот-вот
//     лопнет. Чем сильнее рыба, тем уже зелёная зона (но не уже zoneMin).
//   • нажал во время ожидания — смотал удочку (если не было поклёвки).

(function (FB) {
    const F = FB.fishing = {};
    const U = FB.U;

    // Настройки вываживания — подобраны симуляцией (бот в tools/test.js)
    F.TUNE = {
        zoneMax: 0.64, zoneMin: 0.3,      // ширина зелёной зоны: мелочь — широкая, сильная рыба — узкая
        riseBase: 0.4, riseStr: 0.75,     // рост натяжения, когда тянешь
        fall: 0.9,                        // ослабление, когда отпустил
        reel: 0.34,                       // скорость подмотки
        heavy: 0.55,                      // насколько сильная рыба замедляет подмотку
        slip: 0.025,                      // рыба отвоёвывает леску, пока не тянешь (× сила)
        slackMax: 2.0,                    // сколько стрелка может быть в левой красной зоне, с
        strainMax: 1.0,                   // ...и в правой красной, с
        snapGrace: 0.35,                  // столько леска выдерживает в упоре, с
        surgeEvery: [1.4, 3.2],
        surgeLen: 0.5, surgePower: 3.2,   // рывок: сила × сила рыбы², хорошая удочка гасит
        surgeCap: 1.6                     // ...но не сильнее этого — чтобы любую рыбу можно было вытащить
    };

    // Зелёная зона для этой рыбы: чем сильнее рыба, тем уже. Хорошая удочка её расширяет
    F.zoneFor = (s, r) => {
        const T = F.TUNE;
        let w = U.lerp(T.zoneMax, T.zoneMin, U.clamp((s - 0.14) / 0.66, 0, 1));
        w = U.clamp(w * (1 + (1 - r.ctrl) * 0.6), T.zoneMin, T.zoneMax + 0.06);
        return { lo: 0.5 - w / 2, hi: 0.5 + w / 2 };
    };

    F.phase = 'idle';
    F.holding = false;
    F.spots = [];
    let spotTimer = 4;
    let T = 0;            // время в фазе

    F.reset = () => {
        F.phase = 'idle';
        F.holding = false;
        F.res = null;
        F.spots = [];
        T = 0;
        setPose();
    };

    const rod = () => FB.state.rodObj();

    // ---------- Расстояние от рыбака ----------
    // Рыбак сидит слева на мостках. «Дальность» заброса — расстояние по воде
    // от точки под его ногами: и вглубь к горизонту, и вправо вдоль берега
    F.origin = () => {
        const L = FB.scene.L;
        return FB.scene.unproject(L.px + L.ph * 0.35, Math.min(L.nearY - 2, L.py + L.ph * 0.3)) || { tx: -0.6, dist: 0.03 };
    };
    const SIDE = 0.45;   // насколько «весит» сдвиг вбок по сравнению с глубиной
    F.reachOf = (tx, dist, o) => Math.hypot((tx - o.tx) * SIDE, dist - o.dist);

    // ---------- Пузыри — места получше ----------
    function updateSpots(dt) {
        spotTimer -= dt;
        const reach = rod().reach;
        if (spotTimer <= 0 && F.spots.length < 2) {
            spotTimer = U.rand(5, 11);
            const o = F.origin();
            for (let i = 0; i < 20; i++) {
                const tx = U.rand(o.tx + 0.25, 0.9), dist = U.rand(0.08, 0.95);
                const e = F.reachOf(tx, dist, o);
                if (e > 0.16 && e < reach - 0.03) { F.spots.push({ tx, dist, t: 0, life: U.rand(9, 14) }); break; }
            }
        }
        F.spots = F.spots.filter(s => (s.t += dt) < s.life);
    }
    function drawSpots(ctx) {
        const SC = FB.scene, u = SC.unit();
        F.spots.forEach(s => {
            const p = SC.project(s.tx, s.dist);
            const fade = Math.min(1, s.t, (s.life - s.t) / 1.5);
            for (let i = 0; i < 3; i++) {
                const k = ((s.t * 0.6 + i / 3) % 1);
                ctx.strokeStyle = 'rgba(255,255,255,' + (0.55 * (1 - k) * fade) + ')';
                ctx.lineWidth = Math.max(1, 1.6 * p.s);
                const r = u * (1.5 + k * 6) * p.s * 1.6;
                ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * 0.3, 0, 0, Math.PI * 2); ctx.stroke();
            }
            // Пузырьки
            for (let i = 0; i < 5; i++) {
                const k = ((s.t * 0.9 + i * 0.37) % 1);
                const bx = p.x + Math.sin(i * 2.1 + s.t) * u * 2 * p.s;
                const by = p.y - k * u * 2.2 * p.s;
                ctx.fillStyle = 'rgba(255,255,255,' + (0.8 * (1 - k) * fade) + ')';
                ctx.beginPath(); ctx.arc(bx, by, Math.max(0.8, u * 0.45 * p.s), 0, Math.PI * 2); ctx.fill();
            }
        });
    }
    function takeSpot(tx, dist) {
        const i = F.spots.findIndex(s => Math.abs(s.tx - tx) < 0.2 + s.dist * 0.15 && Math.abs(s.dist - dist) < 0.1);
        if (i < 0) return false;
        F.spots.splice(i, 1);
        return true;
    }

    // ---------- Ввод ----------
    F.press = (x, y) => {
        F.holding = true;
        switch (F.phase) {
            case 'idle': return tryCast(x, y);
            case 'wait':
                // На уроке рано нажатое не наказываем — просто подскажем
                if (F.ctx.tut) { FB.emit('tutEarly'); return; }
                if (F.nibbleT > 0) return lose('early');
                // Смотать без поклёвки — можно забросить в другое место
                F.phase = 'idle';
                FB.audio.play('click');
                FB.emit('hint', 'tap_water');
                setPose();
                return;
            case 'bite': return hook();
        }
    };
    F.release = () => { F.holding = false; };

    // Случайная точка, куда удочка точно достанет (заброс пробелом)
    F.randomTarget = () => {
        const o = F.origin(), reach = rod().reach;
        for (let i = 0; i < 30; i++) {
            const tx = U.rand(o.tx + 0.3, 0.9), dist = U.rand(0.08, 0.95);
            const e = F.reachOf(tx, dist, o);
            if (e > reach * 0.45 && e < reach * 0.85) return FB.scene.project(tx, dist);
        }
        return FB.scene.project(o.tx + 0.4, o.dist + reach * 0.4);
    };

    function tryCast(x, y) {
        const SC = FB.scene;
        const w = SC.unproject(x, y);
        if (!w) return;
        const r = rod();
        const o = F.origin();
        // Забрасываем только вперёд — вправо от мостков
        let tx = U.clamp(w.tx, o.tx + 0.12, 0.95);
        let dist = Math.max(0.02, w.dist);
        // Немного неточности — чем дальше, тем больше
        let e = F.reachOf(tx, dist, o);
        tx = U.clamp(tx + U.gauss() * 0.02 * (1 + e), o.tx + 0.1, 0.97);
        dist = Math.max(0.02, dist + U.gauss() * 0.012 * (1 + e));
        e = F.reachOf(tx, dist, o);
        // Дальше удочки не долетит — не забрасываем вовсе, а показываем, докуда она достаёт
        if (e > r.reach) {
            F.holding = false;
            F.reachFlash = 1.6;
            FB.audio.play('click');
            FB.emit('toast', { key: 'too_far' });
            return;
        }
        if (e < 0.07) { const k = 0.07 / Math.max(0.001, e); tx = o.tx + (tx - o.tx) * k; dist = o.dist + (dist - o.dist) * k; e = 0.07; }
        const bubble = takeSpot(tx, dist);

        const cfg = FB.state.weekCfg();
        const tut = !!(FB.tutor && FB.tutor.inLesson());
        F.ctx = {
            pond: FB.S.pond, dist: e, bait: FB.S.bait, rod: r,
            weather: FB.scene.weather, bubble, tut,
            weekFish: FB.S.pond === cfg.pond ? cfg.fish : null
        };
        F.res = FB.catcher.roll(F.ctx);
        // Урок: гарантированный карась — первый улов должен получиться
        if (tut) F.res = { kind: 'fish', fish: FB.fishById.crucian, g: 420 };
        F.target = { tx, dist };
        F.phase = 'cast';
        T = 0;
        FB.S.stats.casts++;
        FB.audio.play('cast');
        FB.emit('cast', { bubble });
    }

    function startWait() {
        const SC = FB.scene;
        const p = SC.project(F.target.tx, F.target.dist);
        SC.splash(p.x, p.y, 0.5 * p.s * 1.6);
        FB.audio.play('plop');
        F.phase = 'wait';
        T = 0;
        const res = F.res;
        let wait = U.rand(1.8, 5.2);
        if (F.ctx.bubble) wait *= 0.55;
        if (res.kind === 'fish' && res.fish.bait === F.ctx.bait) wait *= 0.8;
        // 0–2 «пробы» до настоящей поклёвки
        F.nibbles = [];
        if (F.ctx.tut) {
            // На уроке — одна проба посередине, чтобы успеть прочитать подсказки
            wait = 4.2;
            F.nibbles.push(2.1);
        } else {
            const n = U.randInt(0, 2);
            for (let i = 0; i < n; i++) F.nibbles.push(U.rand(0.5, Math.max(0.6, wait - 0.6)));
        }
        F.biteAt = wait;
        F.nibbleT = 0;
        FB.emit('hint', 'wait_bite');
    }

    function bite() {
        F.phase = 'bite';
        T = 0;
        const order = F.res.kind === 'fish' ? FB.RARITY[F.res.fish.r].order : 0;
        F.window = F.ctx.tut ? Infinity : 0.85 - order * 0.04;
        FB.audio.play('bite');
        const p = floatPos();
        FB.scene.ripple(p.x, p.y, 0.6 * p.s * 1.6);
        FB.emit('hint', 'tap_now');
        FB.emit('bite');
    }

    function hook() {
        F.phase = 'fight';
        T = 0;
        const res = F.res;
        F.str = res.kind === 'fish' ? FB.catcher.strength(res.fish, res.g) : FB.catcher.junkStrength(res.junk);
        F.zone = F.zoneFor(F.str, rod());
        F.tension = 0.5;
        F.progress = 0.1;
        F.slack = 0;
        F.strain = 0;
        F.over = 0;
        F.vx = 0;
        F.face = 1;
        F.surge = 0;
        F.surgeIn = U.rand(F.TUNE.surgeEvery[0], F.TUNE.surgeEvery[1]) / (0.75 + F.str * 0.6);
        F.fishTx = F.target.tx;
        F.fishDist = F.target.dist;
        F.dart = 0;
        FB.audio.play('hook');
        const p = floatPos();
        FB.scene.splash(p.x, p.y, 0.9 * p.s * 1.6);
        FB.emit('hint', 'hold_reel');
        FB.emit('fightStart');
    }

    function lose(reason) {
        F.phase = 'lost';
        T = 0;
        F.lostReason = reason;
        FB.S.stats.lost++;
        FB.audio.play(reason === 'snap' ? 'snap' : 'miss');
        FB.emit('lost', { reason, res: F.res });
        FB.state.save();
        setPose();
    }

    function land() {
        F.phase = 'land';
        T = 0;
        const SC = FB.scene;
        const p = SC.project(F.fishTx, F.fishDist);
        F.landFrom = { x: p.x, y: p.y };
        SC.splash(p.x, p.y, 1.3);
        FB.audio.play('splash');
        FB.emit('fightEnd');
    }

    // Вернуть сорвавшуюся рыбу (после рекламы за награду)
    F.restore = () => {
        if (F.phase !== 'lost' && F.phase !== 'idle') return;
        if (!F.res) return;
        const o = F.origin();
        F.fishTx = o.tx + 0.15;
        F.fishDist = o.dist + 0.04;
        land();
    };

    // После карточки улова — снова можно забрасывать
    F.done = () => {
        F.phase = 'idle';
        F.res = null;
        T = 0;
        setPose();
        FB.emit('hint', 'tap_water');
    };

    // ---------- Обновление ----------
    F.update = (dt) => {
        T += dt;
        if (F.reachFlash > 0) F.reachFlash -= dt;
        updateSpots(dt);
        const tune = F.TUNE;
        switch (F.phase) {
            case 'cast':
                if (T >= 0.75) startWait();
                break;
            case 'wait':
                if (F.nibbleT > 0) F.nibbleT -= dt;
                if (F.nibbles.length && T >= F.nibbles[0]) {
                    F.nibbles.shift();
                    F.nibbleT = 0.32;
                    FB.audio.play('nibble');
                    FB.emit('nibble');
                    const p = floatPos();
                    FB.scene.ripple(p.x, p.y, 0.25 * p.s * 1.6);
                }
                if (T >= F.biteAt) bite();
                break;
            case 'bite':
                if (T >= F.window) lose('missed');
                break;
            case 'fight': {
                const s = F.str, r = rod();
                F.surgeIn -= dt;
                if (F.surgeIn <= 0 && F.res.kind === 'fish') {
                    F.surge = tune.surgeLen;
                    F.surgeIn = U.rand(tune.surgeEvery[0], tune.surgeEvery[1]) / (0.75 + s * 0.6);
                    F.dart = (Math.random() < 0.5 ? -1 : 1) * U.rand(0.15, 0.35);
                    FB.audio.play('strain');
                    if (s > 0.45) {
                        const p = FB.scene.project(F.fishTx, F.fishDist);
                        FB.scene.splash(p.x, p.y, 0.6 * p.s * 1.6);
                    }
                }
                const z = F.zone;
                if (F.holding) {
                    F.tension += (tune.riseBase + s * tune.riseStr) * r.ctrl * dt;
                    // В зелёной зоне подматываем в полную силу, в красной — с трудом
                    const k = F.tension > z.hi ? 0.4 : F.tension < z.lo ? 0.8 : 1;
                    F.progress += tune.reel * Math.pow(r.reel, 0.6) * (1 - s * tune.heavy) * dt * k;
                    if (Math.random() < dt * 14) FB.audio.play('reel');
                } else {
                    F.tension -= tune.fall * dt;
                    F.progress -= tune.slip * s * dt;
                }
                if (F.surge > 0) {
                    F.surge -= dt;
                    F.tension += Math.min(s * s * tune.surgePower, tune.surgeCap) * r.ctrl * dt;
                    F.progress -= tune.slip * 2 * s * dt;
                }
                F.tension = U.clamp(F.tension, 0, 1);
                F.progress = U.clamp(F.progress, 0, 1);
                swim(dt, s);
                // Красные зоны: слева леска провисла — рыба уйдёт, справа звенит — лопнет.
                // В упоре (стрелка до конца) леска держится совсем недолго
                const tut = F.ctx.tut;
                if (F.tension >= 1) {
                    F.over += dt;
                    if (F.over > tune.snapGrace && !tut) { lose('snap'); break; }
                } else F.over = 0;
                if (F.tension > z.hi) {
                    F.strain += dt;
                    if (F.strain > tune.strainMax && !tut) { lose('snap'); break; }
                } else F.strain = Math.max(0, F.strain - dt * 2);
                if (F.tension < z.lo) {
                    F.slack += dt;
                    if (F.slack > tune.slackMax && !tut) { lose('slack'); break; }
                } else F.slack = Math.max(0, F.slack - dt * 2);
                if (tut) { F.strain = Math.min(F.strain, tune.strainMax * 0.9); F.slack = Math.min(F.slack, tune.slackMax * 0.9); F.over = 0; }
                if (F.progress >= 1) land();
                break;
            }
            case 'land':
                if (T >= 0.9 && !F.landed) {
                    F.landed = true;
                    FB.emit('landed', { res: F.res, ctx: F.ctx });
                }
                break;
            case 'lost':
                if (T >= 1.1) { F.phase = 'idle'; FB.emit('hint', 'tap_water'); }
                break;
        }
        if (F.phase !== 'land') F.landed = false;
        setPose(dt);
    };

    // Рыба плывёт к мосткам по мере подмотки и ходит из стороны в сторону.
    // Позицию не ставим сразу, а догоняем плавно — так она никогда не «прыгает»
    function swim(dt, s) {
        F.dart *= Math.pow(0.4, dt);
        const wander = Math.sin(T * (1.3 + s)) * 0.12 * (1 - F.progress) + F.dart;
        const o = F.origin();
        const gx = U.clamp(U.lerp(F.target.tx, o.tx + 0.15, F.progress) + wander, o.tx + 0.06, 0.97);
        const gd = Math.max(0.02, U.lerp(F.target.dist, o.dist + 0.04, F.progress));
        const k = 1 - Math.exp(-dt * 3);
        const before = F.fishTx;
        F.fishTx += (gx - F.fishTx) * k;
        F.fishDist += (gd - F.fishDist) * k;
        // Куда смотрит: по тому, куда плывёт, и разворачивается не мгновенно
        if (dt > 0) F.vx = U.lerp(F.vx, (F.fishTx - before) / dt, 1 - Math.exp(-dt * 5));
        const want = Math.abs(F.vx) > 0.02 ? Math.sign(F.vx) : Math.sign(F.face) || 1;
        F.face += (want - F.face) * (1 - Math.exp(-dt * 6));
    }

    // Поза и лицо рыбака от фазы. Угол удочки: -0.8 — вверх-вправо над водой
    function setPose(dt) {
        const pose = FB.person.pose;
        let rodA = -0.8, bend = 0.05, reel = false, lean = 0, face = 'calm';
        if (F.phase === 'cast') {
            // Замах назад через плечо — и резко вперёд
            const k = T / 0.75;
            rodA = k < 0.35 ? U.lerp(-0.8, -2.3, U.smooth(k / 0.35)) : U.lerp(-2.3, -0.5, U.smooth(Math.min(1, (k - 0.35) / 0.3)));
            bend = k > 0.35 && k < 0.6 ? 0.3 : 0.05;
            lean = k < 0.35 ? -0.3 : 0.25;
            face = 'focus';
        } else if (F.phase === 'wait' || F.phase === 'bite') {
            rodA = -0.6;
            bend = 0.1 + (F.phase === 'bite' ? 0.22 : 0) + (F.nibbleT > 0 ? 0.1 : 0);
            lean = 0.1;
            face = F.phase === 'bite' || F.nibbleT > 0 ? 'focus' : 'calm';
        } else if (F.phase === 'fight') {
            rodA = -0.95 - F.tension * 0.4;
            bend = 0.25 + F.tension * 0.65 + (F.surge > 0 ? 0.1 : 0);
            reel = F.holding;
            lean = -F.tension * 0.9;
            face = F.tension > 0.62 || F.surge > 0 ? 'strain' : 'focus';
        } else if (F.phase === 'land') {
            rodA = -1.25;
            bend = 0.15;
            lean = -0.3;
            face = 'happy';
        } else if (F.phase === 'lost') {
            rodA = -0.55;
            face = 'sad';
        }
        const k = dt ? Math.min(1, dt * 12) : 1;
        pose.rod = U.lerp(pose.rod, rodA, k);
        pose.bend = U.lerp(pose.bend, bend, k);
        pose.reel = reel;
        pose.lean = U.lerp(pose.lean, lean, k);
        pose.face = face;
    }

    // Где сейчас поплавок на экране
    function floatPos() {
        const SC = FB.scene;
        if (F.phase === 'fight') return SC.project(F.fishTx, F.fishDist);
        return SC.project(F.target.tx, F.target.dist);
    }

    // Маятник поплавка: угол a, скорость v. Толкают его ветерок и рывки кончика удочки
    F.pend = { a: 0, v: 0, lx: null, ly: 0, vx: 0, lt: 0 };
    function pendulum(tip, u) {
        const p = F.pend, t = FB.scene.t;
        const dt = U.clamp(t - p.lt, 0, 0.05);
        p.lt = t;
        if (p.lx === null || dt === 0) { p.lx = tip.x; p.ly = tip.y; return p; }
        const vx = (tip.x - p.lx) / dt;
        const ax = U.clamp((vx - p.vx) / dt, -6000, 6000);
        p.vx = vx; p.lx = tip.x; p.ly = tip.y;
        const len = u * 9;
        const wind = Math.sin(t * 0.9) * 0.25 + Math.sin(t * 2.3) * 0.08;
        const acc = -20 * Math.sin(p.a) - 1.8 * p.v - (ax / len) * Math.cos(p.a) * 0.4 + wind;
        p.v += acc * dt;
        p.a = U.clamp(p.a + p.v * dt, -1.2, 1.2);
        return p;
    }

    // ---------- Рисование ----------
    // Граница, докуда достаёт удочка: пунктир по воде (после «слишком далеко»)
    F.reachFlash = 0;
    function drawReach(ctx, a) {
        const SC = FB.scene, o = F.origin(), reach = rod().reach, u = SC.unit();
        ctx.save();
        ctx.setLineDash([u * 1.6, u * 1.2]);
        ctx.lineCap = 'round';
        ctx.lineWidth = Math.max(2, u * 0.5);
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.85 * a) + ')';
        ctx.shadowColor = 'rgba(0,40,80,' + (0.35 * a) + ')';
        ctx.shadowBlur = u;
        ctx.beginPath();
        let started = false;
        for (let i = 0; i <= 48; i++) {
            const ang = -Math.PI / 2 + Math.PI * i / 48;   // от «к нам» до «вглубь»
            const tx = o.tx + Math.cos(ang) * reach / SIDE, dist = o.dist + Math.sin(ang) * reach;
            if (dist < 0.01 || tx < o.tx + 0.05) continue;
            const p = SC.project(tx, dist);
            if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
        ctx.restore();
    }

    function line(ctx, x0, y0, x1, y1, sag) {
        ctx.strokeStyle = FB.scene.weather === 'night' ? 'rgba(220,230,255,0.55)' : 'rgba(255,255,255,0.75)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo((x0 + x1) / 2, Math.max(y0, y1) + sag, x1, y1);
        ctx.stroke();
    }

    F.draw = (ctx, layer) => {
        const SC = FB.scene, P = FB.person, u = SC.unit();
        if (layer === 'water') {
            drawSpots(ctx);
            if (F.reachFlash > 0) drawReach(ctx, Math.min(1, F.reachFlash / 0.5));
            const tip = P.rodTip();
            if (F.phase === 'wait' || F.phase === 'bite') {
                const p = floatPos();
                let sub = 0, wob = Math.sin(SC.t * 2.2) * 0.06;
                const bob = Math.sin(SC.t * 2.6) * u * 0.25 * p.s;
                if (F.nibbleT > 0) sub = Math.sin((0.32 - F.nibbleT) / 0.32 * Math.PI) * 0.45;
                if (F.phase === 'bite') { sub = 0.8 + Math.sin(T * 30) * 0.08; wob = Math.sin(T * 25) * 0.2; }
                line(ctx, tip.x, tip.y, p.x, p.y + bob - u * 1.5 * p.s, u * 4);
                P.drawFloat(ctx, p.x, p.y + bob, p.s, sub, wob);
                // Лёгкий круг вокруг поплавка
                ctx.strokeStyle = 'rgba(255,255,255,0.25)';
                ctx.lineWidth = 1;
                ctx.beginPath(); ctx.ellipse(p.x, p.y + bob, u * 2.2 * p.s, u * 0.6 * p.s, 0, 0, Math.PI * 2); ctx.stroke();
            } else if (F.phase === 'fight') {
                const p = floatPos();
                // Тень рыбы под водой
                const big = F.res.kind === 'fish' ? U.clamp(Math.log10(F.res.g) / 4, 0.4, 1.4) : 0.6;
                const sw = u * 6 * big * p.s * 1.6;
                ctx.save();
                ctx.translate(p.x, p.y + u * 0.6 * p.s);
                ctx.scale(Math.abs(F.face) < 0.15 ? 0.15 * (Math.sign(F.face) || 1) : F.face, 1);
                ctx.fillStyle = 'rgba(10,30,50,0.35)';
                ctx.beginPath(); ctx.ellipse(0, 0, sw, sw * 0.28, 0, 0, Math.PI * 2); ctx.fill();
                const tw = Math.sin(SC.t * 14) * sw * 0.15;
                ctx.beginPath(); ctx.moveTo(-sw * 0.85, 0); ctx.lineTo(-sw * 1.35, -sw * 0.25 + tw); ctx.lineTo(-sw * 1.35, sw * 0.25 + tw); ctx.closePath(); ctx.fill();
                ctx.restore();
                // Леска натянута и дрожит
                const shake = (F.tension > 0.7 ? (F.tension - 0.7) * 4 : 0) * Math.sin(SC.t * 60) * u * 0.3;
                const sag = (1 - F.tension) * u * 5;
                line(ctx, tip.x, tip.y, p.x + shake, p.y, sag);
                // Бурунчики там, где леска входит в воду
                if (Math.random() < 0.3) SC.ripple(p.x, p.y, 0.2 * p.s * 1.6);
            }
        } else if (layer === 'front') {
            P.drawBoatBack(ctx);
            P.drawLantern(ctx);
            P.drawPet(ctx);
            P.drawPerson(ctx);
            P.drawBoatFront(ctx);
            const tip = P.rodTip();
            const castK = F.phase === 'cast' ? T / 0.75 : 0;
            if (F.phase === 'idle' || F.phase === 'lost' || (F.phase === 'cast' && castK <= 0.35)) {
                // Поплавок висит на леске под кончиком удочки — маятник:
                // раскачивается от ветерка и пружинит, когда удочка двигается
                F.hang = pendulum(tip, u);
                F.hangPos = P.drawHangingFloat(ctx, tip.x, tip.y, F.pend.a, u * 5, 1.1);
            } else if (F.phase === 'cast') {
                const q = U.smooth((castK - 0.35) / 0.65);
                const end = SC.project(F.target.tx, F.target.dist);
                const from = F.hangPos || tip;
                const x = U.lerp(from.x, end.x, q);
                const y = U.lerp(from.y, end.y, q) - Math.sin(q * Math.PI) * SC.H * 0.18;
                line(ctx, tip.x, tip.y, x, y - P.floatTop(U.lerp(1.1, end.s, q)), u * 2);
                P.drawFloat(ctx, x, y, U.lerp(1.1, end.s, q), 0, q * 6, true);
                F.pend.a = 0; F.pend.v = 0;
            } else if (F.phase === 'bite') {
                // Восклицательный знак над поплавком
                const p = floatPos();
                const s = 1 + Math.sin(T * 18) * 0.12;
                const r = u * 3.2 * s;
                const y = p.y - u * 7 * Math.max(0.6, p.s);
                ctx.fillStyle = '#ffd23a';
                ctx.strokeStyle = '#b8560e';
                ctx.lineWidth = u * 0.5;
                ctx.beginPath(); ctx.arc(p.x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                ctx.fillStyle = '#7a2e06';
                ctx.font = '900 ' + Math.round(r * 1.5) + 'px Nunito, sans-serif';
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText('!', p.x, y + r * 0.08);
            } else if (F.phase === 'land' && F.res && !F.landed) {
                // Рыба вылетает из воды к игроку
                const k = Math.min(1, T / 0.8);
                const q = U.smooth(k);
                const tx = SC.W / 2, ty = SC.H * 0.42;
                const x = U.lerp(F.landFrom.x, tx, q), y = U.lerp(F.landFrom.y, ty, q) - Math.sin(q * Math.PI) * SC.H * 0.12;
                const id = F.res.kind === 'fish' ? F.res.fish.id : F.res.junk.id;
                const img = FB.fishArt.canvas(id, 160);
                const size = U.lerp(u * 8, Math.min(SC.W, SC.H) * 0.45, q);
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(Math.sin(T * 16) * 0.25 * (1 - q * 0.6));
                ctx.drawImage(img, -size / 2, -size / 2 * img.height / img.width, size, size * img.height / img.width);
                ctx.restore();
                if (!F.sparkled && k > 0.6 && F.res.kind === 'fish' && FB.RARITY[F.res.fish.r].order >= 2) {
                    F.sparkled = true;
                    SC.sparkle(tx, ty, 24, FB.RARITY[F.res.fish.r].glow);
                }
                if (k < 0.6) F.sparkled = false;
            }
        }
    };

    // Для интерфейса: состояние вываживания
    F.fightInfo = () => F.phase === 'fight' ? {
        tension: F.tension, progress: F.progress, lo: F.zone.lo, hi: F.zone.hi, surge: F.surge > 0,
        slack: F.slack / F.TUNE.slackMax,
        strain: Math.max(F.strain / F.TUNE.strainMax, F.over / F.TUNE.snapGrace)
    } : null;
})(window.FB);
