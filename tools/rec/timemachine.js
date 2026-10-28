// timemachine.js — «машина времени» для записи видео (tools/rec/rec.js).
// Подключается в страницу игры раньше её скриптов. Подменяет часы страницы:
// performance.now, Date, setTimeout/setInterval и requestAnimationFrame идут
// не сами, а только когда запись говорит «следующий кадр» (__tm.step).
// CSS-анимации и переходы тоже ставятся на паузу и двигаются вручную.
// Так каждый кадр видео — ровно 1/30 секунды игры, без рывков, сколько бы
// ни снимался сам кадр.

(function () {
    const real = {
        now: performance.now.bind(performance),
        raf: window.requestAnimationFrame.bind(window),
        setTimeout: window.setTimeout.bind(window)
    };
    // Случайность с зерном: перезапись даёт тот же ролик (те же рыбы, рывки, брызги)
    let seed = (window.__seed || 20261022) >>> 0;
    Math.random = () => {
        seed = (seed + 0x6D2B79F5) >>> 0;
        let x = seed;
        x = Math.imul(x ^ x >>> 15, x | 1);
        x ^= x + Math.imul(x ^ x >>> 7, x | 61);
        return ((x ^ x >>> 14) >>> 0) / 4294967296;
    };
    const RealDate = window.Date;
    const t0 = RealDate.now();
    let vt = 0;
    const timers = new Map();
    let nextTimer = 1;
    const rafs = new Map();
    let nextRaf = 1;

    performance.now = () => vt;
    function VDate(...a) {
        if (!(this instanceof VDate)) return new RealDate(t0 + vt).toString();
        return a.length ? new RealDate(...a) : new RealDate(t0 + vt);
    }
    VDate.prototype = RealDate.prototype;
    VDate.now = () => t0 + vt;
    VDate.UTC = RealDate.UTC;
    VDate.parse = RealDate.parse;
    window.Date = VDate;

    window.setTimeout = (fn, ms, ...args) => {
        const id = nextTimer++;
        timers.set(id, { at: vt + Math.max(0, +ms || 0), fn, args, seq: id });
        return id;
    };
    window.setInterval = (fn, ms, ...args) => {
        const id = nextTimer++;
        const every = Math.max(4, +ms || 0);
        timers.set(id, { at: vt + every, fn, args, every, seq: id });
        return id;
    };
    window.clearTimeout = window.clearInterval = (id) => { timers.delete(id); };
    window.requestAnimationFrame = (fn) => { const id = nextRaf++; rafs.set(id, fn); return id; };
    window.cancelAnimationFrame = (id) => { rafs.delete(id); };

    // CSS-анимации и переходы: запоминаем, когда началась каждая, и ставим время сами
    const started = new WeakMap();
    function syncAnimations() {
        for (const a of document.getAnimations()) {
            let st = started.get(a);
            if (st === undefined) {
                st = vt - (a.currentTime || 0);
                started.set(a, st);
                try { a.pause(); } catch (e) { /* уже закончилась */ }
            }
            const t = vt - st;
            const timing = a.effect ? a.effect.getComputedTiming() : null;
            const end = timing ? timing.endTime : Infinity;
            if (isFinite(end) && t >= end) { try { a.finish(); } catch (e) { /* бесконечная */ } }
            else { try { a.currentTime = t; } catch (e) { /* пропускаем */ } }
        }
    }

    const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };

    window.__tm = {
        get t() { return vt; },
        // Шаг на ms миллисекунд: таймеры по порядку, потом кадр игры, потом анимации
        async step(ms, paint) {
            const target = vt + ms;
            for (let guard = 0; guard < 5000; guard++) {
                let best = null;
                for (const [id, t] of timers) {
                    if (t.at <= target && (!best || t.at < best.t.at || (t.at === best.t.at && t.seq < best.t.seq))) best = { id, t };
                }
                if (!best) break;
                vt = Math.max(vt, best.t.at);
                if (best.t.every) { best.t.at += best.t.every; best.t.seq = nextTimer++; } else timers.delete(best.id);
                try { best.t.fn(...best.t.args); } catch (e) { console.error(e); }
                await flush();
            }
            vt = target;
            const cbs = [...rafs.values()];
            rafs.clear();
            for (const fn of cbs) { try { fn(vt); } catch (e) { console.error(e); } }
            await flush();
            syncAnimations();
            // Дать браузеру нарисовать кадр (для звука не нужно)
            if (paint !== false) await new Promise(r => real.raf(() => real.raf(r)));
            return vt;
        },
        // Подождать по-настоящему (для загрузки картинок и шрифтов)
        realWait: (ms) => new Promise(r => real.setTimeout(r, ms))
    };
})();
