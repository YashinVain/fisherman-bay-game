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
//
// У каждой рыбы свой характер (FB.FISH[].st): рывки, свечки (в прыжке надо
// отпустить), тяга на глубину, уход в камыш (надо вести палец в другую сторону).
// Подсёк сразу — «отличная подсечка». Уловы подряд копят серию удачи.
//
// Способ ловли зависит от наживки (FB.BAITS[].mode):
//   • float  — поплавок: ждёшь, пока нырнёт;
//   • spin   — спиннинг (блесна): поплавка нет, ведёшь блесну к себе короткими
//     рывками «нажал-отпустил» — хищник бросается на играющую приманку.
//     Довёл до берега без поклёвки — просто забрасываешь снова;
//   • bottom — донка (креветка): на кончике удочки колокольчик, ждать дольше,
//     зато рыба крупнее и подсечь можно не так быстро.

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
        surgeCap: 1.6,                    // ...но не сильнее этого — чтобы любую рыбу можно было вытащить
        jumpWarn: 0.5, jumpLen: 0.9,      // свечка: предупреждение и время в воздухе
        jumpPull: 2.4,                    // как быстро растёт натяжение, если держать в прыжке
        runLen: 2.6                       // сколько рыба уходит в камыш, пока не запутается
    };

    // Характеры: every — как часто выкидывает фокусы, len/power — рывок, dart — уход вбок,
    // jump/run — доля событий-прыжков/уходов в камыш, pull — тяга на глубину
    F.STYLE = {
        calm: { every: 1.3, len: 0.5, power: 0.75, dart: 0.6 },
        dart: { every: 0.7, len: 0.28, power: 1.6, dart: 1.6 },
        jump: { every: 1.1, len: 0.45, power: 1.0, dart: 0.8, jump: 0.55 },
        dive: { every: 1.3, len: 1.2, power: 0.4, dart: 0.4, pull: 2.5 },
        snag: { every: 1.2, len: 0.5, power: 0.9, dart: 0.8, run: 0.5 }
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
    F.px = 0;             // где сейчас палец (для «веди в сторону»)
    F.call = null;        // надпись над рыбой: { key, t, warn }
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
                // Спиннинг: нажатие — подмотка блесны, а не сматывание
                if (F.mode === 'spin') { F.spinHold = 0; return; }
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
            case 'fight':
                F.px = x;
                // Рыба уходит в камыш: нажатие с другой стороны от рыбы — повести удочку туда
                if (F.run) {
                    const p = FB.scene.project(F.fishTx, F.fishDist);
                    if (Math.abs(x - p.x) > FB.scene.W * 0.08) F.steer(x < p.x ? -1 : 1);
                }
                return;
        }
    };
    F.release = () => {
        // Спиннинг: короткое нажатие-отпускание — блесна «играет», хищник замечает
        if (F.holding && F.phase === 'wait' && F.mode === 'spin' && F.spinHold > 0.06 && F.spinHold < 0.9) {
            F.spin.attract += 0.5 + Math.random() * 0.2;
            F.spin.twitch = 0.35;
            FB.audio.play('twitch');
        }
        F.holding = false;
    };
    // Палец ведут по экрану (во время вываживания)
    F.move = (x) => {
        F.px = x;
        if (F.phase === 'fight' && F.run && F.holding && (x - F.run.x0) * -F.run.dir > FB.scene.W * 0.05) F.steer(-F.run.dir);
    };
    // Повести удочку в сторону: если против хода рыбы — она разворачивается
    F.steer = (dir) => {
        if (F.phase !== 'fight' || !F.run) return;
        if (dir !== -F.run.dir) return;
        F.run = null;
        F.dart = 0;
        F.progress = Math.min(1, F.progress + 0.03);
        say('freed');
        FB.audio.play('nibble');
    };
    function say(key, warn, dur) { F.call = { key, t: 0, warn: !!warn, dur: dur || 1.2 }; FB.emit('fishCall', key); }

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
        F.mode = tut ? 'float' : (FB.baitById[FB.S.bait].mode || 'float');
        F.ctx = {
            pond: FB.S.pond, dist: e, bait: FB.S.bait, rod: r,
            weather: FB.scene.weather, bubble, tut, heavy: F.mode === 'bottom',
            weekFish: FB.S.pond === cfg.pond ? cfg.fish : null
        };
        // Особенность места (тень, огонёк, косяк, прилив, течение) — до броска
        const pre = FB.places ? FB.places.beforeRoll(F.ctx, tx, dist) : null;
        // Серия удачи: каждый улов подряд чуть повышает шанс на редкую рыбу
        if (!tut) F.ctx.luckMul = (F.ctx.luckMul || 1) * FB.state.streakMul();
        F.res = pre || FB.catcher.roll(F.ctx);
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
        wait *= F.ctx.waitMul || 1;
        const frenzy = FB.events && FB.events.frenzyOn() && !F.ctx.tut;
        if (frenzy) wait = Math.min(wait, U.rand(0.5, 1.1));
        // 0–2 «пробы» до настоящей поклёвки
        F.nibbles = [];
        if (F.ctx.tut) {
            // На уроке — одна проба посередине, чтобы успеть прочитать подсказки
            wait = 4.2;
            F.nibbles.push(2.1);
        } else if (!F.ctx.noNibble && !frenzy) {
            const n = U.randInt(0, 2);
            for (let i = 0; i < n; i++) F.nibbles.push(U.rand(0.5, Math.max(0.6, wait - 0.6)));
        }
        if (F.mode === 'bottom') {
            // Донка: ждать дольше, колокольчик звякает на пробах
            wait = wait * 1.35 + 1;
            F.nibbles = [];
            for (let i = 0; i < U.randInt(1, 3); i++) F.nibbles.push(U.rand(0.8, Math.max(1, wait - 0.6)));
            F.nibbles.sort((a, b) => a - b);
        }
        if (F.mode === 'spin') {
            // Спиннинг: клюёт не по времени, а когда блесна «наиграет» на хищника
            F.nibbles = [];
            const likes = res.kind === 'fish' && res.fish.bait === 'spinner';
            F.spin = { attract: 0, need: U.rand(1.4, 2.6) * (likes ? 0.8 : 1.15) * (F.ctx.waitMul || 1), twitch: 0, empty: false };
            if (frenzy) F.spin.need *= 0.4;
            wait = Infinity;
            F.spinHold = 0;
        }
        F.biteAt = wait;
        F.nibbleT = 0;
        FB.emit('hint', F.mode === 'spin' ? 'spin' : 'wait_bite');
    }

    function bite() {
        F.phase = 'bite';
        T = 0;
        const order = F.res.kind === 'fish' ? FB.RARITY[F.res.fish.r].order : 0;
        F.window = F.ctx.tut ? Infinity : (F.mode === 'bottom' ? 1.5 : F.mode === 'spin' ? 1.0 : 0.85) - order * 0.04;
        FB.audio.play(F.mode === 'bottom' ? 'bell' : 'bite', 1);
        const p = floatPos();
        FB.scene.ripple(p.x, p.y, 0.6 * p.s * 1.6);
        FB.emit('hint', 'tap_now');
        FB.emit('bite');
    }

    function hook() {
        // Подсёк сразу, как нырнул поплавок, — «отличная подсечка»: рыба ближе с самого начала
        F.perfect = !F.ctx.tut && T <= Math.max(0.22, F.window * 0.35);
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
        F.style = F.STYLE[res.kind === 'fish' ? res.fish.st || 'calm' : 'calm'];
        F.styleId = res.kind === 'fish' ? res.fish.st || 'calm' : 'calm';
        F.surgeIn *= F.style.every;
        F.jumpWarn = 0; F.jump = 0; F.jumpHeld = 0;
        F.run = null;
        F.call = null;
        if (F.perfect) { F.progress = 0.2; say('perfect', false, 1.4); FB.audio.play('perfect'); }
        FB.audio.play('hook', F.str);
        const p = floatPos();
        FB.scene.splash(p.x, p.y, 0.9 * p.s * 1.6);
        FB.emit('hint', 'hold_reel');
        FB.emit('fightStart');
    }

    function lose(reason) {
        F.phase = 'lost';
        T = 0;
        F.lostReason = reason;
        F.run = null; F.jump = 0; F.jumpWarn = 0; F.call = null;
        FB.S.stats.lost++;
        if (F.ctx && !F.ctx.tut) FB.state.streakBreak();
        FB.audio.play(reason === 'snap' ? 'snap' : 'miss');
        FB.emit('lost', { reason, res: F.res });
        FB.state.save();
        setPose();
    }

    function land() {
        F.phase = 'land';
        T = 0;
        F.run = null; F.jump = 0; F.jumpWarn = 0; F.call = null;
        if (F.res && F.res.kind === 'fish' && !F.ctx.tut) FB.state.streakUp(F.perfect);
        const SC = FB.scene;
        const p = SC.project(F.fishTx, F.fishDist);
        F.landFrom = { x: p.x, y: p.y };
        SC.splash(p.x, p.y, 1.3);
        FB.audio.play('splash', F.res && F.res.kind === 'fish' ? U.clamp(Math.log10(F.res.g) / 3, 0.3, 1.4) : 0.5);
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
        if (F.call) { F.call.t += dt; if (F.call.t > F.call.dur) F.call = null; }
        if (FB.events) FB.events.update(dt);
        if (FB.drift) FB.drift.update(dt);
        if (FB.places) FB.places.update(dt);
        if (F.reachFlash > 0) F.reachFlash -= dt;
        updateSpots(dt);
        const tune = F.TUNE;
        switch (F.phase) {
            case 'cast':
                if (T >= 0.75) startWait();
                break;
            case 'wait':
                if (F.nibbleT > 0) F.nibbleT -= dt;
                // Речка: течение несёт поплавок вдоль берега
                if (F.ctx.drift && F.mode !== 'spin') F.target.tx = Math.min(0.97, F.target.tx + F.ctx.drift * dt);
                if (F.mode === 'spin') { spinUpdate(dt); break; }
                if (F.nibbles.length && T >= F.nibbles[0]) {
                    F.nibbles.shift();
                    F.nibbleT = 0.32;
                    FB.audio.play(F.mode === 'bottom' ? 'bell' : 'nibble', 0.4);
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
                const s = F.str, r = rod(), sty = F.style;
                F.surgeIn -= dt;
                if (F.surgeIn <= 0 && F.res.kind === 'fish' && !F.jump && !F.jumpWarn && !F.run) {
                    F.surgeIn = U.rand(tune.surgeEvery[0], tune.surgeEvery[1]) / (0.75 + s * 0.6) * sty.every;
                    const roll = Math.random();
                    if (sty.jump && roll < sty.jump && F.progress < 0.9) {
                        // Свечка: сначала вода вздувается (предупреждение), потом рыба в воздухе
                        F.jumpWarn = tune.jumpWarn;
                        say('jump', true, tune.jumpWarn + tune.jumpLen);
                    } else if (sty.run && roll < sty.run && F.progress < 0.85) {
                        // Уходит в камыш — в ближнюю к краю сторону
                        const p = FB.scene.project(F.fishTx, F.fishDist);
                        const dir = p.x > FB.scene.W * 0.55 ? 1 : -1;
                        F.run = { dir, t: 0, x0: F.px };
                        // Подсказка — куда вести: в другую сторону от рыбы
                        say(dir > 0 ? 'run_l' : 'run_r', true, tune.runLen);
                        FB.audio.play('strain', 0.9);
                    } else {
                        F.surge = sty.len;
                        F.dart = (Math.random() < 0.5 ? -1 : 1) * U.rand(0.15, 0.35) * sty.dart;
                        FB.audio.play('surge', s);
                        if (F.styleId === 'dart') say('dart', false, 0.7);
                        else if (F.styleId === 'dive') say('dive', false, sty.len);
                        if (s > 0.45 || F.styleId === 'dart') {
                            const p = FB.scene.project(F.fishTx, F.fishDist);
                            FB.scene.splash(p.x, p.y, 0.6 * p.s * 1.6);
                        }
                    }
                }
                // Свечка
                if (F.jumpWarn > 0) {
                    F.jumpWarn -= dt;
                    if (F.jumpWarn <= 0) {
                        F.jump = tune.jumpLen; F.jumpHeld = 0;
                        const p = FB.scene.project(F.fishTx, F.fishDist);
                        FB.scene.splash(p.x, p.y, 1.0 * Math.max(0.5, p.s) * 1.6);
                        FB.audio.play('splash', 0.6 + s * 0.6);
                    }
                }
                if (F.jump > 0) {
                    F.jump -= dt;
                    if (F.holding) { F.jumpHeld += dt; F.tension += tune.jumpPull * r.ctrl * dt; }
                    if (F.jump <= 0) {
                        F.jump = 0;
                        const p = FB.scene.project(F.fishTx, F.fishDist);
                        FB.scene.splash(p.x, p.y, 1.1 * Math.max(0.5, p.s) * 1.6);
                        FB.audio.play('splash', 0.5 + s * 0.6);
                        // Отпустил вовремя — рыба устала
                        if (F.jumpHeld < 0.25) { F.progress = Math.min(1, F.progress + 0.05); say('good', false, 1); }
                    }
                }
                // Уход в камыш: рыба тянет вбок, пока не повести удочку в другую сторону
                if (F.run) {
                    F.run.t += dt;
                    F.dart = F.run.dir * 0.45;
                    F.tension += 0.45 * r.ctrl * dt;
                    F.progress -= tune.slip * 2 * s * dt;
                    if (F.run.t > tune.runLen) {
                        F.run = null;
                        F.progress = Math.max(0, F.progress - 0.12);
                        F.tension = Math.min(F.tension, F.zone.lo + 0.05);
                        F.slack = Math.min(F.slack, tune.slackMax * 0.5);
                        say('tangled', true, 1.2);
                        FB.audio.play('miss');
                    }
                }
                const z = F.zone;
                if (F.holding) {
                    F.tension += (tune.riseBase + s * tune.riseStr) * r.ctrl * dt;
                    // В зелёной зоне подматываем в полную силу, в красной — с трудом
                    const k = F.tension > z.hi ? 0.4 : F.tension < z.lo ? 0.8 : 1;
                    // Пока рыба уходит в камыш, подмотать почти не получается — сначала разверни
                    F.progress += tune.reel * Math.pow(r.reel, 0.6) * (1 - s * tune.heavy) * dt * k * (F.run ? 0.2 : 1);
                    if (Math.random() < dt * (10 + F.tension * 8)) FB.audio.play('reel', F.tension);
                    if (F.tension > z.hi && Math.random() < dt * 4) FB.audio.play('strain', F.tension);
                } else {
                    F.tension -= tune.fall * dt;
                    F.progress -= tune.slip * s * dt;
                }
                if (F.surge > 0) {
                    F.surge -= dt;
                    F.tension += Math.min(s * s * tune.surgePower * sty.power, tune.surgeCap) * r.ctrl * dt;
                    F.progress -= tune.slip * 2 * (sty.pull || 1) * s * dt;
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
                if (F.tension < z.lo && !F.jump) {
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

    // Спиннинг: блесна идёт к рыбаку, пока держишь палец. Рывки «нажал-отпустил»
    // копят интерес хищника (attract); ровная подмотка — почти не копит
    function spinUpdate(dt) {
        const sp = F.spin, o = F.origin();
        if (sp.twitch > 0) sp.twitch -= dt;
        if (F.holding) {
            F.spinHold += dt;
            const v = 0.12 * dt;
            const dx = o.tx + 0.12 - F.target.tx, dd = o.dist - F.target.dist;
            const len = Math.hypot(dx * 0.45, dd) || 1;
            F.target.tx += dx * 0.45 / len * v / 0.45;
            F.target.dist = Math.max(0.02, F.target.dist + dd / len * v);
            sp.attract += dt * 0.12;
            if (Math.random() < dt * 12) FB.audio.play('reel', 0.2);
        }
        // Довёл до берега — пусто, забрасывай снова
        if (F.reachOf(F.target.tx, F.target.dist, o) < 0.09) {
            F.phase = 'idle';
            T = 0;
            F.holding = false;
            FB.emit('toast', { key: 'spin_empty' });
            setPose();
            return;
        }
        if (sp.attract >= sp.need) bite();
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
            if (F.mode === 'spin') {
                // Рывок удилищем на каждом «нажал-отпустил»
                rodA = -0.75 - (F.holding ? 0.12 : 0) - (F.spin && F.spin.twitch > 0 ? F.spin.twitch * 0.6 : 0);
                reel = F.holding;
            } else if (F.mode === 'bottom') {
                rodA = -0.5;
                bend = 0.12 + (F.phase === 'bite' ? 0.35 + Math.sin(T * 40) * 0.06 : 0) + (F.nibbleT > 0 ? 0.12 + Math.sin(F.nibbleT * 60) * 0.05 : 0);
            }
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
            if (FB.places) FB.places.draw(ctx);
            if (FB.events) FB.events.draw(ctx);
            if (FB.drift) FB.drift.draw(ctx);
            if (F.reachFlash > 0) drawReach(ctx, Math.min(1, F.reachFlash / 0.5));
            const tip = P.rodTip();
            if ((F.phase === 'wait' || F.phase === 'bite') && F.mode === 'spin') {
                drawLure(ctx, tip, SC, u);
            } else if ((F.phase === 'wait' || F.phase === 'bite') && F.mode === 'bottom') {
                // Донка: леска прямо в воду, без поплавка; у входа в воду — кружки
                const p = floatPos();
                const taut = F.phase === 'bite' ? 0 : F.nibbleT > 0 ? u : u * 2.5;
                line(ctx, tip.x, tip.y, p.x, p.y, taut);
                const k = (SC.t * 0.8) % 1;
                ctx.strokeStyle = 'rgba(255,255,255,' + (0.35 * (1 - k) + (F.phase === 'bite' ? 0.3 : 0)) + ')';
                ctx.lineWidth = 1;
                ctx.beginPath(); ctx.ellipse(p.x, p.y, u * (1 + k * 2.5) * p.s * 1.6, u * (0.3 + k * 0.7) * p.s * 1.6, 0, 0, Math.PI * 2); ctx.stroke();
            } else if (F.phase === 'wait' || F.phase === 'bite') {
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
                drawJump(ctx);
                if (F.jump > 0) {
                    const shake0 = 0;
                    line(ctx, tip.x, tip.y, p.x, p.y - FB.scene.unit() * 6 * Math.max(0.5, p.s), (1 - F.tension) * u * 5 + shake0);
                    drawCall(ctx);
                    return;
                }
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
                drawCall(ctx);
            }
        } else if (layer === 'front') {
            P.drawBoatBack(ctx);
            P.drawLantern(ctx);
            P.drawPet(ctx);
            P.drawPerson(ctx);
            P.drawBoatFront(ctx);
            const tip = P.rodTip();
            const castK = F.phase === 'cast' ? T / 0.75 : 0;
            if (F.mode === 'bottom' && (F.phase === 'wait' || F.phase === 'bite')) drawBell(ctx, tip, u);
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
    // Колокольчик донки: висит на кончике, звенит и качается на поклёвке
    function drawBell(ctx, tip, u) {
        const swing = F.phase === 'bite' ? Math.sin(T * 28) * 0.7 : F.nibbleT > 0 ? Math.sin(F.nibbleT * 40) * 0.5 : Math.sin(FB.scene.t * 1.5) * 0.08;
        const r = u * 1.3;
        ctx.save();
        ctx.translate(tip.x, tip.y);
        ctx.rotate(swing);
        ctx.strokeStyle = '#4a3a20'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, r * 0.6); ctx.stroke();
        const g = ctx.createLinearGradient(-r, 0, r, 0);
        g.addColorStop(0, '#c88a10'); g.addColorStop(0.45, '#ffe27a'); g.addColorStop(1, '#b8760a');
        ctx.fillStyle = g;
        ctx.strokeStyle = '#6a4206';
        ctx.lineWidth = Math.max(1, u * 0.18);
        ctx.beginPath();
        ctx.moveTo(-r * 0.15, r * 0.6);
        ctx.quadraticCurveTo(-r * 0.75, r * 0.8, -r * 0.8, r * 1.9);
        ctx.lineTo(r * 0.8, r * 1.9);
        ctx.quadraticCurveTo(r * 0.75, r * 0.8, r * 0.15, r * 0.6);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#6a4206';
        ctx.beginPath(); ctx.arc(0, r * 2.05, r * 0.22, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        if (F.phase === 'bite') {
            // Звон — расходящиеся дужки
            const k = (T * 3) % 1;
            ctx.strokeStyle = 'rgba(255,230,140,' + (1 - k) + ')';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(tip.x, tip.y + r, r * (1.5 + k * 2), -0.6, 0.6); ctx.stroke();
            ctx.beginPath(); ctx.arc(tip.x, tip.y + r, r * (1.5 + k * 2), Math.PI - 0.6, Math.PI + 0.6); ctx.stroke();
        }
    }

    // Блесна у поверхности: блестит, за ней бежит усик волны, когда её ведут
    function drawLure(ctx, tip, SC, u) {
        const p = floatPos(), sp = F.spin || {};
        const s = Math.max(0.65, p.s * 1.9);
        line(ctx, tip.x, tip.y, p.x, p.y, F.holding ? u * 0.5 : u * 2.5);
        if (F.holding || sp.twitch > 0) {
            const o = F.origin();
            const back = SC.project(F.target.tx + (F.target.tx - o.tx) * 0.12, F.target.dist + (F.target.dist - o.dist) * 0.12);
            ctx.strokeStyle = 'rgba(255,255,255,0.55)';
            ctx.lineWidth = Math.max(1, 1.4 * p.s);
            const w = u * 1.6 * s;
            ctx.beginPath();
            ctx.moveTo(back.x - w, back.y + w * 0.15); ctx.lineTo(p.x, p.y); ctx.lineTo(back.x + w, back.y - w * 0.15);
            ctx.stroke();
        }
        // Сама блесна: серебряная ложечка, на рывке переворачивается и бликует
        const flip = sp.twitch > 0 ? Math.sin(sp.twitch * 30) : Math.sin(SC.t * 6) * 0.3;
        ctx.save();
        ctx.translate(p.x, p.y - u * 0.3 * s);
        ctx.scale(1, 0.55 + Math.abs(flip) * 0.45);
        const g = ctx.createLinearGradient(-u * s, -u * s, u * s, u * s);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#c8d0d8'); g.addColorStop(1, '#8a96a2');
        ctx.fillStyle = g;
        ctx.strokeStyle = '#4a5460';
        ctx.lineWidth = Math.max(1, u * 0.2 * s);
        ctx.beginPath(); ctx.ellipse(0, 0, u * 1.1 * s, u * 0.55 * s, -0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#e8402a';
        ctx.beginPath(); ctx.arc(u * 0.35 * s, -u * 0.05 * s, u * 0.22 * s, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        if (sp.twitch > 0.25) {
            ctx.fillStyle = 'rgba(255,255,240,0.9)';
            ctx.beginPath(); ctx.arc(p.x - u * 0.6 * s, p.y - u * 1.2 * s, u * 0.35 * s, 0, Math.PI * 2); ctx.fill();
        }
        if (F.phase === 'bite') {
            // Хищник схватил: всплеск вокруг блесны
            if (Math.random() < 0.4) SC.ripple(p.x, p.y, 0.4 * p.s * 1.6);
        }
    }

    // Надпись над рыбой во время вываживания (свечка, камыш, рывок, подсечка)
    function drawCall(ctx) {
        const c = F.call;
        if (!c || F.phase !== 'fight') return;
        const SC = FB.scene, u = SC.unit();
        const p = SC.project(F.fishTx, F.fishDist);
        const text = FB.t('call_' + c.key);
        const a = Math.min(1, c.t / 0.12, (c.dur - c.t) / 0.25);
        const pop = 1 + Math.max(0, 0.25 - c.t) * 1.6;
        const fs = Math.round(u * 3.6 * pop);
        ctx.save();
        ctx.globalAlpha = Math.max(0, a);
        ctx.font = '900 ' + fs + 'px Nunito, sans-serif';
        const w = ctx.measureText(text).width + fs * 1.2, h = fs * 1.6;
        const x = U.clamp(p.x, w / 2 + 8, SC.W - w / 2 - 8);
        const y = Math.max(h, p.y - u * 12 - (F.jump > 0 ? u * 8 : 0));
        ctx.fillStyle = c.warn ? 'rgba(216,90,40,0.92)' : 'rgba(25,55,95,0.88)';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2); else ctx.rect(x - w / 2, y - h / 2, w, h);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(text, x, y + fs * 0.05);
        // Уход в камыш: большая стрелка — куда вести
        if (F.run) {
            const dir = -F.run.dir, k = (SC.t * 2) % 1;
            const ax = p.x + dir * u * (8 + k * 4), ay = p.y - u * 2;
            ctx.globalAlpha = 0.9 * (1 - k * 0.5);
            ctx.fillStyle = '#ffd23a';
            ctx.strokeStyle = '#2a3550';
            ctx.lineWidth = u * 0.5;
            ctx.beginPath();
            ctx.moveTo(ax + dir * u * 5, ay);
            ctx.lineTo(ax, ay - u * 3.5);
            ctx.lineTo(ax, ay - u * 1.5);
            ctx.lineTo(ax - dir * u * 4, ay - u * 1.5);
            ctx.lineTo(ax - dir * u * 4, ay + u * 1.5);
            ctx.lineTo(ax, ay + u * 1.5);
            ctx.lineTo(ax, ay + u * 3.5);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
        }
        ctx.restore();
    }

    // Рыба в воздухе (свечка) — рисуем её над водой
    function drawJump(ctx) {
        if (F.phase !== 'fight' || !(F.jump > 0 || F.jumpWarn > 0) || F.res.kind !== 'fish') return;
        const SC = FB.scene, u = SC.unit();
        const p = SC.project(F.fishTx, F.fishDist);
        if (F.jumpWarn > 0) {
            // Вода вздувается перед прыжком
            const k = 1 - F.jumpWarn / F.TUNE.jumpWarn;
            ctx.strokeStyle = 'rgba(255,255,255,' + (0.4 + k * 0.5) + ')';
            ctx.lineWidth = Math.max(1.5, 2 * p.s);
            for (let i = 0; i < 2; i++) {
                const r = u * (2 + k * 4 + i * 2) * Math.max(0.5, p.s) * 1.6;
                ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * 0.3, 0, 0, Math.PI * 2); ctx.stroke();
            }
            return;
        }
        const q = 1 - F.jump / F.TUNE.jumpLen;
        const img = FB.fishArt.canvas(F.res.fish.id, 160);
        const big = U.clamp(Math.log10(F.res.g) / 4, 0.35, 1.3);
        const size = u * 26 * big * Math.max(0.6, p.s * 1.5);
        const y = p.y - Math.sin(q * Math.PI) * u * 14 * Math.max(0.6, p.s * 1.4);
        ctx.save();
        ctx.translate(p.x + (q - 0.5) * u * 6 * F.face, y);
        ctx.scale(F.face >= 0 ? 1 : -1, 1);
        ctx.rotate((q - 0.5) * 1.6);
        ctx.drawImage(img, -size / 2, -size / 2 * img.height / img.width, size, size * img.height / img.width);
        ctx.restore();
        // Капли с рыбы
        if (Math.random() < 0.5) SC.fx.push({ kind: 'drop', x: p.x + U.rand(-size, size) * 0.3, y, vx: U.rand(-20, 20), vy: U.rand(-10, 30), r: u * 0.4, life: 0, max: 0.5, color: '#e8f8ff', ground: p.y });
    }

    // Доля ожидания поклёвки 0..1 (для эхолота): по времени, а на спиннинге — по игре блесны
    F.waitK = () => {
        if (F.phase !== 'wait') return F.phase === 'bite' ? 1 : 0;
        if (F.mode === 'spin') return F.spin ? U.clamp(F.spin.attract / F.spin.need, 0, 1) : 0;
        return isFinite(F.biteAt) && F.biteAt > 0 ? U.clamp(T / F.biteAt, 0, 1) : 0;
    };

    F.fightInfo = () => F.phase === 'fight' ? {
        tension: F.tension, progress: F.progress, lo: F.zone.lo, hi: F.zone.hi, surge: F.surge > 0,
        slack: F.slack / F.TUNE.slackMax,
        strain: Math.max(F.strain / F.TUNE.strainMax, F.over / F.TUNE.snapGrace)
    } : null;
})(window.FB);
