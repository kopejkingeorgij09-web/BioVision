# Промпты для ChatGPT: драконы стихий

Один файл со всем, что нужно отправить в ChatGPT, чтобы получить части драконов для игры. Тексты для копирования на английском: так генератор держит стиль надёжнее. Пояснения по-русски.

## Как работать

1. Откройте новый чат в ChatGPT (нужна генерация картинок).
2. Первым сообщением отправьте блок «Сообщение 1» и приложите эталон стиля: `phagi/dragons/art-src/ref/style-flora-light-water.webp`.
3. Потом по одному отправляйте сообщения из раздела стихии, по одной картинке на сообщение. Пока картинка не устроила, просите переделать в том же чате (готовые фразы для правок в конце файла).
4. Сохраняйте картинки в PNG без пересжатия и кладите в `phagi/dragons/art-src/<папка стихии>/` под именами из заголовков: `body.png`, `wing.png`, `head-attack.png`, `baby.png`.
5. Начинаем с Огня. Остальные стихии генерируйте, когда пробный огненный дракон собран в игре и стиль утверждён. Каждую новую стихию лучше делать в том же чате, где получился Огонь: так стиль не поплывёт.

## Сообщение 1 (один раз, с приложенным эталоном)

```
I am making a 2D game where each dragon is animated from separate parts on a skeleton. I will ask you for one image per message. Rules for EVERY image in this chat:
1. Match the art style of the attached reference image: painterly, highly detailed, premium mobile game quality. Copy only the style, not its colors or anatomy.
2. Fully transparent background (PNG with alpha channel). No ground, no shadow, no text, no frame, no particles flying around.
3. Strict side profile, facing RIGHT, camera at chest height, light from the top-left with a soft rim light.
4. Landscape canvas 1536x1024. Keep the same scale for all images of the same dragon, so the parts fit together.
5. Never crop the creature or the part, leave a small empty margin on every side.
Reply "Ready" and wait for my first request.
```

## 1. Огонь (папка `fire/`)
Начинаем с этой стихии.

### `fire/body.png`: Тело без крыльев

```
High-end painterly fantasy creature art for a premium mobile strategy game, same art style as the attached reference image (rendering, scale detail, lighting), but NOT its colors or anatomy. Crisp detailed scales, clean readable silhouette, soft top-left key light with gentle rim light, rich but controlled colors. Isolated on a fully transparent background (PNG with alpha). No ground, no cast shadow, no text, no frame, no floating particles, leaves, sparks or drops around the creature. Landscape canvas 1536x1024. Full body of an adult FIRE element dragon WITHOUT ANY WINGS (wings removed, smooth shoulders with a small attachment socket where the wings would be). Anatomy: stocky muscular predator build, heavy jaw, swept-back curved black horns, ember-red and orange scales, glowing cracks only on the chest and throat, spiky dorsal ridge, the tail tip burns with a living flame. Strict side profile facing RIGHT, camera at chest height, standing on four legs in a calm neutral pose, all four legs visible and not overlapping each other, neck raised in an S-curve, mouth closed, tail extended straight back and fully visible. The dragon spans about 85% of the canvas width, feet on an imaginary line at 85% of the canvas height.
```

### `fire/wing.png`: Одно крыло

```
High-end painterly fantasy creature art for a premium mobile strategy game, same art style as the attached reference image (rendering, scale detail, lighting), but NOT its colors or anatomy. Crisp detailed scales, clean readable silhouette, soft top-left key light with gentle rim light, rich but controlled colors. Isolated on a fully transparent background (PNG with alpha). No ground, no cast shadow, no text, no frame, no floating particles, leaves, sparks or drops around the creature. Landscape canvas 1536x1024. A single detached wing of the same adult FIRE element dragon: leathery bat-like wing with three long fingers, dark red membrane with glowing orange veins, singed ragged trailing edge, small flames licking along the top bone. Fully spread and flat, seen exactly from the side, the wing root (where it attaches to the shoulder) at the LEFT middle of the canvas, the wing reaches up and to the right. Nothing else in the image.
```

### `fire/head-attack.png`: Голова в атаке

