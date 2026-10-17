// fishart.js — рисование рыб и мусора кодом. Рыба всегда смотрит вправо,
// центр картинки — (0, 0), длина L пикселей.
//
// Готовые картинки кэшируются: FB.fishArt.canvas(id, size) — для сцены,
// FB.fishArt.url(id, size) — для окон (альбом, карточка улова).

(function (FB) {
    const FA = FB.fishArt = {};
    const U = FB.U;

    // Параметры силуэтов. h — высота тела от длины, tail — хвост, dorsal — спинной плавник
    const SHAPES = {
        round:  { h: 0.6,  nose: 0.55, tail: 'fork',  dorsal: 'long',   anal: true },
        goby:   { h: 0.34, nose: 0.85, tail: 'round', dorsal: 'double', head: 1.25, eyeUp: true },
        perch:  { h: 0.42, nose: 0.5,  tail: 'fork',  dorsal: 'spiky',  anal: true },
        oval:   { h: 0.42, nose: 0.5,  tail: 'fork',  dorsal: 'normal', anal: true },
        long:   { h: 0.32, nose: 0.55, tail: 'fork',  dorsal: 'normal', anal: true },
        tall:   { h: 0.68, nose: 0.45, tail: 'fork',  dorsal: 'long',   anal: true },
        slim:   { h: 0.26, nose: 0.45, tail: 'fork',  dorsal: 'small' },
        trout:  { h: 0.3,  nose: 0.55, tail: 'square', dorsal: 'normal', adipose: true, anal: true },
        sail:   { h: 0.3,  nose: 0.5,  tail: 'fork',  dorsal: 'sail',   anal: true },
        cat:    { h: 0.3,  nose: 1.0,  tail: 'round', dorsal: 'small',  whiskers: true, head: 1.3, eyeUp: true, anal: true },
        pike:   { h: 0.22, nose: 0.2,  tail: 'fork',  dorsal: 'back',   snout: 0.12, anal: true },
        shark:  { h: 0.25, nose: 0.25, tail: 'shark', dorsal: 'shark',  snout: 0.06, gills: 3 },
        tuna:   { h: 0.36, nose: 0.3,  tail: 'lunate', dorsal: 'tuna',  finlets: true },
        clown:  { h: 0.48, nose: 0.75, tail: 'round', dorsal: 'soft',   anal: true },
        sword:  { h: 0.24, nose: 0.3,  tail: 'lunate', dorsal: 'shark', bill: 0.45 }
    };

    // Простой генератор по id рыбы — узор у вида всегда одинаковый
    const seedOf = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

    // ---------- Тело обычной рыбы ----------
    function bodyPath(ctx, L, H, p) {
        const nose = L * 0.5, tb = -L * 0.32, th = H * 0.13;
        const ny = H * 0.06;
        const b = p.nose;                      // 1 — тупая морда, 0 — острая
        ctx.beginPath();
        ctx.moveTo(nose, ny);
        ctx.bezierCurveTo(nose - L * 0.02, ny - H * 0.45 * b - H * 0.1, L * 0.22, -H * 0.55 * (p.head || 1), L * 0.02, -H * 0.5);
        ctx.bezierCurveTo(-L * 0.14, -H * 0.46, -L * 0.24, -th * 1.4, tb, -th);
        ctx.lineTo(tb, th);
        ctx.bezierCurveTo(-L * 0.24, th * 1.5, -L * 0.12, H * 0.5, L * 0.04, H * 0.5);
        ctx.bezierCurveTo(L * 0.28, H * 0.5, nose - L * 0.02, ny + H * 0.3 * b + H * 0.05, nose, ny);
        ctx.closePath();
    }

    function tailPath(ctx, L, H, type) {
        const x0 = -L * 0.3;
        ctx.beginPath();
        if (type === 'round') {
            ctx.moveTo(x0, -H * 0.12);
            ctx.bezierCurveTo(-L * 0.5, -H * 0.42, -L * 0.56, H * 0.42, x0, H * 0.12);
        } else if (type === 'square') {
            ctx.moveTo(x0, -H * 0.1);
            ctx.quadraticCurveTo(-L * 0.4, -H * 0.2, -L * 0.48, -H * 0.36);
            ctx.quadraticCurveTo(-L * 0.45, 0, -L * 0.48, H * 0.36);
            ctx.quadraticCurveTo(-L * 0.4, H * 0.2, x0, H * 0.1);
        } else if (type === 'lunate') {
            ctx.moveTo(x0, -H * 0.06);
            ctx.quadraticCurveTo(-L * 0.4, -H * 0.3, -L * 0.48, -H * 0.72);
            ctx.quadraticCurveTo(-L * 0.4, 0, -L * 0.48, H * 0.72);
            ctx.quadraticCurveTo(-L * 0.4, H * 0.3, x0, H * 0.06);
        } else if (type === 'shark') {
            ctx.moveTo(x0, -H * 0.08);
            ctx.quadraticCurveTo(-L * 0.42, -H * 0.4, -L * 0.52, -H * 0.85);
            ctx.quadraticCurveTo(-L * 0.46, -H * 0.1, -L * 0.42, H * 0.06);
            ctx.quadraticCurveTo(-L * 0.42, H * 0.3, -L * 0.46, H * 0.45);
            ctx.quadraticCurveTo(-L * 0.36, H * 0.2, x0, H * 0.08);
        } else {
            // Раздвоенный
            ctx.moveTo(x0, -H * 0.1);
            ctx.quadraticCurveTo(-L * 0.4, -H * 0.22, -L * 0.5, -H * 0.5);
            ctx.quadraticCurveTo(-L * 0.47, -H * 0.1, -L * 0.41, 0);
            ctx.quadraticCurveTo(-L * 0.47, H * 0.1, -L * 0.5, H * 0.5);
            ctx.quadraticCurveTo(-L * 0.4, H * 0.22, x0, H * 0.1);
        }
        ctx.closePath();
    }

    function dorsalPath(ctx, L, H, type) {
        const top = -H * 0.46;
        ctx.beginPath();
        switch (type) {
            case 'spiky': {
                ctx.moveTo(L * 0.16, top);
                const n = 6;
                for (let i = 0; i <= n; i++) {
                    const x = L * 0.16 - i * L * 0.05;
                    ctx.lineTo(x - L * 0.012, top - H * (0.36 - i * 0.03));
                    ctx.lineTo(x - L * 0.025, top - H * 0.08);
                }
                ctx.lineTo(-L * 0.22, -H * 0.3);
                break;
            }
            case 'sail':
                ctx.moveTo(L * 0.18, top);
                ctx.bezierCurveTo(L * 0.1, top - H * 0.9, -L * 0.18, top - H * 0.85, -L * 0.22, -H * 0.3);
                break;
            case 'long':
                ctx.moveTo(L * 0.12, top);
                ctx.quadraticCurveTo(L * 0.02, top - H * 0.42, -L * 0.24, -H * 0.28);
                break;
            case 'double':
                ctx.moveTo(L * 0.1, top + H * 0.02);
                ctx.quadraticCurveTo(L * 0.04, top - H * 0.32, -L * 0.04, top + H * 0.02);
                ctx.moveTo(-L * 0.06, top + H * 0.03);
                ctx.quadraticCurveTo(-L * 0.12, top - H * 0.3, -L * 0.26, -H * 0.2);
                break;
            case 'small':
                ctx.moveTo(L * 0.06, top);
                ctx.quadraticCurveTo(-L * 0.02, top - H * 0.42, -L * 0.1, top + H * 0.04);
                break;
            case 'back':
                ctx.moveTo(-L * 0.12, -H * 0.4);
                ctx.quadraticCurveTo(-L * 0.18, -H * 0.95, -L * 0.28, -H * 0.18);
                break;
            case 'shark':
                ctx.moveTo(L * 0.1, top);
                ctx.quadraticCurveTo(L * 0.02, top - H * 0.8, -L * 0.04, top - H * 0.85);
                ctx.quadraticCurveTo(-L * 0.04, top - H * 0.3, -L * 0.1, top + H * 0.04);
                break;
            case 'tuna':
                ctx.moveTo(L * 0.1, top);
                ctx.quadraticCurveTo(L * 0.04, top - H * 0.55, -L * 0.04, top);
                break;
            case 'soft':
                ctx.moveTo(L * 0.14, top);
                ctx.bezierCurveTo(L * 0.1, top - H * 0.34, -L * 0.16, top - H * 0.34, -L * 0.24, -H * 0.24);
                break;
            default:
                ctx.moveTo(L * 0.12, top);
                ctx.quadraticCurveTo(L * 0.02, top - H * 0.55, -L * 0.1, top + H * 0.02);
        }
        ctx.closePath();
    }

    // Узоры рисуются внутри тела (тело уже задано как область обрезки)
    function pattern(ctx, L, H, a, rnd) {
        if (!a.pat) return;
        ctx.save();
        const c = a.pc;
        switch (a.pat) {
            case 'bars':
                ctx.fillStyle = U.rgba(c, 0.55);
                for (let i = 0; i < 6; i++) {
                    const x = L * 0.2 - i * L * 0.09;
                    ctx.beginPath();
                    ctx.moveTo(x - L * 0.025, -H * 0.6);
                    ctx.quadraticCurveTo(x + L * 0.01, 0, x - L * 0.005, H * 0.2);
                    ctx.lineTo(x - L * 0.03, H * 0.15);
                    ctx.quadraticCurveTo(x - L * 0.04, 0, x - L * 0.06, -H * 0.6);
                    ctx.fill();
                }
                break;
            case 'spots':
                ctx.fillStyle = U.rgba(c, 0.55);
                for (let i = 0; i < 14; i++) {
                    const x = U.lerp(-L * 0.3, L * 0.32, rnd()), y = U.lerp(-H * 0.45, H * 0.1, rnd());
                    ctx.beginPath();
                    ctx.ellipse(x, y, L * U.lerp(0.02, 0.045, rnd()), H * U.lerp(0.05, 0.1, rnd()), rnd() * 3, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;
            case 'dots':
                ctx.fillStyle = U.rgba(c, 0.85);
                for (let i = 0; i < 22; i++) {
                    const x = U.lerp(-L * 0.3, L * 0.3, rnd()), y = U.lerp(-H * 0.42, H * 0.2, rnd());
                    ctx.beginPath();
                    ctx.arc(x, y, Math.max(0.8, L * U.lerp(0.008, 0.016, rnd())), 0, Math.PI * 2);
                    ctx.fill();
                }
                break;
            case 'stripe':
                ctx.fillStyle = U.rgba(c, 0.6);
                ctx.beginPath();
                ctx.moveTo(L * 0.42, -H * 0.02);
                ctx.quadraticCurveTo(0, -H * 0.16, -L * 0.4, -H * 0.02);
                ctx.quadraticCurveTo(0, H * 0.04, L * 0.42, H * 0.06);
                ctx.fill();
                break;
            case 'scales':
                ctx.strokeStyle = U.rgba(c, 0.45);
                ctx.lineWidth = Math.max(0.8, L * 0.006);
                for (let row = -3; row <= 3; row++) {
                    for (let col = -6; col <= 6; col++) {
                        const x = col * L * 0.055 + (row % 2) * L * 0.027, y = row * H * 0.13;
                        ctx.beginPath();
                        ctx.arc(x, y, L * 0.032, -Math.PI * 0.5, Math.PI * 0.5);
                        ctx.stroke();
                    }
                }
                break;
            case 'clown':
                [L * 0.24, L * 0.0, -L * 0.24].forEach((x, i) => {
                    const w = L * (i === 1 ? 0.07 : 0.055);
                    ctx.fillStyle = '#1e1e24';
                    ctx.fillRect(x - w / 2 - L * 0.014, -H, w + L * 0.028, H * 2);
                    ctx.fillStyle = c;
                    ctx.fillRect(x - w / 2, -H, w, H * 2);
                });
                break;
        }
        ctx.restore();
    }

    function eye(ctx, x, y, r) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = Math.max(0.8, r * 0.18);
        ctx.stroke();
        ctx.fillStyle = '#1b1f2a';
        ctx.beginPath(); ctx.arc(x + r * 0.18, y + r * 0.05, r * 0.62, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(x + r * 0.38, y - r * 0.22, r * 0.24, 0, Math.PI * 2); ctx.fill();
    }

    function finStyle(ctx, a, outline, lw) {
        ctx.fillStyle = U.rgba(a.fin, 0.92);
        ctx.strokeStyle = outline;
        ctx.lineWidth = lw;
        ctx.lineJoin = 'round';
    }

    // Обычная рыба
    function drawStandard(ctx, a, L, rnd) {
        const p = SHAPES[a.shape] || SHAPES.oval;
        const H = L * p.h;
        const outline = U.shade(a.back, -0.5);
        const lw = Math.max(1.2, L * 0.016);

        // Нижние плавники и хвост — позади тела
        finStyle(ctx, a, outline, lw);
        tailPath(ctx, L, H, p.tail);
        ctx.fill(); ctx.stroke();
        // Лучи хвоста
        ctx.save();
        tailPath(ctx, L, H, p.tail); ctx.clip();
        ctx.strokeStyle = U.rgba(U.shade(a.fin, -0.35), 0.5);
        ctx.lineWidth = Math.max(0.7, L * 0.006);
        for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(-L * 0.3, 0); ctx.lineTo(-L * 0.55, i * H * 0.16); ctx.stroke(); }
        ctx.restore();

        finStyle(ctx, a, outline, lw);
        dorsalPath(ctx, L, H, p.dorsal);
        ctx.fill(); ctx.stroke();
        if (p.adipose) {
            ctx.beginPath();
            ctx.ellipse(-L * 0.22, -H * 0.36, L * 0.03, H * 0.1, -0.3, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();
        }
        if (p.anal) {
            ctx.beginPath();
            ctx.moveTo(-L * 0.06, H * 0.46);
            ctx.quadraticCurveTo(-L * 0.12, H * 0.8, -L * 0.22, H * 0.28);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
        }
        // Брюшной плавник
        ctx.beginPath();
        ctx.moveTo(L * 0.14, H * 0.46);
        ctx.quadraticCurveTo(L * 0.08, H * 0.82, L * 0.0, H * 0.48);
        ctx.closePath();
        ctx.fill(); ctx.stroke();

        if (p.finlets) {
            ctx.fillStyle = a.fin;
            for (let i = 0; i < 5; i++) {
                const x = -L * 0.12 - i * L * 0.035;
                [-1, 1].forEach(s => {
                    ctx.beginPath();
                    ctx.moveTo(x, s * H * (0.36 - i * 0.04));
                    ctx.lineTo(x - L * 0.02, s * H * (0.46 - i * 0.04));
                    ctx.lineTo(x - L * 0.025, s * H * (0.34 - i * 0.04));
                    ctx.fill();
                });
            }
        }

        // Тело с градиентом спина → брюхо
        const g = ctx.createLinearGradient(0, -H * 0.5, 0, H * 0.5);
        g.addColorStop(0, U.shade(a.back, -0.08));
        g.addColorStop(0.45, a.back);
        g.addColorStop(0.62, U.mix(a.back, a.belly, 0.7));
        g.addColorStop(1, a.belly);
        bodyPath(ctx, L, H, p);
        ctx.fillStyle = g;
        ctx.fill();

        ctx.save();
        bodyPath(ctx, L, H, p);
        ctx.clip();
        pattern(ctx, L, H, a, rnd);
        // Блик сверху
        const hl = ctx.createLinearGradient(0, -H * 0.5, 0, 0);
        hl.addColorStop(0, 'rgba(255,255,255,0.35)');
        hl.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = hl;
        ctx.beginPath();
        ctx.ellipse(L * 0.06, -H * 0.24, L * 0.3, H * 0.18, -0.05, 0, Math.PI * 2);
        ctx.fill();
        // Жаберная крышка
        ctx.strokeStyle = U.rgba(outline, 0.45);
        ctx.lineWidth = lw * 0.8;
        ctx.beginPath();
        ctx.arc(L * 0.12, H * 0.02, H * 0.42, -0.9, 0.9);
        ctx.stroke();
        if (p.gills) {
            for (let i = 0; i < p.gills; i++) {
                ctx.beginPath();
                ctx.moveTo(L * (0.2 - i * 0.03), -H * 0.12);
                ctx.lineTo(L * (0.19 - i * 0.03), H * 0.16);
                ctx.stroke();
            }
        }
        ctx.restore();

        bodyPath(ctx, L, H, p);
        ctx.strokeStyle = outline;
        ctx.lineWidth = lw;
        ctx.stroke();

        // Морда: рыло щуки, меч, усы сома
        if (p.bill) {
            ctx.fillStyle = U.shade(a.back, -0.1);
            ctx.beginPath();
            ctx.moveTo(L * 0.48, -H * 0.02);
            ctx.lineTo(L * (0.5 + p.bill), H * 0.0);
            ctx.lineTo(L * 0.48, H * 0.1);
            ctx.closePath();
            ctx.fill(); ctx.stroke();
        }
        if (p.whiskers) {
            ctx.strokeStyle = outline;
            ctx.lineWidth = Math.max(1, L * 0.01);
            ctx.lineCap = 'round';
            [[0.2, 0.32, -0.1], [0.2, 0.42, 0.2], [0.12, 0.5, 0.45]].forEach(([dy, len, bend]) => {
                ctx.beginPath();
                ctx.moveTo(L * 0.48, H * (0.06 + dy * 0.2));
                ctx.quadraticCurveTo(L * (0.5 + len * 0.6), H * (0.1 + bend), L * (0.42 + len), H * (0.3 + bend));
                ctx.stroke();
            });
        }
        // Рот
        ctx.strokeStyle = U.rgba(outline, 0.8);
        ctx.lineWidth = Math.max(1, lw * 0.8);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(L * 0.49, H * 0.1);
        ctx.quadraticCurveTo(L * 0.45, H * 0.15, L * 0.42, H * 0.13);
        ctx.stroke();

        // Грудной плавник — поверх тела
        finStyle(ctx, a, outline, lw * 0.8);
        ctx.beginPath();
        ctx.moveTo(L * 0.2, H * 0.12);
        ctx.quadraticCurveTo(L * 0.06, H * 0.12, L * 0.04, H * 0.3);
        ctx.quadraticCurveTo(L * 0.14, H * 0.3, L * 0.2, H * 0.12);
        ctx.fill(); ctx.stroke();

        eye(ctx, L * (p.eyeUp ? 0.34 : 0.33), -H * (p.eyeUp ? 0.2 : 0.1), Math.max(2, Math.min(H * 0.16, L * 0.055)));
    }

    // ---------- Особые формы ----------
    function drawEel(ctx, a, L, rnd) {
        const H = L * 0.18;
        const outline = U.shade(a.back, -0.5);
        const lw = Math.max(1.2, L * 0.014);
        const pts = [];
        for (let i = 0; i <= 20; i++) {
            const t = i / 20;
            pts.push([L * 0.5 - t * L, Math.sin(t * Math.PI * 2) * H * 0.55 * t]);
        }
        const width = (t) => H * 0.5 * (t < 0.1 ? 0.6 + t * 4 : 1 - t * 0.7);
        const top = [], bot = [];
        pts.forEach((p, i) => { const t = i / 20; top.push([p[0], p[1] - width(t)]); bot.push([p[0], p[1] + width(t)]); });
        const path = () => {
            ctx.beginPath();
            ctx.moveTo(top[0][0] + H * 0.2, pts[0][1]);
            top.forEach(p => ctx.lineTo(p[0], p[1]));
            for (let i = bot.length - 1; i >= 0; i--) ctx.lineTo(bot[i][0], bot[i][1]);
            ctx.closePath();
        };
        // Плавник-кайма
        ctx.fillStyle = U.rgba(a.fin, 0.8);
        ctx.beginPath();
        ctx.moveTo(pts[6][0], pts[6][1] - width(0.3) * 1.6);
        for (let i = 6; i <= 20; i++) ctx.lineTo(pts[i][0], pts[i][1] - width(i / 20) * 1.6);
        for (let i = 20; i >= 9; i--) ctx.lineTo(pts[i][0], pts[i][1] + width(i / 20) * 1.6);
        ctx.closePath();
        ctx.fill();
        const g = ctx.createLinearGradient(0, -H, 0, H);
        g.addColorStop(0, a.back); g.addColorStop(1, a.belly);
        path(); ctx.fillStyle = g; ctx.fill();
        ctx.save(); path(); ctx.clip(); pattern(ctx, L, H * 2, a, rnd); ctx.restore();
        path(); ctx.strokeStyle = outline; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke();
        eye(ctx, L * 0.42, pts[0][1] - H * 0.12, Math.max(2, H * 0.22));
    }

    function drawFrog(ctx, a, L) {
        const outline = U.shade(a.back, -0.5);
        const lw = Math.max(1.2, L * 0.016);
        ctx.lineWidth = lw; ctx.strokeStyle = outline; ctx.lineJoin = 'round';
        // Лапы
        ctx.fillStyle = a.fin;
        [[-0.3, 0.2, 1], [0.25, 0.25, -1]].forEach(([x, y, s]) => {
            ctx.beginPath();
            ctx.ellipse(L * x, L * y, L * 0.16, L * 0.07, s * 0.5, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();
        });
        const g = ctx.createRadialGradient(0, -L * 0.1, L * 0.05, 0, 0, L * 0.4);
        g.addColorStop(0, U.shade(a.back, 0.2)); g.addColorStop(1, a.back);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(0, 0, L * 0.36, L * 0.24, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = a.belly;
        ctx.beginPath(); ctx.ellipse(L * 0.08, L * 0.1, L * 0.22, L * 0.11, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = U.rgba(a.pc, 0.6);
        [[-0.15, -0.08], [-0.05, -0.15], [-0.22, 0.02], [0.02, -0.04]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(L * x, L * y, L * 0.035, 0, Math.PI * 2); ctx.fill(); });
        // Глаза-бугорки
        [[0.16, -0.2], [0.3, -0.16]].forEach(([x, y]) => {
            ctx.fillStyle = a.back;
            ctx.beginPath(); ctx.arc(L * x, L * y, L * 0.08, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            eye(ctx, L * x, L * y, L * 0.055);
        });
        ctx.strokeStyle = outline;
        ctx.beginPath(); ctx.arc(L * 0.24, L * 0.0, L * 0.1, 0.2, 1.3); ctx.stroke();
    }

    function drawFlat(ctx, a, L, rnd) {
        const outline = U.shade(a.back, -0.5);
        const lw = Math.max(1.2, L * 0.016);
        const W = L * 0.44, Hh = L * 0.26;
        ctx.fillStyle = U.rgba(a.fin, 0.9); ctx.strokeStyle = outline; ctx.lineWidth = lw;
        ctx.beginPath(); ctx.ellipse(-L * 0.02, 0, W * 1.06, Hh * 1.3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-L * 0.42, 0); ctx.lineTo(-L * 0.56, -Hh * 0.6); ctx.lineTo(-L * 0.56, Hh * 0.6); ctx.closePath(); ctx.fill(); ctx.stroke();
        const g = ctx.createRadialGradient(L * 0.05, -Hh * 0.2, 2, 0, 0, W);
        g.addColorStop(0, U.shade(a.back, 0.15)); g.addColorStop(1, a.back);
        const body = () => { ctx.beginPath(); ctx.ellipse(0, 0, W * 0.92, Hh, 0, 0, Math.PI * 2); };
        body(); ctx.fillStyle = g; ctx.fill();
        ctx.save(); body(); ctx.clip(); pattern(ctx, L, Hh * 2, a, rnd); ctx.restore();
        body(); ctx.stroke();
        eye(ctx, L * 0.28, -Hh * 0.38, L * 0.04);
        eye(ctx, L * 0.33, -Hh * 0.05, L * 0.04);
    }

    function drawRay(ctx, a, L, rnd) {
        const outline = U.shade(a.back, -0.5);
        const lw = Math.max(1.2, L * 0.016);
        ctx.strokeStyle = outline; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        // Хвост
        ctx.strokeStyle = a.fin;
        ctx.lineWidth = Math.max(2, L * 0.025);
        ctx.beginPath(); ctx.moveTo(-L * 0.2, 0); ctx.quadraticCurveTo(-L * 0.4, L * 0.04, -L * 0.56, -L * 0.04); ctx.stroke();
        ctx.strokeStyle = outline; ctx.lineWidth = lw;
        const body = () => {
            ctx.beginPath();
            ctx.moveTo(L * 0.34, 0);
            ctx.quadraticCurveTo(L * 0.18, -L * 0.1, L * 0.02, -L * 0.36);
            ctx.quadraticCurveTo(-L * 0.08, -L * 0.12, -L * 0.24, 0);
            ctx.quadraticCurveTo(-L * 0.08, L * 0.12, L * 0.02, L * 0.36);
            ctx.quadraticCurveTo(L * 0.18, L * 0.1, L * 0.34, 0);
            ctx.closePath();
        };
        const g = ctx.createRadialGradient(L * 0.05, 0, 2, 0, 0, L * 0.4);
        g.addColorStop(0, U.shade(a.back, 0.2)); g.addColorStop(1, a.back);
        body(); ctx.fillStyle = g; ctx.fill();
        ctx.save(); body(); ctx.clip(); pattern(ctx, L, L * 0.6, a, rnd); ctx.restore();
        body(); ctx.stroke();
        eye(ctx, L * 0.16, -L * 0.05, L * 0.03);
        eye(ctx, L * 0.16, L * 0.05, L * 0.03);
    }

    function drawPuffer(ctx, a, L, rnd) {
        const outline = U.shade(a.back, -0.5);
        const lw = Math.max(1.2, L * 0.016);
        const R = L * 0.3;
        ctx.strokeStyle = outline; ctx.lineWidth = lw; ctx.lineJoin = 'round';
        ctx.fillStyle = a.fin;
        ctx.beginPath(); ctx.moveTo(-R * 0.9, 0); ctx.lineTo(-L * 0.5, -L * 0.13); ctx.lineTo(-L * 0.5, L * 0.13); ctx.closePath(); ctx.fill(); ctx.stroke();
        // Шипы
        ctx.fillStyle = U.shade(a.back, 0.1);
        for (let i = 0; i < 26; i++) {
            const t = (i / 26) * Math.PI * 2;
            const x = Math.cos(t), y = Math.sin(t);
            ctx.beginPath();
            ctx.moveTo(x * R * 0.92 - y * R * 0.08, y * R * 0.92 + x * R * 0.08);
            ctx.lineTo(x * R * 1.2, y * R * 1.2);
            ctx.lineTo(x * R * 0.92 + y * R * 0.08, y * R * 0.92 - x * R * 0.08);
            ctx.fill(); ctx.stroke();
        }
        const g = ctx.createLinearGradient(0, -R, 0, R);
        g.addColorStop(0, a.back); g.addColorStop(0.55, U.mix(a.back, a.belly, 0.6)); g.addColorStop(1, a.belly);
        const body = () => { ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); };
        body(); ctx.fillStyle = g; ctx.fill();
        ctx.save(); body(); ctx.clip(); pattern(ctx, L, R * 2, a, rnd); ctx.restore();
        body(); ctx.stroke();
        eye(ctx, R * 0.5, -R * 0.25, R * 0.24);
        ctx.strokeStyle = outline;
        ctx.beginPath(); ctx.arc(R * 0.86, R * 0.18, R * 0.1, -1, 1.5); ctx.stroke();
    }

    function drawMola(ctx, a, L, rnd) {
        const outline = U.shade(a.back, -0.5);
        const lw = Math.max(1.2, L * 0.016);
        ctx.strokeStyle = outline; ctx.lineWidth = lw; ctx.lineJoin = 'round';
        ctx.fillStyle = a.fin;
        ctx.beginPath(); ctx.moveTo(-L * 0.05, -L * 0.24); ctx.quadraticCurveTo(-L * 0.12, -L * 0.62, -L * 0.24, -L * 0.6); ctx.lineTo(-L * 0.22, -L * 0.2); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-L * 0.05, L * 0.24); ctx.quadraticCurveTo(-L * 0.12, L * 0.62, -L * 0.24, L * 0.6); ctx.lineTo(-L * 0.22, L * 0.2); ctx.closePath(); ctx.fill(); ctx.stroke();
        // Обрезанный «хвост»-кайма
        ctx.beginPath(); ctx.ellipse(-L * 0.3, 0, L * 0.08, L * 0.3, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        const body = () => { ctx.beginPath(); ctx.ellipse(0, 0, L * 0.34, L * 0.32, 0, 0, Math.PI * 2); };
        const g = ctx.createLinearGradient(0, -L * 0.32, 0, L * 0.32);
        g.addColorStop(0, a.back); g.addColorStop(1, a.belly);
        body(); ctx.fillStyle = g; ctx.fill();
        ctx.save(); body(); ctx.clip(); pattern(ctx, L, L * 0.6, a, rnd); ctx.restore();
        body(); ctx.stroke();
        eye(ctx, L * 0.2, -L * 0.06, L * 0.045);
        ctx.beginPath(); ctx.arc(L * 0.32, L * 0.06, L * 0.025, 0, Math.PI * 2); ctx.fillStyle = outline; ctx.fill();
    }

    const SPECIAL = { eel: drawEel, frog: drawFrog, flat: drawFlat, ray: drawRay, puffer: drawPuffer, mola: drawMola };

    // Нарисовать рыбу в точке (0,0). opts.silhouette — тёмный силуэт (не поймана)
    FA.drawFish = (ctx, fish, L, opts) => {
        opts = opts || {};
        const a = opts.silhouette
            ? Object.assign({}, fish.art, { back: '#3a5566', belly: '#3a5566', fin: '#33505f', pat: null })
            : fish.art;
        const rnd = U.seeded(seedOf(fish.id));
        ctx.save();
        (SPECIAL[a.shape] || drawStandard)(ctx, a, L, rnd);
        ctx.restore();
    };

    // ---------- Мусор ----------
    const JUNK_ART = {
        boot(ctx, L) {
            const o = '#3a2a1e';
            ctx.lineWidth = L * 0.03; ctx.strokeStyle = o; ctx.lineJoin = 'round';
            ctx.fillStyle = '#6a4a2e';
            ctx.beginPath();
            ctx.moveTo(-L * 0.1, -L * 0.4); ctx.lineTo(L * 0.12, -L * 0.4); ctx.lineTo(L * 0.12, L * 0.05);
            ctx.quadraticCurveTo(L * 0.42, L * 0.08, L * 0.4, L * 0.28); ctx.lineTo(-L * 0.12, L * 0.28); ctx.closePath();
            ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#2e2018'; ctx.fillRect(-L * 0.14, L * 0.22, L * 0.56, L * 0.08);
            ctx.fillStyle = '#8a6a48'; ctx.fillRect(-L * 0.12, -L * 0.4, L * 0.24, L * 0.07);
            ctx.fillStyle = 'rgba(120,200,120,0.8)';
            ctx.beginPath(); ctx.ellipse(L * 0.02, -L * 0.42, L * 0.08, L * 0.03, -0.4, 0, Math.PI * 2); ctx.fill();
        },
        can(ctx, L) {
            ctx.lineWidth = L * 0.025; ctx.strokeStyle = '#3c4650';
            const g = ctx.createLinearGradient(-L * 0.18, 0, L * 0.18, 0);
            g.addColorStop(0, '#9aa6b0'); g.addColorStop(0.4, '#eef2f5'); g.addColorStop(1, '#7c8894');
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.rect(-L * 0.18, -L * 0.3, L * 0.36, L * 0.6); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#d8402a'; ctx.fillRect(-L * 0.18, -L * 0.12, L * 0.36, L * 0.24);
            ctx.fillStyle = '#ffffff'; ctx.font = 'bold ' + Math.round(L * 0.12) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('★', 0, 0);
            ctx.strokeRect(-L * 0.18, -L * 0.3, L * 0.36, L * 0.6);
        },
        weed(ctx, L) {
            ctx.lineCap = 'round';
            ['#3e8a3a', '#5aa84a', '#2f6e2c', '#6abf5a'].forEach((c, i) => {
                ctx.strokeStyle = c; ctx.lineWidth = L * 0.06;
                ctx.beginPath(); ctx.moveTo((i - 1.5) * L * 0.06, L * 0.35);
                ctx.bezierCurveTo((i - 2) * L * 0.2, L * 0.1, (i - 1) * L * 0.2, -L * 0.1, (i - 1.5) * L * 0.14, -L * 0.36);
                ctx.stroke();
            });
        },
        tire(ctx, L) {
            ctx.fillStyle = '#2a2c30'; ctx.beginPath(); ctx.arc(0, 0, L * 0.38, 0, Math.PI * 2); ctx.arc(0, 0, L * 0.18, 0, Math.PI * 2, true); ctx.fill('evenodd');
            ctx.strokeStyle = '#4a4e56'; ctx.lineWidth = L * 0.03;
            for (let i = 0; i < 16; i++) { const t = i / 16 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(Math.cos(t) * L * 0.28, Math.sin(t) * L * 0.28); ctx.lineTo(Math.cos(t) * L * 0.37, Math.sin(t) * L * 0.37); ctx.stroke(); }
            ctx.fillStyle = 'rgba(110,190,110,0.7)'; ctx.beginPath(); ctx.ellipse(L * 0.1, -L * 0.3, L * 0.1, L * 0.04, 0.3, 0, Math.PI * 2); ctx.fill();
        },
        bottle(ctx, L) {
            ctx.save(); ctx.rotate(-0.5);
            ctx.lineWidth = L * 0.025; ctx.strokeStyle = '#2a6a4a';
            ctx.fillStyle = 'rgba(120,210,170,0.75)';
            ctx.beginPath();
            ctx.moveTo(-L * 0.12, L * 0.35); ctx.lineTo(-L * 0.12, -L * 0.1); ctx.quadraticCurveTo(-L * 0.12, -L * 0.2, -L * 0.05, -L * 0.24);
            ctx.lineTo(-L * 0.05, -L * 0.36); ctx.lineTo(L * 0.05, -L * 0.36); ctx.lineTo(L * 0.05, -L * 0.24);
            ctx.quadraticCurveTo(L * 0.12, -L * 0.2, L * 0.12, -L * 0.1); ctx.lineTo(L * 0.12, L * 0.35); ctx.closePath();
            ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#f2e6c0'; ctx.fillRect(-L * 0.07, -L * 0.05, L * 0.14, L * 0.3);
            ctx.strokeStyle = '#c8a870'; ctx.lineWidth = L * 0.01;
            for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-L * 0.05, i * L * 0.06); ctx.lineTo(L * 0.05, i * L * 0.06); ctx.stroke(); }
            ctx.fillStyle = '#a8743a'; ctx.fillRect(-L * 0.05, -L * 0.42, L * 0.1, L * 0.08);
            ctx.restore();
        },
        duck(ctx, L) {
            ctx.lineWidth = L * 0.025; ctx.strokeStyle = '#b8860b';
            ctx.fillStyle = '#ffd83a';
            ctx.beginPath(); ctx.ellipse(-L * 0.04, L * 0.1, L * 0.3, L * 0.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.arc(L * 0.16, -L * 0.14, L * 0.16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#f28a1a'; ctx.beginPath(); ctx.ellipse(L * 0.34, -L * 0.1, L * 0.09, L * 0.045, 0, 0, Math.PI * 2); ctx.fill();
            eye(ctx, L * 0.2, -L * 0.18, L * 0.04);
            ctx.strokeStyle = '#e8b81a'; ctx.beginPath(); ctx.arc(-L * 0.08, L * 0.08, L * 0.12, 0.2, 2.2); ctx.stroke();
        },
        hat(ctx, L) {
            ctx.lineWidth = L * 0.025; ctx.strokeStyle = '#3a2a1e';
            ctx.fillStyle = '#7a5a3a';
            ctx.beginPath(); ctx.ellipse(0, L * 0.12, L * 0.42, L * 0.1, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-L * 0.22, L * 0.1); ctx.quadraticCurveTo(-L * 0.24, -L * 0.3, 0, -L * 0.3); ctx.quadraticCurveTo(L * 0.24, -L * 0.3, L * 0.22, L * 0.1); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#c84a3a'; ctx.fillRect(-L * 0.22, -L * 0.02, L * 0.44, L * 0.08);
        },
        chest(ctx, L) {
            ctx.lineWidth = L * 0.025; ctx.strokeStyle = '#4a2c14'; ctx.lineJoin = 'round';
            ctx.fillStyle = '#a8662a';
            ctx.beginPath(); ctx.rect(-L * 0.34, -L * 0.04, L * 0.68, L * 0.34); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#c47a34';
            ctx.beginPath(); ctx.moveTo(-L * 0.34, -L * 0.04); ctx.quadraticCurveTo(0, -L * 0.4, L * 0.34, -L * 0.04); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#f2c43a';
            ctx.fillRect(-L * 0.34, -L * 0.06, L * 0.68, L * 0.06);
            ctx.fillRect(-L * 0.06, -L * 0.1, L * 0.12, L * 0.16);
            ctx.strokeRect(-L * 0.06, -L * 0.1, L * 0.12, L * 0.16);
            ctx.fillStyle = 'rgba(255,240,150,0.9)';
            [[-0.2, -0.3], [0.15, -0.36], [0.28, -0.24]].forEach(([x, y]) => star(ctx, L * x, L * y, L * 0.05));
        }
    };

    function star(ctx, x, y, r) {
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const t = i / 8 * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * 0.35 : r;
            ctx.lineTo(x + Math.cos(t) * rr, y + Math.sin(t) * rr);
        }
        ctx.closePath();
        ctx.fill();
    }
    FA.star = star;

    FA.drawJunk = (ctx, junk, L) => {
        ctx.save();
        (JUNK_ART[junk.art] || JUNK_ART.boot)(ctx, L);
        ctx.restore();
    };

    // ---------- Кэш картинок ----------
    const cache = {};
    // Готовый холст с рыбой (или мусором) и запасом по краям под плавники и сияние
    FA.canvas = (id, size, opts) => {
        opts = opts || {};
        const key = id + '|' + size + '|' + (opts.silhouette ? 's' : '') + (opts.glow === false ? 'n' : '');
        if (cache[key]) return cache[key];
        const fish = FB.fishById[id], junk = FB.junkById[id];
        const c = document.createElement('canvas');
        const pad = 1.5;
        c.width = Math.ceil(size * pad);
        c.height = Math.ceil(size * (fish && ['tall', 'mola', 'sword', 'tuna', 'shark'].includes(fish.art.shape) ? 1.3 : 1.0));
        const ctx = c.getContext('2d');
        ctx.translate(c.width / 2, c.height / 2);
        if (fish) {
            const L = size * (fish.art.shape === 'sword' ? 0.8 : 1);
            if (!opts.silhouette && opts.glow !== false && fish.art.glowBody) {
                ctx.shadowColor = fish.art.belly;
                ctx.shadowBlur = size * 0.12;
            }
            FA.drawFish(ctx, fish, L, opts);
            if (!opts.silhouette && fish.art.shine && opts.glow !== false) {
                ctx.shadowBlur = 0;
                ctx.fillStyle = 'rgba(255,250,210,0.95)';
                const rnd = U.seeded(seedOf(id) + 7);
                for (let i = 0; i < 5; i++) star(ctx, U.lerp(-size * 0.4, size * 0.4, rnd()), U.lerp(-size * 0.3, size * 0.3, rnd()), size * U.lerp(0.025, 0.05, rnd()));
            }
        } else if (junk) {
            FA.drawJunk(ctx, junk, size * 0.8);
        }
        return (cache[key] = c);
    };

    const urls = {};
    FA.url = (id, size, opts) => {
        const key = id + '|' + size + '|' + JSON.stringify(opts || {});
        if (!urls[key]) urls[key] = FA.canvas(id, size, opts).toDataURL('image/png');
        return urls[key];
    };
})(window.FB);
