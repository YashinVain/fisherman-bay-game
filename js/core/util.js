// util.js — общие мелочи: пространство имён FB, события, случайные числа, математика.
// Все файлы игры подключаются обычными <script> и пишут в один объект window.FB.

(function (root) {
    const FB = root.FB = root.FB || {};

    // ---------- События (простая шина) ----------
    const handlers = {};
    FB.on = (name, fn) => { (handlers[name] = handlers[name] || []).push(fn); };
    FB.emit = (name, data) => { (handlers[name] || []).forEach(fn => { try { fn(data); } catch (e) { console.error(e); } }); };

    // ---------- Математика ----------
    const U = FB.U = {};
    U.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
    U.lerp = (a, b, t) => a + (b - a) * t;
    U.smooth = (t) => t * t * (3 - 2 * t);
    U.dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

    // ---------- Случайные числа ----------
    // Обычный случай — Math.random. Для турнира нужен «одинаковый у всех» генератор
    // с зерном: mulberry32 даёт одну и ту же последовательность по одному числу.
    U.seeded = (seed) => {
        let a = seed >>> 0;
        return () => {
            a = (a + 0x6D2B79F5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    };
    U.rand = (a, b) => a + Math.random() * (b - a);
    U.randInt = (a, b) => Math.floor(U.rand(a, b + 1));
    U.pick = (arr, rnd) => arr[Math.floor((rnd || Math.random)() * arr.length)];
    // Выбор по весам: items — массив, weightOf(item) — вес
    U.weighted = (items, weightOf, rnd) => {
        const r = rnd || Math.random;
        let total = 0;
        for (const it of items) total += Math.max(0, weightOf(it));
        if (total <= 0) return items[0];
        let x = r() * total;
        for (const it of items) {
            x -= Math.max(0, weightOf(it));
            if (x <= 0) return it;
        }
        return items[items.length - 1];
    };
    // Нормальное распределение около 0 (для веса рыбы)
    U.gauss = () => {
        let u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };

    // ---------- Числа и текст ----------
    U.fmt = (n) => {
        n = Math.floor(n);
        return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    };
    // Вес в граммах → «850 г» / «2,35 кг»
    U.weight = (g) => {
        if (g < 1000) return Math.round(g) + ' ' + FB.t('unit_g');
        const kg = g / 1000;
        const s = kg < 10 ? kg.toFixed(2) : kg < 100 ? kg.toFixed(1) : Math.round(kg).toString();
        return (FB.lang === 'ru' ? s.replace('.', ',') : s) + ' ' + FB.t('unit_kg');
    };
    // Оставшееся время: «3 д 4 ч» / «5 ч 12 мин» / «12 мин»
    U.duration = (ms) => {
        const m = Math.max(0, Math.floor(ms / 60000));
        const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
        if (d > 0) return d + ' ' + FB.t('unit_d') + ' ' + h + ' ' + FB.t('unit_h');
        if (h > 0) return h + ' ' + FB.t('unit_h') + ' ' + mm + ' ' + FB.t('unit_min');
        return Math.max(1, mm) + ' ' + FB.t('unit_min');
    };
    U.esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    // ---------- Цвета ----------
    // Осветлить/затемнить цвет #rrggbb на k (-1..1)
    U.shade = (hex, k) => {
        const n = parseInt(hex.slice(1), 16);
        let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
        if (k >= 0) { r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; }
        else { r *= 1 + k; g *= 1 + k; b *= 1 + k; }
        return '#' + ((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b)).toString(16).slice(1);
    };
    // Смешать два цвета #rrggbb
    U.mix = (a, b, t) => {
        const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
        const r = U.lerp(x >> 16, y >> 16, t), g = U.lerp((x >> 8) & 255, (y >> 8) & 255, t), bl = U.lerp(x & 255, y & 255, t);
        return '#' + ((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(bl)).toString(16).slice(1);
    };
    U.rgba = (hex, a) => {
        const n = parseInt(hex.slice(1), 16);
        return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
    };
})(typeof window !== 'undefined' ? window : globalThis);