```
High-end painterly fantasy creature art for a premium mobile strategy game, same art style as the attached reference image (rendering, scale detail, lighting), but NOT its colors or anatomy. Crisp detailed scales, clean readable silhouette, soft top-left key light with gentle rim light, rich but controlled colors. Isolated on a fully transparent background (PNG with alpha). No ground, no cast shadow, no text, no frame, no floating particles, leaves, sparks or drops around the creature. Landscape canvas 1536x1024. Head and neck of the same adult FIRE element dragon (stocky muscular predator build, heavy jaw, swept-back curved black horns, ember-red and orange scales, glowing cracks only on the chest and throat, spiky dorsal ridge, the tail tip burns with a living flame), strict side profile facing RIGHT, jaws wide open in an attack roar, same head size and design as on the full body, the neck cut cleanly at its base with a flat edge. Nothing else in the image.
```

### `fire/baby.png`: Малыш

```
High-end painterly fantasy creature art for a premium mobile strategy game, same art style as the attached reference image (rendering, scale detail, lighting), but NOT its colors or anatomy. Crisp detailed scales, clean readable silhouette, soft top-left key light with gentle rim light, rich but controlled colors. Isolated on a fully transparent background (PNG with alpha). No ground, no cast shadow, no text, no frame, no floating particles, leaves, sparks or drops around the creature. Landscape canvas 1536x1024. a short stout hatchling with an oversized horned head, ember-red scales and a tiny flame on the tail tip: a baby version of the same FIRE element dragon, same colors and features in a cute simplified form: big head, short legs, tiny wings folded on the back. Strict side profile facing RIGHT, standing, mouth closed. Spans about 60% of the canvas width.
```

## 2. Вода (папка `water/`)

### `water/body.png`: Тело без крыльев

```
High-end painterly fantasy creature art for a premium mobile strategy game, same art style as the attached reference image (rendering, scale detail, lighting), but NOT its colors or anatomy. Crisp detailed scales, clean readable silhouette, soft top-left key light with gentle rim light, rich but controlled colors. Isolated on a fully transparent background (PNG with alpha). No ground, no cast shadow, no text, no frame, no floating particles, leaves, sparks or drops around the creature. Landscape canvas 1536x1024. Full body of an adult WATER element dragon WITHOUT ANY WINGS (wings removed, smooth shoulders with a small attachment socket where the wings would be). Anatomy: long serpentine sleek body, smooth teal and deep blue scales with pale belly, finned crest running along the whole spine, gill frills on the cheeks, slender legs with webbed claws, the tail ends in a wide flat paddle fin. Strict side profile facing RIGHT, camera at chest height, standing on four legs in a calm neutral pose, all four legs visible and not overlapping each other, neck raised in an S-curve, mouth closed, tail extended straight back and fully visible. The dragon spans about 85% of the canvas width, feet on an imaginary line at 85% of the canvas height.
```

### `water/wing.png`: Одно крыло

```
High-end painterly fantasy creature art for a premium mobile strategy game, same art style as the attached reference image (rendering, scale detail, lighting), but NOT its colors or anatomy. Crisp detailed scales, clean readable silhouette, soft top-left key light with gentle rim light, rich but controlled colors. Isolated on a fully transparent background (PNG with alpha). No ground, no cast shadow, no text, no frame, no floating particles, leaves, sparks or drops around the creature. Landscape canvas 1536x1024. A single detached wing of the same adult WATER element dragon: wing made of translucent fin membrane like a manta ray or a fish fin, teal to deep blue, thin flexible rays instead of bones, wet glossy highlights. Fully spread and flat, seen exactly from the side, the wing root (where it attaches to the shoulder) at the LEFT middle of the canvas, the wing reaches up and to the right. Nothing else in the image.
```

### `water/head-attack.png`: Голова в атаке

```
High-end painterly fantasy creature art for a premium mobile strategy game, same art style as the attached reference image (rendering, scale detail, lighting), but NOT its colors or anatomy. Crisp detailed scales, clean readable silhouette, soft top-left key light with gentle rim light, rich but controlled colors. Isolated on a fully transparent background (PNG with alpha). No ground, no cast shadow, no text, no frame, no floating particles, leaves, sparks or drops around the creature. Landscape canvas 1536x1024. Head and neck of the same adult WATER element dragon (long serpentine sleek body, smooth teal and deep blue scales with pale belly, finned crest running along the whole spine, gill frills on the cheeks, slender legs with webbed claws, the tail ends in a wide flat paddle fin), strict side profile facing RIGHT, jaws wide open in an attack roar, same head size and design as on the full body, the neck cut cleanly at its base with a flat edge. Nothing else in the image.
```

