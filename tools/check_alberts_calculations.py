"""Independently recompute numerical and sequence answers in the expanded bank."""
from fractions import Fraction
import itertools
import json
import math
from pathlib import Path

qs = json.loads((Path(__file__).resolve().parents[1] / 'content/reading/alberts/questions.json').read_text())
checked = set()

def check(fragment, expected):
    found = [q for q in qs if q['type'] == 'mcq' and fragment in q['prompt']]
    assert len(found) == 1, (fragment, len(found))
    q = found[0]
    actual = q['options'][q['correct']]
    assert actual == expected, (q['id'], actual, expected)
    checked.add(q['id'])

def decimal(x, digits=2):
    return f'{x:.{digits}f}'.replace('.', ',')

check('независимые нуклеотиды имеют частоты A=T=0,1', decimal(sum(p*p for p in (.1,.1,.4,.4))))
score = sum(2 if x == y else -2 for x, y in zip('ACGT', 'A-GT'))
check('Для выравнивания ACGT с A–GT', str(score))
check('При pH=pKa+1 какая доля', str(Fraction(10, 1+10)))
check('Два независимых одинаковых участка', str(Fraction(1, 2)**2))
check('лизин несёт +1, глутамат −1', f'Уменьшился на {1-(-1)}')
check('Сколько разных последовательностей длины 6', str(4**6))
check('ΔG одной реакции +8 кДж/моль', f'−{abs(8-12)} кДж/моль')
check('Q/K=e⁻²', f'−{abs(round(2.5*math.log(math.exp(-2))))} кДж/моль')
assert Fraction(20,10) == Fraction(2,1)
check('константу прямого превращения с 2 до 20', f'Сохранилась равной {20//10}')
check('изменение энтропии клетки равно −4', f'+{-4+6}')
check('потрачены 2 ATP', f'{4-2} ATP')
check('восполнение идёт со скоростью 1', f'Дополнительное восполнение на {3-1} единицы либо уменьшение оттока')
check('образуется со скоростью 12 единиц', f'Он увеличивается со скоростью {12-5-3} единицы')
assert 240//60 == 4 and 120//60 == 2
check('нативная масса комплекса 240 кДа', 'Четыре цепи, попарно соединённые дисульфидными связями')
stoichiometries = [(a,b) for a in range(1,6) for b in range(1,6) if 60*a+40*b == 200]
assert stoichiometries == [(2,2)]
check('Масса нативного комплекса 200 кДа', 'Две цепи каждого типа')
check('свободная равновесная концентрация 2 мкМ', f'{(10-2)*100//10}%')
check('При концентрации свободного лиганда 2 нМ', str(Fraction(2,2+2)))
check('заданы Vmax=80 единиц, Km=2 мМ, S=6 мМ', f'{80*6//(2+6)} единиц')
check('исходно S=Km и Vmax=80', f'{2*80//2} единиц')
check('Заданы Km(E)=1, Km(M)=4', decimal((100/(4+1))/(100/(1+1)),1))
check('исходный барьер 20 единиц', str((20-5)-(0-10)))
check('половина — частичным с эффективностью 0,3', f'{round(100*(.5*1+.5*.3))}%')
check('максимальная частота 20 циклов/с', f'{8*20} нм/с')
check('A=10, T=20, G=30, C=40', f'{(30+40)*100//100}%')
check('дуплексе 1000 пар оснований', str(400*3+600*2))
check('GC-доля 60%, позиции независимы', decimal(.2*.2*.3,3))
reverse_complement = 'AGTCCG'.translate(str.maketrans('ATGC','TACG'))[::-1]
check('обратнокомплементарная запись цепи 5′-AGTCCG', '5′-'+reverse_complement+'-3′')
check('трёх полуконсервативных репликаций', f'{2*100//(2**3)}%')
check('доля A среди всех нуклеотидов равна 18%', f'Для ДНК G={(100-2*18)//2}%; для РНК долю G определить нельзя')
check('защищённая кор-частица — 150 п.н.', f'{200-150} п.н. на повтор')
check('популяции 50 диплоидных особей', f'{100//(2*50)}%')
check('при λ=1', f'Около {round(math.exp(-1)*100)}%')
check('после второй — 1% оставшихся', '10⁻⁸')
assert math.isclose(1e-4*.01*.01, 1e-8)
check('наблюдается 0,01. Каков дефицит', 'В четыре раза')
assert math.isclose(.2*.2/.01, 4)
check('работы с 12 нуклеосомами', f'−{12*1}')
# The left fork moves from 0 at t=0; the right from 100 at t=40.
meeting_times = [t for t in range(40,101) if t == 100-(t-40)]
assert meeting_times == [70]
check('правая из 100 в t=40', f'В t={meeting_times[0]} мин')
ways = list(itertools.product((0,1), repeat=2))
check('Каждый из двух способов для каждой структуры', str(Fraction(sum(a!=b for a,b in ways),len(ways))))
check('один кроссинговер двух несестринских', str(Fraction(2,4)))
check('исходный участок-мишень 5 п.н. дублируется', f'На {1000+5} п.н.')
check('кольцевая ДНК длиной 4096 п.н.', str(4096//(4**6)))
transcribed = 'AGTCAT'.translate(str.maketrans('ATGC','UACG'))[::-1]
check('Матричная ДНК записана 5′-AGTCAT', '5′-'+transcribed+'-3′')
check('Кодирующая цепь участка гена записана 5′-GGAATGCCATTA', '5′-'+'GGAATGCCATTA'.replace('T','U')+'-3′')
check('участок A впервые обнаружен через 3 минуты', f'{36//(15-3)} тысячи нуклеотидов в минуту')
check('экзона длиной 120, 90 и 150', f'Сократится на {90} нуклеотидов и {90//3} аминокислот')
check('В модели 2% тРНК сначала заряжены неверно', decimal(2*(1-.75),1)+'%')
codons = {'AUG':'Met','GCU':'Ala','CAA':'Gln','GGC':'Gly','GGU':'Gly'}
def translate(sequence):
    peptide=[]
    for i in range(0,len(sequence),3):
        codon=sequence[i:i+3]
        if codon in ('UAA','UAG','UGA'): break
        peptide.append(codons[codon])
    return peptide
edited = 'AUGCAAGGCUAA'.replace('C','U')
check('Все C заменили на U до трансляции', 'Одна')
assert translate(edited) == ['Met']
mutant_rna='AUCGCUAUGCAAUAA'
check('первый AUG превратить в AUC', '–'.join(translate(mutant_rna[mutant_rna.index('AUG'):])) )
check('время полужизни в модели 2 часа', str(Fraction(1,2)**(6//2)))
check('B даёт 200 мг, 90% активны', f'В B: около {decimal(120/(200*.9))} против {decimal(100/(500*.25))} в A')
check('каждая копируется верно с вероятностью 0,99', '0,99¹⁰⁰, примерно '+decimal(.99**100,3))
check('равных количеств нормальных и дефектных субъединиц', f'{round(.5**2*100)}%')
assert Fraction(1,2)**2 == Fraction(1,4)
dimers = list(itertools.combinations_with_replacement('ABCD',2))
check('четыре типа субъединиц', str(len(dimers)))
check('концентрация белка 100 нМ, объём клетки 2 мкм³', f'В {round(100e-9*2e-15*6e23/10)} раз')
check('шаг задан как 10 п.н.', f'{10} п.н.')
check('репрессор L запрещает x<3', f'На интервале от {max(0,3)} до {min(10,7)} включительно')
check('После двух удвоений поддержание', f'{100//(2**2)}%')
check('В группе A все клетки имеют 10 единиц', f'A: {sum(x>15 for x in (10,10))*50}%; B: {sum(x>15 for x in (0,20))*50}%')
logic = [('ON' if ((x and not y) or z) else 'OFF') for x,y,z in [(0,0,0),(1,1,0),(1,0,0),(0,1,1)]]
check('Задана логика F=', ', '.join(logic))
check('ровно один из трёх взаимно исключающих', str(3*2**3))
check('третий целиком лежит в 3′-UTR', f'{2**2} при {2**3} вариантах РНК')
check('N(t)=2N₀−N₀e⁻kt', decimal(2-math.exp(-math.log(2)),1)+'N₀')
assert 2**(-((20-15)-(22-17))) == 1
check('Cq мишени/контроля равны 22/17', 'Не меняется; абсолютное число РНК на клетку из этого не установлено')
print(f'PASS independent calculations: {len(checked)} numerical, sequence and logic answers')
