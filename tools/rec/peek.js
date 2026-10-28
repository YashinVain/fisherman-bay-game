// peek.js — раскладка контрольных кадров ролика одной картинкой.
//   node tools/rec/peek.js ad-baika-v [столбцов] [ширина_холста]
// Берёт p00.jpg, p01.jpg… из папки ролика (их кладёт tools/rec/edit.js по списку
// preview из сценария монтажа) и сохраняет peek.png рядом. Путь печатается.

const fs = require('fs');
const path = require('path');
const { launch, sleep } = require('./rec.js');
const { REC_OUT } = require('./paths.js');

async function run(name, cols, width) {
    const dir = path.join(REC_OUT, name);
    const files = fs.readdirSync(dir).filter(f => /^p\d+\.jpg$/.test(f)).sort();
    if (!files.length) throw new Error('нет контрольных кадров в ' + dir);
    cols = +cols || 9; width = +width || 1800;
    const man = JSON.parse(fs.readFileSync(path.join(dir, 'edit.json'), 'utf8'));
    const ratio = man.size[1] / man.size[0];
    const rows = Math.ceil(files.length / cols);
    const cellW = (width - 8 - cols * 4) / cols;
    const height = Math.round(rows * (cellW * ratio + 4) + 12);
    const { page, edge, profile } = await launch({ size: [width, height, 1, false] });
    try {
        const url = 'http://127.0.0.1:8940/tools/rec/gallery.html?dir=/rec/' + name + '&files=' + files.join(',') + '&cols=' + cols;
        await page.send('Page.navigate', { url });
        await sleep(2500 + files.length * 120);
        const r = await page.send('Page.captureScreenshot', { format: 'png' });
        const out = path.join(dir, 'peek.png');
        fs.writeFileSync(out, Buffer.from(r.data, 'base64'));
        console.log(out);
    } finally {
        edge.kill();
        await sleep(300);
        try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) { /* Edge ещё держит файлы */ }
    }
}

run(process.argv[2], process.argv[3], process.argv[4]).then(() => process.exit(0), e => { console.error(e.message || e); process.exit(1); });
