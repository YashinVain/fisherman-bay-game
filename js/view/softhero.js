// softhero.js — рыбак в стиле «мягкий объём»: формы лепятся светом и тенью,
// контур — тёмный оттенок своего же цвета, глаза-бусинки с бликами.
// Сидит на краю мостков, смотрит вправо (на воду). Голова всегда одного размера.
//
// FB.soft.draw(ctx, o) — нарисовать рыбака, вернуть точку, где руки держат удочку.
//   o = { x, y, h, who, hat, jacket, face, lean, t, legs, flat, mono }
//   who   — boy | girl | grandpa
//   hat, jacket — предметы косметики (FB.cosById[...])
//   face  — calm | focus | strain | happy | sad
//   flat  — без переливов и деталей (для маски силуэта), mono — один цвет на всё
//
// Свет (кайма, оттенок времени суток, фонарь) накладывается снаружи —
// в person.js, поверх готовой картинки.

(function (FB) {
    const SH = FB.soft = {};
    const U = FB.U;
    const TAU = Math.PI * 2;

    SH.CHARS = {
        boy: { skin: '#ffd2b0', hair: '#7a4626', brow: '#6a3a22', eye: '#2a1e22', mouth: '#a04a3a', cheek: 'rgba(255,110,120,0.5)', boots: '#f6c53a', pants: '#4a72b0' },
        girl: { skin: '#ffe0cc', hair: '#b4532a', brow: '#8a3a1a', eye: '#2a1e22', mouth: '#b0504a', cheek: 'rgba(255,110,130,0.55)', boots: '#ff7d92', pants: '#5a6ab8', bow: '#ff5a8a' },
        grandpa: { skin: '#f7cba8', hair: '#eceef2', brow: '#e2e4ea', eye: '#2a1e22', mouth: '#a04a3a', cheek: 'rgba(255,110,120,0.4)', boots: '#4f7d4a', pants: '#5a5048' }
    };

    // Где руки держат удочку — относительно точки, где рыбак сидит
    SH.localHand = (h, lean) => [h * (0.3 + (lean || 0) * 0.06), -h * (0.27 - (lean || 0) * 0.02)];

    SH.draw = (ctx, o) => {
        const h = o.h, who = SH.CHARS[o.who] ? o.who : 'boy';
        const C = SH.CHARS[who];
        const flat = !!(o.flat || o.mono);
        const mono = o.mono || null;
        const jk = o.jacket || FB.cosById.jk_green, hat = o.hat;
        const P = {
            skin: C.skin, hair: C.hair, boots: C.boots, pants: C.pants, bow: C.bow || C.hair,
            jacket: jk.c.a, acc: jk.c.b, shirt: '#f4ead6'
        };
        if (mono) Object.keys(P).forEach(k => { P[k] = mono; });
        const col = (c) => mono || c;
        const t = o.t || 0, face = o.face || 'calm';
        const lw = Math.max(1.6, h * 0.009);

        // ---------- Помощники ----------
        const radial = (c, x0, y0, x1, y1) => {
            if (flat) return c;
            const g = ctx.createRadialGradient(x1 - (x1 - x0) * 0.25, y0 + (y1 - y0) * 0.2, 1, (x0 + x1) / 2, (y0 + y1) / 2, Math.max(x1 - x0, y1 - y0) * 0.75);
            g.addColorStop(0, U.shade(c, 0.24)); g.addColorStop(0.55, c); g.addColorStop(1, U.shade(c, -0.26));
            return g;
        };
        const vlin = (c, y0, y1) => {
            if (flat) return c;
            const g = ctx.createLinearGradient(0, y0, 0, y1);
            g.addColorStop(0, U.shade(c, 0.2)); g.addColorStop(1, U.shade(c, -0.15));
            return g;
        };
        const oc = (c) => U.shade(c, -0.45);
        const poly = (pts) => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); };
        const limb = (pts, w, c) => {
            ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            if (!flat) { ctx.strokeStyle = oc(c); ctx.lineWidth = w + lw * 2; poly(pts); ctx.stroke(); }
            const ys = pts.map(p => p[1]);
            ctx.strokeStyle = vlin(c, Math.min.apply(null, ys) - w / 2, Math.max.apply(null, ys) + w / 2);
            ctx.lineWidth = w;
            poly(pts); ctx.stroke();
        };
        const fill = (path, c, box) => {
            ctx.fillStyle = box ? radial(c, box[0], box[1], box[2], box[3]) : c;
            ctx.fill(path);
            if (!flat) { ctx.strokeStyle = oc(c); ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke(path); }
        };

        ctx.save();
        ctx.translate(o.x, o.y);

        // ---------- Ноги и сапоги ----------
        if (o.legs !== false) {
            const sw = Math.sin(t * 1.4) * h * 0.03, sw2 = Math.sin(t * 1.4 + 1.3) * h * 0.025;
            if (!flat) { ctx.shadowColor = 'rgba(20,40,80,0.2)'; ctx.shadowBlur = h * 0.03; ctx.shadowOffsetY = h * 0.012; }
            [[[h * 0.04, -h * 0.07], [h * 0.25, -h * 0.085], [h * 0.25 + sw2, h * 0.22], flat ? P.pants : U.shade(P.pants, -0.15)],
             [[-h * 0.02, -h * 0.05], [h * 0.285, -h * 0.05], [h * 0.3 + sw, h * 0.25], P.pants]].forEach(([a, b, c, pc]) => {
                limb([a, b, c], h * 0.14, pc);
                const boot = new Path2D();
                boot.moveTo(c[0] - h * 0.07, c[1] - h * 0.05);
                boot.lineTo(c[0] + h * 0.06, c[1] - h * 0.05);
                boot.lineTo(c[0] + h * 0.065, c[1] + h * 0.01);
                boot.bezierCurveTo(c[0] + h * 0.13, c[1] + h * 0.01, c[0] + h * 0.16, c[1] + h * 0.035, c[0] + h * 0.155, c[1] + h * 0.07);
                boot.lineTo(c[0] - h * 0.07, c[1] + h * 0.07);
                boot.closePath();
                fill(boot, P.boots, [c[0] - h * 0.07, c[1] - h * 0.05, c[0] + h * 0.16, c[1] + h * 0.07]);
                if (!flat) {
                    ctx.fillStyle = 'rgba(255,255,255,0.4)';
                    ctx.beginPath(); ctx.roundRect(c[0] - h * 0.045, c[1] - h * 0.035, h * 0.016, h * 0.06, h * 0.008); ctx.fill();
                }
            });
            ctx.shadowColor = 'transparent';
        }

        // Верх тела слегка наклоняется (откидывается, когда тянет рыбу)
        const lean = o.lean || 0;
        ctx.rotate(lean * 0.12);
        const breathe = Math.sin(t * 1.7) * h * 0.006;
        const hand = SH.localHand(h, lean);

        // ---------- Дальняя рука ----------
        limb([[h * 0.09, -h * 0.47], [h * 0.17, -h * 0.24], [hand[0] + h * 0.03, hand[1] - h * 0.03]], h * 0.11, flat ? P.jacket : U.shade(P.jacket, -0.22));

        // ---------- Тело ----------
        if (!flat) { ctx.shadowColor = 'rgba(20,40,80,0.2)'; ctx.shadowBlur = h * 0.04; ctx.shadowOffsetY = h * 0.015; }
        if (!flat && (jk.id === 'jk_yellow' || jk.id === 'jk_gold')) {
            // Капюшон дождевика лежит на спине
            const hood = new Path2D(); hood.ellipse(-h * 0.1, -h * 0.5 + breathe, h * 0.1, h * 0.06, -0.35, 0, TAU);
            fill(hood, U.shade(P.jacket, -0.1));
        }
        const torso = new Path2D();
        torso.moveTo(-h * 0.17, -h * 0.02);
        torso.bezierCurveTo(-h * 0.215, -h * 0.2, -h * 0.205, -h * 0.4 + breathe, -h * 0.12, -h * 0.5 + breathe);
        torso.quadraticCurveTo(-h * 0.02, -h * 0.575 + breathe, h * 0.1, -h * 0.535 + breathe);
        torso.bezierCurveTo(h * 0.2, -h * 0.47, h * 0.235, -h * 0.3, h * 0.215, -h * 0.08);
        torso.quadraticCurveTo(h * 0.205, h * 0.012, h * 0.08, h * 0.012);
        torso.closePath();
        fill(torso, P.jacket, [-h * 0.21, -h * 0.57, h * 0.235, h * 0.01]);
        ctx.shadowColor = 'transparent';
        if (!flat) {
            ctx.save(); ctx.clip(torso);
            jacketDetails(ctx, jk, h, P);
            ctx.restore();
        }

        // ---------- Шея и ворот ----------
        const neck = new Path2D();
        neck.moveTo(-h * 0.035, -h * 0.66); neck.lineTo(h * 0.075, -h * 0.66);
        neck.lineTo(h * 0.085, -h * 0.5); neck.lineTo(-h * 0.04, -h * 0.5); neck.closePath();
        fill(neck, flat ? P.skin : U.shade(P.skin, -0.12));
        const collar = new Path2D(); collar.moveTo(-h * 0.04, -h * 0.56 + breathe); collar.lineTo(h * 0.13, -h * 0.545 + breathe); collar.lineTo(h * 0.075, -h * 0.4); collar.closePath();
        fill(collar, jk.id === 'jk_green' || jk.id === 'jk_navy' ? P.shirt : (flat ? P.jacket : U.shade(P.jacket, 0.12)));

        // ---------- Голова (размер постоянный) ----------
        const R = h * 0.235;
        ctx.save();
        ctx.translate(h * 0.07, -h * 0.765 + breathe * 1.2);
        ctx.rotate(face === 'strain' ? -0.05 : face === 'happy' ? 0.04 : 0);
        if (who === 'girl') {
            const tail = new Path2D();
            tail.moveTo(-0.85 * R, -0.42 * R);
            tail.bezierCurveTo(-1.55 * R, -0.55 * R, -1.72 * R, 0.4 * R, -1.3 * R, 1.06 * R + Math.sin(t * 1.3) * R * 0.04);
            tail.bezierCurveTo(-1.1 * R, 0.5 * R, -0.98 * R, 0.0, -0.72 * R, -0.18 * R);
            tail.closePath();
            fill(tail, P.hair, [-1.7 * R, -0.6 * R, -0.7 * R, 1.06 * R]);
        }
        if (!flat) { ctx.shadowColor = 'rgba(40,30,60,0.28)'; ctx.shadowBlur = R * 0.3; ctx.shadowOffsetY = R * 0.1; }
        const faceP = new Path2D();
        faceP.moveTo(-0.52 * R, 0.66 * R);
        faceP.bezierCurveTo(-1.02 * R, 0.42 * R, -1.08 * R, -0.5 * R, -0.45 * R, -0.88 * R);
        faceP.bezierCurveTo(0.02 * R, -1.13 * R, 0.76 * R, -0.96 * R, 0.9 * R, -0.45 * R);
        faceP.bezierCurveTo(0.98 * R, -0.2 * R, 0.95 * R, -0.02 * R, 0.93 * R, 0.1 * R);
        faceP.bezierCurveTo(1.02 * R, 0.26 * R, 1.0 * R, 0.45 * R, 0.88 * R, 0.58 * R);
        faceP.bezierCurveTo(0.74 * R, 0.82 * R, 0.52 * R, 0.94 * R, 0.3 * R, 0.94 * R);
        faceP.bezierCurveTo(0.04 * R, 0.95 * R, -0.24 * R, 0.84 * R, -0.52 * R, 0.66 * R);
        faceP.closePath();
        fill(faceP, P.skin, [-R, -R, R, R]);
        ctx.shadowColor = 'transparent';
        const nose = new Path2D(); nose.ellipse(0.95 * R, 0.27 * R, 0.11 * R, 0.09 * R, 0, 0, TAU);
        fill(nose, flat ? P.skin : U.shade(P.skin, -0.04), flat ? null : [0.84 * R, 0.18 * R, 1.06 * R, 0.36 * R]);
        hairShape(ctx, R, who, P, fill, flat, t);
        const ear = new Path2D(); ear.ellipse(-0.42 * R, 0.16 * R, 0.16 * R, 0.21 * R, -0.15, 0, TAU);
        fill(ear, P.skin, flat ? null : [-0.58 * R, -0.05 * R, -0.26 * R, 0.37 * R]);
        if (who === 'girl') {
            const bow = new Path2D(); bow.ellipse(-0.88 * R, -0.42 * R, 0.1 * R, 0.16 * R, 0.5, 0, TAU); bow.ellipse(-0.76 * R, -0.52 * R, 0.08 * R, 0.12 * R, -0.6, 0, TAU);
            fill(bow, P.bow);
        }
        if (!flat) faceFeatures(ctx, R, who, C, face, t, faceP, !!hat);
        if (who === 'grandpa') beard(ctx, R, P, fill, flat, face);
        if (hat) drawHat(ctx, hat, R, fill, flat, col);
        ctx.restore();

        // ---------- Ближняя рука, кулак на удочке ----------
        limb([[-h * 0.02, -h * 0.45], [h * 0.08, -h * 0.2], [hand[0] - h * 0.03, hand[1] + h * 0.01]], h * 0.115, P.jacket);
        if (!flat) {
            const cuff = new Path2D(); cuff.ellipse(hand[0] - h * 0.06, hand[1] + h * 0.012, h * 0.03, h * 0.06, -0.5, 0, TAU);
            fill(cuff, U.shade(P.jacket, -0.15));
        }
        const fist = new Path2D(); fist.ellipse(hand[0], hand[1], h * 0.05, h * 0.046, 0, 0, TAU);
        fill(fist, P.skin, flat ? null : [hand[0] - h * 0.05, hand[1] - h * 0.05, hand[0] + h * 0.05, hand[1] + h * 0.05]);
        if (!flat) {
            ctx.strokeStyle = U.rgba(U.shade(P.skin, -0.45), 0.5); ctx.lineWidth = Math.max(1, h * 0.006); ctx.lineCap = 'round';
            for (let i = 0; i < 3; i++) { const fy = hand[1] - h * 0.005 + i * h * 0.016; ctx.beginPath(); ctx.moveTo(hand[0] + h * 0.018, fy); ctx.lineTo(hand[0] + h * 0.045, fy + h * 0.004); ctx.stroke(); }
        }
        ctx.restore();

        // Мировые координаты рук (с учётом наклона)
        const ang = lean * 0.12, cs = Math.cos(ang), sn = Math.sin(ang);
        return [o.x + hand[0] * cs - hand[1] * sn, o.y + hand[0] * sn + hand[1] * cs];
    };

    // ---------- Одежда ----------
    function jacketDetails(ctx, jk, h, P) {
        const base = P.jacket, acc = P.acc;
        ctx.lineCap = 'round';
        const pocket = (x, y, w, hh, flapColor) => {
            ctx.fillStyle = 'rgba(255,255,255,0.14)';
            ctx.beginPath(); ctx.roundRect(x, y, w, hh, h * 0.016); ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.14)'; ctx.lineWidth = Math.max(1, h * 0.005); ctx.stroke();
            if (flapColor) {
                ctx.fillStyle = flapColor;
                ctx.beginPath(); ctx.roundRect(x - h * 0.003, y, w + h * 0.006, h * 0.024, [h * 0.01, h * 0.01, h * 0.004, h * 0.004]); ctx.fill();
            }
        };
        switch (jk.id) {
            case 'jk_green':
                pocket(-h * 0.11, -h * 0.34, h * 0.09, h * 0.08, U.shade(base, 0.1));
                pocket(h * 0.1, -h * 0.33, h * 0.08, h * 0.08, U.shade(base, 0.1));
                pocket(-h * 0.1, -h * 0.18, h * 0.1, h * 0.09, acc);
                pocket(h * 0.11, -h * 0.18, h * 0.08, h * 0.09, acc);
                break;
            case 'jk_yellow':
            case 'jk_gold':
                ctx.strokeStyle = 'rgba(0,0,0,0.14)'; ctx.lineWidth = h * 0.007;
                ctx.beginPath(); ctx.moveTo(h * 0.085, -h * 0.52); ctx.lineTo(h * 0.1, -h * 0.01); ctx.stroke();
                ctx.fillStyle = acc;
                [-0.42, -0.3, -0.18].forEach(k => { ctx.beginPath(); ctx.roundRect(h * 0.09, h * k, h * 0.04, h * 0.018, h * 0.008); ctx.fill(); });
                pocket(-h * 0.1, -h * 0.2, h * 0.11, h * 0.1, null);
                ctx.fillStyle = 'rgba(255,255,255,0.3)';
                ctx.beginPath(); ctx.ellipse(h * 0.16, -h * 0.26, h * 0.016, h * 0.12, 0.15, 0, TAU); ctx.fill();
                break;
            case 'jk_plaid':
                ctx.strokeStyle = U.rgba(acc, 0.38); ctx.lineWidth = h * 0.026;
                for (let i = -6; i <= 6; i++) {
                    ctx.beginPath(); ctx.moveTo(i * h * 0.07 + h * 0.02, -h * 0.7); ctx.lineTo(i * h * 0.07, h * 0.1); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(-h * 0.3, -h * 0.6 + (i + 6) * h * 0.07); ctx.lineTo(h * 0.3, -h * 0.62 + (i + 6) * h * 0.07); ctx.stroke();
                }
                ctx.fillStyle = '#fbf6ec';
                [-0.42, -0.3, -0.18, -0.06].forEach(k => { ctx.beginPath(); ctx.arc(h * 0.1, h * k, h * 0.011, 0, TAU); ctx.fill(); });
                break;
            case 'jk_navy':
                ctx.fillStyle = '#e8b830';
                [[0.0, -0.44], [0.13, -0.42], [0.0, -0.3], [0.13, -0.28], [0.0, -0.16], [0.13, -0.14]].forEach(([px, py]) => { ctx.beginPath(); ctx.arc(h * px, h * py, h * 0.015, 0, TAU); ctx.fill(); });
                break;
            case 'jk_hawaii':
                for (let i = 0; i < 12; i++) {
                    const fx = ((i * 41) % 40 - 20) / 100 * h, fy = -h * 0.52 + ((i * 59) % 52) / 100 * h;
                    ctx.fillStyle = i % 2 ? acc : '#fff3a0';
                    for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.ellipse(fx + Math.cos(k * 1.26) * h * 0.018, fy + Math.sin(k * 1.26) * h * 0.018, h * 0.015, h * 0.009, k * 1.26, 0, TAU); ctx.fill(); }
                    ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.arc(fx, fy, h * 0.008, 0, TAU); ctx.fill();
                }
                break;
        }
        // Строчка застёжки
        if (jk.id !== 'jk_yellow' && jk.id !== 'jk_gold' && jk.id !== 'jk_plaid') {
            ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = h * 0.007;
            ctx.beginPath(); ctx.moveTo(h * 0.085, -h * 0.5); ctx.lineTo(h * 0.1, -h * 0.02); ctx.stroke();
        }
    }

    // ---------- Волосы ----------
    function hairShape(ctx, R, who, P, fill, flat, t) {
        const hair = new Path2D();
        if (who === 'grandpa') {
            hair.moveTo(-0.62 * R, -0.42 * R);
            hair.quadraticCurveTo(-1.08 * R, -0.35 * R, -0.98 * R, 0.08 * R);
            hair.quadraticCurveTo(-1.06 * R, 0.3 * R, -0.82 * R, 0.5 * R);
            hair.quadraticCurveTo(-0.6 * R, 0.36 * R, -0.36 * R, 0.26 * R);
            hair.quadraticCurveTo(-0.5 * R, -0.05 * R, -0.3 * R, -0.32 * R);
            hair.closePath();
            fill(hair, P.hair, [-1.1 * R, -0.45 * R, -0.3 * R, 0.5 * R]);
            return;
        }
        hair.moveTo(-0.6 * R, 0.62 * R);
        hair.bezierCurveTo(-1.15 * R, 0.3 * R, -1.1 * R, -0.65 * R, -0.4 * R, -0.95 * R);
        hair.bezierCurveTo(0.1 * R, -1.15 * R, 0.85 * R, -0.95 * R, 0.98 * R, -0.35 * R);
        if (who === 'girl') {
            hair.quadraticCurveTo(0.8 * R, -0.05 * R, 0.6 * R, -0.3 * R);
            hair.quadraticCurveTo(0.35 * R, -0.05 * R, 0.15 * R, -0.36 * R);
            hair.quadraticCurveTo(-0.12 * R, -0.25 * R, -0.2 * R, 0.2 * R);
            hair.quadraticCurveTo(-0.22 * R, 0.6 * R, -0.32 * R, 0.82 * R);
            hair.quadraticCurveTo(-0.5 * R, 0.6 * R, -0.6 * R, 0.62 * R);
        } else {
            hair.quadraticCurveTo(0.84 * R, -0.18 * R, 0.72 * R, -0.36 * R);
            hair.quadraticCurveTo(0.58 * R, -0.1 * R, 0.42 * R, -0.32 * R);
            hair.quadraticCurveTo(0.26 * R, -0.06 * R, 0.08 * R, -0.34 * R);
            hair.quadraticCurveTo(-0.2 * R, -0.26 * R, -0.24 * R, 0.22 * R);
            hair.quadraticCurveTo(-0.45 * R, 0.3 * R, -0.6 * R, 0.62 * R);
        }
        hair.closePath();
        fill(hair, P.hair, [-1.1 * R, -1.1 * R, R, 0.6 * R]);
        if (!flat) {
            ctx.strokeStyle = 'rgba(255,225,190,0.45)'; ctx.lineWidth = R * 0.08; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.arc(-0.1 * R, -0.25 * R, 0.66 * R, -2.6, -2.05); ctx.stroke();
            ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = R * 0.035;
            ctx.beginPath(); ctx.moveTo(-0.7 * R, -0.4 * R); ctx.quadraticCurveTo(-0.85 * R, 0.0, -0.7 * R, 0.35 * R); ctx.stroke();
        }
    }

    function beard(ctx, R, P, fill, flat, face) {
        const b = new Path2D();
        b.moveTo(-0.36 * R, 0.2 * R);
        b.quadraticCurveTo(-0.46 * R, 0.55 * R, -0.3 * R, 0.78 * R);
        b.quadraticCurveTo(-0.2 * R, 1.0 * R, 0.02 * R, 0.98 * R);
        b.quadraticCurveTo(0.14 * R, 1.18 * R, 0.34 * R, 1.06 * R);
        b.quadraticCurveTo(0.52 * R, 1.2 * R, 0.68 * R, 1.0 * R);
        b.quadraticCurveTo(0.92 * R, 0.96 * R, 0.94 * R, 0.66 * R);
        b.quadraticCurveTo(1.02 * R, 0.5 * R, 0.9 * R, 0.42 * R);
        b.quadraticCurveTo(0.6 * R, 0.62 * R, 0.0, 0.42 * R);
        b.closePath();
        fill(b, P.hair, [-0.46 * R, 0.2 * R, 1.0 * R, 1.2 * R]);
        if (flat) return;
        if (face === 'happy' || face === 'strain') {
            ctx.fillStyle = '#7a2833';
            ctx.beginPath(); ctx.ellipse(0.52 * R, 0.72 * R, 0.13 * R, face === 'happy' ? 0.09 * R : 0.05 * R, 0, 0, TAU); ctx.fill();
        }
        const s = new Path2D();
        s.moveTo(0.3 * R, 0.5 * R);
        s.bezierCurveTo(0.4 * R, 0.36 * R, 0.66 * R, 0.36 * R, 0.7 * R, 0.44 * R);
        s.bezierCurveTo(0.82 * R, 0.4 * R, 0.98 * R, 0.46 * R, 1.0 * R, 0.6 * R);
        s.bezierCurveTo(0.88 * R, 0.56 * R, 0.78 * R, 0.6 * R, 0.68 * R, 0.6 * R);
        s.bezierCurveTo(0.56 * R, 0.66 * R, 0.4 * R, 0.64 * R, 0.3 * R, 0.5 * R);
        s.closePath();
        fill(s, '#ffffff');
        // Очки
        ctx.strokeStyle = '#5a3a2a'; ctx.lineWidth = Math.max(1.5, R * 0.035);
        ctx.beginPath(); ctx.arc(0.14 * R, 0.1 * R, 0.19 * R, 0, TAU); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(0.62 * R, 0.08 * R, 0.15 * R, 0.18 * R, 0, 0, TAU); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0.33 * R, 0.06 * R); ctx.lineTo(0.47 * R, 0.05 * R); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-0.05 * R, 0.08 * R); ctx.lineTo(-0.4 * R, 0.02 * R); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = Math.max(1, R * 0.025);
        ctx.beginPath(); ctx.arc(0.14 * R, 0.1 * R, 0.13 * R, -2.6, -1.9); ctx.stroke();
    }

    // ---------- Лицо: глаза-бусинки, брови, рот, румянец ----------
    function faceFeatures(ctx, R, who, C, face, t, faceP, hasHat) {
        const small = who === 'grandpa' ? 0.8 : 1;
        const blink = face === 'calm' && (t % 4.2) < 0.13;
        const eyes = [[0.14, 0.1, 1, -1], [0.62, 0.08, 0.8, 1]];
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        eyes.forEach(([ex, ey, sc, side]) => {
            const x = ex * R, y = ey * R;
            ctx.strokeStyle = C.eye; ctx.fillStyle = C.eye;
            if (face === 'happy') {
                ctx.lineWidth = R * 0.06;
                ctx.beginPath(); ctx.arc(x, y + 0.05 * R, 0.08 * R * sc, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
                return;
            }
            if (face === 'strain') {
                ctx.lineWidth = R * 0.055;
                const d = side;
                ctx.beginPath(); ctx.moveTo(x - d * 0.08 * R, y - 0.08 * R); ctx.lineTo(x + d * 0.05 * R, y); ctx.lineTo(x - d * 0.08 * R, y + 0.08 * R); ctx.stroke();
                return;
            }
            if (blink) {
                ctx.lineWidth = R * 0.05;
                ctx.beginPath(); ctx.moveTo(x - 0.08 * R * sc, y + 0.02 * R); ctx.quadraticCurveTo(x, y + 0.07 * R, x + 0.08 * R * sc, y + 0.02 * R); ctx.stroke();
                return;
            }
            const k = face === 'focus' ? 1.2 : 1;
            ctx.beginPath(); ctx.ellipse(x, y, 0.09 * R * sc * small * k, 0.13 * R * small * k, 0, 0, TAU); ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.arc(x - 0.025 * R, y - 0.05 * R, 0.038 * R * small * k, 0, TAU); ctx.fill();
            ctx.beginPath(); ctx.arc(x + 0.035 * R, y + 0.05 * R, 0.016 * R, 0, TAU); ctx.fill();
            if (who === 'girl') {
                ctx.strokeStyle = C.eye; ctx.lineWidth = R * 0.03;
                ctx.beginPath(); ctx.moveTo(x + side * 0.07 * R, y - 0.1 * R); ctx.lineTo(x + side * 0.13 * R, y - 0.15 * R); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(x + side * 0.03 * R, y - 0.13 * R); ctx.lineTo(x + side * 0.06 * R, y - 0.19 * R); ctx.stroke();
            }
            if (face === 'sad' && side < 0) {
                ctx.fillStyle = 'rgba(140,205,255,0.9)';
                ctx.beginPath(); ctx.moveTo(x + 0.02 * R, y + 0.16 * R); ctx.quadraticCurveTo(x + 0.08 * R, y + 0.28 * R, x + 0.02 * R, y + 0.32 * R); ctx.quadraticCurveTo(x - 0.04 * R, y + 0.28 * R, x + 0.02 * R, y + 0.16 * R); ctx.fill();
            }
        });
        // Брови
        ctx.strokeStyle = C.brow; ctx.lineWidth = R * (who === 'grandpa' ? 0.1 : 0.055);
        const tilt = face === 'sad' ? -0.06 : face === 'strain' ? 0.07 : face === 'focus' ? 0.04 : 0;
        const lift = face === 'happy' ? -0.05 : face === 'sad' ? -0.02 : 0;
        ctx.beginPath(); ctx.moveTo(0.02 * R, (-0.13 + lift - tilt) * R); ctx.quadraticCurveTo(0.14 * R, (-0.22 + lift) * R, 0.27 * R, (-0.16 + lift + tilt) * R); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0.52 * R, (-0.16 + lift + tilt) * R); ctx.quadraticCurveTo(0.64 * R, (-0.23 + lift) * R, 0.75 * R, (-0.15 + lift - tilt) * R); ctx.stroke();
        // Рот (у дедушки — под усами)
        const mx = 0.58 * R, my = 0.6 * R;
        if (who !== 'grandpa') {
            ctx.strokeStyle = C.mouth; ctx.lineWidth = R * 0.05;
            if (face === 'happy') {
                const m = new Path2D();
                m.moveTo(mx - 0.2 * R, my - 0.06 * R); m.quadraticCurveTo(mx, my - 0.02 * R, mx + 0.2 * R, my - 0.08 * R);
                m.quadraticCurveTo(mx + 0.14 * R, my + 0.26 * R, mx - 0.02 * R, my + 0.24 * R); m.quadraticCurveTo(mx - 0.16 * R, my + 0.2 * R, mx - 0.2 * R, my - 0.06 * R); m.closePath();
                ctx.fillStyle = '#7a2833'; ctx.fill(m);
                ctx.save(); ctx.clip(m);
                ctx.fillStyle = '#ff8a94'; ctx.beginPath(); ctx.ellipse(mx, my + 0.22 * R, 0.13 * R, 0.09 * R, 0, 0, TAU); ctx.fill();
                ctx.fillStyle = '#ffffff'; ctx.fillRect(mx - 0.22 * R, my - 0.12 * R, 0.44 * R, 0.09 * R);
                ctx.restore();
            } else if (face === 'strain') {
                ctx.fillStyle = '#ffffff';
                ctx.beginPath(); ctx.roundRect(mx - 0.15 * R, my - 0.05 * R, 0.3 * R, 0.13 * R, 0.05 * R); ctx.fill();
                ctx.lineWidth = R * 0.03; ctx.stroke();
                ctx.beginPath(); ctx.moveTo(mx - 0.15 * R, my + 0.015 * R); ctx.lineTo(mx + 0.15 * R, my + 0.015 * R); ctx.stroke();
            } else if (face === 'sad') {
                ctx.beginPath(); ctx.moveTo(mx - 0.13 * R, my + 0.07 * R); ctx.quadraticCurveTo(mx, my - 0.04 * R, mx + 0.14 * R, my + 0.06 * R); ctx.stroke();
            } else if (face === 'focus') {
                ctx.fillStyle = '#7a2833';
                ctx.beginPath(); ctx.ellipse(mx + 0.02 * R, my + 0.02 * R, 0.055 * R, 0.05 * R, 0, 0, TAU); ctx.fill();
            } else {
                ctx.beginPath(); ctx.moveTo(mx - 0.16 * R, my - 0.05 * R); ctx.quadraticCurveTo(mx, my + 0.08 * R, mx + 0.16 * R, my - 0.06 * R); ctx.stroke();
            }
        }
        // Румянец, блик на носу, тень от козырька
        [[0.0, 0.42, 0.22], [0.8, 0.42, 0.15]].forEach(([bx, by, br]) => {
            const g = ctx.createRadialGradient(bx * R, by * R, 0, bx * R, by * R, br * R);
            g.addColorStop(0, C.cheek); g.addColorStop(1, 'rgba(255,110,120,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx * R, by * R, br * R, 0, TAU); ctx.fill();
        });
        if (who === 'boy') {
            ctx.fillStyle = 'rgba(185,105,65,0.45)';
            [[-0.04, 0.32], [0.06, 0.37], [-0.1, 0.4], [0.72, 0.34], [0.8, 0.38]].forEach(([px, py]) => { ctx.beginPath(); ctx.arc(px * R, py * R, R * 0.018, 0, TAU); ctx.fill(); });
        }
        ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.arc(0.98 * R, 0.23 * R, 0.03 * R, 0, TAU); ctx.fill();
        if (hasHat) {
            ctx.save(); ctx.clip(faceP);
            const fs = ctx.createLinearGradient(0, -0.45 * R, 0, -0.1 * R);
            fs.addColorStop(0, 'rgba(90,30,30,0.26)'); fs.addColorStop(1, 'rgba(90,30,30,0)');
            ctx.fillStyle = fs; ctx.fillRect(-R, -0.45 * R, 2 * R, 0.35 * R);
            ctx.restore();
        }
    }

    // ---------- Шапки (мягкие, козырёк вправо) ----------
    function drawHat(ctx, hat, R, fill, flat, col) {
        const a = col(hat.c.a), b = col(hat.c.b);
        const P2 = () => new Path2D();
        const shine = (x, y) => { if (flat) return; ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.ellipse(R * x, R * y, R * 0.28, R * 0.1, -0.35, 0, TAU); ctx.fill(); };
        const dome = (w, top, low) => {
            const p = P2();
            p.moveTo(-R * w, -R * low);
            p.bezierCurveTo(-R * w * 1.02, -R * (top + 0.22), R * w * 0.88, -R * (top + 0.26), R * w * 0.96, -R * (low + 0.1));
            p.quadraticCurveTo(0, -R * (low - 0.14), -R * w, -R * low);
            p.closePath();
            return p;
        };
        switch (hat.id) {
            case 'hat_panama':
            case 'hat_straw': {
                const wide = hat.id === 'hat_straw' ? 1.68 : 1.4;
                const brim = P2(); brim.ellipse(R * 0.08, -R * 0.44, R * wide, R * 0.28, -0.07, 0, TAU);
                fill(brim, a, [-R * wide, -R * 0.7, R * wide, -R * 0.2]);
                fill(dome(0.84, 1.02, 0.46), a, [-R, -R * 1.3, R, -R * 0.4]);
                if (!flat) {
                    ctx.fillStyle = b;
                    ctx.beginPath(); ctx.moveTo(-R * 0.84, -R * 0.53); ctx.quadraticCurveTo(0, -R * 0.42, R * 0.8, -R * 0.62); ctx.lineTo(R * 0.79, -R * 0.75); ctx.quadraticCurveTo(0, -R * 0.57, -R * 0.83, -R * 0.68); ctx.closePath(); ctx.fill();
                    if (hat.id === 'hat_straw') {
                        ctx.strokeStyle = 'rgba(160,122,50,0.45)'; ctx.lineWidth = R * 0.025;
                        for (let i = -7; i <= 7; i++) { ctx.beginPath(); ctx.moveTo(R * i * 0.21, -R * 0.56); ctx.lineTo(R * i * 0.23 + R * 0.08, -R * 0.28); ctx.stroke(); }
                    }
                }
                shine(-0.3, -0.92);
                break;
            }
            case 'hat_beanie': {
                fill(dome(1.05, 1.12, 0.3), a, [-R, -R * 1.4, R, -R * 0.3]);
                if (!flat) {
                    ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = R * 0.05;
                    for (let i = -4; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(R * i * 0.24, -R * 0.38); ctx.quadraticCurveTo(R * i * 0.22, -R * 0.8, R * i * 0.12, -R * 1.2); ctx.stroke(); }
                }
                const cuff = P2(); cuff.roundRect(-R * 1.08, -R * 0.52, R * 2.1, R * 0.32, R * 0.13);
                fill(cuff, b, [-R, -R * 0.55, R, -R * 0.2]);
                // Помпон: сначала общий контур, потом заливка — без линий внутри пушка
                const pom = P2();
                [[0, 0, 0.17], [-0.12, 0.04, 0.12], [0.12, 0.04, 0.12], [-0.06, -0.11, 0.12], [0.08, -0.1, 0.12], [0, 0.1, 0.12]].forEach(([x, y, r]) => { pom.moveTo(-R * 0.08 + x * R + r * R, -R * 1.3 + y * R); pom.arc(-R * 0.08 + x * R, -R * 1.3 + y * R, r * R, 0, TAU); });
                if (!flat) { ctx.strokeStyle = U.shade(b, -0.45); ctx.lineWidth = Math.max(3, R * 0.07); ctx.stroke(pom); }
                ctx.fillStyle = flat ? b : U.shade(b, 0.05); ctx.fill(pom);
                shine(-0.35, -0.85);
                break;
            }
            case 'hat_captain': {
                const band = P2(); band.roundRect(-R * 0.88, -R * 0.68, R * 1.76, R * 0.32, R * 0.06);
                fill(band, b);
                const topP = P2(); topP.ellipse(-R * 0.02, -R * 0.76, R * 1.08, R * 0.3, -0.06, 0, TAU);
                fill(topP, a, [-R * 1.1, -R * 1.06, R * 1.06, -R * 0.46]);
                const visor = P2(); visor.moveTo(R * 0.52, -R * 0.4); visor.quadraticCurveTo(R * 1.1, -R * 0.44, R * 1.32, -R * 0.24); visor.quadraticCurveTo(R * 0.9, -R * 0.22, R * 0.58, -R * 0.27); visor.closePath();
                fill(visor, col('#1e1e26'));
                if (!flat) { ctx.fillStyle = '#f2c43a'; ctx.beginPath(); ctx.moveTo(R * 0.42, -R * 0.66); ctx.lineTo(R * 0.52, -R * 0.52); ctx.lineTo(R * 0.42, -R * 0.42); ctx.lineTo(R * 0.32, -R * 0.52); ctx.closePath(); ctx.fill(); }
                break;
            }
            case 'hat_crown': {
                const cr = P2();
                cr.moveTo(-R * 0.74, -R * 0.62);
                [[-0.8, -1.3], [-0.38, -0.96], [0.02, -1.44], [0.42, -0.96], [0.82, -1.3], [0.76, -0.62]].forEach(([px, py]) => cr.lineTo(R * px, R * py));
                cr.closePath();
                fill(cr, a, [-R * 0.8, -R * 1.44, R * 0.82, -R * 0.62]);
                if (!flat) [[-0.38, '#e04a5a'], [0.02, '#3a8ad8'], [0.42, '#3aae6a']].forEach(([k, c]) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(R * k, -R * 0.76, R * 0.09, 0, TAU); ctx.fill(); });
                break;
            }
            case 'hat_pirate': {
                const tri = P2();
                tri.moveTo(-R * 1.32, -R * 0.4);
                tri.quadraticCurveTo(-R * 0.6, -R * 0.62, -R * 0.36, -R * 1.44);
                tri.quadraticCurveTo(R * 0.2, -R * 0.76, R * 1.4, -R * 0.58);
                tri.quadraticCurveTo(R * 0.1, -R * 0.2, -R * 1.32, -R * 0.4);
                tri.closePath();
                fill(tri, a, [-R * 1.3, -R * 1.44, R * 1.4, -R * 0.3]);
                if (!flat) {
                    ctx.fillStyle = '#f6f6f6'; ctx.beginPath(); ctx.arc(-R * 0.05, -R * 0.8, R * 0.14, 0, TAU); ctx.fill();
                    ctx.fillStyle = '#2a2a30'; ctx.beginPath(); ctx.arc(-R * 0.09, -R * 0.82, R * 0.035, 0, TAU); ctx.arc(R * 0.0, -R * 0.82, R * 0.035, 0, TAU); ctx.fill();
                }
                break;
            }
            default: {
                // Кепка: купол и козырёк вперёд
                fill(dome(1.02, 1.1, 0.38), a, [-R, -R * 1.25, R, -R * 0.3]);
                const brim = P2(); brim.moveTo(R * 0.42, -R * 0.48); brim.quadraticCurveTo(R * 1.26, -R * 0.64, R * 1.52, -R * 0.36); brim.quadraticCurveTo(R * 1.02, -R * 0.24, R * 0.46, -R * 0.3); brim.closePath();
                fill(brim, b);
                if (!flat) {
                    ctx.fillStyle = b; ctx.beginPath(); ctx.arc(R * 0.12, -R * 1.13, R * 0.07, 0, TAU); ctx.fill();
                    ctx.fillStyle = '#ffffff';
                    ctx.beginPath(); ctx.ellipse(R * 0.62, -R * 0.68, R * 0.1, R * 0.055, -0.2, 0, TAU); ctx.fill();
                    ctx.beginPath(); ctx.moveTo(R * 0.52, -R * 0.66); ctx.lineTo(R * 0.45, -R * 0.72); ctx.lineTo(R * 0.46, -R * 0.61); ctx.closePath(); ctx.fill();
                }
                shine(-0.3, -0.88);
            }
        }
    }
})(window.FB);
