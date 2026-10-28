// rec.js — запись видео из игры кадр за кадром.
//
//   node tools/serve.js                         (сервер игры, в отдельном окне)
//   node tools/rec/rec.js tools/rec/films/gameplay-h.js
//   node tools/rec/encode.js gameplay-h          (собрать MP4 со звуком)
//
// Фильм — это файл со сценами (см. tools/rec/films). Время игры идёт только
// когда снимается следующий кадр (tools/rec/timemachine.js), поэтому видео
// плавное и ровно 30 кадров в секунду, как бы долго ни снимался каждый кадр.
// Кадры складываются в tools/rec/out/<фильм>/, рядом — manifest.json
// со сценами и журналом звуков для звуковой дорожки.

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const EDGE = [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe'
].find(p => fs.existsSync(p));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function getJson(url, tries = 60) {
    for (let i = 0; i < tries; i++) {
        try { return await (await fetch(url)).json(); } catch (e) { await sleep(150); }
    }
    throw new Error('DevTools не отвечает: ' + url);
}

class Page {
    constructor(ws) {
        this.ws = ws; this.id = 0; this.wait = new Map(); this.logs = [];
        ws.addEventListener('message', (ev) => {
            const msg = JSON.parse(ev.data);
            if (msg.id && this.wait.has(msg.id)) {
                const { res, rej } = this.wait.get(msg.id);
                this.wait.delete(msg.id);
                msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
            } else if (msg.method === 'Runtime.consoleAPICalled') {
                this.logs.push(msg.params.type + ': ' + msg.params.args.map(a => a.value !== undefined ? a.value : a.description).join(' '));
            } else if (msg.method === 'Runtime.exceptionThrown') {
                const d = msg.params.exceptionDetails;
                this.logs.push('EXCEPTION: ' + (d.exception ? d.exception.description : d.text));
            }
        });
    }
    send(method, params = {}) {
        const id = ++this.id;
        this.ws.send(JSON.stringify({ id, method, params }));
        return new Promise((res, rej) => this.wait.set(id, { res, rej }));
    }
    async eval(expr) {
        const r = await this.send('Runtime.evaluate', { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true });
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text);
        return r.result.value;
    }
}

async function launch(film) {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'fb-rec-'));
    const port = 9300 + Math.floor(Math.random() * 500);
    const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
        '--no-first-run', '--autoplay-policy=no-user-gesture-required', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
    const list = await getJson(`http://127.0.0.1:${port}/json/list`);
    const ws = new WebSocket(list.find(t => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    const page = new Page(ws);
    await page.send('Page.enable');
    await page.send('Runtime.enable');
    const [w, h, dpr = 1, mobile = false] = film.size;
    await page.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile });
    if (mobile) await page.send('Emulation.setTouchEmulationEnabled', { enabled: true });
    return { page, edge, profile };
}

