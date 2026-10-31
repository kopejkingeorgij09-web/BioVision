# Промпты для рисунка драконов

Для чего: части драконов под скелет (этап 0 и 2 из `REWORK-RU.md`). Генерирует владелец (ChatGPT или другой сервис), Claude режет и собирает.

## Как генерировать

1. К каждой генерации прикладывайте эталон стиля (дракон Флоры, Света и Воды) со словами «match the art style of the reference, not its colors or anatomy».
2. Фон только прозрачный (PNG). Если сервис не умеет, однотонный #00FF00 без теней на фоне.
3. Ракурс у всех стихий один: строгий профиль, морда вправо, свет слева сверху, камера на уровне груди.
4. Разрешение не меньше 1536 px по длинной стороне, дракон занимает 85–90 % кадра и не обрезан.
5. Без текста, рамок, земли, травы, частиц вокруг. Летающие листья, капли и искры не нужны: эффекты делает игра.
6. Складывайте в `phagi/dragons/art-src/<стихия>/` с именами `body.png`, `wing.png`, `head-attack.png`, `baby.png`. Стихии: `fire`, `water`, `earth`, `air`, `flora`, `light`, `dark`.
7. Начинаем с одной стихии. Остальные только после того, как пробный дракон собран и стиль утверждён.

## Общий кусок промпта (вставлять в начало)

```
High-end painterly fantasy creature art for a premium mobile game, crisp detailed scales, clean readable silhouette, soft top-left key light with gentle rim light, rich but controlled colors, consistent proportions, isolated on a fully transparent background, no ground, no shadow on the background, no text, no particles floating around the creature.
```

## Четыре картинки на стихию

1. `body.png`
```
[ОБЩИЙ КУСОК] Full body of a [ОПИСАНИЕ СТИХИИ] dragon WITHOUT WINGS (wings removed, smooth shoulders where wings would attach), strict side profile facing right, standing on four legs in a neutral pose, all four legs visible and not overlapping, neck raised, tail extended straight back and fully visible, mouth closed.
```
2. `wing.png`
```
[ОБЩИЙ КУСОК] A single detached wing of a [ОПИСАНИЕ СТИХИИ] dragon, fully spread flat, viewed straight from the side, wing root on the left, nothing else in the image.
```
3. `head-attack.png`
```
[ОБЩИЙ КУСОК] Head and neck of the same [ОПИСАНИЕ СТИХИИ] dragon, strict side profile facing right, jaws wide open in an attack roar, neck cut cleanly at the base.
```
4. `baby.png`
```
[ОБЩИЙ КУСОК] A cute baby [ОПИСАНИЕ СТИХИИ] dragon hatchling, big head, short legs, tiny wings folded, strict side profile facing right, standing, same style and colors as the adult.
```

## Описания стихий (подставлять вместо [ОПИСАНИЕ СТИХИИ])

Стихия должна читаться по одному силуэту, без цвета. Поэтому у каждой своя анатомия.

- Огонь, `fire`: `stocky muscular predator build, heavy jaw, swept-back curved horns, ember-red and orange scales with glowing cracks only on the chest, leathery bat wings with glowing orange veins, flame-tipped tail, spiky dorsal ridge`
- Вода, `water`: `long serpentine sleek body, smooth teal and deep blue scales, finned crest along the spine, gill frills on the cheeks, wings made of translucent fin membranes like a manta ray, flat paddle tail fin, slender legs with webbed claws`
- Земля, `earth`: `massive low heavy body, overlapping stone armor plates, amber crystals growing from the back, short thick legs, short broad wings plated with slate, club-like rocky tail tip, ochre and brown palette, blunt horned snout`
- Воздух, `air`: `light agile long-necked body, white and pale sky-blue feathered scales, huge feathered bird-like wings, feathered crest, long thin tail ending in a fan of feathers, narrow elegant head`
- Флора, `flora`: `body covered in bark-like scales and moss, antler-like branch horns, vines wrapping the legs, small white flowers, wings made of large veined leaves, tail ending in a leafy frond, green and warm brown palette`
- Свет, `light`: `graceful slender body, ivory and gold scales, glowing halo ring behind the head, crystal horns, wings of luminous translucent golden membranes with ray-like spines, tail ending in a radiant crystal`
- Тьма, `dark`: `gaunt angular body, black and deep violet scales, many sharp spines, glowing violet eyes, tattered smoky wings with holes, whip-like barbed tail, shadow wisps rising from the back`

## Что проверяю после генерации

- Профиль и свет совпадают с эталоном.
- Силуэт стихии узнаётся в 96 px на траве и на тёмном фоне.
- Края чистые, без белой или зелёной каймы.
- У тела нет крыльев, у крыла нет тела.
