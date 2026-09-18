/**
 * Internal time is always **UTC seconds** (integer). Feed adapters convert
 * broker formats (IST strings, epoch ms) to this at the edge; see ARCHITECTURE.md §4.0.
 */
type UTCSeconds = number;
/** A single OHLC(V) bar. `volume` is optional (not all feeds carry it). */
interface Bar {
    time: UTCSeconds;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
    /**
     * Per-bar colour override, honoured by every Family-A renderer: candles and
     * OHLC bars take it on body, border and wick together, histogram and column
     * on the bar, and line, step, area and the HLC-area close line split their
     * stroke into runs at the bars where it changes. Baseline is the exception,
     * its stroke is already split by the above/below-base rule.
     * A MACD histogram is four colours by momentum, and a conditional study is
     * two. Neither is expressible with one colour for the whole series.
     */
    color?: string;
}

/**
 * Unified style bag for all Family-A series types (ARCHITECTURE.md §6A). Each
 * renderer reads the fields it needs; per-type defaults are filled by the
 * chart-type registry. Keeping one optional-field interface avoids a sprawling
 * discriminated union at the rendering boundary.
 */
interface SeriesStyle {
    upColor?: string;
    downColor?: string;
    borderUpColor?: string;
    borderDownColor?: string;
    wickUpColor?: string;
    wickDownColor?: string;
    borderVisible?: boolean;
    wickVisible?: boolean;
    /** Paint candle bodies. Off leaves outline and wick. Default true. */
    bodyVisible?: boolean;
    hollow?: boolean;
    /**
     * Color bars by close-versus-previous-close instead of close-versus-own-open,
     * which is how most terminals paint a bar. Body, border and wick switch
     * together. Default false.
     */
    colorByPreviousClose?: boolean;
    /** Whether the series is drawn and counted in autoscale. Default true. */
    visible?: boolean;
    /** Optional label carried with the series (for host-drawn legends). */
    title?: string;
    /** Show the dashed horizontal last-price line across the plot. Default true. */
    priceLineVisible?: boolean;
    /**
     * Show this series' current value as a tag on the price axis. Default true.
     *
     * Every series on the pane's readout scale gets one, not only the instrument:
     * an indicator overlay, a comparison line, a study on a pane of its own. The
     * instrument's tag is the up/down coloured one that also carries the bar
     * countdown; the rest are drawn in their own plot colour. A series whose
     * current value is not a number draws no tag, so a study that is `na` right
     * now says nothing rather than showing a stale reading.
     */
    lastValueVisible?: boolean;
    /**
     * Decimal places for every price the scale this series maps to formats: the
     * axis ticks, the last-value tag, the crosshair label and the drawing-tool
     * labels. It overrides the precision the price scale infers from the tick
     * size or the visible range. Undefined is the "Default" entry of the
     * Precision dropdown: keep inferring. Valid range 0 to 8.
     *
     * It does not reach a legend row: a `PaneLegend` is handed finished strings,
     * so whoever builds those readings owns their formatting.
     */
    precision?: number;
    color?: string;
    lineWidth?: number;
    /** Line dash style for line/step/area/HLC series. Default 'solid'. */
    lineStyle?: 'solid' | 'dashed' | 'dotted';
    step?: boolean;
    markers?: boolean;
    /** Draw only the markers, with no connecting line (Parabolic SAR, scatter). */
    markersOnly?: boolean;
    markerRadius?: number;
    areaTopColor?: string;
    areaBottomColor?: string;
    baseValue?: number;
    topColor?: string;
    bottomColor?: string;
    /**
     * Stroke for the top edge of an HLC area's band. Undefined leaves the edge
     * unstroked, which is how the band has always drawn.
     */
    highColor?: string;
    /** Stroke for the bottom edge of an HLC area's band. See `highColor`. */
    lowColor?: string;
    closeColor?: string;
    base?: number;
    /**
     * Fallback box size for stacking P&F X/O glyphs. Columns from
     * `PointFigureTransform` carry their own `boxSize`, which wins, so set this
     * only for hand-built column data.
     */
    boxSize?: number;
    /** Kagi thick (yang) line color. */
    thickColor?: string;
    /** Kagi thin (yin) line color. */
    thinColor?: string;
}

