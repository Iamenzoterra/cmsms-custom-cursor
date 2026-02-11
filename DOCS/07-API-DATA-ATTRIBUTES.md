# Custom Cursor v5.5 - Data Attributes Reference

**Last Updated:** February 5, 2026

---

## Overview

Data attributes are applied to HTML elements to configure cursor behavior. They are set by PHP (module.php) based on Elementor widget settings and read by JavaScript (custom-cursor.js).

| Category | Attributes |
|----------|------------|
| Core | 4 |
| Image | 6 |
| Text | 10 |
| Icon | 12 |
| **Total** | **32** |

---

## Core Attributes

### data-cursor

**Purpose:** Define cursor hover behavior

| Value | Effect |
|-------|--------|
| `hide` | Hide cursor on hover |
| `none` | Hide cursor on hover (alias) |
| `hover` | Scale up on hover (enlarged style) |
| (empty/omit) | Use default |

```html
<div data-cursor="hover">Hover me</div>
<div data-cursor="hide">No cursor here</div>
```

**Set by:** `module.php:1082-1089` (core settings)
**Read by:** `custom-cursor.js:670,703,791,1847`

---

### data-cursor-color

**Purpose:** Override cursor color on hover

| Format | Example |
|--------|---------|
| Hex | `#ff0000` |
| Hex with alpha | `#ff000080` |

```html
<div data-cursor-color="#ff0000">Red cursor</div>
```

**Set by:** `module.php:1096-1099`
**Read by:** `custom-cursor.js:1058,1073,1085`

---

### data-cursor-blend

**Purpose:** Set blend mode intensity

| Value | Effect |
|-------|--------|
| `off` | Disable blend mode |
| `soft` | Exclusion blend (subtle) |
| `medium` | Difference blend (moderate) |
| `strong` | High contrast blend (intense) |
| `default` or (empty) | Use global setting |

```html
<div data-cursor-blend="medium">Blend mode</div>
```

**Set by:** `module.php:1103-1106` (core), `module.php:929-931` (image), `module.php:1184-1187` (text/icon)
**Read by:** `custom-cursor.js:1100,1139,1146,1154`

---

### data-cursor-effect

**Purpose:** Apply animation effect to cursor

| Value | Effect |
|-------|--------|
| `none` | No effect |
| `wobble` | Directional stretch on movement |
| `pulse` | Scale oscillation |
| `shake` | Horizontal wave |
| `buzz` | Rotation oscillation |
| (empty) | Use global setting |

```html
<div data-cursor-effect="wobble">Wobble effect</div>
```

**Set by:** `module.php:1109-1112`
**Read by:** `custom-cursor.js:793,1170-1172`

---

## Image Cursor Attributes

### data-cursor-image

**Purpose:** Display image as cursor

| Format | Description |
|--------|-------------|
| URL | Full or relative image path |

```html
<div data-cursor-image="https://example.com/cursor.png">Image cursor</div>
```

**Creates:** `<img class="cmsmasters-cursor-image-el">` element

**Set by:** `module.php:913`
**Read by:** `custom-cursor.js:704,752,828,1798`

---

### data-cursor-image-size

**Purpose:** Image size in normal state (pixels)

| Format | Default |
|--------|---------|
| Number | 32 |

```html
<div data-cursor-image="url.png" data-cursor-image-size="48">
```

**Set by:** `module.php:916`
**Read by:** `custom-cursor.js:829`

---

### data-cursor-image-size-hover

**Purpose:** Image size on hover (pixels)

| Format | Default |
|--------|---------|
| Number | Same as size |

```html
<div data-cursor-image="url.png"
     data-cursor-image-size="48"
     data-cursor-image-size-hover="64">
```

**Set by:** `module.php:917`
**Read by:** `custom-cursor.js:830`

---

### data-cursor-image-rotate

**Purpose:** Image rotation in normal state (degrees)

| Format | Default |
|--------|---------|
| Number | 0 |

```html
<div data-cursor-image="url.png" data-cursor-image-rotate="45">
```

