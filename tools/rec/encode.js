// encode.js — собрать MP4 из записанных кадров и журнала звуков.
//   node tools/rec/encode.js gameplay-h  [путь/куда.mp4]
// Открывает tools/rec/encode.html в невидимом Edge: звук рендерится той же
// музыкой и звуками игры, видео — H.264, упаковка — tools/rec/mp4.js.

const fs = require('fs');
const path = require('path');
const { launch, sleep } = require('./rec.js');

async function run(name, outPath) {
    const { page, edge, profile } = await launch({ size: [800, 600, 1, false] });
    const out = outPath || path.join(require('./paths.js').REC_OUT, name, name + '.mp4');
    try {
        await page.send('Page.navigate', { url: 'http://127.0.0.1:8940/tools/rec/encode.html?film=' + encodeURIComponent(name) });
        let last = '';
        for (;;) {
            await sleep(700);
            const st = await page.eval('return { p: window.__progress, done: !!window.__done, err: window.__error || null };');
            if (st.err) throw new Error(st.err);
            if (st.p !== last) { process.stdout.write('  ' + st.p + '\n'); last = st.p; }
            if (st.done) break;
        }
        const info = await page.eval('return window.__info;');
        const size = info.size, CH = 3 * 1024 * 1024;
        const parts = [];
        for (let o = 0; o < size; o += CH) {
            const b64 = await page.eval(`const b = window.__result.slice(${o}, ${o + CH}); const u = new Uint8Array(await b.arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(s);`);
            parts.push(Buffer.from(b64, 'base64'));
        }
        fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, Buffer.concat(parts));
        console.log('  ' + JSON.stringify({ sizes: info.sizes, ts: info.ts }));
        console.log(`готово: ${out} — ${(size / 1e6).toFixed(1)} МБ, кадров ${info.frames}, AAC ${info.aac}, пик звука ${info.peak.peak.toFixed(2)} (усиление ${info.peak.gain.toFixed(2)})${info.reordered ? ', кадры переставлены (ctts)' : ''}`);
    } finally {
        const errors = page.logs.filter(l => /EXCEPTION|error/i.test(l));
        errors.slice(0, 10).forEach(e => console.log('  ' + e));
        edge.kill();
        await sleep(300);
        try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) { /* Edge ещё держит файлы */ }
    }
}

run(process.argv[2], process.argv[3]).catch(e => { console.error(e.message || e); process.exit(1); });