/**
 * Chart theme (palette). A single object drives chart chrome (background, grid,
 * axes, crosshair), series defaults (up/down, line, area gradient, last price),
 * and the trade layer (buy/sell, profit/loss). Renderers read theme colors when
 * a per-series style field is absent, so one theme restyles the whole chart.
 */
interface ChartTheme {
    background: string;
    grid: string;
    axisText: string;
    axisLine: string;
    /** 1px rule between stacked panes. Subtle: it separates, it does not divide. */
    paneSeparator: string;
    crosshair: string;
    /** Axis label font size in px (default 11). */
    axisFontSize?: number;
    /** Grid line dash style (default 'solid'). */
    gridStyle?: 'solid' | 'dashed' | 'dotted';
    /** Crosshair line dash style (default 'dashed'). */
    crosshairStyle?: 'solid' | 'dashed' | 'dotted';
    /** Crosshair line width in device px (default 1 = hairline). */
    crosshairWidth?: number;
    /** Background of the crosshair value tags (defaults to `crosshair`). */
    crosshairLabelBackground?: string;
    /** Show the crosshair price/time value tags (default true). */
    crosshairLabelVisible?: boolean;
    upColor: string;
    downColor: string;
    wickUpColor: string;
    wickDownColor: string;
    lineColor: string;
    areaTopColor: string;
    areaBottomColor: string;
    baselineTopLine: string;
    baselineTopFill: string;
    baselineBottomLine: string;
    baselineBottomFill: string;
    lastPriceUp: string;
    lastPriceDown: string;
    lastPriceText: string;
    buy: string;
    sell: string;
    profit: string;
    loss: string;
}

/**
 * Chart-type registry (ARCHITECTURE.md §6A). Every series type registers a
 * descriptor: how to draw it and how it contributes to autoscale. The core
 * iterates descriptors, so adding a style is one registration — no core change.
 * Phase 5 fills the Family-A (time-indexed) types; Families B/C plug in later.
 */

interface DrawItem {
    x: number;
    bar: Bar;
    /**
     * Close of the bar left of the visible range, carried on the first item only.
     * Previous-close candle colouring is the one renderer that reads it, because
     * it is the one that needs a reference the visible window does not hold.
     */
    prevClose?: number;
}
interface SeriesRenderContext {
    plotHeight: number;
    maxVolume: number;
    theme: ChartTheme;
}
interface RendererEntry {
    defaultStyle: SeriesStyle;
    /** True for the price series whose last close drives the last-price line. */
    isPriceSeries: boolean;
    /**
     * Paint the visible items on a bitmap-scope 2D context. On screen the pane
     * reaches this through its render backend (src/render/backend.ts); the 2D
     * backend calls it as is, and the vector export calls it directly on the
     * serialising target.
     */
    draw(ctx: CanvasRenderingContext2D, items: readonly DrawItem[], toY: (v: number) => number, barSpacing: number, dpr: number, style: SeriesStyle, rc: SeriesRenderContext): void;
    /** Min/max price contribution of one bar to autoscale. */
    extents(bar: Bar, style: SeriesStyle): {
        min: number;
        max: number;
    };
}

/**
 * The render backend port (ARCHITECTURE.md section 3). A pane paints its series
 * through one of these and draws everything else (background, grid, primitives,
 * axes) on a 2D context itself, so a backend that rasterises series on the GPU
 * plugs in without the pane, the registry or any renderer learning about it.
 *
 * The port is deliberately narrow. It covers the one hot path a GPU can take
 * over, the per-frame series pass, and nothing the 2D context already does
 * well. Text, dashed lines, gradients and the drawing tools stay on canvas 2D.
 *
 * Which backend a chart gets is decided once, at construction, by the
 * `renderer` chart option or an injected factory. This module keeps the
 * registry that resolves the option; the shipped 2D backend registers itself
 * from its own module, and a later tier registers `webgl2` the same way, so
 * this file never has to import either.
 */

/** The backends the port can name. Only `canvas2d` ships in the base tier. */
type RenderBackendKind = 'canvas2d' | 'webgl2';
/**
 * Paints one pane's series. One instance per pane: a backend holds a context
 * on that pane's base canvas, and contexts do not travel between canvases.
 */