### `water/baby.png`: Малыш

```
High-end painterly fantasy creature art for a premium mobile strategy game, same art style as the attached reference image (rendering, scale detail, lighting), but NOT its colors or anatomy. Crisp detailed scales, clean readable silhouette, soft top-left key light with gentle rim light, rich but controlled colors. Isolated on a fully transparent background (PNG with alpha). No ground, no cast shadow, no text, no frame, no floating particles, leaves, sparks or drops around the creature. Landscape canvas 1536x1024. a long slim hatchling with big eyes, small fin crest and a little paddle tail: a baby version of the same WATER element dragon, same colors and features in a cute simplified form: big head, short legs, tiny wings folded on the back. Strict side profile facing RIGHT, standing, mouth closed. Spans about 60% of the canvas width.
```

## 3. Земля (папка `earth/`)

### `earth/body.png`: Тело без крыльев

```
High-end painterly fantasy creature art for a premium mobile strategy game, same art style as the attached reference image (rendering, scale detail, lighting), but NOT its colors or anatomy. Crisp detailed scales, clean readable silhouette, soft top-left key light with gentle rim light, rich but controlled colors. Isolated on a fully transparent background (PNG with alpha). No ground, no cast shadow, no text, no frame, no floating particles, leaves, sparks or drops around the creature. Landscape canvas 1536x1024. Full body of an adult EARTH element dragon WITHOUT ANY WINGS (wings removed, smooth shoulders with a small attachment socket where the wings would be). Anatomy: massive low heavy body, overlapping slate-grey and ochre stone armor plates, amber crystals growing from the back, short thick legs with blunt claws, blunt horned snout, the tail ends in a heavy rocky club. Strict side profile facing RIGHT, camera at chest height, standing on four legs in a calm neutral pose, all four legs visible and not overlapping each other, neck raised in an S-curve, mouth closed, tail extended straight back and fully visible. The dragon spans about 85% of the canvas width, feet on an imaginary line at 85% of the canvas height.
```

### `earth/wing.png`: Одно крыло

```
High-end painterly fantasy creature art for a premium mobile strategy game, same art style as the attached reference image (rendering, scale detail, lighting), but NOT its colors or anatomy. Crisp detailed scales, clean readable silhouette, soft top-left key light with gentle rim light, rich but controlled colors. Isolated on a fully transparent background (PNG with alpha). No ground, no cast shadow, no text, no frame, no floating particles, leaves, sparks or drops around the creature. Landscape canvas 1536x1024. A single detached wing of the same adult EARTH element dragon: short broad wing, bones like stone pillars, membrane covered with overlapping slate plates, a few amber crystals at the joint. Fully spread and flat, seen exactly from the side, the wing root (where it attaches to the shoulder) at the LEFT middle of the canvas, the wing reaches up and to the right. Nothing else in the image.
```

### `earth/head-attack.png`: Голова в атаке

```
High-end painterly fantasy creature art for a premium mobile strategy game, same art style as the attached reference image (rendering, scale detail, lighting), but NOT its colors or anatomy. Crisp detailed scales, clean readable silhouette, soft top-left key light with gentle rim light, rich but controlled colors. Isolated on a fully transparent background (PNG with alpha). No ground, no cast shadow, no text, no frame, no floating particles, leaves, sparks or drops around the creature. Landscape canvas 1536x1024. Head and neck of the same adult EARTH element dragon (massive low heavy body, overlapping slate-grey and ochre stone armor plates, amber crystals growing from the back, short thick legs with blunt claws, blunt horned snout, the tail ends in a heavy rocky club), strict side profile facing RIGHT, jaws wide open in an attack roar, same head size and design as on the full body, the neck cut cleanly at its base with a flat edge. Nothing else in the image.
```

### `earth/baby.png`: Малыш

