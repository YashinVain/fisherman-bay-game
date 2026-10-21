// rodart.js — красивые картинки удочек для магазина: пробковая рукоять,
// катушка, кольца с цветной обмоткой, сужающееся удилище с бликом.
// У каждой удочки свой вид (rod.look): бамбук с коленцами, карбон с
// плетением, морская толстая, ледяная с кристаллами, звёздная со звёздами.

(function (FB) {
    const RA = FB.rodArt = {};
    const U = FB.U;
    const OUT = '#2a3550';

    // Точка и направление на изогнутом удилище: t от 0 (низ рукояти) до 1 (кончик)
    function curve(W, H, bend) {
        const x0 = W * 0.08, y0 = H * 0.86, x2 = W * 0.95, y2 = H * 0.14;
        const cx = W * 0.62, cy = H * (0.62 - bend);
        return (t) => {
            const m = 1 - t;
            const x = m * m * x0 + 2 * m * t * cx + t * t * x2;
            const y = m * m * y0 + 2 * m * t * cy + t * t * y2;
            const dx = 2 * m * (cx - x0) + 2 * t * (x2 - cx), dy = 2 * m * (cy - y0) + 2 * t * (y2 - cy);
            const l = Math.hypot(dx, dy) || 1;
            return { x, y, tx: dx / l, ty: dy / l, nx: -dy / l, ny: dx / l };
        };
    }

    // Сужающаяся полоса вдоль кривой от t0 до t1, ширина w0 → w1
    function band(ctx, P, t0, t1, w0, w1, fill, stroke) {
        const N = 28, left = [], right = [];
        for (let i = 0; i <= N; i++) {
            const t = U.lerp(t0, t1, i / N), p = P(t), w = U.lerp(w0, w1, i / N) / 2;
            left.push([p.x + p.nx * w, p.y + p.ny * w]);
            right.push([p.x - p.nx * w, p.y - p.ny * w]);
        }
        ctx.beginPath();
        left.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
        for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
        ctx.closePath();
        ctx.fillStyle = fill; ctx.fill();
        if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = Math.max(1, w0 * 0.12); ctx.lineJoin = 'round'; ctx.stroke(); }
    }

    RA.draw = (ctx, rod, W, H) => {
        const L = rod.look || {};
        const S = Math.min(W, H);
        const P = curve(W, H, L.bend || 0.06);
        ctx.save();
        ctx.lineCap = 'round';
        // Тень на «столе»
        ctx.fillStyle = 'rgba(30,40,70,0.12)';
        ctx.beginPath(); ctx.ellipse(W * 0.52, H * 0.9, W * 0.42, H * 0.05, -0.05, 0, Math.PI * 2); ctx.fill();

        const thick = (L.thick || 1) * S;
        // Удилище: от рукояти до кончика сужается
        const blank = rod.color;
        band(ctx, P, 0.2, 1, thick * 0.085, thick * 0.018, blank, OUT);
        // Блик по удилищу
        ctx.save();
        ctx.globalAlpha = 0.45;
        band(ctx, (t) => { const p = P(t); return Object.assign({}, p, { x: p.x + p.nx * thick * 0.014, y: p.y + p.ny * thick * 0.014 }); }, 0.22, 0.97, thick * 0.025, thick * 0.005, '#ffffff');
        ctx.restore();
        // Узор удилища
        if (L.style === 'bamboo') {
            ctx.strokeStyle = U.shade(blank, -0.4); ctx.lineWidth = Math.max(1, S * 0.012);
            [0.34, 0.48, 0.62, 0.75, 0.87].forEach(t => {
                const p = P(t), w = U.lerp(thick * 0.085, thick * 0.018, (t - 0.2) / 0.8) * 0.62;
                ctx.beginPath(); ctx.moveTo(p.x + p.nx * w, p.y + p.ny * w); ctx.lineTo(p.x - p.nx * w, p.y - p.ny * w); ctx.stroke();
            });
        } else if (L.style === 'carbon') {
            ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1;
            for (let t = 0.24; t < 0.95; t += 0.025) {
                const p = P(t), w = U.lerp(thick * 0.085, thick * 0.018, (t - 0.2) / 0.8) * 0.45;
                ctx.beginPath(); ctx.moveTo(p.x + p.nx * w - p.tx * w, p.y + p.ny * w - p.ty * w); ctx.lineTo(p.x - p.nx * w + p.tx * w, p.y - p.ny * w + p.ty * w); ctx.stroke();
            }
        }
        // Кольца с обмоткой
        const guides = [0.36, 0.5, 0.62, 0.72, 0.8, 0.87, 0.93];
        guides.forEach((t, i) => {
            const p = P(t), r = S * U.lerp(0.045, 0.016, i / guides.length), w = U.lerp(thick * 0.085, thick * 0.018, (t - 0.2) / 0.8);
            // Обмотка — цветная полоска поперёк удилища
            ctx.strokeStyle = L.wrap || '#e8402a';
            ctx.lineWidth = Math.max(1.5, S * 0.018);
            ctx.beginPath(); ctx.moveTo(p.x + p.nx * w * 0.6, p.y + p.ny * w * 0.6); ctx.lineTo(p.x - p.nx * w * 0.6, p.y - p.ny * w * 0.6); ctx.stroke();
            // Ножка и кольцо (снизу удилища)
            const gx = p.x - p.nx * (w * 0.5 + r * 1.6), gy = p.y - p.ny * (w * 0.5 + r * 1.6);
            ctx.strokeStyle = '#8a96a2'; ctx.lineWidth = Math.max(1, S * 0.008);
            ctx.beginPath(); ctx.moveTo(p.x - p.nx * w * 0.4, p.y - p.ny * w * 0.4); ctx.lineTo(gx, gy); ctx.stroke();
            ctx.strokeStyle = L.ring || '#c8d0d8'; ctx.lineWidth = Math.max(1.2, S * 0.012);
            ctx.beginPath(); ctx.arc(gx, gy, r, 0, Math.PI * 2); ctx.stroke();
        });
        // Тюльпан на кончике
        const tip = P(1);
        ctx.fillStyle = L.wrap || '#e8402a';
        ctx.beginPath(); ctx.arc(tip.x, tip.y, Math.max(1.5, S * 0.014), 0, Math.PI * 2); ctx.fill();

        // Рукоять: пробка с крапинками, пятка из резины
        band(ctx, P, 0, 0.2, thick * 0.11, thick * 0.1, L.handle || '#d2a46a', OUT);
        const rs = U.seeded(rod.id.length * 31 + 7);
        ctx.fillStyle = 'rgba(110,70,30,0.35)';
        for (let i = 0; i < 26; i++) {
            const p = P(0.02 + rs() * 0.17), o = (rs() - 0.5) * thick * 0.08;
            ctx.beginPath(); ctx.arc(p.x + p.nx * o, p.y + p.ny * o, Math.max(0.6, S * 0.004), 0, Math.PI * 2); ctx.fill();
        }
        band(ctx, P, 0, 0.03, thick * 0.115, thick * 0.115, '#3a3a44', OUT);
        // Катушкодержатель
        band(ctx, P, 0.2, 0.27, thick * 0.095, thick * 0.09, L.seat || '#9aa6b2', OUT);
        // Катушка под удилищем
        const sp = P(0.235), w0 = thick * 0.095;
        const bx = sp.x - sp.nx * (w0 * 0.5 + S * 0.11), by = sp.y - sp.ny * (w0 * 0.5 + S * 0.11);
        ctx.strokeStyle = '#5a6470'; ctx.lineWidth = Math.max(2, S * 0.022);
        ctx.beginPath(); ctx.moveTo(sp.x - sp.nx * w0 * 0.4, sp.y - sp.ny * w0 * 0.4); ctx.lineTo(bx, by); ctx.stroke();
        const R = S * 0.085;
        const rg = ctx.createRadialGradient(bx - R * 0.3, by - R * 0.3, R * 0.1, bx, by, R);
        rg.addColorStop(0, '#f2f6fa'); rg.addColorStop(1, L.reel || '#6a7684');
        ctx.fillStyle = rg; ctx.strokeStyle = OUT; ctx.lineWidth = Math.max(1.2, S * 0.012);
        ctx.beginPath(); ctx.arc(bx, by, R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = L.wrap || '#e8402a';
        ctx.beginPath(); ctx.arc(bx, by, R * 0.45, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(bx, by, R * 0.16, 0, Math.PI * 2); ctx.fill();
        // Ручка катушки
        ctx.strokeStyle = '#3a4048'; ctx.lineWidth = Math.max(1.5, S * 0.016);
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - R * 1.3, by + R * 0.4); ctx.stroke();
        ctx.fillStyle = '#e8eef4'; ctx.strokeStyle = OUT; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(bx - R * 1.35, by + R * 0.42, R * 0.28, R * 0.18, 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        // Леска от катушки к кончику
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(bx, by - R * 0.4);
        guides.forEach(t => { const p = P(t); ctx.lineTo(p.x - p.nx * S * 0.02, p.y - p.ny * S * 0.02); });
        ctx.lineTo(tip.x, tip.y); ctx.stroke();

        // Особые украшения
        if (L.style === 'star' || L.style === 'ice') {
            const col = L.style === 'star' ? '#fff3a8' : '#e8fbff';
            [0.45, 0.68, 0.9].forEach((t, i) => {
                const p = P(t), r = S * (0.035 - i * 0.006);
                const x = p.x + p.nx * S * 0.07, y = p.y + p.ny * S * 0.07;
                ctx.fillStyle = col; ctx.strokeStyle = OUT; ctx.lineWidth = 1;
                ctx.beginPath();
                for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, rr = k % 2 ? r * 0.35 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
                ctx.closePath(); ctx.fill(); ctx.stroke();
            });
        }
        ctx.restore();
    };

    // Готовый холст для карточки (кэш по id и размеру)
    const cache = {};
    RA.canvas = (rod, w, h) => {
        const key = rod.id + w + 'x' + h;
        if (cache[key]) return cache[key];
        const c = document.createElement('canvas');
        const d = 2;
        c.width = w * d; c.height = h * d;
        const ctx = c.getContext('2d');
        ctx.scale(d, d);
        RA.draw(ctx, rod, w, h);
        return (cache[key] = c);
    };
})(window.FB);
