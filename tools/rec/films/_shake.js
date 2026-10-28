// Проба камеры: пробы, поклёвка, подсечка, борьба, свечка, рыба на мостках
const C = require('./_common.js');
module.exports = {
    name: 'shake-test',
    size: [1280, 720, 1, false],
    fps: 30,
    setup: C.setup({ pond: 'mountain', bait: 'worm', rod: 'carbon' }) + `__rec.bot.boost = 0.1; __rec.bot.hookDelay = 0.28;`,
    scenes: [
        { name: 'форель', len: 11, at: [
            [0.2, C.aim()],
            [0.7, C.cast('laketrout', 6400, { biteIn: 2.2, nibbles: [0.6, 1.3] })],
            [5.2, `if (FB.fishing.phase === 'fight') FB.fishing.jumpWarn = 0.5;`]
        ] }
    ]
};
