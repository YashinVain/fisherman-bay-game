// light.js — лёгкие копии готовых роликов для загрузки в консоль Яндекс Игр через адресную строку.
//   node tools/rec/light.js docs/promo/video/ad-baika-h.mp4 [ещё файлы…]
// Рядом кладёт <имя>-up.mp4: короткая сторона 720 пикселей, файл не больше 4,9 МБ, звук без пережатия.
// Ключи: --mb=3 (другой предел, МБ), --short=540 (другая короткая сторона).
// Нужен запущенный сервер: node tools/serve.js. Открывает tools/rec/light.html в невидимом Edge.
const fs = require('fs');
const path = require('path');
const { launch, sleep } = require('./rec.js');

const ROOT = path.join(__dirname, '..', '..');
const opt = (name, def) => { const a = process.argv.find(x => x.startsWith('--' + name + '=')); return a ? a.split('=')[1] : def; };

async function run(files) {
    const { page, edge, profile } = await launch({ size: [800, 600, 1, false] });
    try {
        for (const f of files) {
            const src = path.resolve(f);
            const dst = src.replace(/\.mp4$/, '-up.mp4');
            const url = '/' + path.relative(ROOT, src).split(path.sep).join('/');
            await page.send('Page.navigate', { url: `http://127.0.0.1:8940/tools/rec/light.html?v=${url}&s=${opt('short', 720)}&mb=${opt('mb', 4.9)}` });
            let last = '';
            for (;;) {
                await sleep(700);
                const st = await page.eval('return { p: window.__progress, done: !!window.__done, err: window.__error || null };');
                if (st.err) throw new Error(path.basename(f) + ': ' + st.err);
                if (st.p !== last && !/кадр \d+ \//.test(st.p)) process.stdout.write('  ' + path.basename(f) + ' · ' + st.p + '\n');
                last = st.p;
                if (st.done) break;
            }
            const info = await page.eval('return window.__info;');
            const CH = 3 * 1024 * 1024, parts = [];
            for (let o = 0; o < info.size; o += CH) {
                const b64 = await page.eval(`const b = window.__result.slice(${o}, ${o + CH}); const u = new Uint8Array(await b.arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(s);`);
                parts.push(Buffer.from(b64, 'base64'));
            }
            fs.writeFileSync(dst, Buffer.concat(parts));
            console.log(`✓ ${path.basename(dst)}: ${info.w}x${info.h}, ${info.seconds} с, ${(info.size / 1e6).toFixed(2)} МБ, видео ${info.videoMbps} Мбит/с`);
        }
    } finally {
        edge.kill();
        await sleep(300);
        try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) { /* Edge ещё держит файлы */ }
    }
}

// Свои лёгкие копии (-up.mp4) пропускаем, чтобы можно было отдать всю папку сразу
const files = process.argv.slice(2).filter(a => !a.startsWith('--') && !/-up\.mp4$/.test(a));
if (!files.length) { console.error('Укажите ролики: node tools/rec/light.js docs/promo/video/ad-baika-h.mp4'); process.exit(1); }
run(files).then(() => process.exit(0), e => { console.error(e.message || e); process.exit(1); });
