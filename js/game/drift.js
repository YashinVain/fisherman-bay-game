// drift.js — находки на воде. С мостков до них не дотянуться, а с плота, лодки
// и яхты иногда видно, как мимо проплывает бутылка с запиской, резиновая уточка,
// ракушка или сундучок. Нажми на находку — она твоя. Чем лучше лодка, тем чаще
// находки и тем они ценнее. На турнир не влияет: только монеты и чуть жемчуга.
//
// Находка медленно плывёт через всю воду справа налево по плавной дуге,
// покачивается на волнах, сидит в воде наполовину и оставляет за собой след.

(function (FB) {
    const D = FB.drift = {};
    const U = FB.U;

    // Что приплывает к каждой лодке: как часто (секунды) и с какими весами
    D.BOATS = {
        raft: { every: [70, 110], finds: { bottle: 6, shell: 1 } },
        boat: { every: [50, 85], finds: { bottle: 5, shell: 2, duck: 2 } },
        yacht: { every: [35, 65], finds: { bottle: 4, shell: 3, duck: 2, chest: 1 } }
    };
    // Награды: монеты всегда, у ракушки иногда жемчужина
    D.FINDS = {
        bottle: { coins: [20, 45] },
        shell: { coins: [10, 25], pearls: 1, pearlChance: 0.5 },
        duck: { coins: [30, 60] },
        chest: { coins: [100, 200] }
    };
    D.CROSS = 26;       // за сколько секунд находка переплывает экран

    D.item = null;
    let timer = 25;
    D.reset = () => { D.item = null; timer = U.rand(20, 35); };

    // Награда за находку (отдельно — чтобы проверять в тестах)
    D.reward = (kind, rnd) => {
        rnd = rnd || Math.random;
        const f = D.FINDS[kind];
        const out = { coins: Math.round(U.lerp(f.coins[0], f.coins[1], rnd())) };
        if (f.pearls && rnd() < f.pearlChance) out.pearls = f.pearls;
        return out;
    };

    // Новая находка: появляется за правым краем экрана, уплывает за левый
    D.spawn = (kind, dist) => {
        const SC = FB.scene;
        const d0 = dist === undefined ? U.rand(0.2, 0.5) : dist;
        const y = SC.project(0, d0).y;
        const a = SC.unproject(SC.W * 1.12, y), b = SC.unproject(-SC.W * 0.12, y);
        const t0 = a ? a.tx : 1.4, t1 = b ? b.tx : -1.4;
        D.item = { kind, tx: t0, t1, d0, dist: d0, v: (t1 - t0) / D.CROSS, t: 0, ph: Math.random() * 6, got: false, gotT: 0 };
        FB.emit('driftSpawn', D.item);
        return D.item;
    };

    D.update = (dt) => {
        const type = FB.person.boatType();
        const cfg = D.BOATS[type];
        if (!cfg) { D.item = null; return; }
        const F = FB.fishing;
        const it = D.item;
        if (it) {
            it.t += dt;
            if (it.got) { it.gotT += dt; if (it.gotT > 0.9) D.item = null; return; }
            // Плывёт по плавной дуге: чуть ближе-дальше, как несёт волной
            it.tx += it.v * dt;
            it.dist = it.d0 + Math.sin(it.t * 0.22 + it.ph) * 0.035;
            if (it.tx < it.t1) D.item = null;
            return;
        }
        if (F.phase !== 'idle' && F.phase !== 'wait') return;
        timer -= dt;
        if (timer > 0) return;
        timer = U.rand(cfg.every[0], cfg.every[1]);
        D.spawn(U.weighted(Object.keys(cfg.finds), k => cfg.finds[k]));
    };

    // Где находка на экране и как она качается
    D.pos = () => {
        const it = D.item;
        if (!it) return null;
        const SC = FB.scene;
        const p = SC.project(it.tx, it.dist);
        const s = Math.max(0.75, p.s * 1.25);
        const wave = it.t * 1.5 + it.ph;
        return { x: p.x, y: p.y + Math.sin(wave) * SC.unit() * 0.35 * s, s, r: SC.unit() * 6 * s, rot: Math.cos(wave) * 0.12 };
    };
    // Насколько находка видна: появляется и исчезает плавно, за рыбаком не ловится
    function alphaOf(it, p) {
        const SC = FB.scene;
        const inA = U.smooth(Math.min(1, it.t / 1.5));
        const edge = U.clamp(Math.min(p.x + p.r * 2, SC.W - p.x + p.r * 2) / (SC.W * 0.08), 0, 1);
        return inA * edge;
    }

    // Нажали на находку? Тогда забираем и не забрасываем удочку
    D.hit = (x, y) => {
        const it = D.item, p = D.pos();
        if (!it || it.got || !p || alphaOf(it, p) < 0.4) return false;
        const L = FB.scene.L;
        if (p.x < L.px + L.ph * 0.6) return false;     // уплыла за лодку — уже не достать
        if (Math.hypot(x - p.x, y - (p.y - p.r * 0.3)) > p.r * 1.9) return false;
        it.got = true;
        const r = D.reward(it.kind);
        FB.state.giveReward(r);
        FB.S.stats.finds = (FB.S.stats.finds || 0) + 1;
        FB.state.save();
        FB.audio.play('junk', it.kind === 'chest' || it.kind === 'bottle' ? 'chest' : it.kind);
        FB.scene.splash(p.x, p.y, 0.5 * p.s);
        FB.scene.sparkle && FB.scene.sparkle(p.x, p.y - p.r, 10, '#ffe28a');
        FB.emit('driftFound', { kind: it.kind, reward: r, x: p.x, y: p.y });
        return true;
    };

    // ---------- Рисование (слой воды) ----------
    D.draw = (ctx) => {
        const it = D.item, p = D.pos();
        if (!it || !p) return;
        const SC = FB.scene, u = SC.unit();
        const size = p.r * 2;
        let a = alphaOf(it, p);
        if (a <= 0.01) return;
        ctx.save();
        if (!it.got) {
            ctx.globalAlpha = a;
            drawWake(ctx, it, p, size, u);
        }
        // Находка: при «забрал» — плавно взлетает, увеличивается и тает
        let lift = 0, sc = 1;
        if (it.got) {
            const k = U.smooth(Math.min(1, it.gotT / 0.8));
            lift = -k * u * 14; sc = 1 + k * 0.35; a = 1 - k;
        }
        ctx.globalAlpha = a;
        ctx.translate(p.x, p.y + lift);
        ctx.rotate(p.rot);
        ctx.scale(sc, sc);
        if (it.got) ART[it.kind](ctx, size, SC.t);
        else submerged(ctx, size, () => ART[it.kind](ctx, size, SC.t));
        ctx.restore();
        // Искорка — чтобы находку было видно издалека
        if (!it.got) {
            const tw = (Math.sin(it.t * 3) + 1) / 2;
            ctx.save();
            ctx.globalAlpha = a * (0.35 + tw * 0.6);
            ctx.fillStyle = '#fff6c8';
            star(ctx, p.x + size * 0.38, p.y - size * 0.62, u * (0.5 + tw * 0.45));
            ctx.restore();
        }
    };

    // След на воде: мягкие дуги позади и круг у ватерлинии
    function drawWake(ctx, it, p, size, u) {
        ctx.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
            const k = ((it.t * 0.45 + i / 3) % 1);
            const w = size * (0.45 + k * 0.9), h = size * (0.08 + k * 0.1);
            ctx.strokeStyle = 'rgba(255,255,255,' + (0.42 * (1 - k)) + ')';
            ctx.lineWidth = Math.max(1, size * 0.03 * (1 - k * 0.5));
            ctx.beginPath(); ctx.ellipse(p.x + size * 0.25 + k * size * 0.6, p.y, w, h, 0, -1.1, 1.1); ctx.stroke();
        }
        // Тень под водой
        ctx.fillStyle = 'rgba(10,40,70,0.16)';
        ctx.beginPath(); ctx.ellipse(p.x, p.y + size * 0.06, size * 0.55, size * 0.14, 0, 0, Math.PI * 2); ctx.fill();
    }

    // Вещь сидит в воде: что выше ватерлинии — ярко, что ниже — бледно и синевато
    function submerged(ctx, size, draw) {
        const wl = size * 0.04;
        ctx.save();
        ctx.beginPath(); ctx.rect(-size * 2, -size * 3, size * 4, size * 3 + wl); ctx.clip();
        draw();
        ctx.restore();
        ctx.save();
        ctx.beginPath(); ctx.rect(-size * 2, wl, size * 4, size * 2); ctx.clip();
        ctx.globalAlpha *= 0.3;
        draw();
        ctx.restore();
        // Блик воды по ватерлинии
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = Math.max(1, size * 0.035);
        ctx.beginPath(); ctx.ellipse(0, wl, size * 0.5, size * 0.07, 0, 0.15, Math.PI - 0.15); ctx.stroke();
    }

    function star(ctx, x, y, r) {
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const a = i * Math.PI / 4, rr = i % 2 ? r * 0.35 : r;
            ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        ctx.closePath(); ctx.fill();
    }

    // ---------- Картинки находок (точка (0,0) — ватерлиния) ----------
    const OUT = '#2a3550';
    const ART = {
        // Бутылка с запиской: зелёное стекло, пробка, свёрнутое письмо внутри
        bottle(ctx, s) {
            const lw = Math.max(1.2, s * 0.035);
            ctx.save();
            ctx.rotate(-0.28);
            ctx.translate(0, -s * 0.12);
            const L = s * 0.95, R = s * 0.2;
            const g = ctx.createLinearGradient(0, -R, 0, R);
            g.addColorStop(0, 'rgba(150,230,170,0.92)'); g.addColorStop(0.5, 'rgba(70,170,110,0.85)'); g.addColorStop(1, 'rgba(30,110,70,0.9)');
            ctx.fillStyle = g; ctx.strokeStyle = OUT; ctx.lineWidth = lw; ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(-L * 0.5, -R); ctx.lineTo(L * 0.12, -R);
            ctx.quadraticCurveTo(L * 0.25, -R, L * 0.3, -R * 0.45);
            ctx.lineTo(L * 0.44, -R * 0.42); ctx.lineTo(L * 0.44, R * 0.42); ctx.lineTo(L * 0.3, R * 0.45);
            ctx.quadraticCurveTo(L * 0.25, R, L * 0.12, R);
            ctx.lineTo(-L * 0.5, R);
            ctx.quadraticCurveTo(-L * 0.58, 0, -L * 0.5, -R);
            ctx.closePath(); ctx.fill(); ctx.stroke();
            // Записка внутри
            ctx.fillStyle = '#fff3d6'; ctx.strokeStyle = '#b89a6a'; ctx.lineWidth = lw * 0.7;
            ctx.beginPath(); ctx.ellipse(-L * 0.12, 0, L * 0.24, R * 0.42, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.strokeStyle = '#d84a3a'; ctx.lineWidth = lw * 0.8;
            ctx.beginPath(); ctx.moveTo(-L * 0.12, -R * 0.42); ctx.lineTo(-L * 0.12, R * 0.42); ctx.stroke();
            // Пробка
            ctx.fillStyle = '#c8945a'; ctx.strokeStyle = OUT; ctx.lineWidth = lw;
            ctx.beginPath(); ctx.roundRect ? ctx.roundRect(L * 0.42, -R * 0.36, L * 0.13, R * 0.72, R * 0.15) : ctx.rect(L * 0.42, -R * 0.36, L * 0.13, R * 0.72); ctx.fill(); ctx.stroke();
            // Блик на стекле
            ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = lw * 1.2; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(-L * 0.4, -R * 0.6); ctx.lineTo(L * 0.1, -R * 0.6); ctx.stroke();
            ctx.restore();
        },
        // Резиновая уточка
        duck(ctx, s, t) {
            const lw = Math.max(1.2, s * 0.035);
            ctx.save();
            ctx.lineJoin = 'round'; ctx.strokeStyle = OUT; ctx.lineWidth = lw;
            const body = ctx.createLinearGradient(0, -s * 0.5, 0, s * 0.1);
            body.addColorStop(0, '#ffe680'); body.addColorStop(1, '#f2b81e');
            ctx.fillStyle = body;
            // Тело с хвостиком
            ctx.beginPath();
            ctx.moveTo(-s * 0.48, -s * 0.32);
            ctx.quadraticCurveTo(-s * 0.4, -s * 0.12, -s * 0.3, -s * 0.1);
            ctx.quadraticCurveTo(-s * 0.5, s * 0.12, -s * 0.05, s * 0.12);
            ctx.quadraticCurveTo(s * 0.42, s * 0.12, s * 0.42, -s * 0.12);
            ctx.quadraticCurveTo(s * 0.2, -s * 0.28, -s * 0.15, -s * 0.22);
            ctx.closePath(); ctx.fill(); ctx.stroke();
            // Голова
            ctx.beginPath(); ctx.arc(s * 0.2, -s * 0.42, s * 0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            // Клюв
            ctx.fillStyle = '#ff8a3a';
            ctx.beginPath(); ctx.moveTo(s * 0.36, -s * 0.44); ctx.quadraticCurveTo(s * 0.58, -s * 0.44, s * 0.56, -s * 0.36); ctx.quadraticCurveTo(s * 0.46, -s * 0.31, s * 0.36, -s * 0.35); ctx.closePath(); ctx.fill(); ctx.stroke();
            // Глаз и крыло
            ctx.fillStyle = OUT;
            ctx.beginPath(); ctx.arc(s * 0.25, -s * 0.48, s * 0.035, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(s * 0.26, -s * 0.49, s * 0.012, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#c8901a'; ctx.lineWidth = lw * 0.9;
            ctx.beginPath(); ctx.moveTo(-s * 0.12, -s * 0.12); ctx.quadraticCurveTo(s * 0.05, -s * 0.02, s * 0.2, -s * 0.12); ctx.stroke();
            // Щёчка и блик
            ctx.fillStyle = 'rgba(255,130,110,0.45)';
            ctx.beginPath(); ctx.arc(s * 0.16, -s * 0.38, s * 0.045, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.beginPath(); ctx.ellipse(s * 0.12, -s * 0.54, s * 0.06, s * 0.03, -0.5, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        },
        // Ракушка-гребешок с жемчужным отливом
        shell(ctx, s, t) {
            const r = s * 0.42, lw = Math.max(1.2, s * 0.035);
            ctx.save();
            ctx.translate(0, -r * 0.35);
            const g = ctx.createLinearGradient(-r, -r, r, r * 0.4);
            g.addColorStop(0, '#fff0f4'); g.addColorStop(0.45, '#ffc2d0'); g.addColorStop(1, '#e8789a');
            ctx.fillStyle = g; ctx.strokeStyle = '#9a3a5a'; ctx.lineWidth = lw; ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(-r * 0.25, r * 0.5);
            for (let i = 0; i <= 7; i++) {
                const a = Math.PI + Math.PI * i / 7;
                ctx.quadraticCurveTo(Math.cos(a - 0.22) * r * 1.08, Math.sin(a - 0.22) * r * 1.08, Math.cos(a) * r, Math.sin(a) * r);
            }
            ctx.lineTo(r * 0.25, r * 0.5);
            ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.strokeStyle = 'rgba(154,58,90,0.55)'; ctx.lineWidth = lw * 0.7;
            for (let i = 1; i < 7; i++) {
                const a = Math.PI + Math.PI * i / 7;
                ctx.beginPath(); ctx.moveTo(0, r * 0.45); ctx.lineTo(Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.92); ctx.stroke();
            }
            // Ушки у основания
            ctx.fillStyle = '#f29ab2'; ctx.strokeStyle = '#9a3a5a'; ctx.lineWidth = lw;
            ctx.beginPath(); ctx.moveTo(-r * 0.42, r * 0.38); ctx.lineTo(r * 0.42, r * 0.38); ctx.lineTo(r * 0.3, r * 0.62); ctx.lineTo(-r * 0.3, r * 0.62); ctx.closePath(); ctx.fill(); ctx.stroke();
            // Перламутровый перелив
            const sh = (Math.sin(t * 2) + 1) / 2;
            ctx.fillStyle = 'rgba(255,255,255,' + (0.35 + sh * 0.4) + ')';
            ctx.beginPath(); ctx.ellipse(-r * 0.35, -r * 0.45, r * 0.22, r * 0.09, -0.6, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        },
        // Сундучок с монетами: дерево, золотые полосы, крышка чуть приоткрыта
        chest(ctx, s, t) {
            const w = s * 0.82, h = s * 0.42, lw = Math.max(1.2, s * 0.035);
            ctx.save();
            ctx.lineJoin = 'round'; ctx.strokeStyle = OUT; ctx.lineWidth = lw;
            const wood = ctx.createLinearGradient(0, -h, 0, h * 0.2);
            wood.addColorStop(0, '#b87a3a'); wood.addColorStop(1, '#7a4a20');
            ctx.fillStyle = wood;
            ctx.beginPath(); ctx.rect(-w / 2, -h * 0.8, w, h); ctx.fill(); ctx.stroke();
            // Золото из-под крышки
            const glow = (Math.sin(t * 3) + 1) / 2;
            ctx.fillStyle = '#ffd23a';
            ctx.beginPath(); ctx.ellipse(0, -h * 0.82, w * 0.42, h * 0.16, 0, Math.PI, 0); ctx.fill();
            ctx.fillStyle = 'rgba(255,240,170,' + (0.4 + glow * 0.5) + ')';
            ctx.beginPath(); ctx.arc(-w * 0.12, -h * 0.9, s * 0.04, 0, Math.PI * 2); ctx.arc(w * 0.15, -h * 0.88, s * 0.03, 0, Math.PI * 2); ctx.fill();
            // Крышка
            ctx.fillStyle = '#c8884a';
            ctx.save();
            ctx.translate(-w / 2, -h * 0.8);
            ctx.rotate(-0.22);
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.quadraticCurveTo(w * 0.5, -h * 0.75, 0, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#f2c43a';
            ctx.fillRect(w * 0.15, -h * 0.28, w * 0.07, h * 0.28); ctx.fillRect(w * 0.78, -h * 0.28, w * 0.07, h * 0.28);
            ctx.restore();
            // Полосы и замок
            ctx.fillStyle = '#f2c43a';
            ctx.fillRect(-w * 0.35, -h * 0.8, w * 0.07, h); ctx.fillRect(w * 0.28, -h * 0.8, w * 0.07, h);
            ctx.beginPath(); ctx.rect(-w * 0.07, -h * 0.62, w * 0.14, h * 0.26); ctx.fill(); ctx.stroke();
            ctx.restore();
        }
    };
    D.ART = ART;
})(window.FB);
