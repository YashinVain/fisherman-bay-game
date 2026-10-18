// audio.js — звуки и музыка без файлов: всё синтезируется Web Audio прямо в браузере.
// Так архив остаётся крошечным. Музыка — тихие переборы как на гитаре у костра,
// плюс еле слышный плеск воды. У каждого звука рыбалки несколько вариантов и
// случайный разброс высоты — чтобы не надоедало. Фон зависит от места и погоды:
// птицы днём, сверчки вечером и ночью, лягушки на болоте, чайки у моря, дождь.

(function (FB) {
    const A = FB.audio = {};
    let ctx = null, master = null, sfxBus = null, musicBus = null;
    let muted = false;          // пауза (реклама, свёрнутая вкладка)
    let musicTimer = null, waterNode = null;

    A.unlock = () => {
        if (ctx) { if (ctx.state === 'suspended' && !muted) ctx.resume(); return; }
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.9;
        master.connect(ctx.destination);
        sfxBus = ctx.createGain();
        sfxBus.connect(master);
        musicBus = ctx.createGain();
        musicBus.gain.value = 0;
        musicBus.connect(master);
        A.apply();
        startMusic();
        rain(scene.weather === 'rain');
        ambTimer = setInterval(ambient, 1300);
    };

    // Включить/выключить по настройкам
    A.apply = () => {
        if (!ctx || !FB.S) return;
        const t = ctx.currentTime;
        sfxBus.gain.setTargetAtTime(FB.S.settings.sound ? 0.8 : 0, t, 0.05);
        musicBus.gain.setTargetAtTime(FB.S.settings.music ? 0.32 : 0, t, 0.4);
    };

    A.pause = () => { muted = true; if (ctx && ctx.state === 'running') ctx.suspend(); };
    A.resume = () => { muted = false; if (ctx && ctx.state === 'suspended') ctx.resume(); };

    // ---------- Кирпичики ----------
    function tone(freq, dur, opt) {
        if (!ctx || !FB.S || !FB.S.settings.sound) return;
        opt = opt || {};
        const t = ctx.currentTime + (opt.delay || 0);
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = opt.type || 'sine';
        o.frequency.setValueAtTime(freq, t);
        if (opt.to) o.frequency.exponentialRampToValueAtTime(opt.to, t + dur);
        const vol = opt.vol || 0.3;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + (opt.attack || 0.01));
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g);
        g.connect(opt.bus || sfxBus);
        o.start(t);
        o.stop(t + dur + 0.05);
    }

    let noiseBuf = null;
    function noise(dur, opt) {
        if (!ctx || !FB.S || !FB.S.settings.sound) return;
        opt = opt || {};
        if (!noiseBuf) {
            noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
            const d = noiseBuf.getChannelData(0);
            for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        }
        const t = ctx.currentTime + (opt.delay || 0);
        const src = ctx.createBufferSource();
        src.buffer = noiseBuf;
        const f = ctx.createBiquadFilter();
        f.type = opt.filter || 'bandpass';
        f.frequency.setValueAtTime(opt.freq || 1000, t);
        if (opt.to) f.frequency.exponentialRampToValueAtTime(opt.to, t + dur);
        f.Q.value = opt.q || 1;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(opt.vol || 0.3, t + (opt.attack || 0.02));
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(f); f.connect(g); g.connect(sfxBus);
        src.start(t, Math.random());
        src.stop(t + dur + 0.05);
    }

    // ---------- Звуки игры ----------
    const rnd = (a, b) => a + Math.random() * (b - a);
    const pick = (list) => list[Math.floor(Math.random() * list.length)];
    // Всплеск: size 0..1.5 — от мелкой рыбёшки до огромной
    function splashOf(size, delay) {
        size = size || 0.6;
        noise(0.35 + size * 0.45, { freq: rnd(1100, 1700), to: rnd(220, 380), q: 0.6, vol: 0.18 + size * 0.2, delay });
        if (size > 0.8) tone(rnd(90, 120), 0.25, { to: 55, vol: 0.18 * size, delay });     // глухой «бух» большой рыбы
        // Капли после всплеска
        for (let i = 0; i < 2 + Math.round(size * 3); i++) tone(rnd(900, 1800), 0.05, { to: rnd(500, 800), vol: 0.05, delay: (delay || 0) + 0.15 + i * rnd(0.05, 0.12) });
    }
    const S = {
        click: () => tone(660, 0.08, { type: 'triangle', vol: 0.18 }),
        // Заброс: свист удилища (три варианта) и шорох лески с катушки
        cast: () => {
            const v = pick([[2600, 500, 0.32], [3200, 700, 0.28], [2100, 450, 0.38]]);
            noise(v[2], { freq: v[0], to: v[1], q: 0.9, vol: 0.24 });
            tone(rnd(700, 900), 0.35, { type: 'sawtooth', to: rnd(300, 400), vol: 0.025, delay: 0.08 });
        },
        // Поплавок шлёпнулся в воду — каждый раз чуть по-разному
        plop: () => {
            const f = rnd(360, 480);
            tone(f, rnd(0.1, 0.15), { to: f * 0.42, vol: 0.32 });
            noise(0.22, { freq: rnd(700, 1000), to: 280, vol: 0.1, delay: 0.03 });
            if (Math.random() < 0.5) tone(rnd(1200, 1600), 0.05, { to: 900, vol: 0.05, delay: 0.16 });
        },
        // Проба: лёгкий «тук» по поплавку, иногда двойной
        nibble: () => {
            const f = rnd(250, 340);
            tone(f, 0.07, { to: f * 0.8, vol: 0.18 });
            if (Math.random() < 0.4) tone(f * 1.1, 0.06, { to: f * 0.85, vol: 0.12, delay: 0.11 });
        },
        // Поклёвка: колокольчик на удочке + бульк поплавка
        bite: () => {
            const base = pick([880, 988, 1047]);
            const step = pick([1.335, 1.26, 1.5]);
            tone(base, 0.16, { type: 'triangle', vol: 0.28 });
            tone(base * step, 0.22, { type: 'triangle', vol: 0.26, delay: 0.09 });
            tone(rnd(300, 380), 0.12, { to: 160, vol: 0.2, delay: 0.02 });
        },
        // Подсечка: рывок удилища и всплеск — сильнее у сильной рыбы
        hook: (str) => {
            str = str || 0.3;
            noise(0.25, { freq: rnd(1500, 2200), to: 500, q: 0.8, vol: 0.22 });
            splashOf(0.4 + str * 0.8, 0.05);
        },
        // Трещотка катушки: чем сильнее натянута леска, тем выше и чаще
        reel: (tension) => {
            const t = tension === undefined ? 0.4 : tension;
            tone(1100 + t * 900 + Math.random() * 150, 0.022, { type: 'square', vol: 0.03 + t * 0.03 });
        },
        // Леска скрипит, когда натянута до красного
        strain: (tension) => {
            const t = tension === undefined ? 0.8 : tension;
            tone(rnd(120, 160) + t * 60, 0.16, { type: 'sawtooth', vol: 0.05, to: rnd(100, 130) });
        },
        // Рыба рванула: бьётся на поверхности
        surge: (str) => {
            str = str || 0.4;
            for (let i = 0; i < 2 + Math.round(str * 3); i++) noise(0.12, { freq: rnd(900, 1600), to: 400, vol: 0.08 + str * 0.12, delay: i * rnd(0.08, 0.14) });
        },
        // Эхолот узнал рыбу: «пинг», у редкой — двойной и выше
        sonar: (order) => { const f = 1200 + Math.max(0, order || 0) * 180; tone(f, 0.35, { type: 'sine', vol: 0.1 }); if (order >= 2) tone(f * 1.25, 0.35, { type: 'sine', vol: 0.09, delay: 0.16 }); },
        // Колокольчик донки: тихий на пробе, громкий на поклёвке
        bell: (k) => { k = k || 1; const f = rnd(1900, 2100); tone(f, 0.5, { type: 'sine', vol: 0.12 * k }); tone(f * 2.76, 0.3, { type: 'sine', vol: 0.05 * k }); if (k > 0.8) tone(f * 1.02, 0.5, { type: 'sine', vol: 0.1, delay: 0.14 }); },
        // Рывок блесной
        twitch: () => noise(0.08, { freq: rnd(1800, 2600), to: 900, vol: 0.08 }),
        // Отличная подсечка: звонкое «дзынь»
        perfect: () => { tone(1568, 0.12, { type: 'triangle', vol: 0.2 }); tone(2093, 0.22, { type: 'triangle', vol: 0.18, delay: 0.07 }); },
        // Начался жор: весёлый наигрыш
        frenzy: () => [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, { type: 'triangle', vol: 0.2, delay: i * 0.07 })),
        // Серия выросла / сгорела
        streak: (n) => tone(660 + Math.min(10, n || 1) * 60, 0.12, { type: 'triangle', vol: 0.14 }),
        snap: () => { tone(pick([900, 1100, 760]), 0.25, { type: 'sawtooth', to: 120, vol: 0.18 }); noise(0.2, { freq: 3000, vol: 0.15 }); tone(70, 0.3, { to: 45, vol: 0.12, delay: 0.05 }); },
        miss: () => {
            const v = pick([[400, 300, 220], [440, 330, 247], [370, 277, 208]]);
            tone(v[0], 0.15, { to: v[1], vol: 0.2 });
            tone(v[1], 0.28, { to: v[2], vol: 0.2, delay: 0.12 });
        },
        splash: (size) => splashOf(size),
        coin: () => { tone(1320, 0.08, { type: 'triangle', vol: 0.2 }); tone(1760, 0.14, { type: 'triangle', vol: 0.2, delay: 0.06 }); },
        level: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, { type: 'triangle', vol: 0.25, delay: i * 0.09 })),
        // Находки со дна звучат по-своему
        junk: (id) => {
            if (id === 'chest' || id === 'bottle') { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.25, { type: 'triangle', vol: 0.18, delay: i * 0.07 })); return; }
            if (id === 'duck') { tone(900, 0.08, { type: 'square', to: 1200, vol: 0.06 }); tone(950, 0.1, { type: 'square', to: 1300, vol: 0.06, delay: 0.14 }); return; }
            const v = pick([[200, 150, 160, 110], [240, 120, 180, 90], [180, 260, 150, 220]]);
            tone(v[0], 0.2, { type: 'square', vol: 0.08, to: v[1] });
            tone(v[2], 0.3, { type: 'square', vol: 0.08, to: v[3], delay: 0.15 });
        }
    };
    // Фанфара улова: чем реже рыба, тем длиннее и выше. Для каждой редкости — пара мелодий
    S.catch = (order) => {
        order = Math.max(0, Math.min(4, order || 0));
        const tunes = [
            [[523, 659, 784], [587, 698, 880], [523, 784, 659, 1047]],
            [[523, 659, 784, 1047], [587, 740, 880, 1175], [659, 784, 988, 1319]],
            [[587, 740, 880, 1175], [523, 659, 784, 988, 1175], [698, 880, 1047, 1397]],
            [[523, 659, 784, 1047, 1319], [587, 740, 880, 1175, 1480], [659, 831, 988, 1319, 1661]],
            [[523, 659, 784, 1047, 1319, 1568], [587, 740, 880, 1175, 1480, 1760]]
        ];
        const notes = pick(tunes[order]);
        const gap = pick([0.07, 0.08, 0.09]);
        notes.forEach((f, i) => tone(f, 0.35, { type: 'triangle', vol: 0.22, delay: i * gap }));
        if (order >= 3) notes.forEach((f, i) => tone(f * 2, 0.4, { type: 'sine', vol: 0.08, delay: 0.05 + i * gap }));
        if (order >= 2) tone(notes[notes.length - 1] * 1.5, 0.6, { type: 'sine', vol: 0.06, delay: notes.length * gap });
    };

    // ---------- Фон места и погоды ----------
    let scene = { theme: 'village', weather: 'sun' };
    let rainNode = null, rainGain = null, ambTimer = null;
    A.setScene = (theme, weather) => {
        scene = { theme, weather };
        if (!ctx) return;
        rain(weather === 'rain');
    };
    // Шум дождя — отдельной петлёй, плавно громче/тише
    function rain(on) {
        if (!ctx) return;
        if (!rainNode) {
            const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
            const d = buf.getChannelData(0);
            for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
            rainNode = ctx.createBufferSource();
            rainNode.buffer = buf; rainNode.loop = true;
            const f = ctx.createBiquadFilter();
            f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 0.5;
            rainGain = ctx.createGain(); rainGain.gain.value = 0;
            rainNode.connect(f); f.connect(rainGain); rainGain.connect(sfxBus);
            rainNode.start();
        }
        rainGain.gain.setTargetAtTime(on ? 0.06 : 0, ctx.currentTime, 1.2);
    }
    const chirp = (base, n, gap) => { for (let i = 0; i < n; i++) tone(base * rnd(0.95, 1.08), 0.06, { type: 'sine', to: base * rnd(1.2, 1.5), vol: 0.035, delay: i * gap }); };
    const AMB = {
        bird: () => chirp(rnd(2600, 3600), Math.round(rnd(2, 5)), rnd(0.07, 0.12)),
        cricket: () => { const f = rnd(4200, 4800); for (let i = 0; i < 3; i++) tone(f, 0.035, { type: 'square', vol: 0.01, delay: i * 0.05 }); },
        frog: () => { const f = rnd(110, 160); tone(f, 0.12, { type: 'sawtooth', to: f * 0.8, vol: 0.05 }); tone(f * 1.05, 0.14, { type: 'sawtooth', to: f * 0.8, vol: 0.05, delay: 0.18 }); },
        gull: () => { const f = rnd(1300, 1600); tone(f, 0.18, { type: 'triangle', to: f * 0.7, vol: 0.05 }); tone(f * 0.95, 0.22, { type: 'triangle', to: f * 0.6, vol: 0.05, delay: 0.22 }); },
        owl: () => { tone(330, 0.3, { to: 300, vol: 0.05 }); tone(300, 0.45, { to: 270, vol: 0.05, delay: 0.4 }); },
        wind: () => noise(2.2, { freq: rnd(300, 500), to: rnd(600, 900), q: 0.4, vol: 0.04, attack: 0.9, filter: 'lowpass' }),
        drip: () => tone(rnd(1400, 2200), 0.05, { to: rnd(700, 1000), vol: 0.04 })
    };
    function ambient() {
        if (!ctx || muted || !FB.S || !FB.S.settings.sound) return;
        const { theme, weather } = scene;
        const night = weather === 'night', eve = weather === 'evening';
        const roll = (p, name) => { if (Math.random() < p) AMB[name](); };
        if (weather === 'sun') roll(theme === 'sea' || theme === 'tropic' ? 0.08 : 0.22, 'bird');
        if (eve || night) roll(0.4, 'cricket');
        if (theme === 'swamp') roll(night || eve ? 0.2 : 0.1, 'frog');
        if ((theme === 'sea' || theme === 'tropic') && !night) roll(0.1, 'gull');
        if (night) roll(0.03, 'owl');
        if (weather === 'fog' || theme === 'mountain') roll(0.05, 'wind');
        if (weather === 'rain') roll(0.25, 'drip');
    }
    A.play = (name, arg) => { try { S[name] && S[name](arg); } catch (e) { /* звук не важнее игры */ } };

    // ---------- Музыка ----------
    // Медленный перебор по пентатонике: аккорды меняются раз в 2 такта
    const CHORDS = [[196, 247, 294, 392], [165, 196, 247, 330], [175, 220, 262, 349], [147, 185, 220, 294]];
    const MELODY = [392, 440, 494, 587, 659, 587, 494, 440];
    let step = 0, beat = 0.42;
    // Настроение музыки: во время жора — бодрее
    A.setMood = (m) => {
        beat = m === 'frenzy' ? 0.26 : 0.42;
        if (musicTimer) { clearInterval(musicTimer); musicTimer = null; startMusic(true); }
    };
    function startMusic(noWater) {
        if (musicTimer) return;
        if (!noWater) startWater();
        musicTimer = setInterval(() => {
            if (!ctx || muted || !FB.S || !FB.S.settings.music) return;
            const chord = CHORDS[Math.floor(step / 8) % CHORDS.length];
            const i = step % 8;
            // Перебор: бас на первую долю, дальше струны по очереди
            const f = i === 0 ? chord[0] / 2 : chord[[1, 2, 3, 2][i % 4]];
            pluck(f, i === 0 ? 0.16 : 0.09);
            // Иногда — нотка мелодии сверху
            if (i % 4 === 2 && Math.random() < 0.45) pluck(MELODY[Math.floor(Math.random() * MELODY.length)], 0.06, 0.05);
            step++;
        }, beat * 1000);
    }
    function pluck(freq, vol, delay) {
        const t = ctx.currentTime + (delay || 0);
        const o = ctx.createOscillator(), o2 = ctx.createOscillator();
        const g = ctx.createGain();
        const f = ctx.createBiquadFilter();
        o.type = 'triangle'; o2.type = 'sine';
        o.frequency.value = freq; o2.frequency.value = freq * 2.003;
        f.type = 'lowpass'; f.frequency.value = 1800;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
        o.connect(f); o2.connect(f); f.connect(g); g.connect(musicBus);
        o.start(t); o2.start(t); o.stop(t + 1.7); o2.stop(t + 1.7);
    }
    // Тихий плеск: шум через фильтр, громкость медленно «дышит»
    function startWater() {
        const buf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
        const d = buf.getChannelData(0);
        let last = 0;
        for (let i = 0; i < d.length; i++) { last = last * 0.97 + (Math.random() * 2 - 1) * 0.03; d[i] = last * 4; }
        const src = ctx.createBufferSource();
        src.buffer = buf; src.loop = true;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = 500;
        const g = ctx.createGain(); g.gain.value = 0.12;
        const lfo = ctx.createOscillator(), lg = ctx.createGain();
        lfo.frequency.value = 0.12; lg.gain.value = 0.07;
        lfo.connect(lg); lg.connect(g.gain);
        src.connect(f); f.connect(g); g.connect(musicBus);
        src.start(); lfo.start();
        waterNode = src;
    }
})(window.FB);
