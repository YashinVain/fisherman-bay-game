// aquarium.js — окно «Аквариум»: живая картинка (рыбы плавают, пузыри, украшения),
// монеты раз в день и три вкладки: рыбы, украшения, трофеи. Правила — в game/aqua.js.

(function (FB) {
    const AU = FB.aquaUI = {};
    const UI = FB.ui, U = FB.U, AQ = FB.aqua;
    let tab = 'fish';
    let swim = {};          // id рыбы → { x, y, vx, ph } — чтобы рыбы не прыгали при обновлении окна
    let bubbles = [];

    AU.open = (which) => {
        tab = which || tab;
        const render = () => {
            const box = UI.el('div');
            const tank = UI.el('div.aq-tank');
            const c = document.createElement('canvas');
            tank.appendChild(c);
            box.appendChild(tank);
            box.appendChild(incomeRow());
            box.appendChild(UI.tabs([['fish', FB.t('aq_fish')], ['decor', FB.t('aq_decor')], ['trophy', FB.t('aq_trophy')]], tab, (id) => { tab = id; UI.refresh(); }));
            box.appendChild(tab === 'fish' ? fishTab() : tab === 'decor' ? decorTab() : trophyTab());
            requestAnimationFrame(() => animate(c));
            return box;
        };
        UI.open({ title: FB.t('aqua'), body: render(), render, width: 'min(96vw, 640px)', tip: 'aqua' });
    };

    // ---------- Монеты раз в день ----------
    function incomeRow() {
        const row = UI.el('div.aq-income');
        const n = AQ.income();
        if (!n) { row.innerHTML = FB.ic('info') + '<span>' + FB.t('aq_empty') + '</span>'; return row; }
        row.innerHTML = FB.ic('coin') + '<span>' + FB.t('aq_income', { n }) + '</span>';
        if (AQ.canCollect()) {
            row.appendChild(UI.btn('small yellow', FB.t('take'), (e) => {
                const got = AQ.collect();
                if (!got) return;
                const r = e.currentTarget ? e.currentTarget.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0 };
                UI.fly('coin', r.left + r.width / 2, r.top, 6);
                FB.hud.update();
                UI.refresh();
            }));
        } else row.appendChild(UI.el('span.muted', { text: FB.t('aq_tomorrow') }));
        return row;
    }

    // ---------- Рыбы ----------
    function fishTab() {
        const box = UI.el('div');
        const a = AQ.st();
        const grid = UI.el('div.grid.small');
        for (let i = 0; i < AQ.MAX; i++) {
            const id = a.fish[i];
            if (id) {
                const f = FB.fishById[id];
                const card = UI.el('div.card.item.aq-slot', { html: '<div class="prev"><img src="' + FB.fishArt.url(id, 110) + '" alt=""></div><div class="nm">' + U.esc(FB.name(f)) + '</div><div class="src">' + U.weight(FB.S.album[id].best) + '</div>' });
                card.appendChild(UI.btn('small grey', FB.t('aq_remove'), () => { AQ.removeFish(id); delete swim[id]; UI.refresh(); }));
                grid.appendChild(card);
            } else if (i < a.slots) {
                const card = UI.el('div.card.item.aq-slot.empty', { html: '<div class="prev"><span class="plus-big">+</span></div><div class="nm">' + FB.t('aq_free_slot') + '</div>' });
                card.appendChild(UI.btn('small', FB.t('aq_put'), () => pickFish()));
                grid.appendChild(card);
            } else if (i === a.slots) {
                const cost = AQ.nextSlotCost();
                const card = UI.el('div.card.item.aq-slot.locked', { html: '<div class="prev">' + FB.ic('lock') + '</div><div class="nm">' + FB.t('aq_new_slot') + '</div>' });
                card.appendChild(UI.btn('small yellow', UI.price({ coins: cost }), () => {
                    if (AQ.buySlot()) { FB.audio.play('coin'); FB.hud.update(); UI.refresh(); }
                    else UI.toast(FB.t('not_enough'), 'coin');
                }));
                grid.appendChild(card);
            }
        }
        box.appendChild(grid);
        box.appendChild(UI.el('p.muted.center', { text: FB.t('aq_fish_hint'), style: 'font-size:13px;margin:10px 0 0' }));
        return box;
    }

    // Выбор рыбы из альбома
    function pickFish() {
        const render = () => {
            const box = UI.el('div');
            const list = FB.FISH.filter(f => FB.S.album[f.id] && !AQ.st().fish.includes(f.id));
            if (!list.length) { box.appendChild(UI.el('p.muted.center', { text: FB.t('aq_no_fish') })); return box; }
            const grid = UI.el('div.grid.small');
            list.forEach(f => {
                const card = UI.el('div.card.fishcard.rar-' + f.r, { html: '<img src="' + FB.fishArt.url(f.id, 110) + '" alt=""><div class="nm">' + U.esc(FB.name(f)) + '</div><div class="wt">' + U.weight(FB.S.album[f.id].best) + '</div>' });
                card.addEventListener('click', () => {
                    FB.audio.play('click');
                    if (AQ.addFish(f.id)) { FB.audio.play('plop'); UI.close(); UI.refresh(); }
                });
                grid.appendChild(card);
            });
            box.appendChild(grid);
            return box;
        };
        UI.open({ title: FB.t('aq_choose'), body: render(), render, width: 'min(96vw, 560px)' });
    }

    // ---------- Украшения ----------
    function decorTab() {
        const box = UI.el('div');
        const a = AQ.st();
        const grid = UI.el('div.grid.small');
        AQ.DECOR.forEach(d => {
            const owned = a.decor.includes(d.id), on = a.on.includes(d.id);
            const card = UI.el('div.card.item' + (on ? '.on' : ''));
            const c = document.createElement('canvas');
            c.width = 192; c.height = 140;
            preview(c, { decor: d.id });
            card.appendChild(UI.el('div.prev', {}, [c]));
            card.appendChild(UI.el('div.nm', { text: FB.name(d) }));
            if (owned) card.appendChild(UI.btn(on ? 'small grey' : 'small', on ? FB.t('aq_take_off') : FB.t('aq_place'), () => { AQ.toggleDecor(d.id); UI.refresh(); }));
            else card.appendChild(UI.btn('small ' + (d.cost.pearls ? 'violet' : 'yellow'), UI.price(d.cost), () => buy(() => AQ.buyDecor(d.id), d.cost)));
            grid.appendChild(card);
        });
        box.appendChild(grid);
        box.appendChild(UI.el('div.sec-title', { html: FB.ic('sparkle') + FB.t('aq_themes') }));
        const tg = UI.el('div.grid.small');
        AQ.THEMES.forEach(th => {
            const owned = a.themes.includes(th.id), on = a.theme === th.id;
            const card = UI.el('div.card.item' + (on ? '.on' : ''));
            const c = document.createElement('canvas');
            c.width = 192; c.height = 140;
            preview(c, { theme: th.id });
            card.appendChild(UI.el('div.prev', {}, [c]));
            card.appendChild(UI.el('div.nm', { text: FB.name(th) }));
            if (on) card.appendChild(UI.el('span.owned', { html: FB.ic('check') + FB.t('equipped') }));
            else if (owned) card.appendChild(UI.btn('small', FB.t('choose'), () => { AQ.setTheme(th.id); UI.refresh(); }));
            else card.appendChild(UI.btn('small ' + (th.cost.pearls ? 'violet' : 'yellow'), UI.price(th.cost), () => buy(() => AQ.buyTheme(th.id), th.cost)));
            tg.appendChild(card);
        });
        box.appendChild(tg);
        return box;
    }
    function buy(fn, cost) {
        if (fn()) { FB.audio.play('coin'); FB.hud.update(); UI.refresh(); }
        else UI.toast(FB.t(cost.pearls ? 'not_enough_pearls' : 'not_enough'), cost.pearls ? 'pearl' : 'coin');
    }

    // ---------- Трофеи ----------
    function trophyTab() {
        const S = FB.S, box = UI.el('div');
        const best = S.stats.bestId ? FB.fishById[S.stats.bestId] : null;
        box.appendChild(UI.el('div.aq-plaque', { html: best
            ? '<img src="' + FB.fishArt.url(best.id, 120) + '" alt=""><div><div class="k">' + FB.t('aq_record') + '</div><div class="v">' + U.esc(FB.name(best)) + ' · ' + U.weight(S.stats.bestG) + '</div></div>'
            : FB.ic('fish') + '<div><div class="k">' + FB.t('aq_record') + '</div><div class="v">—</div></div>' }));
        box.appendChild(UI.el('div.sec-title', { html: FB.ic('album') + FB.t('aq_collections') }));
        const cl = UI.el('div.aq-coll');
        AQ.collections().forEach(c => {
            cl.appendChild(UI.el('div.coll' + (c.done ? '.done' : ''), { html: (c.done ? FB.ic('medal', '#ffd23a') : FB.ic('fish')) +
                '<div><b>' + U.esc(FB.name(c.pond)) + '</b><small>' + FB.t('caught_of', { a: c.got, b: c.total }) + '</small></div>' }));
        });
        box.appendChild(cl);
        box.appendChild(UI.el('div.sec-title', { html: FB.ic('trophy') + FB.t('trophies') }));
        if (S.trophies.length) {
            const colors = { gold: '#ffd23a', silver: '#d6dee6', bronze: '#e8a46a', top20: '#9cd4f4', top100: '#9cd4f4' };
            box.appendChild(UI.el('div.trophies', { html: S.trophies.slice(-24).reverse().map(t =>
                '<div class="trophy">' + FB.ic('medal', colors[t.kind] || '#9cd4f4') + '<div>' + FB.t('place_n', { n: t.rank }) + '</div></div>').join('') }));
        } else box.appendChild(UI.el('p.muted', { text: FB.t('no_trophies') }));
        if (S.stats.bestLuck) box.appendChild(UI.el('p.muted.center', { text: FB.t('aq_best_luck', { n: S.stats.bestLuck }), style: 'font-size:14px' }));
        return box;
    }

    // ---------- Картинка аквариума ----------
    function animate(c) {
        if (!c.isConnected) return;
        const box = c.parentNode;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        const W = box.clientWidth, H = Math.round(Math.min(260, Math.max(170, W * 0.42)));
        if (c.width !== Math.round(W * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); c.style.height = H + 'px'; }
        const ctx = c.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const a = AQ.st();
        drawTank(ctx, W, H, performance.now() / 1000, a.theme, a.on, a.fish, true);
        requestAnimationFrame(() => animate(c));
    }

    // Маленькая картинка для карточки украшения или фона
    function preview(c, what) {
        const ctx = c.getContext('2d');
        const a = AQ.st();
        if (what.decor) { drawTank(ctx, c.width, c.height, 1.3, a.theme, [], [], false); drawDecorBig(ctx, what.decor, c.width, c.height); }
        else drawTank(ctx, c.width, c.height, 1.3, what.theme, ['plants'], [], false);
    }

    // Украшение крупно, по центру карточки
    function drawDecorBig(ctx, id, W, H) {
        const y = H * 0.86, th = THEME[AQ.st().theme] || THEME.pond;
        if (id === 'plants') drawPlants(ctx, W * 0.5, y, H * 1.1, 1.3, th.plant);
        else if (id === 'stones') { ctx.save(); ctx.translate(W * 0.5, y - H * 0.05); ctx.scale(2.2, 2.2); drawStones(ctx, 0, 0, H * 0.45); ctx.restore(); }
        else if (id === 'chest') drawChest(ctx, W * 0.5, y, H * 0.45, 1.3, false);
        else if (id === 'castle') drawCastle(ctx, W * 0.5, y, H * 0.75, AQ.st().theme === 'night');
        else if (id === 'diver') drawDiver(ctx, W * 0.5, y, H * 0.75, 1.3, false);
        else if (id === 'coral') drawCoral(ctx, W * 0.5, y, H * 1.0);
        else if (id === 'ship') drawShip(ctx, W * 0.5, y, H * 0.55, 1.3);
    }

    const THEME = {
        pond: { top: '#8ad6e6', bot: '#2a7e9e', sand: '#e6d29c', sand2: '#cdb57a', plant: '#4aa848' },
        sea: { top: '#6cc4f4', bot: '#1a4f92', sand: '#f0dcae', sand2: '#d8c08a', plant: '#3a9a7a' },
        night: { top: '#24386e', bot: '#0b1236', sand: '#5a5a7a', sand2: '#44445e', plant: '#2a7a6a' }
    };

    function drawTank(ctx, W, H, t, themeId, on, fish, live) {
        const th = THEME[themeId] || THEME.pond, night = themeId === 'night';
        // Вода
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, th.top); g.addColorStop(1, th.bot);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        // Лучи света сверху
        ctx.save();
        for (let i = 0; i < 4; i++) {
            const x = W * (0.15 + i * 0.24) + Math.sin(t * 0.3 + i) * W * 0.03;
            const lg = ctx.createLinearGradient(0, 0, 0, H * 0.8);
            lg.addColorStop(0, night ? 'rgba(180,200,255,0.12)' : 'rgba(255,255,255,0.22)');
            lg.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = lg;
            ctx.beginPath(); ctx.moveTo(x - W * 0.03, 0); ctx.lineTo(x + W * 0.03, 0); ctx.lineTo(x + W * 0.09, H * 0.8); ctx.lineTo(x - W * 0.02, H * 0.8); ctx.closePath(); ctx.fill();
        }
        ctx.restore();
        const sandY = H * 0.82;
        const has = (id) => on.includes(id);
        // Задний план
        if (has('ship')) drawShip(ctx, W * 0.5, sandY + H * 0.02, H * 0.36, t);
        if (has('castle')) drawCastle(ctx, W * 0.76, sandY + H * 0.03, H * 0.42, night);
        // Песок
        ctx.fillStyle = th.sand;
        ctx.beginPath();
        ctx.moveTo(0, H);
        for (let x = 0; x <= W; x += 12) ctx.lineTo(x, sandY + Math.sin(x * 0.03) * H * 0.02);
        ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
        ctx.fillStyle = th.sand2;
        for (let i = 0; i < 14; i++) { ctx.beginPath(); ctx.ellipse((i * 97) % W, sandY + H * 0.08 + (i % 3) * H * 0.03, H * 0.012, H * 0.006, 0, 0, Math.PI * 2); ctx.fill(); }
        if (has('plants')) { drawPlants(ctx, W * 0.06, sandY, H, t, th.plant); drawPlants(ctx, W * 0.94, sandY, H * 0.85, t + 1, th.plant); }
        if (has('coral')) drawCoral(ctx, W * 0.88, sandY + H * 0.02, H * 0.3);
        if (has('stones')) drawStones(ctx, W * 0.42, sandY + H * 0.06, H);
        if (has('chest')) drawChest(ctx, W * 0.28, sandY + H * 0.05, H * 0.16, t, live);
        if (has('diver')) drawDiver(ctx, W * 0.16, sandY + H * 0.04, H * 0.34, t, live);
        // Рыбы
        if (fish.length) drawFish(ctx, W, H, sandY, t, fish);
        // Пузыри
        if (live) {
            if (bubbles.length < 40 && Math.random() < 0.05) bubbles.push({ x: W * (0.05 + Math.random() * 0.9), y: sandY, r: 1.5 + Math.random() * 3, v: 20 + Math.random() * 25 });
            bubbles = bubbles.filter(b => { b.y -= b.v / 60; b.x += Math.sin(b.y * 0.05) * 0.3; return b.y > 0; });
            ctx.strokeStyle = 'rgba(255,255,255,0.75)';
            ctx.lineWidth = 1;
            bubbles.forEach(b => { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.stroke(); });
        }
        if (night) {
            // Ночью — мягкое свечение по дну
            const ng = ctx.createRadialGradient(W * 0.5, sandY, 0, W * 0.5, sandY, W * 0.6);
            ng.addColorStop(0, 'rgba(120,255,220,0.18)'); ng.addColorStop(1, 'rgba(120,255,220,0)');
            ctx.fillStyle = ng; ctx.fillRect(0, 0, W, H);
        }
        // Блик на стекле
        const gl = ctx.createLinearGradient(0, 0, W, H);
        gl.addColorStop(0, 'rgba(255,255,255,0.18)'); gl.addColorStop(0.25, 'rgba(255,255,255,0)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);
    }

    function drawFish(ctx, W, H, sandY, t, fish) {
        const now = t;
        fish.forEach((id, i) => {
            const f = FB.fishById[id];
            const best = (FB.S.album[id] && FB.S.album[id].best) || f.w[0];
            // Размер: по весу, но в разумных пределах, чтобы все поместились
            const size = U.clamp(H * (0.16 + Math.log10(best) * 0.05), H * 0.16, H * 0.42);
            let s = swim[id];
            if (!s) s = swim[id] = { x: W * (0.15 + Math.random() * 0.7), y: H * (0.18 + (i % 4) * 0.15), vx: (Math.random() < 0.5 ? -1 : 1) * (W * 0.05 + Math.random() * W * 0.04), ph: Math.random() * 6, last: now };
            const dt = U.clamp(now - s.last, 0, 0.05);
            s.last = now;
            s.x += s.vx * dt;
            if (s.x < size * 0.5 && s.vx < 0) s.vx = -s.vx;
            if (s.x > W - size * 0.5 && s.vx > 0) s.vx = -s.vx;
            const y = U.clamp(s.y + Math.sin(now * 0.8 + s.ph) * H * 0.05, size * 0.3, sandY - size * 0.25);
            const img = FB.fishArt.canvas(id, 120);
            const w = size, h = size * img.height / img.width;
            ctx.save();
            ctx.translate(s.x, y);
            ctx.scale(s.vx >= 0 ? 1 : -1, 1);
            ctx.rotate(Math.sin(now * 2 + s.ph) * 0.05);
            ctx.drawImage(img, -w / 2, -h / 2, w, h);
            ctx.restore();
        });
    }

    function drawPlants(ctx, x0, base, H, t, col) {
        ctx.lineCap = 'round';
        for (let i = 0; i < 6; i++) {
            const x = x0 + (i - 2.5) * H * 0.035;
            const h = H * (0.35 + (i % 3) * 0.12);
            const sw = Math.sin(t * 1.2 + i) * H * 0.05;
            ctx.strokeStyle = i % 2 ? col : U.shade(col, -0.2);
            ctx.lineWidth = H * 0.03;
            ctx.beginPath(); ctx.moveTo(x, base + H * 0.04);
            ctx.bezierCurveTo(x + sw, base - h * 0.4, x - sw, base - h * 0.7, x + sw * 1.2, base - h);
            ctx.stroke();
        }
    }
    function drawStones(ctx, x, y, H) {
        const cols = ['#e86a5a', '#f2c43a', '#5ab8e8', '#8ad86a', '#c88ae8', '#f29a4a'];
        for (let i = 0; i < 9; i++) {
            ctx.fillStyle = cols[i % cols.length];
            ctx.beginPath(); ctx.ellipse(x + (i - 4) * H * 0.045, y + Math.sin(i * 2.3) * H * 0.015, H * 0.025, H * 0.016, 0, 0, Math.PI * 2); ctx.fill();
        }
    }
    function drawChest(ctx, x, y, s, t, live) {
        const open = live ? Math.max(0, Math.sin(t * 0.8)) : 0.4;
        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = '#8a5a2a'; ctx.strokeStyle = '#4a2e12'; ctx.lineWidth = Math.max(1, s * 0.06);
        ctx.fillRect(-s * 0.7, -s * 0.6, s * 1.4, s * 0.6); ctx.strokeRect(-s * 0.7, -s * 0.6, s * 1.4, s * 0.6);
        ctx.fillStyle = '#f2c43a'; ctx.fillRect(-s * 0.1, -s * 0.45, s * 0.2, s * 0.2);
        // Крышка приоткрывается, оттуда — золото и пузыри
        ctx.save();
        ctx.translate(-s * 0.7, -s * 0.6);
        ctx.rotate(-open * 0.7);
        ctx.fillStyle = '#9a6a32';
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(s * 1.4, 0); ctx.quadraticCurveTo(s * 0.7, -s * 0.55, 0, 0); ctx.fill(); ctx.stroke();
        ctx.restore();
        if (open > 0.3 && bubbles.length < 40) {
            ctx.fillStyle = 'rgba(255,220,90,0.9)';
            ctx.beginPath(); ctx.ellipse(0, -s * 0.62, s * 0.5, s * 0.12, 0, 0, Math.PI * 2); ctx.fill();
            if (live && Math.random() < 0.05) bubbles.push({ x: x + (Math.random() - 0.5) * s, y: y - s * 0.7, r: 2 + Math.random() * 3, v: 30 });
        }
        ctx.restore();
    }
    function drawCastle(ctx, x, y, h, night) {
        ctx.save();
        ctx.translate(x, y);
        const c1 = '#9aa4b0', c2 = '#7e8894';
        ctx.fillStyle = c2; ctx.fillRect(-h * 0.45, -h * 0.55, h * 0.9, h * 0.55);
        [[-h * 0.45, h * 0.9], [h * 0.25, h * 0.75]].forEach(([tx, th]) => {
            ctx.fillStyle = c1; ctx.fillRect(tx, -th, h * 0.2, th);
            ctx.fillStyle = '#d8604a';
            ctx.beginPath(); ctx.moveTo(tx - h * 0.04, -th); ctx.lineTo(tx + h * 0.1, -th - h * 0.2); ctx.lineTo(tx + h * 0.24, -th); ctx.closePath(); ctx.fill();
            ctx.fillStyle = night ? '#ffd86a' : '#2a3550';
            ctx.fillRect(tx + h * 0.07, -th * 0.7, h * 0.06, h * 0.1);
        });
        ctx.fillStyle = '#4a3a2a';
        ctx.beginPath(); ctx.arc(0, 0, h * 0.13, Math.PI, 0); ctx.fill();
        ctx.restore();
    }
    function drawDiver(ctx, x, y, h, t, live) {
        ctx.save();
        ctx.translate(x, y + Math.sin(t) * h * 0.01);
        ctx.fillStyle = '#e8a02a'; ctx.strokeStyle = '#6a4206'; ctx.lineWidth = Math.max(1, h * 0.02);
        ctx.fillRect(-h * 0.13, -h * 0.55, h * 0.26, h * 0.35); ctx.strokeRect(-h * 0.13, -h * 0.55, h * 0.26, h * 0.35);
        ctx.fillStyle = '#5a6470';
        ctx.fillRect(-h * 0.11, -h * 0.2, h * 0.09, h * 0.2); ctx.fillRect(h * 0.02, -h * 0.2, h * 0.09, h * 0.2);
        ctx.fillStyle = '#c8a050';
        ctx.beginPath(); ctx.arc(0, -h * 0.68, h * 0.17, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#9ad8f0';
        ctx.beginPath(); ctx.arc(h * 0.03, -h * 0.68, h * 0.09, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.restore();
        if (live && bubbles.length < 40 && Math.random() < 0.03) bubbles.push({ x: x + h * 0.05, y: y - h * 0.85, r: 2 + Math.random() * 2, v: 26 });
    }
    function drawCoral(ctx, x, y, h) {
        ctx.save();
        ctx.translate(x, y);
        ctx.lineCap = 'round';
        const branch = (bx, by, len, ang, w, col, d) => {
            if (d > 3) return;
            const ex = bx + Math.cos(ang) * len, ey = by + Math.sin(ang) * len;
            ctx.strokeStyle = col; ctx.lineWidth = w;
            ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
            branch(ex, ey, len * 0.7, ang - 0.5, w * 0.7, col, d + 1);
            branch(ex, ey, len * 0.7, ang + 0.45, w * 0.7, col, d + 1);
        };
        branch(-h * 0.1, 0, h * 0.35, -Math.PI / 2 - 0.2, h * 0.08, '#f2708a', 0);
        branch(h * 0.12, 0, h * 0.28, -Math.PI / 2 + 0.25, h * 0.07, '#f2a04a', 0);
        ctx.restore();
    }
    function drawShip(ctx, x, y, h, t) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-0.12);
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = '#6a4a2a'; ctx.strokeStyle = '#3a2614'; ctx.lineWidth = Math.max(1, h * 0.02);
        ctx.beginPath(); ctx.moveTo(-h * 0.8, -h * 0.3); ctx.lineTo(h * 0.8, -h * 0.3); ctx.lineTo(h * 0.6, 0); ctx.lineTo(-h * 0.65, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#5a3a1e';
        ctx.fillRect(-h * 0.03, -h * 1.0, h * 0.06, h * 0.7);
        ctx.fillStyle = 'rgba(240,230,210,0.7)';
        ctx.beginPath(); ctx.moveTo(h * 0.03, -h * 0.95); ctx.lineTo(h * 0.4, -h * 0.6); ctx.lineTo(h * 0.03, -h * 0.45); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#2a1a0a';
        [-0.4, 0, 0.4].forEach(k => { ctx.beginPath(); ctx.arc(h * k, -h * 0.16, h * 0.05, 0, Math.PI * 2); ctx.fill(); });
        ctx.restore();
    }
})(window.FB);
