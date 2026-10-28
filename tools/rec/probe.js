// probe.js — быстро проверить MP4: длительность, размер кадра, дорожки, кодеки, битрейт.
//   node tools/rec/probe.js файл1.mp4 файл2.mp4 ...
// Читает только заголовки (moov), без ffmpeg.
const fs = require('fs');
const path = require('path');

function boxes(buf, start, end) {
    const out = [];
    let o = start;
    while (o + 8 <= end) {
        let size = buf.readUInt32BE(o);
        const type = buf.toString('latin1', o + 4, o + 8);
        let hdr = 8;
        if (size === 1) { size = Number(buf.readBigUInt64BE(o + 8)); hdr = 16; }
        if (size === 0) size = end - o;
        if (size < hdr) break;
        out.push({ type, start: o, hdr, end: Math.min(end, o + size) });
        o += size;
    }
    return out;
}
const find = (buf, list, type) => list.find(b => b.type === type);
const kids = (buf, b) => boxes(buf, b.start + b.hdr, b.end);

function probe(file) {
    const buf = fs.readFileSync(file);
    const top = boxes(buf, 0, buf.length);
    const moov = find(buf, top, 'moov');
    if (!moov) return { file, error: 'нет moov' };
    const mk = kids(buf, moov);
    const mvhd = find(buf, mk, 'mvhd');
    const v = buf[mvhd.start + mvhd.hdr];
    const ts = buf.readUInt32BE(mvhd.start + mvhd.hdr + (v === 1 ? 20 : 12));
    const dur = v === 1 ? Number(buf.readBigUInt64BE(mvhd.start + mvhd.hdr + 24)) : buf.readUInt32BE(mvhd.start + mvhd.hdr + 16);
    const res = { file: path.basename(file), size: +(buf.length / 1e6).toFixed(2) + ' МБ', duration: +(dur / ts).toFixed(2) + ' с', moovFirst: top.findIndex(b => b.type === 'moov') < top.findIndex(b => b.type === 'mdat'), tracks: [] };
    for (const trak of mk.filter(b => b.type === 'trak')) {
        const tk = kids(buf, trak);
        const tkhd = find(buf, tk, 'tkhd');
        const tv = buf[tkhd.start + tkhd.hdr];
        const wOff = tkhd.start + tkhd.hdr + (tv === 1 ? 88 : 76);
        const width = buf.readUInt32BE(wOff) >>> 16, height = buf.readUInt32BE(wOff + 4) >>> 16;
        const mdia = find(buf, tk, 'mdia');
        const mk2 = kids(buf, mdia);
        const hdlr = find(buf, mk2, 'hdlr');
        const handler = buf.toString('latin1', hdlr.start + hdlr.hdr + 8, hdlr.start + hdlr.hdr + 12);
        const minf = find(buf, mk2, 'minf');
        const stbl = find(buf, kids(buf, minf), 'stbl');
        const stsd = find(buf, kids(buf, stbl), 'stsd');
        const codec = buf.toString('latin1', stsd.start + stsd.hdr + 12, stsd.start + stsd.hdr + 16);
        const stsz = find(buf, kids(buf, stbl), 'stsz');
        const n = buf.readUInt32BE(stsz.start + stsz.hdr + 8);
        res.tracks.push(handler === 'vide' ? { kind: 'видео', codec, width, height, frames: n } : { kind: handler === 'soun' ? 'звук' : handler, codec, samples: n });
    }
    res.bitrate = +(buf.length * 8 / (dur / ts) / 1e6).toFixed(2) + ' Мбит/с';
    return res;
}

process.argv.slice(2).forEach(f => {
    try { console.log(JSON.stringify(probe(f))); } catch (e) { console.log(f + ': ' + e.message); }
});
