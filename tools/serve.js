// serve.js — маленький сервер, чтобы открыть игру в браузере.
//   node tools/serve.js            → http://127.0.0.1:8940
//   node tools/serve.js 8940 --lan → ещё и с телефона в той же Wi-Fi сети
// Кэш выключен: после правок браузер сразу видит новую версию.
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const args = process.argv.slice(2);
const lan = args.includes('--lan');
const port = +(args.find(a => /^\d+$/.test(a)) || 8940);
const root = path.resolve(__dirname, '..');
const REC = require('./rec/paths.js').REC_OUT;   // кадры записи видео — по адресу /rec/

const TYPES = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
    '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.mp4': 'video/mp4', '.webm': 'video/webm', '.wav': 'audio/wav'
};

http.createServer((req, res) => {
    // Материалы для консоли Яндекса (docs/promo, dist) страница консоли забирает отсюда сама
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Private-Network': 'true', 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Allow-Headers': '*' };
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
    Object.entries(cors).forEach(([k, v]) => res.setHeader(k, v));
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    const base = p.startsWith('/rec/') ? REC : root;
    const file = path.join(base, p.startsWith('/rec/') ? p.slice(4) : p);
    if (!file.startsWith(base + path.sep) || file.includes(path.sep + '.git')) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, data) => {
        if (err) { res.writeHead(404); return res.end('404'); }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(data);
    });
}).listen(port, lan ? '0.0.0.0' : '127.0.0.1', () => {
    console.log(`Игра: http://127.0.0.1:${port}/`);
    if (lan) {
        Object.values(os.networkInterfaces()).flat()
            .filter(a => a && a.family === 'IPv4' && !a.internal)
            .forEach(a => console.log(`С телефона: http://${a.address}:${port}/`));
    }
});
