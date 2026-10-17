// softhero.js — черновик стиля «мягкий объём + свет» для страниц с набросками.
// Если стиль утвердим, перенесу это в js/view/ игры.
//
// softHero(ctx, P, o) — рыбак (сидит на мостках, смотрит вправо).
//   P — цвета, o.who — boy | girl | grandpa, o.flat — без переливов (для силуэта),
//   o.outline — цветной контур (тёмный оттенок своего цвета).
// lit(ctx, draw, P, o, light) — рисует рыбака со светом: кайма по краю со
//   стороны солнца/луны, свечение, общий оттенок времени суток, тень с
//   передней стороны и тёплое пятно от фонаря.

const U = FB.U, TAU = Math.PI * 2;
const W = 720, H = 540, X = 230, Y = 380, HH = 270;
const off = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };

// ---------- Фоны ----------
const SKIES = { day: ['#6cc4f4', '#d6f1ff'], sunset: ['#3a2a6a', '#ff8a5a'], night: ['#0b1236', '#2a3a78'], dawn: ['#b8b4e0', '#ffd9d0'], rain: ['#7d93a8', '#c4d0da'], fog: ['#c4d0d8', '#eef3f5'] };
const HILLS = { day: '#9fd08a', sunset: '#5a3a6a', night: '#141c44', dawn: '#a6a0cc', rain: '#7f9a86', fog: '#b4c4bc' };
const WATERS = { day: ['#9ad8ea', '#2e8fb4'], sunset: ['#ff9a6a', '#3a2a5a'], night: ['#1e2c64', '#070c26'], dawn: ['#f2d0d8', '#8c8cc0'], rain: ['#a8bcc8', '#46667c'], fog: ['#dce6ea', '#8ea6b2'] };
const SUNS = { sunset: [560, 216, 44, '#fff1c0', 'rgba(255,190,110,'], night: [520, 110, 50, '#fff8dc', 'rgba(200,220,255,'], dawn: [540, 220, 36, '#fff6ee', 'rgba(255,220,230,'] };

