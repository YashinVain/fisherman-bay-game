// store-check.js — проверить длины текстов страницы игры (docs/STORE.md) по лимитам
// формы черновика Яндекс Игр.  node tools/store-check.js
const fs = require('fs');
const path = require('path');
const md = fs.readFileSync(path.join(__dirname, '..', 'docs', 'STORE.md'), 'utf8');

// Текст после **заголовка** до следующего **заголовка** или ## раздела
function field(section, name) {
    const s = md.split(/^## /m).find(p => p.startsWith(section));
    if (!s) return null;
    const re = new RegExp('\\*\\*' + name + '\\*\\*\\s*\\n\\n([\\s\\S]*?)(?=\\n\\*\\*|$)');
    const m = s.match(re);
    return m ? m[1].trim() : null;
}
const LIMITS = [
    ['Короткое описание', 'Short description', 0, 70],
    ['Описание для SEO', 'SEO description', 50, 160],
    ['Об игре', 'About the game', 100, 1000],
    ['Как играть', 'How to play', 100, 1000]
];
let bad = 0;
for (const [ru, en, min, max] of LIMITS) {
    for (const [sec, name] of [['Русский', ru], ['English', en]]) {
        const t = field(sec, name);
        const n = t ? t.length : 0;
        const ok = t && n >= min && n <= max;
        if (!ok) bad++;
        console.log((ok ? '✓ ' : '✗ ') + sec + ' / ' + name + ': ' + n + ' (нужно ' + min + '–' + max + ')');
    }
}
const kw = md.match(/\*\*Ключевые слова \(RU\):\*\* (.*)/)[1], kwEn = md.match(/\*\*Ключевые слова \(EN\):\*\* (.*)/)[1];
[['RU', kw], ['EN', kwEn]].forEach(([l, k]) => {
    const ok = k.length <= 100 && k === k.toLowerCase();
    if (!ok) bad++;
    console.log((ok ? '✓ ' : '✗ ') + 'ключевые слова ' + l + ': ' + k.length + ' (до 100, строчными)');
});
process.exit(bad ? 1 : 0);