interface IRenderBackend {
    readonly kind: RenderBackendKind;
    /**
     * Take the pane's base data canvas. `ctx2d` is the 2D context the pane
     * already holds on it, when it holds one: the canvas-2D backend draws on
     * exactly that object, so a frame is one context's op stream and not two
     * contexts' interleaved. A backend that owns the canvas outright ignores it.
     */
    mount(canvas: HTMLCanvasElement, ctx2d: CanvasRenderingContext2D | null): void;
    /** The pane's media size and pixel ratio changed. Sizes in CSS px. */
    resize(widthPx: number, heightPx: number, dpr: number): void;
    /** Start a frame on the base canvas, clearing it first when asked. */
    beginFrame(clear: boolean): void;
    /**
     * Paint one series. Same contract as `RendererEntry.draw` minus the context:
     * `priceToY` and `items[].x` are media px, and the renderer snaps to device
     * pixels with `dpr` itself.
     */
    drawSeries(entry: RendererEntry, items: readonly DrawItem[], priceToY: (price: number) => number, barSpacing: number, dpr: number, style: SeriesStyle, rc: SeriesRenderContext): void;
    /** Finish the frame: flush whatever the backend batched. */
    endFrame(): void;
    /**
     * A 2D context for what the backend does not draw natively (grid, axes,
     * primitives), or null when the backend paints those itself.
     */
    overlay2d(): CanvasRenderingContext2D | null;
    /** Release the context and any GPU resources. The pane removes the canvas. */
    destroy(): void;
    /**
     * The GPU device behind the backend, when it has one. The chart reads it
     * after a frame (`backendDegradation`) to learn that the context has been
     * lost or never came up, and moves every pane to `canvas2d` for the rest of
     * the session, announced by the 'renderer:fallback' chart event. A backend
     * without a device is never degraded, so the 2D backend leaves it unset.
     */
    readonly device?: RenderDevice;
}
/**
 * What the chart needs to know about a GPU device. `available` is whether it
 * ever got a usable context (a driver that cannot run the program counts as
 * never having one), and `lost` is the window between a context loss and its
 * restoration.
 */
interface RenderDevice {
    readonly available: boolean;
    readonly lost: boolean;
}

/** Premultiplied red, green, blue, alpha, each 0..1. */
type PremultipliedRgba = readonly [number, number, number, number];
/**
 * Memoised colour lookup. A frame asks for the same handful of strings a few
 * thousand times, and a heatmap plot asks for a fresh rgba() string per bar,
 * so the map is bounded: past the limit it is cleared rather than trimmed,
 * because the strings that matter are re-asked on the next frame anyway.
 */
declare class ColorCache {
    private readonly _map;
    /**
     * The premultiplied colour for `css`. `normalise` is consulted only on a
     * parse failure, and only once per string. A string neither can read is
     * transparent: that is a colour nothing can blend with, so the bar it was
     * meant for is visibly absent rather than painted in a neighbour's colour,
     * which is what a 2D context's silently kept `fillStyle` would do.
     */
    get(css: string, normalise?: (css: string) => string | null): PremultipliedRgba;
    get size(): number;
    clear(): void;
}

/**
 * The vertex batch the WebGL2 backend fills during a frame and flushes in one
 * draw call. Every shape is one quad (four vertices, six indices) carrying a
 * signed-distance description of itself, so the fragment shader can compute
 * an analytic coverage at its edge:
 *
 *   x y            device px
 *   r g b a        premultiplied colour
 *   u v            position in the shape's own frame (centre 0,0, device px)
 *   hx hy          half extents of the shape's inner box
 *   rad            corner radius added to that box
 *
 * A rect is a box with no radius, a round-capped line is a box of zero
 * height with the half line width as radius (a capsule), a marker dot is a
 * capsule of zero length, and a solid triangle sets its extents so large no
 * fragment is ever near an edge. One layout, one program, one draw call, in
 * submission order, which is what keeps a wick under its body and an area
 * fill under its line without sorting anything.
 *
 * Index pattern is fixed per quad slot and identical for every batch, so the
 * device uploads an index buffer only when a batch outgrows the one it has;
 * a frame that fits the capacity from the last one allocates nothing.
 */

