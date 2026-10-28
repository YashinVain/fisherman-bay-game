#!/bin/sh
# Снять исходники и смонтировать все ролики для каталога Яндекс Игр.
#   sh tools/rec/ads.sh            — всё подряд (исходники ПК и телефона, потом ролики)
#   sh tools/rec/ads.sh edit       — только монтаж (исходники уже сняты)
# Нужен запущенный сервер: node tools/serve.js
# Готовые ролики копируются в docs/promo/video, кадры исходников остаются в
# %TEMP%\fishing-tales-rec (путь — в tools/rec/paths.js; после сборки папку можно удалить).
cd "$(dirname "$0")/../.."
if [ "$1" != "edit" ]; then
    for o in h v; do
        echo "=== исходники $o"
        node tools/rec/rec.js "tools/rec/films/src-$o.js" 2>&1 | tail -3
    done
fi
for e in ad-baika ad-challenge gameplay; do
    for o in h v; do
        echo "=== $e $o"
        node tools/rec/edit.js "tools/rec/edits/$e.js" $o --publish 2>&1 | tail -3
    done
done
echo "=== лёгкие копии для консоли (до 4,9 МБ)"
node tools/rec/light.js docs/promo/video/*.mp4 2>&1 | grep '✓'
echo "=== готово"
ls -la docs/promo/video
