// hero.js — рыбак, нарисованный кодом. Сидит на краю мостков, тело и лицо
// повёрнуты на три четверти вправо (к воде).
//
// Стиль: тёплая тёмная обводка (контур толще, линии внутри тоньше), плоские
// тени и блики, большие глаза с переливающейся радужкой и двумя бликами.
//
// Персонажи: boy (мальчик), girl (девочка), grandpa (дедушка).
// Шапку и одежду берём из косметики игрока, лицо меняется по ходу рыбалки:
// calm, focus, strain, happy, sad.
//
// Рисуется в два захода, чтобы удочка оказалась между руками:
//   FB.hero.back(ctx, o)  — ноги, дальняя рука, тело, голова, шапка
//   FB.hero.front(ctx, o) — ближняя рука, сжимающая удочку
// o = { x, y, h, who, hat, jacket, face, lean, t, legs, dim }

(function (FB) {
    const HR = FB.hero = {};
    const U = FB.U;
    const OL = '#3b2a33';
    const TAU = Math.PI * 2;

    HR.CHARS = {
        boy: { skin: '#ffd8b8', shade: '#f2b28e', hair: '#7a4626', iris: '#7a4a24', boots: '#f6c53a', freckles: true },
        girl: { skin: '#ffe2cc', shade: '#f5bb98', hair: '#b4532a', iris: '#2f8f6e', boots: '#ff7d92', lashes: true, ponytail: true },
        grandpa: { skin: '#f7cba8', shade: '#e0a47e', hair: '#eef0f4', iris: '#4a6c90', boots: '#4f7d4a', beard: true, glasses: true, wrinkles: true }
    };

    // Толщина линий: контур и детали
    const LW = (h) => Math.max(1.4, h * 0.014);
    const lw2 = (h) => Math.max(1, h * 0.008);

    // ---------- Ноги и сапоги ----------
    function legs(ctx, o, C, d) {
        const h = o.h;
        const sw = Math.sin(o.t * 1.4) * h * 0.03, sw2 = Math.sin(o.t * 1.4 + 1.3) * h * 0.025;
        const draw = (hip, knee, ankle, color, near) => {
            ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            ctx.strokeStyle = OL; ctx.lineWidth = h * 0.15 + LW(h) * 2;
            ctx.beginPath(); ctx.moveTo(hip[0], hip[1]); ctx.lineTo(knee[0], knee[1]); ctx.lineTo(ankle[0], ankle[1]); ctx.stroke();
            ctx.strokeStyle = color; ctx.lineWidth = h * 0.15; ctx.stroke();
            // Шов, блик на колене, складка под коленом
            ctx.strokeStyle = U.rgba('#ffffff', 0.18); ctx.lineWidth = h * 0.03;
            ctx.beginPath(); ctx.moveTo(hip[0] + h * 0.05, hip[1] - h * 0.035); ctx.lineTo(knee[0] - h * 0.02, knee[1] - h * 0.035); ctx.stroke();
            if (near) {
                ctx.strokeStyle = U.rgba(OL, 0.35); ctx.lineWidth = lw2(h);
                ctx.beginPath(); ctx.arc(knee[0] - h * 0.02, knee[1] + h * 0.05, h * 0.03, -0.2, 1.6); ctx.stroke();
            }
            // Подвёрнутая штанина
            const k1 = 0.6, k2 = 0.74;
            const ax = U.lerp(knee[0], ankle[0], k1), ay = U.lerp(knee[1], ankle[1], k1);
            const bx = U.lerp(knee[0], ankle[0], k2), by = U.lerp(knee[1], ankle[1], k2);
            ctx.lineCap = 'butt';
            ctx.strokeStyle = OL; ctx.lineWidth = h * 0.17;
            ctx.beginPath(); ctx.moveTo(ax, ay - 1); ctx.lineTo(bx, by + 1); ctx.stroke();
            ctx.strokeStyle = d('#93b4e0'); ctx.lineWidth = h * 0.17 - LW(h) * 1.6;
            ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
            ctx.lineCap = 'round';
            // Резиновый сапог
            const x = ankle[0], y = ankle[1];
            const boot = () => {
                ctx.beginPath();
                ctx.moveTo(x - h * 0.08, y - h * 0.06);
                ctx.lineTo(x + h * 0.07, y - h * 0.06);
                ctx.lineTo(x + h * 0.075, y + h * 0.015);
                ctx.bezierCurveTo(x + h * 0.14, y + h * 0.01, x + h * 0.175, y + h * 0.04, x + h * 0.17, y + h * 0.08);
                ctx.lineTo(x - h * 0.08, y + h * 0.08);
                ctx.closePath();
            };
            boot(); ctx.fillStyle = d(C.boots); ctx.fill();
            ctx.save(); boot(); ctx.clip();
            ctx.fillStyle = d(U.shade(C.boots, -0.18));
            ctx.fillRect(x - h * 0.1, y - h * 0.08, h * 0.05, h * 0.2);
            ctx.fillStyle = d(U.shade(C.boots, -0.45));
            ctx.fillRect(x - h * 0.1, y + h * 0.058, h * 0.3, h * 0.03);
            ctx.fillStyle = d(U.shade(C.boots, 0.25));
            ctx.fillRect(x - h * 0.1, y - h * 0.065, h * 0.2, h * 0.022);
            ctx.restore();
            boot(); ctx.strokeStyle = OL; ctx.lineWidth = LW(h); ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            ctx.beginPath(); ctx.roundRect(x - h * 0.045, y - h * 0.035, h * 0.018, h * 0.07, h * 0.009); ctx.fill();
            // Протектор
            ctx.strokeStyle = U.rgba(OL, 0.5); ctx.lineWidth = lw2(h);
            for (let i = 0; i < 5; i++) { const px = x - h * 0.06 + i * h * 0.05; ctx.beginPath(); ctx.moveTo(px, y + h * 0.062); ctx.lineTo(px + h * 0.015, y + h * 0.085); ctx.stroke(); }
        };
        draw([h * 0.05, -h * 0.07], [h * 0.25, -h * 0.085], [h * 0.25 + sw2, h * 0.22], d('#3c5d92'), false);
        draw([-h * 0.02, -h * 0.05], [h * 0.285, -h * 0.05], [h * 0.3 + sw, h * 0.25], d('#4a70ac'), true);
    }

    // ---------- Тело ----------
    function torsoPath(ctx, h, b) {
        ctx.beginPath();
        ctx.moveTo(-h * 0.17, -h * 0.02);
        ctx.bezierCurveTo(-h * 0.215, -h * 0.2, -h * 0.205, -h * 0.4 + b, -h * 0.12, -h * 0.5 + b);
        ctx.quadraticCurveTo(-h * 0.02, -h * 0.575 + b, h * 0.1, -h * 0.535 + b);
        ctx.bezierCurveTo(h * 0.2, -h * 0.47 + b, h * 0.235, -h * 0.3, h * 0.215, -h * 0.08);
        ctx.quadraticCurveTo(h * 0.205, h * 0.012, h * 0.08, h * 0.012);
        ctx.closePath();
    }

    function torso(ctx, o, d) {
        const h = o.h, jk = o.jacket, b = Math.sin(o.t * 1.7) * h * 0.006;
        const base = jk.c.a, acc = jk.c.b;
        torsoPath(ctx, h, b);
        ctx.fillStyle = d(base); ctx.fill();
        ctx.save();
        torsoPath(ctx, h, b); ctx.clip();
        if (jk.id === 'jk_plaid') {
            ctx.strokeStyle = U.rgba(acc, 0.45); ctx.lineWidth = h * 0.026;
            for (let i = -6; i <= 6; i++) {
                ctx.beginPath(); ctx.moveTo(i * h * 0.07 + h * 0.02, -h * 0.7); ctx.lineTo(i * h * 0.07, h * 0.1); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(-h * 0.3, -h * 0.6 + (i + 6) * h * 0.07); ctx.lineTo(h * 0.3, -h * 0.62 + (i + 6) * h * 0.07); ctx.stroke();
            }
            ctx.strokeStyle = U.rgba('#ffffff', 0.18); ctx.lineWidth = h * 0.006;
            for (let i = -6; i <= 6; i++) { ctx.beginPath(); ctx.moveTo(i * h * 0.07 + h * 0.05, -h * 0.7); ctx.lineTo(i * h * 0.07 + h * 0.03, h * 0.1); ctx.stroke(); }
        } else if (jk.id === 'jk_hawaii') {
            for (let i = 0; i < 12; i++) {
                const fx = ((i * 41) % 40 - 20) / 100 * h, fy = -h * 0.52 + ((i * 59) % 52) / 100 * h;
                ctx.fillStyle = i % 2 ? acc : '#fff3a0';
                for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.ellipse(fx + Math.cos(k * 1.26) * h * 0.018, fy + Math.sin(k * 1.26) * h * 0.018, h * 0.015, h * 0.009, k * 1.26, 0, TAU); ctx.fill(); }
                ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.arc(fx, fy, h * 0.008, 0, TAU); ctx.fill();
                ctx.fillStyle = '#3aa85a'; ctx.beginPath(); ctx.ellipse(fx + h * 0.03, fy + h * 0.025, h * 0.02, h * 0.008, 0.6, 0, TAU); ctx.fill();
            }
        }
        // Тень со спины, блик на груди, складки у пояса
        ctx.fillStyle = d(U.shade(base, -0.24));
        ctx.beginPath(); ctx.ellipse(-h * 0.245, -h * 0.24, h * 0.13, h * 0.42, 0.05, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath(); ctx.ellipse(h * 0.14, -h * 0.37, h * 0.045, h * 0.12, 0.3, 0, TAU); ctx.fill();
        ctx.strokeStyle = U.rgba(OL, 0.28); ctx.lineWidth = lw2(h); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-h * 0.05, -h * 0.07); ctx.quadraticCurveTo(h * 0.0, -h * 0.1, h * 0.06, -h * 0.07); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-h * 0.12, -h * 0.12); ctx.quadraticCurveTo(-h * 0.08, -h * 0.15, -h * 0.03, -h * 0.13); ctx.stroke();
        details(ctx, jk, h, b, d);
        if (o.rich) {
            const g = ctx.createLinearGradient(-h * 0.2, -h * 0.5, h * 0.2, 0);
            g.addColorStop(0, 'rgba(0,0,0,0.12)'); g.addColorStop(0.55, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0.08)');
            ctx.fillStyle = g; ctx.fillRect(-h * 0.3, -h * 0.7, h * 0.6, h * 0.8);
            ctx.strokeStyle = 'rgba(255,240,220,0.55)'; ctx.lineWidth = h * 0.012;
            ctx.beginPath(); ctx.moveTo(h * 0.12, -h * 0.5); ctx.bezierCurveTo(h * 0.22, -h * 0.42, h * 0.235, -h * 0.28, h * 0.21, -h * 0.1); ctx.stroke();
        }
        ctx.restore();
        torsoPath(ctx, h, b);
        ctx.strokeStyle = OL; ctx.lineWidth = LW(h); ctx.stroke();
    }

    // Молнии, карманы, пуговицы, воротники
    function details(ctx, jk, h, b, d) {
        const base = jk.c.a, acc = jk.c.b;
        const seam = U.rgba(OL, 0.4);
        const pocket = (x, y, w, hh, flap) => {
            ctx.fillStyle = d(U.shade(base, -0.08));
            ctx.beginPath(); ctx.roundRect(x, y, w, hh, h * 0.012); ctx.fill();
            ctx.strokeStyle = seam; ctx.lineWidth = lw2(h); ctx.stroke();
            ctx.setLineDash([h * 0.012, h * 0.01]);
            ctx.strokeStyle = U.rgba('#ffffff', 0.35);
            ctx.beginPath(); ctx.roundRect(x + h * 0.008, y + h * 0.008, w - h * 0.016, hh - h * 0.016, h * 0.008); ctx.stroke();
            ctx.setLineDash([]);
            if (flap) {
                ctx.fillStyle = d(flap);
                ctx.beginPath(); ctx.moveTo(x - h * 0.004, y); ctx.lineTo(x + w + h * 0.004, y); ctx.lineTo(x + w, y + h * 0.026); ctx.lineTo(x, y + h * 0.026); ctx.closePath(); ctx.fill();
                ctx.strokeStyle = seam; ctx.stroke();
                ctx.fillStyle = d('#d8d0b8'); ctx.beginPath(); ctx.arc(x + w / 2, y + h * 0.018, h * 0.007, 0, TAU); ctx.fill();
            }
        };
        if (jk.id === 'jk_green') {
            // Рыбацкая жилетка поверх светлой кофты
            ctx.fillStyle = d('#f4ead6');
            ctx.beginPath(); ctx.moveTo(-h * 0.01, -h * 0.57 + b); ctx.lineTo(h * 0.13, -h * 0.55 + b); ctx.lineTo(h * 0.08, -h * 0.36); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = U.rgba(OL, 0.3); ctx.lineWidth = lw2(h);
            ctx.beginPath(); ctx.moveTo(h * 0.08, -h * 0.36); ctx.lineTo(h * 0.1, -h * 0.02); ctx.stroke();
            pocket(-h * 0.11, -h * 0.34, h * 0.09, h * 0.08, U.shade(base, 0.08));
            pocket(h * 0.1, -h * 0.33, h * 0.08, h * 0.08, U.shade(base, 0.08));
            pocket(-h * 0.1, -h * 0.17, h * 0.1, h * 0.09, acc);
            pocket(h * 0.11, -h * 0.17, h * 0.08, h * 0.09, acc);
            // Колечко с блесной на кармане — мелочь, а приятно
            ctx.strokeStyle = d('#c8d0d8'); ctx.lineWidth = lw2(h) * 1.4;
            ctx.beginPath(); ctx.arc(-h * 0.03, -h * 0.36, h * 0.012, 0, TAU); ctx.stroke();
            ctx.fillStyle = d('#e8402a'); ctx.beginPath(); ctx.ellipse(-h * 0.03, -h * 0.33, h * 0.008, h * 0.018, 0, 0, TAU); ctx.fill();
        } else if (jk.id === 'jk_yellow' || jk.id === 'jk_gold') {
            ctx.strokeStyle = U.rgba(OL, 0.4); ctx.lineWidth = lw2(h);
            ctx.beginPath(); ctx.moveTo(h * 0.085, -h * 0.53 + b); ctx.lineTo(h * 0.1, -h * 0.01); ctx.stroke();
            ctx.fillStyle = d(acc);
            [-0.42, -0.3, -0.18].forEach(k => {
                ctx.beginPath(); ctx.roundRect(h * 0.09, h * k, h * 0.04, h * 0.018, h * 0.008); ctx.fill();
                ctx.strokeStyle = U.rgba(OL, 0.4); ctx.stroke();
            });
            pocket(-h * 0.1, -h * 0.2, h * 0.11, h * 0.1, U.shade(base, -0.05));
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            ctx.beginPath(); ctx.ellipse(h * 0.16, -h * 0.26, h * 0.016, h * 0.12, 0.15, 0, TAU); ctx.fill();
            // Капюшон, лежащий на спине
            ctx.fillStyle = d(U.shade(base, -0.12));
            ctx.beginPath(); ctx.ellipse(-h * 0.11, -h * 0.5 + b, h * 0.1, h * 0.055, -0.35, 0, TAU); ctx.fill();
            ctx.strokeStyle = U.rgba(OL, 0.4); ctx.stroke();
        } else if (jk.id === 'jk_navy') {
            ctx.fillStyle = d('#e8b830');
            [[0.0, -0.44], [0.13, -0.42], [0.0, -0.3], [0.13, -0.28], [0.0, -0.16], [0.13, -0.14]].forEach(([px, py]) => {
                ctx.beginPath(); ctx.arc(h * px, h * py, h * 0.016, 0, TAU); ctx.fill();
                ctx.strokeStyle = U.rgba(OL, 0.5); ctx.lineWidth = lw2(h); ctx.stroke();
            });
            ctx.fillStyle = d('#f4f4f4');
            ctx.beginPath(); ctx.moveTo(-h * 0.01, -h * 0.565 + b); ctx.lineTo(h * 0.13, -h * 0.54 + b); ctx.lineTo(h * 0.06, -h * 0.44); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = d('#2a4a8a'); ctx.lineWidth = h * 0.008;
            ctx.beginPath(); ctx.moveTo(h * 0.0, -h * 0.55 + b); ctx.lineTo(h * 0.11, -h * 0.53 + b); ctx.stroke();
        } else if (jk.id === 'jk_plaid' || jk.id === 'jk_hawaii') {
            ctx.strokeStyle = U.rgba(OL, 0.35); ctx.lineWidth = lw2(h);
            ctx.beginPath(); ctx.moveTo(h * 0.085, -h * 0.53 + b); ctx.lineTo(h * 0.105, -h * 0.01); ctx.stroke();
            ctx.fillStyle = d('#fbf6ec');
            [-0.42, -0.3, -0.18, -0.06].forEach(k => {
                ctx.beginPath(); ctx.arc(h * 0.1, h * k, h * 0.011, 0, TAU); ctx.fill();
                ctx.strokeStyle = U.rgba(OL, 0.4); ctx.stroke();
            });
            pocket(-h * 0.1, -h * 0.38, h * 0.09, h * 0.08, U.shade(base, 0.05));
        }
    }

    function collar(ctx, o, d) {
        const h = o.h, jk = o.jacket, b = Math.sin(o.t * 1.7) * h * 0.006;
        const c = d(U.shade(jk.c.a, 0.1));
        ctx.lineWidth = LW(h) * 0.85; ctx.strokeStyle = OL; ctx.lineJoin = 'round';
        ctx.fillStyle = c;
        ctx.beginPath(); ctx.moveTo(-h * 0.085, -h * 0.525 + b); ctx.quadraticCurveTo(-h * 0.01, -h * 0.46 + b, h * 0.035, -h * 0.495 + b); ctx.lineTo(-h * 0.01, -h * 0.585 + b); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(h * 0.045, -h * 0.495 + b); ctx.quadraticCurveTo(h * 0.11, -h * 0.47 + b, h * 0.15, -h * 0.53 + b); ctx.lineTo(h * 0.085, -h * 0.575 + b); ctx.closePath(); ctx.fill(); ctx.stroke();
    }

    // ---------- Руки ----------
    function arm(ctx, h, sh, hand, color, cuff, skin, near) {
        const ex = sh[0] + (hand[0] - sh[0]) * 0.38, ey = Math.max(sh[1], hand[1]) + h * 0.1;
        const w = h * 0.12;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.strokeStyle = OL; ctx.lineWidth = w + LW(h) * 2;
        const path = () => { ctx.beginPath(); ctx.moveTo(sh[0], sh[1]); ctx.quadraticCurveTo(ex, ey, hand[0] - h * 0.035, hand[1] + h * 0.005); };
        path(); ctx.stroke();
        ctx.strokeStyle = color; ctx.lineWidth = w; path(); ctx.stroke();
        // Складки на сгибе локтя и блик
        const mx = (sh[0] + 2 * ex + hand[0]) / 4, my = (sh[1] + 2 * ey + hand[1]) / 4;
        ctx.strokeStyle = U.rgba(OL, 0.35); ctx.lineWidth = lw2(h);
        ctx.beginPath(); ctx.moveTo(mx - h * 0.01, my - h * 0.045); ctx.quadraticCurveTo(mx + h * 0.02, my - h * 0.02, mx + h * 0.005, my + h * 0.01); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(mx + h * 0.02, my - h * 0.05); ctx.quadraticCurveTo(mx + h * 0.045, my - h * 0.03, mx + h * 0.035, my - h * 0.005); ctx.stroke();
        if (near) {
            ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = h * 0.025;
            ctx.beginPath(); ctx.moveTo(sh[0] + h * 0.02, sh[1] - h * 0.02); ctx.quadraticCurveTo(ex + h * 0.02, ey - h * 0.07, mx + h * 0.02, my - h * 0.06); ctx.stroke();
        }
        // Манжета
        const cx = hand[0] - h * 0.065, cy = hand[1] + h * 0.012;
        ctx.fillStyle = cuff; ctx.strokeStyle = OL; ctx.lineWidth = LW(h) * 0.85;
        ctx.beginPath(); ctx.ellipse(cx, cy, h * 0.032, h * 0.064, -0.5, 0, TAU); ctx.fill(); ctx.stroke();
        // Кулак с пальцами, большой палец сверху
        fist(ctx, h, hand[0], hand[1], skin);
    }
    function fist(ctx, h, x, y, skin) {
        ctx.fillStyle = skin; ctx.strokeStyle = OL; ctx.lineWidth = LW(h) * 0.85;
        ctx.beginPath();
        ctx.moveTo(x - h * 0.045, y - h * 0.035);
        ctx.quadraticCurveTo(x + h * 0.0, y - h * 0.058, x + h * 0.048, y - h * 0.03);
        ctx.quadraticCurveTo(x + h * 0.062, y + h * 0.01, x + h * 0.04, y + h * 0.045);
        ctx.quadraticCurveTo(x - h * 0.01, y + h * 0.062, x - h * 0.05, y + h * 0.035);
        ctx.quadraticCurveTo(x - h * 0.062, y, x - h * 0.045, y - h * 0.035);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = U.rgba(OL, 0.5); ctx.lineWidth = lw2(h);
        for (let i = 0; i < 3; i++) { const fy = y - h * 0.005 + i * h * 0.017; ctx.beginPath(); ctx.moveTo(x + h * 0.018, fy); ctx.lineTo(x + h * 0.05, fy + h * 0.004); ctx.stroke(); }
        ctx.beginPath(); ctx.moveTo(x - h * 0.03, y - h * 0.03); ctx.quadraticCurveTo(x + h * 0.01, y - h * 0.045, x + h * 0.03, y - h * 0.018); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath(); ctx.ellipse(x - h * 0.012, y - h * 0.032, h * 0.014, h * 0.007, -0.3, 0, TAU); ctx.fill();
    }

    // ---------- Голова ----------
    // Лицо на три четверти вправо: затылок слева, щёчка и подбородок справа
    function facePath(ctx, R) {
        ctx.beginPath();
        ctx.moveTo(-0.52 * R, 0.66 * R);
        ctx.bezierCurveTo(-1.02 * R, 0.42 * R, -1.08 * R, -0.5 * R, -0.45 * R, -0.88 * R);
        ctx.bezierCurveTo(0.02 * R, -1.13 * R, 0.76 * R, -0.96 * R, 0.9 * R, -0.45 * R);
        ctx.bezierCurveTo(0.98 * R, -0.2 * R, 0.95 * R, -0.02 * R, 0.93 * R, 0.1 * R);
        ctx.bezierCurveTo(1.02 * R, 0.26 * R, 1.0 * R, 0.45 * R, 0.88 * R, 0.58 * R);
        ctx.bezierCurveTo(0.74 * R, 0.82 * R, 0.52 * R, 0.94 * R, 0.3 * R, 0.94 * R);
        ctx.bezierCurveTo(0.04 * R, 0.95 * R, -0.24 * R, 0.84 * R, -0.52 * R, 0.66 * R);
        ctx.closePath();
    }

    function neck(ctx, R, C, d) {
        ctx.fillStyle = d(C.skin);
        ctx.beginPath();
        ctx.moveTo(-0.34 * R, 0.55 * R);
        ctx.lineTo(-0.3 * R, 1.25 * R);
        ctx.lineTo(0.24 * R, 1.25 * R);
        ctx.lineTo(0.26 * R, 0.75 * R);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = d(C.shade);
        ctx.beginPath(); ctx.moveTo(-0.34 * R, 0.55 * R); ctx.lineTo(0.26 * R, 0.8 * R); ctx.lineTo(0.25 * R, 1.0 * R); ctx.lineTo(-0.32 * R, 0.95 * R); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = OL; ctx.lineWidth = Math.max(1.2, R * 0.045);
        ctx.beginPath(); ctx.moveTo(-0.33 * R, 0.6 * R); ctx.lineTo(-0.3 * R, 1.2 * R); ctx.moveTo(0.25 * R, 0.85 * R); ctx.lineTo(0.24 * R, 1.2 * R); ctx.stroke();
    }

    // Глаз: миндалина, радужка с переливом, зрачок, два блика, веко
    function eye(ctx, x, y, w, hh, C, face, far, t, d) {
        ctx.save();
        ctx.translate(x, y);
        const outer = far ? 1 : -1;            // внешний уголок: у дальнего глаза — справа
        const lid = Math.max(1.2, hh * 0.12);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        const blink = face === 'calm' && (t % 4.1) < 0.13;
        if (face === 'happy') {
            ctx.strokeStyle = OL; ctx.lineWidth = lid * 1.3;
            ctx.beginPath(); ctx.moveTo(-w * 0.48, hh * 0.08); ctx.quadraticCurveTo(0, -hh * 0.5, w * 0.48, hh * 0.08); ctx.stroke();
            ctx.restore();
            return;
        }
        if (face === 'strain') {
            ctx.strokeStyle = OL; ctx.lineWidth = lid * 1.2;
            ctx.beginPath(); ctx.moveTo(outer * w * 0.5, -hh * 0.32); ctx.quadraticCurveTo(-outer * w * 0.05, -hh * 0.05, -outer * w * 0.42, hh * 0.02); ctx.quadraticCurveTo(-outer * w * 0.05, hh * 0.1, outer * w * 0.5, hh * 0.32); ctx.stroke();
            ctx.restore();
            return;
        }
        if (blink) {
            ctx.strokeStyle = OL; ctx.lineWidth = lid;
            ctx.beginPath(); ctx.moveTo(-w * 0.5, 0); ctx.quadraticCurveTo(0, hh * 0.3, w * 0.5, 0); ctx.stroke();
            if (C.lashes) { ctx.beginPath(); ctx.moveTo(outer * w * 0.5, 0); ctx.lineTo(outer * w * 0.7, -hh * 0.1); ctx.stroke(); }
            ctx.restore();
            return;
        }
        const k = face === 'focus' ? 1.08 : 1;
        const top = -hh * 0.56 * k, bot = hh * 0.48 * k;
        const shape = () => {
            ctx.beginPath();
            ctx.moveTo(-w * 0.5, 0);
            ctx.bezierCurveTo(-w * 0.44, top * 1.12, w * 0.44, top * 1.12, w * 0.5, -hh * 0.04);
            ctx.bezierCurveTo(w * 0.42, bot * 1.1, -w * 0.42, bot * 1.1, -w * 0.5, 0);
            ctx.closePath();
        };
        shape(); ctx.fillStyle = '#ffffff'; ctx.fill();
        ctx.save(); shape(); ctx.clip();
        // Радужка смотрит вправо, на воду
        const ix = w * 0.1, iy = hh * 0.04, ir = hh * 0.4 * k;
        const g = ctx.createRadialGradient(ix, iy + ir * 0.35, ir * 0.1, ix, iy, ir);
        g.addColorStop(0, d(U.shade(C.iris, 0.45)));
        g.addColorStop(0.6, d(C.iris));
        g.addColorStop(1, d(U.shade(C.iris, -0.45)));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(ix, iy, ir, 0, TAU); ctx.fill();
        ctx.fillStyle = '#1b1620';
        ctx.beginPath(); ctx.arc(ix + ir * 0.06, iy + ir * 0.05, ir * 0.45, 0, TAU); ctx.fill();
        // Тень от века сверху
        ctx.fillStyle = 'rgba(60,40,60,0.18)';
        ctx.fillRect(-w, top * 1.2, w * 2, hh * 0.28);
        ctx.restore();
        // Блики
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.ellipse(ix - ir * 0.32, iy - ir * 0.36, ir * 0.3, ir * 0.24, -0.5, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(ix + ir * 0.38, iy + ir * 0.4, ir * 0.13, 0, TAU); ctx.fill();
        // Верхнее веко с «хвостиком» у внешнего уголка
        ctx.strokeStyle = OL; ctx.lineWidth = lid;
        ctx.beginPath();
        ctx.moveTo(-w * 0.52, hh * 0.02);
        ctx.bezierCurveTo(-w * 0.44, top * 1.14, w * 0.44, top * 1.14, w * 0.52, -hh * 0.04);
        ctx.stroke();
        ctx.beginPath(); ctx.moveTo(outer * w * 0.5, outer > 0 ? -hh * 0.04 : hh * 0.02); ctx.lineTo(outer * w * 0.64, -hh * 0.14); ctx.stroke();
        // Нижнее веко — тонкое, только у внешнего края
        ctx.strokeStyle = U.rgba(OL, 0.45); ctx.lineWidth = lid * 0.45;
        ctx.beginPath();
        if (outer > 0) { ctx.moveTo(w * 0.05, bot * 0.98); ctx.quadraticCurveTo(w * 0.4, bot * 0.8, w * 0.5, -hh * 0.02); }
        else { ctx.moveTo(-w * 0.05, bot * 0.98); ctx.quadraticCurveTo(-w * 0.4, bot * 0.8, -w * 0.5, 0); }
        ctx.stroke();
        if (C.lashes) {
            ctx.strokeStyle = OL; ctx.lineWidth = lid * 0.75;
            [[0.38, -0.5, 0.58, -0.78], [0.5, -0.32, 0.74, -0.5], [0.22, -0.56, 0.32, -0.86]].forEach(([a, b, c, e]) => {
                ctx.beginPath(); ctx.moveTo(outer * w * a, hh * b); ctx.quadraticCurveTo(outer * w * (a + c) / 2, hh * b * 1.3, outer * w * c, hh * e); ctx.stroke();
            });
        }
        if (face === 'sad') {
            ctx.fillStyle = 'rgba(140,205,255,0.9)';
            ctx.beginPath(); ctx.moveTo(w * 0.15, bot * 1.1); ctx.quadraticCurveTo(w * 0.3, bot * 1.7, w * 0.15, bot * 1.9); ctx.quadraticCurveTo(0, bot * 1.7, w * 0.15, bot * 1.1); ctx.fill();
        }
        ctx.restore();
    }

    // Бровь-мазок: толстая у переносицы, тонкая к виску
    function brow(ctx, x, y, w, inner, tilt, color, thick) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(tilt * inner);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(inner * w * 0.5, w * 0.06);
        ctx.quadraticCurveTo(0, -w * 0.2 * thick, -inner * w * 0.5, -w * 0.02);
        ctx.quadraticCurveTo(0, -w * 0.06, inner * w * 0.5, w * 0.06 + w * 0.12 * thick);
        ctx.closePath(); ctx.fill();
        ctx.restore();
    }

    function nose(ctx, R, C, d) {
        ctx.fillStyle = d(C.skin);
        ctx.beginPath();
        ctx.moveTo(0.9 * R, 0.08 * R);
        ctx.bezierCurveTo(1.0 * R, 0.16 * R, 1.08 * R, 0.25 * R, 1.06 * R, 0.31 * R);
        ctx.bezierCurveTo(1.04 * R, 0.37 * R, 0.96 * R, 0.38 * R, 0.9 * R, 0.36 * R);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = OL; ctx.lineWidth = Math.max(1.2, R * 0.045);
        ctx.beginPath();
        ctx.moveTo(0.94 * R, 0.13 * R);
        ctx.bezierCurveTo(1.01 * R, 0.19 * R, 1.08 * R, 0.25 * R, 1.06 * R, 0.31 * R);
        ctx.bezierCurveTo(1.04 * R, 0.37 * R, 0.97 * R, 0.38 * R, 0.92 * R, 0.355 * R);
        ctx.stroke();
        ctx.strokeStyle = U.rgba(OL, 0.5); ctx.lineWidth = Math.max(1, R * 0.03);
        ctx.beginPath(); ctx.arc(0.9 * R, 0.31 * R, 0.05 * R, -0.3, 1.6); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath(); ctx.ellipse(0.97 * R, 0.22 * R, 0.03 * R, 0.02 * R, 0.6, 0, TAU); ctx.fill();
    }

    function ear(ctx, R, C, d) {
        const x = -0.42 * R, y = 0.14 * R;
        ctx.fillStyle = d(C.skin); ctx.strokeStyle = OL; ctx.lineWidth = Math.max(1.2, R * 0.045);
        ctx.beginPath();
        ctx.moveTo(x + 0.08 * R, y - 0.2 * R);
        ctx.bezierCurveTo(x - 0.16 * R, y - 0.28 * R, x - 0.24 * R, y + 0.12 * R, x - 0.06 * R, y + 0.24 * R);
        ctx.quadraticCurveTo(x + 0.06 * R, y + 0.3 * R, x + 0.1 * R, y + 0.16 * R);
        ctx.stroke(); ctx.fill();
        ctx.fillStyle = d(C.shade);
        ctx.beginPath(); ctx.ellipse(x - 0.03 * R, y + 0.01 * R, 0.07 * R, 0.12 * R, 0.15, 0, TAU); ctx.fill();
        ctx.strokeStyle = U.rgba('#b06a50', 0.8); ctx.lineWidth = Math.max(1, R * 0.03);
        ctx.beginPath(); ctx.arc(x - 0.01 * R, y, 0.09 * R, -2.2, 1.2); ctx.stroke();
    }

    function mouth(ctx, R, face, C, d) {
        const mx = 0.55 * R, my = 0.6 * R;
        const line = Math.max(1.2, R * 0.045);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        if (C.beard && face !== 'happy' && face !== 'strain') return;
        if (face === 'happy') {
            const m = () => {
                ctx.beginPath();
                ctx.moveTo(mx - 0.22 * R, my - 0.06 * R);
                ctx.quadraticCurveTo(mx, my - 0.02 * R, mx + 0.24 * R, my - 0.08 * R);
                ctx.quadraticCurveTo(mx + 0.16 * R, my + 0.3 * R, mx - 0.02 * R, my + 0.28 * R);
                ctx.quadraticCurveTo(mx - 0.18 * R, my + 0.22 * R, mx - 0.22 * R, my - 0.06 * R);
                ctx.closePath();
            };
            m(); ctx.fillStyle = '#7a2833'; ctx.fill();
            ctx.save(); m(); ctx.clip();
            ctx.fillStyle = '#ff8a94';
            ctx.beginPath(); ctx.ellipse(mx + 0.0 * R, my + 0.26 * R, 0.14 * R, 0.1 * R, 0, 0, TAU); ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(mx - 0.25 * R, my - 0.12 * R, 0.5 * R, 0.1 * R);
            ctx.restore();
            m(); ctx.strokeStyle = OL; ctx.lineWidth = line; ctx.stroke();
        } else if (face === 'strain') {
            ctx.fillStyle = '#ffffff'; ctx.strokeStyle = OL; ctx.lineWidth = line;
            ctx.beginPath(); ctx.roundRect(mx - 0.18 * R, my - 0.06 * R, 0.36 * R, 0.15 * R, 0.06 * R); ctx.fill(); ctx.stroke();
            ctx.lineWidth = line * 0.6;
            ctx.beginPath(); ctx.moveTo(mx - 0.18 * R, my + 0.015 * R); ctx.lineTo(mx + 0.18 * R, my + 0.015 * R);
            for (let i = -1; i <= 1; i++) { ctx.moveTo(mx + i * 0.09 * R, my - 0.06 * R); ctx.lineTo(mx + i * 0.09 * R, my + 0.09 * R); }
            ctx.stroke();
        } else if (face === 'sad') {
            ctx.strokeStyle = OL; ctx.lineWidth = line;
            ctx.beginPath(); ctx.moveTo(mx - 0.14 * R, my + 0.08 * R); ctx.quadraticCurveTo(mx, my - 0.04 * R, mx + 0.15 * R, my + 0.06 * R); ctx.stroke();
        } else if (face === 'focus') {
            ctx.fillStyle = '#7a2833';
            ctx.beginPath(); ctx.ellipse(mx + 0.02 * R, my + 0.02 * R, 0.06 * R, 0.05 * R, 0, 0, TAU); ctx.fill();
            ctx.strokeStyle = OL; ctx.lineWidth = line * 0.8; ctx.stroke();
        } else {
            // Спокойная улыбка с ямочкой в уголке
            ctx.strokeStyle = OL; ctx.lineWidth = line;
            ctx.beginPath(); ctx.moveTo(mx - 0.16 * R, my - 0.02 * R); ctx.quadraticCurveTo(mx + 0.02 * R, my + 0.13 * R, mx + 0.18 * R, my - 0.03 * R); ctx.stroke();
            ctx.lineWidth = line * 0.7;
            ctx.beginPath(); ctx.moveTo(mx - 0.19 * R, my - 0.05 * R); ctx.quadraticCurveTo(mx - 0.17 * R, my - 0.01 * R, mx - 0.14 * R, my + 0.0 * R); ctx.stroke();
            ctx.strokeStyle = 'rgba(200,90,90,0.35)'; ctx.lineWidth = line * 0.9;
            ctx.beginPath(); ctx.moveTo(mx - 0.06 * R, my + 0.1 * R); ctx.quadraticCurveTo(mx + 0.02 * R, my + 0.13 * R, mx + 0.08 * R, my + 0.1 * R); ctx.stroke();
        }
    }

    // ---------- Волосы ----------
    function hairBack(ctx, R, C, d) {
        if (!C.ponytail) return;
        const hair = d(C.hair), dark = d(U.shade(C.hair, -0.3));
        ctx.lineJoin = 'round';
        // Длинные волосы за головой
        ctx.fillStyle = hair; ctx.strokeStyle = OL; ctx.lineWidth = Math.max(1.2, R * 0.05);
        ctx.beginPath();
        ctx.moveTo(-0.3 * R, -0.95 * R);
        ctx.bezierCurveTo(-1.15 * R, -0.85 * R, -1.15 * R, 0.3 * R, -0.85 * R, 0.62 * R);
        ctx.quadraticCurveTo(-0.6 * R, 0.78 * R, -0.35 * R, 0.62 * R);
        ctx.lineTo(-0.2 * R, -0.5 * R);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        // Хвостик
        ctx.beginPath();
        ctx.moveTo(-0.85 * R, -0.42 * R);
        ctx.bezierCurveTo(-1.55 * R, -0.55 * R, -1.75 * R, 0.4 * R, -1.32 * R, 1.08 * R);
        ctx.quadraticCurveTo(-1.38 * R, 0.62 * R, -1.18 * R, 0.4 * R);
        ctx.quadraticCurveTo(-1.32 * R, 0.85 * R, -1.08 * R, 1.0 * R);
        ctx.bezierCurveTo(-1.05 * R, 0.5 * R, -0.98 * R, 0.0 * R, -0.72 * R, -0.18 * R);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = dark; ctx.lineWidth = R * 0.04; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-1.0 * R, -0.35 * R); ctx.quadraticCurveTo(-1.42 * R, 0.1 * R, -1.3 * R, 0.8 * R); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-0.95 * R, -0.2 * R); ctx.quadraticCurveTo(-1.2 * R, 0.25 * R, -1.15 * R, 0.7 * R); ctx.stroke();
        ctx.strokeStyle = d(U.shade(C.hair, 0.35)); ctx.lineWidth = R * 0.05;
        ctx.beginPath(); ctx.moveTo(-1.25 * R, -0.3 * R); ctx.quadraticCurveTo(-1.5 * R, 0.0, -1.48 * R, 0.3 * R); ctx.stroke();
        // Резинка-бантик
        ctx.fillStyle = '#ff5a8a'; ctx.strokeStyle = OL; ctx.lineWidth = Math.max(1.2, R * 0.045);
        ctx.beginPath(); ctx.ellipse(-0.92 * R, -0.42 * R, 0.1 * R, 0.16 * R, 0.5, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(-0.8 * R, -0.52 * R, 0.08 * R, 0.12 * R, -0.6, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(-0.95 * R, -0.46 * R, 0.025 * R, 0, TAU); ctx.fill();
    }

    // Прядь-лепесток: от корня (rx, ry) к кончику (tx, ty) с изгибом bend
    function lock(ctx, R, rx, ry, tx, ty, wdt, bend) {
        const nx = (ty - ry), ny = -(tx - rx), len = Math.hypot(nx, ny) || 1;
        const ox = nx / len * wdt * R, oy = ny / len * wdt * R;
        const mx = (rx + tx) / 2 * R + bend * R, my = (ry + ty) / 2 * R;
        ctx.moveTo(rx * R + ox, ry * R + oy);
        ctx.quadraticCurveTo(mx + ox * 0.7, my + oy * 0.7, tx * R, ty * R);
        ctx.quadraticCurveTo(mx - ox * 0.7, my - oy * 0.7, rx * R - ox, ry * R - oy);
    }

    function hairFront(ctx, R, C, d, who) {
        const hair = d(C.hair), dark = d(U.shade(C.hair, -0.3)), light = d(U.shade(C.hair, 0.4));
        const line = Math.max(1.2, R * 0.045);
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        if (who === 'grandpa') {
            // Седые пушистые височки (макушка под шапкой)
            ctx.fillStyle = hair; ctx.strokeStyle = OL; ctx.lineWidth = line;
            ctx.beginPath();
            ctx.moveTo(-0.62 * R, -0.42 * R);
            ctx.quadraticCurveTo(-1.05 * R, -0.35 * R, -0.98 * R, 0.05 * R);
            ctx.quadraticCurveTo(-1.08 * R, 0.2 * R, -0.9 * R, 0.4 * R);
            ctx.quadraticCurveTo(-0.85 * R, 0.55 * R, -0.66 * R, 0.5 * R);
            ctx.quadraticCurveTo(-0.6 * R, 0.25 * R, -0.36 * R, 0.24 * R);
            ctx.quadraticCurveTo(-0.5 * R, 0.0, -0.3 * R, -0.3 * R);
            ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0.62 * R, -0.5 * R);
            ctx.quadraticCurveTo(0.9 * R, -0.42 * R, 0.88 * R, -0.18 * R);
            ctx.quadraticCurveTo(0.76 * R, -0.3 * R, 0.6 * R, -0.3 * R);
            ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.strokeStyle = d('#c8ccd6'); ctx.lineWidth = R * 0.03;
            [[-0.8, -0.2, -0.7, 0.1], [-0.85, 0.15, -0.72, 0.38]].forEach(([a, b, c, e]) => { ctx.beginPath(); ctx.moveTo(a * R, b * R); ctx.lineTo(c * R, e * R); ctx.stroke(); });
            return;
        }
        // Основная масса волос: затылок, макушка и висок
        ctx.fillStyle = hair; ctx.strokeStyle = OL; ctx.lineWidth = line;
        ctx.beginPath();
        ctx.moveTo(-0.55 * R, 0.62 * R);
        ctx.bezierCurveTo(-1.12 * R, 0.35 * R, -1.12 * R, -0.62 * R, -0.42 * R, -0.95 * R);
        ctx.bezierCurveTo(0.08 * R, -1.18 * R, 0.86 * R, -1.0 * R, 0.98 * R, -0.38 * R);
        ctx.quadraticCurveTo(0.6 * R, -0.62 * R, 0.1 * R, -0.58 * R);
        ctx.quadraticCurveTo(-0.22 * R, -0.5 * R, -0.24 * R, -0.12 * R);
        ctx.quadraticCurveTo(-0.24 * R, 0.12 * R, -0.18 * R, 0.3 * R);   // висок перед ухом
        ctx.quadraticCurveTo(-0.32 * R, 0.2 * R, -0.36 * R, 0.0 * R);
        ctx.quadraticCurveTo(-0.5 * R, 0.25 * R, -0.55 * R, 0.62 * R);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        // Чёлка из прядей, зачёсанных вправо
        const locks = who === 'girl'
            ? [[0.2, -0.85, 0.98, -0.02, 0.17, 0.08], [0.0, -0.85, 0.7, -0.1, 0.16, 0.06], [-0.15, -0.8, 0.42, -0.22, 0.15, 0.05], [-0.2, -0.7, 0.12, -0.25, 0.12, 0.0]]
            : [[0.3, -0.85, 1.02, -0.22, 0.15, 0.1], [0.1, -0.88, 0.78, -0.12, 0.15, 0.08], [-0.05, -0.85, 0.5, -0.2, 0.14, 0.06], [-0.18, -0.8, 0.24, -0.16, 0.13, 0.03], [-0.25, -0.7, -0.02, -0.26, 0.1, 0.0]];
        locks.forEach(([rx, ry, tx, ty, w, bend]) => {
            ctx.beginPath(); lock(ctx, R, rx, ry, tx, ty, w, bend); ctx.closePath();
            ctx.fillStyle = hair; ctx.fill();
            ctx.strokeStyle = OL; ctx.lineWidth = line; ctx.stroke();
        });
        // Тонкие прядки внутри и блики
        ctx.strokeStyle = dark; ctx.lineWidth = Math.max(1, R * 0.028);
        locks.forEach(([rx, ry, tx, ty]) => {
            ctx.beginPath(); ctx.moveTo(U.lerp(rx, tx, 0.25) * R, U.lerp(ry, ty, 0.25) * R); ctx.quadraticCurveTo(U.lerp(rx, tx, 0.55) * R + 0.04 * R, U.lerp(ry, ty, 0.55) * R, U.lerp(rx, tx, 0.8) * R, U.lerp(ry, ty, 0.8) * R); ctx.stroke();
        });
        [[-0.75, -0.55, -0.88, 0.1], [-0.45, -0.85, -0.72, -0.35]].forEach(([a, b, c, e]) => { ctx.beginPath(); ctx.moveTo(a * R, b * R); ctx.quadraticCurveTo((a + c) / 2 * R - 0.1 * R, (b + e) / 2 * R, c * R, e * R); ctx.stroke(); });
        ctx.strokeStyle = light; ctx.lineWidth = R * 0.06;
        ctx.beginPath(); ctx.arc(-0.12 * R, -0.25 * R, 0.66 * R, -2.55, -2.2); ctx.stroke();
        ctx.beginPath(); ctx.arc(-0.12 * R, -0.25 * R, 0.66 * R, -2.08, -1.9); ctx.stroke();
        if (who === 'boy') {
            // Вихор на макушке
            ctx.fillStyle = hair; ctx.strokeStyle = OL; ctx.lineWidth = line;
            ctx.beginPath(); ctx.moveTo(-0.28 * R, -1.0 * R); ctx.quadraticCurveTo(-0.3 * R, -1.28 * R, -0.05 * R, -1.3 * R); ctx.quadraticCurveTo(-0.18 * R, -1.15 * R, -0.05 * R, -1.04 * R); ctx.closePath(); ctx.fill(); ctx.stroke();
        }
    }

    function beard(ctx, R, face, d) {
        const line = Math.max(1.2, R * 0.045);
        ctx.fillStyle = d('#f4f5f8'); ctx.strokeStyle = OL; ctx.lineWidth = line; ctx.lineJoin = 'round';
        // Пушистая борода волнами
        ctx.beginPath();
        ctx.moveTo(-0.36 * R, 0.2 * R);
        ctx.quadraticCurveTo(-0.46 * R, 0.55 * R, -0.3 * R, 0.78 * R);
        ctx.quadraticCurveTo(-0.22 * R, 1.0 * R, 0.0, 0.98 * R);
        ctx.quadraticCurveTo(0.12 * R, 1.18 * R, 0.32 * R, 1.06 * R);
        ctx.quadraticCurveTo(0.5 * R, 1.2 * R, 0.66 * R, 1.0 * R);
        ctx.quadraticCurveTo(0.9 * R, 0.96 * R, 0.92 * R, 0.68 * R);
        ctx.quadraticCurveTo(1.02 * R, 0.52 * R, 0.9 * R, 0.42 * R);
        ctx.quadraticCurveTo(0.72 * R, 0.62 * R, 0.5 * R, 0.56 * R);
        ctx.quadraticCurveTo(0.18 * R, 0.62 * R, -0.02 * R, 0.42 * R);
        ctx.quadraticCurveTo(-0.16 * R, 0.3 * R, -0.36 * R, 0.2 * R);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = d('#c6cad4'); ctx.lineWidth = R * 0.03; ctx.lineCap = 'round';
        [[-0.2, 0.55, -0.12, 0.8], [0.1, 0.7, 0.16, 0.95], [0.4, 0.72, 0.42, 0.98], [0.66, 0.66, 0.68, 0.88]].forEach(([a, b, c, e]) => { ctx.beginPath(); ctx.moveTo(a * R, b * R); ctx.quadraticCurveTo((a + c) / 2 * R + 0.04 * R, (b + e) / 2 * R, c * R, e * R); ctx.stroke(); });
        // Рот в бороде (когда смеётся или тужится)
        if (face === 'happy' || face === 'strain') {
            ctx.fillStyle = '#7a2833';
            ctx.beginPath(); ctx.ellipse(0.52 * R, 0.72 * R, 0.13 * R, face === 'happy' ? 0.09 * R : 0.05 * R, 0, 0, TAU); ctx.fill();
        }
        // Усы — два завитка
        ctx.fillStyle = d('#ffffff'); ctx.strokeStyle = OL; ctx.lineWidth = line;
        ctx.beginPath();
        ctx.moveTo(0.28 * R, 0.5 * R);
        ctx.bezierCurveTo(0.36 * R, 0.36 * R, 0.62 * R, 0.36 * R, 0.68 * R, 0.44 * R);
        ctx.bezierCurveTo(0.8 * R, 0.4 * R, 0.98 * R, 0.46 * R, 1.0 * R, 0.6 * R);
        ctx.bezierCurveTo(0.9 * R, 0.56 * R, 0.8 * R, 0.6 * R, 0.68 * R, 0.6 * R);
        ctx.bezierCurveTo(0.56 * R, 0.66 * R, 0.4 * R, 0.66 * R, 0.28 * R, 0.5 * R);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = d('#d0d4dc'); ctx.lineWidth = R * 0.025;
        ctx.beginPath(); ctx.moveTo(0.45 * R, 0.48 * R); ctx.lineTo(0.55 * R, 0.56 * R); ctx.moveTo(0.78 * R, 0.5 * R); ctx.lineTo(0.88 * R, 0.56 * R); ctx.stroke();
    }

    function glasses(ctx, R, e1, e2) {
        ctx.strokeStyle = '#5a3a2a'; ctx.lineWidth = Math.max(1.2, R * 0.04);
        ctx.fillStyle = 'rgba(200,230,255,0.18)';
        ctx.beginPath(); ctx.ellipse(e1[0], e1[1], R * 0.21, R * 0.21, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(e2[0], e2[1], R * 0.17, R * 0.2, 0, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(e1[0] + R * 0.21, e1[1] - R * 0.02); ctx.quadraticCurveTo((e1[0] + e2[0]) / 2 + R * 0.02, e1[1] - R * 0.08, e2[0] - R * 0.17, e2[1] - R * 0.02); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(e1[0] - R * 0.21, e1[1]); ctx.lineTo(-0.42 * R, 0.0); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = Math.max(1, R * 0.03);
        ctx.beginPath(); ctx.arc(e1[0], e1[1], R * 0.15, -2.6, -1.9); ctx.stroke();
        ctx.beginPath(); ctx.arc(e2[0], e2[1], R * 0.12, -2.6, -1.9); ctx.stroke();
    }

    // part: 'neck' — волосы сзади и шея (под воротником), 'face' — всё остальное
    function head(ctx, o, C, d, part) {
        const h = o.h, R = h * 0.235, face = o.face || 'calm', t = o.t;
        ctx.save();
        ctx.translate(h * 0.07, -h * 0.79 + Math.sin(t * 1.7) * h * 0.007);
        ctx.rotate(face === 'strain' ? -0.06 : face === 'happy' ? 0.05 : 0);
        if (part === 'neck') {
            hairBack(ctx, R, C, d);
            neck(ctx, R, C, d);
            ctx.restore();
            return;
        }
        // Лицо, тени и румянец
        facePath(ctx, R);
        ctx.fillStyle = d(C.skin); ctx.fill();
        ctx.save();
        facePath(ctx, R); ctx.clip();
        ctx.fillStyle = d(C.shade);
        ctx.beginPath(); ctx.ellipse(-0.9 * R, 0.15 * R, 0.5 * R, 1.15 * R, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(0.25 * R, 1.05 * R, 0.75 * R, 0.2 * R, 0, 0, TAU); ctx.fill();
        if (o.hat) { ctx.fillStyle = U.rgba(C.shade, 0.75); ctx.beginPath(); ctx.ellipse(0.2 * R, -0.55 * R, 1.2 * R, 0.24 * R, -0.05, 0, TAU); ctx.fill(); }
        const blush = (x, y, rx) => {
            const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
            g.addColorStop(0, 'rgba(255,105,115,0.42)'); g.addColorStop(1, 'rgba(255,105,115,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, rx, rx * 0.65, 0, 0, TAU); ctx.fill();
        };
        blush(0.0, 0.42 * R, 0.24 * R);
        blush(0.78 * R, 0.42 * R, 0.17 * R);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath(); ctx.ellipse(0.76 * R, 0.2 * R, 0.07 * R, 0.04 * R, -0.4, 0, TAU); ctx.fill();
        if (C.freckles) {
            ctx.fillStyle = 'rgba(185,105,65,0.6)';
            [[-0.04, 0.32], [0.06, 0.37], [-0.1, 0.4], [0.02, 0.44], [0.7, 0.33], [0.78, 0.37], [0.72, 0.41]].forEach(([px, py]) => { ctx.beginPath(); ctx.arc(px * R, py * R, R * 0.02, 0, TAU); ctx.fill(); });
        }
        if (C.wrinkles) {
            ctx.strokeStyle = U.rgba('#b07a5a', 0.6); ctx.lineWidth = Math.max(1, R * 0.025);
            ctx.beginPath(); ctx.moveTo(0.82 * R, 0.0); ctx.quadraticCurveTo(0.88 * R, -0.03 * R, 0.9 * R, 0.04 * R); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-0.22 * R, 0.1 * R); ctx.quadraticCurveTo(-0.26 * R, 0.04 * R, -0.24 * R, -0.02 * R); ctx.stroke();
        }
        if (o.rich) {
            const g = ctx.createRadialGradient(0.45 * R, -0.35 * R, 0.1 * R, 0.1 * R, 0.1 * R, 1.3 * R);
            g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(120,40,60,0.18)');
            ctx.fillStyle = g; ctx.fillRect(-1.5 * R, -1.5 * R, 3 * R, 3 * R);
        }
        ctx.restore();
        if (o.rich) {
            ctx.save(); ctx.shadowColor = 'rgba(60,20,40,0.35)'; ctx.shadowBlur = R * 0.25; ctx.shadowOffsetY = R * 0.08;
            facePath(ctx, R); ctx.strokeStyle = OL; ctx.lineWidth = Math.max(1.4, R * 0.055); ctx.stroke(); ctx.restore();
            ctx.save(); facePath(ctx, R); ctx.clip();
            ctx.strokeStyle = 'rgba(255,240,220,0.8)'; ctx.lineWidth = R * 0.07;
            ctx.beginPath(); ctx.moveTo(0.92 * R, -0.5 * R); ctx.bezierCurveTo(1.0 * R, -0.2 * R, 0.98 * R, 0.0, 0.94 * R, 0.1 * R); ctx.stroke();
            ctx.restore();
        }
        facePath(ctx, R);
        ctx.strokeStyle = OL; ctx.lineWidth = Math.max(1.4, R * 0.055); ctx.stroke();
        nose(ctx, R, C, d);
        // Глаза и брови
        const e1 = [0.12 * R, 0.06 * R], e2 = [0.64 * R, 0.04 * R];
        eye(ctx, e1[0], e1[1], R * 0.3, R * 0.36, C, face, false, t, d);
        eye(ctx, e2[0], e2[1], R * 0.23, R * 0.34, C, face, true, t, d);
        const browColor = d(C.beard ? '#dfe2e8' : U.shade(C.hair, -0.12));
        const tilt = face === 'sad' ? -0.22 : face === 'strain' ? 0.25 : face === 'focus' ? 0.12 : 0;
        const lift = face === 'happy' ? -0.06 * R : face === 'sad' ? -0.03 * R : 0;
        const thick = C.beard ? 1.8 : 1;
        brow(ctx, e1[0], e1[1] - 0.3 * R + lift, 0.34 * R, 1, tilt, browColor, thick);
        brow(ctx, e2[0] + 0.02 * R, e2[1] - 0.29 * R + lift, 0.26 * R, -1, -tilt, browColor, thick);
        mouth(ctx, R, face, C, d);
        if (C.beard) beard(ctx, R, face, d);
        if (C.glasses) glasses(ctx, R, e1, e2);
        hairFront(ctx, R, C, d, o.who);
        ear(ctx, R, C, d);
        drawHat(ctx, o.hat, R, d);
        // Капля пота, когда тяжело
        if (face === 'strain') {
            const k = (t * 0.9) % 1;
            ctx.fillStyle = 'rgba(150,215,255,0.95)'; ctx.strokeStyle = U.rgba('#3a7ab8', 0.6); ctx.lineWidth = Math.max(1, R * 0.025);
            const sx = -0.2 * R, sy = -0.15 * R + k * R * 0.35;
            ctx.beginPath(); ctx.moveTo(sx, sy - 0.1 * R); ctx.quadraticCurveTo(sx + 0.07 * R, sy, sx, sy + 0.05 * R); ctx.quadraticCurveTo(sx - 0.07 * R, sy, sx, sy - 0.1 * R); ctx.fill(); ctx.stroke();
        }
        ctx.restore();
    }

    // ---------- Шапки (голова в 3/4, козырёк вправо) ----------
    function drawHat(ctx, hat, R, d) {
        if (!hat) return;
        const a = d(hat.c.a), b = d(hat.c.b);
        const line = Math.max(1.3, R * 0.05);
        ctx.lineWidth = line; ctx.strokeStyle = OL; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        const dome = (w, top, low) => {
            ctx.beginPath();
            ctx.moveTo(-R * w, -R * low);
            ctx.bezierCurveTo(-R * w * 1.02, -R * (top + 0.22), R * w * 0.88, -R * (top + 0.26), R * w * 0.96, -R * (low + 0.1));
            ctx.quadraticCurveTo(0, -R * (low - 0.14), -R * w, -R * low);
            ctx.closePath();
        };
        const shine = (x, y) => { ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.ellipse(R * (x || -0.3), R * (y || -0.86), R * 0.28, R * 0.1, -0.35, 0, TAU); ctx.fill(); };
        const shadeIn = (fn) => { ctx.save(); fn(); ctx.clip(); ctx.fillStyle = 'rgba(40,20,40,0.16)'; ctx.beginPath(); ctx.ellipse(-R * 1.0, -R * 0.6, R * 0.5, R * 0.8, 0, 0, TAU); ctx.fill(); ctx.restore(); };
        switch (hat.id) {
            case 'hat_panama':
            case 'hat_straw': {
                const wide = hat.id === 'hat_straw' ? 1.68 : 1.4;
                const brim = () => { ctx.beginPath(); ctx.ellipse(R * 0.08, -R * 0.44, R * wide, R * 0.28, -0.07, 0, TAU); };
                brim(); ctx.fillStyle = a; ctx.fill();
                ctx.save(); brim(); ctx.clip(); ctx.fillStyle = 'rgba(40,20,40,0.14)'; ctx.fillRect(-R * 2, -R * 0.44, R * 4, R * 0.4); ctx.restore();
                brim(); ctx.stroke();
                dome(0.84, 1.02, 0.46); ctx.fillStyle = a; ctx.fill();
                shadeIn(() => dome(0.84, 1.02, 0.46));
                dome(0.84, 1.02, 0.46); ctx.stroke();
                ctx.fillStyle = b;
                ctx.beginPath(); ctx.moveTo(-R * 0.84, -R * 0.53); ctx.quadraticCurveTo(0, -R * 0.42, R * 0.8, -R * 0.62); ctx.lineTo(R * 0.79, -R * 0.75); ctx.quadraticCurveTo(0, -R * 0.57, -R * 0.83, -R * 0.68); ctx.closePath(); ctx.fill();
                ctx.strokeStyle = U.rgba(OL, 0.5); ctx.lineWidth = line * 0.6; ctx.stroke();
                if (hat.id === 'hat_straw') {
                    ctx.strokeStyle = U.rgba('#a07a32', 0.5); ctx.lineWidth = R * 0.025;
                    for (let i = -7; i <= 7; i++) { ctx.beginPath(); ctx.moveTo(R * i * 0.21, -R * 0.56); ctx.lineTo(R * i * 0.23 + R * 0.08, -R * 0.28); ctx.stroke(); }
                    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(0, -R * 0.75, R * (0.3 + i * 0.13), R * 0.06 * (1 + i * 0.3), 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); }
                    ctx.strokeStyle = U.rgba('#a07a32', 0.9); ctx.lineWidth = R * 0.02;
                    for (let i = 0; i < 9; i++) { const ax = -R * 1.5 + i * R * 0.38; ctx.beginPath(); ctx.moveTo(ax, -R * 0.25); ctx.lineTo(ax + R * 0.02, -R * 0.17); ctx.stroke(); }
                } else {
                    ctx.strokeStyle = U.rgba(OL, 0.25); ctx.lineWidth = R * 0.02;
                    ctx.setLineDash([R * 0.05, R * 0.04]);
                    ctx.beginPath(); ctx.ellipse(R * 0.08, -R * 0.44, R * (wide - 0.12), R * 0.2, -0.07, Math.PI * 0.05, Math.PI * 0.95); ctx.stroke();
                    ctx.setLineDash([]);
                }
                shine(-0.3, -0.92);
                break;
            }
            case 'hat_beanie': {
                dome(1.05, 1.12, 0.3); ctx.fillStyle = a; ctx.fill();
                ctx.save(); dome(1.05, 1.12, 0.3); ctx.clip();
                ctx.strokeStyle = U.rgba(OL, 0.18); ctx.lineWidth = R * 0.05;
                for (let i = -4; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(R * i * 0.24, -R * 0.35); ctx.quadraticCurveTo(R * i * 0.22, -R * 0.8, R * i * 0.12, -R * 1.25); ctx.stroke(); }
                ctx.fillStyle = 'rgba(40,20,40,0.15)'; ctx.beginPath(); ctx.ellipse(-R * 1.05, -R * 0.6, R * 0.45, R * 0.8, 0, 0, TAU); ctx.fill();
                ctx.restore();
                dome(1.05, 1.12, 0.3); ctx.strokeStyle = OL; ctx.lineWidth = line; ctx.stroke();
                ctx.fillStyle = b;
                ctx.beginPath(); ctx.roundRect(-R * 1.08, -R * 0.52, R * 2.1, R * 0.32, R * 0.13); ctx.fill(); ctx.stroke();
                ctx.strokeStyle = U.rgba(OL, 0.18); ctx.lineWidth = R * 0.03;
                for (let i = -9; i <= 9; i++) { ctx.beginPath(); ctx.moveTo(R * i * 0.11, -R * 0.49); ctx.lineTo(R * i * 0.11, -R * 0.23); ctx.stroke(); }
                // Помпон-пушок
                const puffs = [[0, 0, 0.17], [-0.12, 0.04, 0.12], [0.12, 0.04, 0.12], [-0.06, -0.11, 0.12], [0.08, -0.1, 0.12], [0, 0.1, 0.12]];
                const px = -R * 0.08, py = -R * 1.3;
                ctx.strokeStyle = OL; ctx.lineWidth = line * 2;
                puffs.forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(px + x * R, py + y * R, r * R, 0, TAU); ctx.stroke(); });
                ctx.fillStyle = b;
                puffs.forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(px + x * R, py + y * R, r * R, 0, TAU); ctx.fill(); });
                ctx.fillStyle = 'rgba(40,20,40,0.12)';
                ctx.beginPath(); ctx.arc(px + 0.04 * R, py + 0.06 * R, 0.13 * R, 0, TAU); ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.6)';
                ctx.beginPath(); ctx.arc(px - 0.06 * R, py - 0.07 * R, 0.05 * R, 0, TAU); ctx.fill();
                shine(-0.35, -0.85);
                break;
            }
            case 'hat_captain': {
                ctx.fillStyle = b;
                ctx.beginPath(); ctx.roundRect(-R * 0.88, -R * 0.68, R * 1.76, R * 0.32, R * 0.06); ctx.fill(); ctx.stroke();
                ctx.fillStyle = a;
                ctx.beginPath(); ctx.ellipse(-R * 0.02, -R * 0.76, R * 1.08, R * 0.3, -0.06, 0, TAU); ctx.fill(); ctx.stroke();
                ctx.strokeStyle = d('#f2c43a'); ctx.lineWidth = R * 0.035;
                ctx.beginPath(); ctx.moveTo(-R * 0.86, -R * 0.42); ctx.quadraticCurveTo(0, -R * 0.36, R * 0.86, -R * 0.44); ctx.stroke();
                ctx.fillStyle = '#1e1e26'; ctx.strokeStyle = OL; ctx.lineWidth = line;
                ctx.beginPath(); ctx.moveTo(R * 0.52, -R * 0.4); ctx.quadraticCurveTo(R * 1.1, -R * 0.44, R * 1.32, -R * 0.24); ctx.quadraticCurveTo(R * 0.9, -R * 0.22, R * 0.58, -R * 0.27); ctx.closePath(); ctx.fill(); ctx.stroke();
                ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.ellipse(R * 0.95, -R * 0.36, R * 0.15, R * 0.03, 0.1, 0, TAU); ctx.fill();
                ctx.fillStyle = '#f2c43a'; ctx.strokeStyle = OL; ctx.lineWidth = line * 0.7;
                ctx.beginPath(); ctx.moveTo(R * 0.42, -R * 0.66); ctx.lineTo(R * 0.52, -R * 0.52); ctx.lineTo(R * 0.42, -R * 0.42); ctx.lineTo(R * 0.32, -R * 0.52); ctx.closePath(); ctx.fill(); ctx.stroke();
                break;
            }
            case 'hat_crown': {
                const cr = () => {
                    ctx.beginPath();
                    ctx.moveTo(-R * 0.74, -R * 0.62);
                    [[-0.8, -1.3], [-0.38, -0.96], [0.02, -1.44], [0.42, -0.96], [0.82, -1.3], [0.76, -0.62]].forEach(([px, py]) => ctx.lineTo(R * px, R * py));
                    ctx.closePath();
                };
                cr(); ctx.fillStyle = a; ctx.fill();
                ctx.save(); cr(); ctx.clip(); ctx.fillStyle = 'rgba(160,90,0,0.25)'; ctx.fillRect(-R, -R * 0.78, R * 2, R * 0.2); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(-R * 0.62, -R * 1.2, R * 0.12, R * 0.5); ctx.restore();
                cr(); ctx.strokeStyle = OL; ctx.lineWidth = line; ctx.stroke();
                [[-0.38, '#e04a5a'], [0.02, '#3a8ad8'], [0.42, '#3aae6a']].forEach(([k, c]) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(R * k, -R * 0.76, R * 0.09, 0, TAU); ctx.fill(); ctx.lineWidth = line * 0.6; ctx.stroke(); });
                ctx.fillStyle = '#fff6c0';
                [[-0.8, -1.3], [0.02, -1.44], [0.82, -1.3]].forEach(([px, py]) => { ctx.beginPath(); ctx.arc(R * px, R * py, R * 0.06, 0, TAU); ctx.fill(); ctx.stroke(); });
                break;
            }
            case 'hat_pirate': {
                const tri = () => {
                    ctx.beginPath();
                    ctx.moveTo(-R * 1.32, -R * 0.4);
                    ctx.quadraticCurveTo(-R * 0.6, -R * 0.62, -R * 0.36, -R * 1.44);
                    ctx.quadraticCurveTo(R * 0.2, -R * 0.76, R * 1.4, -R * 0.58);
                    ctx.quadraticCurveTo(R * 0.1, -R * 0.2, -R * 1.32, -R * 0.4);
                };
                tri(); ctx.fillStyle = a; ctx.fill();
                ctx.save(); tri(); ctx.clip(); ctx.strokeStyle = d('#c8a040'); ctx.lineWidth = R * 0.06;
                ctx.beginPath(); ctx.moveTo(-R * 1.32, -R * 0.4); ctx.quadraticCurveTo(R * 0.1, -R * 0.2, R * 1.4, -R * 0.58); ctx.stroke(); ctx.restore();
                tri(); ctx.strokeStyle = OL; ctx.lineWidth = line; ctx.stroke();
                ctx.fillStyle = '#f6f6f6';
                ctx.beginPath(); ctx.arc(-R * 0.05, -R * 0.8, R * 0.15, 0, TAU); ctx.fill(); ctx.lineWidth = line * 0.6; ctx.stroke();
                ctx.fillStyle = '#2a2a30';
                ctx.beginPath(); ctx.arc(-R * 0.09, -R * 0.82, R * 0.035, 0, TAU); ctx.arc(R * 0.0, -R * 0.82, R * 0.035, 0, TAU); ctx.fill();
                ctx.strokeStyle = '#f6f6f6'; ctx.lineWidth = R * 0.05;
                ctx.beginPath(); ctx.moveTo(-R * 0.2, -R * 0.6); ctx.lineTo(R * 0.1, -R * 0.52); ctx.moveTo(R * 0.1, -R * 0.6); ctx.lineTo(-R * 0.2, -R * 0.52); ctx.stroke();
                break;
            }
            default: {
                // Кепка: купол из клиньев, кнопка, козырёк с прострочкой
                dome(1.02, 1.1, 0.38); ctx.fillStyle = a; ctx.fill();
                shadeIn(() => dome(1.02, 1.1, 0.38));
                ctx.save(); dome(1.02, 1.1, 0.38); ctx.clip();
                ctx.strokeStyle = U.rgba(OL, 0.35); ctx.lineWidth = Math.max(1, R * 0.03);
                ctx.beginPath(); ctx.moveTo(R * 0.12, -R * 1.12); ctx.quadraticCurveTo(R * 0.38, -R * 0.75, R * 0.42, -R * 0.42); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(R * 0.12, -R * 1.12); ctx.quadraticCurveTo(-R * 0.35, -R * 0.8, -R * 0.58, -R * 0.38); ctx.stroke();
                ctx.strokeStyle = U.rgba('#ffffff', 0.35); ctx.setLineDash([R * 0.04, R * 0.04]);
                ctx.beginPath(); ctx.moveTo(R * 0.17, -R * 1.08); ctx.quadraticCurveTo(R * 0.43, -R * 0.75, R * 0.47, -R * 0.44); ctx.stroke();
                ctx.setLineDash([]);
                ctx.restore();
                dome(1.02, 1.1, 0.38); ctx.strokeStyle = OL; ctx.lineWidth = line; ctx.stroke();
                // Маленькая эмблема-рыбка
                ctx.fillStyle = '#ffffff';
                ctx.beginPath(); ctx.ellipse(R * 0.66, -R * 0.68, R * 0.11, R * 0.06, -0.2, 0, TAU); ctx.fill();
                ctx.beginPath(); ctx.moveTo(R * 0.55, -R * 0.66); ctx.lineTo(R * 0.47, -R * 0.72); ctx.lineTo(R * 0.48, -R * 0.6); ctx.closePath(); ctx.fill();
                const visor = () => { ctx.beginPath(); ctx.moveTo(R * 0.42, -R * 0.48); ctx.quadraticCurveTo(R * 1.26, -R * 0.64, R * 1.52, -R * 0.36); ctx.quadraticCurveTo(R * 1.02, -R * 0.24, R * 0.46, -R * 0.3); ctx.closePath(); };
                visor(); ctx.fillStyle = b; ctx.fill();
                ctx.save(); visor(); ctx.clip(); ctx.fillStyle = 'rgba(40,20,40,0.2)'; ctx.fillRect(0, -R * 0.4, R * 2, R * 0.2); ctx.restore();
                visor(); ctx.strokeStyle = OL; ctx.lineWidth = line; ctx.stroke();
                ctx.strokeStyle = U.rgba('#ffffff', 0.45); ctx.lineWidth = Math.max(1, R * 0.025); ctx.setLineDash([R * 0.04, R * 0.035]);
                ctx.beginPath(); ctx.moveTo(R * 0.55, -R * 0.44); ctx.quadraticCurveTo(R * 1.2, -R * 0.56, R * 1.4, -R * 0.38); ctx.stroke();
                ctx.setLineDash([]);
                ctx.fillStyle = b; ctx.strokeStyle = OL; ctx.lineWidth = line * 0.8;
                ctx.beginPath(); ctx.arc(R * 0.12, -R * 1.13, R * 0.08, 0, TAU); ctx.fill(); ctx.stroke();
                shine(-0.32, -0.88);
            }
        }
    }

    // ---------- Сборка ----------
    HR.back = (ctx, o) => {
        const C = HR.CHARS[o.who] || HR.CHARS.boy;
        const d = o.dim || ((c) => c);
        const h = o.h;
        ctx.save();
        ctx.translate(o.x, o.y);
        if (o.legs !== false) legs(ctx, o, C, d);
        ctx.rotate((o.lean || 0) * 0.12);
        const hand = HR.localHand(o);
        // Дальняя рука — за телом, темнее
        arm(ctx, h, [h * 0.09, -h * 0.47], [hand[0] + h * 0.06, hand[1] - h * 0.035], d(U.shade(o.jacket.c.a, -0.3)), d(U.shade(o.jacket.c.a, -0.42)), d(C.shade), false);
        torso(ctx, o, d);
        head(ctx, o, C, d, 'neck');
        collar(ctx, o, d);
        head(ctx, o, C, d, 'face');
        ctx.restore();
    };
    HR.front = (ctx, o) => {
        const C = HR.CHARS[o.who] || HR.CHARS.boy;
        const d = o.dim || ((c) => c);
        const h = o.h;
        ctx.save();
        ctx.translate(o.x, o.y);
        ctx.rotate((o.lean || 0) * 0.12);
        arm(ctx, h, [-h * 0.02, -h * 0.45], HR.localHand(o), d(U.shade(o.jacket.c.a, -0.04)), d(U.shade(o.jacket.c.a, -0.2)), d(C.skin), true);
        ctx.restore();
    };
    // Где руки держат удочку (в своих координатах, от точки, где сидит)
    HR.localHand = (o) => [o.h * (0.3 + (o.lean || 0) * 0.06), -o.h * (0.27 - (o.lean || 0) * 0.02)];
})(window.FB);
