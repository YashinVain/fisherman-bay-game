// see.js — посмотреть кадры из готового MP4 одной картинкой (декодируется настоящий файл).
//   node tools/rec/see.js docs/promo/video/ad-baika-h.mp4 "from=7&to=9&step=0.2" [столбцов] [выходной.png]
// Результат — png в %TEMP%\fishing-tales-rec\see.png (или по четвёртому аргументу).
const fs = require('fs');
const path = require('path');
const { launch, sleep } = require('./rec.js');
const { REC_OUT } = require('./paths.js');

async function run(file, query, cols, out) {
    cols = +cols || 6;
    const url = '/' + path.relative(path.join(__dirname, '..', '..'), path.resolve(file)).split(path.sep).join('/');
    const { page, edge, profile } = await launch({ size: [1800, 1000, 1, false] });
    try {
        await page.send('Page.navigate', { url: 'http://127.0.0.1:8940/tools/rec/frames.html?v=' + url + '&' + query + '&cols=' + cols });
        await sleep(500);
        const info = await page.eval('return await window.__frames;');
        // Высота страницы по содержимому — снимаем целиком
        const h = await page.eval('return document.documentElement.scrollHeight;');
        await page.send('Emulation.setDeviceMetricsOverride', { width: 1800, height: Math.min(4000, h + 8), deviceScaleFactor: 1, mobile: false });
        await sleep(300);
        const r = await page.send('Page.captureScreenshot', { format: 'png' });
        const dst = out || path.join(REC_OUT, 'see.png');
        fs.writeFileSync(dst, Buffer.from(r.data, 'base64'));
        console.log(dst + '  (' + info.shown + ' кадров, ' + info.w + 'x' + info.h + ')');
    } finally {
        edge.kill();
        await sleep(300);
        try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) { /* Edge ещё держит файлы */ }
    }
}
run(process.argv[2], process.argv[3] || 'from=0&to=3&step=0.5', process.argv[4], process.argv[5]).then(() => process.exit(0), e => { console.error(e.message || e); process.exit(1); });
