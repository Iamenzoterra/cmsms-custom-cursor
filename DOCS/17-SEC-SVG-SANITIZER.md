# SVG Sanitizer Documentation

**Version:** 5.6 (inherited from v5.5-SEC)
**File:** `assets/lib/custom-cursor/custom-cursor.js`
**Lines:** 10-115
**Function:** `sanitizeSvgHtml(html)`

---

## Purpose

Prevents XSS attacks via malicious SVG/HTML content in icon cursors.
Icon content comes from `data-cursor-icon` attribute which can be set via:
1. Elementor editor controls
2. postMessage from editor to preview iframe
3. Direct DOM manipulation

---

## How It Works

```
Input HTML → Parse to DOM → Recursive Sanitization → Output Safe HTML
```

1. **Parse**: Creates temporary `<div>`, sets `innerHTML`
2. **Sanitize**: Recursively processes all nodes:
   - Text nodes: KEPT (always safe)
   - Comment nodes: REMOVED
   - Element nodes: Check against whitelist
3. **Filter Elements**: Remove if tag not in whitelist
4. **Filter Attributes**: Remove if:
   - Matches dangerous pattern (`on*`, `javascript:`)
   - Not in safe attributes whitelist
   - Not `data-*` or `aria-*` prefix
5. **Sanitize Values**: Clean `style`, `href`, `src` attributes
6. **Output**: Return `innerHTML` of sanitized container

---

## CRITICAL: Case Sensitivity

**All whitelist entries MUST be lowercase!**

The sanitizer uses `toLowerCase()` for comparison:
```javascript
var tagName = node.tagName.toLowerCase();    // 'linearGradient' → 'lineargradient'
var attrName = attrs[i].name.toLowerCase();  // 'viewBox' → 'viewbox'
```

### Common Mistakes (DO NOT DO):
```javascript
// WRONG - will break SVG rendering:
var SAFE_SVG_TAGS = ['linearGradient', 'clipPath', 'foreignObject'];
var SAFE_ATTRS = ['viewBox', 'preserveAspectRatio', 'stdDeviation'];

// CORRECT:
var SAFE_SVG_TAGS = ['lineargradient', 'clippath', 'foreignobject'];
var SAFE_ATTRS = ['viewbox', 'preserveaspectratio', 'stddeviation'];
```

---

## Whitelisted Tags

### SVG Tags (47 total)
```
svg, path, g, circle, rect, line, polyline, polygon, ellipse,
text, tspan, textpath, defs, use, symbol, a,
clippath, mask, pattern, marker, image, switch, foreignobject,
lineargradient, radialgradient, stop, title, desc,
filter, feblend, feflood, fegaussianblur, feoffset, femerge,
femergenode, fecomposite, fecolormatrix, fedropshadow, feturbulence,
fediffuselighting, fespecularlighting, fepointlight, fespotlight,
fedistantlight, feimage, femorphology, fedisplacementmap, fetile,
feconvolvematrix
```

### HTML Tags (7 total)
```
i, span, div, em, strong, b, img
```

---

## Whitelisted Attributes

### Core Attributes
```
class, id, style, d, fill, stroke, opacity, transform
```

### Dimensions
```
width, height, x, y, x1, y1, x2, y2, cx, cy, r, rx, ry, points
```

### SVG-Specific
```
viewbox, xmlns, xmlns:xlink, preserveaspectratio
```

### Stroke Properties
```
stroke-width, stroke-linecap, stroke-linejoin, stroke-dasharray,
stroke-dashoffset, stroke-opacity
```

### Fill Properties
```
fill-opacity, fill-rule
```

### Gradient Attributes
```
gradientunits, gradienttransform, spreadmethod, fx, fy,
offset, stop-color, stop-opacity
```

### Pattern Attributes
```
patternunits, patterntransform, patterncontentunits
```

### Filter Attributes
```
filterunits, primitiveunits, color-interpolation-filters,
lighting-color, surfacescale, diffuseconstant, specularconstant,
specularexponent, kernelunitlength, basefrequency, numoctaves,
seed, stitchtiles, type, values, tablevalues, slope, intercept,
amplitude, exponent, k1, k2, k3, k4, operator, scale,
xchannelselector, ychannelselector, stddeviation, result, in, in2, mode,
flood-color, flood-opacity, azimuth, elevation,
pointsatx, pointsaty, pointsatz, limitingconeangle
```

