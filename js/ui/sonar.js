// sonar.js — эхолот на лодке. Показывает рыб под водой и того, кто подплывает
// к наживке, ещё до поклёвки. Увидел мусор или мелочь — можно смотать удочку
// и забросить снова. Чем лучше лодка, тем больше видит эхолот:
//   • плот  — крупная рыба или мелочь (и мусор);
//   • лодка — редкость рыбы (цветом и словом);
//   • яхта  — редкость и примерный вес.
// С мостков эхолота нет. На очки турнира эхолот не влияет — только подсказывает.
//
// Всё движется плавно: экран появляется и прячется мягко, рыбки плывут по
// дугам с хвостиками, «гостья» подплывает к наживке по спирали.

(function (FB) {
    const SN = FB.sonar = {};
    const U = FB.U;

    SN.LEVEL = { raft: 1, boat: 2, yacht: 3 };
    SN.level = () => SN.LEVEL[FB.person.boatType()] || 0;
    SN.has = () => SN.level() > 0;
    SN.REVEAL = 0.35;      // с какой доли ожидания эхолот «узнаёт» рыбу

    let el, cv, label, last = '', revealed = false, sweep = 0, cast = null, shownK = 0, glow = 0, t = 0;
    const blips = [];
    for (let i = 0; i < 6; i++) blips.push({ a: Math.random() * 6.28, r: 0.35 + Math.random() * 0.5, v: (Math.random() < 0.5 ? -1 : 1) * (0.12 + Math.random() * 0.15), s: 0.7 + Math.random() * 0.7, ph: Math.random() * 6 });

    SN.mount = (root) => {
        el = FB.ui.el('div.sonar.off');
        cv = document.createElement('canvas');
        label = FB.ui.el('div.sn-label');
        el.append(cv, label);
        root.appendChild(el);
        FB.on('cast', () => { revealed = false; shownK = 0; cast = { a: Math.random() * 6.28 }; });
    };

    // Что эхолот говорит о рыбе на крючке (по уровню лодки)
    SN.read = (res, level) => {
        if (!res) return null;
        if (res.kind === 'junk') return { text: FB.t('sn_junk'), color: '#a8b4bc', junk: true, order: -1 };
        const f = res.fish, order = FB.RARITY[f.r].order;
        if (level <= 1) {
            const big = FB.catcher.strength(f, res.g) > 0.42;
            return { text: FB.t(big ? 'sn_big' : 'sn_small'), color: big ? '#ffd23a' : '#9ae8a8', order: big ? 2 : 0 };
        }
        const text = FB.t('r_' + f.r) + (order >= 2 ? '!' : '') + (level >= 3 ? ' · ~' + U.weight(Math.round(res.g / 50) * 50) : '');
        return { text, color: FB.RARITY[f.r].color, order };
    };

    const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return ((n >> 16) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) / 255; };

    SN.frame = (dt) => {
        if (!el) return;
        const F = FB.fishing, lv = SN.level();
        const show = lv > 0 && ['idle', 'cast', 'wait', 'bite', 'lost'].includes(F.phase) && !FB.ui.isOpen();
        el.classList.toggle('off', !show);
        if (!show) return;
        t += dt;
        sweep = (sweep + dt * 2.2) % (Math.PI * 2);
        // Доля ожидания — сглаженная, чтобы точка не прыгала (на спиннинге она растёт рывками)
        const k = F.phase === 'wait' ? F.waitK() : F.phase === 'bite' ? 1 : 0;
        shownK += (k - shownK) * (1 - Math.exp(-dt * 3));
        const info = (F.phase === 'wait' || F.phase === 'bite') && F.res ? SN.read(F.res, lv) : null;
        const known = info && k >= SN.REVEAL;
        if (known && !revealed) { revealed = true; glow = 1; FB.audio.play('sonar', info.order); }
        glow = Math.max(0, glow - dt * 0.8);
        let text = FB.t('sn_title'), color = '';
        if (F.phase === 'cast' || (F.phase === 'wait' && !known)) text = FB.t('sn_search');
        else if (known) { text = info.text; color = info.color; }
        const key = text + '|' + color;
        if (key !== last) {
            last = key;
            label.textContent = text;
            // Узнал рыбу — плашка её цвета, текст тёмный или белый, чтобы читалось
            label.style.background = color || '';
            label.style.color = color ? (lum(color) > 0.6 ? '#1f3550' : '#ffffff') : '';
            label.classList.toggle('hot', !!(known && info.order >= 2));
            label.classList.remove('pop'); void label.offsetWidth; label.classList.add('pop');
        }
        draw(dt, F.phase === 'wait' || F.phase === 'bite' ? shownK : 0, known ? info : null, F.phase === 'bite');
    };

    // Рыбка-отметка: овал с хвостиком, смотрит туда, куда плывёт
    function fishMark(ctx, x, y, ang, s, col, alpha) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(ang);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.ellipse(0, 0, s * 1.5, s * 0.75, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-s * 1.2, 0); ctx.lineTo(-s * 2.2, -s * 0.8); ctx.lineTo(-s * 2.2, s * 0.8); ctx.closePath(); ctx.fill();
        ctx.restore();
    }

    function draw(dt, k, info, bite) {
        const d = Math.min(2, window.devicePixelRatio || 1), S = innerWidth < 640 ? 92 : 116;
        if (cv.width !== S * d) { cv.width = cv.height = S * d; cv.style.width = cv.style.height = S + 'px'; }
        const ctx = cv.getContext('2d');
        ctx.setTransform(d, 0, 0, d, 0, 0);
        const c = S / 2, R = S / 2 - 8;
        ctx.clearRect(0, 0, S, S);
        // Металлический ободок
        const rim = ctx.createLinearGradient(0, 0, S, S);
        rim.addColorStop(0, '#f2f6fa'); rim.addColorStop(0.35, '#a8b8c8'); rim.addColorStop(0.65, '#5a6a7e'); rim.addColorStop(1, '#c8d4e0');
        ctx.fillStyle = rim;
        ctx.beginPath(); ctx.arc(c, c, R + 7, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#2a3550'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(c, c, R + 7, 0, Math.PI * 2); ctx.stroke();
        [0.25, 0.75, 1.25, 1.75].forEach(q => {
            const a = q * Math.PI, x = c + Math.cos(a) * (R + 3.5), y = c + Math.sin(a) * (R + 3.5);
            ctx.fillStyle = '#7a8a9c'; ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill();
        });
        // Экран
        const g = ctx.createRadialGradient(c - R * 0.2, c - R * 0.3, 2, c, c, R);
        g.addColorStop(0, '#1a6a58'); g.addColorStop(0.7, '#0b3a32'); g.addColorStop(1, '#05221d');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(c, c, R, 0, Math.PI * 2); ctx.fill();
        ctx.save();
        ctx.beginPath(); ctx.arc(c, c, R, 0, Math.PI * 2); ctx.clip();
        // Кольца глубины и деления
        ctx.strokeStyle = 'rgba(140,255,210,0.16)'; ctx.lineWidth = 1;
        [0.3, 0.6, 0.9].forEach(q => { ctx.beginPath(); ctx.arc(c, c, R * q, 0, Math.PI * 2); ctx.stroke(); });
        for (let i = 0; i < 24; i++) {
            const a = i / 24 * Math.PI * 2, r0 = R * (i % 6 ? 0.92 : 0.86);
            ctx.beginPath(); ctx.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0); ctx.lineTo(c + Math.cos(a) * R, c + Math.sin(a) * R); ctx.stroke();
        }
        // Луч: мягкий веер (конический градиент, если браузер умеет)
        if (ctx.createConicGradient) {
            const cg = ctx.createConicGradient(sweep - 1.1, c, c);
            cg.addColorStop(0, 'rgba(120,255,200,0)');
            cg.addColorStop(0.175, 'rgba(120,255,200,0.32)');
            cg.addColorStop(0.176, 'rgba(120,255,200,0)');
            cg.addColorStop(1, 'rgba(120,255,200,0)');
            ctx.fillStyle = cg;
            ctx.beginPath(); ctx.arc(c, c, R, 0, Math.PI * 2); ctx.fill();
        } else {
            for (let i = 0; i < 12; i++) {
                ctx.fillStyle = 'rgba(120,255,200,' + (0.14 * (1 - i / 12)) + ')';
                ctx.beginPath(); ctx.moveTo(c, c); ctx.arc(c, c, R, sweep - (i + 1) * 0.09, sweep - i * 0.09); ctx.closePath(); ctx.fill();
            }
        }
        ctx.strokeStyle = 'rgba(190,255,230,0.85)'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(c, c); ctx.lineTo(c + Math.cos(sweep) * R, c + Math.sin(sweep) * R); ctx.stroke();
        // Рыбки вокруг — плывут по дугам и вспыхивают, когда по ним проходит луч
        const lit = (a) => { const dd = ((sweep - a) % 6.283 + 6.283) % 6.283; return Math.max(0.18, 1 - dd / 2.4); };
        blips.forEach(b => {
            b.a += b.v * dt;
            const rr = b.r + Math.sin(t * 0.6 + b.ph) * 0.06;
            const x = c + Math.cos(b.a) * R * rr, y = c + Math.sin(b.a) * R * rr;
            const head = b.a + (b.v > 0 ? Math.PI / 2 : -Math.PI / 2);
            fishMark(ctx, x, y, head, 2 * b.s, '#8cffc8', 0.9 * lit(b.a));
        });
        // Наживка в центре: кольцо, на поклёвке — пульсирует
        const pulse = bite ? (Math.sin(t * 14) + 1) / 2 : 0;
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.5 + pulse * 0.5) + ')'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(c, c, 4 + pulse * 4, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(c, c, 2.2, 0, Math.PI * 2); ctx.fill();
        // Гостья: подплывает к наживке по спирали
        if (cast && k > 0.001) {
            const q = U.smooth(Math.min(1, k));
            const r = U.lerp(0.9, 0.14, q);
            const a = cast.a + q * 1.4;
            const x = c + Math.cos(a) * R * r, y = c + Math.sin(a) * R * r;
            const head = Math.atan2(c - y, c - x);
            const col = info ? info.color : '#d8fff0';
            const size = info ? (info.junk ? 3.6 : 3 + Math.max(0, info.order) * 0.9) : 3;
            if (info && glow > 0) {
                ctx.strokeStyle = U.rgba(col.length === 7 ? col : '#ffffff', glow);
                ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(x, y, size * 2 + (1 - glow) * 16, 0, Math.PI * 2); ctx.stroke();
            }
            ctx.save();
            ctx.shadowColor = col; ctx.shadowBlur = info ? 6 + Math.max(0, info.order) * 3 : 4;
            if (info && info.junk) {
                ctx.fillStyle = col;
                ctx.translate(x, y); ctx.rotate(0.3);
                ctx.fillRect(-size, -size * 0.8, size * 2, size * 1.6);
            } else fishMark(ctx, x, y, head, size, col, 1);
            ctx.restore();
            if (!info) {
                ctx.fillStyle = '#0a3a30'; ctx.font = '900 7px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText('?', x, y + 0.5);
            }
        }
        // Затемнение по краю экрана и стеклянный блик
        const vg = ctx.createRadialGradient(c, c, R * 0.6, c, c, R);
        vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,10,8,0.45)');
        ctx.fillStyle = vg; ctx.fillRect(0, 0, S, S);
        ctx.restore();
        const gl = ctx.createLinearGradient(c - R, c - R, c, c);
        gl.addColorStop(0, 'rgba(255,255,255,0.28)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gl;
        ctx.beginPath(); ctx.ellipse(c - R * 0.25, c - R * 0.45, R * 0.62, R * 0.32, -0.6, 0, Math.PI * 2); ctx.fill();
    }
})(window.FB);
