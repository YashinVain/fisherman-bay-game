// gfx.js — графика рекламных роликов для монтажки (tools/rec/edit.html).
// Всё рисуется холстом поверх кадров игры, в стиле игры: шрифт Nunito, толстая
// тёмная обводка, золото и вода. Каждая штука — функция (ctx, g, t, W, H),
// где t — секунды от появления, g — параметры из сценария монтажа.

(function () {
    const G = window.GFX = {};
    const TAU = Math.PI * 2;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const lerp = (a, b, k) => a + (b - a) * k;
    const easeOut = (k) => 1 - Math.pow(1 - clamp(k, 0, 1), 3);
    const easeIn = (k) => Math.pow(clamp(k, 0, 1), 3);
    const easeIO = (k) => { k = clamp(k, 0, 1); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
    // Пружина: перелёт и успокоение (для «вылетов» букв и плашек)
    const spring = (k) => { k = clamp(k, 0, 1); return 1 - Math.exp(-6.5 * k) * Math.cos(11 * k); };
    G.ease = { easeOut, easeIn, easeIO, spring };
    // Генератор с зерном: одинаковые частицы при каждой сборке
    const seeded = (s) => () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    G.seeded = seeded;
    const M = (W, H) => Math.min(W, H);
    const FONT = (px) => '900 ' + Math.round(px) + 'px Nunito, sans-serif';
    const RARITY = { common: ['#9aa7b1', 'Обычная'], uncommon: ['#5cbf5a', 'Необычная'], rare: ['#3f8fe8', 'Редкая'], epic: ['#a35de0', 'Эпическая'], legendary: ['#f2b51d', 'Легендарная'] };

    // Надпись «как в игре»: обводка, тень, градиент сверху вниз
    function bigText(ctx, text, x, y, px, fillTop, fillBot, stroke, opt) {
        opt = opt || {};
        ctx.font = FONT(px);
        ctx.textAlign = opt.align || 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.lineJoin = 'round';
        const sw = px * (opt.sw || 0.22);
        ctx.lineWidth = sw; ctx.strokeStyle = stroke;
        ctx.strokeText(text, x, y + px * 0.09);
        ctx.strokeText(text, x, y);
        const g = ctx.createLinearGradient(0, y - px * 0.82, 0, y + px * 0.05);
        g.addColorStop(0, fillTop); g.addColorStop(1, fillBot);
        ctx.fillStyle = g;
        ctx.fillText(text, x, y);
        if (opt.shine !== false) {
            // Блик по верху букв
            ctx.save();
            ctx.globalCompositeOperation = 'source-atop';
            ctx.restore();
        }
    }
    G.bigText = bigText;
    // Размер шрифта, при котором текст влезает в ширину maxW (с запасом на обводку)
    function fitPx(ctx, text, px, maxW) {
        ctx.font = FONT(px);
        const w = ctx.measureText(text).width + px * 0.4;
        return w > maxW ? px * maxW / w : px;
    }
    G.fitPx = fitPx;

    // ---------- Брызги и частицы ----------
    function splash(ctx, x, y, r, k, seed, color) {
        const rnd = seeded(seed || 7);
        ctx.save();
        ctx.globalAlpha = 1 - easeIn(k);
        for (let i = 0; i < 18; i++) {
            const a = -Math.PI * (0.1 + rnd() * 0.8), sp = r * (0.6 + rnd() * 1.1);
            const px = x + Math.cos(a) * sp * easeOut(k) * (rnd() < 0.5 ? 1 : -1);
            const py = y + Math.sin(a) * sp * easeOut(k) + r * 1.6 * k * k;
            ctx.fillStyle = color || (i % 3 ? '#eaf8ff' : '#9fdcff');
            ctx.beginPath(); ctx.arc(px, py, r * (0.05 + rnd() * 0.07) * (1 - k * 0.5), 0, TAU); ctx.fill();
        }
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.8 * (1 - k)) + ')';
        ctx.lineWidth = r * 0.04;
        ctx.beginPath(); ctx.ellipse(x, y + r * 0.1, r * (0.4 + k * 1.2), r * (0.1 + k * 0.25), 0, 0, TAU); ctx.stroke();
        ctx.restore();
    }
    function star(ctx, x, y, r, rot, color) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
        ctx.fillStyle = color || '#fff6c0';
        ctx.beginPath();
        for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, rr = i % 2 ? r * 0.32 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        ctx.closePath(); ctx.fill();
        ctx.restore();
    }
    G.star = star;

    // Искры: разлёт звёздочек из точки
    G.burst = (ctx, g, t, W, H) => {
        const n = g.n || 22, life = g.dur || 0.9, rnd = seeded(g.seed || 3);
        const x = g.x * W, y = g.y * H, R = M(W, H) * (g.r || 0.28);
        for (let i = 0; i < n; i++) {
            const a = rnd() * TAU, sp = 0.4 + rnd() * 0.6, d = rnd() * 0.15;
            const k = clamp((t - d) / life, 0, 1);
            if (k <= 0 || k >= 1) continue;
            const e = easeOut(k);
            const px = x + Math.cos(a) * R * sp * e, py = y + Math.sin(a) * R * sp * e + R * 0.25 * k * k;
            ctx.globalAlpha = 1 - k;
            star(ctx, px, py, M(W, H) * (0.012 + rnd() * 0.016) * (1 - k * 0.4), k * 3 + i, i % 4 === 0 ? '#ffffff' : (g.color || '#ffe27a'));
        }
        ctx.globalAlpha = 1;
    };
    // Конфетти сверху
    G.confetti = (ctx, g, t, W, H) => {
        const n = g.n || 90, rnd = seeded(g.seed || 11);
        const cols = ['#ff5a7a', '#ffd23a', '#5cc8f6', '#8ee26a', '#b48cff', '#ff9a3c'];
        for (let i = 0; i < n; i++) {
            const x0 = rnd() * W, d = rnd() * 0.6, sp = 0.35 + rnd() * 0.45, sw = rnd() * TAU;
            const k = t - d;
            if (k < 0) continue;
            const y = -H * 0.05 + k * H * sp, x = x0 + Math.sin(k * 3 + sw) * W * 0.03;
            if (y > H * 1.05) continue;
            ctx.save(); ctx.translate(x, y); ctx.rotate(k * 5 + sw);
            ctx.scale(1, Math.cos(k * 7 + sw));
            ctx.fillStyle = cols[i % cols.length];
            const s = M(W, H) * 0.012;
            ctx.fillRect(-s, -s * 0.5, s * 2, s);
            ctx.restore();
        }
    };
    // Линии скорости из точки (как в аниме) — для свечки в замедлении
    G.speedlines = (ctx, g, t, W, H) => {
        const rnd = seeded(Math.floor(t * 20) + 5);
        const x = (g.x || 0.5) * W, y = (g.y || 0.5) * H, R = Math.hypot(W, H);
        const fade = Math.min(1, t / 0.15, ((g.dur || 1) - t) / 0.2);
        ctx.save();
        ctx.globalAlpha = 0.55 * clamp(fade, 0, 1);
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 46; i++) {
            const a = rnd() * TAU, r0 = R * (0.22 + rnd() * 0.12), r1 = R * 0.75, w = 0.004 + rnd() * 0.01;
            ctx.beginPath();
            ctx.moveTo(x + Math.cos(a - w) * r1, y + Math.sin(a - w) * r1);
            ctx.lineTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0);
            ctx.lineTo(x + Math.cos(a + w) * r1, y + Math.sin(a + w) * r1);
            ctx.fill();
        }
        ctx.restore();
    };
    // Виньетка (тёмная или цветная, может пульсировать)
    G.vignette = (ctx, g, t, W, H) => {
        let a = g.alpha === undefined ? 0.5 : g.alpha;
        if (g.pulse) a *= 0.55 + 0.45 * Math.abs(Math.sin(t * Math.PI * g.pulse));
        const fade = clamp(Math.min(t / 0.2, ((g.dur || 1) - t) / 0.25), 0, 1);
        const col = g.color || '0,0,0';
        const gr = ctx.createRadialGradient(W / 2, H / 2, M(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.6);
        gr.addColorStop(0, 'rgba(' + col + ',0)'); gr.addColorStop(1, 'rgba(' + col + ',' + (a * fade) + ')');
        ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    };
    G.flash = (ctx, g, t, W, H) => {
        const k = clamp(t / (g.dur || 0.35), 0, 1);
        ctx.fillStyle = 'rgba(' + (g.color || '255,255,255') + ',' + ((g.alpha || 0.9) * (1 - easeOut(k))) + ')';
        ctx.fillRect(0, 0, W, H);
    };
    // Кинополосы сверху и снизу
    G.letterbox = (ctx, g, t, W, H) => {
        const d = g.dur || 2, k = Math.min(easeOut(t / 0.35), easeOut((d - t) / 0.35));
        const h = H * (g.h || 0.1) * clamp(k, 0, 1);
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, h); ctx.fillRect(0, H - h, W, h);
    };

    // ---------- Огромное слово по буквам (глава ролика) ----------
    G.word = (ctx, g, t, W, H) => {
        const text = g.text, d = g.dur || 1.4;
        let px = M(W, H) * (g.size || 0.2);
        ctx.font = FONT(px);
        const letters = [...text];
        let widths = letters.map(ch => ctx.measureText(ch).width);
        // Слово шире кадра (телефон) — уменьшаем, чтобы влезло с полями
        const fit = W * (g.maxW || 0.9) / (widths.reduce((a, b) => a + b, 0) * 1.02 + px * 0.3);
        if (fit < 1) { px *= fit; ctx.font = FONT(px); widths = letters.map(ch => ctx.measureText(ch).width); }
        const total = widths.reduce((a, b) => a + b, 0) * 1.02;
        let x = (g.x || 0.5) * W - total / 2;
        const y = (g.y || 0.5) * H + px * 0.35;
        const out = clamp((t - (d - 0.28)) / 0.28, 0, 1);
        // Лёгкое затемнение позади — чтобы слово «читалось» на любом фоне
        ctx.save();
        const dark = clamp(t / 0.15, 0, 1) * (1 - out) * 0.38;
        const gr = ctx.createRadialGradient(W / 2, y - px * 0.35, px * 0.2, W / 2, y - px * 0.35, total * 0.75);
        gr.addColorStop(0, 'rgba(10,20,50,' + dark + ')'); gr.addColorStop(1, 'rgba(10,20,50,0)');
        ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
        ctx.restore();
        const tilt = (g.tilt === undefined ? -4 : g.tilt) * Math.PI / 180;
        letters.forEach((ch, i) => {
            const t0 = i * (g.stagger || 0.05);
            const k = clamp((t - t0) / 0.42, 0, 1);
            const cx = x + widths[i] / 2;
            x += widths[i] * 1.02;
            if (k <= 0) return;
            const s = spring(k) * (1 + out * 0.3);
            const dy = (1 - easeOut(k)) * -px * 0.8;
            const rot = (1 - spring(k)) * (i % 2 ? 0.5 : -0.5) + tilt;
            ctx.save();
            ctx.globalAlpha = 1 - out;
            ctx.translate(cx, y + dy + Math.sin((t - t0) * 6) * px * 0.012 * (1 - out));
            ctx.rotate(rot);
            ctx.scale(s, s);
            bigText(ctx, ch, 0, 0, px, g.top || '#fffbe0', g.bot || '#ffb21a', g.stroke || '#22183f');
            ctx.restore();
            // Брызги, когда буква «плюхнулась»
            const ks = (t - t0 - 0.12) / 0.6;
            if (g.splash !== false && ks > 0 && ks < 1) splash(ctx, cx, y + px * 0.08, px * 0.45, ks, 11 + i);
        });
    };

    // ---------- Логотип игры ----------
    G.logo = (ctx, g, t, W, H) => {
        const s = M(W, H) * (g.size || 0.2), x = (g.x || 0.5) * W, y = (g.y || 0.45) * H, d = g.dur || 2;
        const out = g.keep ? 0 : clamp((t - (d - 0.3)) / 0.3, 0, 1);
        ctx.save();
        ctx.globalAlpha = 1 - out;
        // Золотой карп прыгает над названием
        const fish = window.FB && FB.fishArt ? FB.fishArt.canvas('goldcarp', 300) : null;
        const kf = clamp((t - 0.25) / 0.9, 0, 1);
        if (fish && kf > 0) {
            const fx = x + s * lerp(-1.4, 1.1, kf), fy = y - s * 1.15 - Math.sin(kf * Math.PI) * s * 0.9;
            ctx.save(); ctx.translate(fx, fy); ctx.rotate(lerp(-0.7, 0.8, kf)); ctx.scale(-1, 1);
            const fw = s * 1.1, fh = fw * fish.height / fish.width;
            ctx.drawImage(fish, -fw / 2, -fh / 2, fw, fh);
            ctx.restore();
            if (kf > 0.05 && kf < 0.25) splash(ctx, x - s * 1.2, y - s * 0.6, s * 0.8, (kf - 0.05) / 0.2 * 0.6, 21);
        }
        const k1 = clamp(t / 0.5, 0, 1), k2 = clamp((t - 0.15) / 0.55, 0, 1);
        if (k1 > 0) {
            ctx.save(); ctx.translate(x, y - s * 0.74 + (1 - easeOut(k1)) * -s); ctx.rotate(-0.05); ctx.scale(spring(k1), spring(k1));
            bigText(ctx, g.top || 'Рыбацкие', 0, 0, s * 0.55, '#ffffff', '#e2f4ff', '#0d4f72', { sw: 0.3 });
            ctx.restore();
        }
        if (k2 > 0) {
            ctx.save(); ctx.translate(x, y + s * 0.42 + (1 - easeOut(k2)) * -s * 1.4); ctx.scale(spring(k2) * (1 + out * 0.2), spring(k2) * (1 + out * 0.2));
            bigText(ctx, g.big || 'БАЙКИ', 0, 0, s * 1.05, '#fffbe0', '#ff9a1a', '#0d4f72', { sw: 0.26 });
            ctx.restore();
            const ks = (t - 0.45) / 0.7;
            if (ks > 0 && ks < 1) splash(ctx, x, y + s * 0.5, s * 1.1, ks, 31);
        }
        // Искорки вокруг
        const rnd = seeded(5);
        for (let i = 0; i < 7; i++) {
            const a = rnd() * TAU, r = s * (1.2 + rnd() * 0.9), tw = Math.sin(t * 5 + i * 2);
            if (t < 0.6 + i * 0.08) continue;
            star(ctx, x + Math.cos(a) * r * 1.4, y + Math.sin(a) * r * 0.55, s * 0.07 * (0.6 + 0.4 * tw), t + i);
        }
        ctx.restore();
        if (g.sub) {
            const ks = clamp((t - 0.7) / 0.4, 0, 1);
            if (ks > 0) G.pill(ctx, g.sub, x, y + s * (g.subY || 1.05), s * 0.22, ks, 1 - out, g.subColor);
        }
    };

    // Плашка-таблетка с текстом
    G.pill = (ctx, text, x, y, px, k, alpha, colors) => {
        colors = colors || ['#ff9a3c', '#f0502c', '#b8321c'];
        ctx.save();
        ctx.globalAlpha = alpha === undefined ? 1 : alpha;
        ctx.font = FONT(px);
        const w = ctx.measureText(text).width + px * 1.4, h = px * 1.55;
        ctx.translate(x, y + (1 - easeOut(k)) * px * 1.2);
        ctx.scale(spring(k), spring(k));
        ctx.rotate(-0.025);
        ctx.fillStyle = colors[2]; roundRect(ctx, -w / 2, -h / 2 + px * 0.14, w, h, h * 0.42); ctx.fill();
        const gr = ctx.createLinearGradient(0, -h / 2, 0, h / 2); gr.addColorStop(0, colors[0]); gr.addColorStop(1, colors[1]);
        ctx.fillStyle = gr; roundRect(ctx, -w / 2, -h / 2, w, h, h * 0.42); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; roundRect(ctx, -w / 2 + h * 0.2, -h / 2 + h * 0.08, w - h * 0.4, h * 0.22, h * 0.11); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowOffsetY = px * 0.06;
        ctx.fillText(text, 0, px * 0.05);
        ctx.restore();
    };
    function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

    // Подзаголовок-таблетка как отдельный элемент
    G.sub = (ctx, g, t, W, H) => {
        const d = g.dur || 1.5, k = clamp(t / 0.4, 0, 1), out = clamp((t - (d - 0.25)) / 0.25, 0, 1);
        G.pill(ctx, g.text, (g.x || 0.5) * W, (g.y || 0.8) * H, M(W, H) * (g.size || 0.05), k, 1 - out, g.colors);
    };

    // ---------- Плашка пойманной рыбы: редкость, имя, вес со счётчиком ----------
    G.tag = (ctx, g, t, W, H) => {
        const d = g.dur || 2, k = clamp(t / 0.45, 0, 1), out = clamp((t - (d - 0.3)) / 0.3, 0, 1);
        const s = M(W, H) * (g.size || 0.13);
        const [col, rname] = RARITY[g.rarity || 'legendary'];
        const x = (g.x || 0.5) * W, y = (g.y || 0.78) * H;
        ctx.font = FONT(s * 0.36);
        const nameW = ctx.measureText(g.name || '').width;
        ctx.font = FONT(s * 0.42);
        const wtW = ctx.measureText('000,0 кг').width + (g.extra ? s * 1.6 : 0);
        const w = s * 2.25 + Math.max(nameW, wtW, s * 1.8), h = s * 1.25;
        ctx.save();
        ctx.globalAlpha = 1 - out;
        ctx.translate(x + (1 - easeOut(k)) * W * 0.6 * (g.from === 'left' ? -1 : 1), y);
        ctx.rotate(-0.03 * spring(k));
        ctx.fillStyle = 'rgba(20,20,50,0.35)'; roundRect(ctx, -w / 2 + s * 0.06, -h / 2 + s * 0.12, w, h, s * 0.3); ctx.fill();
        ctx.fillStyle = '#fffaf0'; roundRect(ctx, -w / 2, -h / 2, w, h, s * 0.3); ctx.fill();
        ctx.fillStyle = col; roundRect(ctx, -w / 2, -h / 2, s * 0.22, h, [s * 0.3, 0, 0, s * 0.3]); ctx.fill();
        // Сияние за рыбой
        const fx = -w / 2 + s * 1.05;
        const gl = ctx.createRadialGradient(fx, 0, 1, fx, 0, s * 0.8);
        gl.addColorStop(0, col + 'aa'); gl.addColorStop(1, col + '00');
        ctx.fillStyle = gl; ctx.fillRect(fx - s, -h / 2, s * 2, h);
        const fish = g.fish && window.FB && FB.fishArt ? FB.fishArt.canvas(g.fish, 240) : null;
        if (fish) {
            const fw = s * 1.5, fh = fw * fish.height / fish.width;
            ctx.save(); ctx.translate(fx, 0); ctx.rotate(Math.sin(t * 4) * 0.06); ctx.scale(spring(clamp((t - 0.15) / 0.5, 0, 1)), spring(clamp((t - 0.15) / 0.5, 0, 1)));
            ctx.drawImage(fish, -fw / 2, -fh / 2, fw, fh); ctx.restore();
        }
        const tx = -w / 2 + s * 1.95;
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        // Редкость
        ctx.font = FONT(s * 0.2);
        const rw = ctx.measureText(rname.toUpperCase()).width + s * 0.3;
        ctx.fillStyle = col; roundRect(ctx, tx, -h / 2 + s * 0.14, rw, s * 0.3, s * 0.15); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.fillText(rname.toUpperCase(), tx + s * 0.15, -h / 2 + s * 0.36);
        // Имя
        ctx.fillStyle = '#1f3550'; ctx.font = FONT(s * 0.36);
        ctx.fillText(g.name || '', tx, s * 0.1);
        // Вес — считает вверх
        const kc = clamp((t - 0.3) / 0.7, 0, 1);
        const val = (g.weight || 0) * easeOut(kc);
        const wtxt = (Number.isInteger(g.weight) ? Math.round(val) : val.toFixed(1).replace('.', ',')) + ' кг';
        ctx.font = FONT(s * 0.42);
        const pop = kc >= 1 ? 1 + 0.15 * Math.max(0, 1 - (t - 1.0) / 0.25) : 1;
        ctx.save(); ctx.translate(tx, s * 0.5); ctx.scale(pop, pop);
        ctx.fillStyle = '#e8402a'; ctx.fillText(wtxt, 0, 0);
        ctx.restore();
        if (g.extra) { ctx.font = FONT(s * 0.42); const ew = ctx.measureText(wtxt).width; ctx.font = FONT(s * 0.24); ctx.fillStyle = '#e8402a'; ctx.fillText(g.extra, tx + ew + s * 0.25, s * 0.46); }
        ctx.restore();
        if (kc >= 1 && t < 1.6) G.burst(ctx, { x: (x - w / 2 + s * 1.05) / W, y: y / H, r: 0.18, n: 14, dur: 0.7, seed: 9 }, t - 1.0, W, H);
    };

    // ---------- Большой счётчик («86 КГ!», «+12 400») ----------
    G.counter = (ctx, g, t, W, H) => {
        const d = g.dur || 1.6, k = clamp(t / (g.count || 0.7), 0, 1), out = clamp((t - (d - 0.25)) / 0.25, 0, 1);
        const v = Math.round((g.value || 0) * easeOut(k));
        const txt = (g.prefix || '') + String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (g.suffix || '');
        const px = fitPx(ctx, (g.prefix || '') + String(g.value || 0) + (g.suffix || ''), M(W, H) * (g.size || 0.18), W * 0.9);
        const pop = k >= 1 ? 1 + 0.25 * Math.max(0, 1 - (t - (g.count || 0.7)) / 0.3) : 0.6 + 0.4 * spring(clamp(t / 0.3, 0, 1));
        ctx.save();
        ctx.globalAlpha = 1 - out;
        ctx.translate((g.x || 0.5) * W, (g.y || 0.45) * H);
        ctx.rotate((g.tilt || -3) * Math.PI / 180);
        ctx.scale(pop * (1 + out * 0.3), pop * (1 + out * 0.3));
        bigText(ctx, txt, 0, px * 0.35, px, g.top || '#ffffff', g.bot || '#ffe27a', g.stroke || '#3a1e48');
        ctx.restore();
        if (k >= 1) G.burst(ctx, { x: g.x || 0.5, y: g.y || 0.45, r: 0.3, n: 20, dur: 0.8, seed: 13 }, t - (g.count || 0.7), W, H);
    };

    // ---------- Облачко байки (печатается по буквам) ----------
    G.bubble = (ctx, g, t, W, H) => {
        const d = g.dur || 2, out = clamp((t - (d - 0.2)) / 0.2, 0, 1);
        let px = M(W, H) * (g.size || 0.055);
        const shown = Math.floor(clamp(t / (g.typing || 0.9), 0, 1) * g.text.length + 0.001);
        const text = g.text.slice(0, Math.max(1, shown));
        ctx.font = FONT(px);
        let full = ctx.measureText(g.text).width;
        if (full + px * 1.4 > W * 0.9) { px *= W * 0.9 / (full + px * 1.4); ctx.font = FONT(px); full = ctx.measureText(g.text).width; }
        const w = full + px * 1.4, h = px * 1.75;
        const k = clamp(t / 0.35, 0, 1);
        const x = g.x * W, y = g.y * H;      // точка хвостика (у головы)
        ctx.save();
        ctx.globalAlpha = 1 - out;
        ctx.translate(x, y);
        const sc = spring(k) * (g.grow ? 1 + g.grow * easeOut(clamp((t - (g.growAt || 0.8)) / 0.3, 0, 1)) : 1);
        ctx.scale(sc, sc);
        // Облачко не выходит за кадр; хвостик остаётся у головы
        const bx = clamp(-w * 0.2, W * 0.04 - x, W * 0.96 - x - w), by = -h - px * 0.8;
        const t1 = clamp(-px * 0.2, bx + w * 0.08, bx + w * 0.92 - px * 1.1);
        ctx.fillStyle = 'rgba(30,20,60,0.3)'; roundRect(ctx, bx + px * 0.08, by + px * 0.14, w, h, h * 0.45); ctx.fill();
        ctx.fillStyle = '#ffffff'; roundRect(ctx, bx, by, w, h, h * 0.45); ctx.fill();
        ctx.beginPath(); ctx.moveTo(t1, by + h - 2); ctx.lineTo(0, 0); ctx.lineTo(t1 + px * 1.1, by + h - 2); ctx.closePath(); ctx.fill();
        ctx.fillStyle = g.color || '#1f3550'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(text, bx + px * 0.7, by + h * 0.53);
        ctx.restore();
    };

    // ---------- Рулетка «ВОТ ТАКОГО!» (шуточная мерка рыбьей байки) ----------
    G.ruler = (ctx, g, t, W, H) => {
        const d = g.dur || 1.6, out = clamp((t - (d - 0.25)) / 0.25, 0, 1);
        const k = spring(clamp(t / 0.6, 0, 1));
        const y = (g.y || 0.62) * H, cx = (g.x || 0.5) * W, full = W * (g.w || 0.8), len = full * k;
        const th = M(W, H) * 0.06;
        ctx.save();
        ctx.globalAlpha = 1 - out;
        ctx.translate(cx, y); ctx.rotate(-0.04);
        // Корпус рулетки слева
        ctx.fillStyle = '#e8402a'; roundRect(ctx, -full / 2 - th * 1.6, -th * 1.1, th * 1.9, th * 2.2, th * 0.5); ctx.fill();
        ctx.fillStyle = '#b8321c'; ctx.beginPath(); ctx.arc(-full / 2 - th * 0.65, 0, th * 0.55, 0, TAU); ctx.fill();
        // Лента
        ctx.fillStyle = '#ffd23a'; ctx.fillRect(-full / 2, -th / 2, len, th);
        ctx.strokeStyle = '#3a2a10'; ctx.lineWidth = Math.max(1, th * 0.06);
        for (let i = 0; i * th * 0.5 < len; i++) {
            const lx = -full / 2 + i * th * 0.5, big = i % 4 === 0;
            ctx.beginPath(); ctx.moveTo(lx, -th / 2); ctx.lineTo(lx, -th / 2 + th * (big ? 0.55 : 0.28)); ctx.stroke();
        }
        ctx.strokeStyle = '#8a6a10'; ctx.lineWidth = th * 0.08; ctx.strokeRect(-full / 2, -th / 2, len, th);
        // Надпись
        if (t > 0.45) {
            const kt = spring(clamp((t - 0.45) / 0.4, 0, 1));
            ctx.save(); ctx.translate(0, -th * 1.6); ctx.scale(kt, kt); ctx.rotate(0.03);
            bigText(ctx, g.text || '3 МЕТРА!', 0, 0, M(W, H) * (g.size || 0.12), '#ffffff', '#ffd84a', '#3a1e48');
            ctx.restore();
        }
        ctx.restore();
    };

    // ---------- Сетка рыб: коллекция появляется одна за другой ----------
    G.fishgrid = (ctx, g, t, W, H) => {
        const ids = g.ids || [], cols = g.cols || 6, rows = Math.ceil(ids.length / cols);
        const d = g.dur || 2.2, out = clamp((t - (d - 0.3)) / 0.3, 0, 1);
        const cw = W * (g.w || 0.8) / cols, ch = cw * 0.82;
        const x0 = W / 2 - cw * cols / 2, y0 = (g.y || 0.5) * H - ch * rows / 2;
        // Подложка
        ctx.save();
        ctx.globalAlpha = clamp(t / 0.25, 0, 1) * (1 - out);
        ctx.fillStyle = 'rgba(12,30,70,0.55)';
        roundRect(ctx, x0 - cw * 0.25, y0 - ch * 0.3, cw * cols + cw * 0.5, ch * rows + ch * 0.6, cw * 0.25); ctx.fill();
        ids.forEach((id, i) => {
            const k = clamp((t - 0.1 - i * (g.stagger || 0.045)) / 0.35, 0, 1);
            if (k <= 0) return;
            const cx = x0 + (i % cols + 0.5) * cw, cy = y0 + (Math.floor(i / cols) + 0.5) * ch;
            const known = !g.unknown || !g.unknown.includes(id);
            const f = FB.fishById[id];
            ctx.save(); ctx.translate(cx, cy); ctx.scale(spring(k), spring(k));
            ctx.fillStyle = known && f ? (RARITY[f.r] || RARITY.common)[0] + '55' : 'rgba(255,255,255,0.12)';
            roundRect(ctx, -cw * 0.44, -ch * 0.42, cw * 0.88, ch * 0.84, cw * 0.18); ctx.fill();
            const img = FB.fishArt.canvas(id, 160, known ? null : { silhouette: true });
            const iw = cw * 0.8, ih = iw * img.height / img.width;
            ctx.drawImage(img, -iw / 2, -ih / 2, iw, ih);
            ctx.restore();
        });
        ctx.restore();
        if (g.title) {
            const kt = clamp((t - 0.2) / 0.4, 0, 1);
            ctx.save(); ctx.globalAlpha = 1 - out;
            ctx.translate(W / 2, y0 - ch * 0.62); ctx.scale(spring(kt), spring(kt));
            bigText(ctx, g.title, 0, 0, M(W, H) * (g.titleSize || 0.1), '#ffffff', '#9fe0ff', '#0d3a62');
            ctx.restore();
        }
    };

    // ---------- Подсказки «ДЕРЖИ!» / «ОТПУСТИ!» по пальцу ----------
    G.prompt = (ctx, g, t, W, H) => {
        const px = M(W, H) * (g.size || 0.1), k = clamp(t / 0.22, 0, 1), d = g.dur || 0.5;
        const out = clamp((t - (d - 0.15)) / 0.15, 0, 1);
        const hold = g.hold;
        ctx.save();
        ctx.globalAlpha = 1 - out;
        ctx.translate((g.x || 0.5) * W, (g.y || 0.3) * H);
        const s = spring(k) * (1 + 0.05 * Math.sin(t * 18));
        ctx.scale(s, s);
        ctx.rotate(hold ? -0.05 : 0.05);
        bigText(ctx, hold ? 'ДЕРЖИ!' : 'ОТПУСТИ!', 0, px * 0.35, px, '#ffffff', hold ? '#8ee26a' : '#ff8a6a', hold ? '#1d5a22' : '#7a1e14');
        ctx.restore();
    };

    // ---------- Палец / курсор игрока ----------
    G.finger = (ctx, x, y, down, alpha, scale, touch) => {
        if (alpha <= 0) return;
        ctx.save();
        ctx.globalAlpha = alpha;
        if (touch) {
            const r = 34 * scale * (down ? 0.82 : 1);
            ctx.fillStyle = down ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.38)';
            ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 14 * scale; ctx.shadowOffsetY = 4 * scale;
            ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
            ctx.shadowColor = 'transparent';
            ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 4 * scale;
            ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
        } else {
            const s = scale * (down ? 0.88 : 1) * 1.35;
            ctx.translate(x, y); ctx.scale(s, s); ctx.translate(-3, -3);
            ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 3;
            const p = new Path2D('M3 3 L3 31 L10 24.5 L15.2 36 L20.4 33.6 L15.4 22.6 L25 22.6 Z');
            ctx.fillStyle = '#fff'; ctx.fill(p);
            ctx.shadowColor = 'transparent';
            ctx.strokeStyle = '#1d2433'; ctx.lineWidth = 2.4; ctx.lineJoin = 'round'; ctx.stroke(p);
        }
        ctx.restore();
    };
    G.ring = (ctx, x, y, k, scale) => {
        if (k <= 0 || k >= 1) return;
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,' + (1 - k) + ')';
        ctx.lineWidth = 5 * scale * (1 - k * 0.5);
        ctx.shadowColor = 'rgba(255,255,255,0.7)'; ctx.shadowBlur = 10 * scale;
        ctx.beginPath(); ctx.arc(x, y, 14 * scale + easeOut(k) * 70 * scale, 0, TAU); ctx.stroke();
        ctx.restore();
    };

    // ---------- Финал: логотип, кнопка «Играть бесплатно!», палец жмёт ----------
    G.cta = (ctx, g, t, W, H) => {
        const m = M(W, H);
        // Рыбки плавают вокруг
        const ids = g.fish || ['goldcarp', 'tuna', 'spirit', 'swordfish', 'pike', 'mola'];
        ids.forEach((id, i) => {
            const k = clamp((t - 0.3 - i * 0.07) / 0.5, 0, 1);
            if (k <= 0) return;
            const a = i / ids.length * TAU + t * 0.5, rx = W * 0.42, ry = H * 0.4;
            const img = FB.fishArt.canvas(id, 160);
            const fw = m * 0.14 * spring(k), fh = fw * img.height / img.width;
            ctx.save(); ctx.translate(W / 2 + Math.cos(a) * rx, H * 0.47 + Math.sin(a) * ry); ctx.rotate(Math.cos(a) * 0.3);
            if (Math.sin(a) > 0) ctx.scale(-1, 1);
            ctx.globalAlpha = 0.95; ctx.drawImage(img, -fw / 2, -fh / 2, fw, fh); ctx.restore();
        });
        G.logo(ctx, { x: 0.5, y: g.logoY || 0.36, size: g.logoSize || 0.19, keep: true, top: g.top, big: g.big }, t, W, H);
        // Кнопка
        const kb = clamp((t - 0.55) / 0.45, 0, 1);
        if (kb > 0) {
            const text = g.text || 'ИГРАТЬ БЕСПЛАТНО';
            let px = m * (g.btnSize || 0.075);
            ctx.font = FONT(px);
            if (ctx.measureText(text).width + px * 2.2 > W * 0.9) { px *= W * 0.9 / (ctx.measureText(text).width + px * 2.2); ctx.font = FONT(px); }
            const w = ctx.measureText(text).width + px * 2.2, h = px * 2;
            const bx = W / 2, by = H * (g.btnY || 0.72);
            const pulse = 1 + 0.045 * Math.sin((t - 0.55) * Math.PI * 2.2);
            const press = g.tapEvery ? Math.max(0, 1 - Math.abs(((t - 1.4) % g.tapEvery) - 0.1) / 0.1) : 0;
            ctx.save(); ctx.translate(bx, by); ctx.scale(spring(kb) * pulse * (1 - press * 0.06), spring(kb) * pulse * (1 - press * 0.06));
            ctx.fillStyle = '#26803a'; roundRect(ctx, -w / 2, -h / 2 + px * 0.2, w, h, h * 0.42); ctx.fill();
            const gr = ctx.createLinearGradient(0, -h / 2, 0, h / 2); gr.addColorStop(0, '#9bea74'); gr.addColorStop(1, '#3fae46');
            ctx.fillStyle = gr; roundRect(ctx, -w / 2, -h / 2, w, h, h * 0.42); ctx.fill();
            // Блик бежит по кнопке
            ctx.save(); ctx.clip();
            const sx = -w / 2 + ((t * 0.8) % 1.6) * w;
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            ctx.beginPath(); ctx.moveTo(sx, -h); ctx.lineTo(sx + h * 0.5, -h); ctx.lineTo(sx - h * 0.3, h); ctx.lineTo(sx - h * 0.8, h); ctx.fill();
            ctx.restore();
            ctx.fillStyle = 'rgba(255,255,255,0.3)'; roundRect(ctx, -w / 2 + h * 0.25, -h / 2 + h * 0.1, w - h * 0.5, h * 0.22, h * 0.11); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(20,70,20,0.6)'; ctx.shadowOffsetY = px * 0.08;
            ctx.fillText(text, 0, px * 0.06);
            ctx.restore();
            // Палец жмёт на кнопку
            if (g.tapEvery && t > 1.2) {
                const lt = (t - 1.4) % g.tapEvery;
                const fx = bx + w * 0.44, fy = by + h * 0.5;
                G.finger(ctx, fx + Math.max(0, 0.3 - lt) * m * 0.3, fy + Math.max(0, 0.3 - lt) * m * 0.2, lt < 0.22 && lt > 0.05, 1, m / 1080 * 1.4, true);
                G.ring(ctx, fx, fy, (lt - 0.05) / 0.5, m / 1080 * 1.4);
            }
        }
        if (g.sub) {
            const ks = clamp((t - 0.9) / 0.4, 0, 1);
            if (ks > 0) {
                ctx.save(); ctx.globalAlpha = ks;
                ctx.font = FONT(m * 0.045); ctx.textAlign = 'center'; ctx.fillStyle = '#fff6d0';
                ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = m * 0.02;
                ctx.fillText(g.sub, W / 2, H * (g.subY || 0.84));
                ctx.restore();
            }
        }
    };

    // Всплывающий текст (+монеты, «Клюёт!»)
    G.pop = (ctx, g, t, W, H) => {
        const d = g.dur || 1, k = clamp(t / d, 0, 1);
        const px = fitPx(ctx, g.text, M(W, H) * (g.size || 0.07), W * 0.9);
        ctx.save();
        ctx.globalAlpha = 1 - easeIn(k);
        ctx.translate(g.x * W, g.y * H - easeOut(k) * px * 0.5);
        const s = spring(clamp(t / 0.3, 0, 1));
        ctx.scale(s, s); ctx.rotate((g.tilt || 0) * Math.PI / 180);
        bigText(ctx, g.text, 0, 0, px, g.top || '#ffffff', g.bot || '#ffe27a', g.stroke || '#3a1e48');
        ctx.restore();
    };
})();
