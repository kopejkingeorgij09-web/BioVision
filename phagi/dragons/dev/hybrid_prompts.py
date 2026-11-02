"""Промпты для гибридов в Canva (генерация по образцам родителей). Печатает JSON: пары и тройки стихий в порядке
игры (F W T A P L D), у каждой промпт и media id родителей в Canva. Первая стихия даёт сложение тела."""
import json, itertools
EL = ['fire', 'water', 'earth', 'air', 'flora', 'light', 'dark']
MEDIA = {'fire': 'MAHZwkIMkFE', 'water': 'MAHZwqWjSPI', 'earth': 'MAHZw1t4OY0', 'air': 'MAHZw1NzWEo',
         'flora': 'MAHZwyD6zTE', 'light': 'MAHZw2v-KFI', 'dark': 'MAHZwzL0i0g'}
NAME = {'fire': 'FIRE', 'water': 'WATER', 'earth': 'EARTH', 'air': 'AIR', 'flora': 'FLORA (plant)', 'light': 'LIGHT', 'dark': 'DARK (shadow)'}
BUILD = {'fire': 'the heavy stocky muscular build of the fire dragon', 'water': 'the long sleek serpentine build of the water dragon',
         'earth': 'the low wide boulder-like build of the earth dragon', 'air': 'the lean tall heron-like build on long legs of the air dragon',
         'flora': 'the graceful stag-like build of the flora dragon', 'light': 'the slender regal build of the light dragon',
         'dark': 'the gaunt angular panther-like build of the dark dragon'}
FEAT = {'fire': 'ember-red scales with glowing orange cracks, curved black horns, flames',
        'water': 'translucent teal finned crest, gill frills on the cheeks, deep blue and teal scales, wet glossy highlights',
        'earth': 'slate-grey and ochre stone armor plates, glowing amber crystals growing from the back',
        'air': 'white and sky-blue feathers on the neck and shoulders, a swept-back feather crest',
        'flora': 'bark-like brown scales with moss, wooden branching antlers with small leaves, vines and small white flowers',
        'light': 'ivory and gold scales, a golden ray-like mane, crystal horns, a thin glowing halo ring behind the head',
        'dark': 'black and deep violet scales, many sharp thin spines, glowing violet eyes, thin shadow wisps rising from the back'}
TAIL = {'fire': 'a burning flame', 'water': 'a wide paddle fin', 'earth': 'a heavy rocky club', 'air': 'a fan of long feathers',
        'flora': 'a leafy frond', 'light': 'a radiant golden crystal', 'dark': 'a barbed shadow blade'}
END = ('Same painterly glossy premium mobile game art style as the references. No wings. Strict side profile facing right, '
       'standing on four legs, all four legs visible, mouth closed. Isolated on a plain white background, no ground, no shadow, no text.')

def prompt(c):
    names = ' and '.join(NAME[e] for e in c)
    if len(c) == 2:
        a, b = c
        mix = (f'Body: {BUILD[a]}, mixed throughout with the {NAME[b].lower()} dragon. Head, back and tail must clearly show BOTH elements: '
               f'from {NAME[a].lower()}: {FEAT[a]}; from {NAME[b].lower()}: {FEAT[b]}. Scales blend between both palettes over the whole body '
               f'(back in one, belly and legs in the other). The tail ends in {TAIL[a]} merged with {TAIL[b]}.')
    else:
        a, b, d = c
        mix = (f'Body: {BUILD[a]}, mixed throughout with the {NAME[b].lower()} and {NAME[d].lower()} dragons, an epic rare creature. '
               f'Head and horns combine {NAME[a].lower()} and {NAME[b].lower()}; the back and crest combine {NAME[b].lower()} and {NAME[d].lower()}. '
               f'Features: {FEAT[a]}; {FEAT[b]}; {FEAT[d]}. Scales blend between all three palettes in bands over the whole body. '
               f'The tail ends in {TAIL[d]} merged with {TAIL[a]}. More ornate and majestic than a two-element hybrid.')
    return f'Fuse the reference dragons into ONE new hybrid dragon of {names}. {mix} {END}'

out = []
for k in (2, 3):
    for c in itertools.combinations(EL, k):
        out.append({'id': '-'.join(c), 'els': list(c), 'refs': [MEDIA[e] for e in c], 'prompt': prompt(c)})
if __name__ == '__main__':
    print(json.dumps(out, ensure_ascii=False, indent=1))
