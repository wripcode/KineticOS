# KineticOS

WebGL canvas effects for Webflow and any HTML platform. Attribute-driven. Zero config to full control.

## Install via CDN

```html
<link rel="preconnect" href="https://cdn.jsdelivr.net">
<script async type="module"
  src="https://cdn.jsdelivr.net/npm/@kineticos/core@latest/dist/kineticos.min.js"
  kineticos
  ko-dots-shader>
</script>
```

## Getting started

Add the `kineticos` attribute to the script tag, then declare which effects you need with `ko-<effect>`:

| Effect | Script attribute | DOM usage |
|---|---|---|
| Dots shader | `ko-dots-shader` | `ko-effect="dots-shader"` |
| Image particle | `ko-image-particle` | `ko-effect="image-particle"` |

Place a `<div>` with `ko-effect` anywhere in your HTML:

```html
<div ko-effect="dots-shader" style="width: 100%; height: 400px;"></div>
```

Only the chunks you declare are fetched — unused effects cost zero bytes.

## Full attribute reference

See the [Attributes & Configuration Guide](https://github.com/wripcode/KineticOS/blob/main/dev-data/attributes-guide.md) for all available attributes, presets, physics controls, and advanced usage.

## License

MIT
