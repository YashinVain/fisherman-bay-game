// drift.js — находки на воде. С мостков до них не дотянуться, а с плота, лодки
// и яхты иногда видно, как мимо проплывает бутылка с запиской, резиновая уточка,
// ракушка или сундучок. Нажми на находку — она твоя. Чем лучше лодка, тем чаще
// находки и тем они ценнее. На турнир не влияет: только монеты и чуть жемчуга.

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

    D.update = (dt) => {
        const type = FB.person.boatType();
        const cfg = D.BOATS[type];
        if (!cfg) { D.item = null; return; }
        const F = FB.fishing;
        const it = D.item;
        if (it) {
            it.t += dt;
            if (it.got) { it.gotT += dt; if (it.gotT > 0.7) D.item = null; return; }
            it.tx += it.v * dt;
            // Уплыла за край — упустил
            if (it.tx < it.end) D.item = null;
            return;
        }
        if (F.phase !== 'idle' && F.phase !== 'wait') return;
        timer -= dt;
        if (timer > 0) return;
        timer = U.rand(cfg.every[0], cfg.every[1]);
        const kind = U.weighted(Object.keys(cfg.finds), k => cfg.finds[k]);
        const o = F.origin();
        // Плывёт справа налево поперёк воды, не слишком далеко — чтобы было видно
        D.item = { kind, tx: 1.15, end: o.tx + 0.35, dist: U.rand(0.18, 0.55), v: -U.rand(0.035, 0.05), t: 0, got: false, gotT: 0 };
        FB.emit('driftSpawn', D.item);
    };

    // Где находка на экране (и насколько крупно)
    D.pos = () => {
        const it = D.item;
        if (!it) return null;
        const p = FB.scene.project(it.tx, it.dist);
        const bob = Math.sin(it.t * 2.4) * FB.scene.unit() * 0.4 * p.s;
        return { x: p.x, y: p.y + bob, s: p.s, r: FB.scene.unit() * 6.5 * Math.max(0.75, p.s) };
    };

    // Нажали на находку? Тогда забираем и не забрасываем удочку
    D.hit = (x, y) => {
        const it = D.item, p = D.pos();
        if (!it || it.got || !p) return false;
        if (Math.hypot(x - p.x, y - (p.y - p.r * 0.4)) > p.r * 1.9) return false;
        it.got = true;
        const r = D.reward(it.kind);
        FB.state.giveReward(r);
        FB.S.stats.finds = (FB.S.stats.finds || 0) + 1;
        FB.state.save();
        FB.audio.play('junk', it.kind === 'chest' || it.kind === 'bottle' ? 'chest' : it.kind);
        FB.scene.splash(p.x, p.y, 0.5 * p.s * 1.6);
        FB.emit('driftFound', { kind: it.kind, reward: r, x: p.x, y: p.y });
        return true;
    };

    // ---------- Рисование (слой воды) ----------
    D.draw = (ctx) => {
        const it = D.item, p = D.pos();
        if (!it || !p) return;
        const SC = FB.scene, u = SC.unit();
        const size = p.r * 2.2;
        let a = Math.min(1, it.t / 0.8);
        let lift = 0, sc = 1;
        if (it.got) { const k = Math.min(1, it.gotT / 0.6); lift = -k * u * 12; sc = 1 + k * 0.4; a = 1 - k; }
        ctx.save();
        ctx.globalAlpha = a;
        // Круги на воде вокруг — чтобы находку заметили
        if (!it.got) {
            for (let i = 0; i < 2; i++) {
                const k = ((it.t * 0.7 + i * 0.5) % 1);
                ctx.strokeStyle = 'rgba(255,255,255,' + (0.5 * (1 - k)) + ')';
                ctx.lineWidth = Math.max(1, 1.4 * p.s);
                ctx.beginPath(); ctx.ellipse(p.x, p.y, size * (0.5 + k * 0.7), size * (0.15 + k * 0.2), 0, 0, Math.PI * 2); ctx.stroke();
            }
            // Искорка над находкой
            const tw = (Math.sin(it.t * 5) + 1) / 2;
            ctx.fillStyle = 'rgba(255,240,170,' + (0.4 + tw * 0.5) + ')';
            star(ctx, p.x + size * 0.35, p.y - size * 0.75, u * (0.6 + tw * 0.5));
        }
        ctx.translate(p.x, p.y + lift);
        ctx.rotate(Math.sin(it.t * 1.8) * 0.12);
        ctx.scale(sc, sc);
        if (it.kind === 'shell') drawShell(ctx, size);
        else {
            const img = FB.fishArt.canvas(it.kind, 120);
            const w = size, h = size * img.height / img.width;
            ctx.drawImage(img, -w / 2, -h * 0.75, w, h);
        }
        ctx.restore();
    };

    function star(ctx, x, y, r) {
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const a = i * Math.PI / 4, rr = i % 2 ? r * 0.35 : r;
            ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        ctx.closePath(); ctx.fill();
    }

    // Ракушка-гребешок: веер из рёбер
    function drawShell(ctx, size) {
        const r = size * 0.45;
        ctx.save();
        ctx.translate(0, -r * 0.4);
        const g = ctx.createLinearGradient(0, -r, 0, r * 0.4);
        g.addColorStop(0, '#ffd8e0'); g.addColorStop(1, '#f08aa0');
        ctx.fillStyle = g;
        ctx.strokeStyle = '#a84a62';
        ctx.lineWidth = Math.max(1, r * 0.08);
        ctx.beginPath();
        ctx.moveTo(0, r * 0.45);
        for (let i = 0; i <= 6; i++) {
            const a = Math.PI + Math.PI * i / 6;
            ctx.quadraticCurveTo(Math.cos(a - 0.26) * r * 1.05, Math.sin(a - 0.26) * r * 1.05, Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        for (let i = 1; i < 6; i++) {
            const a = Math.PI + Math.PI * i / 6;
            ctx.beginPath(); ctx.moveTo(0, r * 0.4); ctx.lineTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9); ctx.stroke();
        }
        ctx.fillStyle = '#e8708a';
        ctx.beginPath(); ctx.ellipse(0, r * 0.45, r * 0.3, r * 0.15, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.restore();
    }
})(window.FB);