**Set by:** `module.php:918`
**Read by:** `custom-cursor.js:831`

---

### data-cursor-image-rotate-hover

**Purpose:** Image rotation on hover (degrees)

| Format | Default |
|--------|---------|
| Number | Same as rotate |

```html
<div data-cursor-image="url.png"
     data-cursor-image-rotate="0"
     data-cursor-image-rotate-hover="15">
```

**Set by:** `module.php:919`
**Read by:** `custom-cursor.js:832`

---

### data-cursor-image-effect

**Purpose:** Apply animation effect to image cursor

| Value | Effect |
|-------|--------|
| `none` | No effect |
| `wobble` | Directional stretch |
| `pulse` | Scale oscillation |
| `shake` | Horizontal wave |
| `buzz` | Rotation oscillation |

```html
<div data-cursor-image="url.png" data-cursor-image-effect="wobble">
```

**Set by:** `module.php:922-925`
**Read by:** `custom-cursor.js:833`

---

## Text Cursor Attributes

### data-cursor-text

**Purpose:** Display text as cursor

| Format | Description |
|--------|-------------|
| String | Text content |

```html
<div data-cursor-text="Click me">Text cursor</div>
```

**Creates:** `<span class="cmsmasters-cursor-text-el">` element with inner `<span class="cmsmasters-cursor-inner">`

**Set by:** `module.php:947`
**Read by:** `custom-cursor.js:705,753,892`

---

### data-cursor-text-typography

**Purpose:** Typography settings as JSON object

| Format | Description |
|--------|-------------|
| JSON string | Object with typography properties |

**JSON Properties:**

| Property | Type | Example | Description |
|----------|------|---------|-------------|
| `font_family` | string | `"Roboto"` | Font family name |
| `font_size` | number | `14` | Font size value |
| `font_size_unit` | string | `"px"` | Font size unit (px, em, rem) |
| `font_weight` | string/number | `"700"` | Font weight |
| `font_style` | string | `"italic"` | Font style (normal, italic, oblique) |
| `line_height` | number | `1.5` | Line height value |
| `line_height_unit` | string | `"em"` | Line height unit (px, em, or empty for unitless) |
| `letter_spacing` | number | `1` | Letter spacing value |
| `letter_spacing_unit` | string | `"px"` | Letter spacing unit |
| `word_spacing` | number | `2` | Word spacing value |
| `word_spacing_unit` | string | `"px"` | Word spacing unit |
| `text_transform` | string | `"uppercase"` | Text transform (uppercase, lowercase, capitalize) |
| `text_decoration` | string | `"underline"` | Text decoration |

```html
<div data-cursor-text="Hello"
     data-cursor-text-typography='{"font_family":"Roboto","font_size":14,"font_size_unit":"px","font_weight":"700","font_style":"italic"}'>
```

**Set by:** `module.php:974-991`
**Read by:** `custom-cursor.js:895-901,363-376`

---

### data-cursor-text-color

**Purpose:** Text color

| Format | Default |
|--------|---------|
| Hex | `#000000` |

```html
<div data-cursor-text="Hello" data-cursor-text-color="#ffffff">
```

**Set by:** `module.php:994-997`
**Read by:** `custom-cursor.js:906`

---

### data-cursor-text-bg

**Purpose:** Background color

| Format | Default |
|--------|---------|
| Hex | `#ffffff` |

```html
<div data-cursor-text="Hello"
     data-cursor-text-color="#ffffff"
     data-cursor-text-bg="#000000">
```

**Set by:** `module.php:999-1002`
**Read by:** `custom-cursor.js:907`

---

### data-cursor-text-circle

**Purpose:** Enable auto-fit circle mode (calculates padding to inscribe text in perfect circle)

| Value | Effect |
|-------|--------|
| `yes` | Auto-calculate circular layout |

```html
<div data-cursor-text="SCROLL DOWN"
     data-cursor-text-circle="yes">
```