### Marker Attributes
```
markerunits, markerwidth, markerheight, refx, refy, orient
```

### Text Attributes
```
font-family, font-size, font-weight, text-anchor,
dominant-baseline, alignment-baseline, letter-spacing, word-spacing,
textlength, lengthadjust, startoffset, method, spacing
```

### ClipPath/Mask Attributes
```
clip-path, clip-rule, clippathunits,
mask, maskunits, maskcontentunits
```

### Link Attributes
```
href, xlink:href (only # and data:image/ URLs allowed)
```

### Image Attributes
```
src, alt, loading, decoding
```

### Accessibility
```
aria-* (all allowed)
data-* (all allowed)
role, focusable
```

### Rendering
```
vector-effect, paint-order, color, display, visibility,
overflow, pointer-events, shape-rendering, image-rendering,
text-rendering, enable-background
```

### Misc
```
target, version, baseprofile, filter
```

---

## Blocked Content

### Dangerous Tags (removed entirely)
```
script, iframe, object, embed, form, input, button, textarea,
select, option, link, meta, base, style, template, slot,
frame, frameset, applet, noscript, plaintext, xmp
```

### Dangerous Attributes (removed)
```
- All on* event handlers (onclick, onerror, onload, onmouseover, etc.)
- href/xlink:href with non-# non-data:image/ URLs
- src with javascript: URLs
```

### Dangerous Style Values (sanitized)
```
- javascript: URLs
- expression() (IE CSS expressions)
- -moz-binding (Firefox XBL)
```

---

## Testing

### XSS Test Payloads (should all be blocked)
```javascript
// Script injection
'<script>alert("XSS")</script>'

// Event handler injection
'<img src=x onerror="alert(\'XSS\')">'
'<svg onload="alert(\'XSS\')"><circle r="10"/></svg>'
'<div onclick="alert(\'XSS\')">click me</div>'

// JavaScript URL injection
'<a href="javascript:alert(\'XSS\')">click</a>'
'<svg><use xlink:href="javascript:alert(\'XSS\')"/></svg>'

// CSS expression injection
'<div style="background:expression(alert(\'XSS\'))">test</div>'
'<div style="-moz-binding:url(evil.xml#xss)">test</div>'

// Iframe injection
'<iframe src="https://evil.com"></iframe>'
```

### Valid SVG Test (should be preserved)
```javascript
var svg = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
    '<defs>' +
    '<linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">' +
    '<stop offset="0%" stop-color="red"/>' +
    '<stop offset="100%" stop-color="blue"/>' +
    '</linearGradient>' +
    '</defs>' +
    '<circle cx="50" cy="50" r="40" fill="url(#grad)"/>' +
    '</svg>';

// After sanitization, should contain:
// - viewBox attribute (as viewbox internally)
// - linearGradient element (as lineargradient internally)
// - All stop elements with offset and stop-color
// - circle with fill referencing gradient
```

---

## Performance Considerations

- Sanitizer runs on every icon cursor creation/update
- Uses DOM parsing (creates temporary div)
- Recursive tree traversal
- For complex SVGs with many elements, may have slight overhead
- Caching not implemented (sanitizes every time)

---

## Future Improvements

1. **Caching**: Cache sanitized output by content hash
2. **Web Worker**: Move sanitization to worker for complex SVGs
3. **DOMPurify**: Consider using battle-tested library instead
4. **Configurable**: Allow extending whitelist via settings

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 5.5-SEC | Feb 5, 2026 | Initial implementation |
| 5.5-SEC | Feb 5, 2026 | Fixed case-sensitivity bug (lowercase all whitelists) |
| 5.5-SEC | Feb 5, 2026 | Added img tag, src attribute |
| 5.5-SEC | Feb 5, 2026 | Added 20+ filter element tags |
| 5.5-SEC | Feb 5, 2026 | Added 50+ gradient/filter/text attributes |
