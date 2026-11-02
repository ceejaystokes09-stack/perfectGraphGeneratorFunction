((global) => {
"use strict";

const CHART_TYPES = {
  line: { type: "scatter", mode: "lines" },
  scatter: { type: "scatter", mode: "markers" },
  area: { type: "scatter", mode: "lines", fill: "tozeroy" },
  bar: { type: "bar" },
  pie: { type: "pie" },
  histogram: { type: "histogram" },
  box: { type: "box" },
  violin: { type: "violin" },
  heatmap: { type: "heatmap" },
};

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

function column(data, key) {
  if (Array.isArray(data)) return data.map((row) => row?.[key]);
  return data[key];
}

function getColumns(data) {
  if (Array.isArray(data)) return Object.keys(data[0] ?? {});
  return Object.keys(data ?? {}).filter((key) => Array.isArray(data[key]));
}

function buildTraces(data, kind, mapping, traceOptions) {
  if (Array.isArray(data) && data.length > 0 && data.every((item) => isRecord(item) && (
    item.type || Array.isArray(item.x) || Array.isArray(item.y) || Array.isArray(item.z)
  ))) {
    return data.map((trace) => ({ ...trace, ...traceOptions }));
  }

  const definition = CHART_TYPES[kind] ?? { type: kind };
  const traceBase = { ...definition, ...traceOptions };
  const labelsKey = mapping.labels ?? mapping.x;
  const valuesKey = mapping.values ?? mapping.y;

  if (kind === "pie") {
    const labels = labelsKey ? column(data, labelsKey) : data.labels;
    const values = valuesKey ? column(data, valuesKey) : data.values;
    if (labels && values) return [{ ...traceBase, labels, values }];
  }

  if (kind === "histogram") {
    const valueKey = mapping.y ?? mapping.x ?? getColumns(data)[0];
    const values = Array.isArray(data) && !isRecord(data[0]) ? data : column(data, valueKey);
    return [{ ...traceBase, x: values }];
  }

  if (["box", "violin"].includes(kind)) {
    if (Array.isArray(data) && !isRecord(data[0])) {
      return [{ ...traceBase, y: data }];
    }
    const yKeys = mapping.y ? (Array.isArray(mapping.y) ? mapping.y : [mapping.y]) : getColumns(data);
    return yKeys.map((key) => ({ ...traceBase, name: key, y: column(data, key) }));
  }

  const columns = getColumns(data);
  if (kind === "heatmap" && mapping.z) {
    return [{
      ...traceBase,
      x: mapping.x ? column(data, mapping.x) : undefined,
      y: mapping.y ? column(data, mapping.y) : undefined,
      z: typeof mapping.z === "string" && columns.includes(mapping.z)
        ? column(data, mapping.z)
        : mapping.z,
    }];
  }

  if (!CHART_TYPES[kind]) {
    const trace = { ...traceBase };
    for (const [field, source] of Object.entries(mapping)) {
      trace[field] = typeof source === "string" && columns.includes(source)
        ? column(data, source)
        : source;
    }
    return [trace];
  }

  const xKey = mapping.x ?? columns[0];
  const yKeys = mapping.y
    ? (Array.isArray(mapping.y) ? mapping.y : [mapping.y])
    : columns.filter((key) => key !== xKey);
  const x = xKey ? column(data, xKey) : Array.isArray(data) ? data.map((_, index) => index) : undefined;

  if (!yKeys.length && Array.isArray(data) && !isRecord(data[0])) {
    return [{ ...traceBase, x, y: data }];
  }

  return yKeys.map((key) => ({
    ...traceBase,
    name: traceOptions.name ?? key,
    x,
    y: column(data, key),
  }));
}

function buildFigure(data, settings = {}) {
  const kind = settings.kind ?? settings.type ?? "scatter";
  const mapping = settings.mapping ?? Object.fromEntries(
    Object.entries(settings).filter(([key]) => !["kind", "type", "layout", "config", "trace"].includes(key)),
  );
  const { layout = {}, config = {}, trace = {} } = settings;

  return {
    data: buildTraces(data, kind, mapping, trace),
    layout: { ...layout },
    config: { ...config },
  };
}

class ChartBuilder {
  constructor(data) {
    this.data = data;
    this.settings = { kind: "scatter", mapping: {}, layout: {}, config: {}, trace: {} };
  }

  plot(kind, mapping = {}) {
    this.settings.kind = kind;
    this.settings.mapping = { ...this.settings.mapping, ...mapping };
    return this;
  }

  type(kind) {
    return this.plot(kind);
  }

  line(mapping) { return this.plot("line", mapping); }
  scatter(mapping) { return this.plot("scatter", mapping); }
  bar(mapping) { return this.plot("bar", mapping); }
  area(mapping) { return this.plot("area", mapping); }
  pie(mapping) { return this.plot("pie", mapping); }
  histogram(mapping) { return this.plot("histogram", mapping); }
  box(mapping) { return this.plot("box", mapping); }
  violin(mapping) { return this.plot("violin", mapping); }
  heatmap(mapping) { return this.plot("heatmap", mapping); }

  x(field) { this.settings.mapping.x = field; return this; }
  y(field) { this.settings.mapping.y = field; return this; }
  labels(field) { this.settings.mapping.labels = field; return this; }
  values(field) { this.settings.mapping.values = field; return this; }
  trace(options) { Object.assign(this.settings.trace, options); return this; }
  layout(options) { Object.assign(this.settings.layout, options); return this; }
  config(options) { Object.assign(this.settings.config, options); return this; }
  title(text) { this.settings.layout.title = { text }; return this; }
  xlabel(text) {
    this.settings.layout.xaxis = { ...this.settings.layout.xaxis, title: { text } };
    return this;
  }
  ylabel(text) {
    this.settings.layout.yaxis = { ...this.settings.layout.yaxis, title: { text } };
    return this;
  }

  toFigure() {
    return buildFigure(this.data, this.settings);
  }

  async render(target, options = {}) {
    const element = typeof target === "string" ? global.document?.querySelector(target) : target;
    if (!element) throw new Error(`Chart target not found: ${String(target)}`);

    const Plotly = options.Plotly ?? global.Plotly;
    if (!Plotly || typeof Plotly.newPlot !== "function") {
      throw new Error("Plotly.js is missing. Load Plotly from a CDN before rendering charts.");
    }
    const { data, layout, config } = this.toFigure();
    return Plotly.newPlot(element, data, layout, { ...config, ...options.config });
  }
}

function chart(data) {
  return new ChartBuilder(data);
}

global.chart = chart;
global.chartgenfunc = Object.freeze({ chart, buildFigure, ChartBuilder });
})(globalThis);