```
High-end painterly fantasy creature art for a premium mobile strategy game, same art style as the attached reference image (rendering, scale detail, lighting), but NOT its colors or anatomy. Crisp detailed scales, clean readable silhouette, soft top-left key light with gentle rim light, rich but controlled colors. Isolated on a fully transparent background (PNG with alpha). No ground, no cast shadow, no text, no frame, no floating particles, leaves, sparks or drops around the creature. Landscape canvas 1536x1024. a chunky round hatchling with tiny stone plates on its back and a pebble club on the tail: a baby version of the same EARTH element dragon, same colors and features in a cute simplified form: big head, short legs, tiny wings folded on the back. Strict side profile facing RIGHT, standing, mouth closed. Spans about 60% of the canvas width.
```

## 4. Воздух (папка `air/`)

### `air/body.png`: Тело без крыльев

```
High-end painterly fantasy creature art for a premium mobile strategy game, same art style as the attached reference image (rendering, scale detail, lighting), but NOT its colors or anatomy. Crisp detailed scales, clean readable silhouette, soft top-left key light with gentle rim light, rich but controlled colors. Isolated on a fully transparent background (PNG with alpha). No ground, no cast shadow, no text, no frame, no floating particles, leaves, sparks or drops around the creature. Landscape canvas 1536x1024. Full body of an adult AIR element dragon WITHOUT ANY WINGS (wings removed, smooth shoulders with a small attachment socket where the wings would be). Anatomy: light agile long-necked body, white and pale sky-blue scales that turn into feathers on the neck and shoulders, feathered crest on the head, long thin tail ending in a fan of long feathers, narrow elegant head. Strict side profile facing RIGHT, camera at chest height, standing on four legs in a calm neutral pose, all four legs visible and not overlapping each other, neck raised in an S-curve, mouth closed, tail extended straight back and fully visible. The dragon spans about 85% of the canvas width, feet on an imaginary line at 85% of the canvas height.
```

### `air/wing.png`: Одно крыло

```
High-end painterly fantasy creature art for a premium mobile strategy game, same art style as the attached reference image (rendering, scale detail, lighting), but NOT its colors or anatomy. Crisp detailed scales, clean readable silhouette, soft top-left key light with gentle rim light, rich but controlled colors. Isolated on a fully transparent background (PNG with alpha). No ground, no cast shadow, no text, no frame, no floating particles, leaves, sparks or drops around the creature. Landscape canvas 1536x1024. A single detached wing of the same adult AIR element dragon: huge feathered bird-like wing, long white primary feathers with sky-blue tips, soft layered coverts. Fully spread and flat, seen exactly from the side, the wing root (where it attaches to the shoulder) at the LEFT middle of the canvas, the wing reaches up and to the right. Nothing else in the image.
```

### `air/head-attack.png`: Голова в атаке

```
High-end painterly fantasy creature art for a premium mobile strategy game, same art style as the attached reference image (rendering, scale detail, lighting), but NOT its colors or anatomy. Crisp detailed scales, clean readable silhouette, soft top-left key light with gentle rim light, rich but controlled colors. Isolated on a fully transparent background (PNG with alpha). No ground, no cast shadow, no text, no frame, no floating particles, leaves, sparks or drops around the creature. Landscape canvas 1536x1024. Head and neck of the same adult AIR element dragon (light agile long-necked body, white and pale sky-blue scales that turn into feathers on the neck and shoulders, feathered crest on the head, long thin tail ending in a fan of long feathers, narrow elegant head), strict side profile facing RIGHT, jaws wide open in an attack roar, same head size and design as on the full body, the neck cut cleanly at its base with a flat edge. Nothing else in the image.
```

### `air/baby.png`: Малыш

```
High-end painterly fantasy creature art for a premium mobile strategy game, same art style as the attached reference image (rendering, scale detail, lighting), but NOT its colors or anatomy. Crisp detailed scales, clean readable silhouette, soft top-left key light with gentle rim light, rich but controlled colors. Isolated on a fully transparent background (PNG with alpha). No ground, no cast shadow, no text, no frame, no floating particles, leaves, sparks or drops around the creature. Landscape canvas 1536x1024. a fluffy hatchling covered in white down with a little feather crest: a baby version of the same AIR element dragon, same colors and features in a cute simplified form: big head, short legs, tiny wings folded on the back. Strict side profile facing RIGHT, standing, mouth closed. Spans about 60% of the canvas width.
```

