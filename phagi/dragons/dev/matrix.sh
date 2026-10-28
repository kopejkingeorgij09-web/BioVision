#!/bin/bash
# контрольные ширины × светлая/тёмная: SCEN=... ./matrix.sh <выход> [fixture]
O=${1:-./out};F=${2:-isle-many.json};mkdir -p $O
run(){ W=$1 H=$2 T=$3 D=$4; SCEN=$SCEN DRAG="$(cat $F)" W=$W H=$H TOUCH=$T DARK=$D TAG=${D:+d} timeout 300 node hx.js ../.. $O > $O/log-${SCEN%.js}-${D:+d}$W.txt 2>&1; }
for D in "" 1; do
  run 320 568 1 "$D" & run 360 740 1 "$D" & run 390 844 1 "$D" & wait
  run 430 932 1 "$D" & run 768 1024 1 "$D" & run 1440 900 "" "$D" & wait
done
