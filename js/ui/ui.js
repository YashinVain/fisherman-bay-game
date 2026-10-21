// ui.js — общие кирпичики интерфейса: создание элементов, окна, тосты,
// летящие монетки, всплывающие числа.

(function (FB) {
    const UI = FB.ui = {};
    const U = FB.U;

    UI.root = () => document.getElementById('ui');

    // el('div.card.big', { onclick }, [детки или html-строка])
    UI.el = (spec, attrs, kids) => {
        const [tag, ...cls] = spec.split('.');
        const e = document.createElement(tag || 'div');
        if (cls.length) e.className = cls.join(' ');
        if (attrs) {
            for (const k in attrs) {
                if (k === 'html') e.innerHTML = attrs[k];
                else if (k === 'text') e.textContent = attrs[k];
                else if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]);
                else if (k === 'style') e.style.cssText = attrs[k];
                else e.setAttribute(k, attrs[k]);
            }
        }
        if (kids) (Array.isArray(kids) ? kids : [kids]).forEach(k => { if (k) e.appendChild(typeof k === 'string' ? UI.html(k) : k); });
        return e;
    };
    UI.html = (s) => {
        const t = document.createElement('template');
        t.innerHTML = s.trim();
        return t.content.childElementCount === 1 ? t.content.firstElementChild : t.content;
    };

    // Кнопка со звуком и «нажатием»
    UI.btn = (cls, html, onClick) => UI.el('button.btn' + (cls ? '.' + cls.split(' ').join('.') : ''), {
        html,
        onclick: (e) => { e.stopPropagation(); FB.audio.play('click'); onClick && onClick(e); }
    });

    // ---------- Окна ----------
    UI.stack = [];
    UI.isOpen = () => UI.stack.length > 0;

    // open({ title, gold, body: элемент, wide, onClose, noClose, cls })
    UI.open = (opt) => {
        const shade = UI.el('div.shade');
        const sheet = UI.el('div.sheet' + (opt.cls ? '.' + opt.cls : ''));
        if (opt.width) sheet.style.width = opt.width;
        if (opt.title) sheet.appendChild(UI.el('div.sheet-head' + (opt.gold ? '.gold' : ''), { text: opt.title }));
        if (!opt.noClose) {
            const close = UI.el('button.round.close', { html: FB.ic('close'), onclick: () => { FB.audio.play('click'); UI.close(); } });
            sheet.appendChild(close);
        }
        if (opt.tabs) sheet.appendChild(opt.tabs);
        const body = UI.el('div.sheet-body');
        if (opt.body) body.appendChild(opt.body);
        sheet.appendChild(body);
        shade.appendChild(sheet);
        shade.addEventListener('pointerdown', (e) => { if (e.target === shade && !opt.noClose) UI.close(); });
        UI.root().appendChild(shade);
        const entry = { shade, sheet, body, opt };
        UI.stack.push(entry);
        FB.emit('modal', true);
        return entry;
    };
    UI.close = () => {
        const top = UI.stack.pop();
        if (!top) return;
        top.shade.classList.add('out');
        top.shade.style.pointerEvents = 'none';
        setTimeout(() => top.shade.remove(), 260);
        if (top.opt.onClose) top.opt.onClose();
        FB.emit('modal', UI.stack.length > 0);
    };
    UI.closeAll = () => { while (UI.stack.length) UI.close(); };
    // Перерисовать содержимое верхнего окна (после покупки и т. п.)
    UI.refresh = () => {
        const top = UI.stack[UI.stack.length - 1];
        if (top && top.opt.render) {
            const scroll = top.body.scrollTop;
            top.body.innerHTML = '';
            top.body.appendChild(top.opt.render());
            top.body.scrollTop = scroll;
            top.body.classList.remove('swap'); void top.body.offsetWidth; top.body.classList.add('swap');
        }
    };

    // Вкладки: tabs(['a','b'], активная, onChange) → элемент
    UI.tabs = (list, active, onChange, dots) => {
        const box = UI.el('div.tabs');
        list.forEach(([id, label]) => {
            const b = UI.el('button.tab' + (id === active ? '.on' : ''), {
                html: U.esc(label) + (dots && dots[id] ? '<i class="dot"></i>' : ''),
                onclick: () => { FB.audio.play('click'); onChange(id); }
            });
            box.appendChild(b);
        });
        return box;
    };

    // ---------- Сообщения ----------
    let toastBox = null;
    // Одинаковое сообщение не повторяем: если оно уже на экране — просто продлеваем
    UI.toast = (text, icon, ms) => {
        if (!toastBox) { toastBox = UI.el('div.toasts'); UI.root().appendChild(toastBox); }
        const hide = (t) => { clearTimeout(t._timer); t._timer = setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, ms || 2200); };
        const same = [...toastBox.children].find(t => t.dataset.text === text && !t.classList.contains('out'));
        if (same) {
            same.classList.remove('bump'); void same.offsetWidth; same.classList.add('bump');
            hide(same);
            return;
        }
        const t = UI.el('div.toast', { html: (icon ? FB.ic(icon) : '') + '<span>' + U.esc(text) + '</span>' });
        t.dataset.text = text;
        toastBox.appendChild(t);
        while (toastBox.children.length > 2) toastBox.firstChild.remove();
        hide(t);
    };

    // Всплывающее «+25» в точке экрана
    UI.floater = (x, y, text, color) => {
        const f = UI.el('div.floater', { text });
        f.style.left = x + 'px';
        f.style.top = y + 'px';
        if (color) f.style.webkitTextStroke = '5px ' + color;
        document.body.appendChild(f);
        setTimeout(() => f.remove(), 1400);
    };

    // Монетки (или жемчуг) летят из точки в счётчик наверху
    UI.fly = (kind, fromX, fromY, n) => {
        const target = document.querySelector(kind === 'pearl' ? '.pill.pearls' : '.pill.coins');
        if (!target) return;
        const r = target.getBoundingClientRect();
        const tx = r.left + 20, ty = r.top + r.height / 2;
        const count = Math.min(10, Math.max(3, n || 5));
        for (let i = 0; i < count; i++) {
            const f = UI.el('div.flyer', { html: FB.ic(kind === 'pearl' ? 'pearl' : 'coin') });
            const sx = fromX + U.rand(-40, 40), sy = fromY + U.rand(-30, 30);
            f.style.left = (sx - 17) + 'px';
            f.style.top = (sy - 17) + 'px';
            document.body.appendChild(f);
            setTimeout(() => {
                f.style.transform = 'translate(' + (tx - sx) + 'px,' + (ty - sy) + 'px) scale(.7)';
                f.style.opacity = '0.2';
            }, 30 + i * 55);
            setTimeout(() => {
                f.remove();
                if (i === count - 1) { target.classList.remove('bump'); void target.offsetWidth; target.classList.add('bump'); FB.audio.play('coin'); }
            }, 780 + i * 55);
        }
    };

    // ---------- Мелочи ----------
    UI.rarityTag = (r) => '<span class="rtag" style="background:' + FB.RARITY[r].color + '">' + FB.t('r_' + r) + '</span>';
    UI.price = (cost) => {
        if (!cost) return '';
        return '<span class="price">' + FB.ic(cost.coins ? 'coin' : 'pearl') + U.fmt(cost.coins || cost.pearls) + '</span>';
    };
    UI.reward = (r) => {
        const parts = [];
        if (r.coins) parts.push('<span class="price">' + FB.ic('coin') + U.fmt(r.coins) + '</span>');
        if (r.pearls) parts.push('<span class="price">' + FB.ic('pearl') + U.fmt(r.pearls) + '</span>');
        if (r.item) parts.push(U.esc(FB.name(FB.cosById[r.item])));
        return parts.join(' ');
    };
    // Аватар с рамкой (для топа и профиля)
    UI.avatar = (name, src, frameId) => {
        const a = UI.el('div.ava');
        if (src) a.appendChild(UI.el('img', { src, alt: '' }));
        else a.appendChild(UI.el('span', { text: (name || '?').trim().charAt(0).toUpperCase() || '?' }));
        a.insertAdjacentHTML('beforeend', FB.frames.svg(FB.frames.has(frameId) ? frameId : 'fr_none'));
        return a;
    };
})(window.FB);