**Note:** When enabled, `data-cursor-text-radius` and `data-cursor-text-padding` are ignored. Circle diameter is calculated from text diagonal.

**Set by:** `module.php:1006-1007`
**Read by:** `custom-cursor.js:910`

---

### data-cursor-text-circle-spacing

**Purpose:** Extra inner spacing around text before circle calculation (pixels)

| Format | Default |
|--------|---------|
| Number | 10 |

```html
<div data-cursor-text="SCROLL"
     data-cursor-text-circle="yes"
     data-cursor-text-circle-spacing="15">
```

**Set by:** `module.php:1008`
**Read by:** `custom-cursor.js:911`

---

### data-cursor-text-radius

**Purpose:** Border radius (CSS shorthand format)

| Format | Example |
|--------|---------|
| CSS string | `10px 10px 10px 10px` |

**Note:** Only used when `data-cursor-text-circle` is not set to `yes`.

```html
<div data-cursor-text="Hello"
     data-cursor-text-radius="10px 10px 10px 10px">
```

**Set by:** `module.php:1010,1148-1155`
**Read by:** `custom-cursor.js:908,415`

---

### data-cursor-text-padding

**Purpose:** Padding (CSS shorthand format)

| Format | Example |
|--------|---------|
| CSS string | `10px 15px 10px 15px` |

**Note:** Only used when `data-cursor-text-circle` is not set to `yes`.

```html
<div data-cursor-text="Hello"
     data-cursor-text-padding="10px 15px 10px 15px">
```

**Set by:** `module.php:1010,1158-1167`
**Read by:** `custom-cursor.js:909,416`

---

### data-cursor-text-effect

**Purpose:** Apply animation effect to text cursor

| Value | Effect |
|-------|--------|
| `none` | No effect |
| `wobble` | Directional stretch |
| `pulse` | Scale oscillation |
| `shake` | Horizontal wave |
| `buzz` | Rotation oscillation |

```html
<div data-cursor-text="Hello" data-cursor-text-effect="pulse">
```

**Set by:** `module.php:1014`
**Read by:** `custom-cursor.js:912`

---

## Icon Cursor Attributes

### data-cursor-icon

**Purpose:** Display icon as cursor

| Format | Description |
|--------|-------------|
| HTML string | Icon markup (Font Awesome, SVG img tag, etc.) |

```html
<div data-cursor-icon='<i class="fas fa-arrow-right"></i>'>
```

For SVG icons:
```html
<div data-cursor-icon='<img src="icon.svg" alt="" />'>
```

**Creates:** `<span class="cmsmasters-cursor-icon-el">` element

**Set by:** `module.php:1030-1038`
**Read by:** `custom-cursor.js:706,754,973,1807`

---

### data-cursor-icon-color

**Purpose:** Icon color

| Format | Default |
|--------|---------|
| Hex | `#000000` |

**Note:** Ignored when `data-cursor-icon-preserve="yes"`

```html
<div data-cursor-icon='<i class="fas fa-arrow"></i>'
     data-cursor-icon-color="#ffffff">
```

**Set by:** `module.php:1046-1047`
**Read by:** `custom-cursor.js:977`

---

### data-cursor-icon-bg

**Purpose:** Background color

| Format | Default |
|--------|---------|
| Hex | `#ffffff` |

```html
<div data-cursor-icon='<i class="fas fa-arrow"></i>'
     data-cursor-icon-bg="#000000">
```

**Set by:** `module.php:1050-1051`
**Read by:** `custom-cursor.js:978`

---

### data-cursor-icon-preserve

**Purpose:** Preserve original icon colors (for multicolor icons, emojis, or colored SVGs)

| Value | Effect |
|-------|--------|
| `yes` | Don't override icon/SVG colors |

```html
<div data-cursor-icon='<img src="colorful-emoji.svg" />'
     data-cursor-icon-preserve="yes">
```

**Set by:** `module.php:1043-1044`
**Read by:** `custom-cursor.js:979`

---

### data-cursor-icon-size

