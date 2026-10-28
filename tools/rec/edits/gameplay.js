// gameplay.js — видео геймплея для карточки игры (горизонтальное обязательное,
// вертикальное по желанию; до 28 с, настоящая игра — не меньше 70% времени).
// Спокойный «документальный» монтаж: игра идёт в своём темпе, без ускорений —
// заброс, ожидание, поклёвка с дрожью экрана, борьба, свечка, рыба на мостках
// и её карточка. Потом короткие кадры: море, турнир, образы, альбом, аквариум.
// Подписи — тонкие плашки, переходы — мягкие наплывы.
//   node tools/rec/edit.js tools/rec/edits/gameplay.js h   (и v)

module.exports = {
    music: { style: 'day', theme: 'village', seed: 5, gain: 0.95 },
    vignette: 0.18,
    build: (I) => {
        const v = I.v, en = I.en;
        const T = (ru, e) => en ? e : ru;
        const clips = [], gfx = [], sfx = [], duck = [];
        let t = 0;
        const pv = [];     // контрольные кадры: начало и 72% каждого клипа
        const add = (c) => { const s = t; clips.push(c); t += c.len; pv.push(+(s + 0.25).toFixed(2), +(s + c.len * 0.72).toFixed(2)); return s; };
        const G = (at, type, o) => gfx.push(Object.assign({ at: +at.toFixed(4), type }, o));
        const S = (at, name, vol) => sfx.push([+at.toFixed(4), name, vol || 1]);
        const ORANGE = ['#ff9a3c', '#f0502c', '#b8321c'], BLUE = ['#5cc8f6', '#1f86d0', '#13609a'], GREEN = ['#8ee26a', '#3fae46', '#26803a'], VIOLET = ['#b48cff', '#7a4ae0', '#5230a8'];
        // Подпись-плашка: наверху на ПК, ближе к верху на телефоне (под шапкой с кнопками)
        const sub = (at, text, len, colors, y) => G(at, 'sub', { text, y: y !== undefined ? y : (v ? 0.2 : 0.12), size: v ? 0.055 : 0.046, dur: len, colors });

        const cast = I.mark('carp', 'cast'), hook = I.mark('carp', 'fightStart'), jump = I.mark('carp', 'jump'), land = I.mark('carp', 'landed');

        // 1. Заброс, ожидание, поклёвка, подсечка (в реальном темпе)
        const from1 = Math.max(0, cast - 0.9), end1 = hook + 0.8;
        let s = add({ scene: 'carp', from: from1, len: +(end1 - from1).toFixed(3), finger: true, follow: 'fish', followAmt: 0.45,
            cam: [[0, 1.0, 0.5, 0.52], [end1 - from1, 1.3, 0.58, 0.55]] });
        sub(s + 0.3, T('Лови рыбу с характером!', 'Catch fish with character!'), 2.8);

        // 2. Борьба и свечка: леска, подсказки пальца, замедление
        const jumpEnd = jump + 2.2;
        s = add({ scene: 'carp', from: hook + 0.8, len: +(jumpEnd - hook - 0.8).toFixed(3), finger: true, follow: 'fish', followAmt: 0.3,
            cam: [[0, 1.2, 0.55, 0.62], [jumpEnd - hook - 0.8, 1.4, 0.58, 0.56]] });
        sub(s + 0.2, T('Держи леску в зелёной зоне', 'Keep the line in the green zone'), 2.4, BLUE);

        // 3. Рыба на мостках и карточка улова (настоящая карточка игры)
        const landFrom = land - 2.0, landLen = 3.5;
        s = add({ scene: 'carp', from: landFrom, len: landLen, trans: 'fade', transDur: 0.2, finger: true,
            cam: [[0, 1.15, 0.45, 0.52], [landLen, 1.0, 0.5, 0.5]] });
        S(s + 2.0, 'ding', 0.5);

        // 4. Море: лодка, блесна, тяжёлая рыба
        const tHook = I.mark('tuna', 'fightStart');
        s = add({ scene: 'tuna', from: tHook - 0.6, len: 3.4, trans: 'fade', transDur: 0.25, finger: true, follow: 'fish', followAmt: 0.5,
            cam: [[0, 1.1, 0.5, 0.58], [3.4, 1.3, 0.55, 0.6]] });
        sub(s + 0.2, T('Блесна, поплавок и донка', 'Lure, float and bottom rig'), 2.6, GREEN, v ? 0.36 : undefined);

        // 5. Турнир недели
        const aHook = I.mark('arena', 'fightStart');
        s = add({ scene: 'arena', from: aHook - 0.4, len: 3.0, trans: 'fade', transDur: 0.25, finger: true, follow: 'fish', followAmt: 0.5,
            cam: [[0, 1.1, 0.52, 0.55], [3.0, 1.3, 0.56, 0.58]] });
        sub(s + 0.2, T('Турнир каждую неделю', 'A tournament every week'), 2.5, ORANGE);

        // 6. Образы: рыбак и питомец
        const sw0 = I.mark('look', 'swap'), sw5 = I.mark('look', 'swap', 5);
        const lookSpeed = (sw5 + 0.5 - (sw0 - 0.2)) / 2.6;
        s = add({ scene: 'look', from: sw0 - 0.2, len: 2.6, speed: lookSpeed, trans: 'fade', transDur: 0.25,
            cam: [[0, 1.7, 0.4, 0.58], [2.6, 1.9, 0.4, 0.58]] });
        sub(s + 0.15, T('Наряжай рыбака и питомца', 'Dress up your angler and pet'), 2.3, VIOLET);

        // 7. Альбом и аквариум
        s = add({ scene: 'album', from: 0.5, len: 1.9, trans: 'fade', transDur: 0.25, finger: true, cam: [[0, 1.0, 0.5, 0.5], [1.9, 1.07, 0.5, 0.48]] });
        if (!v) sub(s + 0.15, T('44 рыбы в альбоме', '44 fish in your album'), 1.7, BLUE);
        s = add({ scene: 'aqua', from: 0.6, len: 1.6, trans: 'fade', transDur: 0.25, cam: [[0, 1.0, 0.5, 0.5], [1.6, 1.07, 0.5, 0.48]] });
        if (!v) sub(s + 0.1, T('Свой аквариум с трофеями', 'Your own trophy aquarium'), 1.4, GREEN);

        // 8. Финал: логотип и кнопка
        s = add({ scene: 'carp', from: 1.0, len: 1.9, trans: 'fade', transDur: 0.3, blur: 12, dim: 0.45, sound: false, cam: [[0, 1.1, 0.5, 0.5], [1.9, 1.15, 0.5, 0.5]] });
        G(s + 0.05, 'cta', { dur: 1.9, logoY: v ? 0.36 : 0.38, logoSize: v ? 0.2 : 0.17, btnY: v ? 0.68 : 0.76, btnSize: v ? 0.07 : 0.055, text: T('ИГРАТЬ БЕСПЛАТНО', 'PLAY FREE'), sub: T('Рыбацкие байки', 'Fishing Tales'), top: T(undefined, 'Fishing'), big: T(undefined, 'TALES'), subY: v ? 0.8 : 0.9 });

        return {
            name: v ? 'gameplay-v' : 'gameplay-h',
            size: v ? [1080, 1920] : [1920, 1080], fps: 30, src: I.src,
            clips, gfx, sfx, duck,
            preview: pv
        };
    }
};
