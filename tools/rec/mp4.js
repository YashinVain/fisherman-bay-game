// mp4.js — маленький упаковщик MP4: видео H.264 + звук AAC из WebCodecs.
// Обычный (не фрагментированный) файл с длительностью в заголовке и moov
// в начале — его спокойно принимают сайты и плееры.
//
//   const mux = new MP4Muxer({ width, height, fps, videoDesc, sampleRate, channels, audioDesc });
//   mux.addVideo(bytes, isKey, ptsUs)   — в порядке декодирования
//   mux.addAudio(bytes)                 — кадры AAC по 1024 сэмпла
//   const blob = mux.finish();

(function () {
    const enc = new TextEncoder();
    const u8 = (...a) => new Uint8Array(a);
    const u16 = (v) => u8(v >> 8 & 255, v & 255);
    const u24 = (v) => u8(v >> 16 & 255, v >> 8 & 255, v & 255);
    const u32 = (v) => u8(v >>> 24 & 255, v >> 16 & 255, v >> 8 & 255, v & 255);
    const i32 = (v) => u32(v >>> 0);
    const str = (s) => enc.encode(s);
    const zeros = (n) => new Uint8Array(n);
    function cat(parts) {
        let n = 0;
        for (const p of parts) n += p.length;
        const out = new Uint8Array(n);
        let o = 0;
        for (const p of parts) { out.set(p, o); o += p.length; }
        return out;
    }
    const box = (type, ...parts) => { const body = cat(parts); return cat([u32(body.length + 8), str(type), body]); };
    const full = (type, ver, flags, ...parts) => box(type, u8(ver), u24(flags), ...parts);
    const MATRIX = cat([u32(0x00010000), u32(0), u32(0), u32(0), u32(0x00010000), u32(0), u32(0), u32(0), u32(0x40000000)]);

    class MP4Muxer {
        constructor(o) {
            this.o = o;
            this.v = [];   // { data, key, pts }
            this.a = [];   // { data }
            this.vScale = 90000;
            this.vDelta = Math.round(90000 / o.fps);
        }
        addVideo(data, key, pts) { this.v.push({ data: new Uint8Array(data), key: !!key, pts }); }
        addAudio(data) { this.a.push({ data: new Uint8Array(data) }); }

        videoTrak(offsets, durMs) {
            const o = this.o, n = this.v.length, D = this.vDelta;
            // Время показа против времени декодирования (если кодер переставил кадры)
            const pts = this.v.map(s => Math.round(s.pts / 1e6 * this.vScale));
            const minPts = Math.min(...pts);
            const cts = pts.map((p, i) => p - minPts - i * D);
            const needCtts = cts.some(c => c !== 0);
            const shift = needCtts ? -Math.min(0, ...cts) : 0;
            const avc1 = box('avc1', zeros(6), u16(1), zeros(16), u16(o.width), u16(o.height),
                u32(0x00480000), u32(0x00480000), u32(0), u16(1), zeros(32), u16(0x0018), u16(0xffff),
                box('avcC', new Uint8Array(o.videoDesc)));
            const stbl = box('stbl',
                full('stsd', 0, 0, u32(1), avc1),
                full('stts', 0, 0, u32(1), u32(n), u32(D)),
                needCtts ? full('ctts', 0, 0, u32(n), cat(cts.map(c => cat([u32(1), i32(c + shift)])))) : zeros(0),
                full('stss', 0, 0, u32(this.v.filter(s => s.key).length), cat(this.v.map((s, i) => s.key ? u32(i + 1) : null).filter(Boolean))),
                full('stsc', 0, 0, u32(1), u32(1), u32(1), u32(1)),
                full('stsz', 0, 0, u32(0), u32(n), cat(this.v.map(s => u32(s.data.length)))),
                full('stco', 0, 0, u32(n), cat(offsets.map(u32))));
            const mdia = box('mdia',
                full('mdhd', 0, 0, u32(0), u32(0), u32(this.vScale), u32(n * D), u16(0x55c4), u16(0)),
                full('hdlr', 0, 0, u32(0), str('vide'), zeros(12), str('VideoHandler'), u8(0)),
                box('minf', full('vmhd', 0, 1, zeros(8)), box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1))), stbl));
            const tkhd = full('tkhd', 0, 3, u32(0), u32(0), u32(1), u32(0), u32(durMs), zeros(8), u16(0), u16(0), u16(0), u16(0), MATRIX,
                u32(o.width << 16), u32(o.height << 16));
            const edts = shift ? box('edts', full('elst', 0, 0, u32(1), u32(durMs), u32(shift), u16(1), u16(0))) : zeros(0);
            return box('trak', tkhd, edts, mdia);
        }

        audioTrak(offsets, durMs) {
            const o = this.o, n = this.a.length, sr = o.sampleRate;
            const asc = new Uint8Array(o.audioDesc);
            const dsi = cat([u8(0x05, asc.length), asc]);
            const dcd = cat([u8(0x04, 13 + dsi.length, 0x40, 0x15), u24(0), u32(o.audioBitrate || 192000), u32(o.audioBitrate || 192000), dsi]);
            const sl = u8(0x06, 0x01, 0x02);
            const es = cat([u8(0x03, 3 + dcd.length + sl.length), u16(0), u8(0), dcd, sl]);
            const mp4a = box('mp4a', zeros(6), u16(1), zeros(8), u16(o.channels), u16(16), u16(0), u16(0), u32(sr << 16 >>> 0),
                full('esds', 0, 0, es));
            const stbl = box('stbl',
                full('stsd', 0, 0, u32(1), mp4a),
                full('stts', 0, 0, u32(1), u32(n), u32(1024)),
                full('stsc', 0, 0, u32(1), u32(1), u32(1), u32(1)),
                full('stsz', 0, 0, u32(0), u32(n), cat(this.a.map(s => u32(s.data.length)))),
                full('stco', 0, 0, u32(n), cat(offsets.map(u32))));
            const mdia = box('mdia',
                full('mdhd', 0, 0, u32(0), u32(0), u32(sr), u32(n * 1024), u16(0x55c4), u16(0)),
                full('hdlr', 0, 0, u32(0), str('soun'), zeros(12), str('SoundHandler'), u8(0)),
                box('minf', full('smhd', 0, 0, u16(0), u16(0)), box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1))), stbl));
            const tkhd = full('tkhd', 0, 3, u32(0), u32(0), u32(2), u32(0), u32(durMs), zeros(8), u16(0), u16(1), u16(0x0100), u16(0), MATRIX, u32(0), u32(0));
            return box('trak', tkhd, mdia);
        }

        build(vOff, aOff) {
            const vDur = Math.round(this.v.length * this.vDelta / this.vScale * 1000);
            const aDur = this.a.length ? Math.round(this.a.length * 1024 / this.o.sampleRate * 1000) : 0;
            const dur = Math.max(vDur, aDur);
            const mvhd = full('mvhd', 0, 0, u32(0), u32(0), u32(1000), u32(dur), u32(0x00010000), u16(0x0100), zeros(10), MATRIX, zeros(24), u32(this.a.length ? 3 : 2));
            const traks = [this.videoTrak(vOff, vDur)];
            if (this.a.length) traks.push(this.audioTrak(aOff, aDur));
            return box('moov', mvhd, ...traks);
        }

        finish() {
            const ftyp = box('ftyp', str('isom'), u32(0x200), str('isom'), str('iso2'), str('avc1'), str('mp41'));
            // Сначала считаем размер moov с нулевыми смещениями — он от смещений не зависит
            const zeroV = this.v.map(() => 0), zeroA = this.a.map(() => 0);
            const moovSize = this.build(zeroV, zeroA).length;
            // Видео и звук кусками по ~0.5 с вперемешку: плееру удобнее читать
            let off = ftyp.length + moovSize + 8;
            const order = [];
            const vPer = Math.round(this.o.fps / 2), aPer = Math.round(this.o.sampleRate / 1024 / 2);
            let vi = 0, ai = 0;
            const vOff = [], aOff = [];
            while (vi < this.v.length || ai < this.a.length) {
                for (let k = 0; k < vPer && vi < this.v.length; k++, vi++) { vOff.push(off); off += this.v[vi].data.length; order.push(this.v[vi].data); }
                for (let k = 0; k < aPer && ai < this.a.length; k++, ai++) { aOff.push(off); off += this.a[ai].data.length; order.push(this.a[ai].data); }
            }
            const moov = this.build(vOff, aOff);
            if (moov.length !== moovSize) throw new Error('moov поменял размер');
            let mdatSize = 8;
            for (const p of order) mdatSize += p.length;
            return new Blob([ftyp, moov, u32(mdatSize), str('mdat'), ...order], { type: 'video/mp4' });
        }
    }
    window.MP4Muxer = MP4Muxer;
})();
