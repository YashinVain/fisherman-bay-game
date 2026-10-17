// audio.js — звуки и музыка без файлов: всё синтезируется Web Audio прямо в браузере.
// Так архив остаётся крошечным. Музыка — тихие переборы как на гитаре у костра,
// плюс еле слышный плеск воды.

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
    const S = {
        click: () => tone(660, 0.08, { type: 'triangle', vol: 0.18 }),
        cast: () => noise(0.35, { freq: 2500, to: 600, q: 0.8, vol: 0.25 }),
        plop: () => { tone(420, 0.12, { to: 180, vol: 0.35 }); noise(0.25, { freq: 900, to: 300, vol: 0.12, delay: 0.03 }); },
        nibble: () => tone(300, 0.07, { to: 240, vol: 0.18 }),
        bite: () => { tone(880, 0.12, { type: 'triangle', vol: 0.3 }); tone(1175, 0.18, { type: 'triangle', vol: 0.3, delay: 0.09 }); },
        hook: () => { noise(0.3, { freq: 1200, to: 400, vol: 0.3 }); tone(220, 0.2, { to: 160, vol: 0.25 }); },
        reel: () => tone(1500 + Math.random() * 200, 0.025, { type: 'square', vol: 0.04 }),
        strain: () => tone(140, 0.12, { type: 'sawtooth', vol: 0.05, to: 120 }),
        snap: () => { tone(900, 0.25, { type: 'sawtooth', to: 120, vol: 0.18 }); noise(0.2, { freq: 3000, vol: 0.15 }); },
        miss: () => { tone(400, 0.15, { to: 300, vol: 0.2 }); tone(300, 0.25, { to: 220, vol: 0.2, delay: 0.12 }); },
        splash: () => { noise(0.6, { freq: 1400, to: 300, q: 0.6, vol: 0.4 }); },
        coin: () => { tone(1320, 0.08, { type: 'triangle', vol: 0.2 }); tone(1760, 0.14, { type: 'triangle', vol: 0.2, delay: 0.06 }); },
        level: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, { type: 'triangle', vol: 0.25, delay: i * 0.09 })),
        junk: () => { tone(200, 0.2, { type: 'square', vol: 0.08, to: 150 }); tone(160, 0.3, { type: 'square', vol: 0.08, to: 110, delay: 0.15 }); }
    };
    // Фанфара улова: чем реже рыба, тем длиннее и выше
    S.catch = (order) => {
        const scales = [[523, 659, 784], [523, 659, 784, 1047], [587, 740, 880, 1175], [523, 659, 784, 1047, 1319], [523, 659, 784, 1047, 1319, 1568]];
        const notes = scales[Math.max(0, Math.min(4, order || 0))];
        notes.forEach((f, i) => tone(f, 0.35, { type: 'triangle', vol: 0.22, delay: i * 0.08 }));
        if (order >= 3) notes.forEach((f, i) => tone(f * 2, 0.4, { type: 'sine', vol: 0.08, delay: 0.05 + i * 0.08 }));
    };
    A.play = (name, arg) => { try { S[name] && S[name](arg); } catch (e) { /* звук не важнее игры */ } };

    // ---------- Музыка ----------
    // Медленный перебор по пентатонике: аккорды меняются раз в 2 такта
    const CHORDS = [[196, 247, 294, 392], [165, 196, 247, 330], [175, 220, 262, 349], [147, 185, 220, 294]];
    const MELODY = [392, 440, 494, 587, 659, 587, 494, 440];
    let step = 0;
    function startMusic() {
        if (musicTimer) return;
        startWater();
        const beat = 0.42;
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
