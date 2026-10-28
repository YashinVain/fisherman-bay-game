// scene.js — сцена рыбалки на Canvas: небо, дальний берег, вода в перспективе,
// погода и всякая живность (утки, чайки, прыгающая рыба, стрекозы, светлячки).
//
// Вид — из-за спины рыбака: внизу мостки, вода уходит к горизонту.
// Точка на воде задаётся как (tx, dist): tx — влево/вправо (-1..1),
// dist — расстояние (0 = у мостков, 1 = у дальнего берега).
//
// Чтобы не тормозило на слабых телефонах, всё неподвижное (небо, берег, вода)
// рисуется один раз в два запасных холста и потом просто копируется.

(function (FB) {
    const SC = FB.scene = {};
    const U = FB.U;
    const Z_FAR = 8;

    // ---------- Места: цвета и что нарисовано на берегу ----------
    const THEMES = {
        village: {
            sky: ['#6cc4f4', '#d6f1ff'], water: ['#9ad8ea', '#2e8fb4'],
            life: ['ducks', 'birds', 'dragonflies'], lily: true, reeds: '#6a9a3a'
        },
        river: {
            sky: ['#7ccdf2', '#e0f5ff'], water: ['#8fd2cc', '#23807e'],
            life: ['birds', 'leaves', 'dragonflies'], reeds: '#5a8a3a', rocks: true
        },
        mountain: {
            sky: ['#4fb0ee', '#d4efff'], water: ['#8ccff0', '#1a5f9e'],
            life: ['birds'], rocks: true
        },
        swamp: {
            sky: ['#8cc9c0', '#e6f4e0'], water: ['#9cc4a0', '#3a6e58'],
            life: ['dragonflies', 'ducks'], lily: true, reeds: '#6a8a3a', cattails: true
        },
        sea: {
            sky: ['#5bbaf2', '#e2f5ff'], water: ['#8ad0f4', '#155ea8'],
            life: ['gulls', 'sails'], foam: true
        },
        tropic: {
            sky: ['#3cc0f0', '#dcfaff'], water: ['#7ff0e4', '#0f9cc0'],
            life: ['gulls'], foam: true
        },
        // Турнирная бухта: шатры с флажками, табло, гирлянда, буйки
        arena: {
            sky: ['#58baf4', '#e4f6ff'], water: ['#8ad6f0', '#1a6aa8'],
            life: ['gulls', 'birds'], buoys: true
        }
    };

    // Ночью и в дождь цвета приглушаются
    const WEATHER_SKY = {
        evening: ['#4a3a7a', '#ffa070'],
        rain: ['#7d93a8', '#c4d0da'],
        fog: ['#b8ccd8', '#eef3f5'],
        night: ['#0d1a44', '#2e4a8a']
    };

    // ---------- Размеры и перспектива ----------
    SC.init = (canvas) => {
        SC.canvas = canvas;
        SC.ctx = canvas.getContext('2d');
        SC.t = 0;
        SC.fx = [];        // брызги, круги на воде
        SC.life = [];      // утки, птицы и т. п.
        SC.clouds = [];
        SC.resize();
    };

    SC.resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, window.__maxDpr || 2);
        const W = window.innerWidth, H = window.innerHeight;
        SC.dpr = dpr; SC.W = W; SC.H = H;
        SC.canvas.width = Math.round(W * dpr);
        SC.canvas.height = Math.round(H * dpr);
        SC.canvas.style.width = W + 'px';
        SC.canvas.style.height = H + 'px';
        const portrait = H > W;
        const L = SC.L = {};
        L.portrait = portrait;
        L.hy = Math.round(H * (portrait ? 0.34 : 0.38));   // горизонт
        L.nearY = H * 0.9;
        L.cx = W * 0.5;
        // Рыбак сидит на краю мостков слева (px, py — где сидит, ph — рост сидя).
        // Ноги не должны прятаться за нижней панелью кнопок (~92 px)
        if (portrait) {
            L.ph = Math.min(H * 0.2, W * 0.42);
            L.px = W * 0.3;
            L.py = H - 96 - L.ph * 0.36;
        } else {
            L.ph = Math.min(H * 0.3, W * 0.22);
            L.px = Math.max(L.ph * 0.95, W * 0.19);
            L.py = Math.min(H * 0.76, H - 96 - L.ph * 0.36);
        }
        SC.dirty = true;
    };

    SC.project = (tx, dist) => {
        const L = SC.L;
        const z = 1 + dist * (Z_FAR - 1);
        return {
            x: L.cx + tx * SC.W * 0.55 / Math.pow(z, 0.62),
            y: L.hy + (L.nearY - L.hy) / z,
            s: 1 / Math.pow(z, 0.8)
        };
    };
    SC.unproject = (x, y) => {
        const L = SC.L;
        if (y <= L.hy + 2) return null;
        const z = Math.max(1, (L.nearY - L.hy) / (y - L.hy));
        return { tx: (x - L.cx) / (SC.W * 0.55) * Math.pow(z, 0.62), dist: (z - 1) / (Z_FAR - 1) };
    };
    // Масштаб «размера» на экране — от него зависят все детали
    SC.unit = () => Math.min(SC.W, SC.H) / 100;

    // ---------- Место и погода ----------
    // smooth — погода меняется в том же месте: старая картинка тает за пару секунд,
    // а утки, брызги и всё живое остаются на месте
    SC.setPlace = (pondId, weather, smooth) => {
        const pond = FB.pondById[pondId];
        const same = SC.pond === pondId;
        if (smooth && same && SC.weather && weather !== SC.weather && SC.skyLayer && !SC.dirty) startFade();
        else SC.fade = null;
        SC.pond = pondId;
        SC.theme = pond.theme;
        SC.weather = weather;
        SC.dirty = true;
        if (!(smooth && same)) { SC.life = []; SC.fx = []; }
        initClouds();
        if (!SC.fade) { SC.rainK = weather === 'rain' ? 1 : 0; SC.fogK = weather === 'fog' ? 1 : 0; }
        if (FB.audio && FB.audio.setScene) FB.audio.setScene(pond.theme, weather);
    };

    // Снимок старого неба, облаков и берега — он будет плавно растворяться поверх нового
    SC.FADE_TIME = 3;
    SC.rainK = 0; SC.fogK = 0;
    function startFade() {
        const W = SC.W, H = SC.H, dpr = SC.dpr;
        const c = document.createElement('canvas');
        c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
        const x = c.getContext('2d');
        x.setTransform(dpr, 0, 0, dpr, 0, 0);
        x.drawImage(SC.skyLayer, 0, 0, W, H);
        SC.clouds.forEach(cl => x.drawImage(cl.img, cl.x, cl.y));
        x.drawImage(SC.landLayer, 0, 0, W, H);
        SC.fade = { c, near: SC.nearLayer, k: 0, prev: SC.weather };
    }
    // Запасной холст для «старого» переднего плана (рыбак, мостки, лодка) во время смены погоды
    let frontBuf = null;
    function frontCanvas() {
        if (!frontBuf) frontBuf = document.createElement('canvas');
        const w = SC.canvas.width, h = SC.canvas.height;
        if (frontBuf.width !== w || frontBuf.height !== h) { frontBuf.width = w; frontBuf.height = h; }
        const x = frontBuf.getContext('2d');
        x.setTransform(1, 0, 0, 1, 0, 0);
        x.clearRect(0, 0, w, h);
        x.setTransform(SC.dpr, 0, 0, SC.dpr, 0, 0);
        return x;
    }

    // ---------- Турнирная бухта ----------
    function tent(ctx, x, y, s, a, b, night) {
        ctx.save();
        ctx.translate(x, y);
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(40,40,60,0.55)';
        ctx.lineWidth = Math.max(1, s * 0.04);
        // Полосатый купол
        ctx.beginPath(); ctx.moveTo(-s, 0); ctx.lineTo(0, -s * 0.95); ctx.lineTo(s, 0); ctx.closePath();
        ctx.fillStyle = a; ctx.fill();
        ctx.save(); ctx.clip();
        ctx.fillStyle = b;
        for (let i = -3; i < 3; i += 2) { ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(i * s * 0.34, 0); ctx.lineTo((i + 1) * s * 0.34, 0); ctx.closePath(); ctx.fill(); }
        ctx.restore();
        ctx.stroke();
        // Вход
        ctx.fillStyle = night ? '#ffd86a' : 'rgba(40,30,30,0.55)';
        ctx.beginPath(); ctx.moveTo(-s * 0.18, 0); ctx.lineTo(0, -s * 0.42); ctx.lineTo(s * 0.18, 0); ctx.closePath(); ctx.fill();
        // Флажок на макушке
        ctx.strokeStyle = '#5a4a3a'; ctx.lineWidth = Math.max(1, s * 0.035);
        ctx.beginPath(); ctx.moveTo(0, -s * 0.95); ctx.lineTo(0, -s * 1.35); ctx.stroke();
        ctx.fillStyle = b;
        ctx.beginPath(); ctx.moveTo(0, -s * 1.35); ctx.lineTo(s * 0.32, -s * 1.25); ctx.lineTo(0, -s * 1.15); ctx.closePath(); ctx.fill();
        ctx.restore();
    }
    function scoreboard(ctx, x, y, s, night) {
        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = '#6a4a2a';
        ctx.fillRect(-s * 0.9, -s * 0.9, s * 0.08, s * 0.9);
        ctx.fillRect(s * 0.82, -s * 0.9, s * 0.08, s * 0.9);
        const g = ctx.createLinearGradient(0, -s * 1.5, 0, -s * 0.8);
        g.addColorStop(0, '#2a5ab0'); g.addColorStop(1, '#1a3a80');
        ctx.fillStyle = g;
        ctx.strokeStyle = '#f2c43a'; ctx.lineWidth = Math.max(1.5, s * 0.06);
        ctx.beginPath(); ctx.rect(-s, -s * 1.55, s * 2, s * 0.72); ctx.fill(); ctx.stroke();
        ctx.fillStyle = night ? '#ffe680' : '#ffd23a';
        ctx.font = '900 ' + Math.round(s * 0.36) + 'px Nunito, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText((FB.t ? FB.t('arena_sign') : 'CUP').toUpperCase(), 0, -s * 1.2);
        // Кубок сбоку
        ctx.fillStyle = '#ffd23a'; ctx.strokeStyle = '#8a5a06'; ctx.lineWidth = Math.max(1, s * 0.03);
        ctx.beginPath(); ctx.moveTo(s * 1.05, -s * 1.5); ctx.lineTo(s * 1.35, -s * 1.5); ctx.quadraticCurveTo(s * 1.35, -s * 1.15, s * 1.2, -s * 1.12); ctx.quadraticCurveTo(s * 1.05, -s * 1.15, s * 1.05, -s * 1.5); ctx.fill(); ctx.stroke();
        ctx.fillRect(s * 1.17, -s * 1.12, s * 0.06, s * 0.14);
        ctx.fillRect(s * 1.1, -s * 0.98, s * 0.2, s * 0.05);
        ctx.restore();
    }
    // Гирлянда флажков между двумя точками (провисает дугой)
    function bunting(ctx, x0, y0, x1, y1, sag, size) {
        const cols = ['#e8402a', '#f2c43a', '#3aa84a', '#3a8ae0', '#d85ac8', '#ff8a3a'];
        ctx.strokeStyle = 'rgba(60,50,40,0.7)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2, Math.max(y0, y1) + sag, x1, y1); ctx.stroke();
        const n = Math.max(6, Math.round(Math.abs(x1 - x0) / (size * 1.6)));
        for (let i = 1; i < n; i++) {
            const t = i / n, mt = 1 - t;
            const x = mt * mt * x0 + 2 * mt * t * (x0 + x1) / 2 + t * t * x1;
            const y = mt * mt * y0 + 2 * mt * t * (Math.max(y0, y1) + sag) + t * t * y1;
            ctx.fillStyle = cols[i % cols.length];
            ctx.beginPath(); ctx.moveTo(x - size * 0.5, y); ctx.lineTo(x + size * 0.5, y); ctx.lineTo(x, y + size * 1.1); ctx.closePath(); ctx.fill();
        }
    }
    function buoy(ctx, x, y, r) {
        ctx.fillStyle = 'rgba(10,40,70,0.18)';
        ctx.beginPath(); ctx.ellipse(x, y + r * 0.2, r * 1.4, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f2f2f2';
        ctx.beginPath(); ctx.arc(x, y - r * 0.4, r, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#e8402a';
        ctx.fillRect(x - r, y - r * 0.4, r * 2, r * 0.35);
        ctx.beginPath(); ctx.arc(x, y - r * 0.4, r * 0.55, Math.PI, 0); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(x, y, r * 1.3, r * 0.3, 0, 0, Math.PI * 2); ctx.stroke();
    }

    // ---------- Рисовалки природы ----------
    function hills(ctx, W, baseY, amp, color, rnd, waves) {
        const ph = [rnd() * 6, rnd() * 6, rnd() * 6];
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(0, baseY + amp * 2);
        for (let x = 0; x <= W + 8; x += 8) {
            const k = x / W;
            const y = baseY - amp * (0.55 + 0.25 * Math.sin(k * waves * 3 + ph[0]) + 0.15 * Math.sin(k * waves * 7 + ph[1]) + 0.05 * Math.sin(k * waves * 17 + ph[2]));
            ctx.lineTo(x, y);
        }
        ctx.lineTo(W, baseY + amp * 2);
        ctx.closePath();
        ctx.fill();
    }

    function mountains(ctx, W, baseY, h, color, snow, rnd) {
        const peaks = [];
        let x = -W * 0.1;
        while (x < W * 1.1) {
            const w = W * U.lerp(0.16, 0.3, rnd());
            peaks.push({ x: x + w / 2, w, h: h * U.lerp(0.6, 1, rnd()) });
            x += w * 0.62;
        }
        peaks.forEach(p => {
            const top = baseY - p.h;
            const g = ctx.createLinearGradient(p.x - p.w / 2, 0, p.x + p.w / 2, 0);
            g.addColorStop(0, U.shade(color, 0.12));
            g.addColorStop(0.5, color);
            g.addColorStop(0.51, U.shade(color, -0.12));
            g.addColorStop(1, U.shade(color, -0.18));
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(p.x - p.w / 2, baseY + 2);
            ctx.lineTo(p.x - p.w * 0.06, top + p.h * 0.03);
            ctx.quadraticCurveTo(p.x, top - p.h * 0.02, p.x + p.w * 0.06, top + p.h * 0.03);
            ctx.lineTo(p.x + p.w / 2, baseY + 2);
            ctx.closePath();
            ctx.fill();
            if (snow) {
                ctx.fillStyle = '#ffffff';
                const sh = p.h * 0.3;
                ctx.beginPath();
                ctx.moveTo(p.x - p.w * 0.06, top + p.h * 0.03);
                ctx.quadraticCurveTo(p.x, top - p.h * 0.02, p.x + p.w * 0.06, top + p.h * 0.03);
                ctx.lineTo(p.x + p.w * 0.19, top + sh);
                ctx.lineTo(p.x + p.w * 0.1, top + sh * 0.8);
                ctx.lineTo(p.x + p.w * 0.03, top + sh * 1.05);
                ctx.lineTo(p.x - p.w * 0.06, top + sh * 0.75);
                ctx.lineTo(p.x - p.w * 0.17, top + sh);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = 'rgba(160,190,220,0.45)';
                ctx.beginPath();
                ctx.moveTo(p.x, top);
                ctx.quadraticCurveTo(p.x + p.w * 0.02, top + p.h * 0.02, p.x + p.w * 0.06, top + p.h * 0.03);
                ctx.lineTo(p.x + p.w * 0.19, top + sh);
                ctx.lineTo(p.x + p.w * 0.1, top + sh * 0.8);
                ctx.lineTo(p.x + p.w * 0.03, top + sh * 1.05);
                ctx.closePath();
                ctx.fill();
            }
        });
    }

    function pine(ctx, x, y, h, color) {
        const w = h * 0.42;
        ctx.fillStyle = U.shade(color, -0.35);
        ctx.fillRect(x - h * 0.03, y - h * 0.12, h * 0.06, h * 0.14);
        for (let i = 0; i < 3; i++) {
            const ty = y - h * 0.1 - i * h * 0.26;
            const tw = w * (1 - i * 0.24);
            ctx.fillStyle = i % 2 ? color : U.shade(color, 0.08);
            ctx.beginPath();
            ctx.moveTo(x - tw / 2, ty);
            ctx.quadraticCurveTo(x, ty + h * 0.04, x + tw / 2, ty);
            ctx.lineTo(x, ty - h * 0.42);
            ctx.closePath();
            ctx.fill();
        }
    }
    function forest(ctx, W, baseY, h, color, rnd, gap) {
        for (let x = -10; x < W + 20; x += h * (gap || 0.22) * U.lerp(0.7, 1.3, rnd())) {
            pine(ctx, x, baseY + rnd() * h * 0.06, h * U.lerp(0.7, 1.15, rnd()), color);
        }
    }
    function roundTree(ctx, x, y, r, color) {
        ctx.fillStyle = U.shade(color, -0.45);
        ctx.fillRect(x - r * 0.12, y - r * 0.6, r * 0.24, r * 0.7);
        const blobs = [[0, -1.2, 0.95], [-0.62, -0.85, 0.7], [0.62, -0.85, 0.72], [0, -1.75, 0.6]];
        blobs.forEach(([bx, by, br]) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x + bx * r, y + by * r, br * r, 0, Math.PI * 2); ctx.fill(); });
        ctx.fillStyle = U.rgba('#ffffff', 0.16);
        ctx.beginPath(); ctx.arc(x - r * 0.25, y - r * 1.55, r * 0.42, 0, Math.PI * 2); ctx.fill();
    }
    function house(ctx, x, y, s, wall, roof, night) {
        ctx.fillStyle = wall;
        ctx.fillRect(x - s * 0.5, y - s * 0.6, s, s * 0.6);
        ctx.fillStyle = roof;
        ctx.beginPath(); ctx.moveTo(x - s * 0.62, y - s * 0.58); ctx.lineTo(x, y - s * 1.05); ctx.lineTo(x + s * 0.62, y - s * 0.58); ctx.closePath(); ctx.fill();
        ctx.fillStyle = night ? '#ffd86a' : '#bfe6f6';
        ctx.fillRect(x - s * 0.3, y - s * 0.42, s * 0.18, s * 0.16);
        ctx.fillRect(x + s * 0.12, y - s * 0.42, s * 0.18, s * 0.16);
        ctx.fillStyle = U.shade(wall, -0.4);
        ctx.fillRect(x - s * 0.06, y - s * 0.3, s * 0.12, s * 0.3);
        ctx.fillStyle = U.shade(roof, -0.3);
        ctx.fillRect(x + s * 0.24, y - s * 0.98, s * 0.1, s * 0.22);
    }
    // Камыш растёт из воды: основания стеблей на разной глубине и растворяются
    // в воде, под куртиной — тень от корней, у стеблей — отражения и круги
    function reeds(ctx, x0, x1, baseY, h, color, rnd, cattail) {
        ctx.lineCap = 'round';
        const stems = [];
        for (let x = x0; x < x1; x += h * 0.05 * U.lerp(0.5, 1.5, rnd())) {
            // Куртина гуще в середине: по краям стебли ниже
            const edge = Math.min(1, Math.min(x - x0, x1 - x) / ((x1 - x0) * 0.3 + 1));
            const hh = h * U.lerp(0.5, 1, rnd()) * U.lerp(0.55, 1, edge);
            stems.push({
                x, hh, by: baseY + U.lerp(-0.05, 0.09, rnd()) * h,
                lean: U.lerp(-0.25, 0.25, rnd()) * hh,
                col: rnd() < 0.5 ? color : U.shade(color, -0.2),
                tail: cattail && rnd() < 0.35
            });
        }
        // Тень от корней под водой
        const cx = (x0 + x1) / 2, rx = (x1 - x0) * 0.62 + h * 0.1, ry = h * 0.11;
        ctx.save();
        ctx.translate(cx, baseY + h * 0.03);
        ctx.scale(1, ry / rx);
        const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
        sh.addColorStop(0, 'rgba(18,60,48,0.3)');
        sh.addColorStop(0.6, 'rgba(18,60,48,0.14)');
        sh.addColorStop(1, 'rgba(18,60,48,0)');
        ctx.fillStyle = sh;
        ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        const lw = Math.max(1.5, h * 0.025);
        // Отражения — короткие, бледные, вниз
        stems.forEach(s => {
            const g = ctx.createLinearGradient(0, s.by, 0, s.by + s.hh * 0.3);
            g.addColorStop(0, U.rgba(U.shade(s.col, -0.25), 0.3));
            g.addColorStop(1, U.rgba(U.shade(s.col, -0.25), 0));
            ctx.strokeStyle = g;
            ctx.lineWidth = lw;
            ctx.beginPath(); ctx.moveTo(s.x, s.by); ctx.lineTo(s.x - s.lean * 0.15, s.by + s.hh * 0.3); ctx.stroke();
        });
        // Стебли: у воды прозрачные — будто уходят под воду
        stems.forEach(s => {
            const g = ctx.createLinearGradient(0, s.by, 0, s.by - s.hh * 0.12);
            g.addColorStop(0, U.rgba(s.col, 0.55));
            g.addColorStop(1, U.rgba(s.col, 1));
            ctx.strokeStyle = g;
            ctx.lineWidth = lw;
            ctx.beginPath();
            ctx.moveTo(s.x, s.by);
            ctx.quadraticCurveTo(s.x + s.lean * 0.2, s.by - s.hh * 0.6, s.x + s.lean, s.by - s.hh);
            ctx.stroke();
            if (s.tail) {
                ctx.fillStyle = '#6a4226';
                ctx.beginPath();
                ctx.ellipse(s.x + s.lean * 0.86, s.by - s.hh * 0.86, h * 0.022, h * 0.075, s.lean / s.hh * 0.8, 0, Math.PI * 2);
                ctx.fill();
            }
        });
        // Круги на воде у некоторых стеблей
        ctx.lineWidth = Math.max(1, h * 0.008);
        stems.forEach((s, i) => {
            if (i % 4) return;
            ctx.strokeStyle = 'rgba(255,255,255,0.22)';
            ctx.beginPath(); ctx.ellipse(s.x, s.by + h * 0.004, h * 0.045, h * 0.012, 0, 0, Math.PI * 2); ctx.stroke();
        });
    }
    function lily(ctx, x, y, rx, flower) {
        const ry = rx * 0.38;
        ctx.fillStyle = '#4f9a3c';
        ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0.25, Math.PI * 2 - 0.05); ctx.lineTo(x, y); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.beginPath(); ctx.ellipse(x - rx * 0.2, y - ry * 0.25, rx * 0.5, ry * 0.4, 0, 0, Math.PI * 2); ctx.fill();
        if (flower) {
            const r = rx * 0.32;
            for (let i = 0; i < 6; i++) {
                const a = -Math.PI / 2 + (i - 2.5) * 0.42;
                ctx.fillStyle = i % 2 ? '#ffd6e8' : '#ffb8d6';
                ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * r * 0.6, y - r * 0.3 + Math.sin(a) * r * 0.4, r * 0.32, r * 0.7, a + Math.PI / 2, 0, Math.PI * 2); ctx.fill();
            }
            ctx.fillStyle = '#ffd84a';
            ctx.beginPath(); ctx.arc(x, y - r * 0.35, r * 0.22, 0, Math.PI * 2); ctx.fill();
        }
    }
    function rock(ctx, x, y, w, h, color) {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x - w / 2, y);
        ctx.quadraticCurveTo(x - w * 0.45, y - h, x, y - h);
        ctx.quadraticCurveTo(x + w * 0.45, y - h * 0.95, x + w / 2, y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.beginPath(); ctx.ellipse(x - w * 0.12, y - h * 0.7, w * 0.18, h * 0.16, -0.4, 0, Math.PI * 2); ctx.fill();
    }
    function palm(ctx, x, y, h, lean, color) {
        ctx.strokeStyle = '#a8784a';
        ctx.lineWidth = h * 0.07;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + lean * h * 0.2, y - h * 0.6, x + lean * h * 0.5, y - h); ctx.stroke();
        const tx = x + lean * h * 0.5, ty = y - h;
        ctx.fillStyle = color;
        for (let i = 0; i < 7; i++) {
            const a = -Math.PI + i * Math.PI / 6 + 0.1;
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.quadraticCurveTo(tx + Math.cos(a) * h * 0.35, ty + Math.sin(a) * h * 0.35 - h * 0.12, tx + Math.cos(a) * h * 0.55, ty + Math.sin(a) * h * 0.3 + h * 0.12);
            ctx.quadraticCurveTo(tx + Math.cos(a) * h * 0.3, ty + Math.sin(a) * h * 0.2, tx, ty);
            ctx.fill();
        }
        ctx.fillStyle = '#6a4a2a';
        ctx.beginPath(); ctx.arc(tx - h * 0.03, ty + h * 0.04, h * 0.035, 0, Math.PI * 2); ctx.arc(tx + h * 0.04, ty + h * 0.05, h * 0.035, 0, Math.PI * 2); ctx.fill();
    }
    function lighthouse(ctx, x, y, h, night) {
        const w = h * 0.22;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.lineTo(x - w * 0.32, y - h * 0.8); ctx.lineTo(x + w * 0.32, y - h * 0.8); ctx.lineTo(x + w / 2, y); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#e04a3a';
        [0.15, 0.45].forEach(k => {
            const y0 = y - h * k, y1 = y - h * (k + 0.15);
            const wa = U.lerp(w / 2, w * 0.32, k / 0.8), wb = U.lerp(w / 2, w * 0.32, (k + 0.15) / 0.8);
            ctx.beginPath(); ctx.moveTo(x - wa, y0); ctx.lineTo(x - wb, y1); ctx.lineTo(x + wb, y1); ctx.lineTo(x + wa, y0); ctx.closePath(); ctx.fill();
        });
        ctx.fillStyle = night ? '#fff2a0' : '#ffe9a8';
        ctx.fillRect(x - w * 0.24, y - h * 0.94, w * 0.48, h * 0.14);
        ctx.fillStyle = '#e04a3a';
        ctx.beginPath(); ctx.moveTo(x - w * 0.36, y - h * 0.94); ctx.lineTo(x, y - h * 1.06); ctx.lineTo(x + w * 0.36, y - h * 0.94); ctx.closePath(); ctx.fill();
    }
    function willow(ctx, x, y, h, color) {
        ctx.fillStyle = '#5a4630';
        ctx.fillRect(x - h * 0.04, y - h * 0.6, h * 0.08, h * 0.6);
        ctx.strokeStyle = color;
        ctx.lineCap = 'round';
        ctx.lineWidth = h * 0.05;
        for (let i = -5; i <= 5; i++) {
            ctx.beginPath();
            ctx.moveTo(x + i * h * 0.03, y - h * 0.62);
            ctx.quadraticCurveTo(x + i * h * 0.09, y - h * 0.82, x + i * h * 0.07 + (i < 0 ? -1 : 1) * h * 0.06, y - h * 0.18 - Math.abs(i) * h * 0.03);
            ctx.stroke();
        }
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.ellipse(x, y - h * 0.7, h * 0.36, h * 0.16, 0, 0, Math.PI * 2); ctx.fill();
    }

    // ---------- Облака (спрайты) ----------
    function cloudSprite(w, color, shade) {
        const c = document.createElement('canvas');
        c.width = Math.ceil(w); c.height = Math.ceil(w * 0.5);
        const x = c.getContext('2d');
        const puffs = [[0.25, 0.68, 0.17], [0.42, 0.5, 0.22], [0.62, 0.55, 0.19], [0.78, 0.7, 0.14], [0.5, 0.74, 0.2]];
        x.fillStyle = shade;
        puffs.forEach(([px, py, r]) => { x.beginPath(); x.arc(px * w, py * w * 0.5 + w * 0.03, r * w, 0, Math.PI * 2); x.fill(); });
        x.fillStyle = color;
        puffs.forEach(([px, py, r]) => { x.beginPath(); x.arc(px * w, py * w * 0.5, r * w * 0.96, 0, Math.PI * 2); x.fill(); });
        // Лёгкий блик только у светлых облаков (у тёмных он похож на глаз)
        if (color === '#ffffff') {
            x.fillStyle = 'rgba(255,255,255,0.55)';
            x.beginPath(); x.ellipse(0.38 * w, 0.36 * w * 0.5, 0.16 * w, 0.07 * w, -0.2, 0, Math.PI * 2); x.fill();
        }
        return c;
    }
    function initClouds() {
        const W = SC.W, L = SC.L;
        const wx = SC.weather;
        const n = wx === 'rain' ? 7 : wx === 'night' ? 3 : wx === 'fog' ? 4 : 5;
        const color = wx === 'rain' ? '#9aa8b6' : wx === 'night' ? '#3a4c80' : wx === 'fog' ? '#f2f6f8' : wx === 'evening' ? '#ffc0a0' : '#ffffff';
        const shade = wx === 'rain' ? '#7a8898' : wx === 'night' ? '#2a3a6a' : wx === 'evening' ? '#b8708a' : '#d8e8f4';
        SC.clouds = [];
        for (let i = 0; i < n; i++) {
            const w = SC.unit() * U.rand(14, 30) * (L.portrait ? 1.3 : 1);
            SC.clouds.push({ img: cloudSprite(w, color, shade), x: U.rand(-0.1, 1.1) * W, y: U.rand(0.04, 0.6) * (L.hy * 0.8), v: U.rand(2, 6) * SC.unit() / 10 });
        }
    }

    // ---------- Сборка неподвижных слоёв ----------
    function buildLayers() {
        const W = SC.W, H = SC.H, L = SC.L, dpr = SC.dpr;
        const th = THEMES[SC.theme] || THEMES.village;
        const wx = SC.weather;
        const night = wx === 'night';
        const rnd = U.seeded(SC.theme.length * 977 + 13);
        const mk = () => { const c = document.createElement('canvas'); c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); const x = c.getContext('2d'); x.scale(dpr, dpr); return [c, x]; };

        // --- Небо ---
        const [skyC, s] = mk();
        const sky = WEATHER_SKY[wx] || th.sky;
        const sg = s.createLinearGradient(0, 0, 0, L.hy);
        sg.addColorStop(0, sky[0]);
        sg.addColorStop(1, wx === 'sun' ? U.mix(sky[1], '#fff3d0', 0.25) : sky[1]);
        s.fillStyle = sg;
        s.fillRect(0, 0, W, L.hy + 2);
        SC.sun = wx === 'evening'
            ? { x: W * (L.portrait ? 0.72 : 0.78), y: L.hy - SC.unit() * 3, r: SC.unit() * 8 }
            : { x: W * (L.portrait ? 0.76 : 0.8), y: L.hy * 0.3, r: SC.unit() * 5.5 };
        if (night) {
            const sr = U.seeded(77);
            for (let i = 0; i < 120; i++) {
                s.fillStyle = 'rgba(255,255,255,' + U.lerp(0.3, 0.95, sr()) + ')';
                s.beginPath(); s.arc(sr() * W, sr() * L.hy * 0.9, U.lerp(0.4, 1.6, sr()), 0, Math.PI * 2); s.fill();
            }
            // Луна
            const m = SC.sun;
            const mg = s.createRadialGradient(m.x, m.y, m.r * 0.5, m.x, m.y, m.r * 4);
            mg.addColorStop(0, 'rgba(255,250,220,0.35)'); mg.addColorStop(1, 'rgba(255,250,220,0)');
            s.fillStyle = mg; s.fillRect(m.x - m.r * 4, m.y - m.r * 4, m.r * 8, m.r * 8);
            s.fillStyle = '#fff8dc'; s.beginPath(); s.arc(m.x, m.y, m.r, 0, Math.PI * 2); s.fill();
            s.fillStyle = 'rgba(200,190,150,0.35)';
            [[-0.3, -0.2, 0.22], [0.25, 0.2, 0.16], [0.1, -0.4, 0.1]].forEach(([dx, dy, r]) => { s.beginPath(); s.arc(m.x + dx * m.r, m.y + dy * m.r, r * m.r, 0, Math.PI * 2); s.fill(); });
        } else if (wx === 'evening') {
            // Закатное солнце садится за дальний берег
            const m = SC.sun;
            const glow = s.createRadialGradient(m.x, m.y, m.r * 0.5, m.x, m.y, m.r * 9);
            glow.addColorStop(0, 'rgba(255,236,170,1)'); glow.addColorStop(0.2, 'rgba(255,180,110,0.6)'); glow.addColorStop(1, 'rgba(255,150,100,0)');
            s.fillStyle = glow; s.fillRect(0, 0, W, L.hy + 2);
            s.fillStyle = '#fff1c0'; s.beginPath(); s.arc(m.x, m.y, m.r, 0, Math.PI * 2); s.fill();
        } else if (wx === 'sun') {
            const m = SC.sun;
            const glow = s.createRadialGradient(m.x, m.y, m.r * 0.6, m.x, m.y, m.r * 7);
            glow.addColorStop(0, 'rgba(255,248,200,0.9)'); glow.addColorStop(0.25, 'rgba(255,240,180,0.35)'); glow.addColorStop(1, 'rgba(255,240,180,0)');
            s.fillStyle = glow; s.fillRect(m.x - m.r * 7, m.y - m.r * 7, m.r * 14, m.r * 14);
            s.fillStyle = '#fff6c8'; s.beginPath(); s.arc(m.x, m.y, m.r, 0, Math.PI * 2); s.fill();
        }

        // --- Берег и вода ---
        const [landC, c] = mk();
        const hy = L.hy;
        const u = SC.unit();
        const far = (col) => U.mix(col, sky[1], wx === 'fog' ? 0.55 : 0.35);   // дымка вдали
        switch (SC.theme) {
            case 'village':
                hills(c, W, hy - u * 1, u * 10, far('#86c46a'), rnd, 2);
                for (let i = 0; i < 9; i++) roundTree(c, rnd() * W, hy - u * U.lerp(2, 5, rnd()), u * U.lerp(1.6, 2.6, rnd()), far(rnd() < 0.5 ? '#5aa04a' : '#6ab452'));
                house(c, W * 0.22, hy - u * 2.2, u * 5, '#f4e2c4', '#d8573e', night);
                house(c, W * 0.3, hy - u * 1.6, u * 3.6, '#f0d8b0', '#c8483a', night);
                house(c, W * 0.66, hy - u * 1.8, u * 4, '#f6ead6', '#3e7ac8', night);
                hills(c, W, hy + 1, u * 3, '#6cb85a', rnd, 3);
                for (let i = 0; i < 6; i++) roundTree(c, rnd() * W, hy + u * 0.4, u * U.lerp(1.6, 2.4, rnd()), rnd() < 0.5 ? '#4f9a3e' : '#5fae48');
                break;
            case 'river':
                hills(c, W, hy - u * 4, u * 9, far('#5f9a6a'), rnd, 2);
                forest(c, W, hy - u * 2.5, u * 8, far('#3f7a4c'), rnd, 0.24);
                forest(c, W, hy + 1, u * 9, '#2f6a3c', rnd, 0.2);
                break;
            case 'mountain':
                mountains(c, W, hy - u * 2, u * 30, far('#7a92b8'), true, rnd);
                mountains(c, W, hy, u * 17, far('#6a8a9a'), true, rnd);
                forest(c, W, hy - u * 0.5, u * 6.5, far('#3e6a58'), rnd, 0.2);
                forest(c, W, hy + 1, u * 5.5, '#2e5a48', rnd, 0.18);
                break;
            case 'swamp':
                hills(c, W, hy - u * 1, u * 6, far('#7aa070'), rnd, 2);
                for (let i = 0; i < 5; i++) willow(c, rnd() * W, hy + u * 0.5, u * U.lerp(9, 13, rnd()), far(rnd() < 0.5 ? '#6a9a4a' : '#7aa85a'));
                reeds(c, 0, W, hy + 2, u * 4, '#6a8a3a', rnd, true);
                break;
            case 'sea': {
                // Мыс с маяком и далёкий парус
                c.fillStyle = far('#9ab06a');
                c.beginPath(); c.moveTo(W * 0.62, hy + 1); c.quadraticCurveTo(W * 0.75, hy - u * 7, W * 1.05, hy - u * 6); c.lineTo(W * 1.05, hy + 1); c.closePath(); c.fill();
                c.fillStyle = far('#c8b07a');
                c.beginPath(); c.moveTo(W * 0.6, hy + 1); c.quadraticCurveTo(W * 0.7, hy - u * 2, W * 0.8, hy - u * 2.5); c.lineTo(W * 0.8, hy + 1); c.closePath(); c.fill();
                lighthouse(c, W * 0.86, hy - u * 5.5, u * 12, night);
                break;
            }
            case 'arena': {
                hills(c, W, hy - u * 2, u * 8, far('#8ac47a'), rnd, 2);
                // Песчаный берег с шатрами и табло
                c.fillStyle = far('#f0dca8');
                c.beginPath(); c.moveTo(0, hy + 1); c.quadraticCurveTo(W * 0.5, hy - u * 3.2, W, hy + 1); c.closePath(); c.fill();
                const tents = [[0.07, '#e8402a', '#ffffff'], [0.19, '#3a8ae0', '#ffffff'], [0.31, '#f2c43a', '#e8402a'], [0.79, '#3aa84a', '#ffffff'], [0.92, '#d85ac8', '#ffffff']];
                tents.forEach(([kx, a, b2]) => tent(c, W * kx, hy - u * 0.4, u * U.lerp(4.2, 5.4, rnd()), far(a), b2, night));
                scoreboard(c, W * 0.64, hy - u * 0.4, u * 6, night);
                bunting(c, W * 0.05, hy - u * 7, W * 0.32, hy - u * 7.5, u * 2.5, u * 1.1);
                bunting(c, W * 0.55, hy - u * 7.5, W * 0.95, hy - u * 6.5, u * 3, u * 1.1);
                break;
            }
            case 'tropic': {
                c.fillStyle = '#f2dca0';
                c.beginPath(); c.ellipse(W * 0.3, hy + 1, W * 0.2, u * 2.4, 0, Math.PI, 0); c.fill();
                c.fillStyle = '#5fbf5a';
                c.beginPath(); c.ellipse(W * 0.3, hy - u * 0.8, W * 0.14, u * 2.2, 0, Math.PI, 0); c.fill();
                palm(c, W * 0.22, hy - u * 0.5, u * 12, -0.4, '#3fa84a');
                palm(c, W * 0.32, hy - u * 1.2, u * 15, 0.3, '#4fb85a');
                palm(c, W * 0.4, hy - u * 0.4, u * 10, 0.5, '#3a9a44');
                c.fillStyle = far('#8ac070');
                c.beginPath(); c.ellipse(W * 0.82, hy + 1, W * 0.12, u * 3, 0, Math.PI, 0); c.fill();
                break;
            }
        }

        if (wx === 'evening') {
            c.save();
            c.globalCompositeOperation = 'source-atop';
            c.fillStyle = 'rgba(80,40,100,0.38)';
            c.fillRect(0, 0, W, H);
            c.restore();
        }
        // Вода
        const water = th.water.map((col, i) => wx === 'evening' ? U.mix(col, i ? '#3a2a6a' : '#ffb080', i ? 0.62 : 0.72) : night ? U.mix(col, '#0a1840', 0.55) : wx === 'rain' ? U.mix(col, '#6a7c8c', 0.35) : wx === 'fog' ? U.mix(col, '#c8d4da', 0.3) : col);
        // Плавный переход: у горизонта — отсвет неба, дальше — цвет воды, у берега — глубина.
        // Много промежуточных точек со сглаживанием — иначе на стыке видна полоса
        const wg = c.createLinearGradient(0, hy, 0, H);
        const top = U.mix(water[0], sky[1], 0.35);
        for (let i = 0; i <= 16; i++) {
            const t = i / 16;
            const col = t < 0.2 ? U.mix(top, water[0], U.smooth(t / 0.2)) : U.mix(water[0], water[1], U.smooth((t - 0.2) / 0.8));
            wg.addColorStop(t, col);
        }
        c.fillStyle = wg;
        c.fillRect(0, hy, W, H - hy);

        // Отражение неба и берега в воде (перевёрнутая полоска)
        // Рисуем на отдельном холсте и плавно растворяем к низу — без резкой границы
        const refH = Math.min(hy, H * 0.22), rh = refH * 0.55;
        const [refC, rc] = mk();
        rc.save();
        rc.translate(0, hy * 2);
        rc.scale(1, -1);
        rc.drawImage(skyC, 0, (hy - refH) * dpr, W * dpr, refH * dpr, 0, hy - rh, W, rh);
        rc.drawImage(landC, 0, (hy - refH) * dpr, W * dpr, refH * dpr, 0, hy - rh, W, rh);
        rc.restore();
        rc.globalCompositeOperation = 'destination-in';
        const fade = rc.createLinearGradient(0, hy, 0, hy + rh);
        fade.addColorStop(0, 'rgba(0,0,0,1)');
        fade.addColorStop(0.6, 'rgba(0,0,0,0.55)');
        fade.addColorStop(1, 'rgba(0,0,0,0)');
        rc.fillStyle = fade;
        rc.fillRect(0, 0, W, H);
        c.save();
        c.globalAlpha = 0.3;
        c.drawImage(refC, 0, 0, W, H);
        c.restore();
        // Солнечная (лунная) дорожка — до самого низа. Её же потом кладём светом
        // на камыш и камни, которые в неё попали: они стоят в солнечном свете
        const hasPath = wx === 'sun' || night || wx === 'evening';
        const sunPath = (ctx, k) => {
            const m = SC.sun;
            const rgb = night ? '255,250,210' : wx === 'evening' ? '255,190,110' : '255,250,220';
            const a0 = (night ? 0.35 : wx === 'evening' ? 0.7 : 0.45) * k;
            const pg = ctx.createLinearGradient(0, hy, 0, H);
            pg.addColorStop(0, 'rgba(' + rgb + ',' + a0 + ')');
            pg.addColorStop(0.7, 'rgba(' + rgb + ',' + (a0 * 0.4) + ')');
            pg.addColorStop(1, 'rgba(' + rgb + ',0)');
            // Края дорожки расходятся к зрителю — продлеваем их до низа экрана
            const ext = (H - hy) / (H * 0.8 - hy);
            const l0 = m.x - u * 2, r0 = m.x + u * 2;
            const l1 = m.x - u * 10 + (m.x - W / 2) * 0.4, r1 = m.x + u * 14 + (m.x - W / 2) * 0.4;
            ctx.fillStyle = pg;
            ctx.beginPath();
            ctx.moveTo(l0, hy);
            ctx.lineTo(r0, hy);
            ctx.lineTo(r0 + (r1 - r0) * ext, H);
            ctx.lineTo(l0 + (l1 - l0) * ext, H);
            ctx.closePath();
            ctx.fill();
        };
        if (hasPath) sunPath(c, 1);
        // Неподвижная рябь: светлые и тёмные чёрточки, реже у берега
        const rr = U.seeded(4242);
        for (let i = 0; i < 260; i++) {
            const d = Math.pow(rr(), 0.7);
            const p = SC.project(U.lerp(-1.6, 1.6, rr()), 1 - d);
            const len = u * U.lerp(1.5, 5, rr()) * p.s * 2;
            c.strokeStyle = rr() < 0.5 ? 'rgba(255,255,255,' + (0.18 * (1 - d * 0.5)) + ')' : 'rgba(0,40,80,0.08)';
            c.lineWidth = Math.max(0.6, 1.4 * p.s);
            c.beginPath(); c.moveTo(p.x - len, p.y); c.quadraticCurveTo(p.x, p.y - 1.2 * p.s, p.x + len, p.y); c.stroke();
        }
        if (th.foam) {
            c.strokeStyle = 'rgba(255,255,255,0.5)';
            c.lineWidth = 1.2;
            for (let i = 0; i < 10; i++) {
                const y = hy + 2 + i * 0.6;
                c.beginPath();
                for (let x = 0; x <= W; x += 12) c.lineTo(x, y + Math.sin(x * 0.05 + i) * 0.8);
                c.stroke();
            }
        }
        if (th.buoys) {
            for (let i = 0; i < 9; i++) {
                const p = SC.project(U.lerp(-1.3, 1.3, i / 8), 0.82 + Math.sin(i) * 0.03);
                buoy(c, p.x, p.y, u * 1.2 * Math.max(0.5, p.s * 2));
            }
        }
        // Камни, кувшинки, камыши по краям — ближний план. Камни и камыш рисуем
        // на отдельном слое, чтобы солнечная дорожка легла на них светом
        const [nearC, n] = mk();
        if (th.rocks) {
            rock(n, W * 0.06, SC.project(-1, 0.5).y, u * 9, u * 4, night ? '#4a5470' : '#8a949a');
            rock(n, W * 0.94, SC.project(1, 0.3).y, u * 12, u * 5, night ? '#4a5470' : '#7e888e');
        }
        if (th.lily) {
            const lr = U.seeded(99);
            for (let i = 0; i < 9; i++) {
                const side = i % 2 ? 1 : -1;
                const p = SC.project(side * U.lerp(0.75, 1.4, lr()), U.lerp(0.05, 0.75, lr()));
                lily(c, p.x, p.y, u * 4 * p.s, lr() < 0.35);
            }
        }
        if (th.reeds) {
            const rd = U.seeded(7);
            reeds(n, -u * 2, W * 0.16, SC.project(-1, 0.15).y + u * 2, u * 22, th.reeds, rd, th.cattails);
            reeds(n, W * 0.86, W + u * 2, SC.project(1, 0.12).y + u * 2, u * 24, th.reeds, rd, th.cattails);
        }
        if (hasPath) {
            n.save();
            n.globalCompositeOperation = 'source-atop';
            sunPath(n, 1.1);
            n.restore();
        }

        // Дымка у горизонта, туман, ночь, дождь
        const haze = c.createLinearGradient(0, hy - u * 6, 0, hy + u * 6);
        haze.addColorStop(0, U.rgba(sky[1], 0));
        haze.addColorStop(0.5, U.rgba(sky[1], wx === 'fog' ? 0.85 : 0.35));
        haze.addColorStop(1, U.rgba(sky[1], 0));
        c.fillStyle = haze;
        c.fillRect(0, hy - u * 6, W, u * 12);
        if (wx === 'fog') {
            const fg = c.createLinearGradient(0, 0, 0, H);
            fg.addColorStop(0, 'rgba(240,245,248,0.5)');
            fg.addColorStop(0.45, 'rgba(240,245,248,0.45)');
            fg.addColorStop(1, 'rgba(240,245,248,0.1)');
            c.fillStyle = fg;
            c.fillRect(0, 0, W, H);
        }
        if (night) {
            c.save();
            c.globalCompositeOperation = 'source-atop';
            c.fillStyle = 'rgba(14,24,70,0.45)';
            c.fillRect(0, 0, W, H);
            c.restore();
            // Огоньки окон снова светятся поверх затемнения
            if (SC.theme === 'village') {
                c.fillStyle = 'rgba(255,214,110,0.9)';
                [[0.22, 2.2, 5], [0.3, 1.6, 3.6], [0.66, 1.8, 4]].forEach(([kx, ky, s]) => {
                    const x = W * kx, y = hy - u * ky;
                    c.fillRect(x - u * s * 0.3, y - u * s * 0.42, u * s * 0.18, u * s * 0.16);
                    c.fillRect(x + u * s * 0.12, y - u * s * 0.42, u * s * 0.18, u * s * 0.16);
                });
            }
        }
        if (wx === 'rain') {
            c.fillStyle = 'rgba(70,90,110,0.16)';
            c.fillRect(0, 0, W, H);
        }
        // Тот же свет и туман — и на переднем плане (камыш, камни)
        n.save();
        n.globalCompositeOperation = 'source-atop';
        if (wx === 'fog') { n.fillStyle = 'rgba(240,245,248,0.35)'; n.fillRect(0, 0, W, H); }
        if (night) { n.fillStyle = 'rgba(14,24,70,0.45)'; n.fillRect(0, 0, W, H); }
        if (wx === 'rain') { n.fillStyle = 'rgba(70,90,110,0.16)'; n.fillRect(0, 0, W, H); }
        n.restore();

        SC.skyLayer = skyC;
        SC.landLayer = landC;
        SC.nearLayer = nearC;
        SC.dirty = false;
    }

    // Миниатюра места для окна «Места»: та же рисовалка, только маленькая
    const thumbs = {};
    SC.thumb = (pondId, w, h) => {
        const key = pondId + w + 'x' + h;
        if (thumbs[key]) return thumbs[key];
        const keep = { W: SC.W, H: SC.H, L: SC.L, dpr: SC.dpr, theme: SC.theme, weather: SC.weather, sky: SC.skyLayer, land: SC.landLayer, near: SC.nearLayer, sun: SC.sun, dirty: SC.dirty };
        SC.W = w; SC.H = h; SC.dpr = 2;
        SC.L = { portrait: false, hy: Math.round(h * 0.52), nearY: h * 1.25, cx: w / 2, ph: h * 0.3, px: w / 2, py: h };
        SC.theme = FB.pondById[pondId].theme;
        SC.weather = 'sun';
        buildLayers();
        const c = document.createElement('canvas');
        c.width = w * 2; c.height = h * 2;
        const x = c.getContext('2d');
        x.drawImage(SC.skyLayer, 0, 0);
        x.drawImage(SC.landLayer, 0, 0);
        x.drawImage(SC.nearLayer, 0, 0);
        SC.W = keep.W; SC.H = keep.H; SC.L = keep.L; SC.dpr = keep.dpr; SC.theme = keep.theme; SC.weather = keep.weather;
        SC.skyLayer = keep.sky; SC.landLayer = keep.land; SC.nearLayer = keep.near; SC.sun = keep.sun; SC.dirty = keep.dirty;
        return (thumbs[key] = c);
    };

    // ---------- Живность и эффекты ----------
    SC.splash = (x, y, size, color) => {
        const n = Math.round(10 + size * 10);
        for (let i = 0; i < n; i++) {
            const a = -Math.PI / 2 + U.rand(-1.1, 1.1);
            const v = U.rand(0.5, 1.2) * size * SC.unit() * 22;
            SC.fx.push({ kind: 'drop', x, y, vx: Math.cos(a) * v * 0.6, vy: Math.sin(a) * v, r: U.rand(0.6, 1.4) * size * SC.unit() * 0.7, life: 0, max: U.rand(0.5, 0.9), color: color || '#e8f8ff', ground: y });
        }
        SC.ripple(x, y, size);
    };
    SC.ripple = (x, y, size, color) => {
        SC.fx.push({ kind: 'ring', x, y, r: 0, grow: SC.unit() * 9 * size, life: 0, max: 1.2, color: color || '#ffffff' });
    };
    // Вспышка блёсток (редкая рыба, эффект улова)
    SC.sparkle = (x, y, n, color) => {
        for (let i = 0; i < n; i++) {
            const a = U.rand(0, Math.PI * 2), v = U.rand(4, 16) * SC.unit();
            SC.fx.push({ kind: 'star', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - SC.unit() * 6, r: U.rand(0.6, 1.4) * SC.unit(), life: 0, max: U.rand(0.7, 1.3), color: color || '#fff6b0' });
        }
    };
    SC.burst = (x, y, kind) => {
        const colors = { fx_hearts: ['#ff5a7a', '#ff8aa6'], fx_stars: ['#ffd84a', '#fff2a0'], fx_confetti: ['#ff5a5a', '#ffd84a', '#5ad87a', '#5ab4ff', '#c87aff'], fx_rainbow: ['#ff5a5a', '#ffa83a', '#ffe84a', '#5ad87a', '#5ab4ff', '#9a7aff'] };
        const list = colors[kind];
        if (!list) return SC.splash(x, y, 1.2);
        for (let i = 0; i < 36; i++) {
            const a = U.rand(0, Math.PI * 2), v = U.rand(6, 22) * SC.unit();
            SC.fx.push({ kind: kind === 'fx_hearts' ? 'heart' : kind === 'fx_stars' ? 'star' : 'conf', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - SC.unit() * 10, r: U.rand(0.8, 1.6) * SC.unit(), life: 0, max: U.rand(0.9, 1.6), color: U.pick(list), rot: U.rand(0, 6) });
        }
    };

    let lifeTimer = 2, jumpTimer = 6;
    function spawnLife() {
        const th = THEMES[SC.theme] || THEMES.village;
        const kinds = th.life.slice();
        if (SC.weather === 'night') { kinds.length = 0; kinds.push('fireflies'); }
        if (SC.weather === 'rain') kinds.splice(kinds.indexOf('dragonflies') >>> 0, 1);
        const kind = U.pick(kinds.length ? kinds : ['birds']);
        const dir = Math.random() < 0.5 ? 1 : -1;
        const W = SC.W, L = SC.L;
        if (kind === 'ducks' && !SC.life.some(l => l.kind === 'ducks')) {
            const dist = U.rand(0.45, 0.85);
            SC.life.push({ kind, dist, tx: -dir * 1.6, v: dir * 0.03, n: U.randInt(1, 4), t: 0 });
        } else if (kind === 'birds' || kind === 'gulls') {
            SC.life.push({ kind, x: dir > 0 ? -40 : W + 40, y: U.rand(0.1, 0.6) * L.hy, v: dir * U.rand(30, 60) * SC.unit() / 10, n: kind === 'birds' ? U.randInt(2, 5) : U.randInt(1, 2), t: Math.random() * 5 });
        } else if (kind === 'dragonflies' && SC.weather === 'sun') {
            SC.life.push({ kind, x: U.rand(0.1, 0.9) * W, y: U.rand(L.hy + 20, SC.H * 0.7), tx: U.rand(0.1, 0.9) * W, ty: U.rand(L.hy + 20, SC.H * 0.7), t: 0, life: U.rand(6, 12), c: U.pick(['#3ab0e8', '#e84a6a', '#5ad87a']) });
        } else if (kind === 'leaves') {
            SC.life.push({ kind, tx: U.rand(-1.2, -0.6), dist: U.rand(0.2, 0.9), v: U.rand(0.01, 0.025), rot: U.rand(0, 6), c: U.pick(['#e8a83a', '#d8603a', '#8ac04a']) });
        } else if (kind === 'sails' && !SC.life.some(l => l.kind === 'sails')) {
            SC.life.push({ kind, x: dir > 0 ? -30 : W + 30, v: dir * SC.unit() * 0.6 });
        } else if (kind === 'fireflies' && SC.life.filter(l => l.kind === 'fireflies').length < 14) {
            for (let i = 0; i < 4; i++) SC.life.push({ kind, x: U.rand(0, W), y: U.rand(L.hy - 30, SC.H * 0.8), ph: U.rand(0, 6), t: 0, life: U.rand(8, 16) });
        }
    }

    // Рыба выпрыгивает где-то вдали — сцена живая, даже когда не клюёт
    function spawnJump() {
        const pond = FB.state && FB.state.fishPondOf ? FB.state.fishPondOf(SC.pond) : SC.pond;
        const list = FB.fishOfPond(pond).filter(f => f.r === 'common' || f.r === 'uncommon');
        if (!list.length) return;
        const f = U.pick(list);
        const tx = U.rand(-0.9, 0.9), dist = U.rand(0.3, 0.95);
        SC.life.push({ kind: 'jump', fish: f.id, tx, dist, t: 0, dir: Math.random() < 0.5 ? 1 : -1 });
    }

    function updateLife(dt) {
        lifeTimer -= dt;
        if (lifeTimer <= 0) { spawnLife(); lifeTimer = U.rand(5, 12); }
        jumpTimer -= dt;
        if (jumpTimer <= 0) { spawnJump(); jumpTimer = U.rand(7, 16); }
        const W = SC.W;
        SC.life = SC.life.filter(l => {
            l.t = (l.t || 0) + dt;
            switch (l.kind) {
                case 'ducks': l.tx += l.v * dt; return Math.abs(l.tx) < 1.8;
                case 'birds': case 'gulls': case 'sails': l.x += l.v * dt; return l.x > -80 && l.x < W + 80;
                case 'dragonflies': {
                    if (U.dist(l.x, l.y, l.tx, l.ty) < 6) { l.tx = U.clamp(l.x + U.rand(-120, 120), 10, W - 10); l.ty = U.clamp(l.y + U.rand(-60, 60), SC.L.hy + 10, SC.H * 0.75); }
                    l.x += (l.tx - l.x) * dt * 2.2; l.y += (l.ty - l.y) * dt * 2.2;
                    return l.t < l.life;
                }
                case 'leaves': l.tx += l.v * dt; l.rot += dt * 0.2; return l.tx < 1.4;
                case 'fireflies': l.x += Math.sin(l.t * 0.7 + l.ph) * 12 * dt; l.y += Math.cos(l.t * 0.9 + l.ph) * 8 * dt; return l.t < l.life;
                case 'jump': return l.t < 1.6;
            }
            return false;
        });
    }

    function drawLife(ctx) {
        const u = SC.unit();
        SC.life.forEach(l => {
            switch (l.kind) {
                case 'ducks': {
                    for (let i = 0; i < l.n; i++) {
                        const p = SC.project(l.tx - Math.sign(l.v) * i * (i === 0 ? 0 : 0.12 + i * 0.02), l.dist);
                        drawDuck(ctx, p.x, p.y + Math.sin(l.t * 2 + i) * p.s, u * 3.2 * p.s * (i === 0 ? 1 : 0.65), Math.sign(l.v));
                    }
                    break;
                }
                case 'birds': case 'gulls': {
                    ctx.strokeStyle = l.kind === 'gulls' ? (SC.weather === 'evening' ? '#5a3a5a' : '#ffffff') : (SC.weather === 'night' ? '#c8d0e8' : SC.weather === 'evening' ? '#3a2240' : '#3a4a5a');
                    ctx.lineWidth = Math.max(1.2, u * 0.35);
                    ctx.lineCap = 'round';
                    for (let i = 0; i < l.n; i++) {
                        const x = l.x - Math.sign(l.v) * i * u * 3, y = l.y + (i % 2) * u * 1.5 + i * u * 0.6;
                        const w = u * (l.kind === 'gulls' ? 2.2 : 1.3), flap = Math.sin(l.t * 9 + i) * 0.6;
                        ctx.beginPath();
                        ctx.moveTo(x - w, y - w * 0.3 * flap);
                        ctx.quadraticCurveTo(x - w * 0.4, y - w * 0.5, x, y);
                        ctx.quadraticCurveTo(x + w * 0.4, y - w * 0.5, x + w, y - w * 0.3 * flap);
                        ctx.stroke();
                    }
                    break;
                }
                case 'sails': {
                    const y = SC.L.hy + 1, s = u * 3;
                    ctx.fillStyle = '#ffffff';
                    ctx.beginPath(); ctx.moveTo(l.x, y - s * 0.3); ctx.lineTo(l.x, y - s * 1.6); ctx.lineTo(l.x + s * 0.8, y - s * 0.3); ctx.closePath(); ctx.fill();
                    ctx.fillStyle = '#e85a4a';
                    ctx.beginPath(); ctx.moveTo(l.x - s * 0.6, y - s * 0.3); ctx.lineTo(l.x + s, y - s * 0.3); ctx.lineTo(l.x + s * 0.7, y); ctx.lineTo(l.x - s * 0.4, y); ctx.closePath(); ctx.fill();
                    break;
                }
                case 'dragonflies': {
                    const w = u * 1.4, flap = Math.sin(l.t * 40) * 0.4;
                    ctx.fillStyle = 'rgba(230,245,255,0.7)';
                    ctx.beginPath(); ctx.ellipse(l.x - w * 0.3, l.y - w * 0.2, w, w * 0.25, -0.3 + flap, 0, Math.PI * 2); ctx.ellipse(l.x + w * 0.3, l.y - w * 0.2, w, w * 0.25, 0.3 - flap, 0, Math.PI * 2); ctx.fill();
                    ctx.strokeStyle = l.c; ctx.lineWidth = u * 0.4; ctx.lineCap = 'round';
                    ctx.beginPath(); ctx.moveTo(l.x - w * 0.2, l.y); ctx.lineTo(l.x + w * 1.4, l.y + w * 0.2); ctx.stroke();
                    break;
                }
                case 'leaves': {
                    const p = SC.project(l.tx, l.dist);
                    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(l.rot); ctx.scale(1, 0.5);
                    ctx.fillStyle = l.c;
                    ctx.beginPath(); ctx.ellipse(0, 0, u * 1.6 * p.s, u * 0.8 * p.s, 0, 0, Math.PI * 2); ctx.fill();
                    ctx.restore();
                    break;
                }
                case 'fireflies': {
                    const a = 0.5 + 0.5 * Math.sin(l.t * 3 + l.ph);
                    const fade = Math.min(1, l.t, l.life - l.t);
                    const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, u * 2.2);
                    g.addColorStop(0, 'rgba(255,250,150,' + (0.9 * a * fade) + ')');
                    g.addColorStop(1, 'rgba(255,250,150,0)');
                    ctx.fillStyle = g;
                    ctx.fillRect(l.x - u * 2.2, l.y - u * 2.2, u * 4.4, u * 4.4);
                    break;
                }
                case 'jump': {
                    const p = SC.project(l.tx, l.dist);
                    const t = l.t / 0.9;
                    if (t <= 1) {
                        const size = u * 7 * p.s;
                        const x = p.x + l.dir * (t - 0.5) * size * 1.6;
                        const y = p.y - Math.sin(t * Math.PI) * size * 1.1;
                        const img = FB.fishArt.canvas(l.fish, 64, { glow: false });
                        ctx.save();
                        ctx.translate(x, y);
                        ctx.scale(l.dir, 1);
                        ctx.rotate((t - 0.5) * 2.2);
                        ctx.drawImage(img, -size * 0.75, -size * 0.5 * img.height / img.width * 1.5, size * 1.5, size * 1.5 * img.height / img.width);
                        ctx.restore();
                        if (!l.s1 && t > 0.02) { l.s1 = true; SC.splash(p.x - l.dir * size * 0.8, p.y, 0.35 * p.s * 2); }
                    } else if (!l.s2) { l.s2 = true; SC.splash(p.x + l.dir * size(p), p.y, 0.4 * p.s * 2); }
                    break;
                }
            }
        });
        function size(p) { return u * 7 * p.s * 0.8; }
    }

    function drawDuck(ctx, x, y, s, dir) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(dir, 1);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath(); ctx.ellipse(-s * 0.3, s * 0.05, s * 1.2, s * 0.18, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#8a6a48';
        ctx.beginPath(); ctx.ellipse(0, -s * 0.25, s * 0.75, s * 0.35, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2e7a4a';
        ctx.beginPath(); ctx.arc(s * 0.55, -s * 0.75, s * 0.28, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f2b02a';
        ctx.beginPath(); ctx.ellipse(s * 0.88, -s * 0.7, s * 0.2, s * 0.08, 0.1, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(s * 0.32, -s * 0.52, s * 0.4, s * 0.06);
        ctx.restore();
    }

    function updateFx(dt) {
        SC.fx = SC.fx.filter(f => {
            f.life += dt;
            if (f.kind === 'drop') { f.vy += SC.unit() * 60 * dt; f.x += f.vx * dt; f.y += f.vy * dt; return f.y < f.ground + 4 && f.life < f.max * 2; }
            if (f.kind === 'ring') { f.r += f.grow * dt; return f.life < f.max; }
            if (f.kind === 'star' || f.kind === 'heart' || f.kind === 'conf') { f.vy += SC.unit() * 25 * dt; f.vx *= 0.98; f.x += f.vx * dt; f.y += f.vy * dt; f.rot = (f.rot || 0) + dt * 4; return f.life < f.max; }
            return false;
        });
    }
    function drawFx(ctx) {
        SC.fx.forEach(f => {
            const a = 1 - f.life / f.max;
            if (f.kind === 'drop') {
                ctx.fillStyle = U.rgba(f.color, 0.85 * Math.max(0, a));
                ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
            } else if (f.kind === 'ring') {
                ctx.strokeStyle = U.rgba(f.color, 0.6 * a);
                ctx.lineWidth = Math.max(1, 2 * a);
                ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * 0.32, 0, 0, Math.PI * 2); ctx.stroke();
            } else if (f.kind === 'star') {
                ctx.fillStyle = U.rgba(f.color, Math.max(0, a));
                FB.fishArt.star(ctx, f.x, f.y, f.r * 1.6);
            } else if (f.kind === 'heart') {
                ctx.fillStyle = U.rgba(f.color, Math.max(0, a));
                heart(ctx, f.x, f.y, f.r * 1.4);
            } else if (f.kind === 'conf') {
                ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot);
                ctx.fillStyle = U.rgba(f.color, Math.max(0, a));
                ctx.fillRect(-f.r, -f.r * 0.5, f.r * 2, f.r);
                ctx.restore();
            }
        });
    }
    function heart(ctx, x, y, r) {
        ctx.beginPath();
        ctx.moveTo(x, y + r * 0.9);
        ctx.bezierCurveTo(x - r * 1.4, y - r * 0.1, x - r * 0.7, y - r * 1.1, x, y - r * 0.35);
        ctx.bezierCurveTo(x + r * 0.7, y - r * 1.1, x + r * 1.4, y - r * 0.1, x, y + r * 0.9);
        ctx.fill();
    }
    SC.heart = heart;

    // Блики на воде
    const sparkles = [];
    for (let i = 0; i < 70; i++) sparkles.push({ tx: Math.random() * 3 - 1.5, d: Math.random(), ph: Math.random() * 6, sp: 0.8 + Math.random() * 1.6 });
    function drawSparkles(ctx) {
        const wx = SC.weather;
        if (wx === 'rain') return;
        const base = wx === 'night' ? 0.35 : wx === 'fog' ? 0.25 : wx === 'evening' ? 0.55 : 0.8;
        const sparkCol = wx === 'evening' ? '255,215,170' : '255,255,255';
        const u = SC.unit();
        sparkles.forEach(s => {
            const a = Math.max(0, Math.sin(SC.t * s.sp + s.ph)) * base;
            if (a < 0.05) return;
            const p = SC.project(s.tx, s.d);
            const len = u * 1.6 * p.s * 2;
            ctx.fillStyle = 'rgba(' + sparkCol + ',' + a + ')';
            ctx.beginPath(); ctx.ellipse(p.x, p.y, len, Math.max(0.5, len * 0.18), 0, 0, Math.PI * 2); ctx.fill();
        });
        // Больше бликов на солнечной дорожке
        if (wx === 'sun' || wx === 'night' || wx === 'evening') {
            const m = SC.sun;
            for (let i = 0; i < 18; i++) {
                const k = ((i * 0.618 + SC.t * 0.05) % 1);
                const y = SC.L.hy + Math.pow(k, 1.6) * (SC.H * 0.8 - SC.L.hy);
                const spread = u * 2 + (y - SC.L.hy) * 0.25;
                const x = m.x + (m.x - SC.W / 2) * 0.4 * ((y - SC.L.hy) / (SC.H * 0.8 - SC.L.hy)) + Math.sin(i * 7.3 + SC.t * 0.7) * spread;
                const a = Math.max(0, Math.sin(SC.t * 3 + i * 1.7)) * 0.9;
                ctx.fillStyle = (wx === 'evening' ? 'rgba(255,225,170,' : 'rgba(255,253,230,') + a + ')';
                ctx.beginPath(); ctx.ellipse(x, y, u * 0.9 + (y - SC.L.hy) * 0.02, 0.8 + (y - SC.L.hy) * 0.004, 0, 0, Math.PI * 2); ctx.fill();
            }
        }
    }

    // Дождь: косые штрихи и кружки на воде
    const drops = [];
    function drawRain(ctx, dt, k) {
        const W = SC.W, H = SC.H, u = SC.unit();
        k = k === undefined ? 1 : k;
        while (drops.length < 140) drops.push({ x: Math.random() * W * 1.2, y: Math.random() * H, v: U.rand(60, 90) * u, l: U.rand(1.5, 3) * u });
        ctx.strokeStyle = 'rgba(220,235,250,' + (0.45 * k) + ')';
        ctx.lineWidth = 1;
        ctx.beginPath();
        const n = Math.round(drops.length * k);
        drops.forEach((d, i) => {
            if (i >= n) return;
            d.y += d.v * dt; d.x -= d.v * 0.15 * dt;
            if (d.y > H) { d.y = -10; d.x = Math.random() * W * 1.2; }
            ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + d.l * 0.15, d.y - d.l);
        });
        ctx.stroke();
        if (Math.random() < dt * 14 * k) {
            const p = SC.project(U.rand(-1.4, 1.4), Math.random());
            SC.ripple(p.x, p.y, 0.25 * p.s * 2, '#e8f4ff');
        }
    }
    // Туман: медленно плывущие полосы
    function drawFog(ctx, k) {
        const W = SC.W, L = SC.L, u = SC.unit();
        ctx.save();
        ctx.globalAlpha = k === undefined ? 1 : k;
        for (let i = 0; i < 4; i++) {
            const x = ((SC.t * (6 + i * 3) * u / 10 + i * W * 0.37) % (W * 1.6)) - W * 0.3;
            const y = L.hy + (i - 1) * u * 6;
            const g = ctx.createRadialGradient(x, y, 0, x, y, W * 0.4);
            g.addColorStop(0, 'rgba(255,255,255,0.35)');
            g.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.25); ctx.translate(-x, -y);
            ctx.fillStyle = g; ctx.fillRect(x - W * 0.4, y - W * 0.4, W * 0.8, W * 0.8);
            ctx.restore();
        }
        ctx.restore();
    }

    // ---------- Кадр ----------
    // drawWorld(ctx) — то, что рисует игра поверх воды (поплавок, леска, рыба, рыбак)
    SC.render = (dt, drawWorld) => {
        SC.t += dt;
        if (SC.dirty) buildLayers();
        // Дождь и туман набегают и уходят постепенно
        const ease = Math.min(1, dt / (SC.FADE_TIME * 0.8));
        SC.rainK += ((SC.weather === 'rain' ? 1 : 0) - SC.rainK) * ease * 3;
        SC.fogK += ((SC.weather === 'fog' ? 1 : 0) - SC.fogK) * ease * 3;
        const fade = SC.fade;
        if (fade) { fade.k += dt / SC.FADE_TIME; if (fade.k >= 1) SC.fade = null; }
        const fk = fade ? 1 - U.smooth(Math.min(1, fade.k)) : 0;
        // Лодка качается на волнах вместе с рыбаком (мостки стоят), в дождь — сильнее
        const L = SC.L;
        if (L.py0 === undefined) L.py0 = L.py;
        const bt = FB.person && FB.person.boatType ? FB.person.boatType() : 'pier';
        const amp = { raft: 0.01, boat: 0.016, yacht: 0.009 }[bt] || 0;
        L.py = L.py0 + amp * L.ph * (SC.weather === 'rain' ? 1.7 : 1) * (Math.sin(SC.t * 1.7) + 0.35 * Math.sin(SC.t * 3.1 + 1));
        const ctx = SC.ctx, dpr = SC.dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.drawImage(SC.skyLayer, 0, 0, SC.W, SC.H);
        // Облака плывут за горами
        SC.clouds.forEach(c => {
            c.x += c.v * dt;
            if (c.x > SC.W + c.img.width) c.x = -c.img.width;
            ctx.drawImage(c.img, c.x, c.y);
        });
        ctx.drawImage(SC.landLayer, 0, 0, SC.W, SC.H);
        if (fk > 0) { ctx.globalAlpha = fk; ctx.drawImage(fade.c, 0, 0, SC.W, SC.H); ctx.globalAlpha = 1; }
        drawSparkles(ctx);
        updateLife(dt);
        drawLife(ctx);
        updateFx(dt);
        if (drawWorld) drawWorld(ctx, 'water');
        drawFx(ctx);
        if (SC.nearLayer) ctx.drawImage(SC.nearLayer, 0, 0, SC.W, SC.H);
        if (fk > 0 && fade.near) { ctx.globalAlpha = fk; ctx.drawImage(fade.near, 0, 0, SC.W, SC.H); ctx.globalAlpha = 1; }
        if (drawWorld) {
            drawWorld(ctx, 'front');
            // Рыбак, мостки и лодка при старой погоде — поверх, тают вместе с фоном
            if (fk > 0) {
                const fx = frontCanvas(), now = SC.weather;
                SC.weather = fade.prev;
                try { drawWorld(fx, 'front'); } finally { SC.weather = now; }
                ctx.save();
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.globalAlpha = fk;
                ctx.drawImage(frontBuf, 0, 0);
                ctx.restore();
            }
        }
        if (SC.rainK > 0.01) drawRain(ctx, dt, SC.rainK);
        if (SC.fogK > 0.01) drawFog(ctx, SC.fogK);
        drawTravel(ctx, dt);
    };

    // ---------- Переезд на другое место ----------
    // Снимок старого места уплывает влево и тает, новое проявляется из-под него,
    // по экрану пробегает мягкая волна
    SC.TRAVEL_TIME = 1.4;
    SC.travel = (pondId, weather) => {
        let img = null;
        if (SC.canvas && SC.canvas.width) {
            img = document.createElement('canvas');
            img.width = SC.canvas.width; img.height = SC.canvas.height;
            img.getContext('2d').drawImage(SC.canvas, 0, 0);
        }
        SC.setPlace(pondId, weather);
        SC.trans = img ? { img, t: 0 } : null;
    };
    SC.traveling = () => !!SC.trans;
    function drawTravel(ctx, dt) {
        const tr = SC.trans;
        if (!tr) return;
        tr.t += Math.min(dt, 0.05);
        const k = Math.min(1, tr.t / SC.TRAVEL_TIME);
        if (k >= 1) { SC.trans = null; return; }
        const e = U.smooth(k), W = SC.W, H = SC.H, u = SC.unit();
        // Край волны идёт справа налево, слегка волнистый
        const edge = (y) => W * (1.08 - e * 1.25) + Math.sin(y * 0.018 + tr.t * 6) * u * 2.2 + Math.sin(y * 0.047 - tr.t * 4) * u * 1.2;
        const path = () => {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            for (let y = 0; y <= H + 20; y += 20) ctx.lineTo(edge(y), y);
            ctx.lineTo(0, H);
            ctx.closePath();
        };
        // Старое место — только слева от волны
        ctx.save();
        path(); ctx.clip();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(tr.img, 0, 0);
        ctx.restore();
        // Пена по краю волны
        ctx.save();
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = u * 1.6;
        ctx.shadowColor = 'rgba(40,120,180,0.5)'; ctx.shadowBlur = u * 2;
        ctx.beginPath();
        for (let y = 0; y <= H + 20; y += 20) { const x = edge(y); if (y === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        for (let i = 0; i < 18; i++) {
            const y = (i / 18) * H + Math.sin(i * 3.1) * 12;
            const x = edge(y) + u * (1 + (i % 3) * 1.4);
            ctx.beginPath(); ctx.arc(x, y, u * (0.35 + (i % 4) * 0.18), 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }
})(window.FB);