## 5. Флора (папка `flora/`)

### `flora/body.png`: Тело без крыльев

```
High-end painterly fantasy creature art for a premium mobile strategy game, same art style as the attached reference image (rendering, scale detail, lighting), but NOT its colors or anatomy. Crisp detailed scales, clean readable silhouette, soft top-left key light with gentle rim light, rich but controlled colors. Isolated on a fully transparent background (PNG with alpha). No ground, no cast shadow, no text, no frame, no floating particles, leaves, sparks or drops around the creature. Landscape canvas 1536x1024. Full body of an adult FLORA (plant) element dragon WITHOUT ANY WINGS (wings removed, smooth shoulders with a small attachment socket where the wings would be). Anatomy: body covered in bark-like brown scales and moss, antler-like branching horns, vines wrapping the legs and neck, small white flowers growing on the shoulders and back, the tail ends in a leafy frond. Strict side profile facing RIGHT, camera at chest height, standing on four legs in a calm neutral pose, all four legs visible and not overlapping each other, neck raised in an S-curve, mouth closed, tail extended straight back and fully visible. The dragon spans about 85% of the canvas width, feet on an imaginary line at 85% of the canvas height.
```

### `flora/wing.png`: Одно крыло

```
High-end painterly fantasy creature art for a premium mobile strategy game, same art style as the attached reference image (rendering, scale detail, lighting), but NOT its colors or anatomy. Crisp detailed scales, clean readable silhouette, soft top-left key light with gentle rim light, rich but controlled colors. Isolated on a fully transparent background (PNG with alpha). No ground, no cast shadow, no text, no frame, no floating particles, leaves, sparks or drops around the creature. Landscape canvas 1536x1024. A single detached wing of the same adult FLORA (plant) element dragon: wing made of one huge veined leaf on a branch-like bone, fresh green with warm yellow light through it, a few flowers at the joint. Fully spread and flat, seen exactly from the side, the wing root (where it attaches to the shoulder) at the LEFT middle of the canvas, the wing reaches up and to the right. Nothing else in the image.
```

### `flora/head-attack.png`: Голова в атаке

```
High-end painterly fantasy creature art for a premium mobile strategy game, same art style as the attached reference image (rendering, scale detail, lighting), but NOT its colors or anatomy. Crisp detailed scales, clean readable silhouette, soft top-left key light with gentle rim light, rich but controlled colors. Isolated on a fully transparent background (PNG with alpha). No ground, no cast shadow, no text, no frame, no floating particles, leaves, sparks or drops around the creature. Landscape canvas 1536x1024. Head and neck of the same adult FLORA (plant) element dragon (body covered in bark-like brown scales and moss, antler-like branching horns, vines wrapping the legs and neck, small white flowers growing on the shoulders and back, the tail ends in a leafy frond), strict side profile facing RIGHT, jaws wide open in an attack roar, same head size and design as on the full body, the neck cut cleanly at its base with a flat edge. Nothing else in the image.
```

### `flora/baby.png`: Малыш

```
High-end painterly fantasy creature art for a premium mobile strategy game, same art style as the attached reference image (rendering, scale detail, lighting), but NOT its colors or anatomy. Crisp detailed scales, clean readable silhouette, soft top-left key light with gentle rim light, rich but controlled colors. Isolated on a fully transparent background (PNG with alpha). No ground, no cast shadow, no text, no frame, no floating particles, leaves, sparks or drops around the creature. Landscape canvas 1536x1024. a small hatchling with moss on its back, two tiny leaf sprouts instead of horns and a little leaf on the tail: a baby version of the same FLORA (plant) element dragon, same colors and features in a cute simplified form: big head, short legs, tiny wings folded on the back. Strict side profile facing RIGHT, standing, mouth closed. Spans about 60% of the canvas width.
```

## 6. Свет (папка `light/`)

### `light/body.png`: Тело без крыльев

