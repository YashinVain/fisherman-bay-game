// camera.js — «оператор»: камера живёт вместе с рыбалкой.
// Каждая проба поплавка вздрагивает сильнее прошлой, поклёвка — толчок,
// подсечка — удар, в борьбе картинка дрожит тем сильнее, чем сильнее рыба,
// чем дольше бой и чем ближе леска к обрыву. На свечке время на миг
// замедляется и камера подаётся к рыбе, вытащил — удар и выдох.
// Трясётся только сцена (холст), кнопки и шкала стоят на месте.
// Тряска плавная (сумма синусов), а не дёрганый шум — так она «киношная».
// В настройках можно выключить: S.settings.shake = false.

(function (FB) {
    const CAM = FB.cam = {};
    const U = FB.U;
    let trauma = 0;          // всплески: 0..1, быстро гаснут
    let rumble = 0;          // постоянная дрожь этого кадра (борьба)
    let punch = 0;           // короткий «наезд» камеры
    let zoom = 1, zoomTo = 1;
    let fx = 0.5, fy = 0.6, fxTo = 0.5, fyTo = 0.6;
    let slowK = 1, slowTo = 1, slowLeft = 0;
    let vig = 0, vigTo = 0, danger = false;
    let t = 0;
    let applied = false;
    let canvas = null, vigEl = null;
    const ph = [1.3, 4.1, 2.7, 0.6, 5.2, 3.3];

    CAM.enabled = () => !FB.S || FB.S.settings.shake !== false;
    CAM.kick = (a) => { if (CAM.enabled()) trauma = Math.min(1, trauma + a); };
    CAM.punch = (z) => { if (CAM.enabled()) punch = Math.max(punch, z); };
    CAM.rumble = (lvl) => { rumble = Math.max(rumble, lvl); };
    // Плавно подвести камеру к точке экрана и чуть приблизить
    CAM.focus = (x, y, z) => {
        const SC = FB.scene;
        fxTo = U.clamp(x / SC.W, 0.15, 0.85); fyTo = U.clamp(y / SC.H, 0.2, 0.85);
        zoomTo = z;
    };
    CAM.release = () => { zoomTo = 1; };
    // Замедление времени (k < 1) на dur секунд
    CAM.slowmo = (k, dur) => { if (CAM.enabled()) { slowTo = k; slowLeft = dur; } };
    CAM.timeScale = () => slowK;
    CAM.vignette = (v, isDanger) => { vigTo = Math.max(vigTo, v); danger = danger || !!isDanger; };
    CAM.reset = () => { trauma = rumble = punch = 0; zoomTo = 1; slowTo = 1; slowLeft = 0; vigTo = 0; };

    // ---------- Режиссёр: что делает камера в каждый момент рыбалки ----------
    let nibbles = 0, biteT = -1, fightT = 0, lastSurge = 0, lastWarn = 0, lastJump = 0, lastPhase = 'idle';
    const order = () => { const F = FB.fishing; return F.res && F.res.kind === 'fish' ? FB.RARITY[F.res.fish.r].order : 0; };
    FB.on('cast', () => { nibbles = 0; });
    FB.on('nibble', () => {
        nibbles++;
        // Каждая проба — сильнее прошлой: камера «прислушивается», удар чуть громче
        CAM.kick(0.1 + 0.07 * nibbles);
        CAM.punch(0.006 + 0.004 * nibbles);
        FB.audio.play('impact', 0.18 + 0.12 * nibbles);
    });
    FB.on('bite', () => {
        biteT = 0;
        CAM.kick(0.42 + 0.07 * order() + 0.04 * nibbles);
        CAM.punch(0.03);
        FB.audio.play('impact', 0.7 + 0.08 * order());
        FB.audio.play('beat', 0.8);
    });
    FB.on('fightStart', () => {
        const F = FB.fishing;
        fightT = 0;
        CAM.kick(0.32 + (F.str || 0.3) * 0.35 + (F.perfect ? 0.1 : 0));
        CAM.punch(0.045);
        FB.audio.play('impact', 0.85 + (F.str || 0.3) * 0.4);
    });
    FB.on('fightEnd', () => {
        // Рыба на мостках: удар, выдох, у редкой — секунда замедления
        CAM.kick(0.45 + 0.06 * order());
        CAM.punch(0.05);
        CAM.release();
        FB.audio.play('impact', 0.9 + 0.08 * order());
        if (order() >= 2) CAM.slowmo(0.55, 0.5);
    });
    FB.on('lost', (e) => {
        CAM.kick(e && e.reason === 'snap' ? 0.7 : 0.22);
        if (e && e.reason === 'snap') FB.audio.play('impact', 0.9);
        CAM.release();
    });

    function direct(dt) {
        const F = FB.fishing, SC = FB.scene;
        if (!F || !SC || !SC.W) return;
        if (F.phase !== lastPhase) {
            if (F.phase === 'idle' || F.phase === 'cast') CAM.release();
            lastPhase = F.phase;
        }
        // Поклёвка: пока не подсёк, дрожь растёт — «быстрее, уйдёт!»
        if (F.phase === 'bite' && biteT >= 0) {
            biteT += dt;
            const win = isFinite(F.window) ? F.window : 1.2;
            CAM.rumble(0.22 + 0.35 * Math.min(1, biteT / win));
            CAM.vignette(0.18);
        } else biteT = -1;
        if (F.phase !== 'fight' || !F.zone) return;
        fightT += dt;
        const s = F.str || 0.3, z = F.zone;
        const hot = F.tension > z.hi, slack = F.tension < z.lo;
        // Дрожь борьбы: сила рыбы + чем дольше бой, тем сильнее + красная зона
        let lvl = 0.14 + s * 0.3 + Math.min(0.22, fightT * 0.035);
        if (hot) lvl += 0.22 + Math.min(0.2, (F.strain || 0) * 0.4);
        if (F.surge > 0) lvl += 0.12 * s;
        CAM.rumble(Math.min(0.85, lvl));
        // Рывок рыбы — отдельный толчок
        if (F.surge > lastSurge + 0.05) { CAM.kick(0.12 + 0.25 * s); FB.audio.play('impact', 0.25 + 0.35 * s); }
        lastSurge = F.surge || 0;
        // Свечка: предупреждение — толчок, в воздухе — замедление и наезд на рыбу
        if (F.jumpWarn > 0 && lastWarn <= 0) CAM.kick(0.2);
        lastWarn = F.jumpWarn || 0;
        const p = SC.project(F.fishTx, F.fishDist);
        if (F.jump > 0 && lastJump <= 0) { CAM.slowmo(0.5, 0.75); CAM.punch(0.04); CAM.kick(0.25); FB.audio.play('whoosh'); FB.audio.play('impact', 0.5); }
        lastJump = F.jump || 0;
        // Камера подаётся к борьбе: между рыбаком и рыбой, чуть ближе к рыбе
        const L = SC.L || { px: SC.W * 0.2, py: SC.H * 0.7 };
        const jumpZoom = F.jump > 0 ? 0.05 : 0;
        CAM.focus(p.x * 0.65 + L.px * 0.35, p.y * 0.7 + L.py * 0.3, 1.035 + s * 0.03 + Math.min(0.02, fightT * 0.004) + jumpZoom);
        CAM.vignette(0.22 + (hot ? 0.28 : slack ? 0.12 : 0), hot);
    }

    // ---------- Каждый кадр ----------
    CAM.update = (dt) => {
        t += dt;
        if (!canvas) canvas = document.getElementById('game');
        if (!canvas) return;
        if (!vigEl) {
            vigEl = document.createElement('div');
            vigEl.className = 'cam-vig';
            canvas.insertAdjacentElement('afterend', vigEl);
        }
        try { direct(dt); } catch (e) { /* камера не важнее игры */ }
        // Замедление: плавно входим и выходим
        slowLeft -= dt;
        const want = slowLeft > 0 ? slowTo : 1;
        slowK += (want - slowK) * Math.min(1, dt * 12);
        if (Math.abs(slowK - 1) < 0.01 && slowLeft <= 0) slowK = 1;
        const on = CAM.enabled();
        trauma = Math.max(0, trauma - dt * 1.15);
        punch *= Math.pow(0.004, dt);
        zoom += (zoomTo - zoom) * Math.min(1, dt * 1.8);
        fx += (fxTo - fx) * Math.min(1, dt * 2);
        fy += (fyTo - fy) * Math.min(1, dt * 2);
        const shake = on ? Math.min(1, trauma + rumble) : 0;
        // Гул звучит, пока идёт поклёвка или борьба (даже если тряска выключена)
        const fishPhase = FB.fishing && FB.fishing.phase;
        if (FB.audio.rumble) FB.audio.rumble(fishPhase === 'fight' || fishPhase === 'bite' ? Math.min(1, trauma * 0.5 + rumble) : 0);
        rumble = 0;
        const s2 = shake * shake;
        const m = Math.min(FB.scene.W || innerWidth, FB.scene.H || innerHeight);
        const amp = m * 0.02 * s2;
        // Плавная «киношная» тряска: несколько синусов разной частоты
        const nx = Math.sin(t * 21.3 + ph[0]) * 0.55 + Math.sin(t * 37.1 + ph[1]) * 0.3 + Math.sin(t * 7.9 + ph[2]) * 0.15;
        const ny = Math.sin(t * 18.7 + ph[3]) * 0.55 + Math.sin(t * 33.9 + ph[4]) * 0.3 + Math.sin(t * 6.1 + ph[5]) * 0.15;
        const nr = Math.sin(t * 15.3 + ph[2]) * 0.7 + Math.sin(t * 29.1 + ph[0]) * 0.3;
        const dx = nx * amp, dy = ny * amp, rot = nr * s2 * 0.7;
        // Запас по краям, чтобы при тряске не было видно краёв холста
        const sc = (on ? zoom + punch : 1) + s2 * 0.05;
        const idle = Math.abs(dx) < 0.05 && Math.abs(dy) < 0.05 && Math.abs(sc - 1) < 0.0005 && Math.abs(rot) < 0.002;
        if (!idle) {
            canvas.style.transformOrigin = (fx * 100).toFixed(2) + '% ' + (fy * 100).toFixed(2) + '%';
            canvas.style.transform = 'translate(' + dx.toFixed(2) + 'px,' + dy.toFixed(2) + 'px) rotate(' + rot.toFixed(3) + 'deg) scale(' + sc.toFixed(4) + ')';
            applied = true;
        } else if (applied) {
            canvas.style.transform = '';
            applied = false;
        }
        // Виньетка: тёмные края в напряжённые моменты, красные — когда леска на пределе
        vig += ((on ? vigTo : 0) - vig) * Math.min(1, dt * 5);
        vigEl.style.opacity = vig.toFixed(3);
        vigEl.classList.toggle('danger', danger);
        vigTo = 0; danger = false;
    };
})(window.FB);
