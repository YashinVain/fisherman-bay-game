// main.js — запуск игры и главный цикл. Здесь всё связывается вместе:
// SDK → сохранение → награды за прошлую неделю → сцена → интерфейс.

(function (FB) {
    const UI = FB.ui;
    let playing = false;     // нажата кнопка «Играть»
    let paused = false;      // реклама или свёрнутая вкладка
    let last = 0;

    async function boot() {
        // Язык до загрузки: по браузеру, потом уточним по Яндексу и настройкам
        FB.setLang(FB.pickLang(navigator.language));
        await FB.sdk.init();
        await FB.state.load();
        FB.setLang(FB.S.settings.lang || FB.pickLang(FB.sdk.lang || navigator.language));
        document.documentElement.lang = FB.lang;
        document.title = FB.t('title');

        await FB.shop.restore();
        FB.quests.sync();
        const weekRes = await FB.tourney.checkWeek();
        // Место могло закрыться (было турнирным на прошлой неделе)
        if (!FB.state.pondOpen(FB.S.pond)) FB.S.pond = 'village';

        const canvas = document.getElementById('game');
        FB.scene.init(canvas);
        FB.scene.setPlace(FB.S.pond, FB.week.weatherAt(FB.S.pond, FB.sdk.now()));
        FB.fishing.reset();
        wire();
        requestAnimationFrame(loop);

        FB.hud.showTitle(() => start(weekRes));
        FB.sdk.gameReady();
        const ld = document.getElementById('loading');
        ld.classList.add('out');
        setTimeout(() => ld.remove(), 600);
    }

    function start(weekRes) {
        FB.audio.unlock();
        playing = true;
        FB.hud.build();
        FB.tutor.init();
        FB.sdk.setGameplay(true);
        FB.hud.hint(FB.fishing.phase === 'idle' ? 'tap_water' : null);
        if (weekRes) FB.catchCard.weekResult(weekRes);
        // Подарок дня — приятное приветствие, но не для новичка в первую минуту
        if (FB.quests.giftReady() && FB.S.stats.catches > 0) FB.catchCard.later(() => FB.tasks.open('daily'));
        FB.tourney.submit();
    }

    function wire() {
        FB.on('landed', ({ res, ctx }) => FB.catchCard.show(res, ctx));
        FB.on('lost', (e) => FB.catchCard.lost(e));
        FB.on('levelUp', (e) => { FB.catchCard.levelUp(e); FB.hud.update(); });
        FB.on('money', () => FB.hud.update());
        FB.on('hint', (k) => FB.hud.hint(k));
        FB.on('toast', (e) => UI.toast(FB.t(e.key), 'info'));
        FB.on('questDone', () => { UI.toast(FB.t('quest_done'), 'check'); FB.audio.play('coin'); FB.hud.update(); });
        FB.on('cast', (e) => { if (e.bubble) UI.toast(FB.t('bubble_cast'), 'sparkle', 1500); });
        FB.on('driftFound', (e) => {
            UI.toast(FB.t('find_' + e.kind), e.reward.pearls ? 'pearl' : 'gift', 2200);
            UI.fly('coin', e.x, e.y, 5);
            if (e.reward.pearls) setTimeout(() => UI.fly('pearl', e.x, e.y, 3), 300);
            UI.floater(e.x, e.y - 30, '+' + e.reward.coins, 'var(--sun-d)');
            FB.hud.update();
        });

        const stop = () => { paused = true; FB.audio.pause(); FB.sdk.setGameplay(false); FB.fishing.release(); };
        const go = () => { paused = false; FB.audio.resume(); if (playing && !UI.isOpen()) FB.sdk.setGameplay(true); last = performance.now(); };
        FB.on('adOpen', stop);
        FB.on('adClose', go);
        FB.on('pause', stop);
        FB.on('resume', go);
        FB.on('modal', (open) => { if (playing && !paused) FB.sdk.setGameplay(!open); });
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) { stop(); FB.state.save(true); }
            else if (!FB.sdk.adOpen) go();
        });
        window.addEventListener('pagehide', () => FB.state.save('final'));

        // Касания: вода — заброс/подсечка, удержание — подмотка
        const ignore = (t) => t.closest && t.closest('button, .shade, .nav, .hud-top, .title');
        window.addEventListener('pointerdown', (e) => {
            FB.audio.unlock();
            if (!playing || paused || UI.isOpen() || FB.tutor.blocking() || ignore(e.target)) return;
            // Находка на воде важнее заброса
            if (FB.fishing.phase !== 'fight' && FB.fishing.phase !== 'bite' && FB.drift.hit(e.clientX, e.clientY)) return;
            FB.fishing.press(e.clientX, e.clientY);
        });
        const up = () => FB.fishing.release();
        window.addEventListener('pointerup', up);
        window.addEventListener('pointercancel', up);
        window.addEventListener('blur', up);
        window.addEventListener('contextmenu', (e) => e.preventDefault());
        // Пробел — то же, что нажатие (удобно на компьютере)
        window.addEventListener('keydown', (e) => {
            if (e.code !== 'Space' || e.repeat || !playing || UI.isOpen() || FB.tutor.blocking()) return;
            e.preventDefault();
            const F = FB.fishing;
            if (F.phase === 'idle') {
                const p = F.randomTarget();
                F.press(p.x, p.y);
            } else F.press(0, 0);
        });
        window.addEventListener('keyup', (e) => { if (e.code === 'Space') up(); });
        window.addEventListener('resize', () => FB.scene.resize());

        // Раз в полминуты: смена недели, погоды, дня
        setInterval(async () => {
            if (!FB.S) return;
            FB.hud.updateChip();
            const idx = FB.state.weekIdx();
            if (FB.S.week.idx !== idx && FB.S.week.idx >= 0) {
                const r = await FB.tourney.checkWeek();
                if (r && playing) FB.catchCard.weekResult(r);
            }
            if (FB.quests.sync()) FB.hud.update();
            const wx = FB.week.weatherAt(FB.S.pond, FB.sdk.now());
            if (wx !== FB.scene.weather && FB.fishing.phase === 'idle' && !UI.isOpen()) {
                FB.scene.setPlace(FB.S.pond, wx, true);
                UI.toast(FB.t('weather_changed', { w: FB.t('wx_' + wx) }), 'weather_' + wx);
            }
        }, 30000);
    }

    function loop(now) {
        requestAnimationFrame(loop);
        const dt = Math.min(0.05, (now - (last || now)) / 1000);
        last = now;
        if (paused) return;
        if (FB.S) FB.S.stats.playMs += dt * 1000;
        if (playing && !UI.isOpen() && !FB.tutor.blocking()) FB.fishing.update(dt);
        FB.scene.render(dt, FB.fishing.draw);
        if (playing) { FB.hud.frame(); FB.tutor.frame(dt); }
    }

    boot().catch(e => {
        console.error(e);
        const ld = document.getElementById('loading');
        if (ld) ld.innerHTML = '<div style="color:#fff;font-size:20px;text-align:center;padding:20px">Ошибка загрузки. Обновите страницу.<br><small>' + String(e && e.message || e) + '</small></div>';
    });
})(window.FB);