function scene(ctx, mood) {
    const hy = H * 0.42;
    let g = ctx.createLinearGradient(0, 0, 0, hy); g.addColorStop(0, SKIES[mood][0]); g.addColorStop(1, SKIES[mood][1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, hy);
    if (mood === 'night') {
        const r = U.seeded(7);
        for (let i = 0; i < 90; i++) { ctx.fillStyle = 'rgba(255,255,255,' + (0.3 + r() * 0.7) + ')'; ctx.beginPath(); ctx.arc(r() * W, r() * hy * 0.9, 0.5 + r() * 1.4, 0, TAU); ctx.fill(); }
    }
    if (mood === 'rain') {
        ctx.fillStyle = '#8c9cac';
        [[120, 60, 1], [420, 40, 1.3], [640, 80, 0.9]].forEach(([x, y, s]) => [[0, 10, 34], [36, -4, 42], [76, 8, 32]].forEach(([dx, dy, r]) => { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, r * s, 0, TAU); ctx.fill(); }));
    }
    const sun = SUNS[mood];
    if (sun) {
        const [sx, sy, sr, col, glow] = sun;
        const sg = ctx.createRadialGradient(sx, sy, sr * 0.3, sx, sy, sr * 4.5);
        sg.addColorStop(0, glow + '0.95)'); sg.addColorStop(0.3, glow + '0.45)'); sg.addColorStop(1, glow + '0)');
        ctx.fillStyle = sg; ctx.fillRect(0, 0, W, hy + 40);
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, TAU); ctx.fill();
        if (mood === 'night') { ctx.fillStyle = 'rgba(200,190,150,0.35)'; [[-14, -10, 12], [12, 12, 9], [6, -20, 6]].forEach(([dx, dy, r]) => { ctx.beginPath(); ctx.arc(sx + dx, sy + dy, r, 0, TAU); ctx.fill(); }); }
    }
    if (mood === 'dawn') { ctx.fillStyle = '#c8c0e4'; ctx.beginPath(); ctx.moveTo(0, hy); for (let x = 0; x <= W; x += 10) ctx.lineTo(x, hy - 40 - 18 * Math.sin(x / 90 + 1)); ctx.lineTo(W, hy); ctx.closePath(); ctx.fill(); }
    ctx.fillStyle = HILLS[mood];
    ctx.beginPath(); ctx.moveTo(0, hy); for (let x = 0; x <= W; x += 10) ctx.lineTo(x, hy - 18 - 10 * Math.sin(x / 60)); ctx.lineTo(W, hy); ctx.fill();
    if (mood === 'fog') { const fg = ctx.createLinearGradient(0, hy - 60, 0, hy + 30); fg.addColorStop(0, 'rgba(238,243,245,0)'); fg.addColorStop(0.6, 'rgba(238,243,245,0.85)'); fg.addColorStop(1, 'rgba(238,243,245,0.3)'); ctx.fillStyle = fg; ctx.fillRect(0, hy - 60, W, 90); }
    g = ctx.createLinearGradient(0, hy, 0, H); g.addColorStop(0, WATERS[mood][0]); g.addColorStop(1, WATERS[mood][1]);
    ctx.fillStyle = g; ctx.fillRect(0, hy, W, H - hy);
    if (sun) {
        const pg = ctx.createLinearGradient(0, hy, 0, H);
        pg.addColorStop(0, sun[4] + '0.7)'); pg.addColorStop(1, sun[4] + '0)');
        ctx.fillStyle = pg; ctx.beginPath(); ctx.moveTo(sun[0] - 20, hy); ctx.lineTo(sun[0] + 20, hy); ctx.lineTo(sun[0] + 90, H); ctx.lineTo(sun[0] - 60, H); ctx.fill();
    }
    ctx.fillStyle = { day: 'rgba(255,255,255,.5)', sunset: 'rgba(255,220,160,.6)', night: 'rgba(200,220,255,.4)', dawn: 'rgba(255,255,255,.6)', rain: 'rgba(230,240,250,.35)', fog: 'rgba(255,255,255,.35)' }[mood];
    for (let i = 0; i < 18; i++) { const x = (i * 97) % W, y = hy + 20 + (i * 53) % (H - hy - 30); ctx.fillRect(x, y, 16 + (y - hy) * 0.08, 2); }
    if (mood === 'dawn') {
        for (let i = 0; i < 3; i++) { const fg = ctx.createLinearGradient(0, hy - 20 + i * 50, 0, hy + 30 + i * 50); fg.addColorStop(0, 'rgba(255,255,255,0)'); fg.addColorStop(0.5, 'rgba(255,255,255,0.4)'); fg.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = fg; ctx.fillRect(0, hy - 20 + i * 50, W, 50); }
    }
}
function fogOver(ctx) {
    [[Y - 170, 120, 0.35], [Y - 40, 110, 0.4], [Y + 80, 130, 0.5]].forEach(([y, hh, a]) => {
        const g = ctx.createLinearGradient(0, y - hh / 2, 0, y + hh / 2);
        g.addColorStop(0, 'rgba(240,245,248,0)'); g.addColorStop(0.5, 'rgba(240,245,248,' + a + ')'); g.addColorStop(1, 'rgba(240,245,248,0)');
        ctx.fillStyle = g; ctx.fillRect(0, y - hh / 2, W, hh);
    });
}
function rainOver(ctx) {
    ctx.strokeStyle = 'rgba(230,240,255,0.5)'; ctx.lineWidth = 1.2;
    const r = U.seeded(3);
    ctx.beginPath();
    for (let i = 0; i < 160; i++) { const x = r() * W * 1.1, y = r() * H, l = 10 + r() * 14; ctx.moveTo(x, y); ctx.lineTo(x - l * 0.2, y + l); }
    ctx.stroke();
}
// Мостки: доски со швами, торцевая балка с гвоздями, сваи с бликом и отражением.
// Верхний край досок подсвечен светом времени суток — платформа всегда читается
const PIERS = {
    day: { top: '#c8935a', face: '#a06c38', post: '#6e4a26', seam: '#8a5a2e', edge: '#ffe2b0' },
    sunset: { top: '#5e3e5c', face: '#3a2840', post: '#2a1e34', seam: '#43304a', edge: '#ffb070' },
    night: { top: '#3e4a76', face: '#232a4a', post: '#181c36', seam: '#2c3460', edge: '#a8c0f0' },
    rain: { top: '#8a7458', face: '#6a5640', post: '#4e3e2e', seam: '#5e4c38', edge: '#dce8f2' },
    fog: { top: '#bcae98', face: '#a49884', post: '#8e8472', seam: '#a0947e', edge: '#ffffff' },
    dawn: { top: '#9a88b8', face: '#7e6e9e', post: '#665a86', seam: '#7a6a9a', edge: '#fff0f4' }
};
function pier(ctx, mood, sil) {
    const h = HH, end = X + h * 0.22, y = Y;
    const top = y - h * 0.035, faceY = y + h * 0.03, bottom = y + h * 0.11, wy = y + h * 0.42;
    const c = sil ? { top: sil, face: sil, post: sil, seam: sil, edge: null } : (PIERS[mood] || PIERS.day);
    // Сваи
    [end - h * 0.1, end - h * 0.92, end - h * 1.74].forEach(px => {
        if (px < -h * 0.1) return;
        const pw = h * 0.075;
        ctx.fillStyle = c.post; ctx.fillRect(px - pw / 2, bottom - 2, pw, wy - bottom + 2);
        if (!sil) {
            ctx.fillStyle = U.rgba(c.edge, 0.3); ctx.fillRect(px + pw * 0.15, bottom, pw * 0.3, wy - bottom);
            ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(px - pw / 2, bottom, pw * 0.25, wy - bottom);
            // Отражение и круги на воде
            const rg = ctx.createLinearGradient(0, wy, 0, wy + h * 0.2);
            rg.addColorStop(0, U.rgba(c.post, 0.45)); rg.addColorStop(1, U.rgba(c.post, 0));
            ctx.fillStyle = rg; ctx.fillRect(px - pw / 2, wy, pw, h * 0.2);
            ctx.strokeStyle = U.rgba(c.edge, 0.45); ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.ellipse(px, wy, pw * 0.95, h * 0.016, 0, 0, TAU); ctx.stroke();
        } else {
            ctx.fillStyle = U.rgba(sil, 0.35); ctx.fillRect(px - pw / 2, wy, pw, h * 0.15);
        }
    });
    // Торцевая балка
    ctx.fillStyle = c.face; ctx.fillRect(-10, faceY, end + 10, bottom - faceY);
    // Доски сверху
    ctx.fillStyle = c.top; ctx.fillRect(-10, top, end + 10, faceY - top);
    if (!sil) {
        ctx.strokeStyle = c.seam; ctx.lineWidth = 2;
        for (let px = end - h * 0.17; px > -10; px -= h * 0.17) { ctx.beginPath(); ctx.moveTo(px, top + 1); ctx.lineTo(px, faceY); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-10, faceY + (bottom - faceY) * 0.5); ctx.lineTo(end, faceY + (bottom - faceY) * 0.5); ctx.stroke();
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.fillRect(-10, faceY, end + 10, 2);
        // Блик по переднему краю досок и на торце мостков
        ctx.fillStyle = U.rgba(c.edge, 0.75); ctx.fillRect(-10, top, end + 10, 2.5);
        ctx.fillStyle = U.rgba(c.edge, 0.35); ctx.fillRect(end - 3, top, 3, bottom - top);
        ctx.fillStyle = U.rgba(c.edge, 0.5);
        for (let px = end - h * 0.085; px > 0; px -= h * 0.34) { ctx.beginPath(); ctx.arc(px, faceY + (bottom - faceY) * 0.5, 2.2, 0, TAU); ctx.fill(); }
    }
}
function rod(ctx, hx, hy, col, line, glowFloat) {
    const a = -0.8, len = HH * 1.6, tx = hx + Math.cos(a) * len, ty = hy + Math.sin(a) * len;
    const bx = hx - Math.cos(a) * len * 0.11, by = hy - Math.sin(a) * len * 0.11;
    ctx.lineCap = 'round';
    ctx.strokeStyle = col || '#6a4a24'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
    if (!col) { ctx.strokeStyle = '#d8b06a'; ctx.lineWidth = 3.5; ctx.stroke(); }
    ctx.strokeStyle = line || 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx + 40, ty + 60, tx + 60, ty + 140); ctx.stroke();
    const fx = tx + 60, fy = ty + 140;
    if (glowFloat) { const g = ctx.createRadialGradient(fx, fy, 2, fx, fy, 40); g.addColorStop(0, 'rgba(255,120,90,0.7)'); g.addColorStop(1, 'rgba(255,120,90,0)'); ctx.fillStyle = g; ctx.fillRect(fx - 40, fy - 40, 80, 80); }
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(fx, fy, 8, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ff4a2a'; ctx.beginPath(); ctx.arc(fx, fy, 8, Math.PI, 0); ctx.fill();
}
// Фонарь стоит на досках: маленький ореол, тёплое пятно на досках и отражение в воде
function lantern(ctx, x) {
    const h = HH, base = Y - h * 0.035, gy = base - 24;
    const top = Y - h * 0.035, bottom = Y + h * 0.11;
    ctx.save();
    // Тёплое пятно только на досках и балке
    ctx.beginPath(); ctx.rect(-10, top, X + h * 0.22 + 10, bottom - top); ctx.clip();
    ctx.globalCompositeOperation = 'screen';
    let g = ctx.createRadialGradient(x, base, 2, x, base, 120);
    g.addColorStop(0, 'rgba(255,170,80,0.65)'); g.addColorStop(0.5, 'rgba(255,150,60,0.25)'); g.addColorStop(1, 'rgba(255,150,60,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 130, top, 260, bottom - top);
    ctx.restore();
    // Отражение в воде под мостками — дрожащие полоски
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    g = ctx.createLinearGradient(0, bottom + 8, 0, bottom + 110);
    g.addColorStop(0, 'rgba(255,170,80,0.4)'); g.addColorStop(1, 'rgba(255,170,80,0)');
    ctx.fillStyle = g;
    const jr = U.seeded(11);
    for (let i = 0; i < 9; i++) { const w = 8 + jr() * 16 - i; const jx = (jr() - 0.5) * 10; ctx.globalAlpha = 1 - i * 0.09; ctx.beginPath(); ctx.ellipse(x + jx, bottom + 14 + i * 11, Math.max(3, w / 2), 1.8, 0, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
    ctx.restore();
    // Ореол вокруг стекла
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    g = ctx.createRadialGradient(x, gy, 3, x, gy, 48);
    g.addColorStop(0, 'rgba(255,200,120,0.6)'); g.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 48, gy - 48, 96, 96);
    ctx.restore();
    // Сам фонарь
    ctx.lineJoin = 'round'; ctx.lineWidth = 2; ctx.strokeStyle = '#1c1a2a';
    ctx.fillStyle = '#3a3a4a'; ctx.beginPath(); ctx.roundRect(x - 13, base - 6, 26, 6, 2); ctx.fill(); ctx.stroke();
    const glass = ctx.createLinearGradient(x - 9, 0, x + 9, 0);
    glass.addColorStop(0, '#ffb84a'); glass.addColorStop(0.5, '#fff4c0'); glass.addColorStop(1, '#ffb84a');
    ctx.fillStyle = glass; ctx.beginPath(); ctx.roundRect(x - 9, base - 34, 18, 28, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fffbe6'; ctx.beginPath(); ctx.ellipse(x, base - 18, 3, 6, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x - 9, base - 20); ctx.lineTo(x + 9, base - 20); ctx.stroke();
    ctx.fillStyle = '#3a3a4a';
    ctx.beginPath(); ctx.moveTo(x - 12, base - 34); ctx.lineTo(x + 12, base - 34); ctx.lineTo(x + 7, base - 41); ctx.lineTo(x - 7, base - 41); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, base - 45, 6, Math.PI, 0); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(x - 6, base - 31, 2, 20);
}

// ---------- Рыбаки ----------
const LOOKS = {
    boy: { skin: '#ffd2b0', hair: '#7a4626', jacket: '#3fa060', shirt: '#f4ead6', pants: '#4a72b0', boots: '#f6c53a', cap: '#e8483a', brim: '#b8302a', eye: '#2a1e22', brow: '#6a3a22', mouth: '#a04a3a', cheek: 'rgba(255,110,120,0.5)' },
    girl: { skin: '#ffe0cc', hair: '#b4532a', jacket: '#f2b632', shirt: '#fff6ea', pants: '#5a6ab8', boots: '#ff7d92', cap: '#3a9ad8', brim: '#2a76b0', eye: '#2a1e22', brow: '#8a3a1a', mouth: '#b0504a', cheek: 'rgba(255,110,130,0.55)', bow: '#ff5a8a' },
    grandpa: { skin: '#f7cba8', hair: '#eceef2', jacket: '#4a72c0', shirt: '#f4ead6', pants: '#5a5048', boots: '#4f7d4a', cap: '#c8a060', brim: '#a07a40', eye: '#2a1e22', brow: '#e2e4ea', mouth: '#a04a3a', cheek: 'rgba(255,110,120,0.4)' }
};

function softHero(ctx, P, o) {
    o = o || {};
    const who = o.who || 'boy';
    const h = HH;
    const flat = !!o.flat;
    const radial = (c, x0, y0, x1, y1) => {
        if (flat) return c;
        const g = ctx.createRadialGradient(x1 - (x1 - x0) * 0.25, y0 + (y1 - y0) * 0.2, 1, (x0 + x1) / 2, (y0 + y1) / 2, Math.max(x1 - x0, y1 - y0) * 0.75);
        g.addColorStop(0, U.shade(c, 0.24)); g.addColorStop(0.55, c); g.addColorStop(1, U.shade(c, -0.26));
        return g;
    };
    const vlin = (c, y0, y1) => { if (flat) return c; const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, U.shade(c, 0.2)); g.addColorStop(1, U.shade(c, -0.15)); return g; };
    const oc = (c) => U.shade(c, -0.45);
    const lw = Math.max(2, h * 0.009);
    const line = (pts) => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(p => ctx.lineTo(p[0], p[1])); };
    const limb = (pts, w, c) => {
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        if (o.outline && !flat) { ctx.strokeStyle = oc(c); ctx.lineWidth = w + lw * 2; line(pts); ctx.stroke(); }
        const ys = pts.map(p => p[1]);
        ctx.strokeStyle = vlin(c, Math.min(...ys) - w / 2, Math.max(...ys) + w / 2); ctx.lineWidth = w;
        line(pts); ctx.stroke();
    };
    const fillPath = (path, c, box) => {
        ctx.fillStyle = box ? radial(c, box[0], box[1], box[2], box[3]) : c; ctx.fill(path);
        if (o.outline && !flat) { ctx.strokeStyle = oc(c); ctx.lineWidth = lw; ctx.stroke(path); }
    };
    ctx.save(); ctx.translate(X, Y);
    if (!flat) { ctx.shadowColor = 'rgba(20,40,80,0.2)'; ctx.shadowBlur = h * 0.04; ctx.shadowOffsetY = h * 0.015; }
    // Ноги и сапоги
    [[[h * 0.04, -h * 0.07], [h * 0.25, -h * 0.085], [h * 0.25, h * 0.22], flat ? P.pants : U.shade(P.pants, -0.15)], [[-h * 0.02, -h * 0.05], [h * 0.285, -h * 0.05], [h * 0.3, h * 0.25], P.pants]].forEach(([a, b, c, col]) => {
        limb([a, b, c], h * 0.14, col);
        const boot = new Path2D();
        boot.moveTo(c[0] - h * 0.07, c[1] - h * 0.05);
        boot.lineTo(c[0] + h * 0.06, c[1] - h * 0.05);
        boot.lineTo(c[0] + h * 0.065, c[1] + h * 0.01);
        boot.bezierCurveTo(c[0] + h * 0.13, c[1] + h * 0.01, c[0] + h * 0.16, c[1] + h * 0.035, c[0] + h * 0.155, c[1] + h * 0.07);
        boot.lineTo(c[0] - h * 0.07, c[1] + h * 0.07);
        boot.closePath();
        fillPath(boot, P.boots, [c[0] - h * 0.07, c[1] - h * 0.05, c[0] + h * 0.16, c[1] + h * 0.07]);
    });
    // Дальняя рука
    limb([[h * 0.09, -h * 0.47], [h * 0.17, -h * 0.24], [h * 0.33, -h * 0.3]], h * 0.11, flat ? P.jacket : U.shade(P.jacket, -0.22));
    // Тело
    const torso = new Path2D();
    torso.moveTo(-h * 0.17, -h * 0.02);
    torso.bezierCurveTo(-h * 0.215, -h * 0.2, -h * 0.205, -h * 0.4, -h * 0.12, -h * 0.5);
    torso.quadraticCurveTo(-h * 0.02, -h * 0.575, h * 0.1, -h * 0.535);
    torso.bezierCurveTo(h * 0.2, -h * 0.47, h * 0.235, -h * 0.3, h * 0.215, -h * 0.08);
    torso.quadraticCurveTo(h * 0.205, h * 0.012, h * 0.08, h * 0.012);
    torso.closePath();
    fillPath(torso, P.jacket, [-h * 0.21, -h * 0.57, h * 0.235, h * 0.01]);
    ctx.shadowColor = 'transparent';
    if (!flat) {
        ctx.save(); ctx.clip(torso);
        ctx.fillStyle = 'rgba(255,255,255,0.16)';
        ctx.beginPath(); ctx.roundRect(-h * 0.1, -h * 0.22, h * 0.1, h * 0.08, h * 0.02); ctx.fill();
        ctx.beginPath(); ctx.roundRect(h * 0.09, -h * 0.22, h * 0.09, h * 0.08, h * 0.02); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = h * 0.008;
        ctx.beginPath(); ctx.moveTo(h * 0.085, -h * 0.5); ctx.lineTo(h * 0.1, -h * 0.02); ctx.stroke();
        ctx.restore();
    }
    // Шея: голова крепко сидит на плечах
    const neck = new Path2D();
    neck.moveTo(-h * 0.035, -h * 0.66); neck.lineTo(h * 0.075, -h * 0.66);
    neck.lineTo(h * 0.085, -h * 0.5); neck.lineTo(-h * 0.04, -h * 0.5); neck.closePath();
    fillPath(neck, flat ? P.skin : U.shade(P.skin, -0.12));
    // Ворот рубашки поверх шеи
    const shirt = new Path2D(); shirt.moveTo(-h * 0.04, -h * 0.56); shirt.lineTo(h * 0.13, -h * 0.545); shirt.lineTo(h * 0.075, -h * 0.4); shirt.closePath();
    fillPath(shirt, flat ? P.jacket : P.shirt);
    // Голова — всегда одного размера
    const R = h * 0.235;
    ctx.save(); ctx.translate(h * 0.07, -h * 0.765);
    if (who === 'girl') {
        // Хвостик — за головой
        const tail = new Path2D();
        tail.moveTo(-0.85 * R, -0.42 * R);
        tail.bezierCurveTo(-1.55 * R, -0.55 * R, -1.72 * R, 0.4 * R, -1.3 * R, 1.06 * R);
        tail.bezierCurveTo(-1.1 * R, 0.5 * R, -0.98 * R, 0.0, -0.72 * R, -0.18 * R);
        tail.closePath();
        fillPath(tail, P.hair, [-1.7 * R, -0.6 * R, -0.7 * R, 1.06 * R]);
    }
    if (!flat) { ctx.shadowColor = 'rgba(40,30,60,0.28)'; ctx.shadowBlur = R * 0.3; ctx.shadowOffsetY = R * 0.1; }
    const face = new Path2D();
    face.moveTo(-0.52 * R, 0.66 * R);
    face.bezierCurveTo(-1.02 * R, 0.42 * R, -1.08 * R, -0.5 * R, -0.45 * R, -0.88 * R);
    face.bezierCurveTo(0.02 * R, -1.13 * R, 0.76 * R, -0.96 * R, 0.9 * R, -0.45 * R);
    face.bezierCurveTo(0.98 * R, -0.2 * R, 0.95 * R, -0.02 * R, 0.93 * R, 0.1 * R);
    face.bezierCurveTo(1.02 * R, 0.26 * R, 1.0 * R, 0.45 * R, 0.88 * R, 0.58 * R);
    face.bezierCurveTo(0.74 * R, 0.82 * R, 0.52 * R, 0.94 * R, 0.3 * R, 0.94 * R);
    face.bezierCurveTo(0.04 * R, 0.95 * R, -0.24 * R, 0.84 * R, -0.52 * R, 0.66 * R);
    face.closePath();
    fillPath(face, P.skin, [-R, -R, R, R]);
    ctx.shadowColor = 'transparent';
    const nose = new Path2D(); nose.ellipse(0.95 * R, 0.27 * R, 0.11 * R, 0.09 * R, 0, 0, TAU);
    fillPath(nose, flat ? P.skin : U.shade(P.skin, -0.04), flat ? null : [0.84 * R, 0.18 * R, 1.06 * R, 0.36 * R]);
    // Волосы
    const hair = new Path2D();
    if (who === 'grandpa') {
        hair.moveTo(-0.62 * R, -0.42 * R);
        hair.quadraticCurveTo(-1.08 * R, -0.35 * R, -0.98 * R, 0.08 * R);
        hair.quadraticCurveTo(-1.06 * R, 0.3 * R, -0.82 * R, 0.5 * R);
        hair.quadraticCurveTo(-0.6 * R, 0.36 * R, -0.36 * R, 0.26 * R);
        hair.quadraticCurveTo(-0.5 * R, -0.05 * R, -0.3 * R, -0.32 * R);
        hair.closePath();
    } else {
        hair.moveTo(-0.6 * R, 0.62 * R);
        hair.bezierCurveTo(-1.15 * R, 0.3 * R, -1.1 * R, -0.65 * R, -0.4 * R, -0.95 * R);
        hair.bezierCurveTo(0.1 * R, -1.15 * R, 0.85 * R, -0.95 * R, 0.98 * R, -0.35 * R);
        if (who === 'girl') {
            hair.quadraticCurveTo(0.8 * R, -0.05 * R, 0.6 * R, -0.3 * R);
            hair.quadraticCurveTo(0.35 * R, -0.05 * R, 0.15 * R, -0.36 * R);
            hair.quadraticCurveTo(-0.12 * R, -0.25 * R, -0.2 * R, 0.2 * R);
            hair.quadraticCurveTo(-0.22 * R, 0.6 * R, -0.32 * R, 0.82 * R);   // прядь вдоль щеки
            hair.quadraticCurveTo(-0.5 * R, 0.6 * R, -0.6 * R, 0.62 * R);
        } else {
            hair.quadraticCurveTo(0.84 * R, -0.18 * R, 0.72 * R, -0.36 * R);
            hair.quadraticCurveTo(0.58 * R, -0.1 * R, 0.42 * R, -0.32 * R);
            hair.quadraticCurveTo(0.26 * R, -0.06 * R, 0.08 * R, -0.34 * R);
            hair.quadraticCurveTo(-0.2 * R, -0.26 * R, -0.24 * R, 0.22 * R);
            hair.quadraticCurveTo(-0.45 * R, 0.3 * R, -0.6 * R, 0.62 * R);
        }
        hair.closePath();
    }
    fillPath(hair, P.hair, [-1.1 * R, -1.1 * R, R, 0.6 * R]);
    if (!flat && who !== 'grandpa') { ctx.strokeStyle = 'rgba(255,225,190,0.45)'; ctx.lineWidth = R * 0.08; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(-0.1 * R, -0.25 * R, 0.66 * R, -2.6, -2.05); ctx.stroke(); }
    const ear = new Path2D(); ear.ellipse(-0.42 * R, 0.16 * R, 0.16 * R, 0.21 * R, -0.15, 0, TAU);
    fillPath(ear, P.skin, flat ? null : [-0.58 * R, -0.05 * R, -0.26 * R, 0.37 * R]);
    if (who === 'girl') {
        const bow = new Path2D(); bow.ellipse(-0.88 * R, -0.42 * R, 0.1 * R, 0.16 * R, 0.5, 0, TAU); bow.ellipse(-0.76 * R, -0.52 * R, 0.08 * R, 0.12 * R, -0.6, 0, TAU);
        fillPath(bow, flat ? P.hair : P.bow);
    }
    if (!flat) {
        const small = who === 'grandpa' ? 0.8 : 1;
        [[0.14, 0.1, 1], [0.62, 0.08, 0.8]].forEach(([ex, ey, sc], i) => {
            const x = ex * R, y = ey * R;
            ctx.fillStyle = P.eye; ctx.beginPath(); ctx.ellipse(x, y, 0.09 * R * sc * small, 0.13 * R * small, 0, 0, TAU); ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.arc(x - 0.025 * R, y - 0.05 * R, 0.038 * R * small, 0, TAU); ctx.fill();
            ctx.beginPath(); ctx.arc(x + 0.035 * R, y + 0.05 * R, 0.016 * R, 0, TAU); ctx.fill();
            if (who === 'girl') {
                ctx.strokeStyle = P.eye; ctx.lineWidth = R * 0.03; ctx.lineCap = 'round';
                const s = i === 0 ? -1 : 1;
                ctx.beginPath(); ctx.moveTo(x + s * 0.07 * R, y - 0.1 * R); ctx.lineTo(x + s * 0.13 * R, y - 0.15 * R); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(x + s * 0.03 * R, y - 0.13 * R); ctx.lineTo(x + s * 0.06 * R, y - 0.19 * R); ctx.stroke();
            }
        });
        ctx.strokeStyle = P.brow; ctx.lineWidth = R * (who === 'grandpa' ? 0.1 : 0.055); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0.02 * R, -0.13 * R); ctx.quadraticCurveTo(0.14 * R, -0.22 * R, 0.27 * R, -0.16 * R); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0.52 * R, -0.16 * R); ctx.quadraticCurveTo(0.64 * R, -0.23 * R, 0.75 * R, -0.15 * R); ctx.stroke();
        if (who !== 'grandpa') {
            ctx.strokeStyle = P.mouth; ctx.lineWidth = R * 0.05;
            ctx.beginPath(); ctx.moveTo(0.42 * R, 0.55 * R); ctx.quadraticCurveTo(0.58 * R, 0.68 * R, 0.74 * R, 0.54 * R); ctx.stroke();
        }
        [[0.0, 0.42, 0.22], [0.8, 0.42, 0.15]].forEach(([bx, by, br]) => { const g = ctx.createRadialGradient(bx * R, by * R, 0, bx * R, by * R, br * R); g.addColorStop(0, P.cheek); g.addColorStop(1, 'rgba(255,110,120,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx * R, by * R, br * R, 0, TAU); ctx.fill(); });
        ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.arc(0.98 * R, 0.23 * R, 0.03 * R, 0, TAU); ctx.fill();
        ctx.save(); ctx.clip(face);
        const fs = ctx.createLinearGradient(0, -0.45 * R, 0, -0.1 * R); fs.addColorStop(0, 'rgba(90,30,30,0.28)'); fs.addColorStop(1, 'rgba(90,30,30,0)');
        ctx.fillStyle = fs; ctx.fillRect(-R, -0.45 * R, 2 * R, 0.35 * R);
        ctx.restore();
    }
    if (who === 'grandpa') {
        // Борода, усы, очки
        const beard = new Path2D();
        beard.moveTo(-0.36 * R, 0.2 * R);
        beard.quadraticCurveTo(-0.46 * R, 0.55 * R, -0.3 * R, 0.78 * R);
        beard.quadraticCurveTo(-0.2 * R, 1.0 * R, 0.02 * R, 0.98 * R);
        beard.quadraticCurveTo(0.14 * R, 1.18 * R, 0.34 * R, 1.06 * R);
        beard.quadraticCurveTo(0.52 * R, 1.2 * R, 0.68 * R, 1.0 * R);
        beard.quadraticCurveTo(0.92 * R, 0.96 * R, 0.94 * R, 0.66 * R);
        beard.quadraticCurveTo(1.02 * R, 0.5 * R, 0.9 * R, 0.42 * R);
        beard.quadraticCurveTo(0.6 * R, 0.62 * R, 0.0, 0.42 * R);
        beard.closePath();
        fillPath(beard, P.hair, [-0.46 * R, 0.2 * R, 1.0 * R, 1.2 * R]);
        const stache = new Path2D();
        stache.moveTo(0.3 * R, 0.5 * R);
        stache.bezierCurveTo(0.4 * R, 0.36 * R, 0.66 * R, 0.36 * R, 0.7 * R, 0.44 * R);
        stache.bezierCurveTo(0.82 * R, 0.4 * R, 0.98 * R, 0.46 * R, 1.0 * R, 0.6 * R);
        stache.bezierCurveTo(0.88 * R, 0.56 * R, 0.78 * R, 0.6 * R, 0.68 * R, 0.6 * R);
        stache.bezierCurveTo(0.56 * R, 0.66 * R, 0.4 * R, 0.64 * R, 0.3 * R, 0.5 * R);
        stache.closePath();
        fillPath(stache, flat ? P.hair : '#ffffff');
        if (!flat) {
            ctx.strokeStyle = '#5a3a2a'; ctx.lineWidth = Math.max(1.5, R * 0.035);
            ctx.beginPath(); ctx.arc(0.14 * R, 0.1 * R, 0.19 * R, 0, TAU); ctx.stroke();
            ctx.beginPath(); ctx.ellipse(0.62 * R, 0.08 * R, 0.15 * R, 0.18 * R, 0, 0, TAU); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0.33 * R, 0.06 * R); ctx.lineTo(0.47 * R, 0.05 * R); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-0.05 * R, 0.08 * R); ctx.lineTo(-0.4 * R, 0.02 * R); ctx.stroke();
        }
    }
    // Кепка
    const dome = new Path2D();
    dome.moveTo(-1.0 * R, -0.38 * R); dome.bezierCurveTo(-1.02 * R, -1.3 * R, 0.9 * R, -1.36 * R, 0.98 * R, -0.48 * R); dome.quadraticCurveTo(0, -0.24 * R, -1.0 * R, -0.38 * R); dome.closePath();
    fillPath(dome, P.cap, [-R, -1.25 * R, R, -0.3 * R]);
    const brim = new Path2D();
    brim.moveTo(0.4 * R, -0.48 * R); brim.quadraticCurveTo(1.25 * R, -0.64 * R, 1.52 * R, -0.36 * R); brim.quadraticCurveTo(1.0 * R, -0.24 * R, 0.45 * R, -0.3 * R); brim.closePath();
    fillPath(brim, P.brim);
    if (!flat) { ctx.fillStyle = 'rgba(255,255,255,0.32)'; ctx.beginPath(); ctx.ellipse(-0.3 * R, -0.88 * R, 0.3 * R, 0.1 * R, -0.35, 0, TAU); ctx.fill(); }
    ctx.restore();
    // Ближняя рука с кулаком
    limb([[-h * 0.02, -h * 0.45], [h * 0.08, -h * 0.2], [h * 0.27, -h * 0.26]], h * 0.115, P.jacket);
    const fist = new Path2D(); fist.ellipse(h * 0.3, -h * 0.27, h * 0.05, h * 0.046, 0, 0, TAU);
    fillPath(fist, P.skin, flat ? null : [h * 0.25, -h * 0.32, h * 0.35, -h * 0.22]);
    ctx.restore();
    return [X + h * 0.3, Y - h * 0.27];
}

