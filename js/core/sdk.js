// sdk.js — всё общение с Яндекс Играми в одном месте. Остальная игра зовёт только FB.sdk.*
//
// Если игра открыта у меня на компьютере (localhost или файл), SDK нет — тогда
// включается тестовый режим: реклама показывается окошком «тестовая реклама»,
// покупки проходят сразу, а в топе сидят выдуманные рыбаки. На любом другом
// адресе без SDK реклама и покупки просто недоступны.

(function (FB) {
    const SDK = FB.sdk = {
        ysdk: null,
        player: null,
        payments: null,
        ready: false,     // SDK Яндекса запустился
        mock: false,      // тестовый режим (только локально)
        lang: null,
        adOpen: false,
        cloudOk: false    // облако прочитано — только после этого в него пишем
    };

    const host = (location && location.hostname) || '';
    SDK.isLocal = location.protocol === 'file:' || ['localhost', '127.0.0.1', '::1', ''].includes(host) || host.endsWith('.localhost');

    const TIMEOUT = {};
    const withTimeout = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(TIMEOUT), ms))]);

    function loadScript() {
        return new Promise(resolve => {
            if (window.YaGames) return resolve(true);
            if (location.protocol === 'file:') return resolve(false);
            const s = document.createElement('script');
            s.src = '/sdk.js';
            s.async = true;
            const timer = setTimeout(() => resolve(!!window.YaGames), SDK.isLocal ? 3000 : 20000);
            s.onload = () => { clearTimeout(timer); resolve(!!window.YaGames); };
            s.onerror = () => { clearTimeout(timer); resolve(false); };
            document.head.appendChild(s);
        });
    }

    SDK.init = async () => {
        if (await loadScript()) {
            try {
                const y = await withTimeout(window.YaGames.init(), 8000);
                if (y === TIMEOUT) throw new Error('YaGames.init не ответил');
                SDK.ysdk = y;
                SDK.ready = true;
                SDK.lang = y.environment && y.environment.i18n && y.environment.i18n.lang;
                if (typeof y.on === 'function') {
                    y.on('game_api_pause', () => FB.emit('pause'));
                    y.on('game_api_resume', () => FB.emit('resume'));
                }
                await SDK.loadPlayer();
                SDK.initPayments();
                return true;
            } catch (e) {
                console.warn('SDK Яндекс Игр не запустился:', e);
                SDK.ysdk = null;
                SDK.ready = false;
            }
        }
        SDK.mock = SDK.isLocal;
        if (SDK.mock) console.info('Нет SDK Яндекса — тестовый режим');
        return false;
    };

    SDK.loadPlayer = async () => {
        try {
            const p = await withTimeout(SDK.ysdk.getPlayer({ scopes: false }), 6000);
            SDK.player = p === TIMEOUT ? null : p;
        } catch (e) { SDK.player = null; }
    };

    SDK.playerId = () => {
        try { return SDK.player && SDK.player.getUniqueID ? SDK.player.getUniqueID() : ''; } catch (e) { return ''; }
    };
    SDK.playerName = () => {
        try { return (SDK.player && SDK.player.getName && SDK.player.getName()) || ''; } catch (e) { return ''; }
    };
    SDK.playerPhoto = () => {
        try { return (SDK.player && SDK.player.getPhoto && SDK.player.getPhoto('small')) || ''; } catch (e) { return ''; }
    };

    SDK.isAuthorized = () => {
        if (SDK.mock) return true;
        try {
            if (!SDK.player) return false;
            if (typeof SDK.player.getMode === 'function') return SDK.player.getMode() !== 'lite';
            return typeof SDK.player.isAuthorized === 'function' && SDK.player.isAuthorized();
        } catch (e) { return false; }
    };

    SDK.openAuth = async () => {
        if (!SDK.ysdk || !SDK.ysdk.auth) return false;
        try {
            await SDK.ysdk.auth.openAuthDialog();
            await SDK.loadPlayer();
            SDK.cloudOk = false;
            return SDK.isAuthorized();
        } catch (e) { return false; }
    };

    // Время сервера Яндекса — турнир и подарки нельзя обмануть переводом часов
    SDK.now = () => {
        try { if (SDK.ysdk && SDK.ysdk.serverTime) return SDK.ysdk.serverTime(); } catch (e) { /* берём своё */ }
        return Date.now() + (SDK.mockShift || 0);
    };
    SDK.mockShift = 0;   // для проверки смены недели в тестовом режиме

    let loaded = false;
    SDK.gameReady = () => {
        if (loaded) return;
        loaded = true;
        try { SDK.ysdk && SDK.ysdk.features.LoadingAPI && SDK.ysdk.features.LoadingAPI.ready(); } catch (e) { /* не страшно */ }
    };

    let playing = false;
    SDK.setGameplay = (on) => {
        if (on === playing) return;
        playing = on;
        try {
            const api = SDK.ysdk && SDK.ysdk.features && SDK.ysdk.features.GameplayAPI;
            if (api) on ? api.start() : api.stop();
        } catch (e) { /* не страшно */ }
    };

    // ---------- Реклама ----------
    let lastInter = Date.now();     // при запуске Яндекс сам может показать рекламу
    const startedAt = Date.now();
    SDK.adsAvailable = () => SDK.ready || SDK.mock;

    // Видео за награду: onReward только если досмотрел. Результат: 'rewarded' | 'closed' | 'error'
    SDK.showRewarded = (onReward) => new Promise(resolve => {
        if (SDK.adOpen || !SDK.adsAvailable()) return resolve('error');
        let rewarded = false, done = false, failed = false;
        const finish = () => {
            if (done) return;
            done = true;
            clearTimeout(guard);
            SDK.adOpen = false;
            FB.emit('adClose');
            lastInter = Date.now();
            if (rewarded) onReward();
            resolve(rewarded ? 'rewarded' : failed ? 'error' : 'closed');
        };
        const guard = setTimeout(() => { failed = !rewarded; finish(); }, 180000);
        SDK.adOpen = true;
        FB.emit('adOpen');
        if (SDK.mock) return mockAd(() => { rewarded = true; finish(); });
        try {
            SDK.ysdk.adv.showRewardedVideo({
                callbacks: {
                    onRewarded: () => { rewarded = true; },
                    onClose: () => finish(),
                    onError: () => { failed = true; finish(); }
                }
            });
        } catch (e) { failed = true; finish(); }
    });

    // Полноэкранная реклама: только в паузах, не чаще раза в 3 минуты,
    // не в первые 3 минуты и никогда у тех, кто купил «Без рекламы»
    SDK.INTER_GAP = 180000;
    SDK.showInterstitial = () => new Promise(resolve => {
        const now = Date.now();
        if (SDK.adOpen || !SDK.ready || (FB.S && FB.S.buy.noAds) || now - lastInter < SDK.INTER_GAP || now - startedAt < 180000) return resolve(false);
        lastInter = now;
        let done = false;
        const finish = (shown) => {
            if (done) return;
            done = true;
            clearTimeout(guard);
            SDK.adOpen = false;
            FB.emit('adClose');
            resolve(shown);
        };
        const guard = setTimeout(() => finish(false), 180000);
        SDK.adOpen = true;
        FB.emit('adOpen');
        try {
            SDK.ysdk.adv.showFullscreenAdv({ callbacks: { onClose: (shown) => finish(!!shown), onError: () => finish(false) } });
        } catch (e) { finish(false); }
    });

    function mockAd(done) {
        const el = document.createElement('div');
        el.className = 'mock-ad';
        el.innerHTML = '<div class="mock-ad-box"><b>' + FB.t('mock_ad') + '</b><i></i></div>';
        document.body.appendChild(el);
        setTimeout(() => { el.remove(); done(); }, 1300);
    }

    // ---------- Облачные сохранения ----------
    SDK.loadCloud = async () => {
        if (!SDK.player || typeof SDK.player.getData !== 'function') return { ok: false, data: null };
        try {
            const d = await withTimeout(SDK.player.getData(['save']), 6000);
            if (d === TIMEOUT) return { ok: false, data: null };
            SDK.cloudOk = true;
            return { ok: true, data: d && d.save ? d.save : null };
        } catch (e) { return { ok: false, data: null }; }
    };

    // Яндекс разрешает ~100 записей за 5 минут: шлём не чаще раза в 4 с, лишнее склеиваем
    let lastCloud = 0, pending = null, pendingFlush = false, cloudTimer = null;
    SDK.saveCloud = (state, flush) => {
        if (!SDK.cloudOk || !SDK.player || typeof SDK.player.setData !== 'function') return;
        pending = JSON.parse(JSON.stringify(state));
        pendingFlush = pendingFlush || !!flush;
        const send = () => {
            cloudTimer = null;
            if (!pending) return;
            lastCloud = Date.now();
            const data = pending, fl = pendingFlush;
            pending = null;
            pendingFlush = false;
            SDK.player.setData({ save: data }, fl).catch(() => { /* в следующий раз */ });
        };
        const wait = Math.max(0, 4000 - (Date.now() - lastCloud));
        if (wait === 0 || (flush && Date.now() - lastCloud > 10000)) {
            clearTimeout(cloudTimer);
            send();
        } else if (!cloudTimer) cloudTimer = setTimeout(send, wait);
    };

    // ---------- Лидерборды ----------
    // Названия совпадают с таблицами в консоли Яндекса (docs/YANDEX_SETUP.md)
    SDK.BOARDS = ['weekA', 'weekB', 'anglers', 'record'];
    const lastSent = {};     // доска → последнее отправленное значение
    const queue = {};        // доска → { score, extra }
    let lbTimer = null;

    // setScore — не чаще раза в секунду, поэтому очередь отправляет по одной доске
    SDK.setScore = (board, score, extra) => {
        score = Math.floor(score);
        if (!(score >= 0)) return;
        if (SDK.mock) { mockSet(board, score, extra); return; }
        if (!SDK.ready || !SDK.isAuthorized() || !SDK.ysdk.leaderboards) return;
        if (lastSent[board] && lastSent[board].score === score && lastSent[board].extra === extra) return;
        queue[board] = { score, extra };
        if (!lbTimer) lbTimer = setTimeout(flushScores, 300);
    };
    function flushScores() {
        lbTimer = null;
        const board = Object.keys(queue)[0];
        if (!board) return;
        const item = queue[board];
        delete queue[board];
        lastSent[board] = item;
        try {
            const p = SDK.ysdk.leaderboards.setScore(board, item.score, item.extra || '');
            if (p && p.catch) p.catch(e => console.warn('setScore', board, e));
        } catch (e) { /* доски может не быть в консоли */ }
        if (Object.keys(queue).length) lbTimer = setTimeout(flushScores, 1300);
    }

    // Записи доски. Яндекс разрешает 20 запросов за 5 минут — кэшируем на минуту
    const lbCache = {};
    SDK.getEntries = async (board) => {
        const c = lbCache[board];
        if (c && Date.now() - c.t < 60000) return c.data;
        let data = null;
        if (SDK.mock) data = mockEntries(board);
        else if (SDK.ready && SDK.ysdk.leaderboards) {
            try {
                const r = await withTimeout(SDK.ysdk.leaderboards.getEntries(board, { quantityTop: 20, includeUser: SDK.isAuthorized(), quantityAround: 3 }), 8000);
                if (r !== TIMEOUT) data = normalize(r);
            } catch (e) { data = null; }
        }
        if (data) lbCache[board] = { t: Date.now(), data };
        return data;
    };
    SDK.dropCache = (board) => { delete lbCache[board]; };

    // Своя запись игрока (для награды за прошлую неделю). null — записи нет
    SDK.getPlayerEntry = async (board) => {
        if (SDK.mock) {
            const d = mockEntries(board);
            return d.entries.find(e => e.me) || null;
        }
        if (!SDK.ready || !SDK.isAuthorized() || !SDK.ysdk.leaderboards) return null;
        try {
            const e = await withTimeout(SDK.ysdk.leaderboards.getPlayerEntry(board), 8000);
            return e === TIMEOUT ? null : toEntry(e, true);
        } catch (e) { return null; }
    };

    function toEntry(e, me) {
        const p = e.player || {};
        let avatar = '';
        try { avatar = p.getAvatarSrc ? p.getAvatarSrc('small') : ''; } catch (x) { /* без аватара */ }
        return {
            rank: e.rank,
            score: e.score,
            extra: e.extraData || '',
            name: p.publicName || '',
            avatar,
            me: !!me || (p.uniqueID && p.uniqueID === SDK.playerId())
        };
    }
    function normalize(r) {
        return { userRank: r.userRank || 0, entries: (r.entries || []).map(e => toEntry(e)) };
    }

    // ---------- Тестовые лидерборды (только локально) ----------
    const MOCK_NAMES = ['Рыбак Вася', 'Аня', 'Котофей', 'Капитан Сом', 'Дед Митя', 'Лиза', 'Мария К.', 'Тимур', 'Рыболовка', 'Серёжа', 'Окунёк', 'Ника', 'Пётр', 'Даша', 'Карась 3000', 'Олег', 'Влад', 'Соня', 'Ирина', 'Щукарь'];
    const MOCK_FRAMES = ['fr_none', 'fr_wood', 'fr_wave', 'fr_gold', 'fr_rainbow', 'fr_heart'];
    const mockMine = () => { try { return JSON.parse(localStorage.getItem('fishbay_mocklb') || '{}'); } catch (e) { return {}; } };
    function mockSet(board, score, extra) {
        const m = mockMine();
        m[board] = { score, extra };
        try { localStorage.setItem('fishbay_mocklb', JSON.stringify(m)); } catch (e) { /* ничего */ }
        delete lbCache[board];
    }
    function mockEntries(board) {
        let h = 0;
        for (const ch of board) h = h * 31 + ch.charCodeAt(0);
        const rnd = FB.U.seeded(h);
        const widx = FB.week.index(SDK.now());
        const isWeek = board === 'weekA' || board === 'weekB';
        const boardIdx = widx % 2 === 0 ? (board === 'weekA' ? widx : widx - 1) : (board === 'weekB' ? widx : widx - 1);
        const list = MOCK_NAMES.map((name, i) => {
            const base = board === 'record' ? 2000 + rnd() * 60000 : board === 'anglers' ? 800 + rnd() * 12000 : 60 + rnd() * 2500;
            const pts = Math.round(base * (1 - i * 0.03));
            const score = isWeek ? FB.week.encode(boardIdx, pts) : pts;
            const fr = MOCK_FRAMES[Math.floor(rnd() * MOCK_FRAMES.length)];
            return { name, score, extra: 'f:' + fr + (rnd() < 0.2 ? ';s:1' : ''), avatar: '', me: false };
        });
        const mine = mockMine()[board];
        if (mine) list.push({ name: FB.t('you'), score: mine.score, extra: mine.extra || '', avatar: '', me: true });
        list.sort((a, b) => b.score - a.score);
        list.forEach((e, i) => { e.rank = i + 1; });
        const me = list.find(e => e.me);
        return { userRank: me ? me.rank : 0, entries: list };
    }

    // ---------- Покупки ----------
    SDK.initPayments = async () => {
        try {
            if (SDK.ysdk.payments) SDK.payments = SDK.ysdk.payments;
            else if (SDK.ysdk.getPayments) SDK.payments = await withTimeout(SDK.ysdk.getPayments({ signed: false }), 8000);
            if (SDK.payments === TIMEOUT) SDK.payments = null;
        } catch (e) { SDK.payments = null; }
    };
    SDK.paymentsAvailable = () => SDK.mock || !!SDK.payments;

    // Цены из каталога Яндекса: id → { price: '49', icon: url валюты }
    SDK.getCatalog = async () => {
        if (SDK.mock) {
            const out = {};
            FB.PRODUCTS.forEach(p => { out[p.id] = { price: String(p.price), icon: '' }; });
            return out;
        }
        if (!SDK.payments) return {};
        try {
            const list = await withTimeout(SDK.payments.getCatalog(), 8000);
            if (list === TIMEOUT) return {};
            const out = {};
            list.forEach(p => {
                let icon = '';
                try { icon = p.getPriceCurrencyImage ? p.getPriceCurrencyImage('small') : ''; } catch (e) { /* без значка */ }
                out[p.id] = { price: p.priceValue || p.price, icon, code: p.priceCurrencyCode };
            });
            return out;
        } catch (e) { return {}; }
    };

    // Купить: { ok, token } — token нужен, чтобы «потратить» расходуемый товар
    SDK.purchase = async (id) => {
        if (SDK.mock) return { ok: true, token: 'mock-' + Date.now() };
        if (!SDK.payments) return { ok: false };
        try {
            const r = await SDK.payments.purchase({ id });
            return { ok: true, token: r && r.purchaseToken };
        } catch (e) { return { ok: false }; }
    };
    SDK.consume = async (token) => {
        if (SDK.mock || !SDK.payments || !token) return;
        try { await SDK.payments.consumePurchase(token); } catch (e) { /* попробуем при следующем запуске */ }
    };
    // Покупки, которые ещё «висят»: постоянные (без рекламы, набор новичка)
    // и расходуемые, если игра закрылась до выдачи награды
    SDK.getPurchases = async () => {
        if (SDK.mock || !SDK.payments) return [];
        try {
            const r = await withTimeout(SDK.payments.getPurchases(), 8000);
            if (r === TIMEOUT) return [];
            return Array.from(r || []).map(p => ({ id: p.productID, token: p.purchaseToken }));
        } catch (e) { return []; }
    };
})(window.FB);
