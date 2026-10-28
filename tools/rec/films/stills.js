// stills.js — скриншоты для каталога: настоящий кадр игры + яркая подпись-лента.
// Геймплей занимает почти весь кадр (Яндекс требует не меньше 70%).
//   node tools/rec/rec.js tools/rec/films/shots-desktop.js   → 1920×1080
//   node tools/rec/rec.js tools/rec/films/shots-phone.js     → 1080×1920

const C = require('./_common.js');

// FB_LANG=en — английская версия (игра на английском, подписи английские, файлы *-en)
const EN = process.env.FB_LANG === 'en';
const T = (ru, en) => EN ? en : ru;

module.exports = (v) => {
    const fs = v ? 0.07 : 0.062;
    const capTop = v ? '24%' : '10%', capBot = v ? '81%' : '85%';
    const cap = (html, cls, y) => `__rec.caption(${JSON.stringify(html)}, { y: '${y || capTop}', cls: '${cls || ''}', size: Math.round(Math.min(innerWidth, innerHeight) * ${fs}) });`;
    // ПК — карточка улова; телефон — рыба летит на мостки (карточка там во весь экран)
    const cardOpen = v ? `FB.fishing.phase === 'land'` : `__rec.landed`;
    const cardAfter = v ? 0.22 : 0.9;
    return {
        name: (v ? 'shots-phone' : 'shots-desktop') + (EN ? '-en' : ''),
        size: v ? [405, 720, 2.6667, true] : [1920, 1080, 1, false],
        touch: !!v, fps: 30, stills: true, pointer: false,
        setup: (EN ? `FB.setLang('en'); FB.S.settings.lang = 'en';` : '') + C.setup({ pond: 'lagoon', who: 'boy', rod: 'sea', look: { hat: 'hat_straw', jacket: 'jk_hawaii', pet: 'pet_otter', float: 'fl_duck', boat: 'bt_rowboat' } }) +
            `FB.S.rods = ['bamboo', 'light', 'glass', 'carbon', 'sea']; __rec.bot.boost = 0.04;`,
        scenes: [
            // 1. Свечка: рыба-меч в воздухе, шкала лески
            { name: 'свечка', shot: '1-jump.png', len: 14,
                js: `__rec.clearOverlay();` + C.go('lagoon', `FB.S.bait = 'shrimp';`) + C.cast('swordfish', 31500, { biteIn: 0.6, nibbles: [] }),
                at: [[2.6, `if (FB.fishing.phase === 'fight') FB.fishing.jumpWarn = 0.5;`]],
                until: 'FB.fishing.jump > 0 && FB.fishing.jump < 0.62', after: 0,
                beforeShot: cap(T('Лови рыбу <b>с характером!</b>', 'Catch fish <b>with character!</b>')) },
            // 2. Рекорд: золотой карп на закате
            { name: 'рекорд', shot: '2-record.png', len: 14,
                js: `__rec.clearOverlay();` + C.go('village', `__rec.landed = false; FB.S.bait = 'corn'; FB.S.look.boat = 'bt_pier'; FB.S.look.pet = 'pet_cat';`) + `__rec.bot.boost = 0.6; delete FB.S.album.goldcarp;` + C.cast('goldcarp', 12400, { biteIn: 0.5, nibbles: [] }),
                until: cardOpen, after: cardAfter,
                beforeShot: cap(T('Поймай <b>легенду!</b>', 'Land a <b>legend!</b>'), 'violet') },
            // 3. Альбом рыб
            { name: 'альбом', shot: '3-album.png', len: 1.2,
                js: `__rec.clearOverlay();` + C.go('river', `FB.S.look.pet = 'pet_penguin'; FB.S.look.hat = 'hat_fisher';`) + `FB.panels.album();`,
                beforeShot: cap(T('44 рыбы <b>в альбоме</b>', '44 fish <b>in your album</b>'), 'blue', capBot) },
            // 4. Образ: рыбак в шлеме викинга, рядом пингвин
            { name: 'образ', shot: '4-look.png', len: 1.2,
                js: `__rec.clearOverlay();` + C.go('pier', `FB.S.look.hat = 'hat_viking'; FB.S.look.jacket = 'jk_life'; FB.S.look.pet = 'pet_penguin'; FB.S.look.boat = 'bt_pier';`) + `
                    FB.shopUI.open('look');
                    const chips = document.querySelectorAll('.shade:last-child .sheet .tabs')[1];
                    if (chips) chips.querySelectorAll('.tab')[1].click();`,
                beforeShot: cap(T('Наряжай рыбака <b>и питомца</b>', 'Dress up your angler <b>and pet</b>'), 'violet', capBot) },
            // 5. Ночь на болоте: фонарь и светящийся болотный дух
            { name: 'ночь', shot: '5-night.png', len: 14,
                js: `__rec.clearOverlay();` + C.go('swamp', `__rec.landed = false; FB.S.bait = 'maggot'; FB.S.who = 'grandpa'; FB.S.look.hat = 'hat_ushanka'; FB.S.look.jacket = 'jk_sweater'; FB.S.look.pet = 'pet_cat'; FB.S.look.float = 'fl_glow';`) + `__rec.bot.boost = 0.6; delete FB.S.album.spirit;` + C.cast('spirit', 4300, { biteIn: 0.5, nibbles: [] }),
                until: cardOpen, after: cardAfter,
                beforeShot: cap(T('Ночная рыбалка <b>с фонарём</b>', 'Night fishing <b>by lantern</b>'), 'blue') },
            // 6. Турнирная бухта
            { name: 'турнир', shot: '6-arena.png', len: 3,
                js: `__rec.clearOverlay();` + C.go('arena', `FB.S.bait = 'worm'; FB.S.who = 'girl'; FB.S.look.hat = 'hat_frog'; FB.S.look.jacket = 'jk_hoodie'; FB.S.look.pet = 'pet_gull'; FB.S.look.float = 'fl_duck';`) + '{' + C.aim() + '}' + `__rec.bot.boost = 0.0;` +
                    `const id = FB.state.weekCfg().fish; ` + C.cast('__W__', 2900, { biteIn: 0.4, nibbles: [] }).replace("FB.fishById['__W__']", 'FB.fishById[id]'),
                until: `FB.fishing.phase === 'fight'`, after: 1.0,
                beforeShot: cap(T('Турнир <b>каждую неделю</b>', 'A tournament <b>every week</b>')) },
            // 7. Аквариум
            { name: 'аквариум', shot: '7-aqua.png', len: 1.5,
                js: `__rec.clearOverlay();` + C.go('village', `FB.S.who = 'boy'; FB.S.look.hat = 'hat_straw'; FB.S.look.jacket = 'jk_hawaii';`) + `FB.aquaUI.open('fish');`,
                beforeShot: cap(T('Свой аквариум <b>с трофеями</b>', 'Your own <b>trophy aquarium</b>'), 'blue', capBot) }
        ]
    };
};