**Purpose:** Icon container size in normal state (pixels)

| Format | Default |
|--------|---------|
| Number | 32 |

```html
<div data-cursor-icon='<i class="fas fa-arrow"></i>'
     data-cursor-icon-size="40">
```

**Set by:** `module.php:1054`
**Read by:** `custom-cursor.js:980`

---

### data-cursor-icon-size-hover

**Purpose:** Icon size on hover (pixels)

| Format | Default |
|--------|---------|
| Number | 48 |

```html
<div data-cursor-icon='<i class="fas fa-arrow"></i>'
     data-cursor-icon-size="32"
     data-cursor-icon-size-hover="48">
```

**Set by:** `module.php:1056`
**Read by:** `custom-cursor.js:981`

---

### data-cursor-icon-rotate

**Purpose:** Icon rotation in normal state (degrees)

| Format | Default |
|--------|---------|
| Number | 0 |

```html
<div data-cursor-icon='<i class="fas fa-arrow"></i>'
     data-cursor-icon-rotate="45">
```

**Set by:** `module.php:1055`
**Read by:** `custom-cursor.js:982`

---

### data-cursor-icon-rotate-hover

**Purpose:** Icon rotation on hover (degrees)

| Format | Default |
|--------|---------|
| Number | Same as rotate |

```html
<div data-cursor-icon='<i class="fas fa-arrow"></i>'
     data-cursor-icon-rotate="0"
     data-cursor-icon-rotate-hover="90">
```

**Set by:** `module.php:1057`
**Read by:** `custom-cursor.js:983`

---

### data-cursor-icon-circle

**Purpose:** Enable circular background (border-radius: 50%)

| Value | Effect |
|-------|--------|
| `yes` | Circular container shape |

```html
<div data-cursor-icon='<i class="fas fa-arrow"></i>'
     data-cursor-icon-bg="#000000"
     data-cursor-icon-circle="yes">
```

**Set by:** `module.php:1061-1062`
**Read by:** `custom-cursor.js:984`

---

### data-cursor-icon-circle-spacing

**Purpose:** Extra inner spacing around icon in circle mode (pixels)

| Format | Default |
|--------|---------|
| Number | 10 |

```html
<div data-cursor-icon='<i class="fas fa-arrow"></i>'
     data-cursor-icon-circle="yes"
     data-cursor-icon-circle-spacing="15">
```

**Set by:** `module.php:1063`
**Read by:** `custom-cursor.js:985`

---

### data-cursor-icon-radius

**Purpose:** Border radius (CSS shorthand format)

| Format | Example |
|--------|---------|
| CSS string | `8px 8px 8px 8px` |

**Note:** Only used when `data-cursor-icon-circle` is not set to `yes`.

```html
<div data-cursor-icon='<i class="fas fa-arrow"></i>'
     data-cursor-icon-radius="8px 8px 8px 8px">
```

**Set by:** `module.php:1065,1148-1155`
**Read by:** `custom-cursor.js:986`

---

### data-cursor-icon-padding

**Purpose:** Padding (CSS shorthand format)

| Format | Example |
|--------|---------|
| CSS string | `8px 8px 8px 8px` |

**Note:** Only used when `data-cursor-icon-circle` is not set to `yes`.

```html
<div data-cursor-icon='<i class="fas fa-arrow"></i>'
     data-cursor-icon-padding="8px 8px 8px 8px">
```

**Set by:** `module.php:1065,1158-1167`
**Read by:** `custom-cursor.js:987`

---

### data-cursor-icon-effect

**Purpose:** Apply animation effect to icon cursor

| Value | Effect |
|-------|--------|
| `none` | No effect |
| `wobble` | Directional stretch |
| `pulse` | Scale oscillation |
| `shake` | Horizontal wave |
| `buzz` | Rotation oscillation |

```html
<div data-cursor-icon='<i class="fas fa-arrow"></i>' data-cursor-icon-effect="wobble">
```

**Set by:** `module.php:1069`
**Read by:** `custom-cursor.js:988`

