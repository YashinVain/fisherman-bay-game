// edit.js — собрать рекламный ролик по сценарию монтажа.
//   node tools/rec/edit.js tools/rec/edits/ad-baika.js h      (h — ПК, v — телефон)
//   добавьте --publish, чтобы готовый ролик скопировался в docs/promo/video
//
// Сценарий монтажа — функция (info) => { name, size, music, clips, gfx, sfx, duck }.
// info знает темп музыки (info.beat(n) — время n-й доли) и метки из записи
// исходников (info.mark('carp', 'jump') — секунда метки от начала сцены).
// Клип: { scene, from, len, speed, cam, follow, shake, trans, finger, prompts, … }.
// Ролик и контрольные кадры кладутся в %TEMP%\fishing-tales-rec\<имя>\.

const fs = require('fs');
const path = require('path');
const { launch, sleep } = require('./rec.js');
const { REC_OUT } = require('./paths.js');

// Темп музыки — тот же, что сочинит music.js в монтажке (одинаковое зерно)
function musicPlan(style, theme, seed) {
    global.window = global;
    global.FB = global.FB || {};
    if (!FB.music) require('../../js/core/music.js');
    let s = seed;
    const rnd = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    return FB.music.compose(style, theme, rnd);
}

function resolve(spec, mans) {
    const fps = spec.fps || 30;
    let t = 0;
    spec.clips = spec.clips.map((c, i) => {
        const src = c.src || spec.src;
        const man = mans[src];
        const sc = man.scenes.find(s => s.name === c.scene);
        if (!sc) throw new Error('нет сцены ' + c.scene + ' в ' + src);
        const fromF = sc.start + Math.round((c.from || 0) * fps);
        const out = Object.assign({}, c, { src, fromF, start: +t.toFixed(4), dur: c.len });
        if (fromF + c.len * fps * (c.speed || 1) > sc.end + 60) console.log('  ! клип ' + i + ' (' + c.scene + ') выходит за конец сцены');
        t += c.len;
        return out;
    });
    spec.duration = +t.toFixed(4);
    return spec;
}

async function run(file, orient) {
    const mod = require(path.resolve(file));
    const v = orient === 'v';
    const EN = process.env.FB_LANG === 'en';   // английская версия: исходники src-*-en, ролик *-en
    const srcName = (v ? 'src-v' : 'src-h') + (EN ? '-en' : '');
    const mans = {};
    const loadMan = (n) => mans[n] || (mans[n] = JSON.parse(fs.readFileSync(path.join(REC_OUT, n, 'manifest.json'), 'utf8')));
    loadMan(srcName);
    const info = {
        v, src: srcName,
        // Секунда метки (cast, bite, fightStart, jump, landed, swap) от начала сцены, n-я по счёту
        mark: (scene, name, n) => {
            const man = loadMan(srcName), sc = man.scenes.find(s => s.name === scene);
            const list = man.events.filter(e => e.fn === 'mark' && e.args[0] === name && e.f >= sc.start && e.f < sc.end);
            const e = list[n || 0];
            if (!e) throw new Error('нет метки ' + name + ' #' + (n || 0) + ' в сцене ' + scene);
            return (e.f - sc.start) / man.fps;
        },
        sceneLen: (scene) => { const man = loadMan(srcName), sc = man.scenes.find(s => s.name === scene); return (sc.end - sc.start) / man.fps; },
        // Где в кадре голова рыбака ('head' — точка над головой, к ней цепляют облачко) и рыба/поплавок ('fish')
        // на секунде t сцены: доли кадра [x, y]. Положения пишет запись исходников (anc в manifest)
        anchor: (scene, t, which) => {
            const man = loadMan(srcName), sc = man.scenes.find(s => s.name === scene);
            const f0 = sc.start + Math.round(t * man.fps);
            for (let d = 0; d < 40; d++) {
                const a = (man.anc || []).find(r => r[0] === f0 + d);
                if (!a) continue;
                const x = which === 'head' ? a[1] : a[3], y = which === 'head' ? a[2] : a[4];
                if (x >= 0) return [+(x / man.css[0]).toFixed(4), +(y / man.css[1]).toFixed(4)];
            }
            throw new Error('нет якоря ' + which + ' в сцене ' + scene + ' около ' + t);
        }
    };
    const m0 = mod.music || { style: 'arena', theme: 'arena', seed: 7 };
    const plan = musicPlan(m0.style, m0.theme, m0.seed);
    info.bpm = plan.bpm;
    info.beat = (n) => +(0.05 + n * 60 / plan.bpm).toFixed(4);
    info.en = EN;
    const spec = resolve(mod.build(info), mans);
    if (EN) spec.name += '-en';
    spec.music = Object.assign({}, m0, spec.music || {});
    spec.beat = 60 / plan.bpm;
    const outDir = path.join(REC_OUT, spec.name);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'edit.json'), JSON.stringify(spec));
    console.log(`${spec.name}: ${spec.clips.length} клипов, ${spec.duration.toFixed(1)} с, темп ${plan.bpm}`);

    const { page, edge, profile } = await launch({ size: [800, 600, 1, false] });
    try {
        await page.send('Page.navigate', { url: 'http://127.0.0.1:8940/tools/rec/edit.html?edit=' + encodeURIComponent(spec.name) });
        let last = '';
        for (;;) {
            await sleep(800);
            const st = await page.eval('return { p: window.__progress, done: !!window.__done, err: window.__error || null };');
            if (st.err) throw new Error(st.err);
            if (st.p !== last && !/^видео: \d+[1-9]0 /.test(st.p)) { process.stdout.write('  ' + st.p + '\n'); }
            last = st.p;
            if (st.done) break;
        }
        const info2 = await page.eval('return window.__info;');
        const CH = 3 * 1024 * 1024, parts = [];
        for (let o = 0; o < info2.size; o += CH) {
            const b64 = await page.eval(`const b = window.__result.slice(${o}, ${o + CH}); const u = new Uint8Array(await b.arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(s);`);
            parts.push(Buffer.from(b64, 'base64'));
        }
        const out = path.join(outDir, spec.name + '.mp4');
        fs.writeFileSync(out, Buffer.concat(parts));
        if (process.argv.includes('--publish')) {
            const dst = path.join(__dirname, '..', '..', 'docs', 'promo', 'video');
            fs.mkdirSync(dst, { recursive: true });
            fs.copyFileSync(out, path.join(dst, spec.name + '.mp4'));
            console.log('  скопирован в docs/promo/video/' + spec.name + '.mp4');
        }
        // Контрольные кадры (spec.preview — секунды)
        const prev = await page.eval('return window.__previews || [];');
        prev.forEach((d, i) => fs.writeFileSync(path.join(outDir, 'p' + String(i).padStart(2, '0') + '.jpg'), Buffer.from(d.split(',')[1], 'base64')));
        console.log(`готово: ${out} — ${(info2.size / 1e6).toFixed(1)} МБ, кадров ${info2.frames}, пик звука ${info2.peak.peak.toFixed(2)}, средняя ${(info2.peak.rms * info2.peak.gain * 100).toFixed(0)}% (×${info2.peak.gain.toFixed(2)})`);
    } finally {
        const errors = page.logs.filter(l => /EXCEPTION|error/i.test(l));
        errors.slice(0, 10).forEach(e => console.log('  ' + e));
        edge.kill();
        await sleep(300);
        try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) { /* Edge ещё держит файлы */ }
    }
}

run(process.argv[2], process.argv[3] || 'h').catch(e => { console.error(e.message || e); process.exit(1); });