```
High-end painterly fantasy creature art for a premium mobile strategy game, same art style as the attached reference image (rendering, scale detail, lighting), but NOT its colors or anatomy. Crisp detailed scales, clean readable silhouette, soft top-left key light with gentle rim light, rich but controlled colors. Isolated on a fully transparent background (PNG with alpha). No ground, no cast shadow, no text, no frame, no floating particles, leaves, sparks or drops around the creature. Landscape canvas 1536x1024. Full body of an adult LIGHT element dragon WITHOUT ANY WINGS (wings removed, smooth shoulders with a small attachment socket where the wings would be). Anatomy: graceful slender body, ivory and gold scales, a glowing halo ring floating behind the head, crystal horns, golden ray-like spines along the back, the tail ends in a radiant crystal. Strict side profile facing RIGHT, camera at chest height, standing on four legs in a calm neutral pose, all four legs visible and not overlapping each other, neck raised in an S-curve, mouth closed, tail extended straight back and fully visible. The dragon spans about 85% of the canvas width, feet on an imaginary line at 85% of the canvas height.
```

### `light/wing.png`: Одно крыло

```
High-end painterly fantasy creature art for a premium mobile strategy game, same art style as the attached reference image (rendering, scale detail, lighting), but NOT its colors or anatomy. Crisp detailed scales, clean readable silhouette, soft top-left key light with gentle rim light, rich but controlled colors. Isolated on a fully transparent background (PNG with alpha). No ground, no cast shadow, no text, no frame, no floating particles, leaves, sparks or drops around the creature. Landscape canvas 1536x1024. A single detached wing of the same adult LIGHT element dragon: wing of luminous translucent golden membrane, ray-like golden spines instead of bones, soft inner glow. Fully spread and flat, seen exactly from the side, the wing root (where it attaches to the shoulder) at the LEFT middle of the canvas, the wing reaches up and to the right. Nothing else in the image.
```

### `light/head-attack.png`: Голова в атаке

```
High-end painterly fantasy creature art for a premium mobile strategy game, same art style as the attached reference image (rendering, scale detail, lighting), but NOT its colors or anatomy. Crisp detailed scales, clean readable silhouette, soft top-left key light with gentle rim light, rich but controlled colors. Isolated on a fully transparent background (PNG with alpha). No ground, no cast shadow, no text, no frame, no floating particles, leaves, sparks or drops around the creature. Landscape canvas 1536x1024. Head and neck of the same adult LIGHT element dragon (graceful slender body, ivory and gold scales, a glowing halo ring floating behind the head, crystal horns, golden ray-like spines along the back, the tail ends in a radiant crystal), strict side profile facing RIGHT, jaws wide open in an attack roar, same head size and design as on the full body, the neck cut cleanly at its base with a flat edge. Nothing else in the image.
```

### `light/baby.png`: Малыш

```
High-end painterly fantasy creature art for a premium mobile strategy game, same art style as the attached reference image (rendering, scale detail, lighting), but NOT its colors or anatomy. Crisp detailed scales, clean readable silhouette, soft top-left key light with gentle rim light, rich but controlled colors. Isolated on a fully transparent background (PNG with alpha). No ground, no cast shadow, no text, no frame, no floating particles, leaves, sparks or drops around the creature. Landscape canvas 1536x1024. a slim hatchling with ivory scales, a tiny faint halo and little crystal horns: a baby version of the same LIGHT element dragon, same colors and features in a cute simplified form: big head, short legs, tiny wings folded on the back. Strict side profile facing RIGHT, standing, mouth closed. Spans about 60% of the canvas width.
```

## 7. Тьма (папка `dark/`)

### `dark/body.png`: Тело без крыльев

```
High-end painterly fantasy creature art for a premium mobile strategy game, same art style as the attached reference image (rendering, scale detail, lighting), but NOT its colors or anatomy. Crisp detailed scales, clean readable silhouette, soft top-left key light with gentle rim light, rich but controlled colors. Isolated on a fully transparent background (PNG with alpha). No ground, no cast shadow, no text, no frame, no floating particles, leaves, sparks or drops around the creature. Landscape canvas 1536x1024. Full body of an adult DARK (shadow) element dragon WITHOUT ANY WINGS (wings removed, smooth shoulders with a small attachment socket where the wings would be). Anatomy: gaunt angular body, black and deep violet scales, many sharp spines on the neck and back, glowing violet eyes, whip-like barbed tail, thin shadow wisps rising from the back. Strict side profile facing RIGHT, camera at chest height, standing on four legs in a calm neutral pose, all four legs visible and not overlapping each other, neck raised in an S-curve, mouth closed, tail extended straight back and fully visible. The dragon spans about 85% of the canvas width, feet on an imaginary line at 85% of the canvas height.
```