---

## Inheritance Rules

### Priority (Highest to Lowest)

1. Direct element attributes
2. Parent element attributes (with boundary)
3. Global defaults

### Widget Boundary

Inheritance stops at widget boundary (`data-id` attribute). This prevents cursor settings from leaking across unrelated Elementor widgets.

```html
<!-- GRANDPARENT: data-cursor-color="#red" -->
<section data-id="abc" data-cursor="hover" data-cursor-color="#red">

    <!-- PARENT: overrides with #blue -->
    <div data-id="def" data-cursor-color="#blue">

        <!-- CHILD: inherits #blue from PARENT, not #red from GRANDPARENT -->
        <div>Child inherits #blue</div>

    </div>
</section>
```

### findWithBoundary Algorithm

The JS uses `findWithBoundary()` to traverse up the DOM, stopping at `data-id` boundaries:

```javascript
function findWithBoundary(el, attrName, exclusions) {
    var current = el.parentElement;
    while (current && current !== document.body) {
        if (current.getAttribute(attrName)) {
            // Check exclusions (for data-cursor, exclude special cursor elements)
            if (exclusions) {
                var hasExclusion = false;
                for (var i = 0; i < exclusions.length; i++) {
                    if (current.getAttribute(exclusions[i])) {
                        hasExclusion = true;
                        break;
                    }
                }
                if (hasExclusion) {
                    current = current.parentElement;
                    continue;
                }
            }
            return current;
        }
        if (current.getAttribute('data-id')) break;  // Widget boundary
        current = current.parentElement;
    }
    return null;
}
```

---

## Complete Examples

### Image Cursor (Full)

```html
<div class="elementor-widget"
     data-id="abc123"
     data-cursor-image="https://example.com/arrow.png"
     data-cursor-image-size="48"
     data-cursor-image-size-hover="64"
     data-cursor-image-rotate="0"
     data-cursor-image-rotate-hover="15"
     data-cursor-image-effect="wobble"
     data-cursor-blend="medium">

    Widget content

</div>
```

### Text Cursor (Circle Mode)

```html
<div class="elementor-widget"
     data-id="def456"
     data-cursor-text="EXPLORE"
     data-cursor-text-typography='{"font_family":"Roboto","font_size":12,"font_size_unit":"px","font_weight":"600","text_transform":"uppercase"}'
     data-cursor-text-color="#ffffff"
     data-cursor-text-bg="#000000"
     data-cursor-text-circle="yes"
     data-cursor-text-circle-spacing="15"
     data-cursor-text-effect="pulse"
     data-cursor-blend="soft">

    Widget content

</div>
```

### Text Cursor (Manual Mode)

```html
<div class="elementor-widget"
     data-id="ghi789"
     data-cursor-text="Click"
     data-cursor-text-typography='{"font_family":"Arial","font_size":14,"font_size_unit":"px","font_weight":"700","font_style":"italic"}'
     data-cursor-text-color="#000000"
     data-cursor-text-bg="#ffffff"
     data-cursor-text-radius="10px 10px 10px 10px"
     data-cursor-text-padding="8px 16px 8px 16px">

    Widget content

</div>
```

### Icon Cursor (Circle Mode)

```html
<div class="elementor-widget"
     data-id="jkl012"
     data-cursor-icon='<i class="fas fa-arrow-right" aria-hidden="true"></i>'
     data-cursor-icon-color="#ffffff"
     data-cursor-icon-bg="#000000"
     data-cursor-icon-size="32"
     data-cursor-icon-size-hover="48"
     data-cursor-icon-rotate="0"
     data-cursor-icon-rotate-hover="0"
     data-cursor-icon-circle="yes"
     data-cursor-icon-circle-spacing="10"
     data-cursor-icon-effect="pulse"
     data-cursor-blend="medium">

    Widget content

</div>
```

### Icon Cursor (Manual Mode with Preserved Colors)