declare class VertexBatch {
    vertices: Float32Array;
    indices: Uint32Array;
    quadCount: number;
    private _capacity;
    constructor(capacity?: number);
    get capacity(): number;
    get vertexCount(): number;
    get indexCount(): number;
    get floatCount(): number;
    /** Empty the batch for the next frame. Keeps every buffer. */
    reset(): void;
    /**
     * An axis-aligned rectangle in device px. Edges on whole pixels cover
     * exactly those pixels; fractional edges get analytic coverage, the way a
     * 2D `fillRect` does. The quad only grows a one-pixel skirt for the
     * anti-aliased fringe when an edge is fractional, so the integer rects a
     * candle is made of rasterise no fragment outside themselves.
     */
    rect(x: number, y: number, w: number, h: number, color: PremultipliedRgba): void;
    /**
     * A stroked segment of half width `hw` between two device-px points.
     * `round` gives it the round caps a series line is stroked with (a capsule,
     * so two segments meeting at a point also form a round join); otherwise it
     * is cut square at both ends, the default butt cap. A zero-length round
     * segment is a dot of radius `hw`; a zero-length butt one is nothing.
     */
    segment(x0: number, y0: number, x1: number, y1: number, hw: number, color: PremultipliedRgba, round: boolean): void;
    /**
     * A solid quad with a colour per corner, in strip order (the two triangles
     * are 0-1-2 and 2-1-3), for gradient fills. No anti-aliasing: these tile
     * edge to edge under a line that covers the seam.
     */
    quad(x0: number, y0: number, c0: PremultipliedRgba, x1: number, y1: number, c1: PremultipliedRgba, x2: number, y2: number, c2: PremultipliedRgba, x3: number, y3: number, c3: PremultipliedRgba): void;
    /** A solid triangle: a quad whose last corner repeats, leaving one triangle degenerate. */
    triangle(x0: number, y0: number, c0: PremultipliedRgba, x1: number, y1: number, c1: PremultipliedRgba, x2: number, y2: number, c2: PremultipliedRgba): void;
    /** Reserve one quad slot; returns the float offset of its first vertex. */
    private _claim;
    private _vertex;
    private _grow;
    /** Write the fixed two-triangle pattern for every slot from `from` up. */
    private _fillIndices;
}

/**
 * The WebGL2 render backend: the series pass rasterised on the GPU, everything
 * else exactly where the 2D backend leaves it.
 *
 * How it sits in the pane. The pane's base canvas keeps its 2D context, and
 * the backend is handed that context at `mount`, the same way the 2D backend
 * is. The GPU draws into a separate surface that is never in the document:
 * one WebGL2 context shared by every pane of every chart on the page (a
 * browser allows around sixteen live contexts, and a dashboard of a few
 * multi-pane charts would exhaust that at one per pane). `endFrame` renders
 * the frame's batch and blits the surface into the base canvas with one
 * `drawImage`, under the pane's current transform and plot clip, at the
 * exact point in the frame where the 2D backend would have painted the same
 * series. The composite is a GPU-side copy in every accelerated browser.
 *
 * That one decision is what keeps the rest of the engine unchanged: the pane
 * still owns one canvas per layer, the grid stays under the series and the
 * price lines and drawings over them, `takeScreenshot` and the context-menu
 * freeze still read `pane.base.element`, and a parity spec counting canvases
 * per pane counts the same number.
 *
 * What is drawn natively is every Family-A type: candles (plain, hollow,
 * volume), bars, high-low, line, line-markers, step, area, HLC area,
 * baseline, column and histogram. Each emitter mirrors its 2D renderer
 * branch for branch and takes its geometry from the same functions
 * (`candleGeometry`, `optimalBarWidth`, `candleTier`, `barGeometry`,
 * `valuePoints`, `stepPoints`), so the two backends agree on which device
 * pixels a bar covers. Anything else (kagi, point and figure, a custom type)
 * falls back: the batch so far is flushed to keep z-order, and the entry's
 * own renderer paints on the 2D context. A lost context takes the same
 * fallback for the whole frame, so the chart never goes blank while the GPU
 * is away; when the context comes back the program is rebuilt and the next
 * frame is on the GPU again.
 */

/**
 * What the shared context is created on: a detached canvas or an
 * OffscreenCanvas. Only the members the device touches, so a test can hand
 * in a plain object with a recording context behind `getContext`.
 */
interface GlSurface {
    width: number;
    height: number;
    getContext(id: 'webgl2', attributes?: WebGLContextAttributes): WebGL2RenderingContext | null;
    addEventListener?(type: string, listener: (event: Event) => void): void;
    removeEventListener?(type: string, listener: (event: Event) => void): void;
}
/**
 * One WebGL2 context, its program and its buffers, shared by every backend
 * built for the same surface factory. Reference counted by mounted backends
 * so the drawing buffer is given back once the last chart is destroyed; the
 * context itself is kept, because a canvas whose context has been lost on
 * purpose hands back that same lost context on the next `getContext`.
 */
