# Chart.js version

This browser-only version mirrors the Plotly helper's chainable API and common data formats. It uses Chart.js from a CDN and does not require Node.js or a build step. Open [index.html](index.html), select [template.csv](template.csv), and the example chart will load from that file.

```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.9/dist/chart.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@sgratzl/chartjs-chart-boxplot@4.4.5/build/index.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-chart-matrix@3.1.0"></script>
<script src="./index.js"></script>
```

The helper is available as `chart()` and `chartjs`. It accepts arrays of records, column-oriented arrays, primitive series, Chart.js config objects, CSV strings, and JSON strings. CSV headers are used as field names; numeric, boolean, and `null` values are converted automatically. Quoted cells, escaped quotes, CRLF, and TSV are supported.

```js
const csv = `month,sales,costs\nJan,120,70\nFeb,160,85`;

const salesChart = chart(csv)
  .line({ x: "month", y: ["sales", "costs"] })
  .colors(["#14745c", "#e06b43"])
  .title("Monthly totals")
  .xlabel("Month")
  .ylabel("Amount")
  .layout({ interaction: { intersect: false, mode: "index" } });

salesChart.render("#chart");
salesChart.downloadImage("monthly-totals.png");
```

Built-in helpers include `.line()`, `.scatter()`, `.bar()`, `.area()`, `.pie()`, `.doughnut()`, `.histogram()`, `.box()`, `.violin()`, and `.heatmap()`. Use `.plot("chartjs-type", mapping)` for other Chart.js types or registered extensions. Histogram bins are generated from numeric values; box, violin, and heatmap use the included Chart.js plugins. Chart.js does not have exact one-to-one feature parity with Plotly, so specialized Plotly trace objects need to be expressed as Chart.js data/config instead.

For category summaries, `.groupBy("Genre").count("Subscription Type")` groups repeated genres and counts each subscription type. Numeric bars group duplicate x labels and sum by default. Choose a reduction explicitly with `.sum("Listeners")`, `.mean("Listeners")`, `.median("Listeners")`, `.min("Listeners")`, `.max("Listeners")`, `.range("Listeners")`, `.count("Listeners")`, `.std("Listeners")`, or `.var("Listeners")`. `.aggregate(method, field)` and `.agg(method, field)` are the generic forms. For example:

```js
chart(data)
  .groupBy("Genre")
  .sum("Listeners")
  .bar()
  .title("Total listeners by genre")
  .xlabel("Genre")
  .ylabel("Listeners")
  .render("#chart");
```

`.toConfig()` returns the Chart.js configuration without rendering. `.trace()`, `.layout()`, and `.config()` forward dataset options, Chart.js options, and top-level Chart.js config values respectively.

`chartjs.parseCSV(text, options)` and `chartjs.parseJSON(text)` parse data directly. Pass `{ format: "csv" }`, `{ format: "json" }`, or `{ format: "tsv" }` to `chart(text, options)` when auto-detection is not suitable. `await chartjs.fromFile(file)` reads a browser `File` or `Blob`, while `await chartjs.fromURL(url)` fetches a data file; both infer format from the filename/URL extension. Use `.colors("#14745c")` for one color or `.colors(["#14745c", "#e06b43"])` for a palette.

After rendering, call `.downloadImage("chart.png")` (or `.download(...)`) on the builder. `chartjs.downloadImage(chartInstance, "chart.png")` can also export an existing Chart.js chart or canvas. Browser security restrictions may prevent exporting charts that contain cross-origin images.