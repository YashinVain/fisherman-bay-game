// src.js — «исходники» для рекламных роликов: чистая игра без наложений
// (палец, подписи и эффекты дорисовывает монтажка tools/rec/edit.html).
// Играет «живой» игрок (R.bot.human): заброс, поплавок, пробы, поклёвка,
// подсечка с человеческой реакцией, борьба с удержанием и отпусканием.
// Свечки и полёт рыбы на мостки сняты в замедлении (slow). Съёмка с запасом
// чёткости (1.5× на ПК, 4× на телефоне), чтобы камера монтажки могла приближать.
//   node tools/rec/rec.js tools/rec/films/src-h.js
//   node tools/rec/rec.js tools/rec/films/src-v.js

const C = require('./_common.js');
// FB_LANG=en — исходники с игрой на английском (папка src-h-en / src-v-en)
const EN = process.env.FB_LANG === 'en';

module.exports = (v) => {
    const blk = (js) => '{' + js + '}';
    const human = (o) => `__rec.bot.human = true; __rec.bot.boost = ${o.boost || 0.08}; __rec.bot.jumpAt = ${JSON.stringify(o.jumpAt || [])}; __rec.bot.greedy = ${JSON.stringify(o.greedy || null)}; __rec.landed = false;`;
    // Замедление: пока рыба в воздухе (свечка) и пока летит на мостки
    const slow = { when: "FB.fishing.jump > 0 || (FB.fishing.phase === 'land' && !__rec.landed)", speed: 0.55, ramp: 0.12 };
    const look = (who, hat, jacket, pet, extra) => `FB.S.who = '${who}'; Object.assign(FB.S.look, { hat: '${hat}', jacket: '${jacket}', pet: '${pet}' }); ${extra || ''}`;
    // Смена образа в сцене «наряжай»: мгновенно, питомец радуется, метка для монтажа
    const swap = (who, hat, jacket) => `FB.S.who = '${who}'; FB.S.look.hat = '${hat}'; FB.S.look.jacket = '${jacket}'; FB.person.petJoy = { at: FB.scene.t, n: 1, love: true }; __rec.mark('swap', '${hat}');`;
    return {
        name: (v ? 'src-v' : 'src-h') + (EN ? '-en' : ''),
        size: v ? [405, 720, 4, true] : [1920, 1080, 1.5, false],
        touch: !!v, fps: 30, pointer: false, quality: 90,
        setup: (EN ? `FB.setLang('en'); FB.S.settings.lang = 'en';` : '') + C.setup({ pond: 'swamp', who: 'grandpa', rod: 'sea' }) + `FB.S.rods = ['bamboo', 'light', 'glass', 'carbon', 'sea'];`,
        scenes: [
            // 1. Ночное болото: дед с фонарём (крупный план для «байки»), потом болотный дух
            { name: 'night', len: 22, slow, until: '__rec.landed', after: 1.4,
                js: C.go('swamp', look('grandpa', 'hat_fisher', 'jk_sweater', 'pet_cat', `FB.S.look.float = 'fl_glow'; FB.S.look.boat = 'bt_pier'; FB.S.bait = 'maggot';`)) + human({ jumpAt: [2.3] }),
                at: [
                    [4.0, blk(C.aim({ dur: 0.7 }))],
                    [4.9, blk(C.cast('spirit', 4300, { biteIn: 2.1, nibbles: [0.7, 1.4] }))]
                ] },
            // 2. Вечерний пруд: полный цикл и золотой карп со свечками
            { name: 'carp', len: 24, slow, until: '__rec.landed', after: 1.7,
                js: C.go('village', look('boy', 'hat_straw', 'jk_hawaii', 'pet_cat', `FB.S.look.float = 'fl_duck'; FB.S.look.boat = 'bt_pier'; FB.S.bait = 'corn'; FB.S.rod = 'carbon';`)) + human({ jumpAt: [1.5, 3.4] }),
                at: [
                    [0.3, blk(C.aim({ dur: 0.7 }))],
                    [1.2, blk(C.cast('goldcarp', 12400, { biteIn: 2.3, nibbles: [0.8, 1.6] }))]
                ] },
            // 3. Море на лодке с эхолотом: блесна, погоня хищника, тяжёлая борьба с тунцом
            { name: 'tuna', len: 30, slow, until: '__rec.landed', after: 1.9,
                js: C.go('pier', look('boy', 'hat_captain', 'jk_navy', 'pet_gull', `FB.S.look.boat = 'bt_rowboat'; FB.S.bait = 'wobbler'; FB.S.rod = 'sea';`)) + human({ boost: 0.06, jumpAt: [3.9], greedy: [2.0, 2.9] }),
                at: [
                    [0.3, blk(C.aim({ dur: 0.7, dx: 0.03 }))],
                    [1.2, blk(C.cast('tuna', 86000, { spinNeed: 2.2, dx: 0.03 }))]
                ] },
            // 4. Наряжай: образ меняется в такт, питомец радуется
            { name: 'look', len: 4.6,
                js: C.go('lagoon', look('boy', 'hat_cap', 'jk_green', 'pet_penguin', `FB.S.look.boat = 'bt_pier';`)) + `__rec.bot.human = true;`,
                at: [
                    [0.5, swap('boy', 'hat_viking', 'jk_life')],
                    [1.1, swap('girl', 'hat_frog', 'jk_hoodie')],
                    [1.7, swap('grandpa', 'hat_ushanka', 'jk_sweater')],
                    [2.3, swap('boy', 'hat_pirate', 'jk_gold')],
                    [2.9, swap('girl', 'hat_sailor', 'jk_navy')],
                    [3.5, swap('boy', 'hat_crown', 'jk_hawaii')]
                ] },
            // 5. Турнирная бухта: рыба недели приносит очки
            { name: 'arena', len: 20, slow, until: '__rec.landed', after: 1.6,
                js: C.go('arena', look('girl', 'hat_frog', 'jk_hoodie', 'pet_gull', `FB.S.look.boat = 'bt_pier'; FB.S.look.float = 'fl_duck'; FB.S.bait = 'worm'; FB.S.rod = 'carbon';`)) + human({ jumpAt: [1.2] }),
                at: [
                    [0.3, blk(C.aim({ dur: 0.6 }))],
                    [1.0, `{ const id = FB.state.weekCfg().fish; ` + C.cast('__W__', 2900, { biteIn: 1.8, nibbles: [0.7] }).replace("FB.fishById['__W__']", 'FB.fishById[id]') + ' }']
                ] },
            // 6. Альбом рыб
            { name: 'album', len: 3.2, pre: 0.5,
                js: C.go('river', look('boy', 'hat_fisher', 'jk_overalls', 'pet_otter')) + `FB.panels.album();`,
                at: [[1.3, `__rec.clickText('.shade:last-child .sheet .tab', 'Тропическая', null, 0.4);`]] },
            // 7. Аквариум
            { name: 'aqua', len: 2.6, pre: 0.6,
                js: C.go('village', look('boy', 'hat_straw', 'jk_hawaii', 'pet_cat')) + `FB.aquaUI.open('fish');` }
        ]
    };
};
