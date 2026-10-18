// sonar.js — эхолот на лодке. Показывает рыб под водой и того, кто подплывает
// к наживке, ещё до поклёвки. Увидел мусор или мелочь — можно смотать удочку
// и забросить снова. Чем лучше лодка, тем больше видит эхолот:
//   • плот  — крупная рыба или мелочь (и мусор);
//   • лодка — редкость рыбы (цветом и словом);
//   • яхта  — редкость и примерный вес.
// С мостков эхолота нет. На очки турнира эхолот не влияет — только подсказывает.

(function (FB) {
    const SN = FB.sonar = {};
    const U = FB.U;

    SN.LEVEL = { raft: 1, boat: 2, yacht: 3 };
    SN.level = () => SN.LEVEL[FB.person.boatType()] || 0;
    SN.has = () => SN.level() > 0;
    SN.REVEAL = 0.35;      // с какой доли ожидания эхолот «узнаёт» рыбу

    let el, cv, label, last = '', revealed = false, sweep = 0, cast = null;
    const blips = [];
    for (let i = 0; i < 5; i++) blips.push({ a: Math.random() * 6.28, r: 0.3 + Math.random() * 0.6, v: (Math.random() - 0.5) * 0.15, s: 0.6 + Math.random() * 0.8 });

    SN.mount = (root) => {
        el = FB.ui.el('div.sonar.hidden');
        cv = document.createElement('canvas');
        label = FB.ui.el('div.sn-label');
        el.append(cv, label);
        root.appendChild(el);
        FB.on('cast', () => { revealed = false; cast = { a: Math.random() * 6.28 }; });
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

    SN.frame = (dt) => {
        if (!el) return;
        const F = FB.fishing, lv = SN.level();
        const show = lv > 0 && ['idle', 'cast', 'wait', 'bite', 'lost'].includes(F.phase) && !FB.ui.isOpen();
        el.classList.toggle('hidden', !show);
        if (!show) return;
        sweep = (sweep + dt * 2.4) % (Math.PI * 2);
        const k = F.phase === 'wait' ? F.waitK() : F.phase === 'bite' ? 1 : 0;
        const info = (F.phase === 'wait' || F.phase === 'bite') && F.res ? SN.read(F.res, lv) : null;
        const known = info && k >= SN.REVEAL;
        if (known && !revealed) { revealed = true; FB.audio.play('sonar', info.order); }
        let text = FB.t('sn_title'), color = '';
        if (F.phase === 'cast' || (F.phase === 'wait' && !known)) text = FB.t('sn_search');
        else if (known) { text = info.text; color = info.color; }
        const html = text + '|' + color;
        if (html !== last) {
            last = html;
            label.textContent = text;
            // Узнал рыбу — плашка её цвета, текст тёмный или белый, чтобы читалось
            label.style.background = color || '';
            label.style.color = color ? (lum(color) > 0.6 ? '#1f3550' : '#ffffff') : '';
            label.classList.toggle('hot', !!(known && info.order >= 2));
        }
        draw(k, known ? info : null, F.phase === 'bite');
    };

    const lum = (hex) => { const n = parseInt(hex.slice(1), 16); return ((n >> 16) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) / 255; };

    function draw(k, info, bite) {
        const d = Math.min(2, window.devicePixelRatio || 1), S = 108;
        if (cv.width !== S * d) { cv.width = cv.height = S * d; cv.style.width = cv.style.height = S + 'px'; }
        const ctx = cv.getContext('2d');
        ctx.setTransform(d, 0, 0, d, 0, 0);
        const c = S / 2, R = S / 2 - 4;
        ctx.clearRect(0, 0, S, S);
        // Экран
        const g = ctx.createRadialGradient(c, c * 0.9, 2, c, c, R);
        g.addColorStop(0, '#13584a'); g.addColorStop(1, '#062a24');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(c, c, R, 0, Math.PI * 2); ctx.fill();
        ctx.save();
        ctx.beginPath(); ctx.arc(c, c, R, 0, Math.PI * 2); ctx.clip();
        // Кольца и крестик
        ctx.strokeStyle = 'rgba(140,255,210,0.18)'; ctx.lineWidth = 1;
        [0.33, 0.66].forEach(q => { ctx.beginPath(); ctx.arc(c, c, R * q, 0, Math.PI * 2); ctx.stroke(); });
        ctx.beginPath(); ctx.moveTo(c - R, c); ctx.lineTo(c + R, c); ctx.moveTo(c, c - R); ctx.lineTo(c, c + R); ctx.stroke();
        // Луч
        for (let i = 0; i < 10; i++) {
            ctx.fillStyle = 'rgba(120,255,200,' + (0.16 * (1 - i / 10)) + ')';
            ctx.beginPath(); ctx.moveTo(c, c); ctx.arc(c, c, R, sweep - (i + 1) * 0.08, sweep - i * 0.08); ctx.closePath(); ctx.fill();
        }
        ctx.strokeStyle = 'rgba(170,255,220,0.8)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(c, c); ctx.lineTo(c + Math.cos(sweep) * R, c + Math.sin(sweep) * R); ctx.stroke();
        // Рыбки вокруг — вспыхивают, когда по ним проходит луч
        const lit = (a) => { const dd = ((sweep - a) % 6.283 + 6.283) % 6.283; return Math.max(0.15, 1 - dd / 2.6); };
        blips.forEach(b => {
            b.a += b.v * 0.016;
            const x = c + Math.cos(b.a) * R * b.r, y = c + Math.sin(b.a) * R * b.r;
            ctx.fillStyle = 'rgba(140,255,200,' + (0.85 * lit(b.a)) + ')';
            ctx.beginPath(); ctx.ellipse(x, y, 2.4 * b.s, 1.4 * b.s, b.a, 0, Math.PI * 2); ctx.fill();
        });
        // Наживка — в центре
        ctx.fillStyle = bite ? '#ffffff' : 'rgba(255,255,255,0.8)';
        ctx.beginPath(); ctx.arc(c, c, bite ? 3.5 + Math.sin(performance.now() / 60) : 2.5, 0, Math.PI * 2); ctx.fill();
        // Тот, кто подплывает к наживке
        if (cast && k > 0) {
            const r = U.lerp(0.9, 0.12, U.smooth(Math.min(1, k)));
            const x = c + Math.cos(cast.a) * R * r, y = c + Math.sin(cast.a) * R * r;
            const col = info ? info.color : '#c8ffe8';
            const size = info ? (info.junk ? 4 : 4 + Math.max(0, info.order) * 1.3) : 4;
            ctx.save();
            ctx.shadowColor = col; ctx.shadowBlur = info && info.order >= 2 ? 10 : 4;
            ctx.fillStyle = col;
            if (info && info.junk) { ctx.fillRect(x - size, y - size * 0.7, size * 2, size * 1.4); }
            else { ctx.beginPath(); ctx.ellipse(x, y, size * 1.4, size * 0.8, cast.a + Math.PI, 0, Math.PI * 2); ctx.fill(); }
            ctx.restore();
            if (!info) {
                ctx.fillStyle = '#0a3a30'; ctx.font = '900 8px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText('?', x, y + 0.5);
            }
        }
        ctx.restore();
        // Ободок
        ctx.strokeStyle = '#2a3550'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(c, c, R + 1, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(c, c, R - 1, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();
    }
})(window.FB);