### `dark/wing.png`: Одно крыло

```
High-end painterly fantasy creature art for a premium mobile strategy game, same art style as the attached reference image (rendering, scale detail, lighting), but NOT its colors or anatomy. Crisp detailed scales, clean readable silhouette, soft top-left key light with gentle rim light, rich but controlled colors. Isolated on a fully transparent background (PNG with alpha). No ground, no cast shadow, no text, no frame, no floating particles, leaves, sparks or drops around the creature. Landscape canvas 1536x1024. A single detached wing of the same adult DARK (shadow) element dragon: tattered smoky wing with holes in the black membrane, violet glow along the bones, edges dissolving into smoke. Fully spread and flat, seen exactly from the side, the wing root (where it attaches to the shoulder) at the LEFT middle of the canvas, the wing reaches up and to the right. Nothing else in the image.
```

### `dark/head-attack.png`: Голова в атаке

```
High-end painterly fantasy creature art for a premium mobile strategy game, same art style as the attached reference image (rendering, scale detail, lighting), but NOT its colors or anatomy. Crisp detailed scales, clean readable silhouette, soft top-left key light with gentle rim light, rich but controlled colors. Isolated on a fully transparent background (PNG with alpha). No ground, no cast shadow, no text, no frame, no floating particles, leaves, sparks or drops around the creature. Landscape canvas 1536x1024. Head and neck of the same adult DARK (shadow) element dragon (gaunt angular body, black and deep violet scales, many sharp spines on the neck and back, glowing violet eyes, whip-like barbed tail, thin shadow wisps rising from the back), strict side profile facing RIGHT, jaws wide open in an attack roar, same head size and design as on the full body, the neck cut cleanly at its base with a flat edge. Nothing else in the image.
```

### `dark/baby.png`: Малыш

```
High-end painterly fantasy creature art for a premium mobile strategy game, same art style as the attached reference image (rendering, scale detail, lighting), but NOT its colors or anatomy. Crisp detailed scales, clean readable silhouette, soft top-left key light with gentle rim light, rich but controlled colors. Isolated on a fully transparent background (PNG with alpha). No ground, no cast shadow, no text, no frame, no floating particles, leaves, sparks or drops around the creature. Landscape canvas 1536x1024. a skinny hatchling with big glowing violet eyes and soft little spines: a baby version of the same DARK (shadow) element dragon, same colors and features in a cute simplified form: big head, short legs, tiny wings folded on the back. Strict side profile facing RIGHT, standing, mouth closed. Spans about 60% of the canvas width.
```

## Правки (отправлять в том же чате)

- Фон не прозрачный: `Same image, but with a fully transparent background, PNG with alpha.`
- Повернулся не так: `Same dragon, but in a strict side profile facing right, camera at chest height.`
- Крылья появились на теле: `Same body, but remove the wings completely, leave smooth shoulders.`
- Лапы перекрываются: `Same dragon, but spread the legs so that all four legs are visible and do not overlap.`
- Обрезан край: `Same image, but zoom out a little so nothing is cut off, keep a margin on every side.`
- Частицы вокруг: `Same image, but remove all particles, leaves, sparks and drops around the creature.`
- Стиль уехал от эталона: `Closer to the reference style: same painterly rendering, scale detail and soft top-left lighting.`
- Слишком похоже на другую стихию: `Make the element read from the silhouette alone: exaggerate the shapes described for this element.`

## Что проверить перед тем, как класть в репозиторий

- Профиль вправо, свет слева сверху, как у эталона.
- У тела нет крыльев, у крыла нет тела, голова того же размера, что и на теле.
- Фон прозрачный, по краю нет белой или цветной каймы.
- Стихия узнаётся по одному силуэту.
