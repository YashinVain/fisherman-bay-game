// tourney.js — отправка очков в топы и награда за прошлую неделю.
// Как устроены сами недели — в week.js.

(function (FB) {
    const T = FB.tourney = {};

    // Что видят другие игроки, когда нажимают на меня в топе. Яндекс хранит это
    // в extraData записи, коротко:
    //   f:рамка  s:1 (поддерживает игру)  b:главный улов недели (рыба.вес.очки)
    //   o:образ (рыбак.шапка.куртка.лодка.питомец — без приставок hat_, jk_…)
    //   p:статистика (уровень.уловы.виды.рыба-рекорд.вес рекорда)
    const WHO = { boy: 'b', girl: 'g', grandpa: 'd' }, WHO_BACK = { b: 'boy', g: 'girl', d: 'grandpa' };
    const PRE = { hat: 'hat_', jacket: 'jk_', boat: 'bt_', pet: 'pet_' };
    const LOOK_KEYS = ['hat', 'jacket', 'boat', 'pet'];
    const short = (id, pre) => String(id || '').replace(pre, '');
    T.extra = (withBig) => {
        const S = FB.S, b = S.week.big, st = S.stats;
        return 'f:' + short(S.look.frame, 'fr_') + (S.buy.supporter ? ';s:1' : '') +
            (withBig && b && S.week.idx === FB.state.weekIdx() ? ';b:' + b.f + '.' + b.g + '.' + b.pts : '') +
            ';o:' + (WHO[S.who] || 'b') + '.' + LOOK_KEYS.map(k => short(S.look[k], PRE[k])).join('.') +
            ';p:' + S.level + '.' + st.catches + '.' + Object.keys(S.album).length + '.' + (st.bestId || '') + '.' + (st.bestG || 0);
    };
    T.parseExtra = (s) => {
        const out = { frame: 'fr_none', supporter: false, big: null, look: null, stats: null };
        String(s || '').split(';').forEach(part => {
            const i = part.indexOf(':'), k = part.slice(0, i), v = part.slice(i + 1);
            if (k === 'f') { const id = FB.cosById['fr_' + v] ? 'fr_' + v : v; if (FB.cosById[id] && FB.cosById[id].cat === 'frame') out.frame = id; }
            if (k === 's') out.supporter = v === '1';
            if (k === 'b' && v) {
                const [f, g, pts] = v.split('.');
                if (FB.fishById[f] && +g > 0) out.big = { f, g: +g, pts: +pts || 0 };
            }
            if (k === 'o' && v) {
                const [w, ...rest] = v.split('.');
                const look = Object.assign({}, FB.DEFAULT_LOOK);
                LOOK_KEYS.forEach((key, j) => { const id = PRE[key] + (rest[j] || ''); if (FB.cosById[id] && FB.cosById[id].cat === key) look[key] = id; });
                out.look = { who: WHO_BACK[w] || 'boy', look };
            }
            if (k === 'p' && v) {
                const [lvl, catches, species, bestId, bestG] = v.split('.');
                out.stats = { level: +lvl || 1, catches: +catches || 0, species: +species || 0, bestId: FB.fishById[bestId] ? bestId : null, bestG: +bestG || 0 };
            }
        });
        return out;
    };

    T.submit = () => {
        const S = FB.S;
        const idx = FB.state.weekIdx();
        const extra = T.extra();
        if (S.week.idx === idx && S.week.best.length) {
            FB.sdk.setScore(FB.week.board(idx), FB.week.encode(idx, FB.state.weekScore()), T.extra(true));
        }
        if (S.stats.catches > 0) FB.sdk.setScore('anglers', FB.state.fame(), extra);
        if (S.stats.bestG > 0) FB.sdk.setScore('record', S.stats.bestG, extra);
    };

    // Награды за место. Только монеты, жемчуг и косметика — никаких преимуществ.
    // Медаль в профиль — только за топ-20
    T.MEDAL_TOP = 20;
    T.rewardFor = (rank) => {
        if (rank === 1) return { pearls: 100, items: ['hat_crown', 'fr_gold'], kind: 'gold' };
        if (rank && rank <= 3) return { pearls: 60, items: ['fr_gold'], kind: 'silver' };
        if (rank && rank <= 10) return { pearls: 40, items: ['fl_gold'], kind: 'bronze' };
        if (rank && rank <= T.MEDAL_TOP) return { pearls: 25, coins: 1200, items: [], kind: 'top20' };
        if (rank && rank <= 100) return { pearls: 15, coins: 1000, items: [], kind: 'top100' };
        return { coins: 300, items: [], kind: 'member' };
    };

    // Неделя сменилась, а очки ещё за прошлую — узнаём место и выдаём награду.
    // Возвращает { idx, rank, pts, reward } или null
    T.checkWeek = async () => {
        const S = FB.S;
        const cur = FB.state.weekIdx();
        const prev = S.week.idx;
        let result = null;
        if (prev >= 0 && prev < cur && S.lastWeekReward !== prev && S.week.best.length) {
            const pts = FB.week.sum(S.week.best);
            let rank = 0;
            // Доска прошлой недели ещё не перезаписана, только если это была именно прошлая неделя
            if (prev === cur - 1) {
                const e = await FB.sdk.getPlayerEntry(FB.week.board(prev));
                if (e && FB.week.decode(e.score).idx === prev) rank = e.rank;
            }
            const reward = T.rewardFor(rank);
            FB.state.giveReward({ coins: reward.coins, pearls: reward.pearls });
            reward.items.forEach(id => FB.state.giveItem(id));
            if (rank && rank <= T.MEDAL_TOP) S.trophies.push({ idx: prev, rank, kind: reward.kind });
            S.lastWeekReward = prev;
            S.lastResult = result = { idx: prev, rank, pts, reward };
        }
        FB.state.syncWeek();
        FB.state.save(true);
        return result;
    };
})(window.FB);