```html
<div class="elementor-widget"
     data-id="mno345"
     data-cursor-icon='<img src="emoji.svg" alt="" />'
     data-cursor-icon-preserve="yes"
     data-cursor-icon-bg="transparent"
     data-cursor-icon-size="40"
     data-cursor-icon-size-hover="48"
     data-cursor-icon-radius="8px 8px 8px 8px"
     data-cursor-icon-padding="4px 4px 4px 4px">

    Widget content

</div>
```

### Core Cursor (Hide)

```html
<div class="elementor-widget"
     data-id="pqr678"
     data-cursor="hide">

    System cursor only here

</div>
```

### Core Cursor (Enlarged with Color Override)

```html
<div class="elementor-widget"
     data-id="stu901"
     data-cursor="hover"
     data-cursor-color="#ff0000"
     data-cursor-blend="strong"
     data-cursor-effect="wobble">

    Red enlarged cursor with wobble

</div>
```

---

## Attribute Summary Table

| Attribute | Type | Values/Format | Default |
|-----------|------|---------------|---------|
| **Core** ||||
| `data-cursor` | string | `hide`, `none`, `hover` | - |
| `data-cursor-color` | hex | `#RRGGBB`, `#RRGGBBAA` | inherit |
| `data-cursor-blend` | string | `off`, `soft`, `medium`, `strong`, `default` | global |
| `data-cursor-effect` | string | `none`, `wobble`, `pulse`, `shake`, `buzz` | global |
| **Image** ||||
| `data-cursor-image` | url | Image URL | - |
| `data-cursor-image-size` | number | pixels | 32 |
| `data-cursor-image-size-hover` | number | pixels | size |
| `data-cursor-image-rotate` | number | degrees | 0 |
| `data-cursor-image-rotate-hover` | number | degrees | rotate |
| `data-cursor-image-effect` | string | `none`, `wobble`, `pulse`, `shake`, `buzz` | - |
| **Text** ||||
| `data-cursor-text` | string | Text content | - |
| `data-cursor-text-typography` | json | `{"font_family":"...", ...}` | `{}` |
| `data-cursor-text-color` | hex | `#RRGGBB` | `#000000` |
| `data-cursor-text-bg` | hex | `#RRGGBB` | `#ffffff` |
| `data-cursor-text-circle` | string | `yes` | - |
| `data-cursor-text-circle-spacing` | number | pixels | 10 |
| `data-cursor-text-radius` | css | `10px 10px 10px 10px` | `150px` |
| `data-cursor-text-padding` | css | `10px 10px 10px 10px` | `10px` |
| `data-cursor-text-effect` | string | `none`, `wobble`, `pulse`, `shake`, `buzz` | - |
| **Icon** ||||
| `data-cursor-icon` | html | `<i class="..."></i>` or `<img src="..." />` | - |
| `data-cursor-icon-color` | hex | `#RRGGBB` | `#000000` |
| `data-cursor-icon-bg` | hex | `#RRGGBB` | `#ffffff` |
| `data-cursor-icon-preserve` | string | `yes` | - |
| `data-cursor-icon-size` | number | pixels | 32 |
| `data-cursor-icon-size-hover` | number | pixels | 48 |
| `data-cursor-icon-rotate` | number | degrees | 0 |
| `data-cursor-icon-rotate-hover` | number | degrees | rotate |
| `data-cursor-icon-circle` | string | `yes` | - |
| `data-cursor-icon-circle-spacing` | number | pixels | 10 |
| `data-cursor-icon-radius` | css | `8px 8px 8px 8px` | - |
| `data-cursor-icon-padding` | css | `8px 8px 8px 8px` | - |
| `data-cursor-icon-effect` | string | `none`, `wobble`, `pulse`, `shake`, `buzz` | - |

---

## See Also

- [JAVASCRIPT-API.md](JAVASCRIPT-API.md) - JS detection logic
- [PHP-API.md](PHP-API.md) - Attribute application in module.php
- [CSS-API.md](CSS-API.md) - Styling classes

---

*Last Updated: February 5, 2026 | Version: 5.5*
