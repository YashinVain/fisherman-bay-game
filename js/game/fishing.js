// fishing.js — сама рыбалка: заброс → ожидание → поклёвка → подсечка →
// вываживание → улов. Здесь же «пузыри» на воде (место, где клюёт лучше)
// и рисование всего, что связано с поплавком и рыбой.
//
// Управление одним пальцем:
//   • нажал на воду — заброс туда;
//   • поплавок нырнул — нажми (подсечка);
//   • вываживание — держи палец, чтобы подматывать, отпускай, если леска
//     натянулась до красной зоны.
//   • нажал во время ожидания — смотал удочку (если не было поклёвки).

(function (FB) {
    const F = FB.fishing = {};
    const U = FB.U;

    // Настройки вываживания — подобраны симуляцией (tools/sim.js)
    F.TUNE = {
        greenLo: 0.14, greenHi: 0.8,
        riseBase: 0.4, riseStr: 0.75,     // рост натяжения, когда тянешь
        fall: 0.9,                        // ослабление, когда отпустил
        reel: 0.34,                       // скорость подмотки
        slackMax: 2.4,                    // сколько можно держать леску провисшей, с
        snapGrace: 0.35,                  // столько леска выдерживает на пределе, с
        surgeEvery: [1.4, 3.2],
        surgeLen: 0.5, surgePower: 3.2      // рывок: сила × сила рыбы², хорошая удочка гасит
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
    const easy = () => FB.S.settings.easy;

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
        // Дальше удочки не долетит — поплавок упадёт на границе её дальности
        if (e > r.reach) {
            const k = r.reach / e;
            tx = o.tx + (tx - o.tx) * k;
            dist = o.dist + (dist - o.dist) * k;
            e = r.reach;
            FB.emit('toast', { key: 'too_far' });
        }
        if (e < 0.07) { const k = 0.07 / Math.max(0.001, e); tx = o.tx + (tx - o.tx) * k; dist = o.dist + (dist - o.dist) * k; e = 0.07; }
        const bubble = takeSpot(tx, dist);

        const cfg = FB.state.weekCfg();
        F.ctx = {
            pond: FB.S.pond, dist: e, bait: FB.S.bait, rod: r,
            weather: FB.scene.weather, bubble,
            weekFish: FB.S.pond === cfg.pond ? cfg.fish : null
        };
        F.res = FB.catcher.roll(F.ctx);
        // Первый заброс в жизни — гарантированный карась и быстрая поклёвка (обучение)
        if (FB.S.tut < 99 && FB.S.stats.catches === 0) {
            const f = FB.fishById.crucian;
            F.res = { kind: 'fish', fish: f, g: 420 };
        }
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
        if (FB.S.stats.catches === 0) wait = 1.6;
        F.biteAt = wait;
        // 0–2 «пробы» до настоящей поклёвки
        F.nibbles = [];
        const n = FB.S.stats.catches === 0 ? 1 : U.randInt(0, 2);
        for (let i = 0; i < n; i++) F.nibbles.push(U.rand(0.5, Math.max(0.6, wait - 0.6)));
        F.nibbleT = 0;
        FB.emit('hint', 'wait_bite');
    }

    function bite() {
        F.phase = 'bite';
        T = 0;
        const order = F.res.kind === 'fish' ? FB.RARITY[F.res.fish.r].order : 0;
        F.window = (easy() ? 1.3 : 0.85) - order * 0.04;
        if (FB.S.stats.catches === 0) F.window = 2.5;
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
        F.tension = 0.35;
        F.progress = 0.1;
        F.slack = 0;
        F.over = 0;
        F.surge = 0;
        F.surgeIn = U.rand(F.TUNE.surgeEvery[0], F.TUNE.surgeEvery[1]) / (0.6 + F.str);
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
                const ease = easy() ? 0.72 : 1;
                F.surgeIn -= dt;
                if (F.surgeIn <= 0 && F.res.kind === 'fish') {
                    F.surge = tune.surgeLen;
                    F.surgeIn = U.rand(tune.surgeEvery[0], tune.surgeEvery[1]) / (0.6 + s);
                    F.dart = (Math.random() < 0.5 ? -1 : 1) * U.rand(0.15, 0.35);
                    FB.audio.play('strain');
                    if (s > 0.45) {
                        const p = FB.scene.project(F.fishTx, F.fishDist);
                        FB.scene.splash(p.x, p.y, 0.6 * p.s * 1.6);
                    }
                }
                if (F.holding) {
                    F.tension += (tune.riseBase + s * tune.riseStr) * r.ctrl * ease * dt;
                    F.progress += tune.reel * Math.pow(r.reel, 0.6) * (1 - s * 0.62) * dt * (F.tension < tune.greenHi ? 1 : 0.55);
                    if (Math.random() < dt * 14) FB.audio.play('reel');
                } else {
                    F.tension -= tune.fall * dt;
                    F.progress -= 0.04 * s * dt;
                }
                if (F.surge > 0) {
                    F.surge -= dt;
                    F.tension += s * s * tune.surgePower * r.ctrl * ease * dt;
                    F.progress -= 0.06 * s * dt;
                }
                F.tension = U.clamp(F.tension, 0, 1);
                F.progress = U.clamp(F.progress, 0, 1);
                // Рыба ходит из стороны в сторону и тянется к мосткам
                F.dart *= Math.pow(0.4, dt);
                const wander = Math.sin(T * (1.3 + s)) * 0.12 * (1 - F.progress) + F.dart;
                // Рыба ходит из стороны в сторону и тянется к мосткам
                const o = F.origin();
                F.fishTx = U.clamp(U.lerp(F.target.tx, o.tx + 0.15, F.progress) + wander, o.tx + 0.06, 0.97);
                F.fishDist = Math.max(0.02, U.lerp(F.target.dist, o.dist + 0.04, F.progress));
                // На пределе леска «звенит» чуть-чуть — успеешь отпустить, если не зевать
                if (F.tension >= 1) {
                    F.over += dt;
                    if (F.over > tune.snapGrace) { lose('snap'); break; }
                } else F.over = 0;
                if (F.tension < tune.greenLo) {
                    F.slack += dt;
                    if (F.slack > tune.slackMax) { lose('slack'); break; }
                } else F.slack = Math.max(0, F.slack - dt * 2);
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

    // ---------- Рисование ----------
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
                const dir = Math.sign(F.dart || Math.cos(T * 1.3)) || 1;
                ctx.save();
                ctx.translate(p.x, p.y + u * 0.6 * p.s);
                ctx.scale(dir, 1);
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
            if (F.phase === 'idle' || F.phase === 'lost') {
                // Поплавок висит на кончике удочки и чуть качается
                const sw = Math.sin(SC.t * 1.8) * u * 0.8;
                const fx = tip.x + sw, fy = tip.y + u * 7;
                line(ctx, tip.x, tip.y, fx, fy - u * 2, 0);
                P.drawFloat(ctx, fx, fy, 1.1, 0, sw * 0.03);
            } else if (F.phase === 'cast') {
                const k = T / 0.75;
                if (k > 0.35) {
                    const q = U.smooth((k - 0.35) / 0.65);
                    const end = SC.project(F.target.tx, F.target.dist);
                    const x = U.lerp(tip.x, end.x, q);
                    const y = U.lerp(tip.y, end.y, q) - Math.sin(q * Math.PI) * SC.H * 0.18;
                    line(ctx, tip.x, tip.y, x, y, u * 2);
                    P.drawFloat(ctx, x, y + u * 2, U.lerp(1.1, end.s, q), 0, q * 6);
                }
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
    F.fightInfo = () => F.phase === 'fight' ? { tension: F.tension, progress: F.progress, slack: F.slack / F.TUNE.slackMax, surge: F.surge > 0 } : null;
})(window.FB);