declare class GlDevice {
    readonly colors: ColorCache;
    private readonly _createSurface;
    private _surface;
    private _gl;
    private _program;
    private _vao;
    private _vbo;
    private _ibo;
    private _indexCapacity;
    private _refs;
    private _lost;
    private _probed;
    private _onLost;
    private _onRestored;
    constructor(createSurface?: () => GlSurface | null);
    /** Whether a WebGL2 context exists or can be created. Probes at most once. */
    get available(): boolean;
    /** True between a context loss and its restoration: frames go through 2D meanwhile. */
    get lost(): boolean;
    get surface(): GlSurface | null;
    get refs(): number;
    get gl(): WebGL2RenderingContext | null;
    acquire(): boolean;
    release(): void;
    /** Grow the surface to hold a pane of this bitmap size. Never shrinks while in use. */
    ensureSize(widthPx: number, heightPx: number): void;
    /**
     * Draw a batch into the top-left `widthPx` by `heightPx` of the surface,
     * cleared first. Returns false when the context is lost or absent, in
     * which case nothing was drawn and the caller must not blit.
     */
    render(batch: VertexBatch, widthPx: number, heightPx: number): boolean;
    /** Program, buffers and fixed state, built once per context (and again after a restore). */
    private _setup;
}
/** The page-wide device every default backend shares. */
declare function sharedGlDevice(): GlDevice;
/** Whether this device can run the WebGL2 backend. Probes once and remembers. */
declare function isWebGL2Supported(): boolean;
declare class WebGL2Backend implements IRenderBackend {
    readonly kind = "webgl2";
    readonly device: GlDevice;
    private readonly _batch;
    private _canvas;
    private _ctx;
    private _widthPx;
    private _heightPx;
    /** Whether `mount` took a reference on the device, so `destroy` gives back exactly that. */
    private _acquired;
    /** Set at `beginFrame` when the GPU is unavailable: the whole frame goes through 2D. */
    private _frame2d;
    /** Colour lookup bound to this pane's 2D context for the strings the parser cannot read. */
    private readonly _color;
    private readonly _normalise;
    constructor(device?: GlDevice);
    /** The batch under construction, for tests that check what a series emits. */
    get batch(): VertexBatch;
    mount(canvas: HTMLCanvasElement, ctx2d: CanvasRenderingContext2D | null): void;
    /** The pane sized its own canvas already; only the shared surface has to keep up. */
    resize(widthPx: number, heightPx: number, dpr: number): void;
    /** The 2D backend's clear (which is `CanvasLayer.clearBitmap`), plus an empty batch. */
    beginFrame(clear: boolean): void;
    drawSeries(entry: RendererEntry, items: readonly DrawItem[], priceToY: (price: number) => number, barSpacing: number, dpr: number, style: SeriesStyle, rc: SeriesRenderContext): void;
    endFrame(): void;
    overlay2d(): CanvasRenderingContext2D | null;
    destroy(): void;
    /**
     * Render the batch and blit it into the base canvas. The blit is drawn
     * under whatever transform and clip the pane has in force, which is the
     * plot's, so the surface lands exactly where the series would have been
     * painted directly. A batch with nothing in it costs no GPU work at all.
     */
    private _flush;
}
/**
 * The `webgl2` factory: a backend on the shared device, or null when this
 * device has no WebGL2, in which case the chart takes the 2D backend.
 */
declare function createWebGL2Backend(device?: GlDevice): IRenderBackend | null;

declare const WEBGL_TIER: "webgl";
/**
 * Register the WebGL2 backend. Called as a side effect when this tier is
 * imported, and exported so a consumer whose bundler tree-shakes a bare
 * `import 'openalgo-charts/webgl'` can call it explicitly. Idempotent.
 */
declare function registerWebGL2Renderer(): void;

export { ColorCache, GlDevice, type GlSurface, type PremultipliedRgba, VertexBatch, WEBGL_TIER, WebGL2Backend, createWebGL2Backend, isWebGL2Supported, registerWebGL2Renderer, sharedGlDevice };
