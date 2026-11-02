# chartgenfunc

A browser-only chart helper powered by Plotly.js. No Node.js or build step is required. Open [index.html](index.html) to see the example, or include the scripts in your own page:

For the Chart.js alternative, see the [Chart.js README](chartjsversion/README.md) or open the [Chart.js demo](chartjsversion/index.html).

```html
<script src="https://cdn.plot.ly/plotly-3.1.0.min.js"></script>
<script src="./index.js"></script>
```

The helper is available globally as `chart()` and `chartgenfunc`.

## Data formats

- An array of records, such as `[{ day: "Mon", visitors: 20 }]`.
- Column-oriented arrays, such as `{ day: ["Mon"], visitors: [20] }`.
- A primitive series, such as `[3, 5, 8]`.
- Plotly trace objects for specialized charts such as candlestick or 3D charts.

## API

Choose a built-in chart with `.line()`, `.scatter()`, `.bar()`, `.area()`, `.pie()`, `.histogram()`, `.box()`, `.violin()`, or `.heatmap()`. Each accepts field mappings; `.plot("plotly-type", mapping)` also accepts any Plotly trace type.

```js
chart(data)
  .plot("bar", { x: "category", y: ["current", "previous"] })
  .trace({ opacity: 0.8 })
  .layout({ barmode: "group" })
  .config({ responsive: true })
  .render(document.querySelector("#chart"));
```

Use `.x()`, `.y()`, `.labels()`, and `.values()` to set mappings individually. `.toFigure()` returns `{ data, layout, config }` without rendering. `chartgenfunc.buildFigure(data, settings)` provides the same conversion as a standalone function. `render()` accepts a DOM element or selector and returns Plotly's render promise.

Specialized Plotly trace objects are passed through as-is, so they can be used for chart types that need domain-specific fields. The `trace()`, `layout()`, and `config()` methods forward Plotly options.