async function run(filmPath) {
    if (!EDGE) throw new Error('Не найден Microsoft Edge');
    const film = require(path.resolve(filmPath));
    const fps = film.fps || 30;
    const outDir = path.join(require('./paths.js').REC_OUT, film.name);
    const framesDir = path.join(outDir, 'frames');
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(framesDir, { recursive: true });
    const { page, edge, profile } = await launch(film);
    const t0 = Date.now();
    let frame = 0;
    const scenes = [];
    const spd = [];       // скорость времени игры по кадрам (1 — обычная, меньше — слоумо)
    try {
        await page.send('Page.addScriptToEvaluateOnNewDocument', {
            source: 'window.__maxDpr = 4;\n' + fs.readFileSync(path.join(__dirname, 'timemachine.js'), 'utf8')
        });
        await page.send('Page.navigate', { url: film.url || 'http://127.0.0.1:8940/' });
        await sleep(2500);
        // Дать игре проснуться: секунда «игрового» времени без съёмки
        for (let i = 0; i < 30; i++) await page.eval('await window.__tm.step(33.3);');
        await page.eval(fs.readFileSync(path.join(__dirname, 'helpers.js'), 'utf8'));
        await page.eval(`__rec.fps = ${fps}; __rec.touch = ${!!film.touch};`);
        if (film.setup) await page.eval(film.setup);
        for (let i = 0; i < 20; i++) await page.eval('await window.__tm.step(33.3);');
        await page.eval('__rec.hookAudio(); __rec.showPointer(' + (film.pointer !== false) + ');');
        await page.eval('await __tm.realWait(600);');

        for (const sc of film.scenes) {
            const start = frame;
            if (sc.js) {
                const v = await page.eval(sc.js);
                if (v !== undefined) console.log('  ' + sc.name + ': ' + JSON.stringify(v));
            }
            // Подготовка сцены без съёмки (переезд, загрузка) — время идёт, кадры не пишутся
            for (let i = 0; i < Math.round((sc.pre || 0) * fps); i++) await page.eval(`await __rec.step(${frame});`);
            if (sc.preJs) await page.eval(sc.preJs);
            await page.eval('await __tm.realWait(150);');
            const n = Math.round(sc.len * fps);
            const acts = (sc.at || []).map(([t, js]) => ({ f: Math.round(t * fps), js })).sort((a, b) => a.f - b.f);
            let ai = 0;
            let countdown = -1;
            // Скорость времени игры: speed — постоянная, slow — замедление, пока верно условие
            // (например, пока рыба в воздухе). Скорость меняется плавно, без рывка.
            const base = sc.speed || 1;
            let cur = base, cond = [false, false];
            for (let k = 0; k < n; k++) {
                while (ai < acts.length && acts[ai].f <= k) {
                    try { await page.eval(acts[ai].js); } catch (e) { console.log('  ! ' + sc.name + ' @' + (acts[ai].f / fps).toFixed(2) + ': ' + e.message.split('\n')[0]); }
                    ai++;
                }
                const target = sc.slow && cond[0] ? sc.slow.speed : base;
                cur += (target - cur) * Math.min(1, (1 / fps) / ((sc.slow && sc.slow.ramp) || 0.15));
                const ms = 1000 / fps * cur;
                spd.push(+cur.toFixed(3));
                cond = await page.eval(`await __rec.step(${frame}, ${ms}); return [${sc.slow ? '!!(' + sc.slow.when + ')' : 'false'}, ${sc.until ? '!!(' + sc.until + ')' : 'false'}];`);
                // Режим снимков: ждём нужного момента (until), выдерживаем after секунд — один PNG
                if (film.stills) {
                    if (countdown < 0 && sc.until && cond[1]) countdown = Math.round((sc.after || 0) * fps);
                    if (countdown === 0 || k === n - 1) {
                        if (sc.until && countdown !== 0) console.log('  ! ' + sc.name + ': момент так и не наступил, снимаю как есть');
                        if (sc.beforeShot) await page.eval(sc.beforeShot);
                        await page.eval('await __tm.realWait(250);');
                        const r = await page.send('Page.captureScreenshot', { format: 'png' });
                        fs.writeFileSync(path.join(outDir, sc.shot || (sc.name + '.png')), Buffer.from(r.data, 'base64'));
                        break;
                    }
                    if (countdown > 0) countdown--;
                    continue;
                }
                const r = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: film.quality || 93, optimizeForSpeed: false });
                fs.writeFileSync(path.join(framesDir, String(frame).padStart(5, '0') + '.jpg'), Buffer.from(r.data, 'base64'));
                frame++;
                // Обычная съёмка тоже может закончить сцену по условию (until + after секунд)
                if (sc.until) {
                    if (countdown < 0 && cond[1]) countdown = Math.round((sc.after || 0) * fps);
                    if (countdown === 0) break;
                    if (countdown > 0) countdown--;
                }
            }
            scenes.push({ name: sc.name, start, end: frame, transition: sc.transition || 'cut' });
            process.stdout.write(`  сцена «${sc.name}»: ${frame - start} кадров (${((Date.now() - t0) / 1000).toFixed(0)} с)\n`);
        }
        const events = await page.eval('return __rec.events;');
        const logs = await page.eval('return { ptr: __rec.ptrLog || [], taps: __rec.tapLog || [], anc: __rec.ancLog || [], rum: __rec.rumLog || {} };');
        const [w, h, dpr = 1] = film.size;
        fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify({
            name: film.name, fps, frames: frame, width: Math.round(w * dpr), height: Math.round(h * dpr),
            css: [w, h], dpr, touch: !!film.touch,
            scenes, events, music: film.music || null, created: new Date().toISOString(),
            spd, ptr: logs.ptr, taps: logs.taps, anc: logs.anc, rum: logs.rum
        }));
    } finally {
        const errors = page.logs.filter(l => /EXCEPTION|error/i.test(l) && !/sdk\.js|404/.test(l));
        if (page.logs.length) fs.writeFileSync(path.join(outDir, 'console.txt'), page.logs.join('\n'));
        console.log(`кадров: ${frame}, секунд видео: ${(frame / fps).toFixed(1)}, ошибок в консоли: ${errors.length}`);
        errors.slice(0, 10).forEach(e => console.log('  ' + e));
        edge.kill();
        await sleep(300);
        try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) { /* Edge ещё держит файлы */ }
    }
}

if (require.main === module) run(process.argv[2]).then(() => process.exit(0), e => { console.error(e); process.exit(1); });
module.exports = { launch, Page, getJson, sleep };
