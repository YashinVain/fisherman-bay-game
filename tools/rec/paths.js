// paths.js — где лежат кадры и черновики видео. Нарочно вне папки проекта
// (она в OneDrive): кадры весят гигабайты и не должны синхронизироваться.
// Можно поменять переменной окружения FB_REC_OUT. Сервер (tools/serve.js)
// отдаёт эту папку по адресу /rec/.
const os = require('os');
const path = require('path');
module.exports = { REC_OUT: process.env.FB_REC_OUT || path.join(os.tmpdir(), 'fishing-tales-rec') };
