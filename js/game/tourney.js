// tourney.js — отправка очков в топы и награда за прошлую неделю.
// Как устроены сами недели — в week.js.

(function (FB) {
    const T = FB.tourney = {};

    // Что видят другие игроки рядом с моим именем в топе: рамка и значок поддержки.
    // Яндекс хранит это в extraData записи лидерборда
    T.extra = () => 'f:' + FB.S.look.frame + (FB.S.buy.supporter ? ';s:1' : '');
    T.parseExtra = (s) => {
        const out = { frame: 'fr_none', supporter: false };
        String(s || '').split(';').forEach(part => {
            const [k, v] = part.split(':');
            if (k === 'f' && FB.cosById[v]) out.frame = v;
            if (k === 's') out.supporter = v === '1';
        });
        return out;
    };

    T.submit = () => {
        const S = FB.S;
        const idx = FB.state.weekIdx();
        const extra = T.extra();
        if (S.week.idx === idx && S.week.best.length) {
            FB.sdk.setScore(FB.week.board(idx), FB.week.encode(idx, FB.state.weekScore()), extra);
        }
        if (S.stats.catches > 0) FB.sdk.setScore('anglers', FB.state.fame(), extra);
        if (S.stats.bestG > 0) FB.sdk.setScore('record', S.stats.bestG, extra);
    };

    // Награды за место. Только монеты, жемчуг и косметика — никаких преимуществ
    T.rewardFor = (rank) => {
        if (rank === 1) return { pearls: 100, items: ['hat_crown', 'fr_gold'], kind: 'gold' };
        if (rank && rank <= 3) return { pearls: 60, items: ['fr_gold'], kind: 'silver' };
        if (rank && rank <= 10) return { pearls: 40, items: ['fl_gold'], kind: 'bronze' };
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
            if (rank && rank <= 100) S.trophies.push({ idx: prev, rank, kind: reward.kind });
            S.lastWeekReward = prev;
            S.lastResult = result = { idx: prev, rank, pts, reward };
        }
        FB.state.syncWeek();
        FB.state.save(true);
        return result;
    };
})(window.FB);
