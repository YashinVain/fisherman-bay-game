// ad-challenge.js — рекламный ролик «Сможешь вытащить?» (~20 с, ПК и телефон).
// Эхолот видит громадину → камера отъезжает к лодке → блесна, погоня, удар →
// тяжёлая борьба с подсказками «ДЕРЖИ! / ОТПУСТИ!», леска на грани (красная
// пульсация) → свечка тунца в замедлении → стоп-кадр «86 КГ!» → «А ты сможешь?» →
// финал с кнопкой. Склейки — на доли музыки.
//   node tools/rec/edit.js tools/rec/edits/ad-challenge.js h   (и v)

module.exports = {
    music: { style: 'arena', theme: 'sea', seed: 19 },
    vignette: 0.28,
    build: (I) => {
        const v = I.v;
        const b = 60 / I.bpm;
        const L = (n) => +(n * b).toFixed(4);
        const clips = [], gfx = [], sfx = [], duck = [];
        let t = 0;
        const pv = [];     // контрольные кадры: начало и 72% каждого клипа
        const add = (c) => { const s = t; clips.push(c); t += c.len; pv.push(+(s + 0.25).toFixed(2), +(s + c.len * 0.72).toFixed(2)); return s; };
        const G = (at, type, o) => gfx.push(Object.assign({ at: +at.toFixed(4), type }, o));
        const S = (at, name, vol) => sfx.push([+at.toFixed(4), name, vol || 1]);
        // Эхолот в кадре: на телефоне — карточка сверху справа, на ПК — внизу справа
        const SON = v ? [0.83, 0.3] : [0.962, 0.83];
        const cast = I.mark('tuna', 'cast'), bite = I.mark('tuna', 'bite'), hook = I.mark('tuna', 'fightStart');
        const jump = I.mark('tuna', 'jump'), land = I.mark('tuna', 'landed');

        // ---------- 1. Крючок: эхолот видит громадину, камера отъезжает к лодке ----------
        const zs = v ? 3.0 : 4.2;
        const hookFrom = bite - 1.5, hookFoot = 1.3;       // отрезок исходника под крючок (медленно)
        const sc0 = [SON[0] + (v ? 0.0 : -0.02), SON[1] + (v ? 0.02 : 0.02)];
        let s = add({ scene: 'tuna', from: hookFrom, len: L(5), speed: hookFoot / L(5), finger: true, shake: [[L(3.2), 0.4, 0.35]],
            cam: [[0, zs, sc0[0], sc0[1]], [L(3.2), zs, sc0[0], sc0[1]], [L(5), 1.25, 0.5, 0.55]] });
        G(s + 0.1, 'pop', { text: 'Эхолот видит громадину!', x: 0.5, y: v ? 0.2 : 0.2, size: v ? 0.06 : 0.055, dur: L(3.2) - 0.1, bot: '#7ad0ff' });
        S(s, 'riser', 0.8); S(s + 0.1, 'ding', 0.5);
        G(s + L(3.2), 'word', { text: 'СМОЖЕШЬ', size: v ? 0.15 : 0.16, y: v ? 0.34 : 0.36, dur: L(1.8), top: '#ffffff', bot: '#ffd23a' });
        G(s + L(3.2) + 0.2, 'word', { text: 'ВЫТАЩИТЬ?', size: v ? 0.15 : 0.16, y: v ? 0.5 : 0.58, dur: L(1.8) - 0.2, top: '#ffffff', bot: '#ff7a3a', splash: false });
        S(s + L(3.2), 'boom', 1); S(s + L(3.2) + 0.2, 'hit', 0.8);

        // ---------- 2. Блесна играет, хищник гонится — удар! ----------
        const chaseFrom = hookFrom + hookFoot, spChase = (hook + 0.25 - chaseFrom) / L(3);
        s = add({ scene: 'tuna', from: chaseFrom, len: L(3), speed: spChase, finger: true, trans: 'whip', transDur: 0.25, follow: 'fish', followAmt: 0.85,
            cam: [[0, 1.6, 0.6, 0.55], [L(3), 2.3, 0.62, 0.55]], shake: [[(bite - chaseFrom) / spChase, 1.0, 0.6]] });
        S(s, 'whoosh', 0.8);
        const biteT = s + (bite - chaseFrom) / spChase;
        G(biteT, 'flash', { dur: 0.25, alpha: 0.55 });
        G(biteT, 'pop', { text: 'УДАР!', x: 0.5, y: v ? 0.3 : 0.28, size: v ? 0.12 : 0.11, dur: 0.9, bot: '#ff5a3a' });
        S(biteT, 'boom', 1);
        duck.push([s, 0.7, L(3)]);

        // ---------- 3. Борьба: «ДЕРЖИ / ОТПУСТИ» по пальцу, леска на грани ----------
        const fightFrom = hook + 0.25, fightLen = jump - 0.15 - fightFrom, sp3 = fightLen / L(8);
        s = add({ scene: 'tuna', from: fightFrom, len: L(8), speed: sp3, finger: true, prompts: [0.15, L(8) - 0.1], promptY: v ? 0.28 : 0.2, promptSize: v ? 0.1 : 0.09, follow: 'fish', followAmt: 0.55,
            cam: [[0, 1.3, 0.55, 0.62], [L(4), 1.45, 0.55, 0.64], [L(8), 1.6, 0.6, 0.58]], shake: [[L(3), 0.8, 1.2], [L(6), 0.6, 0.6]] });
        // «Жадный» момент записи (бот держит дольше): красная пульсация и надпись
        const gStart = s + (2.0) / sp3, gEnd = s + (2.9) / sp3;
        G(gStart, 'vignette', { color: '220,30,20', alpha: 0.55, pulse: 3, dur: gEnd - gStart + 0.3 });
        G(gStart + 0.1, 'pop', { text: 'Леска трещит!', x: 0.5, y: v ? 0.68 : 0.74, size: v ? 0.08 : 0.07, dur: 1.1, bot: '#ff5a3a', tilt: -4 });
        S(gStart, 'riser', 0.7);
        duck.push([gStart, 0.6, gEnd - gStart]);

        // ---------- 4. Свечка тунца в замедлении ----------
        s = add({ scene: 'tuna', from: jump - 0.15, len: L(4), speed: 1.0, trans: 'flash', transDur: 0.25, follow: 'fish', followAmt: 0.8, fdy: -0.1, pulse: 0.015,
            cam: [[0, 1.8, 0.6, 0.5], [L(4), 2.2, 0.6, 0.5]] });
        G(s, 'speedlines', { x: 0.5, y: 0.45, dur: L(4) });
        G(s + 0.1, 'pop', { text: 'СВЕЧКА!', x: 0.5, y: v ? 0.24 : 0.18, size: v ? 0.1 : 0.085, dur: 1.2 });
        S(s, 'whoosh', 1); S(s + 0.15, 'splash', 0.8);
        duck.push([s, 0.5, L(4)]);

        // ---------- 5. На мостки: стоп-кадр и «86 КГ!» ----------
        const lLen = L(6), frz = 1.95;
        s = add({ scene: 'tuna', from: land - 2.05, len: lLen, speed: 1.0, freeze: frz, trans: 'whip', transDur: 0.25,
            cam: v ? [[0, 1.5, 0.45, 0.55], [frz, 1.35, 0.5, 0.55], [lLen, 1.55, 0.5, 0.55]] : [[0, 1.2, 0.45, 0.52], [frz, 1.08, 0.5, 0.52], [lLen, 1.3, 0.5, 0.52]] });
        S(s, 'whoosh', 0.8);
        const landT = s + frz;
        G(landT - 0.05, 'flash', { dur: 0.35 });
        S(landT - 0.02, 'boom', 1);
        G(landT, 'counter', { value: 86, suffix: ' КГ!', size: v ? 0.2 : 0.2, y: v ? 0.36 : 0.36, dur: lLen - frz, count: 0.5 });
        S(landT + 0.45, 'ding', 0.9);
        G(landT, 'confetti', { dur: lLen - frz + 0.3 });
        G(landT + 0.2, 'sub', { text: 'Синий тунец — легенда моря', y: v ? 0.52 : 0.54, size: v ? 0.05 : 0.045, dur: lLen - frz - 0.2, colors: ['#5cc8f6', '#1f86d0', '#13609a'] });

        // ---------- 6. «А ты сможешь?» ----------
        s = add({ scene: 'tuna', from: 0.8, len: L(3), trans: 'zoom', transDur: 0.3, blur: 8, dim: 0.35, sound: false, shake: [[0.2, 0.3, 0.3]], cam: v ? [[0, 1.6, 0.5, 0.45], [L(3), 1.7, 0.5, 0.45]] : [[0, 1.05, 0.5, 0.5], [L(3), 1.15, 0.5, 0.5]] });
        G(s + 0.1, 'word', { text: 'А ТЫ СМОЖЕШЬ?', size: v ? 0.12 : 0.15, y: 0.45, dur: L(3) - 0.1, top: '#ffffff', bot: '#9fe0ff', stroke: '#0d2a52' });
        S(s, 'whoosh', 0.8); S(s + 0.2, 'boom', 0.9);

        // ---------- 7. Финал ----------
        s = add({ scene: 'tuna', from: 0.6, len: L(5), trans: 'fade', transDur: 0.3, blur: 14, dim: 0.45, sound: false, cam: v ? [[0, 1.6, 0.5, 0.45], [L(5), 1.7, 0.5, 0.45]] : [[0, 1.1, 0.5, 0.5], [L(5), 1.2, 0.5, 0.5]] });
        G(s + 0.05, 'cta', { dur: L(5), logoY: v ? 0.33 : 0.34, logoSize: v ? 0.2 : 0.17, btnY: v ? 0.66 : 0.72, btnSize: v ? 0.055 : 0.06, tapEvery: 1.2, sub: '44 рыбы ждут тебя', subY: v ? 0.78 : 0.88, fish: ['tuna', 'swordfish', 'mola', 'goldcarp', 'spirit', 'taimen'] });
        S(s + 0.3, 'boom', 0.8); S(s + 0.7, 'ding', 0.7);
        G(s, 'confetti', { dur: L(5), seed: 29, n: 60 });

        return {
            name: v ? 'ad-challenge-v' : 'ad-challenge-h',
            size: v ? [1080, 1920] : [1920, 1080], fps: 30, src: I.src,
            clips, gfx, sfx, duck,
            preview: pv
        };
    }
};