// ---------- Свет ----------
const LANTERN = [X - 100, Y - HH * 0.035 - 24];   // где стекло фонаря
const LIGHTS = {
    day: { dx: 4, dy: -3, rim: 'rgba(255,250,225,0.9)' },
    sunset: { dx: 5, dy: -3, rim: '#ffc078', glow: 'rgba(255,170,100,0.35)', tint: 'rgba(150,60,110,0.22)', back: 'rgba(60,20,80,0.5)' },
    night: { dx: 4, dy: -3, rim: 'rgba(200,218,255,0.62)', blur: 0.8, glow: 'rgba(140,170,255,0.25)', tint: 'rgba(16,26,90,0.55)', back: 'rgba(5,10,40,0.45)', warm: [LANTERN[0], LANTERN[1], 200, 'rgba(255,165,80,0.42)'] },
    rain: { dx: 3, dy: -2, rim: 'rgba(225,238,255,0.55)', tint: 'rgba(60,80,110,0.28)' },
    fog: { dx: 2, dy: -2, rim: 'rgba(255,255,255,0.4)', tint: 'rgba(214,224,230,0.5)' },
    dawn: { dx: 4, dy: -3, rim: 'rgba(255,245,235,0.9)', tint: 'rgba(200,170,220,0.15)' }
};
const SIL = { sunset: '#1f1838', night: '#0d1028', dawn: '#6e6496' };

