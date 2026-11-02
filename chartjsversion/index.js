((global) => {
  "use strict";

  const CHART_TYPES = {
    line: "line",
    scatter: "scatter",
    area: "line",
    bar: "bar",
    pie: "pie",
    doughnut: "doughnut",
    radar: "radar",
    polarArea: "polarArea",
    bubble: "bubble",
    histogram: "bar",
    box: "boxplot",
    boxplot: "boxplot",
    violin: "violin",
    heatmap: "matrix",
  };
  const DEFAULT_COLORS = ["#14745c", "#e06b43", "#3767a5", "#c89b26", "#8a5ba6", "#3195a5"];

  const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

  function columns(data) {
    if (Array.isArray(data)) return Object.keys(data[0] ?? {});
    return Object.keys(data ?? {}).filter((key) => Array.isArray(data[key]));
  }

  function valuesFor(data, key) {
    if (Array.isArray(data)) return data.map((row) => row?.[key]);
    return data?.[key];
  }

  function resolve(data, source) {
    return typeof source === "string" && columns(data).includes(source)
      ? valuesFor(data, source)
      : source;
  }

  function coerceCSVValue(value) {
    const trimmed = value.trim();
    if (trimmed === "") return "";
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    if (trimmed === "null") return null;
    if (/^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(trimmed)) return Number(trimmed);
    return trimmed;
  }

  function parseCSV(text, options = {}) {
    const delimiter = options.delimiter ?? ",";
    if (typeof delimiter !== "string" || delimiter.length !== 1) {
      throw new Error("CSV delimiter must be a single character.");
    }

    const source = String(text).replace(/^\uFEFF/, "");
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;

    for (let index = 0; index < source.length; index += 1) {
      const character = source[index];
      if (quoted) {
        if (character === '"' && source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else if (character === '"') {
          quoted = false;
        } else {
          field += character;
        }
      } else if (character === '"' && field.length === 0) {
        quoted = true;
      } else if (character === delimiter) {
        row.push(field);
        field = "";
      } else if (character === "\n" || character === "\r") {
        if (character === "\r" && source[index + 1] === "\n") index += 1;
        row.push(field);
        if (row.some((cell) => cell.trim() !== "")) rows.push(row);
        row = [];
        field = "";
      } else {
        field += character;
      }
    }

    if (quoted) throw new Error("CSV contains an unterminated quoted field.");
    if (field !== "" || row.length > 0) {
      row.push(field);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
    }

    const dynamicTyping = options.dynamicTyping !== false;
    const convert = dynamicTyping ? coerceCSVValue : (value) => value;
    if (options.header === false) return rows.map((cells) => cells.map(convert));
    if (!rows.length) return [];

    const headers = rows.shift().map((header, index) => header.trim() || `column_${index + 1}`);
    rows.forEach((cells) => {
      while (cells.length > headers.length) headers.push(`column_${headers.length + 1}`);
    });
    return rows.map((cells) => Object.fromEntries(
      headers.map((header, index) => [header, convert(cells[index] ?? "")]),
    ));
  }

  function parseJSON(text) {
    return typeof text === "string" ? JSON.parse(text) : JSON.parse(JSON.stringify(text));
  }

  function parseData(input, options = {}) {
    if (typeof input !== "string") return input;
    const format = (options.format ?? "").toLowerCase().replace(/^\./, "");
    if (format === "json" || (!format && /^[\s\uFEFF]*[\[{]/.test(input))) return parseJSON(input);
    if (format && format !== "csv" && format !== "tsv") {
      throw new Error(`Unsupported data format: ${format}`);
    }
    return parseCSV(input, { ...options, delimiter: options.delimiter ?? (format === "tsv" ? "\t" : ",") });
  }

  function inferFormat(path) {
    const filename = String(path ?? "").split(/[?#]/, 1)[0].split("/").pop();
    const extensionIndex = filename.lastIndexOf(".");
    return extensionIndex > 0 ? filename.slice(extensionIndex + 1).toLowerCase() : undefined;
  }

  function sourceKeys(data, mapping, xKey) {
    if (mapping.y) return Array.isArray(mapping.y) ? mapping.y : [mapping.y];
    return columns(data).filter((key) => key !== xKey);
  }

  function aggregateValues(values, method = "sum") {
    const present = values.filter((value) => value !== null && value !== undefined && value !== "");
    if (method === "count") return present.length;
    const numbers = present.map(Number);
    if (numbers.some((value) => !Number.isFinite(value))) {
      throw new Error(`${method}() requires numeric values; use count() for categorical data.`);
    }
    if (!numbers.length) return method === "sum" ? 0 : null;

    const total = numbers.reduce((sum, value) => sum + value, 0);
    switch (method) {
      case "sum": return total;
      case "mean": return total / numbers.length;
      case "min": return Math.min(...numbers);
      case "max": return Math.max(...numbers);
      case "range": return Math.max(...numbers) - Math.min(...numbers);
      case "median": {
        const sorted = [...numbers].sort((a, b) => a - b);
        const middle = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
      }
      case "var":
      case "std": {
        if (numbers.length < 2) return null;
        const variance = numbers.reduce((sum, value) => sum + (value - total / numbers.length) ** 2, 0) / (numbers.length - 1);
        return method === "std" ? Math.sqrt(variance) : variance;
      }
      default: throw new Error(`Unknown aggregation: ${method}`);
    }
  }

  function getPalette(colors) {
    const palette = colors === undefined ? DEFAULT_COLORS : Array.isArray(colors) ? colors : [colors];
    return palette.length ? palette : DEFAULT_COLORS;
  }

  function colorDataset(dataset, index, settings, multiSegment = false) {
    const palette = getPalette(settings.colors);
    const color = palette[index % palette.length];
    return {
      ...dataset,
      backgroundColor: dataset.backgroundColor ?? (multiSegment ? palette : color),
      borderColor: dataset.borderColor ?? color,
    };
  }

  function downloadImage(chartOrCanvas, filename = "chart.png", options = {}) {
    const type = options.type ?? "image/png";
    const image = typeof chartOrCanvas?.toBase64Image === "function"
      ? chartOrCanvas.toBase64Image(type, options.quality)
      : chartOrCanvas?.toDataURL?.(type, options.quality);
    if (!image) throw new Error("Pass a rendered Chart.js chart or canvas to downloadImage().");
    if (!global.document) throw new Error("Image downloads are only available in a browser.");

    const extension = type === "image/jpeg" ? ".jpg" : ".png";
    const link = global.document.createElement("a");
    link.href = image;
    link.download = filename.includes(".") ? filename : `${filename}${extension}`;
    link.click();
    return image;
  }

  function makeDatasets(data, kind, mapping, settings) {
    const trace = { ...settings.trace };
    const xKey = mapping.x ?? columns(data)[0];
    const x = xKey ? valuesFor(data, xKey) : Array.isArray(data) ? data.map((_, index) => index) : undefined;
    const yKeys = sourceKeys(data, mapping, xKey);

    if (kind === "pie" || kind === "doughnut" || kind === "polarArea") {
      const labels = mapping.labels ? resolve(data, mapping.labels) : (data?.labels ?? x);
      const values = mapping.values ? resolve(data, mapping.values) : (data?.values ?? (yKeys[0] ? valuesFor(data, yKeys[0]) : data));
      return {
        labels,
        datasets: [colorDataset({ ...trace, label: trace.label ?? "Values", data: values }, 0, settings, true)],
      };
    }

    if (kind === "histogram") {
      const field = mapping.y ?? mapping.x ?? columns(data)[0];
      const source = Array.isArray(data) && !isRecord(data[0]) ? data : valuesFor(data, field);
      const numbers = (Array.isArray(source) ? source : [])
        .map(Number)
        .filter(Number.isFinite);
      const binCount = Math.max(1, Math.min(settings.bins ?? Math.ceil(Math.sqrt(numbers.length || 1)), 100));
      const min = numbers.length ? Math.min(...numbers) : 0;
      const max = numbers.length ? Math.max(...numbers) : 0;
      const width = numbers.length ? (max - min) / binCount || 1 : 1;
      const counts = Array(binCount).fill(0);
      numbers.forEach((value) => {
        counts[Math.min(Math.floor((value - min) / width), binCount - 1)] += 1;
      });
      const labels = counts.map((_, index) => {
        const start = min + index * width;
        const end = start + width;
        return `${start.toFixed(2)} - ${end.toFixed(2)}`;
      });
      return { labels, datasets: [colorDataset({ ...trace, label: trace.label ?? "Frequency", data: counts }, 0, settings, true)] };
    }

    if (kind === "heatmap") {
      const z = resolve(data, mapping.z);
      const xLabels = mapping.x ? resolve(data, mapping.x) : (Array.isArray(z?.[0]) ? z[0].map((_, index) => index) : []);
      const yLabels = mapping.y ? resolve(data, mapping.y) : (Array.isArray(z) ? z.map((_, index) => index) : []);
      const points = Array.isArray(z?.[0])
        ? z.flatMap((row, yIndex) => row.map((value, xIndex) => ({ x: xLabels[xIndex], y: yLabels[yIndex], v: value })))
        : (Array.isArray(z) && mapping.x && mapping.y
          ? z.map((value, index) => ({ x: xLabels[index], y: yLabels[index], v: value }))
          : []);
      const numericValues = points.map((point) => Number(point.v)).filter(Number.isFinite);
      const min = numericValues.length ? Math.min(...numericValues) : 0;
      const max = numericValues.length ? Math.max(...numericValues) : 1;
      const palette = getPalette(settings.colors);
      return {
        datasets: [{
          ...trace,
          data: points,
          backgroundColor: trace.backgroundColor ?? ((context) => {
            const value = Number(context.dataset.data[context.dataIndex]?.v ?? 0);
            const intensity = max === min ? 0.6 : (value - min) / (max - min);
            return palette[Math.min(Math.floor(intensity * palette.length), palette.length - 1)];
          }),
          width: trace.width ?? ((context) => (context.chart.chartArea?.width ?? 0) / Math.max(xLabels.length, 1) - 1),
          height: trace.height ?? ((context) => (context.chart.chartArea?.height ?? 0) / Math.max(yLabels.length, 1) - 1),
        }],
        labels: xLabels,
        yLabels,
      };
    }

    if (kind === "box" || kind === "boxplot" || kind === "violin") {
      const fields = mapping.y ? yKeys : (columns(data).length ? columns(data) : [undefined]);
      const datasets = fields.map((field, index) => colorDataset({
        ...trace,
        label: field ?? trace.label ?? "Values",
        data: field ? valuesFor(data, field) : data,
      }, index, settings));
      return { labels: x, datasets };
    }

    if (!CHART_TYPES[kind] && mapping.data) {
      return {
        labels: x,
        datasets: [colorDataset({ ...trace, label: trace.label ?? kind, data: resolve(data, mapping.data) }, 0, settings)],
      };
    }

    if (kind === "scatter" || kind === "bubble") {
      const radius = mapping.r ? resolve(data, mapping.r) : undefined;
      const datasets = yKeys.map((key, index) => colorDataset({
        ...trace,
        label: trace.label ?? key,
        data: x.map((xValue, index) => ({
          x: xValue,
          y: valuesFor(data, key)[index],
          ...(radius ? { r: radius[index] } : {}),
        })),
      }, index, settings));
      if (!datasets.length && Array.isArray(data) && !isRecord(data[0])) {
        return {
          datasets: [colorDataset({
            ...trace,
            label: trace.label ?? "Values",
            data: data.map((y, x) => ({ x, y })),
          }, 0, settings)],
        };
      }
      return { datasets };
    }

    if (yKeys.length && (kind === "bar" || settings.aggregation)) {
      const method = settings.aggregation ?? "sum";
      const labels = [...new Set(x ?? [])];
      if (kind === "bar" && yKeys.length === 1) {
        const categories = valuesFor(data, yKeys[0]);
        const isCategorical = categories.some((value) => value !== null && value !== undefined && value !== "" && typeof value !== "number");
        if (isCategorical) {
          if (settings.aggregation && method !== "count") {
            throw new Error(`${method}() requires a numeric y field; use count() for categorical data.`);
          }
          const series = [...new Set(categories.filter((value) => value !== null && value !== undefined && value !== ""))];
          const counts = new Map();
          categories.forEach((category, index) => {
            if (category === null || category === undefined || category === "") return;
            if (!counts.has(category)) counts.set(category, new Map());
            const xCounts = counts.get(category);
            xCounts.set(x[index], (xCounts.get(x[index]) ?? 0) + 1);
          });
          return {
            labels,
            datasets: series.map((category, index) => colorDataset({
              ...trace,
              label: String(category),
              data: labels.map((label) => counts.get(category)?.get(label) ?? 0),
            }, index, settings)),
          };
        }
      }

      return {
        labels,
        datasets: yKeys.map((key, index) => {
          const buckets = new Map(labels.map((label) => [label, []]));
          valuesFor(data, key).forEach((value, rowIndex) => {
            if (buckets.has(x[rowIndex])) buckets.get(x[rowIndex]).push(value);
          });
          return colorDataset({
            ...trace,
            ...(kind === "area" ? { fill: true } : {}),
            label: trace.label ?? key,
            data: labels.map((label) => aggregateValues(buckets.get(label), method)),
          }, index, settings);
        }),
      };
    }

    const datasets = yKeys.map((key, index) => colorDataset({
      ...trace,
      ...(kind === "area" ? { fill: true } : {}),
      label: trace.label ?? key,
      data: valuesFor(data, key),
    }, index, settings, kind === "bar" && yKeys.length === 1));

    if (!datasets.length && Array.isArray(data) && !isRecord(data[0])) {
      datasets.push(colorDataset({ ...trace, ...(kind === "area" ? { fill: true } : {}), label: trace.label ?? "Values", data }, 0, settings));
    }
    return { labels: x, datasets };
  }

  function buildConfig(data, settings = {}) {
    data = parseData(data, settings);
    if (isRecord(data) && data.type && isRecord(data.data)) {
      const config = { ...data, ...settings.config };
      if (settings.colors && Array.isArray(config.data.datasets)) {
        config.data = {
          ...config.data,
          datasets: config.data.datasets.map((dataset, index) => colorDataset(
            dataset,
            index,
            settings,
            ["pie", "doughnut", "polarArea"].includes(config.type),
          )),
        };
      }
      return config;
    }

    const kind = settings.kind ?? settings.type ?? "line";
    const chartData = makeDatasets(data, kind, settings.mapping ?? settings, settings);
    const options = {
      responsive: true,
      ...settings.options,
      plugins: {
        ...settings.options?.plugins,
        ...(settings.title ? { title: { display: true, text: settings.title } } : {}),
      },
    };
    if (settings.xlabel) {
      options.scales = {
        ...options.scales,
        x: { ...options.scales?.x, title: { display: true, text: settings.xlabel } },
      };
    }
    if (settings.ylabel) {
      options.scales = {
        ...options.scales,
        y: { ...options.scales?.y, title: { display: true, text: settings.ylabel } },
      };
    }
    if (kind === "heatmap") {
      const yLabels = chartData.yLabels ?? [];
      delete chartData.yLabels;
      options.scales = {
        ...options.scales,
        x: { type: "category", labels: chartData.labels, ...options.scales?.x },
        y: { type: "category", labels: yLabels, ...options.scales?.y },
      };
    }

    return {
      ...settings.config,
      type: CHART_TYPES[kind] ?? kind,
      data: chartData,
      options,
    };
  }

  class ChartBuilder {
    constructor(data) {
      this.data = data;
      this.settings = { kind: "line", mapping: {}, trace: {}, options: {}, config: {} };
      this.instance = null;
    }

    plot(kind, mapping = {}) { this.settings.kind = kind; Object.assign(this.settings.mapping, mapping); return this; }
    type(kind) { return this.plot(kind); }
    line(mapping) { return this.plot("line", mapping); }
    scatter(mapping) { return this.plot("scatter", mapping); }
    bar(mapping) { return this.plot("bar", mapping); }
    area(mapping) { return this.plot("area", mapping); }
    pie(mapping) { return this.plot("pie", mapping); }
    doughnut(mapping) { return this.plot("doughnut", mapping); }
    histogram(mapping) { return this.plot("histogram", mapping); }
    box(mapping) { return this.plot("box", mapping); }
    violin(mapping) { return this.plot("violin", mapping); }
    heatmap(mapping) { return this.plot("heatmap", mapping); }

    x(field) { this.settings.mapping.x = field; return this; }
    y(field) { this.settings.mapping.y = field; return this; }
    labels(field) { this.settings.mapping.labels = field; return this; }
    values(field) { this.settings.mapping.values = field; return this; }
    bins(count) { this.settings.bins = count; return this; }
    groupBy(field) { this.settings.mapping.x = field; return this; }
    aggregate(method, field) {
      const normalized = String(method).toLowerCase();
      if (!["sum", "mean", "median", "min", "max", "range", "count", "std", "var"].includes(normalized)) {
        throw new Error(`Unsupported aggregation: ${method}`);
      }
      if (field) this.settings.mapping.y = field;
      this.settings.aggregation = normalized;
      return this;
    }
    agg(method, field) { return this.aggregate(method, field); }
    sum(field) { return this.aggregate("sum", field); }
    mean(field) { return this.aggregate("mean", field); }
    median(field) { return this.aggregate("median", field); }
    min(field) { return this.aggregate("min", field); }
    max(field) { return this.aggregate("max", field); }
    range(field) { return this.aggregate("range", field); }
    count(field) { return this.aggregate("count", field); }
    std(field) { return this.aggregate("std", field); }
    var(field) { return this.aggregate("var", field); }
    colors(palette) {
      const colors = Array.isArray(palette) ? palette : [palette];
      if (!colors.length || colors.some((color) => typeof color !== "string" || !color.trim())) {
        throw new Error("colors() expects a color string or a non-empty array of color strings.");
      }
      this.settings.colors = colors;
      return this;
    }
    color(value) { return this.colors(value); }
    trace(options) { Object.assign(this.settings.trace, options); return this; }
    layout(options) { Object.assign(this.settings.options, options); return this; }
    config(options) { Object.assign(this.settings.config, options); return this; }
    title(text) { this.settings.title = text; return this; }
    xlabel(text) { this.settings.xlabel = text; return this; }
    ylabel(text) { this.settings.ylabel = text; return this; }

    downloadImage(filename, options) {
      if (!this.instance) throw new Error("Render the chart before downloading its image.");
      return downloadImage(this.instance, filename, options);
    }

    download(filename, options) { return this.downloadImage(filename, options); }

    toConfig() { return buildConfig(this.data, this.settings); }

    render(target, options = {}) {
      const element = typeof target === "string" ? global.document?.querySelector(target) : target;
      if (!element) throw new Error(`Chart target not found: ${String(target)}`);
      const Chart = options.Chart ?? global.Chart;
      if (!Chart) throw new Error("Chart.js is missing. Load Chart.js from a CDN before rendering charts.");
      const canvas = typeof element.getContext === "function" ? element : element.querySelector?.("canvas");
      if (!canvas) throw new Error("Chart target must be a canvas or contain a canvas element.");
      const canvasChart = Chart.getChart?.(canvas);
      if (canvasChart && canvasChart !== this.instance) canvasChart.destroy();
      this.instance?.destroy();
      this.instance = new Chart(canvas, { ...this.toConfig(), ...options.config });
      return this.instance;
    }
  }

  function chart(data, options = {}) { return new ChartBuilder(parseData(data, options)); }

  async function fromFile(file, options = {}) {
    if (!file || typeof file.text !== "function") throw new Error("Expected a browser File or Blob.");
    const format = options.format ?? inferFormat(file.name);
    return chart(await file.text(), { ...options, format });
  }

  async function fromURL(url, options = {}) {
    const response = await global.fetch(url, options.fetchOptions);
    if (!response.ok) throw new Error(`Failed to load chart data: ${response.status} ${response.statusText}`);
    const format = options.format ?? inferFormat(new global.URL(url, global.location?.href).pathname);
    return chart(await response.text(), { ...options, format });
  }

  global.chart = chart;
  global.chartjs = Object.freeze({ chart, buildConfig, ChartBuilder, parseCSV, parseJSON, parseData, fromFile, fromURL, downloadImage });
})(globalThis);