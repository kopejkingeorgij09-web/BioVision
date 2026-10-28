#!/bin/bash
# все сценарии стенда: ./all.sh <выход> [quick]
# quick: одна ширина 390 светлая; без него каждый сценарий на 6 ширинах × 2 темы (matrix.sh).
# Код выхода 1, если хоть один прогон не прошёл; список провалов в конце.
O=${1:-./out};mkdir -p $O;FAIL=0;: > $O/.all
S="scen_save.js:isle-many.json scen_fsave.js:isle-pve.json scen_lab.js:isle-lab.json scen_reg.js:- scen_fight.js:isle-pve.json
scen_camp.js:isle-camp.json scen_path.js:- scen_nurs.js:isle-nurs.json scen_st5.js:isle-st5.json scen_isle.js:isle-many.json scen_back.js:isle-many.json scen_sw.js:isle-many.json scen_d.js:isle-pve.json scen_hw.js:isle-many.json scen_isle2.js:isle-lava.json scen_draft.js:- scen_role.js:- scen_tasks.js:- scen_sum.js:- scen_play.js:isle-many.json scen_photo.js:-"
for x in $S; do sc=${x%%:*};fx=${x##*:};[ "$fx" = "-" ] && fx=/dev/null
  if [ "$2" = quick ]; then
    SCEN=$sc DRAG="$(cat $fx)" W=390 H=844 TOUCH=1 timeout 300 node hx.js ../.. $O > $O/log-${sc%.js}-q.txt 2>&1 && r=PASS || { r=FAIL;FAIL=1;echo "$sc" >> $O/.all; }
    echo "$sc $r $(grep -c '  ✓' $O/log-${sc%.js}-q.txt) проверок"
  else SCEN=$sc ./matrix.sh $O $fx || { FAIL=1;echo "$sc" >> $O/.all; }; fi
done
[ $FAIL = 1 ] && { echo "ПРОВАЛЫ:";cat $O/.all;exit 1; };echo "все прошли"