function lit(ctx, draw, P, o, light) {
    const A = off(), S = off(), Rm = off();
    const hand = draw(A.getContext('2d'), P, o);
    const mono = {}; Object.keys(P).forEach(k => { mono[k] = '#000000'; });
    draw(S.getContext('2d'), mono, Object.assign({}, o, { flat: true, outline: false }));
    const a = A.getContext('2d');
    const over = (style) => { a.globalCompositeOperation = 'source-atop'; a.fillStyle = style; a.fillRect(0, 0, W, H); a.globalCompositeOperation = 'source-over'; };
    if (light.tint) over(light.tint);
    if (light.back) {
        const g = a.createLinearGradient(X - HH * 0.3, 0, X + HH * 0.5, 0);
        g.addColorStop(0, light.back); g.addColorStop(1, 'rgba(0,0,0,0)');
        over(g);
    }
    if (light.warm) {
        const [lx, ly, lr, lc] = light.warm;
        const g = a.createRadialGradient(lx, ly, 2, lx, ly, lr);
        g.addColorStop(0, lc); g.addColorStop(1, 'rgba(255,170,80,0)');
        over(g);
    }
    const r = Rm.getContext('2d');
    r.drawImage(S, 0, 0);
    r.globalCompositeOperation = 'source-in';
    r.fillStyle = light.rim; r.fillRect(0, 0, W, H);
    r.globalCompositeOperation = 'destination-out';
    r.drawImage(S, -light.dx, -light.dy);
    if (light.blur && 'filter' in r) {
        const soft = off(), sc = soft.getContext('2d');
        sc.filter = 'blur(' + light.blur + 'px)'; sc.drawImage(Rm, 0, 0);
        r.globalCompositeOperation = 'copy'; r.drawImage(soft, 0, 0); r.globalCompositeOperation = 'source-over';
        // Кайма не должна выходить за силуэт
        r.globalCompositeOperation = 'destination-in'; r.drawImage(S, 0, 0); r.globalCompositeOperation = 'source-over';
    }
    if (light.glow) {
        const gl = off(), gc = gl.getContext('2d'); gc.drawImage(S, 0, 0); gc.globalCompositeOperation = 'source-in'; gc.fillStyle = light.glow; gc.fillRect(0, 0, W, H);
        ctx.save(); ctx.shadowColor = light.glow; ctx.shadowBlur = 26; ctx.globalAlpha = 0.55; ctx.drawImage(gl, 0, 0); ctx.restore();
    }
    ctx.drawImage(A, 0, 0);
    ctx.drawImage(Rm, 0, 0);
    return hand;
}

