// person.js — рыбак, удочка, мостки/лодка, фонарь, питомец и поплавок.
// Вид сбоку: рыбак сидит в профиль на краю мостков, ноги свисают над водой,
// смотрит вправо, на воду. Сам рисунок рыбака — в softhero.js, здесь —
// всё вокруг и СВЕТ: рыбак, мостки, лодки и питомец меняются вместе с погодой.
//
// Свет накладывается поверх готового рисунка рыбака:
//   • кайма — светлая полоска по краю силуэта со стороны солнца/луны;
//   • оттенок времени суток (вечер — сиреневый, ночь — синий, туман — белёсый);
//   • тень с передней стороны, когда светило за спиной (вечер, ночь);
//   • тёплое пятно от фонаря ночью.
//
// Раскладка (FB.scene.L): px, py — точка, где рыбак сидит (на досках),
// ph — «рост» сидящего рыбака: от досок до макушки.

(function (FB) {
    const P = FB.person = {};
    const U = FB.U;
    const TAU = Math.PI * 2;

    // rod — угол удочки (рад), bend — изгиб 0..1, reel — крутится ли катушка,
    // lean — наклон (минус — откинулся назад), face — выражение лица
    P.pose = { rod: -0.8, bend: 0.05, reel: false, lean: 0, look: 0, face: 'calm' };

    const cos = (cat) => FB.cosById[FB.S.look[cat]] || FB.cosById[FB.DEFAULT_LOOK[cat]];
    const OUT = 'rgba(30,25,40,0.6)';
    const boatType = () => cos('boat').c.type || 'pier';
    P.boatType = boatType;
    const weather = () => FB.scene.weather || 'sun';

    // Цвет предметов под погоду: вечером сиреневее, ночью синее, в тумане бледнее
    const MOOD = {
        sun: null,
        evening: ['#4a2a5a', 0.35],
        night: ['#1a2550', 0.45],
        rain: ['#5a6a7a', 0.22],
        fog: ['#dde4e8', 0.5]
    };
    const tint = (c) => { const m = MOOD[weather()]; return m ? U.mix(c, m[0], m[1]) : c; };
    P.tint = tint;

    // Свет на рыбаке для каждой погоды (смещения каймы — в долях роста)
    const LIGHT = {
        sun: { dx: 0.015, dy: -0.011, rim: 'rgba(255,250,225,0.75)' },
        evening: { dx: 0.019, dy: -0.011, rim: '#ffc078', glow: 'rgba(255,170,100,0.35)', tint: 'rgba(150,60,110,0.22)', back: 'rgba(60,20,80,0.5)' },
        night: { dx: 0.015, dy: -0.011, rim: 'rgba(200,218,255,0.62)', glow: 'rgba(140,170,255,0.2)', tint: 'rgba(16,26,90,0.55)', back: 'rgba(5,10,40,0.45)', warm: true },
        rain: { dx: 0.011, dy: -0.008, rim: 'rgba(225,238,255,0.5)', tint: 'rgba(60,80,110,0.28)' },
        fog: { dx: 0.008, dy: -0.008, rim: 'rgba(255,255,255,0.35)', tint: 'rgba(214,224,230,0.5)' }
    };
    P.light = () => LIGHT[weather()] || LIGHT.sun;

    // ---------- Мостки ----------
    // Доски со швами, торцевая балка с гвоздями, сваи с бликом и отражением.
    // Передний край досок подсвечен светом погоды — платформа всегда читается
    const PIERS = {
        sun: { top: '#c8935a', face: '#a06c38', post: '#6e4a26', seam: '#8a5a2e', edge: '#ffe2b0' },
        evening: { top: '#6a4660', face: '#40304a', post: '#2e2238', seam: '#4c3650', edge: '#ffb070' },
        night: { top: '#3e4a76', face: '#232a4a', post: '#181c36', seam: '#2c3460', edge: '#a8c0f0' },
        rain: { top: '#8a7458', face: '#6a5640', post: '#4e3e2e', seam: '#5e4c38', edge: '#dce8f2' },
        fog: { top: '#bcae98', face: '#a49884', post: '#8e8472', seam: '#a0947e', edge: '#ffffff' }
    };
    function drawPier(ctx, x, y, h, b) {
        const end = x + h * 0.22;
        const top = y - h * 0.035, faceY = y + h * 0.03, bottom = y + h * 0.11, wy = y + h * 0.42;
        const def = FB.DEFAULT_LOOK.boat === b.id;
        // Купленные мостки другого цвета — смешиваем с цветом погоды
        const c = def ? (PIERS[weather()] || PIERS.sun) : { top: tint(U.shade(b.c.a, 0.12)), face: tint(b.c.a), post: tint(U.shade(b.c.b, -0.15)), seam: tint(b.c.b), edge: (PIERS[weather()] || PIERS.sun).edge };
        const pw = h * 0.075;
        [end - h * 0.1, end - h * 0.92, end - h * 1.74].forEach(px => {
            if (px < -h * 0.1) return;
            ctx.fillStyle = c.post; ctx.fillRect(px - pw / 2, bottom - 2, pw, wy - bottom + 2);
            ctx.fillStyle = U.rgba(c.edge, 0.3); ctx.fillRect(px + pw * 0.15, bottom, pw * 0.3, wy - bottom);
            ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(px - pw / 2, bottom, pw * 0.25, wy - bottom);
            const rg = ctx.createLinearGradient(0, wy, 0, wy + h * 0.2);
            rg.addColorStop(0, U.rgba(c.post, 0.45)); rg.addColorStop(1, U.rgba(c.post, 0));
            ctx.fillStyle = rg; ctx.fillRect(px - pw / 2, wy, pw, h * 0.2);
            ctx.strokeStyle = U.rgba(c.edge, 0.45); ctx.lineWidth = Math.max(1, h * 0.006);
            ctx.beginPath(); ctx.ellipse(px, wy, pw * (0.95 + Math.sin(FB.scene.t * 2 + px) * 0.08), h * 0.016, 0, 0, TAU); ctx.stroke();
        });
        ctx.fillStyle = c.face; ctx.fillRect(-10, faceY, end + 10, bottom - faceY);
        ctx.fillStyle = c.top; ctx.fillRect(-10, top, end + 10, faceY - top);
        ctx.strokeStyle = c.seam; ctx.lineWidth = Math.max(1, h * 0.007);
        for (let px = end - h * 0.17; px > -10; px -= h * 0.17) { ctx.beginPath(); ctx.moveTo(px, top + 1); ctx.lineTo(px, faceY); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-10, faceY + (bottom - faceY) * 0.5); ctx.lineTo(end, faceY + (bottom - faceY) * 0.5); ctx.stroke();
        ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(-10, faceY, end + 10, Math.max(1.5, h * 0.007));
        ctx.fillStyle = U.rgba(c.edge, 0.75); ctx.fillRect(-10, top, end + 10, Math.max(2, h * 0.009));
        ctx.fillStyle = U.rgba(c.edge, 0.35); ctx.fillRect(end - Math.max(2, h * 0.011), top, Math.max(2, h * 0.011), bottom - top);
        ctx.fillStyle = U.rgba(c.edge, 0.5);
        for (let px = end - h * 0.085; px > 0; px -= h * 0.34) { ctx.beginPath(); ctx.arc(px, faceY + (bottom - faceY) * 0.5, Math.max(1.5, h * 0.008), 0, TAU); ctx.fill(); }
    }

    // ---------- Мостки, плот, лодка, яхта (сбоку) ----------
    // Сзади рыбака: доски, сваи, мачта яхты. Спереди: борт лодки (прячет ноги)
    P.drawBoatBack = (ctx) => {
        const SC = FB.scene, L = SC.L, h = L.ph;
        const b = cos('boat'), type = boatType();
        const x = L.px, y = L.py;
        const lw = Math.max(1.2, h * 0.012);
        ctx.lineJoin = 'round';
        ctx.lineWidth = lw;
        ctx.strokeStyle = OUT;
        if (type === 'pier') {
            drawPier(ctx, x, y, h, b);
        } else if (type === 'raft') {
            const x0 = x - h * 1.0, x1 = x + h * 0.3, wy = y + h * 0.15;
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.beginPath(); ctx.ellipse((x0 + x1) / 2, wy + h * 0.03, (x1 - x0) * 0.6, h * 0.04, 0, 0, TAU); ctx.fill();
            const r = h * 0.075;
            for (let px = x0 + r; px < x1; px += r * 1.9) {
                const g = ctx.createRadialGradient(px - r * 0.3, y + r * 0.6, r * 0.1, px, y + r, r);
                g.addColorStop(0, tint(U.shade(b.c.a, 0.25))); g.addColorStop(1, tint(b.c.b));
                ctx.fillStyle = g;
                ctx.beginPath(); ctx.arc(px, y + r, r, 0, TAU); ctx.fill(); ctx.stroke();
                ctx.strokeStyle = 'rgba(90,60,30,0.5)';
                ctx.beginPath(); ctx.arc(px, y + r, r * 0.55, 0, TAU); ctx.stroke();
                ctx.strokeStyle = OUT;
            }
            ctx.fillStyle = tint(b.c.a);
            ctx.fillRect(x0, y - h * 0.02, x1 - x0, h * 0.04);
            ctx.strokeRect(x0, y - h * 0.02, x1 - x0, h * 0.04);
        } else if (type === 'yacht') {
            // Мачта и парус — за рыбаком
            const mx = x - h * 0.9;
            ctx.fillStyle = tint('#c8ced6');
            ctx.fillRect(mx - h * 0.02, y - h * 1.9, h * 0.04, h * 1.9);
            ctx.fillStyle = tint('#ffffff');
            ctx.beginPath(); ctx.moveTo(mx + h * 0.03, y - h * 1.85); ctx.quadraticCurveTo(mx + h * 0.55, y - h * 1.0, mx + h * 0.5, y - h * 0.2); ctx.lineTo(mx + h * 0.03, y - h * 0.2); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.fillStyle = tint(b.c.b);
            ctx.fillRect(mx + h * 0.05, y - h * 0.9, h * 0.35, h * 0.06);
        }
    };

    P.drawBoatFront = (ctx) => {
        const SC = FB.scene, L = SC.L, h = L.ph;
        const b = cos('boat'), type = boatType();
        if (type !== 'boat' && type !== 'yacht') return;
        const x = L.px, y = L.py;
        const big = type === 'yacht';
        const x0 = x - h * (big ? 1.5 : 0.85), x1 = x + h * (big ? 0.85 : 0.6);
        const top = y - h * (big ? 0.06 : 0.02), bottom = y + h * (big ? 0.42 : 0.3), wy = y + h * (big ? 0.3 : 0.22);
        ctx.lineJoin = 'round';
        ctx.lineWidth = Math.max(1.2, h * 0.012);
        ctx.strokeStyle = OUT;
        const hull = () => {
            ctx.beginPath();
            ctx.moveTo(x0, top);
            ctx.lineTo(x1 - h * 0.1, top);
            ctx.quadraticCurveTo(x1 + h * 0.08, top - h * 0.06, x1 + h * 0.12, top - h * 0.1);
            ctx.quadraticCurveTo(x1, bottom - h * 0.02, x1 - h * 0.3, bottom);
            ctx.lineTo(x0 + h * 0.12, bottom);
            ctx.quadraticCurveTo(x0 - h * 0.02, bottom - h * 0.05, x0, top);
            ctx.closePath();
        };
        const g = ctx.createLinearGradient(0, top, 0, bottom);
        const base = big ? '#f6f6f6' : b.c.a;
        g.addColorStop(0, tint(U.shade(base, 0.12))); g.addColorStop(1, tint(U.shade(base, -0.18)));
        hull(); ctx.fillStyle = g; ctx.fill();
        ctx.save(); hull(); ctx.clip();
        ctx.fillStyle = tint(b.c.b);
        ctx.fillRect(x0 - 10, top, x1 - x0 + h * 0.3, h * 0.06);
        if (big) {
            ctx.fillRect(x0 - 10, top + h * 0.16, x1 - x0 + h * 0.3, h * 0.035);
            ctx.fillStyle = tint('#bfe6f6');
            for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x0 + h * (0.4 + i * 0.35), top + h * 0.12, h * 0.035, 0, TAU); ctx.fill(); }
        }
        ctx.fillStyle = 'rgba(40,110,160,0.35)';
        ctx.fillRect(x0 - 10, wy, x1 - x0 + h * 0.4, bottom - wy + 10);
        // Блик по верхнему краю борта — цвет света погоды
        ctx.fillStyle = U.rgba((PIERS[weather()] || PIERS.sun).edge, 0.6);
        ctx.fillRect(x0 - 10, top, x1 - x0 + h * 0.3, Math.max(2, h * 0.009));
        ctx.restore();
        hull(); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath(); ctx.ellipse((x0 + x1) / 2, wy, (x1 - x0) * 0.62, h * 0.03, 0, 0, TAU); ctx.stroke();
        if (big) {
            ctx.strokeStyle = tint('#c8d0d8');
            ctx.lineWidth = Math.max(1, h * 0.012);
            ctx.beginPath(); ctx.moveTo(x0 + h * 0.05, top - h * 0.16); ctx.lineTo(x1 - h * 0.15, top - h * 0.16); ctx.stroke();
            for (let px = x0 + h * 0.05; px < x1 - h * 0.1; px += h * 0.22) { ctx.beginPath(); ctx.moveTo(px, top); ctx.lineTo(px, top - h * 0.16); ctx.stroke(); }
        } else {
            ctx.strokeStyle = tint('#8a5a30');
            ctx.lineWidth = h * 0.025;
            ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(x0 + h * 0.2, top - h * 0.12); ctx.lineTo(x0 - h * 0.25, wy + h * 0.02); ctx.stroke();
            ctx.fillStyle = tint('#a8743a');
            ctx.beginPath(); ctx.ellipse(x0 - h * 0.28, wy + h * 0.03, h * 0.09, h * 0.035, 0.6, 0, TAU); ctx.fill();
        }
    };
    P.drawBoat = (ctx) => { P.drawBoatBack(ctx); P.drawBoatFront(ctx); };

    // ---------- Фонарь (только ночью) ----------
    // Стоит на досках между питомцем и рыбаком: маленький ореол, тёплое пятно
    // только на досках и дрожащее отражение в воде
    const deckTop = () => {
        const L = FB.scene.L, t = boatType();
        return L.py - L.ph * (t === 'yacht' ? 0.06 : t === 'boat' ? 0.02 : t === 'raft' ? 0.02 : 0.035);
    };
    P.lanternPos = () => {
        const L = FB.scene.L, k = L.ph / 270;
        return { x: L.px - L.ph * 0.32, y: deckTop() - 24 * k };
    };
    P.drawLantern = (ctx) => {
        if (weather() !== 'night') return;
        const L = FB.scene.L, h = L.ph, k = h / 270;
        const x = L.px - h * 0.32, base = deckTop(), gy = base - 24 * k;
        const isPier = boatType() === 'pier';
        const top = L.py - h * 0.035, bottom = L.py + h * 0.11;
        let g;
        if (isPier) {
            ctx.save();
            ctx.beginPath(); ctx.rect(-10, top, L.px + h * 0.22 + 10, bottom - top); ctx.clip();
            ctx.globalCompositeOperation = 'screen';
            g = ctx.createRadialGradient(x, base, 2, x, base, 120 * k);
            g.addColorStop(0, 'rgba(255,170,80,0.65)'); g.addColorStop(0.5, 'rgba(255,150,60,0.25)'); g.addColorStop(1, 'rgba(255,150,60,0)');
            ctx.fillStyle = g; ctx.fillRect(x - 130 * k, top, 260 * k, bottom - top);
            ctx.restore();
            // Отражение в воде под мостками — дрожащие полоски
            ctx.save(); ctx.globalCompositeOperation = 'screen';
            ctx.fillStyle = 'rgba(255,170,80,0.38)';
            const jr = U.seeded(11);
            for (let i = 0; i < 9; i++) {
                const w = (8 + jr() * 16 - i) * k, jx = (jr() - 0.5) * 10 * k + Math.sin(FB.scene.t * 2 + i) * 2 * k;
                ctx.globalAlpha = 1 - i * 0.09;
                ctx.beginPath(); ctx.ellipse(x + jx, bottom + (14 + i * 11) * k, Math.max(3, w / 2), 1.8 * k, 0, 0, TAU); ctx.fill();
            }
            ctx.restore();
        }
        // Ореол вокруг стекла — чуть «дышит»
        ctx.save(); ctx.globalCompositeOperation = 'screen';
        const fl = 1 + Math.sin(FB.scene.t * 7) * 0.04 + Math.sin(FB.scene.t * 13) * 0.03;
        g = ctx.createRadialGradient(x, gy, 3, x, gy, 48 * k * fl);
        g.addColorStop(0, 'rgba(255,200,120,0.6)'); g.addColorStop(1, 'rgba(255,200,120,0)');
        ctx.fillStyle = g; ctx.fillRect(x - 50 * k, gy - 50 * k, 100 * k, 100 * k);
        ctx.restore();
        // Сам фонарь
        ctx.save();
        ctx.translate(x, base); ctx.scale(k, k);
        ctx.lineJoin = 'round'; ctx.lineWidth = 2; ctx.strokeStyle = '#1c1a2a';
        ctx.fillStyle = '#3a3a4a'; ctx.beginPath(); ctx.roundRect(-13, -6, 26, 6, 2); ctx.fill(); ctx.stroke();
        const glass = ctx.createLinearGradient(-9, 0, 9, 0);
        glass.addColorStop(0, '#ffb84a'); glass.addColorStop(0.5, '#fff4c0'); glass.addColorStop(1, '#ffb84a');
        ctx.fillStyle = glass; ctx.beginPath(); ctx.roundRect(-9, -34, 18, 28, 3); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fffbe6'; ctx.beginPath(); ctx.ellipse(0, -18, 3 * fl, 6 * fl, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-9, -20); ctx.lineTo(9, -20); ctx.stroke();
        ctx.fillStyle = '#3a3a4a';
        ctx.beginPath(); ctx.moveTo(-12, -34); ctx.lineTo(12, -34); ctx.lineTo(7, -41); ctx.lineTo(-7, -41); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, -45, 6, Math.PI, 0); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(-6, -31, 2, 20);
        ctx.restore();
    };

    // ---------- Удочка ----------
    // Руки рыбака держат удочку перед собой; изгиб «отгибает» кончик к воде
    P.hands = () => {
        const L = FB.scene.L, lean = P.pose.lean || 0;
        const [hx, hy] = FB.soft.localHand(L.ph, lean);
        const ang = lean * 0.12, c = Math.cos(ang), sn = Math.sin(ang);
        return { x: L.px + hx * c - hy * sn, y: L.py + hx * sn + hy * c };
    };
    P.rodTip = () => {
        const L = FB.scene.L, pose = P.pose;
        const hd = P.hands();
        const len = L.ph * 1.65;
        const a = pose.rod, bend = pose.bend;
        const tipA = a + bend * 0.55;
        return { x: hd.x + Math.cos(tipA) * len * (1 - bend * 0.08), y: hd.y + Math.sin(tipA) * len * (1 - bend * 0.08), hx: hd.x, hy: hd.y, a, len };
    };

    function drawRod(ctx) {
        const h = FB.scene.L.ph;
        const t = P.rodTip();
        const rod = FB.rodById[FB.S.rod] || FB.RODS[0];
        const bx = t.hx - Math.cos(t.a) * t.len * 0.11, by = t.hy - Math.sin(t.a) * t.len * 0.11;
        const mx = t.hx + Math.cos(t.a) * t.len * 0.55, my = t.hy + Math.sin(t.a) * t.len * 0.55;
        ctx.lineCap = 'round';
        ctx.strokeStyle = tint(U.shade(rod.color, -0.4));
        ctx.lineWidth = Math.max(2.5, h * 0.03);
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(mx, my, t.x, t.y); ctx.stroke();
        ctx.strokeStyle = tint(rod.color);
        ctx.lineWidth = Math.max(1.5, h * 0.018);
        ctx.stroke();
        ctx.strokeStyle = tint('#3a2a22');
        ctx.lineWidth = Math.max(3, h * 0.045);
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(t.hx + Math.cos(t.a) * h * 0.06, t.hy + Math.sin(t.a) * h * 0.06); ctx.stroke();
        ctx.fillStyle = tint('#e2e6ea');
        for (let i = 1; i <= 3; i++) {
            const k = 0.3 + i * 0.17;
            const x = U.lerp(U.lerp(bx, mx, k), U.lerp(mx, t.x, k), k), y = U.lerp(U.lerp(by, my, k), U.lerp(my, t.y, k), k);
            ctx.beginPath(); ctx.arc(x, y, Math.max(1.2, h * 0.01), 0, TAU); ctx.fill();
        }
        const rx = t.hx - Math.cos(t.a) * h * 0.08 + h * 0.02, ry = t.hy - Math.sin(t.a) * h * 0.08 + h * 0.06;
        ctx.fillStyle = tint('#5a6470');
        ctx.beginPath(); ctx.arc(rx, ry, h * 0.05, 0, TAU); ctx.fill();
        ctx.fillStyle = tint('#c8d0d8');
        ctx.beginPath(); ctx.arc(rx, ry, h * 0.03, 0, TAU); ctx.fill();
        const ang = P.pose.reel ? FB.scene.t * 18 : 0.6;
        ctx.strokeStyle = tint('#3a4048');
        ctx.lineWidth = Math.max(1.5, h * 0.014);
        ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + Math.cos(ang) * h * 0.065, ry + Math.sin(ang) * h * 0.065); ctx.stroke();
    }

    // ---------- Рыбак со светом ----------
    P.heroOpts = () => {
        const L = FB.scene.L, pose = P.pose;
        return {
            x: L.px, y: L.py, h: L.ph,
            who: FB.S.who || 'boy',
            hat: cos('hat'), jacket: cos('jacket'),
            face: pose.face, lean: pose.lean, t: FB.scene.t,
            legs: boatType() === 'pier' || boatType() === 'raft'
        };
    };

    // Запасные холсты: рыбак, его силуэт, кайма и свечение (перерисовываются каждый кадр)
    const buf = {};
    const canvasOf = (key, w, h) => {
        let c = buf[key];
        if (!c) c = buf[key] = document.createElement('canvas');
        if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
        const x = c.getContext('2d');
        x.setTransform(1, 0, 0, 1, 0, 0);
        x.globalCompositeOperation = 'source-over';
        x.globalAlpha = 1;
        x.clearRect(0, 0, w, h);
        return c;
    };

    // opt.plain — без света (для картинок в магазине)
    P.drawPerson = (ctx, opt) => {
        const SC = FB.scene, L = SC.L, h = L.ph;
        // Удочка позади: кулак рыбака ложится поверх рукояти
        drawRod(ctx);
        const o = P.heroOpts();
        if (opt && opt.plain) { FB.soft.draw(ctx, o); return; }
        const dpr = SC.dpr || 1;
        const bx = L.px - h * 0.75, by = L.py - h * 1.35, bw = h * 1.5, bh = h * 1.85;
        const W = Math.ceil(bw * dpr), H = Math.ceil(bh * dpr);
        const A = canvasOf('A', W, H), S = canvasOf('S', W, H), R = canvasOf('R', W, H);
        const a = A.getContext('2d'), s = S.getContext('2d'), r = R.getContext('2d');
        a.setTransform(dpr, 0, 0, dpr, 0, 0);
        s.setTransform(dpr, 0, 0, dpr, 0, 0);
        const lo = Object.assign({}, o, { x: L.px - bx, y: L.py - by });
        FB.soft.draw(a, lo);
        FB.soft.draw(s, Object.assign({}, lo, { mono: '#000000' }));
        const light = P.light();
        const over = (style) => { a.globalCompositeOperation = 'source-atop'; a.fillStyle = style; a.fillRect(0, 0, bw, bh); a.globalCompositeOperation = 'source-over'; };
        if (light.tint) over(light.tint);
        if (light.back) {
            const g = a.createLinearGradient(lo.x - h * 0.3, 0, lo.x + h * 0.5, 0);
            g.addColorStop(0, light.back); g.addColorStop(1, 'rgba(0,0,0,0)');
            over(g);
        }
        if (light.warm) {
            const lp = P.lanternPos(), lx = lp.x - bx, ly = lp.y - by;
            const g = a.createRadialGradient(lx, ly, 2, lx, ly, h * 0.75);
            g.addColorStop(0, 'rgba(255,165,80,0.42)'); g.addColorStop(1, 'rgba(255,170,80,0)');
            over(g);
        }
        // Кайма: силуэт минус тот же силуэт, сдвинутый от света
        r.drawImage(S, 0, 0);
        r.globalCompositeOperation = 'source-in';
        r.fillStyle = light.rim; r.fillRect(0, 0, W, H);
        r.globalCompositeOperation = 'destination-out';
        r.drawImage(S, -light.dx * h * dpr, -light.dy * h * dpr);
        r.globalCompositeOperation = 'source-over';
        if (light.glow) {
            const G = canvasOf('G', W, H), gx = G.getContext('2d');
            gx.drawImage(S, 0, 0);
            gx.globalCompositeOperation = 'source-in';
            gx.fillStyle = light.glow; gx.fillRect(0, 0, W, H);
            ctx.save();
            ctx.globalAlpha = 0.55;
            ctx.shadowColor = light.glow; ctx.shadowBlur = h * 0.1;
            ctx.drawImage(G, bx, by, bw, bh);
            ctx.restore();
        }
        ctx.drawImage(A, bx, by, bw, bh);
        ctx.drawImage(R, bx, by, bw, bh);
    };

    // ---------- Питомец (сидит позади, смотрит на воду) ----------
    P.drawPet = (ctx) => {
        const pet = cos('pet');
        if (!pet.c.type) return;
        const SC = FB.scene, L = SC.L, h = L.ph;
        const s = h * 0.42;
        const x = L.px - h * 0.62, y = L.py - h * 0.03;
        const t = SC.t, type = pet.c.type;
        const a = tint(pet.c.a), b = tint(pet.c.b);
        const lw = Math.max(1, h * 0.011);
        ctx.save();
        ctx.translate(x, y);
        ctx.lineWidth = lw; ctx.strokeStyle = OUT; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath(); ctx.ellipse(0, s * 0.02, s * 0.42, s * 0.07, 0, 0, Math.PI * 2); ctx.fill();
        if (type === 'duck') {
            ctx.fillStyle = a;
            ctx.beginPath(); ctx.ellipse(0, -s * 0.28, s * 0.38, s * 0.28, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(-s * 0.34, -s * 0.34); ctx.lineTo(-s * 0.5, -s * 0.52 + Math.sin(t * 3) * s * 0.03); ctx.lineTo(-s * 0.3, -s * 0.22); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.arc(s * 0.2, -s * 0.7, s * 0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = b;
            ctx.beginPath(); ctx.ellipse(s * 0.44, -s * 0.66, s * 0.13, s * 0.06, 0.1, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#2a2a34'; ctx.beginPath(); ctx.arc(s * 0.27, -s * 0.74, s * 0.035, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            return;
        }
        // Хвост
        const wag = Math.sin(t * (type === 'dog' ? 8 : 1.6)) * 0.35;
        ctx.save();
        ctx.translate(-s * 0.28, -s * 0.1);
        ctx.rotate(-0.4 + wag);
        ctx.strokeStyle = OUT; ctx.lineWidth = s * 0.16 + lw * 2;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-s * 0.3, -s * 0.1, -s * 0.28, -s * 0.42); ctx.stroke();
        ctx.strokeStyle = a; ctx.lineWidth = s * 0.16; ctx.stroke();
        if (type === 'raccoon') {
            ctx.strokeStyle = b; ctx.lineWidth = s * 0.17;
            ctx.setLineDash([s * 0.07, s * 0.08]); ctx.stroke(); ctx.setLineDash([]);
        }
        ctx.restore();
        ctx.lineWidth = lw; ctx.strokeStyle = OUT;
        // Тело (сидит)
        ctx.fillStyle = a;
        ctx.beginPath(); ctx.ellipse(0, -s * 0.3, s * 0.3, s * 0.32, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = type === 'dog' ? U.shade(a, 0.25) : b;
        ctx.beginPath(); ctx.ellipse(s * 0.12, -s * 0.28, s * 0.14, s * 0.22, 0, 0, Math.PI * 2); ctx.fill();
        // Лапка
        ctx.fillStyle = a;
        ctx.beginPath(); ctx.ellipse(s * 0.2, -s * 0.03, s * 0.1, s * 0.06, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        // Голова
        const hx = s * 0.16, hy = -s * 0.74;
        ctx.fillStyle = a;
        ctx.beginPath(); ctx.arc(hx, hy, s * 0.23, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        if (type === 'dog') {
            ctx.beginPath(); ctx.ellipse(hx + s * 0.22, hy + s * 0.05, s * 0.13, s * 0.1, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = b;
            ctx.beginPath(); ctx.ellipse(hx - s * 0.08, hy + s * 0.04, s * 0.08, s * 0.16, 0.3 + Math.sin(t * 2) * 0.1, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#2a2a34'; ctx.beginPath(); ctx.arc(hx + s * 0.34, hy + s * 0.02, s * 0.04, 0, Math.PI * 2); ctx.fill();
        } else {
            // Уши-треугольники
            [[-0.06, 1], [0.12, 1]].forEach(([dx]) => {
                ctx.fillStyle = a;
                ctx.beginPath(); ctx.moveTo(hx + dx * s - s * 0.07, hy - s * 0.15); ctx.lineTo(hx + dx * s, hy - s * 0.36); ctx.lineTo(hx + dx * s + s * 0.08, hy - s * 0.17); ctx.closePath(); ctx.fill(); ctx.stroke();
            });
            ctx.fillStyle = type === 'raccoon' ? '#ffffff' : U.shade(a, 0.3);
            ctx.beginPath(); ctx.ellipse(hx + s * 0.16, hy + s * 0.06, s * 0.1, s * 0.08, 0, 0, Math.PI * 2); ctx.fill();
            if (type === 'raccoon') {
                ctx.fillStyle = b;
                ctx.beginPath(); ctx.ellipse(hx + s * 0.08, hy - s * 0.02, s * 0.13, s * 0.07, 0, 0, Math.PI * 2); ctx.fill();
            }
            ctx.fillStyle = '#ff9aa6';
            ctx.beginPath(); ctx.arc(hx + s * 0.25, hy + s * 0.04, s * 0.035, 0, Math.PI * 2); ctx.fill();
            if (type === 'cat') {
                ctx.strokeStyle = U.rgba(U.shade(pet.c.a, -0.35), 0.6); ctx.lineWidth = s * 0.04;
                [-0.48, -0.36, -0.24].forEach(k => { ctx.beginPath(); ctx.moveTo(-s * 0.22, s * k); ctx.lineTo(-s * 0.08, s * k + s * 0.02); ctx.stroke(); });
                ctx.strokeStyle = 'rgba(60,40,30,0.5)'; ctx.lineWidth = Math.max(0.8, s * 0.015);
                [-0.02, 0.04].forEach(k => { ctx.beginPath(); ctx.moveTo(hx + s * 0.22, hy + s * (0.06 + k)); ctx.lineTo(hx + s * 0.42, hy + s * (0.03 + k * 2)); ctx.stroke(); });
            }
            const blink = (t % 3.7) < 0.12;
            ctx.fillStyle = '#2a2a34';
            if (blink) ctx.fillRect(hx + s * 0.04, hy - s * 0.04, s * 0.09, s * 0.02);
            else { ctx.beginPath(); ctx.ellipse(hx + s * 0.08, hy - s * 0.04, s * 0.035, s * 0.05, 0, 0, Math.PI * 2); ctx.fill(); }
        }
        ctx.restore();
    };

    // ---------- Превью вещи для магазина ----------
    // Рисуем маленького рыбака (или поплавок, лодку, питомца) уже с этой вещью
    P.preview = (canvas, item) => {
        const SC = FB.scene, S = FB.S;
        const w = canvas.width, h = canvas.height;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, w, h);
        const keep = { W: SC.W, H: SC.H, L: SC.L, weather: SC.weather, look: Object.assign({}, S.look), pose: Object.assign({}, P.pose), t: SC.t, who: S.who };
        if (item.cat !== 'who') S.look[item.cat] = item.id;
        SC.weather = 'sun';
        SC.t = 0.6;
        SC.W = w * 1.6; SC.H = h * 1.6;
        P.pose = { rod: -0.8, bend: 0.05, reel: false, lean: 0, look: 0, face: 'calm' };
        try {
            if (item.cat === 'hat') {
                SC.L = { ph: h * 1.4, px: w / 2 - h * 0.1, py: h * 1.71 };
                P.drawPerson(ctx, { plain: true });
            } else if (item.cat === 'jacket' || item.cat === 'who') {
                if (item.cat === 'who') S.who = item.id;
                SC.L = { ph: h * 0.82, px: w * 0.4, py: h * 0.95 };
                P.drawPerson(ctx, { plain: true });
            } else if (item.cat === 'pet') {
                const ph = h * 1.9;
                SC.L = { ph, px: w * 0.5 + ph * 0.57, py: h * 0.95 };
                if (item.c.type) P.drawPet(ctx);
                else { ctx.font = Math.round(h * 0.4) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#b8a888'; ctx.fillText('—', w / 2, h / 2); }
            } else if (item.cat === 'float') {
                SC.W = h * 7; SC.H = h * 7;
                ctx.fillStyle = 'rgba(92,196,240,.35)';
                ctx.beginPath(); ctx.ellipse(w / 2, h * 0.72, w * 0.32, h * 0.1, 0, 0, Math.PI * 2); ctx.fill();
                P.drawFloat(ctx, w / 2, h * 0.72, 1.6, 0, 0);
            } else if (item.cat === 'boat') {
                drawBoatIcon(ctx, item, w, h);
            } else if (item.cat === 'effect') {
                drawEffectIcon(ctx, item, w, h);
            }
        } finally {
            SC.W = keep.W; SC.H = keep.H; SC.L = keep.L; SC.weather = keep.weather; SC.t = keep.t;
            S.look = keep.look;
            S.who = keep.who;
            P.pose = keep.pose;
        }
    };

    // Портрет рыбака для кружков (подсказки обучения, выбор рыбака):
    // голова с шапкой крупно и по центру
    P.portrait = (canvas, who, face) => {
        const w = canvas.width, ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, w, canvas.height);
        const h = w * 1.3;
        const o = Object.assign(P.heroOpts(), {
            x: w * 0.44 - h * 0.07, y: w * 0.62 + h * 0.765, h,
            who: who || FB.S.who, face: face || 'happy', lean: 0, legs: false, t: 0.6
        });
        FB.soft.draw(ctx, o);
    };

    function drawBoatIcon(ctx, item, w, h) {
        const t = item.c.type || 'pier', a = item.c.a, b = item.c.b;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(30,25,40,.55)';
        ctx.lineWidth = 2;
        ctx.fillStyle = 'rgba(92,196,240,.35)';
        ctx.beginPath(); ctx.ellipse(w / 2, h * 0.72, w * 0.46, h * 0.14, 0, 0, Math.PI * 2); ctx.fill();
        if (t === 'pier') {
            for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? a : U.shade(a, 0.1); ctx.fillRect(w * 0.2, h * (0.3 + i * 0.1), w * 0.6, h * 0.09); ctx.strokeRect(w * 0.2, h * (0.3 + i * 0.1), w * 0.6, h * 0.09); }
            ctx.fillStyle = b; ctx.fillRect(w * 0.24, h * 0.7, w * 0.05, h * 0.16); ctx.fillRect(w * 0.71, h * 0.7, w * 0.05, h * 0.16);
        } else if (t === 'raft') {
            for (let i = 0; i < 5; i++) { ctx.fillStyle = i % 2 ? a : b; ctx.beginPath(); ctx.ellipse(w / 2, h * (0.36 + i * 0.08), w * 0.32, h * 0.05, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
        } else {
            ctx.fillStyle = t === 'yacht' ? '#f6f6f6' : a;
            ctx.beginPath(); ctx.moveTo(w * 0.1, h * 0.45); ctx.lineTo(w * 0.9, h * 0.45); ctx.quadraticCurveTo(w * 0.82, h * 0.72, w * 0.7, h * 0.74); ctx.lineTo(w * 0.28, h * 0.74); ctx.quadraticCurveTo(w * 0.16, h * 0.7, w * 0.1, h * 0.45); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.fillStyle = b; ctx.fillRect(w * 0.14, h * 0.45, w * 0.72, h * 0.06);
            if (t === 'yacht') {
                ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(w * 0.5, h * 0.42); ctx.lineTo(w * 0.5, h * 0.06); ctx.lineTo(w * 0.78, h * 0.42); ctx.closePath(); ctx.fill(); ctx.stroke();
            }
        }
    }
    function drawEffectIcon(ctx, item, w, h) {
        const rnd = U.seeded(item.id.length * 31);
        const colors = { fx_splash: ['#bfe8ff', '#ffffff'], fx_stars: ['#ffd84a', '#fff2a0'], fx_hearts: ['#ff5a7a', '#ff8aa6'], fx_confetti: ['#ff5a5a', '#ffd84a', '#5ad87a', '#5ab4ff', '#c87aff'], fx_rainbow: ['#ff5a5a', '#ffa83a', '#ffe84a', '#5ad87a', '#5ab4ff', '#9a7aff'] }[item.id] || ['#fff'];
        if (item.id === 'fx_rainbow') {
            colors.forEach((c, i) => { ctx.strokeStyle = c; ctx.lineWidth = h * 0.05; ctx.beginPath(); ctx.arc(w / 2, h * 0.85, h * (0.62 - i * 0.05), Math.PI, 0); ctx.stroke(); });
            return;
        }
        for (let i = 0; i < 14; i++) {
            const x = w * (0.15 + rnd() * 0.7), y = h * (0.15 + rnd() * 0.7), r = h * (0.04 + rnd() * 0.05);
            ctx.fillStyle = colors[i % colors.length];
            if (item.id === 'fx_stars') FB.fishArt.star(ctx, x, y, r * 1.6);
            else if (item.id === 'fx_hearts') FB.scene.heart(ctx, x, y, r * 1.2);
            else if (item.id === 'fx_confetti') { ctx.save(); ctx.translate(x, y); ctx.rotate(rnd() * 3); ctx.fillRect(-r, -r * 0.5, r * 2, r); ctx.restore(); }
            else { ctx.strokeStyle = '#5cb4e8'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
        }
    }

    // ---------- Поплавок ----------
    // sub — насколько утонул (0..1), s — масштаб перспективы,
    // air — поплавок в воздухе: рисуем целиком, с грузиком, крючком и наживкой
    const FLOAT_TOP = { duck: 1.85, star: 2.7, heart: 2.3 };     // от точки поплавка до верхушки, в r
    P.floatRadius = (s) => FB.scene.unit() * 1.5 * Math.max(0.35, s);
    P.floatTop = (s) => P.floatRadius(s) * (FLOAT_TOP[cos('float').c.shape] || 2.6);

    // Наживка на крючке — та, что сейчас выбрана
    function bait(ctx, r) {
        const id = FB.S.bait;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        if (id === 'spinner') {
            ctx.fillStyle = tint('#dfe4ea'); ctx.strokeStyle = 'rgba(30,25,40,0.6)'; ctx.lineWidth = Math.max(1, r * 0.1);
            ctx.beginPath(); ctx.ellipse(0, r * 0.55, r * 0.32, r * 0.6, 0, 0, TAU); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#e8402a'; ctx.beginPath(); ctx.arc(-r * 0.05, r * 0.5, r * 0.12, 0, TAU); ctx.fill();
            return;
        }
        if (id === 'shrimp') {
            ctx.strokeStyle = tint('#ff8a6a'); ctx.lineWidth = r * 0.42;
            ctx.beginPath(); ctx.arc(r * 0.05, r * 0.55, r * 0.42, -0.6, 2.6); ctx.stroke();
            return;
        }
        if (id === 'maggot') {
            ctx.fillStyle = tint('#f6ead0'); ctx.strokeStyle = 'rgba(160,140,100,0.8)'; ctx.lineWidth = Math.max(1, r * 0.08);
            ctx.beginPath(); ctx.ellipse(r * 0.18, r * 0.5, r * 0.18, r * 0.42, 0.3, 0, TAU); ctx.fill(); ctx.stroke();
            return;
        }
        // Червяк чуть шевелится
        const w = Math.sin(FB.scene.t * 5) * r * 0.15;
        ctx.strokeStyle = tint('#e8869a'); ctx.lineWidth = r * 0.26;
        ctx.beginPath(); ctx.moveTo(-r * 0.05, r * 0.15); ctx.quadraticCurveTo(r * 0.45 + w, r * 0.45, -r * 0.1, r * 0.75); ctx.quadraticCurveTo(-r * 0.4 - w, r * 0.95, r * 0.05, r * 1.15); ctx.stroke();
    }

    // Поплавок висит на леске под кончиком удочки (ax, ay), angle — отклонение лески
    P.drawHangingFloat = (ctx, ax, ay, angle, len, s) => {
        const top = P.floatTop(s);
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(-angle);
        ctx.strokeStyle = FB.scene.weather === 'night' ? 'rgba(220,230,255,0.6)' : 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, len); ctx.stroke();
        ctx.restore();
        // Точка поплавка — ниже верхушки антенны
        const fx = ax + Math.sin(angle) * (len + top), fy = ay + Math.cos(angle) * (len + top);
        P.drawFloat(ctx, fx, fy, s, 0, -angle, true);
        return { x: fx, y: fy };
    };

    P.drawFloat = (ctx, x, y, s, sub, wob, air) => {
        const fl = cos('float');
        const r = P.floatRadius(s);
        const shape = fl.c.shape;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(wob || 0);
        if (fl.c.glow) {
            const g = ctx.createRadialGradient(0, -r, 0, 0, -r, r * 5);
            g.addColorStop(0, U.rgba(fl.c.a, 0.45)); g.addColorStop(1, U.rgba(fl.c.a, 0));
            ctx.fillStyle = g; ctx.fillRect(-r * 5, -r * 6, r * 10, r * 10);
        }
        if (air) {
            // Под поплавком: киль, поводок, грузик-дробинка, крючок и наживка
            const k0 = r * 0.4;
            ctx.strokeStyle = 'rgba(30,25,40,0.7)'; ctx.lineWidth = Math.max(1, r * 0.16); ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(0, k0); ctx.lineTo(0, k0 + r * 0.9); ctx.stroke();
            ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(0, k0 + r * 0.9); ctx.lineTo(0, k0 + r * 3.4); ctx.stroke();
            ctx.fillStyle = tint('#7a8490');
            ctx.beginPath(); ctx.arc(0, k0 + r * 2.0, r * 0.22, 0, TAU); ctx.fill();
            ctx.save();
            ctx.translate(0, k0 + r * 3.4);
            ctx.strokeStyle = tint('#c8d0d8'); ctx.lineWidth = Math.max(1, r * 0.12);
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, r * 0.7); ctx.arc(-r * 0.28, r * 0.7, r * 0.28, 0, Math.PI * 0.95); ctx.stroke();
            bait(ctx, r);
            ctx.restore();
        } else {
            // На воде всё, что ниже поверхности, обрезаем — видна только верхушка
            ctx.beginPath(); ctx.rect(-r * 6, -r * 8, r * 12, r * 8 + r * 0.15); ctx.clip();
        }
        const dy = sub * r * 2.6;
        ctx.translate(0, dy);
        ctx.lineWidth = Math.max(1, r * 0.18);
        ctx.strokeStyle = 'rgba(30,25,40,0.6)';
        if (shape === 'duck') {
            ctx.fillStyle = fl.c.a;
            ctx.beginPath(); ctx.ellipse(0, -r * 0.4, r * 1.2, r * 0.75, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.arc(r * 0.6, -r * 1.3, r * 0.55, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = fl.c.b;
            ctx.beginPath(); ctx.ellipse(r * 1.2, -r * 1.25, r * 0.35, r * 0.16, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#1b1f2a'; ctx.beginPath(); ctx.arc(r * 0.75, -r * 1.42, r * 0.1, 0, Math.PI * 2); ctx.fill();
        } else if (shape === 'star') {
            ctx.fillStyle = fl.c.a;
            FB.fishArt.star(ctx, 0, -r * 1.2, r * 1.5);
            ctx.stroke();
            ctx.fillStyle = fl.c.b; ctx.beginPath(); ctx.arc(-r * 0.3, -r * 1.5, r * 0.25, 0, Math.PI * 2); ctx.fill();
        } else if (shape === 'heart') {
            ctx.fillStyle = fl.c.a;
            FB.scene.heart(ctx, 0, -r * 1.1, r * 1.2);
            ctx.stroke();
            ctx.fillStyle = fl.c.b; ctx.beginPath(); ctx.arc(-r * 0.45, -r * 1.5, r * 0.22, 0, Math.PI * 2); ctx.fill();
        } else {
            // Классический: белый низ, цветной верх и антенна
            ctx.fillStyle = fl.c.b;
            ctx.beginPath(); ctx.ellipse(0, -r * 0.3, r * 0.75, r * 0.75, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = fl.c.a;
            ctx.beginPath(); ctx.ellipse(0, -r * 0.3, r * 0.75, r * 0.75, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.fillRect(-r * 0.12, -r * 2.6, r * 0.24, r * 2.2);
            ctx.strokeRect(-r * 0.12, -r * 2.6, r * 0.24, r * 2.2);
            ctx.fillStyle = 'rgba(255,255,255,0.45)';
            ctx.beginPath(); ctx.arc(-r * 0.25, -r * 0.6, r * 0.2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    };
})(window.FB);
