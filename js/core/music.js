// music.js — фоновая музыка, которая сочиняется прямо в игре, без файлов.
// Песня = тональность + гармония + мотив мелодии. Сначала вступление без мелодии,
// потом мелодия по форме A A' B A, концовка, немного тишины — и новая песня.
// Настроение — от погоды и места: днём гитарный перебор и флейта, вечером
// электропиано со свингом и вибрафон, ночью арфа и музыкальная шкатулка, в дождь
// lo-fi, в тумане редкие ноты в большом зале, на турнире — укулеле и шейкер.
//
// M.compose(style, theme, rnd) — чистая функция: план песни (проверяется в tools/test.js).
// M.start(ctx, bus) — проигрыватель; дальше audio.js сообщает сцену, жор и фанфары.

(function (FB) {
    const M = FB.music = {};

    // ---------- Теория ----------
    const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10] };
    const PENTA = { major: [0, 2, 4, 7, 9], minor: [0, 3, 5, 7, 10], dorian: [0, 3, 5, 7, 9] };

    // Ритмы мотива на 2 такта (16 восьмых): 1 — нота
    const RHYTHMS = {
        calm: [
            [1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0],
            [1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0],
            [0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0],
            [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0],
            [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0]
        ],
        sparse: [
            [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
            [1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0],
            [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        ],
        busy: [
            [1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 0, 0],
            [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0],
            [0, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 0, 0, 0]
        ]
    };

    // Аккомпанемент на 2 такта. B/F — бас (тоника/квинта), C/c — аккорд громко/тихо,
    // S/s — бой вниз/вверх, цифры — нота аккорда (0 — нижняя, 3 — верхняя), '-' — пауза
    const COMP = {
        travis: ['B', '2', '1', '3', 'F', '2', '1', '3', 'B', '2', '1', '3', 'F', '2', '1', '3'],
        ep: ['BC', '-', '-', 'c', 'F', '-', 'c', '-', 'BC', '-', '-', 'c', 'F', 'c', '-', '-'],
        harp: ['B', '-', '0', '-', '1', '2', '3', '-', '-', '3', '-', '2', '1', '-', '0', '-'],
        lofi: ['BC', '-', '-', 'c', '-', 'F', '-', '-', 'B', '-', 'c', '-', '-', 'F', 'c', '-'],
        sparse: ['B', '-', '-', '-', '2', '-', '-', '-', '-', '-', '3', '-', '-', '-', '-', '-'],
        strum: ['BS', '-', 'S', 's', 'F', 's', 'S', 's', 'BS', '-', 'S', 's', 'F', 's', 'S', 's']
    };
    // Ударные на 2 такта: k — бочка, r — римшот, h — шейкер
    const PERC = {
        arena: ['kh', 'h', 'h', 'h', 'rh', 'h', 'h', 'kh', 'kh', 'h', 'h', 'kh', 'rh', 'h', 'h', 'h'],
        lofi: ['k', '-', '-', '-', 'r', '-', '-', 'k', 'k', '-', '-', '-', 'r', '-', '-', '-']
    };

    // Стили. Аккорд — [ступень от 0, нот 3 или 4]
    const STYLES = {
        day: {
            bpm: [80, 88], mode: 'major', bars: 1, comp: 'travis', acc: 'guitar', pad: 0.03, lead: 'flute', leadLo: 67, leadHi: 84,
            rhythm: 'calm', swing: 0, wet: 0.28,
            progs: [[[0, 3], [4, 3], [5, 3], [3, 3]], [[0, 3], [3, 3], [5, 3], [4, 3]], [[0, 3], [5, 3], [3, 3], [4, 3]], [[3, 3], [0, 3], [4, 3], [5, 3]]]
        },
        evening: {
            bpm: [68, 76], mode: 'major', bars: 1, comp: 'ep', acc: 'ep', bass: true, pad: 0.025, lead: 'vibes', leadLo: 65, leadHi: 81,
            rhythm: 'calm', swing: 0.14, wet: 0.32,
            progs: [[[0, 4], [5, 4], [3, 4], [4, 4]], [[3, 4], [4, 4], [2, 4], [5, 4]], [[0, 4], [2, 4], [3, 4], [4, 4]]]
        },
        night: {
            bpm: [62, 68], mode: 'minor', bars: 2, comp: 'harp', acc: 'harp', pad: 0.05, lead: 'musicbox', leadLo: 72, leadHi: 88,
            rhythm: 'sparse', swing: 0, wet: 0.45,
            progs: [[[0, 3], [5, 3], [2, 3], [6, 3]], [[0, 3], [3, 3], [5, 3], [4, 3]], [[5, 3], [6, 3], [0, 3], [0, 3]]]
        },
        rain: {
            bpm: [68, 74], mode: 'major', bars: 1, comp: 'lofi', acc: 'ep', bass: true, pad: 0.02, lead: 'ep', leadLo: 67, leadHi: 81,
            rhythm: 'calm', swing: 0.12, wet: 0.3, perc: 'lofi',
            progs: [[[1, 4], [4, 4], [0, 4], [5, 4]], [[3, 4], [2, 4], [5, 4], [1, 4]], [[0, 4], [5, 4], [1, 4], [4, 4]]]
        },
        fog: {
            bpm: [58, 64], mode: 'dorian', bars: 2, comp: 'sparse', acc: 'harp', pad: 0.06, lead: 'flute', leadLo: 67, leadHi: 81,
            rhythm: 'sparse', swing: 0, wet: 0.6,
            progs: [[[0, 4], [3, 3], [0, 4], [6, 3]], [[0, 4], [6, 3], [3, 3], [0, 4]]]
        },
        arena: {
            bpm: [100, 108], mode: 'major', bars: 1, comp: 'strum', acc: 'uke', bass: true, pad: 0, lead: 'flute', leadLo: 72, leadHi: 86,
            rhythm: 'busy', swing: 0, wet: 0.2, perc: 'arena',
            progs: [[[0, 3], [4, 3], [5, 3], [3, 3]], [[0, 3], [3, 3], [4, 3], [3, 3]], [[5, 3], [3, 3], [0, 3], [4, 3]]]
        }
    };
    M.STYLES = STYLES;

    // Какая музыка у сцены: турнир — свой стиль, остальное — по погоде
    M.styleFor = (theme, weather) => {
        if (theme === 'arena') return 'arena';
        return { sun: 'day', evening: 'evening', night: 'night', rain: 'rain', fog: 'fog' }[weather] || 'day';
    };

    // Аккорд: ступень → высоты (pitch class) от тоники
    const chordPcs = (mode, deg, size) => {
        const sc = SCALES[mode], out = [];
        for (let k = 0; k < size; k++) out.push(sc[(deg + 2 * k) % 7] + 12 * Math.floor((deg + 2 * k) / 7));
        return out;
    };
    // Голоса аккорда в регистре: 4 ноты снизу вверх (у трезвучия сверху — октава тоники)
    const voicing = (key, pcs, lo) => {
        let root = key + pcs[0];
        while (root < lo) root += 12;
        while (root >= lo + 12) root -= 12;
        const v = [root];
        for (let k = 1; k < pcs.length; k++) { let n = key + pcs[k]; while (n <= v[v.length - 1]) n += 12; v.push(n); }
        if (v.length < 4) v.push(root + 12);
        return v;
    };
    const fitIn = (n, lo, hi) => { while (n < lo) n += 12; while (n > hi) n -= 12; return n; };

    // ---------- Сочинение песни ----------
    M.compose = (styleKey, theme, rnd) => {
        rnd = rnd || Math.random;
        const st = Object.assign({}, STYLES[styleKey] || STYLES.day);
        // Тембр по месту: у моря — укулеле, в горах — флейта
        if ((theme === 'sea' || theme === 'tropic') && st.acc === 'guitar') st.acc = 'uke';
        if (theme === 'mountain' && styleKey !== 'night') st.lead = 'flute';
        const pick = (a) => a[Math.floor(rnd() * a.length)];
        const key = Math.floor(rnd() * 12);                       // тоника (pitch class)
        const bpm = st.bpm[0] + rnd() * (st.bpm[1] - st.bpm[0]);
        const progA = pick(st.progs);
        let progB = pick(st.progs);
        if (progB === progA) progB = progA.slice(2).concat(progA.slice(0, 2));
        const slow = st.bars === 2;
        const form = slow
            ? [['intro', 4], ['A', 8], ['B', 8], ['A2', 8], ['outro', 4]]
            : [['intro', 4], ['A', 8], ['A2', 8], ['B', 8], ['A', 8], ['outro', 4]];
        const accLo = st.acc === 'uke' ? 60 : 52;
        // Пул нот мелодии: пентатоника тональности в регистре инструмента
        const pool = [];
        for (let n = st.leadLo; n <= st.leadHi; n++) if (PENTA[st.mode].includes(((n - key) % 12 + 12) % 12)) pool.push(n);
        const steps = [-2, -1, -1, 0, 1, 1, 2];
        const motif = (end) => {
            const r = pick(RHYTHMS[st.rhythm]);
            let idx = Math.floor(pool.length / 2) + Math.floor(rnd() * 3) - 1;
            const notes = [];
            r.forEach((on, s) => {
                if (!on) return;
                idx = Math.max(0, Math.min(pool.length - 1, idx + pick(steps)));
                notes.push([s, idx]);
            });
            if (end && notes.length) notes[notes.length - 1].end = true;
            return notes;
        };
        const vary = (m) => m.map((x, i) => {
            const y = [x[0], i >= m.length - 2 ? Math.max(0, Math.min(pool.length - 1, x[1] + pick([-2, -1, 1, 2]))) : x[1]];
            if (x.end) y.end = true;
            return y;
        });
        const mA = motif(), mA2 = motif(true), mB = motif(), mB2 = motif(true);
        const phrase = { A: [mA, vary(mA), mA, mA2], A2: [mA, vary(mA), mA, mA2], B: [mB, vary(mB), mB, mB2] };

        const ev = [];
        const bars = [];   // аккорд каждого такта: pitch classes от тоники
        let bar = 0;
        const hv = () => 0.88 + rnd() * 0.24;   // «живая» громкость
        form.forEach(([sec, len]) => {
            const prog = sec === 'B' ? progB : progA;
            for (let b = 0; b < len; b++, bar++) {
                const ci = Math.floor(b / st.bars) % 4;
                let ch = prog[ci];
                if (sec === 'outro' && b >= len - 2) ch = [0, prog[0][1]];
                const pcs = chordPcs(st.mode, ch[0], ch[1]);
                bars.push(pcs);
                const voi = voicing(key, pcs, accLo);
                const s0 = bar * 8;
                const intro = sec === 'intro', outro = sec === 'outro';
                const fade = intro ? 0.55 + 0.45 * b / len : outro ? 0.9 - 0.4 * b / len : 1;
                // Пэд — на смену аккорда
                if (st.pad && b % st.bars === 0) {
                    const pn = voicing(key, pcs, 50).slice(0, 3);
                    ev.push([s0, 'pad', pn, st.pad * (outro ? 0.8 : 1), st.bars * 8 + (outro && b === len - 2 ? 8 : 0)]);
                }
                // Конец песни: последний аккорд — один раз, долго звучит
                if (outro && b >= len - 2) {
                    if (b === len - 2) {
                        voi.forEach((n, k) => ev.push([s0, st.acc, n, 0.08 * fade, 12, k * 0.03]));
                        ev.push([s0, 'bass', fitIn(key + pcs[0], 36, 47), 0.12, 12]);
                    }
                    continue;
                }
                const half = (bar % 2) * 8;
                for (let i = 0; i < 8; i++) {
                    const tok = COMP[st.comp][half + i];
                    if (tok === '-') continue;
                    const s = s0 + i;
                    for (const c of tok) {
                        if (c === 'B' || c === 'F') {
                            const n = fitIn(key + pcs[0] + (c === 'F' ? 7 : 0), 36, 50);
                            if (st.bass) ev.push([s, 'bass', n, 0.13 * fade * hv(), c === 'B' ? 3 : 2]);
                            else ev.push([s, st.acc, n, 0.12 * fade * hv(), 4]);
                        } else if (c === 'C' || c === 'c') {
                            voi.forEach((n, k) => ev.push([s, st.acc, n, (c === 'C' ? 0.075 : 0.05) * fade * hv(), 3, k * 0.012]));
                        } else if (c === 'S') {
                            voi.forEach((n, k) => ev.push([s, st.acc, n, 0.075 * fade * hv(), 2, k * 0.014]));
                        } else if (c === 's') {
                            voi.slice(1).reverse().forEach((n, k) => ev.push([s, st.acc, n, 0.045 * fade * hv(), 1, k * 0.012]));
                        } else {
                            ev.push([s, st.acc, voi[+c], 0.08 * fade * hv(), 3]);
                        }
                    }
                }
                // Ударные
                if (st.perc && !intro) {
                    for (let i = 0; i < 8; i++) {
                        const tok = PERC[st.perc][half + i];
                        for (const c of tok) {
                            if (c === 'k') ev.push([s0 + i, 'kick', 0, (st.perc === 'lofi' ? 0.13 : 0.16) * fade, 1]);
                            if (c === 'r') ev.push([s0 + i, 'rim', 0, (st.perc === 'lofi' ? 0.035 : 0.04) * fade, 1]);
                            if (c === 'h') ev.push([s0 + i, 'shaker', 0, (i % 2 ? 0.02 : 0.012) * fade, 1]);
                        }
                    }
                }
            }
        });
        // Мелодия: фразы по 8 тактов, на сильных долях — аккордовые ноты
        let mb = 0;
        form.forEach(([sec, len]) => {
            const ph = phrase[sec];
            if (!ph) { mb += len; return; }
            ph.forEach((m, mi) => {
                const startBar = mb + mi * 2;
                const list = sec === 'A2' ? vary(m) : m;
                list.forEach((x, ni) => {
                    const s = startBar * 8 + x[0];
                    const pcs = bars[startBar + (x[0] >= 8 ? 1 : 0)];
                    let n = pool[x[1]];
                    const strong = x[0] % 4 === 0 || x.end;
                    if (strong) {
                        // ближайшая нота аккорда (в пределах кварты)
                        let best = n, bd = 99;
                        for (let d = -5; d <= 5; d++) {
                            const pc = ((n + d - key) % 12 + 12) % 12;
                            if (pcs.some(p => p % 12 === pc) && Math.abs(d) < bd) { bd = Math.abs(d); best = n + d; }
                        }
                        n = best;
                    }
                    const next = list[ni + 1];
                    const dur = x.end ? 6 : Math.max(1, Math.min(4, (next ? next[0] : 16) - x[0]));
                    ev.push([s, st.lead, n, (sec === 'A2' ? 0.075 : 0.068) * hv(), dur, 0, 'lead']);
                });
            });
            mb += len;
        });
        ev.sort((a, b) => a[0] - b[0]);
        return { style: styleKey, key, mode: st.mode, bpm, swing: st.swing, wet: st.wet, steps: bar * 8, bars, form, ev };
    };

    // ---------- Проигрыватель ----------
    let ctx = null, bus = null, input = null, wetGain = null, noiseBuf = null;
    let song = null, nextAt = 0, timer = null;
    let styleKey = 'day', theme = 'village', mood = null;
    const LOOK = 0.3;
    const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

    M.start = (audioCtx, outBus) => {
        if (ctx) return;
        ctx = audioCtx; bus = outBus;
        input = ctx.createGain();                 // сюда приходят все песни; им же приглушаем
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -20; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.25;
        input.connect(comp);
        comp.connect(bus);
        const verb = ctx.createConvolver();
        verb.buffer = makeIR(1.9);
        wetGain = ctx.createGain(); wetGain.gain.value = 0.3;
        comp.connect(verb); verb.connect(wetGain); wetGain.connect(bus);
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        nextAt = ctx.currentTime + 1.5;
        timer = setInterval(tick, 60);
    };

    // Отклик «зала»: шум, который затихает и темнеет к концу
    function makeIR(sec) {
        const len = Math.floor(ctx.sampleRate * sec), pre = Math.floor(ctx.sampleRate * 0.015);
        const buf = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
            const d = buf.getChannelData(ch);
            let lp = 0;
            for (let i = 0; i < len; i++) {
                const k = i / len;
                lp += ((Math.random() * 2 - 1) - lp) * (0.75 - 0.6 * k);
                d[i] = i < pre ? 0 : lp * Math.pow(1 - k, 2.4) * 0.6;
            }
        }
        return buf;
    }

    M.setScene = (th, weather) => {
        theme = th;
        const k = M.styleFor(th, weather);
        if (k === styleKey) return;
        styleKey = k;
        if (!ctx) return;
        // Новое настроение: текущая песня плавно уходит, следующая — почти сразу
        const now = ctx.currentTime;
        if (song) { fadeOut(song, now); song = null; }
        nextAt = now + 1.2;
    };
    M.setMood = (m) => { mood = m; };
    // Приглушить музыку на время фанфары
    M.duck = (level, sec) => {
        if (!ctx) return;
        const t = ctx.currentTime;
        input.gain.cancelScheduledValues(t);
        input.gain.setTargetAtTime(level, t, 0.06);
        input.gain.setTargetAtTime(1, t + (sec || 1.5), 0.5);
    };
    M.state = () => song ? { style: song.style, step: song.step, of: song.steps } : { style: null, wait: ctx ? Math.max(0, nextAt - ctx.currentTime) : 0 };

    function fadeOut(s, now) {
        s.g.gain.setTargetAtTime(0.0001, now, 0.7);
        setTimeout(() => { try { s.g.disconnect(); } catch (e) { /* уже отключён */ } }, 4500);
    }

    function newSong(now) {
        const s = M.compose(styleKey, theme);
        s.g = ctx.createGain();
        s.g.connect(input);
        s.step = 0; s.ei = 0; s.mul = 1;
        s.t = now + 0.1;
        wetGain.gain.setTargetAtTime(s.wet, now, 1);
        return s;
    }

    function tick() {
        if (!ctx || ctx.state !== 'running') return;
        const now = ctx.currentTime;
        const off = !FB.S || !FB.S.settings || !(FB.S.settings.musicVol > 0);
        if (!song) {
            if (off || now < nextAt) return;
            song = newSong(now);
        }
        // Вкладка спала или музыка была выключена — догоняем без «пачки» нот
        if (song.t < now - 0.05) {
            while (song.t < now && song.step < song.steps) skipStep(song);
        }
        while (song && song.t < now + LOOK) {
            if (off) { skipStep(song); } else playStep(song);
            if (song.step >= song.steps) {
                const s = song;
                song = null;
                nextAt = now + 6 + Math.random() * 6;
                setTimeout(() => { try { s.g.disconnect(); } catch (e) { /* уже отключён */ } }, 9000);
            }
        }
    }

    function stepDur(s) {
        const target = mood === 'frenzy' ? 1.3 : 1;
        s.mul += (target - s.mul) * 0.08;
        return 60 / s.bpm / 2 / s.mul;
    }
    function skipStep(s) {
        while (s.ei < s.ev.length && s.ev[s.ei][0] <= s.step) s.ei++;
        s.t += stepDur(s);
        s.step++;
    }
    function playStep(s) {
        const dt = stepDur(s);
        const base = s.t + (s.step % 2 ? s.swing * dt : 0);
        while (s.ei < s.ev.length && s.ev[s.ei][0] <= s.step) {
            const e = s.ev[s.ei++];
            if (e[0] < s.step) continue;
            const t = Math.max(ctx.currentTime, base + (e[5] || 0) + (e[6] === 'lead' ? (Math.random() - 0.5) * 0.012 : 0));
            play(e[1], t, e[2], e[3], e[4] * dt, s.g);
        }
        // Жор: шейкер подгоняет ритм
        if (mood === 'frenzy') play('shaker', base, 0, s.step % 2 ? 0.022 : 0.013, dt, s.g);
        s.t += dt;
        s.step++;
    }

    // ---------- Инструменты ----------
    function play(inst, t, n, v, dur, dest) {
        try {
            if (inst === 'pad') return pad(t, n, v, dur, dest);
            const f = I[inst];
            if (f) f(t, n, v, dur, dest);
        } catch (e) { /* музыка не важнее игры */ }
    }
    const gainAt = (dest) => { const g = ctx.createGain(); g.connect(dest); return g; };
    const osc = (type, f, t, t1, dest, detune) => {
        const o = ctx.createOscillator();
        o.type = type; o.frequency.value = f;
        if (detune) o.detune.value = detune;
        o.connect(dest); o.start(t); o.stop(t1);
        return o;
    };
    const noiseSrc = (t, t1, dest) => {
        const src = ctx.createBufferSource();
        src.buffer = noiseBuf;
        src.connect(dest); src.start(t, Math.random() * 0.5); src.stop(t1);
        return src;
    };
    // Щипок струны: яркое начало, фильтр быстро «закрывается»
    const pluck = (bright, len) => (t, m, v, dur, dest) => {
        const f = hz(m), end = t + len;
        const g = gainAt(dest);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(v, t + 0.005);
        g.gain.exponentialRampToValueAtTime(v * 0.3, t + len * 0.2);
        g.gain.exponentialRampToValueAtTime(0.0001, end);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.Q.value = 0.8;
        lp.frequency.setValueAtTime(Math.min(10000, f * bright + 600), t);
        lp.frequency.exponentialRampToValueAtTime(f * 1.5 + 250, t + len * 0.35);
        lp.connect(g);
        osc('triangle', f, t, end, lp);
        const sg = gainAt(lp); sg.gain.value = 0.3;
        osc('sawtooth', f, t, end, sg, 4);
    };
    const I = {
        guitar: pluck(6, 2.2),
        uke: pluck(8, 1.15),
        harp: (t, m, v, dur, dest) => {
            const f = hz(m), end = t + 3.2;
            const g = gainAt(dest);
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(v, t + 0.004);
            g.gain.exponentialRampToValueAtTime(0.0001, end);
            osc('triangle', f, t, end, g);
            const h = gainAt(g); h.gain.value = 0.18;
            osc('sine', f * 2, t, end, h);
        },
        // Электропиано: основной тон + звонкий обертон, который быстро гаснет
        ep: (t, m, v, dur, dest) => {
            const f = hz(m), end = t + Math.max(1.2, dur) + 0.9;
            const g = gainAt(dest);
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(v, t + 0.006);
            g.gain.exponentialRampToValueAtTime(v * 0.45, t + 0.9);
            g.gain.setTargetAtTime(0.0001, t + Math.max(1.2, dur), 0.25);
            osc('sine', f, t, end, g);
            const b = gainAt(dest);
            b.gain.setValueAtTime(0.0001, t);
            b.gain.exponentialRampToValueAtTime(v * 0.28, t + 0.004);
            b.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
            osc('sine', f * 2, t, t + 0.55, b);
            const tn = gainAt(dest);
            tn.gain.setValueAtTime(v * 0.05, t);
            tn.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
            osc('sine', f * 7, t, t + 0.1, tn);
        },
        // Вибрафон: мягкий удар и «дрожащая» громкость
        vibes: (t, m, v, dur, dest) => {
            const f = hz(m), end = t + 2.6;
            const g = gainAt(dest);
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(v, t + 0.008);
            g.gain.exponentialRampToValueAtTime(0.0001, end);
            const trem = gainAt(g); trem.gain.value = 0.8;
            const lfo = ctx.createOscillator(), lg = ctx.createGain();
            lfo.frequency.value = 4.8; lg.gain.value = 0.2;
            lfo.connect(lg); lg.connect(trem.gain); lfo.start(t); lfo.stop(end);
            osc('sine', f, t, end, trem);
            const h = gainAt(trem); h.gain.value = 0.06;
            osc('sine', f * 4, t, end, h);
        },
        // Музыкальная шкатулка: синус и неровные звонкие обертоны
        musicbox: (t, m, v, dur, dest) => {
            const f = hz(m), end = t + 2.6;
            const g = gainAt(dest);
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(v, t + 0.003);
            g.gain.exponentialRampToValueAtTime(0.0001, end);
            osc('sine', f, t, end, g);
            [[2.76, 0.16, 0.7], [5.4, 0.06, 0.25]].forEach(([k, a, len]) => {
                const h = gainAt(dest);
                h.gain.setValueAtTime(0.0001, t);
                h.gain.exponentialRampToValueAtTime(v * a, t + 0.003);
                h.gain.exponentialRampToValueAtTime(0.0001, t + len);
                osc('sine', f * k, t, t + len + 0.05, h);
            });
        },
        // Флейта: мягкая атака, вибрато чуть позже, шум дыхания в начале
        flute: (t, m, v, dur, dest) => {
            const f = hz(m), len = Math.max(0.25, dur * 0.95), end = t + len + 0.5;
            const g = gainAt(dest);
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(v, t + 0.07);
            g.gain.setTargetAtTime(v * 0.82, t + 0.1, 0.2);
            g.gain.setTargetAtTime(0.0001, t + len, 0.09);
            const o = osc('sine', f, t, end, g);
            const h = gainAt(g); h.gain.value = 0.12;
            const o2 = osc('triangle', f * 2, t, end, h);
            const lfo = ctx.createOscillator(), lg = ctx.createGain();
            lfo.frequency.value = 5.2;
            lg.gain.setValueAtTime(0, t);
            lg.gain.linearRampToValueAtTime(f * 0.006, t + 0.35);
            lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
            lfo.start(t); lfo.stop(end);
            const bp = ctx.createBiquadFilter();
            bp.type = 'bandpass'; bp.frequency.value = f * 1.5; bp.Q.value = 0.9;
            const bg = gainAt(dest);
            bg.gain.setValueAtTime(0.0001, t);
            bg.gain.exponentialRampToValueAtTime(v * 0.35, t + 0.03);
            bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
            bp.connect(bg);
            noiseSrc(t, t + 0.2, bp);
        },
        bass: (t, m, v, dur, dest) => {
            const f = hz(m), len = Math.max(0.2, dur), end = t + len + 0.3;
            const g = gainAt(dest);
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(v, t + 0.012);
            g.gain.exponentialRampToValueAtTime(v * 0.45, t + len);
            g.gain.setTargetAtTime(0.0001, t + len, 0.06);
            const lp = ctx.createBiquadFilter();
            lp.type = 'lowpass'; lp.frequency.value = 520;
            lp.connect(g);
            osc('sine', f, t, end, lp);
            const h = gainAt(lp); h.gain.value = 0.35;
            osc('triangle', f, t, end, h);
        },
        kick: (t, m, v, dur, dest) => {
            const g = gainAt(dest);
            g.gain.setValueAtTime(v, t);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
            const o = osc('sine', 110, t, t + 0.35, g);
            o.frequency.setValueAtTime(110, t);
            o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
        },
        rim: (t, m, v, dur, dest) => {
            const g = gainAt(dest);
            g.gain.setValueAtTime(v, t);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
            const bp = ctx.createBiquadFilter();
            bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 2;
            bp.connect(g);
            noiseSrc(t, t + 0.07, bp);
            const tg = gainAt(dest);
            tg.gain.setValueAtTime(v * 0.5, t);
            tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
            osc('sine', 850, t, t + 0.04, tg);
        },
        shaker: (t, m, v, dur, dest) => {
            const g = gainAt(dest);
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(v, t + 0.008);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.075);
            const hp = ctx.createBiquadFilter();
            hp.type = 'highpass'; hp.frequency.value = 6500;
            hp.connect(g);
            noiseSrc(t, t + 0.09, hp);
        }
    };
    // Пэд: тёплый фон из слегка расстроенных волн, медленно вступает и уходит
    function pad(t, notes, v, dur, dest) {
        const end = t + dur + 2.2;
        const g = gainAt(dest);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(v, t + Math.min(1.4, dur * 0.4));
        g.gain.setValueAtTime(v, t + dur);
        g.gain.setTargetAtTime(0.0001, t + dur, 0.6);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.Q.value = 0.4;
        lp.frequency.setValueAtTime(700, t);
        lp.frequency.linearRampToValueAtTime(1150, t + Math.min(2, dur * 0.6));
        lp.connect(g);
        notes.forEach(m => { const f = hz(m); osc('sawtooth', f, t, end, lp, -7); osc('sawtooth', f, t, end, lp, 7); });
    }
    M._instruments = I;

    // Отрисовать песню в OfflineAudioContext — для проверки на стенде
    // (tools/sketches/music.html) и для звука в промо-видео. Громкость — как в игре
    // при ползунке 60%. Возвращает план песни.
    M.render = (off, style, th, maxSec, rnd) => {
        const keep = { ctx, noiseBuf };
        ctx = off;
        try {
            noiseBuf = off.createBuffer(1, off.sampleRate, off.sampleRate);
            const nd = noiseBuf.getChannelData(0);
            for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
            const level = off.createGain(); level.gain.value = Math.pow(0.6, 1.6) * 0.6;
            level.connect(off.destination);
            const comp = off.createDynamicsCompressor();
            comp.threshold.value = -20; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.25;
            comp.connect(level);
            const s = M.compose(style, th, rnd);
            const verb = off.createConvolver(); verb.buffer = makeIR(1.9);
            const wg = off.createGain(); wg.gain.value = s.wet;
            comp.connect(verb); verb.connect(wg); wg.connect(level);
            const dt = 60 / s.bpm / 2;
            s.ev.forEach(e => {
                const t = 0.05 + e[0] * dt + (e[0] % 2 ? s.swing * dt : 0) + (e[5] || 0);
                if (t < maxSec) play(e[1], t, e[2], e[3], e[4] * dt, comp);
            });
            return s;
        } finally { ctx = keep.ctx; noiseBuf = keep.noiseBuf; }
    };
})(window.FB);
