// ad-baika.js — рекламный ролик «Рыбацкая байка» (~27 с, ПК и телефон).
// Дед ночью у фонаря хвастается: «Поймал я как-то сома… ВОТ ТАКОГО!» — рулетка
// «3 МЕТРА!». Логотип. Дальше — главы большими словами, как в трейлерах:
// ЛОВИ! (заброс, ожидание, поклёвка с дрожью экрана, подсечка, борьба, свечка
// в замедлении, стоп-кадр с плашкой рыбы), СОБИРАЙ! (альбом, коллекция, ночной
// дух, тунец), НАРЯЖАЙ! (образы в такт), СОРЕВНУЙСЯ! (турнирная бухта).
// Финал — логотип и кнопка. Все склейки — на доли музыки.
//   node tools/rec/edit.js tools/rec/edits/ad-baika.js h   (и v)

module.exports = {
    music: { style: 'arena', theme: 'arena', seed: 7 },
    vignette: 0.28,
    build: (I) => {
        const v = I.v;
        const b = 60 / I.bpm;
        const L = (n) => +(n * b).toFixed(4);          // длина в долях
        const clips = [], gfx = [], sfx = [], duck = [];
        let t = 0;
        const pv = [];     // контрольные кадры: начало и 72% каждого клипа
        const add = (c) => { const s = t; clips.push(c); t += c.len; pv.push(+(s + 0.25).toFixed(2), +(s + c.len * 0.72).toFixed(2)); return s; };
        const G = (at, type, o) => gfx.push(Object.assign({ at: +at.toFixed(4), type }, o));
        const S = (at, name, vol) => sfx.push([+at.toFixed(4), name, vol || 1]);
        const word = (at, text, colors, dur) => {
            G(at, 'word', Object.assign({ text, size: v ? 0.2 : 0.22, y: v ? 0.4 : 0.42, dur: dur || L(2) }, colors || {}));
            S(at, 'whoosh', 0.7); S(at + 0.12, 'boom', 0.9);
        };
        // Экранная точка по точке исходника при наезде камеры (центр c, зум z)
        const proj = (p, c, z) => [0.5 + (p[0] - c[0]) * z, 0.5 + (p[1] - c[1]) * z];

        // ---------- 1. Крючок: ночь, дед у фонаря, байка ----------
        const hd = I.anchor('night', 0.5, 'head');                       // точка над шляпой
        const hc = [hd[0] + (v ? -0.02 : 0.015), hd[1] + (v ? 0.06 : 0.09)];  // центр головы (со сдвигом от подсказки места)
        const z0 = v ? 1.8 : 2.0, z1 = v ? 2.1 : 2.3;
        let s = add({ scene: 'night', from: 0.4, len: L(5), cam: [[0, z0, hc[0], hc[1]], [L(5), z1, hc[0], hc[1]]], shake: [[L(2.5), 0.45, 0.35]] });
        G(s, 'letterbox', { dur: L(5), h: v ? 0.06 : 0.09 });
        const tail = proj(hd, hc, (z0 + z1) / 2);
        G(s + 0.1, 'bubble', { text: 'Поймал я как-то сома…', x: tail[0], y: tail[1] - 0.01, size: v ? 0.055 : 0.05, dur: L(2.5) - 0.1, typing: 0.8 });
        S(s + 0.1, 'pop', 0.8);
        G(s + L(2.5), 'bubble', { text: 'ВОТ ТАКОГО!', color: '#e8402a', x: tail[0], y: tail[1] - 0.01, size: v ? 0.08 : 0.07, dur: L(2.5), typing: 0.25, grow: 0.25, growAt: 0.4 });
        S(s + L(2.5), 'hit', 1);
        G(s + L(2.5) + 0.3, 'ruler', { y: v ? 0.72 : 0.74, w: v ? 0.72 : 0.78, dur: L(2.5) - 0.3, text: '3 МЕТРА!', size: v ? 0.11 : 0.1 });
        S(s + L(2.5) + 0.3, 'tape', 1); S(s + L(2.5) + 0.8, 'pop', 1);

        // ---------- 2. Логотип над вечерним прудом ----------
        s = add({ scene: 'carp', from: 0.8, len: L(3), trans: 'whip', transDur: 0.28, cam: v ? [[0, 1.55, 0.5, 0.5], [L(3), 1.45, 0.5, 0.53]] : [[0, 1.45, 0.5, 0.5], [L(3), 1.35, 0.5, 0.5]], dim: 0.15, sound: false });
        S(s, 'whoosh', 1);
        G(s + 0.05, 'logo', { size: v ? 0.2 : 0.17, y: v ? 0.4 : 0.4, dur: L(3) + 0.1, sub: 'рыбалка, о которой хочется рассказать', subY: 1.25 });
        S(s + 0.25, 'boom', 1); S(s + 0.55, 'splash', 0.8); S(s + 0.6, 'ding', 0.6);

        // ---------- 3. ЛОВИ! ----------
        const cast = I.mark('carp', 'cast'), bite = I.mark('carp', 'bite'), hook = I.mark('carp', 'fightStart');
        const jump = I.mark('carp', 'jump'), land = I.mark('carp', 'landed');
        // 3а. заброс (камера идёт за приманкой)
        s = add({ scene: 'carp', from: cast - 0.5, len: L(3), trans: 'zoom', transDur: 0.3, finger: true, follow: 'fish', followAmt: v ? 0.3 : 0.55, pulse: 0.02, shake: [[0.17, 0.3, 0.3]],
            cam: v ? [[0, 1.6, 0.5, 0.46], [L(3), 1.8, 0.6, 0.46]] : [[0, 1.35, 0.5, 0.55], [L(3), 1.6, 0.6, 0.55]] });
        word(s + 0.05, 'ЛОВИ!', { top: '#fffbe0', bot: '#ffb21a' });
        // 3б. ожидание, проба, поклёвка — быстрее, крупно на поплавке; дрожь экрана на поклёвке
        const waitFrom = cast + 0.9, hookT = hook + 0.3;
        const spWait = (hookT - waitFrom) / L(3);
        const biteLocal = (bite - waitFrom) / spWait;
        s = add({ scene: 'carp', from: waitFrom, len: L(3), speed: spWait, follow: 'fish', followAmt: 0.5, pulse: 0.015,
            cam: [[0, 1.3, 0.46, 0.6], [Math.max(0.2, biteLocal - 0.05), 1.4, 0.5, 0.6], [biteLocal + 0.2, 2.3, 0.6, 0.58], [L(3), 2.6, 0.6, 0.58]],
            shake: [[biteLocal, 0.6, 0.5]] });
        duck.push([s, 0.7, L(3)]);
        G(s + biteLocal, 'pop', { text: 'Клюёт!', x: 0.5, y: v ? 0.2 : 0.16, size: v ? 0.1 : 0.09, dur: Math.max(0.35, L(3) - biteLocal - 0.02), bot: '#ff8a3a' });
        S(s + biteLocal, 'hit', 0.7);
        // 3в. борьба: палец держит и отпускает, рыба рвётся
        s = add({ scene: 'carp', from: hookT, len: L(3), speed: (jump - hookT) / L(3), finger: true, follow: 'fish', followAmt: 0.3, prompts: [0.1, L(3) - 0.1], promptY: v ? 0.3 : 0.24,
            cam: [[0, 1.45, 0.55, 0.67], [L(3), 1.55, 0.58, 0.66]] });
        // 3г. свечка в замедлении (игра сама замедляется — тут настоящий слоумо)
        s = add({ scene: 'carp', from: jump - 0.15, len: L(4), speed: 1.0, trans: 'flash', transDur: 0.25, follow: 'fish', followAmt: 0.8, fdy: -0.1, pulse: 0.015,
            cam: [[0, 1.9, 0.6, 0.5], [L(4), 2.3, 0.6, 0.5]] });
        G(s, 'speedlines', { x: 0.5, y: 0.45, dur: L(4) });
        G(s + 0.1, 'pop', { text: 'Свечка!', x: 0.5, y: v ? 0.24 : 0.18, size: v ? 0.09 : 0.075, dur: 1.2 });
        S(s, 'whoosh', 0.8); S(s + 0.2, 'splash', 0.7);
        duck.push([s, 0.55, L(4)]);
        // 3д. рыба летит на мостки; стоп-кадр с плашкой «Золотой карп»
        const landClip = L(7), frz = 1.95;
        s = add({ scene: 'carp', from: land - 2.05, len: landClip, speed: 1.0, freeze: frz, trans: 'whip', transDur: 0.25,
            cam: v ? [[0, 1.5, 0.45, 0.55], [frz, 1.35, 0.5, 0.55], [landClip, 1.55, 0.5, 0.55]] : [[0, 1.2, 0.45, 0.52], [frz, 1.08, 0.5, 0.52], [landClip, 1.3, 0.5, 0.52]] });
        S(s, 'whoosh', 0.8);
        const landT = s + frz;
        G(landT - 0.05, 'flash', { dur: 0.3 });
        S(landT - 0.02, 'boom', 1); S(landT + 0.1, 'ding', 0.9);
        G(landT, 'confetti', { dur: landClip - frz + 0.3 });
        G(landT + 0.05, 'pop', { text: 'РЕКОРД!', x: 0.5, y: v ? 0.26 : 0.24, size: v ? 0.12 : 0.11, dur: landClip - frz - 0.05, bot: '#ffb21a' });
        G(landT + 0.1, 'tag', { fish: 'goldcarp', name: 'Золотой карп', rarity: 'legendary', weight: 12.4, extra: 'рекорд!', y: v ? 0.8 : 0.82, size: v ? 0.15 : 0.13, dur: landClip - frz - 0.1 });

        // ---------- 4. СОБИРАЙ! ----------
        s = add({ scene: 'album', from: 0.5, len: L(2), trans: 'wave', transDur: 0.45, finger: true, shake: [[0.22, 0.3, 0.3]], cam: [[0, 1.0, 0.5, 0.5], [L(2), 1.18, 0.5, 0.47]], sound: false });
        S(s, 'splash', 0.8);
        word(s + 0.1, 'СОБИРАЙ!', { top: '#e6fbff', bot: '#3fb0ff', stroke: '#0d2a52' });
        s = add({ scene: 'album', from: 2.0, len: L(2), blur: 10, dim: 0.35, sound: false, cam: [[0, 1.18, 0.5, 0.5]] });
        G(s, 'fishgrid', { ids: ['crucian', 'perch', 'pike', 'goldcarp', 'trout', 'salmon', 'taimen', 'catfish', 'spirit', 'eel', 'tuna', 'stingray', 'swordfish', 'mola', 'clown', 'puffer', 'barracuda', 'flounder'],
            unknown: ['salmon', 'taimen', 'stingray', 'mola', 'puffer'], cols: v ? 4 : 6, w: v ? 0.84 : 0.72, y: v ? 0.52 : 0.55, title: '44 рыбы', titleSize: v ? 0.1 : 0.09, dur: L(2), stagger: 0.03 });
        for (let i = 0; i < 6; i++) S(s + 0.1 + i * 0.1, 'pop', 0.5);
        const nJump = I.mark('night', 'jump');
        s = add({ scene: 'night', from: nJump - 0.05, len: L(2), speed: 1.0, trans: 'whip', transDur: 0.25, follow: 'fish', followAmt: 0.8, fdy: -0.1,
            cam: [[0, 1.9, 0.6, 0.5], [L(2), 2.2, 0.6, 0.5]] });
        S(s, 'whoosh', 0.8);
        G(s + 0.15, 'tag', { fish: 'spirit', name: 'Болотный дух', rarity: 'legendary', weight: 4.3, extra: 'светится!', y: v ? 0.8 : 0.82, size: v ? 0.14 : 0.12, dur: L(2) - 0.1, from: 'left' });
        const tJump = I.mark('tuna', 'jump');
        s = add({ scene: 'tuna', from: tJump - 0.05, len: L(2), speed: 1.0, trans: 'whip', transDur: 0.25, follow: 'fish', followAmt: 0.8, fdy: -0.1,
            cam: [[0, 1.8, 0.6, 0.5], [L(2), 2.1, 0.6, 0.5]] });
        S(s, 'whoosh', 0.8);
        G(s, 'speedlines', { x: 0.5, y: 0.42, dur: L(2) });
        G(s + 0.15, 'tag', { fish: 'tuna', name: 'Синий тунец', rarity: 'legendary', weight: 86, y: v ? 0.8 : 0.82, size: v ? 0.14 : 0.12, dur: L(2) - 0.1 });

        // ---------- 5. НАРЯЖАЙ! — образы в такт ----------
        const sw0 = I.mark('look', 'swap'), sw5 = I.mark('look', 'swap', 5);
        const lookHd = I.anchor('look', 0.5, 'head');
        const lc = [lookHd[0] + (v ? 0.03 : 0.015), lookHd[1] + (v ? 0.06 : 0.09)];
        const spd = (sw5 + 0.45 - (sw0 - 0.3)) / L(4);
        s = add({ scene: 'look', from: sw0 - 0.3, len: L(4), speed: spd, trans: 'zoom', transDur: 0.3, shake: [[0.17, 0.3, 0.3]],
            cam: [[0, v ? 2.0 : 2.1, lc[0], lc[1]], [L(4), v ? 2.3 : 2.4, lc[0], lc[1]]] });
        word(s + 0.05, 'НАРЯЖАЙ!', { top: '#fff0ff', bot: '#c07aff', stroke: '#2e1452' }, L(2));
        for (let i = 0; i < 6; i++) {
            const at = s + (I.mark('look', 'swap', i) - (sw0 - 0.3)) / spd;
            const q = proj(lookHd, lc, (v ? 2.0 : 2.1) + (v ? 0.3 : 0.3) * ((at - s) / L(4)));
            G(at, 'burst', { x: q[0], y: q[1] + (v ? 0.05 : 0.07), r: 0.22, n: 16, dur: 0.6, seed: 20 + i });
            S(at, 'pop', 0.9);
        }

        // ---------- 6. СОРЕВНУЙСЯ! — турнирная бухта ----------
        const aJump = I.mark('arena', 'jump'), aLand = I.mark('arena', 'landed');
        s = add({ scene: 'arena', from: aJump - 0.5, len: L(2), trans: 'whip', transDur: 0.25, finger: true, follow: 'fish', followAmt: 0.6, shake: [[0.17, 0.3, 0.3]],
            cam: [[0, 1.35, 0.55, 0.5], [L(2), 1.6, 0.6, 0.5]] });
        S(s, 'whoosh', 0.8);
        word(s + 0.05, 'СОРЕВНУЙСЯ!', { top: '#fffbe0', bot: '#ff7a3a', stroke: '#3a1410', size: v ? 0.12 : 0.17, stagger: 0.035 }, L(2));
        s = add({ scene: 'arena', from: aLand - 1.5, len: L(3), speed: 1.0, freeze: 1.45, cam: [[0, 1.22, 0.5, 0.56], [L(3), 1.3, 0.5, 0.56]] });
        G(s + 1.0, 'counter', { value: 1250, prefix: '+', suffix: ' очков', size: v ? 0.13 : 0.12, y: v ? 0.28 : 0.24, dur: L(3) - 1.0, count: 0.6 });
        S(s + 1.0, 'riser', 0.5); S(s + 1.65, 'ding', 0.8);
        G(s + 1.1, 'sub', { text: 'турнир каждую неделю', y: v ? 0.74 : 0.8, size: v ? 0.05 : 0.045, dur: L(3) - 1.1 });

        // ---------- 7. Финал: логотип, кнопка, палец жмёт ----------
        s = add({ scene: 'carp', from: 1.0, len: L(4), trans: 'zoom', transDur: 0.35, blur: 14, dim: 0.45, sound: false, cam: v ? [[0, 1.6, 0.5, 0.45], [L(4), 1.7, 0.5, 0.45]] : [[0, 1.1, 0.5, 0.5], [L(4), 1.2, 0.5, 0.5]] });
        G(s + 0.05, 'cta', { dur: L(4), logoY: v ? 0.33 : 0.34, logoSize: v ? 0.2 : 0.17, btnY: v ? 0.66 : 0.72, btnSize: v ? 0.055 : 0.06, tapEvery: 1.2, sub: 'Расскажи свою байку!', subY: v ? 0.78 : 0.88 });
        S(s, 'whoosh', 0.8); S(s + 0.3, 'boom', 0.8); S(s + 0.7, 'ding', 0.7);
        G(s, 'confetti', { dur: L(4), seed: 23, n: 70 });

        return {
            name: v ? 'ad-baika-v' : 'ad-baika-h',
            size: v ? [1080, 1920] : [1920, 1080], fps: 30, src: I.src,
            clips, gfx, sfx, duck,
            preview: pv
        };
    }
};
