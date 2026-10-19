// events.js — то, что иногда случается само: жор (минута, когда клюёт без
// остановки). Жор бывает раз в несколько минут игры, а в первый раз — пораньше,
// чтобы новичок его увидел. На уроке рыбалки не бывает.

(function (FB) {
    const E = FB.events = {};
    const U = FB.U;

    E.FRENZY_LEN = 40;                 // сколько длится жор, с
    E.FRENZY_EVERY = [480, 840];       // как часто, с игры (8–14 минут)
    E.frenzy = null;                   // { t, len }
    let wait = 360;                    // до первого жора

    E.frenzyOn = () => !!E.frenzy;
    E.frenzyLeft = () => E.frenzy ? Math.max(0, E.frenzy.len - E.frenzy.t) : 0;

    E.startFrenzy = () => {
        E.frenzy = { t: 0, len: E.FRENZY_LEN };
        FB.audio.play('frenzy');
        FB.audio.setMood && FB.audio.setMood('frenzy');
        FB.emit('frenzy', true);
    };
    function stopFrenzy() {
        E.frenzy = null;
        wait = U.rand(E.FRENZY_EVERY[0], E.FRENZY_EVERY[1]);
        FB.audio.setMood && FB.audio.setMood(null);
        FB.emit('frenzy', false);
    }

    E.update = (dt) => {
        const S = FB.S, F = FB.fishing;
        if (!S || S.tut < 99 || S.stats.catches < 3) return;
        if (E.frenzy) {
            E.frenzy.t += dt;
            // Пока тянем рыбу, жор не кончается — доловить последнюю можно спокойно
            if (E.frenzy.t >= E.frenzy.len && F.phase !== 'fight' && F.phase !== 'bite') stopFrenzy();
            return;
        }
        wait -= dt;
        if (wait <= 0 && (F.phase === 'idle' || F.phase === 'wait')) E.startFrenzy();
    };

    // Во время жора над водой то и дело выпрыгивает рыбёшка
    let jumps = [];
    E.draw = (ctx) => {
        if (!E.frenzy) { jumps = []; return; }
        const SC = FB.scene, u = SC.unit();
        if (Math.random() < 0.06 && jumps.length < 4) jumps.push({ tx: U.rand(-0.9, 0.95), dist: U.rand(0.1, 0.8), t: 0, len: U.rand(0.5, 0.8), dir: Math.random() < 0.5 ? -1 : 1 });
        jumps = jumps.filter(j => {
            j.t += 1 / 60;
            const p = SC.project(j.tx, j.dist);
            const q = j.t / j.len;
            if (q >= 1) { SC.ripple(p.x, p.y, 0.5 * p.s * 1.6); return false; }
            const s = u * 2.4 * Math.max(0.5, p.s * 1.5);
            const x = p.x + (q - 0.5) * s * 3 * j.dir, y = p.y - Math.sin(q * Math.PI) * s * 2.2;
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(j.dir, 1);
            ctx.rotate((q - 0.5) * 1.8);
            ctx.fillStyle = 'rgba(225,238,248,0.95)';
            ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.38, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.moveTo(-s * 0.85, 0); ctx.lineTo(-s * 1.4, -s * 0.4); ctx.lineTo(-s * 1.4, s * 0.4); ctx.closePath(); ctx.fill();
            ctx.restore();
            return true;
        });
    };
})(window.FB);
