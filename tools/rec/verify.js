// verify.js — проверить готовые ролики: контейнер, декодирование всех кадров, звук.
//   node tools/rec/verify.js docs/promo/video/ad-baika-h.mp4 [ещё файлы…]
// Открывает tools/rec/verify.html и tools/rec/audiocheck.html в невидимом Edge.
const path = require('path');
const { launch, sleep } = require('./rec.js');

async function run(files) {
    const { page, edge, profile } = await launch({ size: [800, 600, 1, false] });
    try {
        for (const f of files) {
            const url = '/' + path.relative(path.join(__dirname, '..', '..'), path.resolve(f)).split(path.sep).join('/');
            await page.send('Page.navigate', { url: 'http://127.0.0.1:8940/tools/rec/verify.html?v=' + url });
            await sleep(600);
            const v = await page.eval('return await window.__verify;');
            await page.send('Page.navigate', { url: 'http://127.0.0.1:8940/tools/rec/audiocheck.html?v=' + url });
            await sleep(600);
            const a = await page.eval('return await window.__audio;');
            const vt = v.tracks.find(t => t.kind === 'vide') || {}, at = v.tracks.find(t => t.kind === 'soun') || {};
            const rms = a.rms || [];
            const avg = rms.length ? (rms.reduce((x, y) => x + y, 0) / rms.length).toFixed(1) : '?';
            const ok = v.decoded === vt.samples && !v.decodeError && v.frozenPairs === 0 && at.kind === 'soun' && a.clipSamples === 0 && v.moovFirst;
            console.log((ok ? '✓ ' : '✗ ') + path.basename(f) + ': ' + vt.w + 'x' + vt.h + ', ' + vt.seconds + ' с, ' + vt.samples + ' кадров (декодировано ' + v.decoded + '), ' + (v.bytes / 1e6).toFixed(1) + ' МБ, ключевых ' + vt.keyframes +
                ', звук ' + (at.seconds || 0) + ' с, средняя громкость ' + avg + '%, пик ' + a.peak + ', перегруз ' + a.clipSamples + ', замёрзших пар ' + v.frozenPairs + ', moov в начале: ' + v.moovFirst + (v.decodeError ? ', ОШИБКА ' + v.decodeError : ''));
        }
    } finally {
        edge.kill();
        await sleep(300);
        try { require('fs').rmSync(profile, { recursive: true, force: true }); } catch (e) { /* Edge ещё держит файлы */ }
    }
}
run(process.argv.slice(2)).then(() => process.exit(0), e => { console.error(e.message || e); process.exit(1); });
