#!/bin/bash
# контрольные ширины × светлая/тёмная: SCEN=... ./matrix.sh <выход> [fixture]
# Код выхода: 0, если все 12 прогонов прошли; иначе 1 и список проваленных. Снимки экрана не считаются доказательством сохранения или баланса:
# решают проверки need() в сценарии и ошибки страницы.
O=${1:-./out};F=${2:-isle-many.json};mkdir -p $O
FAILS=$O/.fails-${SCEN%.js};: > $FAILS
run(){ W=$1 H=$2 T=$3 D=$4; L=$O/log-${SCEN%.js}-${D:+d}$W.txt
  SCEN=$SCEN DRAG="$(cat $F)" W=$W H=$H TOUCH=$T DARK=$D TAG=${D:+d} timeout 300 node hx.js ../.. $O > $L 2>&1 || echo "${SCEN%.js} ${D:+d}$W" >> $FAILS; }
for D in "" 1; do
  run 320 568 1 "$D" & run 360 740 1 "$D" & run 390 844 1 "$D" & wait
  run 430 932 1 "$D" & run 768 1024 1 "$D" & run 1440 900 "" "$D" & wait
done
if [ -s $FAILS ]; then echo "${SCEN%.js}: провалы:"; cat $FAILS; exit 1; fi
echo "${SCEN%.js}: 12/12 PASS"