// Готовые кадры: мягкий рыбак со светом и силуэт
function drawSoft(ctx, mood, who) {
    scene(ctx, mood);
    pier(ctx, mood);
    if (mood === 'night') lantern(ctx, LANTERN[0]);
    const dark = mood === 'night' || mood === 'sunset';
    const hd = lit(ctx, softHero, LOOKS[who], { who, outline: true }, LIGHTS[mood]);
    rod(ctx, hd[0], hd[1], dark ? '#20183a' : null, dark ? 'rgba(255,230,190,.85)' : null, dark);
    if (mood === 'rain') rainOver(ctx);
    if (mood === 'fog') fogOver(ctx);
}
function drawSil(ctx, mood, who, accent) {
    scene(ctx, mood);
    pier(ctx, mood, SIL[mood]);
    if (mood === 'night') lantern(ctx, LANTERN[0]);
    const P = Object.assign({}, LOOKS[who]); Object.keys(P).forEach(k => { P[k] = SIL[mood]; });
    if (accent) { P.cap = accent[0]; P.brim = accent[1]; }
    const L = Object.assign({}, LIGHTS[mood], { tint: null, back: null });
    if (mood === 'night') L.warm = [LANTERN[0], LANTERN[1], 150, 'rgba(255,190,110,0.35)'];
    const hd = lit(ctx, softHero, P, { who, flat: true }, L);
    rod(ctx, hd[0], hd[1], SIL[mood], mood === 'dawn' ? 'rgba(255,255,255,.9)' : 'rgba(255,230,180,.9)', mood !== 'dawn');
}
