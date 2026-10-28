// build.js — собирает архив для Яндекс Игр. Запуск: node tools/build.js
//
//   1. Берёт index.html и все подключённые в нём скрипты (в том же порядке)
//   2. Склеивает их в один game.js — меньше запросов, быстрее загрузка
//   3. Убирает комментарии (исходники не трогает)
//   4. Кладёт в dist/fishing-tales/: index.html, game.js, css/style.css, fonts/
//   5. Упаковывает dist/fishing-tales.zip — его и загружаем в консоль Яндекса
// Никаких npm-пакетов: ZIP собирается встроенным в Node модулем zlib.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const STRIP = require('./strip.js');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'dist', 'fishing-tales');
const ZIP = path.join(ROOT, 'dist', 'fishing-tales.zip');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let html = read('index.html');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
if (!scripts.length) throw new Error('В index.html нет ни одного <script src>');
const version = (read('js/game/state.js').match(/FB\.VERSION = '([^']+)'/) || [])[1] || '0';

const bundle = [`// Рыбацкие байки ${version}`].concat(scripts.map(src => `\n// ===== ${src} =====\n` + read(src))).join('\n');
const first = html.indexOf('<script src=');
const last = html.lastIndexOf('</script>') + '</script>'.length;
html = html.slice(0, first) + `<script src="game.js?v=${version}"></script>` + html.slice(last);
html = html.replace(/\s*<!-- Порядок важен:[^>]*-->/, '').replace('href="css/style.css"', `href="css/style.css?v=${version}"`);

const cleanJs = STRIP.stripJs(bundle);
new Function(cleanJs);   // проверка, что после чистки код целый

fs.rmSync(path.join(ROOT, 'dist'), { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'css'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'fonts'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'index.html'), STRIP.stripHtml(html));
fs.writeFileSync(path.join(OUT, 'game.js'), cleanJs);
fs.writeFileSync(path.join(OUT, 'css', 'style.css'), STRIP.stripCss(read('css/style.css')));
fs.readdirSync(path.join(ROOT, 'fonts')).forEach(f => fs.copyFileSync(path.join(ROOT, 'fonts', f), path.join(OUT, 'fonts', f)));

// ---------- ZIP ----------
const CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
})();
const crc32 = (buf) => { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const list = (dir, base = '') => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const rel = base ? base + '/' + e.name : e.name;
    return e.isDirectory() ? list(path.join(dir, e.name), rel) : [rel];
});

const files = list(OUT);
files.forEach(f => { if (!/^[A-Za-z0-9._\-/]+$/.test(f)) throw new Error('Имя файла не подходит для Яндекса: ' + f); });
const local = [], central = [];
let offset = 0;
const now = new Date();
const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
files.forEach(name => {
    const data = fs.readFileSync(path.join(OUT, name));
    const comp = zlib.deflateRawSync(data, { level: 9 });
    const nb = Buffer.from(name, 'utf8'), crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6); lh.writeUInt16LE(8, 8);
    lh.writeUInt16LE(dosTime, 10); lh.writeUInt16LE(dosDate, 12); lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nb.length, 26); lh.writeUInt16LE(0, 28);
    local.push(lh, nb, comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0, 8); ch.writeUInt16LE(8, 10);
    ch.writeUInt16LE(dosTime, 12); ch.writeUInt16LE(dosDate, 14); ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nb.length, 28); ch.writeUInt32LE(offset, 42);
    central.push(ch, nb);
    offset += lh.length + nb.length + comp.length;
});
const cBuf = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(cBuf.length, 12); end.writeUInt32LE(offset, 16);
fs.writeFileSync(ZIP, Buffer.concat([...local, cBuf, end]));

const kb = (n) => (n / 1024).toFixed(1) + ' КБ';
const total = files.reduce((s, f) => s + fs.statSync(path.join(OUT, f)).size, 0);
console.log(`Версия ${version}: ${files.length} файлов, ${kb(total)} без сжатия, архив ${kb(fs.statSync(ZIP).size)}`);
files.forEach(f => console.log('  ' + f));
console.log('Готово: dist/fishing-tales.zip — его загружаем в черновик игры в консоли Яндекс Игр');
