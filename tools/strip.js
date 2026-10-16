// strip.js — убирает комментарии из кода сборки (JS, CSS, HTML). Исходники не трогает:
// там комментарии остаются для разработки, а в архив для Яндекса идёт чистый код.
// JS разбирается посимвольно: строки, шаблоны `...${}...` и регулярные выражения
// копируются как есть, поэтому «//» внутри адреса или регулярки не пострадает.

const KEYWORDS_BEFORE_REGEX = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw', 'instanceof', 'yield', 'await']);

function stripJs(src) {
    let out = '', i = 0;
    const n = src.length;
    let depth = 0;                 // глубина фигурных скобок
    const tpl = [];                // глубины, на которых открыт ${ внутри шаблона
    let lastSig = '', word = '', lastWord = '';

    const isIdent = (c) => /[A-Za-z0-9_$]/.test(c);
    const emit = (s) => {
        out += s;
        for (const c of s) {
            if (/\s/.test(c)) { if (word) { lastWord = word; word = ''; } continue; }
            if (isIdent(c)) word += c; else { if (word) lastWord = word; word = ''; lastWord = ''; }
            lastSig = c;
        }
    };
    const regexAllowed = () => {
        if (lastSig === '') return true;
        if (/[(,=:[!&|?{};+\-*%~^<>]/.test(lastSig)) return true;
        if (isIdent(lastSig)) return KEYWORDS_BEFORE_REGEX.has(word || lastWord);
        return false;
    };
    // Продолжить читать шаблонную строку с позиции i (после ` или после } от ${...})
    const readTemplate = () => {
        let s = '';
        while (i < n) {
            const c = src[i];
            if (c === '\\') { s += c + src[i + 1]; i += 2; continue; }
            if (c === '`') { s += c; i++; emit(s); return; }
            if (c === '$' && src[i + 1] === '{') { s += '${'; i += 2; depth++; tpl.push(depth); emit(s); return; }
            s += c; i++;
        }
        emit(s);
    };

    while (i < n) {
        const c = src[i], nx = src[i + 1];
        if (c === '"' || c === "'") {
            let j = i + 1;
            while (j < n && src[j] !== c) { if (src[j] === '\\') j++; j++; }
            emit(src.slice(i, j + 1));
            i = j + 1;
            continue;
        }
        if (c === '`') { emit('`'); i++; readTemplate(); continue; }
        if (c === '/' && nx === '/') {
            while (i < n && src[i] !== '\n') i++;
            continue;
        }
        if (c === '/' && nx === '*') {
            const end = src.indexOf('*/', i + 2);
            i = end < 0 ? n : end + 2;
            if (out && !/\s$/.test(out)) out += ' ';     // не склеить два слова
            continue;
        }
        if (c === '/' && regexAllowed()) {
            let j = i + 1, inClass = false;
            while (j < n) {
                const d = src[j];
                if (d === '\\') { j += 2; continue; }
                if (d === '[') inClass = true;
                else if (d === ']') inClass = false;
                else if (d === '/' && !inClass) break;
                else if (d === '\n') break;            // не регулярка — на всякий случай
                j++;
            }
            j++;
            while (j < n && /[a-z]/i.test(src[j])) j++;
            emit(src.slice(i, j));
            i = j;
            continue;
        }
        if (c === '{') depth++;
        if (c === '}') {
            if (tpl.length && tpl[tpl.length - 1] === depth) {
                tpl.pop(); depth--;
                emit('}'); i++;
                readTemplate();
                continue;
            }
            depth--;
        }
        emit(c);
        i++;
    }
    return tidy(out);
}

// Пустые строки и пробелы в конце строк — убрать
function tidy(s) {
    return s.split('\n').map(l => l.replace(/\s+$/, '')).filter(l => l.trim() !== '').join('\n') + '\n';
}

const stripCss = (s) => tidy(s.replace(/\/\*[\s\S]*?\*\//g, ''));
const stripHtml = (s) => tidy(s.replace(/<!--[\s\S]*?-->/g, ''));

module.exports = { stripJs, stripCss, stripHtml };
