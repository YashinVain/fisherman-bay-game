// frames.js — рамки аватара: кольцо и украшения вокруг (кувшинки, ракушки, якорь,
// звёзды, огонь, кристаллы…). Рисуются SVG поверх аватара, некоторые с анимацией.
// Аватар — круг радиусом 50 в центре (70, 70), рамка рисуется в квадрате 140×140.

(function (FB) {
    const FR = FB.frames = {};
    const O = '#2a3550';
    const ring = (stroke, w, extra) => '<circle cx="70" cy="70" r="55" fill="none" stroke="' + stroke + '" stroke-width="' + w + '"' + (extra || '') + '/>';
    const at = (deg, r) => { const a = deg * Math.PI / 180; return [70 + Math.cos(a) * r, 70 + Math.sin(a) * r]; };
    const star = (x, y, r, fill, cls) => {
        let d = '';
        for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; d += (i ? 'L' : 'M') + (x + Math.cos(a) * rr).toFixed(1) + ' ' + (y + Math.sin(a) * rr).toFixed(1); }
        return '<path' + (cls ? ' class="' + cls + '"' : '') + ' d="' + d + 'Z" fill="' + fill + '" stroke="' + O + '" stroke-width="1.6" stroke-linejoin="round"/>';
    };
    const heart = (x, y, s, fill) => '<path d="M' + x + ' ' + (y + s * 0.9) + 'C' + (x - s * 1.4) + ' ' + (y - s * 0.1) + ' ' + (x - s * 0.7) + ' ' + (y - s * 1.1) + ' ' + x + ' ' + (y - s * 0.4) + 'C' + (x + s * 0.7) + ' ' + (y - s * 1.1) + ' ' + (x + s * 1.4) + ' ' + (y - s * 0.1) + ' ' + x + ' ' + (y + s * 0.9) + 'Z" fill="' + fill + '" stroke="' + O + '" stroke-width="1.6"/>';
    const crown = (y, fill) => '<path d="M54 ' + y + 'l4-14 7 8 5-12 5 12 7-8 4 14z" fill="' + fill + '" stroke="' + O + '" stroke-width="2" stroke-linejoin="round"/><circle cx="70" cy="' + (y - 13) + '" r="2.4" fill="#e8402a" stroke="' + O + '" stroke-width="1"/>';
    const gem = (x, y, s, fill) => '<path d="M' + x + ' ' + (y - s) + 'L' + (x + s * 0.8) + ' ' + y + 'L' + x + ' ' + (y + s) + 'L' + (x - s * 0.8) + ' ' + y + 'Z" fill="' + fill + '" stroke="' + O + '" stroke-width="1.5"/><path d="M' + (x - s * 0.3) + ' ' + (y - s * 0.4) + 'L' + x + ' ' + (y - s * 0.7) + '" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>';
    const grad = (id, stops, x2) => '<linearGradient id="' + id + '" x1="0" y1="0" x2="' + (x2 || 1) + '" y2="1">' + stops.map((c, i) => '<stop offset="' + (i / (stops.length - 1)) + '" stop-color="' + c + '"/>').join('') + '</linearGradient>';
    let uid = 0;

    // Рисовалки. Каждая получает уникальный префикс для градиентов
    const ART = {
        fr_none: () => ring('#dbe6ee', 5),
        fr_wood: () => ring('#a8743a', 10) + ring('#7a5228', 2, ' r="60"').replace('r="55" ', '') +
            [45, 135, 225, 315].map(d => { const [x, y] = at(d, 55); return '<circle cx="' + x + '" cy="' + y + '" r="3" fill="#4a2e14"/>'; }).join(''),
        fr_rope: () => ring('#e2c08a', 10) + ring('#a8743a', 10, ' stroke-dasharray="7 7"') + ring('#7a5228', 1.5, ' opacity=".5"') +
            '<path d="M62 120c-6 4-8 10-4 13M78 120c6 4 8 10 4 13" fill="none" stroke="#a8743a" stroke-width="4" stroke-linecap="round"/><circle cx="70" cy="124" r="6" fill="#e2c08a" stroke="' + O + '" stroke-width="2"/>',
        fr_wave: (p) => '<defs>' + grad(p + 'w', ['#7ad8ff', '#1a8ac8']) + '</defs>' + ring('url(#' + p + 'w)', 9) +
            '<path d="M24 98c8-6 14 4 22-2s14 4 22-2 14 4 22-2 14 4 22-2" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".9"/>' +
            '<g class="fr-bub"><circle cx="112" cy="34" r="5" fill="#e6f8ff" stroke="' + O + '" stroke-width="1.5"/><circle cx="122" cy="22" r="3" fill="#e6f8ff" stroke="' + O + '" stroke-width="1.2"/><circle cx="104" cy="18" r="2.4" fill="#e6f8ff" stroke="' + O + '" stroke-width="1"/></g>',
        fr_rainbow: () => ['#ff5a5a', '#ffa83a', '#ffe84a', '#5ad87a', '#5ab4ff', '#9a7aff'].map((c, i) => {
            const [x1, y1] = at(i * 60 - 90, 55), [x2, y2] = at(i * 60 - 30, 55);
            return '<path d="M' + x1 + ' ' + y1 + 'A55 55 0 0 1 ' + x2 + ' ' + y2 + '" fill="none" stroke="' + c + '" stroke-width="10"/>';
        }).join('') + '<path d="M28 118c4-8 14-8 16 0M96 118c2-8 12-8 16 0" fill="#fff" stroke="' + O + '" stroke-width="1.6"/>',
        fr_gold: (p) => '<defs>' + grad(p + 'g', ['#fff3a8', '#f2b51d', '#c8860a']) + '</defs>' + ring('url(#' + p + 'g)', 10) + ring('#8a5a06', 1.5, ' r="61"').replace('r="55" ', '') +
            crown(24, 'url(#' + p + 'g)') + star(22, 104, 5, '#fff3a8', 'fr-tw') + star(118, 104, 5, '#fff3a8', 'fr-tw d2'),
        fr_heart: () => ring('#f24a6a', 8) + ring('#ffb0c0', 2, ' r="50"').replace('r="55" ', '') +
            heart(70, 122, 9, '#ff6a8a') + heart(22, 52, 6, '#ffb0c0') + heart(118, 52, 6, '#ffb0c0') + heart(34, 104, 4.5, '#ff8aa4') + heart(106, 104, 4.5, '#ff8aa4'),
        fr_lily: () => ring('#5ab85a', 8) +
            ['M18 100a16 10 -20 1 0 30 -14l-12 4z', 'M104 112a16 10 20 1 0 28 -2l-12 -2z', 'M14 44a13 8 -40 1 0 22 -16l-10 6z'].map(d => '<path d="' + d + '" fill="#4aa848" stroke="' + O + '" stroke-width="1.8" stroke-linejoin="round"/>').join('') +
            '<g transform="translate(112 30)">' + [0, 72, 144, 216, 288].map(r => '<ellipse rx="5" ry="10" transform="rotate(' + r + ') translate(0 -8)" fill="#ffb8d0" stroke="' + O + '" stroke-width="1.4"/>').join('') + '<circle r="5" fill="#ffd23a" stroke="' + O + '" stroke-width="1.4"/></g>',
        fr_shells: () => ring('#f2dca0', 10) + ring('#d8b46a', 2, ' r="61"').replace('r="55" ', '') +
            '<g transform="translate(70 124)"><path d="M-12 4C-14-8-6-14 0-14S14-8 12 4z" fill="#ffc2d0" stroke="' + O + '" stroke-width="1.8"/><path d="M0 4V-12M-6 4L-8-9M6 4L8-9" stroke="#c86a8a" stroke-width="1.4"/></g>' +
            star(26, 30, 11, '#ff9a4a') + '<g transform="translate(120 84) rotate(30)"><path d="M-7 3C-8-5-3-9 0-9S8-5 7 3z" fill="#fff0c8" stroke="' + O + '" stroke-width="1.5"/></g>' +
            '<circle cx="24" cy="98" r="4" fill="#f3eeff" stroke="' + O + '" stroke-width="1.4"/>',
        fr_anchor: () => ring('#24365c', 9) + ring('#f2f2f2', 2.5, ' r="55" stroke-dasharray="5 5"').replace('r="55" ', '') +
            '<g transform="translate(70 118)" fill="#f2c43a" stroke="' + O + '" stroke-width="2" stroke-linejoin="round"><circle cy="-14" r="4" fill="none" stroke-width="3" stroke="#f2c43a"/><path d="M-2-10h4v18h-4z"/><path d="M-14 0c2 9 8 12 14 12s12-3 14-12l-4 2c-2 5-5 7-10 7s-8-2-10-7z"/><path d="M-8-4h16" stroke-width="3" stroke="#f2c43a"/></g>' +
            star(70, 16, 6, '#f2c43a'),
        fr_stars: (p) => '<defs>' + grad(p + 's', ['#3a4a9a', '#141e52']) + '</defs>' + ring('url(#' + p + 's)', 11) +
            '<path d="M112 20a14 14 0 1 0 10 22 11 11 0 1 1 -10 -22z" fill="#fff3b0" stroke="' + O + '" stroke-width="1.6"/>' +
            [[22, 34, 6], [16, 84, 4.5], [40, 122, 5], [100, 124, 4.5], [126, 86, 5.5], [62, 12, 4]].map(([x, y, r], i) => star(x, y, r, '#ffe46a', 'fr-tw d' + (i % 3))).join(''),
        fr_fire: (p) => '<defs>' + grad(p + 'f', ['#ffe46a', '#ff7a1a', '#d8301a']) + '</defs>' + ring('url(#' + p + 'f)', 9) +
            [-150, -120, -90, -60, -30, 150, 30].map((d, i) => {
                const [x, y] = at(d, 60), r = d - 90 + 180;
                return '<g transform="translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') rotate(' + (d + 90) + ')"><path class="fr-fl d' + (i % 3) + '" d="M0 4C-7 0-6-8 0-18 6-8 7 0 0 4z" fill="url(#' + p + 'f)" stroke="' + O + '" stroke-width="1.4"/></g>';
            }).join(''),
        fr_crystal: (p) => '<defs>' + grad(p + 'c', ['#e8fbff', '#7ad0f0', '#3a8ac8']) + '</defs>' + ring('url(#' + p + 'c)', 9) +
            [[-90, 9, '#bff0ff'], [-20, 7, '#d8b0ff'], [40, 7, '#bff0ff'], [140, 7, '#d8b0ff'], [200, 7, '#bff0ff']].map(([d, s, c]) => { const [x, y] = at(d, 57); return gem(x, y, s, c); }).join('') +
            star(30, 24, 4, '#ffffff', 'fr-tw') + star(116, 116, 4, '#ffffff', 'fr-tw d1'),
        fr_royal: (p) => '<defs>' + grad(p + 'r', ['#fff3a8', '#f2b51d', '#b8760a']) + '</defs>' + ring('#8a1a3a', 13) + ring('url(#' + p + 'r)', 6) +
            [[0, '#e8402a'], [45, '#3a8af0'], [90, '#3ac85a'], [135, '#3a8af0'], [180, '#e8402a'], [225, '#3a8af0'], [315, '#3a8af0']].map(([d, c]) => { const [x, y] = at(d, 55); return gem(x, y, 5, c); }).join('') +
            crown(22, 'url(#' + p + 'r)') + star(22, 22, 4, '#fff3a8', 'fr-tw') + star(118, 22, 4, '#fff3a8', 'fr-tw d2'),
        fr_fisher: () => ring('#3a9ad8', 8) +
            '<g class="fr-spin">' + [0, 120, 240].map(d => { const [x, y] = at(d, 55); return '<g transform="translate(' + x + ' ' + y + ') rotate(' + (d + 90) + ')"><path d="M-8 0c4-6 10-6 14 0-4 6-10 6-14 0zm0 0l-5-4v8z" fill="#ffa83a" stroke="' + O + '" stroke-width="1.4" stroke-linejoin="round"/></g>'; }).join('') + '</g>',
        fr_legend: (p) => '<defs>' + grad(p + 'l', ['#ffe46a', '#d88aff', '#7a4ae8']) + '</defs>' +
            '<circle cx="70" cy="70" r="58" fill="none" stroke="#d88aff" stroke-width="6" opacity=".35" class="fr-glow"/>' + ring('url(#' + p + 'l)', 9) +
            '<g transform="translate(70 14)"><path d="M-12 0c6-9 16-9 22 0-6 9-16 9-22 0zm0 0l-7-6v12z" fill="#ffd23a" stroke="' + O + '" stroke-width="1.6" stroke-linejoin="round"/><circle cx="5" cy="-1.5" r="1.6" fill="' + O + '"/></g>' +
            star(22, 108, 5, '#fff3b0', 'fr-tw') + star(118, 108, 5, '#fff3b0', 'fr-tw d1') + star(120, 40, 3.5, '#fff3b0', 'fr-tw d2')
    };
    FR.has = (id) => !!ART[id];

    // SVG рамки — кладётся внутрь .ava поверх фото
    FR.svg = (id) => {
        const draw = ART[id] || ART.fr_none;
        const p = 'fr' + (uid++) + '_';
        return '<svg class="frm" viewBox="0 0 140 140" aria-hidden="true">' + draw(p) + '</svg>';
    };
})(window.FB);
