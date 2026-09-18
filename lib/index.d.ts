/** Library version string. Matches package.json (including locally prepared releases). */
declare const VERSION = "2.3.2";
/** Returns the current library version. */
declare function version(): string;

/**
 * Invalidation model (ARCHITECTURE.md §3.2).
 *
 * A single global level is too coarse for multi-pane indicators and trade
 * overlays, so the mask carries a **global level + a per-pane map + a queue of
 * time-scale operations**. Multiple invalidations within one frame coalesce via
 * {@link InvalidateMask.merge}.
 */
/** How much of a pane (or the whole chart) must be repainted this frame. */
declare const InvalidationLevel: {
    /** Nothing to do. */
    readonly None: 0;
    /** Repaint only the top (overlay) canvas — crosshair, hover, dragging primitives. */
    readonly Cursor: 1;
    /** Repaint the base canvas at the current scales — series moved/changed, no rescale. */
    readonly Light: 2;
    /** Recompute scales/ticks then repaint everything. */
    readonly Full: 3;
};
type InvalidationLevel = (typeof InvalidationLevel)[keyof typeof InvalidationLevel];
/** Per-pane invalidation entry. `autoScale` requests a price-axis rescale. */
interface PaneInvalidation {
    level: InvalidationLevel;
    autoScale: boolean;
}
/** Discrete operations applied to the shared time scale before painting. */
type TimeScaleOp = {
    type: 'fitContent';
} | {
    type: 'applyBarSpacing';
    value: number;
} | {
    type: 'applyRightOffset';
    value: number;
} | {
    type: 'reset';
};
declare class InvalidateMask {
    private _globalLevel;
    private readonly _panes;
    private _timeScaleOps;
    constructor(globalLevel?: InvalidationLevel);
    get globalLevel(): InvalidationLevel;
    /** Raise the chart-wide level (monotonic — only ever increases). */
    invalidateGlobal(level: InvalidationLevel): void;
    /** Raise a single pane's level without touching the others. */
    invalidatePane(paneIndex: number, invalidation: PaneInvalidation): void;
    paneInvalidation(paneIndex: number): PaneInvalidation | undefined;
    panes(): ReadonlyMap<number, PaneInvalidation>;
    addTimeScaleOp(op: TimeScaleOp): void;
    timeScaleOps(): readonly TimeScaleOp[];
    isEmpty(): boolean;
    /** Fold another mask into this one (coalescing multiple invalidations per frame). */
    merge(other: InvalidateMask): void;
}

/**
 * Frame scheduler (ARCHITECTURE.md §3.2). Coalesces many `requestFrame()` calls
 * within a single tick into one `onFrame` invocation. The rAF function is
 * injectable so the loop is deterministically testable without a browser.
 */
type RafScheduler = (cb: () => void) => number;
type RafCanceller = (handle: number) => void;

/**
 * HiDPI canvas handling (ARCHITECTURE.md §3.1).
 *
 * Each canvas has two coordinate systems: **media** (CSS px, what you reason
 * about) and **bitmap** (device px = media × devicePixelRatio, the backing
 * buffer). Drawing 1px lines in the bitmap scope with integer snapping keeps
 * them crisp on retina/HiDPI displays.
 */
interface Size {
    width: number;
    height: number;
}
/** Pure: compute the integer device-pixel backing-buffer size for a canvas. */
declare function bitmapSize(mediaWidth: number, mediaHeight: number, dpr: number): Size;
/** Pure: snap a media-space coordinate to a crisp device-pixel edge. */
declare function snapToDevicePixel(mediaCoord: number, dpr: number): number;
/**
 * A single `<canvas>` element with media/bitmap sizing. Constructed only in a
 * browser; the size math above is the part exercised by unit tests.
 */
declare class CanvasLayer {
    readonly element: HTMLCanvasElement;
    readonly ctx: CanvasRenderingContext2D;
    private _mediaWidth;
    private _mediaHeight;
    private _dpr;
    constructor(doc: Document, zIndex: number);
    get mediaWidth(): number;
    get mediaHeight(): number;
    get pixelRatio(): number;
    /** Resize backing buffer + CSS box. No-op if nothing changed. */
    resize(mediaWidth: number, mediaHeight: number, dpr: number): void;
    /** Clear the whole bitmap and reset the transform to bitmap (device-px) scope. */
    clearBitmap(): void;
}

interface PriceRange {
    min: number;
    max: number;
}
/**
 * Price-scale mode, each one a coordinate transform (see `PriceScale._t`):
 * `linear` is the identity, `logarithmic` is log10, and `percentage` /
 * `indexed-to-100` rebase every price against a baseline: percent change from
 * it, or the baseline rebased to 100. The rebasing pair needs a baseline from
 * the data before it can transform anything, see `PriceScale.setBaseline`.
 *
 * Overlay scales are supported in every mode: a series added with
 * `priceScaleId: ''` gets a hidden scale with its own autoscale, see
 * `Pane._scaleFor`.
 */
type PriceScaleMode = 'linear' | 'logarithmic' | 'percentage' | 'indexed-to-100';
/** Whether a mode rebases prices against a baseline rather than mapping them directly. */
declare function isRebasing(mode: PriceScaleMode): boolean;
interface PriceScaleOptions {
    /** Fraction of pane height kept empty at top/bottom (default 0.1 each). */
    marginTop: number;
    marginBottom: number;
    /**
     * Instrument tick size (minMove), e.g. 0.05. 0 → infer from range.
     *
     * A property of the instrument and not of the axis, so it belongs only on a
     * scale that quotes one. An oscillator's pane reads in its own units and is
     * left at 0 there, which is why `Chart.setPriceScaleOptions` withholds it
     * from those panes rather than broadcasting it like the rest of this block.
     */
    minMove: number;
    /**
     * Least decimals a scale with no tick will print. 0 leaves the span to
     * decide alone, which is right for a price axis and too coarse for a bounded
     * oscillator: see `precision()`.
     *
     * Ignored once `minMove` is set, because a declared tick is a stronger
     * statement about the instrument than a floor is about the axis.
     */
    minPrecision: number;
    /** Linear, logarithmic or rebased (percentage / indexed-to-100) price↔y mapping. */
    mode: PriceScaleMode;
    /** Flip the axis (price increases downward) — for spread/short views. */
    inverted: boolean;
}
declare const DEFAULT_PRICE_SCALE_OPTIONS: PriceScaleOptions;
/**
 * Pure: compute a price range from data extremes plus top/bottom margins.
 * Returns a padded [min,max]; widens a degenerate (flat) range so it's drawable.
 *
 * The margins are fractions of the **pane height**, so the data band occupies
 * the `1 - marginTop - marginBottom` left between them. Padding the data span
 * by the margin instead — which is what this did — makes the reserved space
 * depend on how tall the data happens to be: an overlay asking for `0.82` to
 * sit in the bottom 18% got `high + 0.82 * span`, leaving its bars 55% of the
 * pane. The difference only shows at large margins; at the 0.1 default the two
 * readings land within a few percent of each other.
 */
declare function autoscaleRange(low: number, high: number, marginTop: number, marginBottom: number): PriceRange;
declare class PriceScale {
    private _options;
    private _height;
    private _min;
    private _max;
    private _autoScale;
    /**
     * True once a real range has been applied. The default 0..1 is a placeholder,
     * not a measurement — anything converting y↔price before that would answer
     * confidently with nonsense.
     */
    private _scaled;
    /**
     * Baseline for the rebasing modes. null is "nothing measured yet", the same
     * idea as `_scaled`: until the data supplies one there is no percent change
     * to report, so the transform stays the identity.
     */
    private _baseline;
    /**
     * A range declared by whoever owns this scale rather than measured from the
     * data: an oscillator's 0..100, a signal's -1..1. It is remembered, not just
     * applied, because "fit this axis" has a different answer on a declared axis:
     * the fit *is* the declared range, and a request to auto-fit has to be able
     * to find its way back to it. See `setFixedRange`.
     */
    private _fixedRange;
    private _priceFormatter;
    constructor(options?: Partial<PriceScaleOptions>);
    get options(): PriceScaleOptions;
    /** Merge partial options (minMove, mode, inverted, margins) at runtime. */
    setOptions(opts: Partial<PriceScaleOptions>): void;
    setHeight(height: number): void;
    get height(): number;
    setPriceRange(range: PriceRange): void;
    /** Whether a real price range has been applied (see `_scaled`). */
    get scaled(): boolean;
    /**
     * Set the baseline the rebasing modes (`percentage`, `indexed-to-100`) quote
     * against. Ignored by `linear` and `logarithmic`.
     *
     * The baseline is *data*, not geometry, so the scale cannot find it alone:
     * the autoscale pass supplies the first value of the visible range each
     * frame. That is what makes panning re-base, so the axis always reads as
     * change measured from the left edge of what is on screen.
     *
     * Pass null when there is nothing to measure (no series, no visible bars).
     * A rebasing mode without a baseline falls back to the identity transform
     * and behaves exactly like `linear`, rather than answering confidently with
     * nonsense before the first frame.
     *
     * Note what a rebase does *not* do: it is affine over a range held in price
     * units, so it relabels the pane rather than reshaping it. One series looks
     * the same as it does on a linear scale, by definition (percent change is a
     * straight-line function of price). Two instruments become comparable when
     * each sits on its own scale with its own baseline, which is the overlay
     * mechanism, not a second transform here.
     */
    setBaseline(value: number | null): void;
    /** The baseline last supplied, or null if none (see `setBaseline`). */
    get baseline(): number | null;
    priceRange(): PriceRange;
    /** Whether the range tracks the data (true) or has been set manually (false). */
    get autoScale(): boolean;
    setAutoScale(on: boolean): void;
    /**
     * Declare the range this scale must hold, or pass null to withdraw it.
     *
     * It is what an indicator that owns its pane asks for (RSI 0..100, a signal
     * line -1..1): a band whose meaning is in the numbers themselves, so fitting
     * it to the values on screen would destroy the reading rather than improve
     * it. The scale goes manual while one is held, because the range is declared
     * and not measured, and `setAutoScale(true)` returns to it.
     *
     * Withdrawing (null) leaves the range where it is; the caller decides whether
     * the scale goes back under autoscale, because it is the one that knows
     * whether anything is left on the pane to measure.
     */
    setFixedRange(range: PriceRange | null): void;
    /** The declared range this scale is holding, or null. See `setFixedRange`. */
    get fixedRange(): PriceRange | null;
    /**
     * Forget the measured range and go back to the placeholder.
     *
     * Called when a scale loses its last series: the range it holds described
     * something that is no longer on the chart, and whatever arrives next may
     * plot nothing at all. An indicator whose entire output is a table plots no
     * values, and inheriting a departed oscillator's 0..100 left its pane
     * labelled with a ladder it had no prices for.
     *
     * A manually scaled axis is left alone: the user set that range, and nothing
     * would recompute it if it were thrown away.
     */
    reset(): void;
    /**
     * Manually scale the visible range around its centre. `factor` > 1 widens the
     * range (compress / zoom out), < 1 narrows it (expand / zoom in). Switches the
     * scale to manual mode so autoscale stops overriding it.
     */
    scaleAroundCenter(factor: number): void;
    /** Scale around a screen coordinate, retaining its price in every scale mode. */
    scaleAtY(y: number, factor: number): void;
    /**
     * Pan the visible range vertically by `dy` media px (dragging the plot up/down).
     * Works in transformed space so it's correct for log scales, and respects
     * `inverted`. Switches to manual mode so autoscale stops overriding it.
     */
    panByPixels(dy: number): void;
    /**
     * Recompute the visible range from data extremes + configured margins.
     *
     * The range stays in *price* units in every mode, so the rebasing modes need
     * no separate pass: their transform is affine with a positive scale factor,
     * which maps a margin of 10% of the price span onto a margin of 10% of the
     * percent span. Log is the one that pads in price space and shows it, which
     * is long-standing behaviour and left alone here.
     */
    autoscale(low: number, high: number, progress?: number): boolean;
    /**
     * The baseline actually in force, or null when this mode does not rebase or
     * the value it was given cannot carry one.
     *
     * Zero and negative baselines are rejected on purpose. Percent change from
     * zero is undefined (every price is an infinite move away), and a negative
     * baseline flips the sign of the whole transform, so a rising price would
     * draw *downward* on an axis that still labels itself normally. Falling back
     * to the identity is recoverable and obvious on screen; an axis that
     * silently runs backwards is neither. Instruments that legitimately cross
     * zero (spreads, oscillators) have no percent-of-baseline reading to want.
     */
    private _rebase;
    /**
     * Coordinate transform for the active mode: identity for linear, log10 for
     * log, and a rebase against the baseline for percentage/indexed-to-100.
     * The rebasing pair share one ladder: percent change is the index minus the
     * 100 it is rebased to.
     */
    private _t;
    private _tInv;
    /** Price → y (media px). Higher price → smaller y (top of pane), unless inverted. */
    priceToY(price: number): number;
    /** y (media px) → price. */
    yToPrice(y: number): number;
    /**
     * Decimal precision implied by minMove (or the visible range if unset).
     *
     * While a rebase is in force the labels are percent/index points, where a
     * price tick size means nothing: precision comes from the transformed span
     * instead, with two decimals as the floor traders expect of a percentage
     * ("+3.42%") and more only when the visible band is tighter than that.
     *
     * A scale carrying no tick is not quoting an instrument, so the span is all
     * there is to go on. That alone reads too coarse on a bounded oscillator: an
     * RSI spanning 0 to 100 implies a step of 1 and prints a whole-number ladder,
     * so a reading of 62.24 lands on a rung labelled "62" and a trader comparing
     * it to a 70 level is reading a number that has been rounded past the part
     * they care about. `minPrecision` is the floor for that case, and it is the
     * same two decimals the percent branch above already settles on for the same
     * reason.
     */
    precision(): number;
    /**
     * Tick prices for the axis ladder, at most `maxTicks` of them. Linear and log
     * get the nice ladder over the price range, exactly what the axis renderer
     * used to build for itself.
     *
     * The rebasing modes need it built in *label* space: a nice price is an ugly
     * percentage, and a ladder of "+3.47%, +6.94%" is not a ladder. So the nice
     * values are chosen over the transformed range and mapped back to the prices
     * the axis positions with.
     */
    ticks(maxTicks?: number): number[];
    /** Snap a price to the instrument tick size (no-op if minMove is 0). */
    snapToTick(price: number): number;
    /**
     * Override the numeric formatting used for axis tick labels, the last-price
     * tag, and price-line labels (e.g. a currency or percent format). Pass null
     * to restore the default tick-size-aware `toFixed`.
     */
    setPriceFormatter(fn: ((price: number) => string) | null): void;
    /**
     * Format a price for axis/label display. While a rebase is in force the
     * label is the rebased value, "+3.42%" or "103.42", and it outranks a custom
     * price formatter: a currency prefix on a percent change would read as money
     * that is not there. The formatter takes over again the moment the mode does.
     */
    format(price: number): string;
    /** Clamp a y to the pane (used by crosshair/order dragging). */
    clampY(y: number): number;
}

interface LogicalRange {
    from: number;
    to: number;
}
interface TimeScaleOptions {
    barSpacing: number;
    minBarSpacing: number;
    maxBarSpacing: number;
    /** Empty bars of space kept to the right of the latest bar. */
    rightOffset: number;
}
declare const DEFAULT_TIME_SCALE_OPTIONS: TimeScaleOptions;
declare class TimeScale {
    private _barSpacing;
    private _rightOffset;
    private readonly _minBarSpacing;
    private readonly _maxBarSpacing;
    private _width;
    private _baseIndex;
    constructor(options?: Partial<TimeScaleOptions>);
    setWidth(width: number): void;
    get width(): number;
    get barSpacing(): number;
    setBarSpacing(value: number): void;
    /** Bound a pending zoom target without changing the displayed viewport. */
    constrainBarSpacing(value: number): number;
    get rightOffset(): number;
    setRightOffset(value: number): void;
    /** Logical index of the latest bar; the right edge anchors to baseIndex+rightOffset. */
    setBaseIndex(index: number): void;
    private _rightEdgeIndex;
    /** Logical index → x (media px), bar center. */
    indexToX(index: number): number;
    /** x (media px) → fractional logical index. */
    xToIndex(x: number): number;
    /** Currently visible logical index range (fractional, unclamped to data). */
    visibleRange(): LogicalRange;
    /** Alias of `visibleRange()` for naming parity with common charting APIs. */
    getVisibleLogicalRange(): LogicalRange;
    /**
     * Set the visible logical range (best effort): pick a bar spacing so the span
     * fills the width and anchor the right edge at `range.to`. Bar spacing is
     * clamped to [min,max], so an extreme span lands at the nearest zoom. Fires the
     * change handler so a host that mutates the scale directly still repaints.
     */
    setVisibleLogicalRange(range: LogicalRange): void;
    /** Repaint hook injected by the host chart, fired after `setVisibleLogicalRange`. */
    setChangeHandler(fn: (() => void) | null): void;
    private _onChange;
    /**
     * Pan by a pixel delta. Positive `dx` drags chart content to the right
     * (revealing older bars), matching a natural left-button drag.
     */
    scrollByPixels(dx: number): void;
    /**
     * Zoom around an anchor x (the cursor): change bar spacing by `factor`
     * while keeping whatever logical index sits under `focusX` pinned there.
     * `factor` > 1 zooms in (wider bars).
     */
    zoomAtX(focusX: number, factor: number): void;
    /** Choose bar spacing so `barCount` bars fit the width, anchored at the right edge. */
    fitContent(barCount: number): void;
}

/**
 * Internal time is always **UTC seconds** (integer). Feed adapters convert
 * broker formats (IST strings, epoch ms) to this at the edge; see ARCHITECTURE.md §4.0.
 */
type UTCSeconds = number;
/** The original, caller-supplied time value, echoed back untouched in callbacks. */
type OriginalTime = number | string;
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
/** A single value point (for line/area/baseline series). */
interface LinePoint {
    time: UTCSeconds;
    value: number;
    /** Per-bar colour override; carried through to the Bar. */
    color?: string;
}
/** A whitespace point: occupies a logical index for alignment but draws nothing. */
interface Whitespace {
    time: UTCSeconds;
}
declare function isWhitespace(p: Bar | LinePoint | Whitespace): p is Whitespace;
/** Any item a series accepts: an OHLC bar, a value point, or a whitespace gap. */
type SeriesDataItem = Bar | LinePoint | Whitespace;
/**
 * Normalize any series data item into an internal OHLC bar:
 * - a `Bar` passes through untouched;
 * - a `LinePoint` `{ time, value }` becomes a flat OHLC bar (open=high=low=close=value);
 * - a `Whitespace` `{ time }` becomes a NaN bar, which the line renderer draws as a
 *   gap and autoscale skips.
 */
declare function toBar(item: SeriesDataItem): Bar;

/**
 * Shared data layer (ARCHITECTURE.md §4.1). One per chart. Merges all series by
 * time onto a single logical-index space (0..N-1) so price + volume + indicator
 * panes stay aligned, and so non-trading gaps collapse (an absent time simply
 * has no logical index). Per-series rows are addressable by that shared index.
 */

type SeriesId = number;
interface IndexedBar {
    index: number;
    bar: Bar;
}
declare class DataLayer {
    private readonly _series;
    private _sortedTimes;
    private readonly _indexByTime;
    private _nextId;
    /** Register a new series; returns its id. */
    createSeries(): SeriesId;
    removeSeries(id: SeriesId): void;
    /**
     * Bulk-load (full replace) one series' data, then re-merge the time axis.
     * Input is sorted and de-duplicated by time by a private `sortedUniqueByTime`.
     */
    setSeriesData(id: SeriesId, bars: readonly Bar[]): void;
    /**
     * Upsert bars into a series by time (used for history paging / backfill /
     * out-of-order corrections — ARCHITECTURE.md §4.2). Existing times are
     * replaced; new times are inserted; the result stays time-sorted.
     *
     * Prepending older bars shifts every existing logical index up by the
     * inserted count — callers preserve the viewport by re-reading `baseIndex`
     * (the invariant `rightEdge − index` is unchanged, so visible bars don't move).
     */
    addBars(id: SeriesId, bars: readonly Bar[]): void;
    /**
     * Apply a single live bar (ARCHITECTURE.md §4.2 hot path). Returns the kind of
     * change so the chart auto-scrolls only on a genuine right-edge append:
     * - `'append'`  → newer than the last bar (advances baseIndex)
     * - `'replace'` → same time as the last bar (intra-bar tick) or an existing time
     * - `'insert'`  → an older time inserted into history (late / out-of-order)
     */
    update(id: SeriesId, bar: Bar): 'append' | 'replace' | 'insert';
    private _appendTime;
    /** Number of logical indices (distinct time points across all series). */
    get length(): number;
    /** Logical index of the latest real bar (length - 1), or -1 if empty. */
    get baseIndex(): number;
    indexToTime(index: number): number | undefined;
    timeToIndex(time: number): number | undefined;
    /**
     * Fractional logical index → UTC seconds, interpolating between bars and
     * extrapolating past either edge at the nearest bar spacing.
     *
     * `indexToTime` only answers for indices that have a bar. Anything anchored to
     * an arbitrary x — a drawing endpoint, a cursor readout, a projection to the
     * right of the last bar — needs a time for positions *between* bars too, which
     * the gapless axis (§5.3) makes common: everything a weekend or a session
     * break collapsed away lands there. Returns NaN when there is no data.
     */
    indexToTimeFloat(index: number): number;
    /** UTC seconds → fractional logical index. The inverse of `indexToTimeFloat`. */
    timeToIndexFloat(time: number): number;
    /**
     * A series' bars, time-sorted, with no per-call allocation — the read path
     * for anything that recomputes over full history (indicators, transforms).
     * The array is live: treat it as read-only.
     */
    seriesBars(id: SeriesId): readonly Bar[];
    /** All bars of a series paired with their shared logical index. */
    indexedBars(id: SeriesId): IndexedBar[];
    /**
     * Bars of a series whose logical index lies within [fromIndex, toIndex].
     * Binary-searches the (time-sorted) series into the visible time window instead
     * of scanning all bars, so a full repaint costs O(log n + visible) per series,
     * not O(total bars) - the hot path called for autoscale and drawing every frame.
     */
    visibleBars(id: SeriesId, fromIndex: number, toIndex: number): IndexedBar[];
    /** The last bar of a series with its shared logical index, in O(1). */
    lastIndexedBar(id: SeriesId): IndexedBar | null;
    private _rebuild;
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
declare const darkTheme: ChartTheme;
declare const lightTheme: ChartTheme;
declare const DEFAULT_THEME: ChartTheme;

/**
 * Chart-type registry (ARCHITECTURE.md §6A). Every series type registers a
 * descriptor: how to draw it and how it contributes to autoscale. The core
 * iterates descriptors, so adding a style is one registration — no core change.
 * Phase 5 fills the Family-A (time-indexed) types; Families B/C plug in later.
 */

type SeriesType = 'candlestick' | 'hollow-candle' | 'volume-candle' | 'bar' | 'high-low' | 'line' | 'line-markers' | 'step' | 'area' | 'hlc-area' | 'baseline' | 'column' | 'histogram' | 'point-figure' | 'kagi';
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
/** Register a chart type. `type` accepts a built-in `SeriesType` or any custom string. */
declare function registerChartType(type: SeriesType | (string & {}), entry: RendererEntry): void;
declare function getChartType(type: SeriesType | (string & {})): RendererEntry;
declare function registeredChartTypes(): string[];

/**
 * Primitive / plugin API (ARCHITECTURE.md §8). The extension point that keeps
 * the core small and powers markers, events, indicators, and the trade layer.
 * A primitive draws on a pane, optionally contributes to autoscale, and
 * optionally hit-tests for hover/drag.
 */

type ZOrder = 'bottom' | 'normal' | 'top';
interface PrimitiveRenderContext {
    timeScale: TimeScale;
    priceScale: PriceScale;
    /** The pane's primary visible price series scale, including a moved left axis. */
    readoutPriceScale?: PriceScale;
    dataLayer: DataLayer;
    plotWidth: number;
    plotHeight: number;
    priceAxisWidth: number;
    dpr: number;
    theme: ChartTheme;
    /**
     * The pane's primary price series, for a primitive that needs what price
     * actually did rather than just the scales — a forecast scoring itself, say.
     * Lazy, so nothing pays for it unless asked. Absent on synthetic contexts.
     */
    bars?: () => readonly Bar[];
    /** externalId of the primitive hit under the pointer (hover state), if any. */
    hoverId?: string | null;
    /** externalId of the line being dragged (active state), if any. */
    dragId?: string | null;
}
interface PrimitiveHit {
    externalId: string;
    zOrder: ZOrder;
    /** Pixel distance from the cursor (smaller wins ties before z-order). */
    distance: number;
    cursor?: string;
    /**
     * Arm a drag on press. Price lines set `cursor: 'ns-resize'` and move on one
     * axis; anything that moves on **both** (a drawing anchor, a whole shape)
     * declares it here, and the drag callbacks receive time as well as price.
     */
    draggable?: boolean;
}
/** Injected when a primitive is attached; lets it request a repaint. */
interface PrimitiveHost {
    requestUpdate(): void;
}
/**
 * Where chart furniture lives, as distinct from pane furniture.
 *
 * A price line belongs to a pane. A brand mark, a corner clock or a session
 * badge belongs to the CHART: it should sit at an edge of the whole stack, and
 * follow that edge as indicator panes come and go. `chart-bottom` is the common
 * case, and it also survives maximize, which hides the other panes entirely and
 * would otherwise take a pane-0 watermark with it.
 */
type PrimitiveAnchor = 'chart-top' | 'chart-bottom';
/** Passed to `addPrimitive` instead of a pane index to anchor to the chart. */
interface PrimitivePlacement {
    anchor: PrimitiveAnchor;
}
interface IPrimitive {
    /** Layer order vs series: 'bottom' (behind), 'normal' (over), 'top' (overlay). */
    zOrder(): ZOrder;
    draw(ctx: CanvasRenderingContext2D, rc: PrimitiveRenderContext): void;
    /** Optional: expand the pane's autoscale range so this primitive isn't clipped. */
    autoscaleInfo?(): {
        min: number;
        max: number;
    } | null;
    /**
     * Optional: run once per frame after every scale on the pane has been
     * measured, and before anything is painted.
     *
     * `draw` is too late for anything that has to change a scale, because the
     * price axis is painted near the top of `paintBase` while primitives draw
     * further down: a range corrected in `draw` labels its axis one frame late,
     * and on a static chart that frame never comes. A comparison overlay lining
     * its scale up with the pane's own is the case this exists for.
     */
    afterAutoscale?(): void;
    /** Optional: topmost hit under (x,y) in media px (relative to the pane plot). */
    hitTest?(x: number, y: number, rc: PrimitiveRenderContext): PrimitiveHit | null;
    attached?(host: PrimitiveHost): void;
    detached?(): void;
}
/** Pick the best hit across primitives: nearest distance, then z-order priority. */
declare function bestHit(hits: readonly (PrimitiveHit | null)[]): PrimitiveHit | null;

/**
 * `labelUp` / `labelDown` are text plates with a tail, for named signals ("Buy",
 * "Sell") rather than bare glyphs. The tail points *at* the anchor price and the
 * body sits clear of it: `labelUp`'s tail points up so its body hangs below the
 * anchor, `labelDown` is the mirror. Both require `text`.
 */
type MarkerShape = 'arrowUp' | 'arrowDown' | 'circle' | 'square' | 'triangleUp' | 'triangleDown' | 'diamond' | 'flag' | 'text' | 'labelUp' | 'labelDown';
type MarkerPosition = 'aboveBar' | 'belowBar' | 'inBar' | 'atPrice';
type MarkerSize = 'tiny' | 'small' | 'medium' | 'big';
interface SeriesMarker {
    time: number;
    position: MarkerPosition;
    price?: number;
    shape: MarkerShape;
    size: MarkerSize;
    color: string;
    text?: string;
    id?: string;
}
/** Base glyph size in CSS px for a marker size preset. */
declare function markerSizePx(size: MarkerSize): number;
/** Effective glyph px, clamped so it never exceeds the current bar spacing. */
declare function effectiveMarkerPx(size: MarkerSize, barSpacing: number): number;
declare function drawShape(ctx: CanvasRenderingContext2D, shape: MarkerShape, cx: number, cy: number, px: number, color: string): void;
/**
 * A signal label: rounded plate, contrasting text, and a tail that points at
 * `anchorY`. All coordinates are bitmap px — the caller has already applied dpr.
 * `up` puts the tail on the top edge and the body below the anchor.
 *
 * `text` may carry `\n`: the plate widens to the longest row and grows
 * downward-and-upward about its own centre, so it stays centred on `cx` and the
 * tail keeps meeting the anchor price.
 */
declare function drawLabel(ctx: CanvasRenderingContext2D, up: boolean, cx: number, anchorY: number, text: string, color: string, fontPx: number): void;
declare class SeriesMarkers implements IPrimitive {
    private readonly _seriesId;
    private _markers;
    private _host;
    private _lastPositions;
    constructor(seriesId: SeriesId);
    attached(host: PrimitiveHost): void;
    detached(): void;
    zOrder(): ZOrder;
    setMarkers(markers: readonly SeriesMarker[]): void;
    draw(ctx: CanvasRenderingContext2D, rc: PrimitiveRenderContext): void;
    hitTest(x: number, y: number): PrimitiveHit | null;
}

/**
 * Series records (ARCHITECTURE.md §4.3). A series references its rows in the
 * shared DataLayer by id, names a registered chart type, and carries a style
 * bag. The chart-type registry (§6A) supplies the renderer + autoscale extents,
 * so the core never switches on type.
 */

/**
 * Which price axis a series maps to. 'right' (default) and 'left' each draw an
 * axis and autoscale independently; '' is a hidden overlay scale (no axis, its
 * own autoscale) used to pin a volume histogram inside the price pane.
 */
type PriceScaleId = 'right' | 'left' | '';
/**
 * Value formatting for a price scale (its axis labels and crosshair tag):
 * `price` (tick-size precision), `volume` (compact 1.2K / 3.4M / 5.6B),
 * `percent` (a `%` suffix at a fixed precision), or a `custom` formatter.
 *
 * It lives here rather than beside `addSeries` because an indicator plot names
 * one too, and the model tier cannot reach into the core.
 *
 * `percent` suffixes the value as it stands and does **not** scale it: a study
 * that already returns 0..100 reads `62.24%`, and one that returns a 0..1
 * fraction reads `0.62%`. Scaling here would put the axis and the plotted value
 * into disagreement, which is the one thing a formatter must never do.
 */
type PriceFormat = {
    type: 'price';
    precision?: number;
    minMove?: number;
} | {
    type: 'volume';
} | {
    type: 'percent';
    precision?: number;
} | {
    type: 'custom';
    formatter: (value: number) => string;
};
interface SeriesRecord {
    dataId: SeriesId;
    type: SeriesType;
    style: SeriesStyle;
    scaleId: PriceScaleId;
}
/** Public handle returned by `chart.addSeries(...)`. */
interface SeriesApi {
    /** Replace all data. Accepts OHLC bars, `{ time, value }` points, or `{ time }` gaps. */
    setData(bars: readonly SeriesDataItem[]): void;
    /** Merge older data (history paging); same item shapes as `setData`. */
    prependData(bars: readonly SeriesDataItem[]): void;
    /** Live update: update the last item or append. Same item shapes as `setData`. */
    update(bar: SeriesDataItem): void;
    /** Current bars for this series (sorted old -> new, normalized to OHLC). Handy for computing the next live update. */
    getData(): Bar[];
    /** Merge a partial style into the series and repaint (recolor, `{ visible:false }` to hide, ...). */
    applyOptions(style: Partial<SeriesStyle>): void;
    /** Remove the series from its pane and free its data rows. */
    remove(): void;
    /** The price scale this series maps to (call `.setOptions({ marginTop, marginBottom })` on it). */
    priceScale(): PriceScale;
    /** Create a markers layer (buy/sell signals, shapes) bound to this series. */
    createMarkers(): SeriesMarkers;
}

/**
 * Axis label rendering (ARCHITECTURE.md §6, §5.3). Price axis (right strip) and
 * time axis (bottom strip). Time labels switch from clock to date at a day
 * boundary in the chart's configured zone, IST by default; gaps are already
 * collapsed by the logical-index time scale.
 *
 * Past the tick ladders, the file also owns the chrome that lives on the axis
 * strips: the countdown to the next bar close inside the last-price tag, the
 * crosshair's date pill, the corner session clock, and the priority rule that
 * decides which price-axis label survives a pile-up. All of it is opt-in, and an
 * axis nobody configured draws what it always drew.
 */

/**
 * Boundary class of a time-axis label, passed to a custom `timeFormatter` as a
 * hint so a host can render adaptive labels (year at year boundaries, month at
 * month boundaries, day otherwise, clock intraday) — parity with common
 * `tickMarkFormatter(time, tickMarkType)` APIs.
 */
type TickMarkType = 'year' | 'month' | 'day' | 'time' | 'timeWithSeconds';
interface AxisStyle {
    textColor: string;
    lineColor: string;
    font: string;
}
/**
 * A clock reading UTC seconds (fractional allowed).
 *
 * Live chrome takes one of these rather than calling `Date.now()` itself: a test
 * has to hold time still, replay runs on the time of the bar being replayed, and
 * a terminal that trusts the exchange's clock over the browser's has to be able
 * to substitute its own. A renderer that reached for the global clock could
 * serve none of the three.
 */
type ClockSource = () => number;
/** The countdown row inside the last-price tag. Absent or `visible: false` draws no row. */
interface BarCountdownOptions {
    /** Draw the row. Unset or false leaves the tag exactly one line, as before. */
    visible?: boolean;
    /** UTC seconds now. Never `Date.now()` reached for here, see `ClockSource`. */
    now: ClockSource;
    /** Open time (UTC seconds) of the last bar on the chart. */
    lastBarTime: number;
    /** Bar interval in seconds, e.g. from `medianBarInterval`. */
    intervalSec: number;
}
/** The corner session clock. Absent or `visible: false` leaves the corner empty. */
interface SessionClockOptions {
    /** Draw the clock. Unset or false draws nothing at all. */
    visible?: boolean;
    /** UTC seconds now. Never `Date.now()` reached for here, see `ClockSource`. */
    now: ClockSource;
    /** IANA zone the clock reads in; unset means the shipped default. */
    timezone?: string;
    /** Second row carrying the zone's offset from UTC. Default true. */
    showOffset?: boolean;
}

/**
 * The Canvas tab's crosshair controls. Same precedence as the rest of the
 * canvas block (see grid.ts): set overrides the theme, unset falls through.
 */
interface CrosshairOptions {
    /** Line colour. Unset falls back to `theme.crosshair`. */
    color?: string;
    /** Line dash. Unset falls back to `theme.crosshairStyle`, then dashed. */
    style?: CanvasLineStyle;
    /** Line width in device px (1 = hairline). Unset falls back to the theme. */
    width?: number;
}
/** Resolved crosshair line style, ready for `drawCrosshair`. */
interface CrosshairStyle {
    color: string;
    width: number;
    dash: number[];
}
/** Fold the crosshair options over the theme. */
declare function resolveCrosshairStyle(theme: Pick<ChartTheme, 'crosshair' | 'crosshairStyle' | 'crosshairWidth'>, opts: CrosshairOptions | undefined, dpr: number): CrosshairStyle;

/** Dash style shared by the grid, crosshair and any other chrome line. */
type CanvasLineStyle = 'solid' | 'dashed' | 'dotted';
/**
 * Dash pattern in device px for a line style. `solid` (and an unset style)
 * yields an empty array, which is what `setLineDash` wants for a plain line.
 */
declare function dashPattern(style: CanvasLineStyle | undefined, dpr: number): number[];
interface GridOptions {
    /** Target spacing between grid lines, in media px. */
    spacing: number;
    /** Draw the vertical (time) lines. Default true. */
    vertLines?: boolean;
    /** Draw the horizontal (price) lines. Default true. */
    horzLines?: boolean;
    /** Vertical line colour. Unset falls back to `theme.grid`. */
    vertColor?: string;
    /** Horizontal line colour. Unset falls back to `theme.grid`. */
    horzColor?: string;
    /** Vertical line dash. Unset falls back to `theme.gridStyle`, then solid. */
    vertStyle?: CanvasLineStyle;
    /** Horizontal line dash. Unset falls back to `theme.gridStyle`, then solid. */
    horzStyle?: CanvasLineStyle;
    /** Line width in media px. Default 1. */
    lineWidth?: number;
}
/** Colour + dash for one axis of the grid. */
interface GridAxisStyle {
    color?: string;
    /** Dash pattern (device px already applied by the caller's dpr). */
    dash?: number[];
}
interface GridStyle {
    color: string;
    lineWidth: number;
    /** Optional dash pattern (device px already applied by the caller's dpr). */
    dash?: number[];
    /** Vertical-line overrides; each field falls back to the flat pair above. */
    vert?: GridAxisStyle;
    /** Horizontal-line overrides; each field falls back to the flat pair above. */
    horz?: GridAxisStyle;
}
/**
 * Fold the canvas grid options over the theme into the style `drawGrid` takes.
 * `theme.grid` / `theme.gridStyle` are the defaults for both axes; a per-axis
 * option replaces one of them without disturbing the other.
 */
declare function resolveGridStyle(theme: Pick<ChartTheme, 'grid' | 'gridStyle'>, opts: Partial<GridOptions> | undefined, dpr: number): GridStyle;
/** The "Scales: Text" and "Scales: Lines" controls. */
interface ScaleCanvasOptions {
    /** Tick label colour. Unset falls back to `theme.axisText`. */
    textColor?: string;
    /** Tick label size in px, clamped to the dialog's 10..14 range. */
    fontSize?: number;
    /** Axis line and tick colour. Unset falls back to `theme.axisLine`. */
    lineColor?: string;
}
/** Bounds of the "Scales: Text" size control. */
declare const SCALE_FONT_MIN = 10;
declare const SCALE_FONT_MAX = 14;
/**
 * Fold the scale options over the theme into the axis renderer's style.
 *
 * Only the *option* is clamped to 10..14: a theme is code, not a dialog, and a
 * host that set `axisFontSize: 16` deliberately keeps it.
 */
declare function resolveScaleStyle(theme: Pick<ChartTheme, 'axisText' | 'axisLine' | 'axisFontSize'>, opts: ScaleCanvasOptions | undefined): AxisStyle;
/** Plot-area margins, in percent of pane height (the dialog's units). */
interface PlotMarginOptions {
    top?: number;
    bottom?: number;
}
/**
 * Percent -> the fraction `PriceScaleOptions.marginTop/marginBottom` already
 * store. There is no second margin state: the price scale stays the owner, this
 * only converts the dialog's units. Each side is capped at 49% so the pair
 * always leaves a band for the data (the scale itself only guards the sum with
 * a 1% floor, which would squash the plot to a line).
 */
declare function resolvePlotMargins(opts: PlotMarginOptions | undefined): {
    marginTop?: number;
    marginBottom?: number;
};
/**
 * Everything the settings dialog's Canvas tab can set, in one block.
 *
 * No watermark field: the mark is a primitive the host owns and configures
 * (`LogoWatermark`), so a switch here would be a stored value nothing reads.
 * Same rule as the settings schema itself, see model/chart-settings.ts.
 */
interface CanvasOptions {
    grid?: Partial<GridOptions>;
    crosshair?: CrosshairOptions;
    scales?: ScaleCanvasOptions;
    /** Plot-area margins in percent of pane height. */
    margins?: PlotMarginOptions;
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
 * The `renderer` chart option. `'auto'` picks `webgl2` when a backend of that
 * kind is registered and available on this device, and `canvas2d` otherwise,
 * which is every chart until that tier is imported.
 */
type RendererChoice = RenderBackendKind | 'auto';
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
/**
 * Why a chart left its GPU backend: the context went away mid-session, or
 * the device turned out to be unusable after the backend was built (the
 * program failed to compile on a live context).
 */
type RendererFallbackReason = 'context-lost' | 'unavailable';
/**
 * Whether a backend is painting through its own 2D fallback rather than the
 * path it was chosen for, and why. Null for a healthy backend and always for
 * `canvas2d`, which has nothing to fall back from.
 */
declare function backendDegradation(backend: IRenderBackend): RendererFallbackReason | null;
/**
 * Builds a backend for one pane, or returns null to decline: a `webgl2`
 * factory on a device without WebGL2 says so here, and the chart falls back
 * to `canvas2d` rather than painting nothing.
 */
type RenderBackendFactory = () => IRenderBackend | null;
/** Register (or replace) the factory for a backend kind. */
declare function registerRenderBackend(kind: RenderBackendKind, factory: RenderBackendFactory): void;
/**
 * Drop a registered backend. The 2D backend is refused: it is the fallback
 * every other choice lands on, and a chart with no backend paints nothing.
 */
declare function unregisterRenderBackend(kind: RenderBackendKind): boolean;
declare function registeredRenderBackends(): RenderBackendKind[];
/**
 * Turn the `renderer` option into a factory the chart calls once per pane.
 *
 * An explicit kind that nothing has registered throws, the way an unloaded
 * chart type does: the caller asked for a tier they did not import, and a
 * silent 2D fallback would hide that. A registered factory that declines at
 * run time (no WebGL2 on this device) falls back to `canvas2d` instead,
 * because that is a property of the machine, not a mistake in the code.
 */
declare function resolveRenderBackend(choice?: RendererChoice): RenderBackendFactory;
/** One backend instance for the given choice; see `resolveRenderBackend`. */
declare function createRenderBackend(choice?: RendererChoice): IRenderBackend;

/**
 * A pane is one vertically-stacked drawing region (price pane, volume pane,
 * indicator pane). It owns a base + top canvas (ARCHITECTURE.md §3.1) and a
 * price scale, and renders its series against the shared time scale + DataLayer.
 *
 * The canvas pile, bottom to top, and what lands on each:
 *
 *   base canvas (2D context, z 0): background, grid, the series pass, the
 *     normal-layer primitives, the axis strip (ladder, last-price tag, value
 *     tags, trading pills). Repainted on Light and Full.
 *   top canvas (2D context, z 1): crosshair, hover highlights, primitives
 *     being dragged. Repainted on Cursor.
 *
 * A GPU backend adds no canvas to the pile. It rasterises the series pass on
 * one page-wide offscreen surface shared by every pane of every chart and
 * blits the result into the base canvas at `endFrame`, between the grid and
 * the normal-layer primitives, exactly where the 2D backend would have
 * painted them. That is why the grid, the primitives, the axes and the
 * overlay keep painting on 2D contexts whatever the backend is, why
 * `takeScreenshot` and the export still read `base.element`, and why a
 * browser's cap on live WebGL contexts never limits how many panes a page
 * can show.
 */

interface PaneRenderContext {
    timeScale: TimeScale;
    dataLayer: DataLayer;
    dpr: number;
    priceAxisWidth: number;
    /** Left inset (px) reserved chart-wide for a left price axis; 0/absent when none. */
    leftAxisWidth?: number;
    timeAxisHeight: number;
    /** Only the bottom pane draws the time axis. */
    showTimeAxis: boolean;
    /** Enable OHLC-preserving conflation when bars fall below ~0.5px (§4.4). */
    conflate: boolean;
    /** Conflation aggressiveness (1 = perf only; higher = more smoothing). */
    conflationFactor: number;
    /** Active palette — drives chrome, series defaults, and trade colors. */
    theme: ChartTheme;
    /** Draw the vertical (time) grid lines. */
    showVertGrid: boolean;
    /** Draw the horizontal (price) grid lines. */
    showHorzGrid: boolean;
    /**
     * The settings dialog's Canvas block (grid, crosshair, scales, margins).
     * Named `canvasOptions` rather than `canvas` so it is never mistaken for the
     * canvas element. Every field is an override: unset falls back to the theme.
     */
    canvasOptions?: CanvasOptions;
    /** Optional custom time label formatter (UTC seconds -> string). Defaults to IST. */
    timeFormatter?: (utcSeconds: number, tickMark?: TickMarkType) => string;
    /**
     * IANA zone the time axis and crosshair label in. Absent means the shipped
     * default ('Asia/Kolkata'); an explicit `timeFormatter` outranks it, because a
     * host that formats its own labels has already decided the question.
     */
    timezone?: string;
    /**
     * The corner clock between the two axis strips. Absent draws nothing, which
     * is the shipped chart: it is chrome a host asks for.
     */
    sessionClock?: SessionClockOptions;
    /**
     * The countdown row inside the last-price tag. Absent leaves the tag the one
     * line it has always been.
     */
    barCountdown?: BarCountdownOptions;
    /** externalId of the primitive under the pointer (hover visual state). */
    hoverId?: string | null;
    /** externalId of the line currently being dragged (active visual state). */
    dragId?: string | null;
    /**
     * Fill the pane with the theme background before anything else. Absent means
     * yes, which is every on-screen frame; the vector export turns it off for a
     * document that is meant to sit on the host's own page.
     */
    paintBackground?: boolean;
}
declare class Pane {
    readonly element: HTMLElement;
    readonly base: CanvasLayer;
    readonly top: CanvasLayer;
    /**
     * What paints this pane's series onto `base`. Everything else on that canvas
     * (background, grid, axes, primitives) the pane draws itself on the 2D
     * context the backend hands back, so a GPU backend only has to own the one
     * pass that is worth moving. Replaced through `setBackend` when the chart
     * falls back to 2D for the session.
     */
    private _backend;
    private _rightScale;
    /** Extra scales created on demand: left axis and a hidden overlay (volume). */
    private _leftScale;
    private _overlayScale;
    /**
     * Scales whose price-per-bar ratio is pinned, with the geometry the ratio was
     * last held against. A lock stores that geometry rather than a number,
     * because the ratio lives in the scale's *transformed* span (log prices are
     * not linear in price) and only the scale itself can measure that. Every
     * later change in bar spacing or pane height is answered by the opposite
     * change in the visible span, which needs no such measurement.
     */
    private readonly _ratioLocks;
    /** Relative height weight within the chart (price=1, volume≈0.3). */
    weight: number;
    private readonly _series;
    private readonly _primitives;
    private _width;
    private _height;
    /**
     * `backend` defaults to the 2D one so a pane built on its own (tests, a host
     * composing panes by hand) paints the way it always has; the chart passes
     * whatever its `renderer` option resolved to.
     */
    constructor(doc: Document, backend?: IRenderBackend);
    get backend(): IRenderBackend;
    /**
     * Swap the backend for the rest of the session: the old one releases its
     * resources, the new one takes the base canvas and its context and is told
     * the current size, so it is ready for the very next frame. The chart calls
     * this for every pane at once when a GPU backend degrades, so a chart never
     * paints half its panes one way and half the other.
     */
    setBackend(next: IRenderBackend): void;
    /**
     * Why the backend is painting through its 2D fallback rather than the path
     * it was chosen for, or null. Read by the chart after each frame; the
     * answer is a property of the device, so it is the same for every pane
     * sharing it.
     */
    get backendDegradation(): RendererFallbackReason | null;
    /**
     * The 'right' scale: the pane's primary axis, and the one a series maps to
     * unless it names another. A getter over a field rather than a plain readonly
     * property because `moveSeriesScale` swaps the two side scales, and the range,
     * mode, margins, tick size and formatter all belong to the axis being moved.
     */
    get priceScale(): PriceScale;
    addSeries(record: SeriesRecord): void;
    /** The PriceScale for a scale id, creating the left/overlay scale on first use. */
    private _scaleFor;
    /**
     * The scale for an id, created if this pane has never used it. A host acting
     * on one axis (a price-axis menu) needs the scale a side *would* use, not
     * only the ones series happen to occupy; an empty scale draws nothing,
     * because both the axis strip and the left column are gated on a scale
     * having been measured.
     */
    scaleFor(id: PriceScaleId): PriceScale;
    /** True when some series on this pane maps to the named scale. */
    usesScale(id: PriceScaleId): boolean;
    /**
     * Move every series on one side's scale to the other side, axis and all.
     *
     * The two scale objects are swapped rather than their state copied across:
     * the range, mode, margins, tick size and any custom formatter are all
     * properties of the axis being moved, and copying would have to enumerate
     * every one of them (and gain a field each time one is added). What is left
     * behind carries nothing, so it is reset: keeping its range would label the
     * vacated strip with a ladder for prices that are no longer on that side.
     *
     * Refuses when the target side already carries series. One side draws one
     * axis, so a move onto an occupied side could only mean stacking two ladders
     * in one strip or silently sending the sitting tenant the other way, and
     * neither is what "move this axis to the left" asks for.
     */
    moveSeriesScale(from: 'right' | 'left', to: 'right' | 'left'): boolean;
    /** Whether this scale's price-per-bar ratio is currently pinned. */
    ratioLocked(id: PriceScaleId): boolean;
    /**
     * Pin (or release) the price-per-bar ratio of one scale, against the geometry
     * in force right now. A locked scale is manual by definition: autoscaling it
     * would re-fit the data every frame and undo the ratio being held.
     *
     * Locking a scale nothing has measured does nothing: there is no ratio to
     * hold yet, and switching it to manual would strand it on the 0..1
     * placeholder with nothing left to measure it. Returns whether the scale
     * ended up in the state asked for; releasing always succeeds.
     */
    setRatioLock(id: PriceScaleId, on: boolean, barSpacing: number, plotHeight: number): boolean;
    /** Release every ratio lock on this pane (resetting the view drops them). */
    clearRatioLocks(): void;
    /** The price scale a series maps to (for the series handle's `priceScale()`). */
    scaleOf(record: SeriesRecord): PriceScale;
    /**
     * Every scale this pane has actually created. The left and overlay scales are
     * built on demand, so a caller applying a pane-wide setting (plot margins,
     * label precision) needs the live set rather than all three ids.
     */
    scales(): PriceScale[];
    /**
     * The scales that draw a ladder: the right one and, once something uses it,
     * the left. The hidden overlay scale is deliberately not here.
     *
     * That scale is positioned by whoever created it and by nobody else. A volume
     * histogram sitting in the bottom fifth of the price pane is an overlay with
     * `marginTop: 0.82`, and a chart-wide plot-margin change that swept it up
     * with the visible axes replaced that 0.82 with the dialog's number: the bars
     * grew to fill most of the pane, and putting the dialog back where it started
     * wrote 0.1, not the 0.82 nobody had recorded. Destructive and unrecoverable,
     * from a control that only claims to move the plot inside its own axes.
     */
    axisScales(): PriceScale[];
    /** True when a left-axis scale is active (some series maps to it). */
    hasLeftScale(): boolean;
    /** Remove a series record if present; returns true if it was found. */
    removeSeries(record: SeriesRecord): boolean;
    series(): readonly SeriesRecord[];
    /** Primitives attached to this pane, in draw order. */
    primitives(): readonly IPrimitive[];
    addPrimitive(primitive: IPrimitive, host: PrimitiveHost): void;
    /** Whether this pane currently holds `primitive`. */
    hasPrimitive(primitive: IPrimitive): boolean;
    /** Remove a primitive if present; returns true if it was found. */
    removePrimitive(primitive: IPrimitive): boolean;
    /** Detach every primitive (lifecycle cleanup) and remove the pane element. */
    destroy(): void;
    private _primitiveContext;
    /** Topmost primitive hit at media-px (x,y) relative to this pane's plot. */
    hitTestPrimitives(x: number, y: number, ctx: PaneRenderContext): PrimitiveHit | null;
    resize(width: number, height: number, dpr: number): void;
    /**
     * Lay the pane out at a size without touching its canvases. The vector
     * export paints at a size of the caller's choosing and then puts the live
     * size back; resizing a canvas clears it, so going through `resize` would
     * blank the screen until the next frame.
     */
    setLayoutSize(width: number, height: number): void;
    /**
     * Give every scale on this pane its plot height. Height is a *layout*
     * property, but it used to be set only inside the autoscale pass — so any
     * y↔price conversion before the first paint divided by zero and returned
     * ±Infinity. Layout is when the height is actually known.
     */
    setScaleHeights(plotHeight: number): void;
    private _layout;
    /** Autoscale each active price scale from its own series (independent axes). */
    autoscale(ctx: PaneRenderContext, progress?: number): boolean;
    private _autoscaleScale;
    /**
     * Hold every locked scale's price-per-bar ratio against the geometry it is
     * being painted into. A bar is `barSpacing` px wide and the plot is
     * `plotHeight` px tall, so a fixed ratio means the visible price span moves
     * with height / barSpacing: zoom in on time and the same slope needs fewer
     * prices in view to keep drawing at the same angle.
     */
    private _applyRatioLocks;
    /**
     * Multiply a scale's visible span by `factor` around the middle of the pane,
     * in the scale's own transformed space so a log axis scales by decades rather
     * than by price. Reading the endpoints back through `yToPrice` is what keeps
     * this transform-agnostic: y is linear in transformed space by construction,
     * whichever mode the scale is in.
     */
    private _scaleSpan;
    /** Close of the first visible bar on this scale: the rebasing modes quote against it. */
    private _firstVisibleValue;
    /**
     * Paint background + grid + series + axes on the base canvas, or into
     * `target` when given: the vector export runs this exact pass into a
     * serialising context, so what it produces is the frame and not a
     * re-description of it. Only the pane's own canvas is cleared first; a
     * target starts empty by construction.
     */
    paintBase(ctx: PaneRenderContext, target?: CanvasRenderingContext2D): void;
    /**
     * Top (overlay) canvas: top-layer primitives + crosshair. Cheap repaint on
     * cursor moves. `cross.x` is the shared plot x (vertical line, drawn in every
     * pane for a global crosshair); `cross.yLocal` is the price-line y for the
     * hovered pane only (null elsewhere); `cross.showTimeTag` draws the date tag
     * on the bottom pane's axis strip.
     */
    paintTop(cross: {
        x: number;
        yLocal: number | null;
        showTimeTag: boolean;
    } | null, ctx: PaneRenderContext, target?: CanvasRenderingContext2D): void;
    /**
     * The scale this pane's price readout belongs to: the one its first visible
     * price series maps to, falling back to the right scale. A pane whose series
     * sit on the left axis has nothing on the right one, and reading the
     * crosshair price off it would tag the cursor with the 0..1 placeholder.
     */
    private _readoutScale;
    /**
     * The scale a price quoted for this pane belongs to: the crosshair readout,
     * the price on a click or a drag, and the chart's coordinate API all mean
     * this one. It is the right scale in every layout that has not moved an axis.
     */
    readoutScale(): PriceScale;
    /** Media-px y of a price on this pane's readout scale. The inverse of `yToPrice`. */
    priceToY(price: number): number;
    /**
     * Width of the box `drawCrosshairTag` draws for this text, in bitmap px. The
     * font and padding are restated from it because it measures privately and a
     * left-hand tag has to know its own width before it can be positioned.
     */
    private _tagWidth;
    /** Price at a media-px y on this pane (crosshair magnet, click/drag readout). */
    yToPrice(y: number): number;
}

/**
 * A grid overlay pinned to a corner of the pane rather than to bars.
 *
 * Seasonality heatmaps, performance summaries and signal scoreboards are all
 * the same shape: a small table of coloured cells that stays put while the
 * chart pans underneath. That makes this a screen-space primitive like the
 * watermark and the pane legend, not a series: it has no time anchor, takes no
 * part in autoscale, and survives a zoom untouched.
 */

type TablePosition = 'top-left' | 'top-center' | 'top-right' | 'middle-left' | 'middle-center' | 'middle-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
interface TableCell {
    text: string;
    /** Cell fill. Transparent when omitted, so the pane shows through. */
    bgColor?: string;
    /** Text colour. Derived from `bgColor` for contrast when omitted. */
    textColor?: string;
    align?: 'left' | 'center' | 'right';
    /** Overrides the table's `fontSize` for this cell, for a heading row. */
    fontSize?: number;
    bold?: boolean;
}
interface ChartTableOptions {
    position: TablePosition;
    /** Gap from the pane edge, media px. */
    margin: number;
    /** Column width in media px. A per-column array sizes each one separately. */
    cellWidth: number | readonly number[];
    cellHeight: number;
    fontSize: number;
    /** Grid line colour. Omit to draw no grid. */
    borderColor?: string;
    borderWidth: number;
    /**
     * Table width as a percentage of the plot, 0 or omitted to size from
     * `cellWidth` instead. Column proportions are preserved, so a per-column
     * `cellWidth` array still controls the relative widths, and the percentage
     * only decides the total.
     */
    widthPercent?: number;
    /** Table height as a percentage of the plot, 0 or omitted to size from `cellHeight`. */
    heightPercent?: number;
    /**
     * Relative row heights, one per row, defaulting to 1. A separator row is the
     * reason this exists: stretched to fill a pane, an equal split makes a rule
     * between two sections as tall as the sections themselves.
     */
    rowWeights?: readonly number[];
    /** Backdrop behind the whole grid, drawn before the cells. */
    background?: string;
    /** Hit-test id, so a host can route clicks the way it does for other primitives. */
    id?: string;
}
declare const DEFAULT_CHART_TABLE_OPTIONS: ChartTableOptions;
/** Top-left corner of the grid for a position keyword, in media px. */
declare function tableOrigin(position: TablePosition, margin: number, w: number, h: number, plotW: number, plotH: number): {
    x: number;
    y: number;
};
declare class ChartTable implements IPrimitive {
    private _rows;
    private _opts;
    private _host;
    /** Last drawn rect in media px, for hit-testing without recomputing layout. */
    private _rect;
    constructor(options?: Partial<ChartTableOptions>);
    attached(host: PrimitiveHost): void;
    detached(): void;
    zOrder(): ZOrder;
    options(): Readonly<ChartTableOptions>;
    setOptions(patch: Partial<ChartTableOptions>): void;
    /** Replace the grid. Rows may be ragged; each is drawn to its own length. */
    setRows(rows: readonly (readonly TableCell[])[]): void;
    rows(): readonly (readonly TableCell[])[];
    draw(ctx: CanvasRenderingContext2D, rc: PrimitiveRenderContext): void;
    hitTest(x: number, y: number): PrimitiveHit | null;
}

/**
 * Indicator registry (ARCHITECTURE.md §6A, §8). The sibling of the chart-type
 * registry: that one answers *"how do I paint an array of bars"*, this one
 * answers *"what do I compute, what does it plot, and what can a user tune"*.
 *
 * A descriptor is data, not code-in-the-core — the chart never switches on an
 * indicator id. Each `plot` names a registered **chart type**, so indicators
 * ride the existing Family-A renderers and add no drawing code at all.
 *
 * The built-in descriptors live in the lazy `openalgo-charts/indicators` tier;
 * only the registry and the runtime ship in the base bundle, so an app that
 * plots its own maths pays nothing for the catalog.
 */

/** Which price a calculation reads from each bar. */
type IndicatorSource = 'open' | 'high' | 'low' | 'close' | 'hl2' | 'hlc3' | 'ohlc4' | 'volume';
/**
 * One tunable input. `type` is what a settings UI renders; the core only reads
 * `key`/`default`.
 *
 * `tooltip` is help text for the row. A label has to stay short enough to fit a
 * dense panel, which leaves nowhere to say what a parameter actually does, and a
 * ported study whose every input carried an explanation arrives here with that
 * explanation dropped. A settings UI renders it as a hover affordance beside the
 * label; the core ignores it.
 */
type IndicatorInput = {
    key: string;
    type: 'number';
    label: string;
    default: number;
    min?: number;
    max?: number;
    step?: number;
    group?: string;
    tooltip?: string;
} | {
    key: string;
    type: 'boolean';
    label: string;
    default: boolean;
    group?: string;
    tooltip?: string;
} | {
    key: string;
    type: 'color';
    label: string;
    default: string;
    group?: string;
    tooltip?: string;
} | {
    key: string;
    type: 'text';
    label: string;
    default: string;
    group?: string;
    tooltip?: string;
} | {
    key: string;
    type: 'select';
    label: string;
    default: string;
    options: readonly {
        label: string;
        value: string;
    }[];
    group?: string;
    tooltip?: string;
} | {
    key: string;
    type: 'source';
    label: string;
    default: IndicatorSource;
    group?: string;
    tooltip?: string;
};
/** Dash pattern for a level, a drawing, or a plot. */
type IndicatorLineStyle = 'solid' | 'dashed' | 'dotted';
/** Line-style options, for a settings UI's Style tab. */
declare const INDICATOR_LINE_STYLES: readonly {
    label: string;
    value: string;
}[];
/** Settings keys the runtime derives for a plot's appearance. */
declare function plotStyleKeys(plot: IndicatorPlot): {
    color: string;
    width: string;
    lineStyle: string;
    opacity: string;
    type: string;
};
/**
 * Per-plot appearance inputs, generated from the descriptor rather than
 * hand-written on each one — every indicator gets colour, opacity, thickness,
 * and line style for free, and a settings UI can render them as a "Style" tab
 * beside the descriptor's own `inputs`.
 *
 * Defaults come from the plot's declared style (and its legacy `colorKey`), so
 * an indicator that already ships colours keeps them.
 */
declare function indicatorStyleInputs(descriptor: IndicatorDescriptor): IndicatorInput[];
/**
 * Chart types a plot can be re-rendered as. A moving average is a line by
 * default, but the same column of numbers reads better as a histogram or an
 * area depending on what you are looking for — and a descriptor cannot know
 * which. Restricted to the types that make sense for a single value column.
 */
declare const INDICATOR_PLOT_STYLES: readonly {
    label: string;
    value: string;
}[];
/** Canonical option list for a `type: 'source'` input, for settings UIs. */
declare const INDICATOR_SOURCES: readonly {
    label: string;
    value: IndicatorSource;
}[];
type IndicatorSettings = Record<string, unknown>;
/** One plotted line/band/histogram. `type` is any registered chart type. */
/** A shaded band between two of an indicator's plots. */
interface IndicatorFillSpec {
    /** The two plot keys to fill between. */
    between: readonly [string, string];
    /** Colour where the first plot is above the second. */
    colorUp?: string;
    /** Colour where the second is above the first. */
    colorDown?: string;
    /** Settings keys holding those colours, so the band is restyleable. */
    colorUpKey?: string;
    colorDownKey?: string;
    /** 0..1. Defaults to 0.12. */
    opacity?: number;
}
interface IndicatorPlot {
    /** Key into the `calc` result. */
    key: string;
    /** Registered chart type used to draw it ('line', 'histogram', 'area', ...). */
    type: SeriesType;
    /** Legend title. */
    title: string;
    /** Style overrides merged onto the chart type's defaults. */
    style?: SeriesStyle;
    /** Price axis for this plot. Defaults to 'right'. */
    priceScaleId?: PriceScaleId;
    /**
     * Value formatting for the axis and crosshair tag of the scale this plot maps
     * to: `percent` for a ratio study, `volume` for a cumulative one, `custom` for
     * anything else.
     *
     * Like `style.precision`, this is a property of the **price scale**, not of the
     * series, so it belongs to a plot that owns its pane. Setting it on an
     * `'onchart'` plot reformats the instrument's own axis, which is almost never
     * what a study wants.
     *
     * `percent` suffixes the value as it stands and does not scale it, so a study
     * returning a 0..1 fraction should keep returning it and read `0.62%`. Scaling
     * inside `calc` to make the axis read better changes the plotted value, and the
     * legend, the crosshair and every downstream calculation with it.
     */
    priceFormat?: PriceFormat;
    /**
     * Draw this one plot on the price pane even though the indicator owns a pane
     * of its own. An oscillator that also wants a signal
     * band or a stop line sitting on the candles is the case: the study belongs in
     * its own pane, one of its columns belongs on price, and splitting it into two
     * indicators would make the user configure the same inputs twice.
     *
     * Ignored for an `'onchart'` descriptor, which is already on the price pane.
     */
    overlay?: boolean;
    /**
     * Settings key holding this plot's color, so a settings change restyles the
     * series without a full rebuild.
     */
    colorKey?: string;
    /**
     * Four `calc` keys to draw this plot as bar-shaped elements instead of one
     * value per bar: candles, hollow candles, OHLC bars, high-low.
     *
     * A single column cannot express those at all, and the alternative (a second
     * result shape for `calc`) would fork the contract every descriptor and every
     * helper is written against. Naming four columns inside the *same*
     * `IndicatorValues` keeps one shape: a smoothed Heikin-Ashi overlay, a
     * higher-timeframe candle, a synthetic spread instrument each return four
     * ordinary columns and point at them from here.
     *
     * The named columns must all exist and be bar-aligned, or `addIndicator`
     * throws. `key` stays the series identity and the legend reading falls back to
     * the `close` column.
     */
    ohlc?: {
        open: string;
        high: string;
        low: string;
        close: string;
    };
    /**
     * Per-bar colour, for plots whose meaning changes bar to bar — a MACD
     * histogram is four colours by sign and direction, a conditional study two.
     * Return `undefined` to fall back to the plot's own colour.
     *
     * Reaches the renderer as `Bar.color`, so every Family-A plot type honours
     * it: histogram, column, candles, OHLC bars, line, step and area.
     */
    colorBy?(ctx: {
        value: number;
        index: number;
        values: IndicatorValues;
        settings: IndicatorSettings;
    }): string | undefined;
}
/** A horizontal reference level (RSI 70/30, Stochastic 80/20, a zero line). */
interface IndicatorLevel {
    price: number;
    color?: string;
    title?: string;
    /** Legacy two-state dash switch. `lineStyle` wins when both are given. */
    dashed?: boolean;
    lineWidth?: number;
    lineStyle?: IndicatorLineStyle;
}
/** One end of an indicator drawing: a time on the shared axis, a price on the pane's scale. */
interface DrawAnchor {
    time: number;
    price: number;
}
/**
 * A free-standing shape an indicator paints in its own pane, anchored to time
 * and price rather than to a bar index.
 *
 * Plots, levels and markers each answer a different question and none of them
 * answers this one: a pivot-to-pivot trendline, a supply zone, an order block,
 * a measured-move projection are all geometry between two arbitrary points, and
 * a column of one value per bar cannot express any of them. Anchors are times,
 * so a shape stays put when history is paged in and every logical index shifts.
 */
type IndicatorDrawing = {
    kind: 'line';
    from: DrawAnchor;
    to: DrawAnchor;
    color?: string;
    lineWidth?: number;
    lineStyle?: IndicatorLineStyle;
    /** Continue the line past its anchor to the pane edge. */
    extendLeft?: boolean;
    extendRight?: boolean;
} | {
    kind: 'box';
    from: DrawAnchor;
    to: DrawAnchor;
    /** Border colour. Omit `fillColor` to draw an outline only. */
    color?: string;
    fillColor?: string;
    /** Fill alpha, 0..1. Defaults to 0.12. */
    opacity?: number;
    lineWidth?: number;
    /** Caption drawn on a plate at the centre of the box; `\n` splits lines. */
    text?: string;
    textColor?: string;
} | {
    kind: 'label';
    at: DrawAnchor;
    /** `\n` splits lines. */
    text: string;
    /** Plate fill. */
    color?: string;
    textColor?: string;
    /** Which edge of the plate sits on the anchor. Defaults to 'center'. */
    align?: 'left' | 'center' | 'right';
} | {
    kind: 'polyline';
    points: readonly DrawAnchor[];
    color?: string;
    lineWidth?: number;
    /** Close the path back to the first point (a triangle, a wedge). */
    closed?: boolean;
    fillColor?: string;
    /** Fill alpha, 0..1. Defaults to 0.12. */
    opacity?: number;
};
/** `calc` output: one array per plot key, aligned 1:1 with the input bars. */
type IndicatorValues = Record<string, readonly (number | null)[]>;
/** Per-instance scratch owned by the descriptor (Tier-2 data lands here). */
type IndicatorStore = Record<string, unknown>;
/**
 * The fourth, optional argument to `calc` (and the sixth to `calcTail`): what
 * the calculation cannot read off the bars themselves.
 *
 * It is optional so that every descriptor written against `calc(bars, settings,
 * store)` keeps its exact signature and its exact behaviour, which is the whole
 * point: a calculation that ignores the context computes what it always did.
 */
interface IndicatorCalcContext {
    /**
     * Where the last bar stands, so a study can act once per bar rather than once
     * per tick, or refuse to signal off a bar that is still moving.
     */
    barState: {
        /** The most recent update appended a bar rather than replacing one. */
        isNew: boolean;
        /** The last bar has closed: its interval has elapsed on the chart clock. */
        isConfirmed: boolean;
        /** A live feed is driving updates, rather than a one-off history load. */
        isRealtime: boolean;
        /** Index of the last bar, `bars.length - 1` (-1 when there are none). */
        lastIndex: number;
    };
    /** The instrument, when the host knows one. See `IndicatorAttachContext`. */
    symbol?: string;
    /** The timeframe (`'5m'`, `'1d'`), on the same terms as `symbol`. */
    interval?: string;
    /** The chart's IANA zone, the calendar its axis is labelled in. */
    timezone: string;
    /** Chart wall clock in UTC seconds, the clock the countdown row reads. */
    now(): number;
    /**
     * The instrument's tick size, from the **price pane's** `minMove`.
     *
     * The price pane and not the indicator's own, because `calc` runs on the
     * instrument's bars whichever pane the plot lands in, and a study pane is not
     * quoted in the instrument's tick: an RSI is a dimensionless 0..100 band, so
     * its scale carries no tick at all to read.
     *
     * `undefined` when the host has not told the chart what it is, which is the
     * honest answer rather than a guessed 0.01: an indicator sizing a range in
     * ticks has to tell "one paisa" apart from "nobody said".
     */
    tickSize?: number;
}
/** What an alert's `when` predicate is handed, for the bar it is judging. */
interface IndicatorAlertContext {
    bars: readonly Bar[];
    values: IndicatorValues;
    settings: Readonly<IndicatorSettings>;
    /** The bar being evaluated. */
    index: number;
}
/**
 * A condition the runtime watches, declared by the descriptor rather than wired
 * up by the host: the indicator is the only thing that knows what a crossover of
 * its own columns means.
 *
 * Evaluated once per bar, for bars that are new since the last evaluation, so
 * adding the indicator to a loaded chart fires nothing for history.
 */
interface IndicatorAlertSpec {
    /** Stable within the descriptor, e.g. `'cross-up'`. */
    id: string;
    /** Short human label, e.g. `'MACD crossed up'`. */
    title: string;
    /** Longer text for a notification; defaults to `title`. */
    message?: string;
    when(ctx: IndicatorAlertContext): boolean;
}
/** Payload of the `'indicator:alert'` event on the chart's own bus. */
interface IndicatorAlertPayload {
    /** Descriptor id, e.g. `'macd'`. */
    indicatorId: string;
    /** Instance id, so a host can tell three EMAs apart. */
    instanceId: string;
    alertId: string;
    title: string;
    message: string;
    /** The bar that triggered it: UTC seconds, and its index in `bars`. */
    time: number;
    index: number;
}
/** Optional instrument identity supplied by the host. */
interface ChartDataContext {
    symbol?: string;
    exchange?: string;
    interval?: string;
}
/** Source identity changed, or the available source-bar range changed. */
type IndicatorDataChange = 'context' | 'range';
/** Observable state of an indicator's external data lifecycle. */
type IndicatorDataStatus = {
    state: 'loading' | 'ready' | 'empty' | 'unsupported';
} | {
    state: 'error';
    error: unknown;
};
/** What an indicator's `attach` lifecycle can reach. */
interface IndicatorAttachContext {
    /** Optional host identity, independent of the indicator's own settings. */
    dataContext?(): Readonly<ChartDataContext> | undefined;
    /** Read bars and identity again when the host publishes a change. */
    subscribeDataChanges?(listener: (change: IndicatorDataChange) => void): () => void;
    /** Publish status and an explicit retry action for this instance. */
    setDataStatus?(status: IndicatorDataStatus): void;
    setDataRetry?(retry: (() => void) | null): void;
    /** Instance lifetime. Aborted on removal, preserved across style changes. */
    signal?: AbortSignal;
    /** Current settings (live — read at call time, not captured). */
    settings(): Readonly<IndicatorSettings>;
    /** The chart's current source bars. */
    bars(): readonly Bar[];
    /** Re-run `calc` and repaint — call when external data arrives. */
    requestRecompute(): void;
    /** Scratch this instance owns; the same object `calc` receives. */
    store: IndicatorStore;
    /**
     * The instrument the chart is showing, when the host knows it.
     *
     * Hosts can supply this through `IndicatorHost` or Chart's explicit data
     * context. Without a configured identity it stays undefined. External
     * studies read `dataContext` to include the exchange as well.
     */
    symbol?(): string | undefined;
    /** The chart's timeframe (`'5m'`, `'1d'`), on the same terms as `symbol`. */
    interval?(): string | undefined;
    /** The chart's IANA zone, the one its axis is labelled in. */
    timezone?(): string;
    /** Chart wall clock in UTC seconds, the same clock the countdown row uses. */
    now?(): number;
    /** The pane this instance drew into. Moves when panes are reordered. */
    paneIndex?(): number;
    /** Attach a primitive to this indicator's pane, and detach it again. */
    addPrimitive?(p: IPrimitive): void;
    removePrimitive?(p: IPrimitive): void;
    /**
     * Emit on the chart's own event bus, the one `chart.on(name, cb)` listens to.
     *
     * The declarative `alerts` slot covers a condition read off the bars; this is
     * the imperative half, for an indicator whose signal arrives from outside the
     * calculation entirely (a subscription its `attach` opened).
     */
    emit?(event: string, payload: unknown): void;
}
/**
 * What `levels` is handed. It carries `bars` and `values` **and** spreads the
 * settings keys onto itself, so the built-ins written against the original
 * `levels(settings)` signature keep working unchanged: they read
 * `ctx.overbought` (or pass `ctx` to a `num(s, key, default)` helper) and find
 * exactly what they found before. A widened parameter is the only way a level
 * can be data-derived (yesterday's high, the session VWAP band), and that is a
 * whole class of level that could not be expressed at all before.
 *
 * The three data members are optional for the same backward-compatibility
 * reason, not because the runtime ever omits them: it always passes all three,
 * but a caller holding only a settings bag must still be able to invoke
 * `levels` directly. A descriptor that needs the data should default them
 * (`ctx.bars ?? []`).
 *
 * `settings`, `bars` and `values` are therefore reserved keys, the way
 * `timezone` already is in the settings a `calc` receives: an input declared
 * under one of those names is shadowed here.
 */
type IndicatorLevelContext = IndicatorSettings & {
    settings?: Readonly<IndicatorSettings>;
    bars?: readonly Bar[];
    values?: IndicatorValues;
};
interface IndicatorDescriptor {
    /** Registry key, e.g. `'macd'`. */
    id: string;
    /** Display name, e.g. `'MACD'`. */
    name: string;
    /** Grouping for a picker UI ('Trend', 'Momentum', 'Volume', 'Volatility'). */
    category?: string;
    /** `'onchart'` overlays the price pane; `'pane'` gets its own pane. */
    placement: 'onchart' | 'pane';
    inputs: readonly IndicatorInput[];
    plots: readonly IndicatorPlot[];
    /**
     * Shaded bands between pairs of plots — the Ichimoku cloud, a Bollinger
     * channel. A pair of lines is not the same picture as a filled region: the
     * fill is what makes "price is above the cloud" readable at a glance, and
     * which side leads is itself the signal, hence the two colours.
     */
    fills?: readonly IndicatorFillSpec[];
    /**
     * Full recompute over every bar. Must return arrays the same length as
     * `bars` (use `null` for warmup gaps — the line renderer breaks across them
     * and autoscale skips them).
     *
     * Tier-1 indicators are pure functions of `(bars, settings)` and ignore
     * `store`. Tier-2 indicators — the ones with their own data — read the
     * external series their `attach` lifecycle put in `store`.
     */
    calc(bars: readonly Bar[], settings: Readonly<IndicatorSettings>, store: IndicatorStore, ctx?: IndicatorCalcContext): IndicatorValues;
    /**
     * Optional per-instance lifecycle, for indicators whose data is not derived
     * from the chart's bars (open interest, CVD, an external feed). Called once
     * when the instance is created; return a teardown function.
     *
     * Fetch into `ctx.store`, then call `ctx.requestRecompute()` — `calc` runs
     * again and reads what you stored.
     */
    attach?(ctx: IndicatorAttachContext): (() => void) | void;
    /**
     * Optional incremental path, called instead of `calc` when only the tail
     * changed (a live tick). Return values for indices `[fromIndex, bars.length)`
     * — the runtime splices them onto the previous result — or `null` to fall
     * back to a full `calc`.
     *
     * Without it every tick costs a full recompute. That is a few hundred
     * microseconds for one indicator over 50k bars, but it is O(n) per tick per
     * indicator, so implement this for anything meant to run in a busy live pane.
     */
    calcTail?(bars: readonly Bar[], settings: Readonly<IndicatorSettings>, fromIndex: number, previous: IndicatorValues, store: IndicatorStore, ctx?: IndicatorCalcContext): IndicatorValues | null;
    /**
     * Optional bar-anchored signal markers — a named "Buy"/"Sell" plate, an arrow
     * at a crossover. Runs after every `calc`, so it reads the values it just
     * produced rather than recomputing anything.
     *
     * A plot cannot express this: a plot is a column of prices drawn as a line or
     * histogram, whereas a signal is a discrete event with a label. Returning `[]`
     * (when a `showLabels`-style input is off, say) clears the layer.
     */
    markers?(ctx: {
        bars: readonly Bar[];
        values: IndicatorValues;
        settings: Readonly<IndicatorSettings>;
    }): readonly SeriesMarker[];
    /**
     * Optional summary grid pinned to a corner of the pane.
     *
     * Some studies are not a value per bar at all: a seasonality heatmap is a
     * matrix of monthly returns, a scoreboard is a handful of statistics. Those
     * have no place in `calc`, whose contract is one column per plot aligned to
     * the bars, so they come back through here instead. Runs after every `calc`.
     *
     * Return `null` (or a zero-row grid) to draw nothing, which is how a
     * `showTable`-style input should switch it off.
     */
    table?(ctx: {
        bars: readonly Bar[];
        values: IndicatorValues;
        settings: Readonly<IndicatorSettings>;
    }): {
        rows: readonly (readonly TableCell[])[];
        options?: Partial<ChartTableOptions>;
    } | null;
    /**
     * Optional free-standing shapes drawn in the indicator's pane: trendlines
     * between pivots, supply and demand boxes, projection labels. Runs after
     * every `calc`, like `markers` and `table`, and the returned list replaces the
     * previous one wholesale, so returning `[]` clears the layer.
     */
    draws?(ctx: {
        bars: readonly Bar[];
        values: IndicatorValues;
        settings: Readonly<IndicatorSettings>;
    }): readonly IndicatorDrawing[];
    /**
     * Optional per-bar shading behind everything else in the indicator's pane: a
     * full-height column per bar, `null` where nothing should be shaded.
     *
     * A regime study answers "which state is the market in right now", and that is
     * a property of the whole bar, not a price. Drawn as a plot it would need a
     * value to sit at and would fight the pane's autoscale; as a column behind the
     * candles it reads at a glance and costs the scale nothing.
     *
     * Runs after every `calc`. Return `[]` to clear the layer.
     */
    background?(ctx: {
        bars: readonly Bar[];
        values: IndicatorValues;
        settings: Readonly<IndicatorSettings>;
    }): readonly (string | null)[];
    /**
     * Optional recolouring of the **main price candles**, one entry per bar,
     * `null` to leave that bar with its own colour.
     *
     * Distinct from a plot's `colorBy`, which paints the indicator's own series: a
     * trend filter, a volatility regime or a higher-timeframe bias is a statement
     * about the price bars themselves, and drawing it as a second series beside
     * them says something weaker.
     *
     * Only one indicator's colours can be on the candles at a time; the most
     * recent publisher wins, and publishers run in `addIndicator` order, so the
     * winner is the same one from frame to frame. Removing it, or hiding it,
     * restores the bars' own colours.
     */
    barColors?(ctx: {
        bars: readonly Bar[];
        values: IndicatorValues;
        settings: Readonly<IndicatorSettings>;
    }): readonly (string | null)[];
    /**
     * Optional conditions the runtime watches on the descriptor's behalf, emitted
     * as `'indicator:alert'` on the chart's event bus with an
     * {@link IndicatorAlertPayload}. See {@link IndicatorAlertSpec}.
     */
    alerts?: readonly IndicatorAlertSpec[];
    /**
     * Optional horizontal reference levels drawn in the indicator's pane.
     * Recomputed after every `calc`, so a level derived from the data (the
     * previous day's high) tracks it. See `IndicatorLevelContext` for why the
     * argument still reads as a settings bag.
     */
    levels?(ctx: IndicatorLevelContext): readonly IndicatorLevel[];
    /**
     * Optional fixed price range for the indicator's own pane (RSI 0..100).
     * Applied only when the indicator creates its pane — two indicators sharing a
     * pane would otherwise fight over it.
     */
    range?(settings: Readonly<IndicatorSettings>): {
        min: number;
        max: number;
    } | null;
}
/** Register an indicator descriptor. Later registrations of the same id win. */
declare function registerIndicator(descriptor: IndicatorDescriptor): void;
declare function getIndicator(id: string): IndicatorDescriptor;
declare function hasIndicator(id: string): boolean;
declare function registeredIndicators(): IndicatorDescriptor[];
/** The descriptor's declared defaults as a settings object. */
declare function indicatorDefaults(descriptor: IndicatorDescriptor): IndicatorSettings;
/** Read one bar's value for a price source. */
declare function sourceValue(bar: Bar, source: IndicatorSource): number;
/** Read a whole bar array for a price source. */
declare function sourceValues(bars: readonly Bar[], source: IndicatorSource): number[];

/**
 * Horizontal price line primitive (ARCHITECTURE.md §8). The reusable base for
 * order/SL/TP/alert/indicator-level lines: a line across the plot plus a fixed
 * right-axis price tag and an optional broker-style segmented pill group on the
 * line — [badge][qty][label][✕] — with hover / dragging states (the chart
 * passes `hoverId`/`dragId` on the render context) and a drag ghost at the
 * pre-drag price via `setDragGhost`. Interaction semantics are unchanged from
 * the classic tag: the ✕ hit-tests as `${id}::close`, everything else drags.
 */

interface PriceLineOptions {
    price: number;
    color: string;
    /** Line thickness in media px. Default 1. */
    lineWidth?: number;
    /** Legacy two-state dash switch, equivalent to `lineStyle: 'dashed'`. */
    dashed?: boolean;
    /**
     * Dash style, the three-way form of `dashed`. Set, it wins over the boolean;
     * unset, the boolean still decides, so a line built before this existed draws
     * exactly as it did.
     */
    lineStyle?: CanvasLineStyle;
    /** Right-axis tag text. Defaults to the formatted price. */
    label?: string;
    /** Solid colored badge segment at the start of the pill group (e.g. 'BUY', 'TP', 'SL'). */
    badge?: string;
    /** Quantity segment rendered as a neutral box after the badge. */
    qty?: string | number;
    /** Info text segment (order type, price, P&L ...) — the classic left tag text. */
    leftLabel?: string;
    /**
     * Fraction of the plot width the line spans, measured from the right (price)
     * axis. 1 = full width (default); 0.3 = only the rightmost 30%, like a
     * partial-width order line. The right-axis tag is always drawn.
     */
    extentFromRight?: number;
    /** Draw a cancel (✕) segment at the end of the pill group; hit-tests as `${id}::close`. */
    closeButton?: boolean;
    /** Stable id returned by hit-test (for click/drag routing). */
    id: string;
    /** Cursor hint when hovered (e.g. 'ns-resize' for draggable lines). */
    cursor?: string;
}
declare class PriceLine implements IPrimitive {
    private _opts;
    private _host;
    private _ghostPrice;
    /** Pill-group geometry from the last draw (media px) for hit-testing. */
    private _group;
    constructor(opts: PriceLineOptions);
    attached(host: PrimitiveHost): void;
    detached(): void;
    get price(): number;
    /** Move the line; schedules a repaint via the host. */
    setPrice(price: number): void;
    /** Update the info segment text (e.g. live position P&L); repaints. */
    setLeftLabel(text: string): void;
    /**
     * Restyle in place; repaints. `id` is the hit-test handle the chart routes
     * clicks and drags through, so it is not patchable — swapping it under a
     * live drag would strand the gesture.
     *
     * A last-price line is the case this exists for: it has to follow the tick
     * direction, and only `setPrice` was updatable, so the colour was stuck at
     * whatever it was constructed with.
     */
    setOptions(patch: Partial<Omit<PriceLineOptions, 'id'>>): void;
    /**
     * Show a dimmed reference line at the pre-drag price while the user drags
     * (pass the original price on drag start, null on drag end to clear).
     */
    setDragGhost(price: number | null): void;
    options(): Readonly<PriceLineOptions>;
    zOrder(): ZOrder;
    autoscaleInfo(): {
        min: number;
        max: number;
    } | null;
    draw(ctx: CanvasRenderingContext2D, rc: PrimitiveRenderContext): void;
    hitTest(x: number, y: number, rc: PrimitiveRenderContext): PrimitiveHit | null;
}

/**
 * Pane legend (ARCHITECTURE.md §8) — the row at the top-left
 * of a pane: a color swatch, the source's name, its parameters, the value under
 * the crosshair, and inline action buttons on the right.
 *
 * Drawn on the canvas rather than in the DOM, like `BuySellButtons` and
 * `DomLadder`, so it composites into screenshots and costs no DOM per pane.
 * Buttons hit-test as `${id}::close`, `${id}::hide`, and `${id}::settings`, so
 * the host routes them through the same `subscribeClick` path as order pills.
 *
 * Rows stack: several legends on one pane offset each other vertically, which
 * the host does by giving each a `row` index.
 *
 * This row is also the chart's status line, so `statusLine` carries the
 * per-field switches a settings dialog expects (logo, title, market status,
 * chart values, bar change, volume, last day change, background). Every switch
 * defaults to the behaviour that predates it, so a caller that passes none sees
 * the row it always saw. Fields the primitive cannot compute (a logo bitmap,
 * whether the market is open, the change since yesterday's close) arrive
 * through `status`; with no source they draw nothing at all rather than a
 * placeholder.
 */

type PaneLegendAction = 'hide' | 'settings' | 'up' | 'down' | 'maximize' | 'close';
/**
 * One reading on a legend row. Multi-plot sources show one per plot, each in
 * that plot's own color (an MA ribbon's four averages, MACD's three lines) —
 * a single string in a single color cannot say which number is which.
 */
interface LegendValue {
    /** Dimmed prefix, e.g. `O` / `H` / `Vol`. */
    label?: string;
    text: string;
    /** Defaults to the row's `valueColor`, then `color`, then the theme text. */
    color?: string;
    /**
     * Which status-line switch owns this reading. Untagged readings are the
     * source's own last value, governed by `statusLine.lastValueLabel`.
     */
    field?: LegendField;
}
/**
 * Status-line groups a host can feed and switch off independently. The legend
 * never derives these: it tags what the host hands it, so one switch hides one
 * group and leaves the rest of the row alone.
 */
type LegendField = 'ohlc' | 'change' | 'volume';
/**
 * Which name the title shows. `description` and `ticker` come from `status`;
 * with neither supplied the title falls back to `title`, which always exists.
 */
type LegendTitleMode = 'symbol' | 'description' | 'ticker';
/**
 * The parts of the status line the primitive has no way to know. The host
 * supplies what it has; anything missing is simply not drawn.
 */
interface LegendStatusData {
    /** Already-decoded logo (an `<img>`, an `ImageBitmap`, a canvas). */
    logo?: CanvasImageSource;
    /** Long name for `titleMode: 'description'`, e.g. `Apple Inc.`. */
    description?: string;
    /** Exchange ticker for `titleMode: 'ticker'`, e.g. `NASDAQ:AAPL`. */
    ticker?: string;
    /** Session state, e.g. `{ text: 'Market open', color: '#26a69a' }`. */
    marketStatus?: LegendValue;
    /** Change against the previous close, e.g. `{ text: '+1.20 (+0.75%)' }`. */
    lastDayChange?: LegendValue;
}
/**
 * A snapshot, or a getter the legend calls each frame, so live fields (market
 * status, day change) can change without the host patching options at tick
 * speed. Returning `null` means "nothing to show".
 */
type LegendStatusSource = LegendStatusData | (() => LegendStatusData | null);
/**
 * Per-field switches for the status line. Every one defaults to on, so the
 * absent option object reproduces the row exactly as it drew before these
 * existed. A field whose data is missing draws nothing whether it is on or off.
 */
interface LegendStatusLineOptions {
    /** Symbol logo, when `status` supplies one. */
    logo?: boolean;
    /** The bold name. Also the "name label" switch for an indicator row. */
    title?: boolean;
    /** Which name the title shows. Default `symbol`. */
    titleMode?: LegendTitleMode;
    /** Session state from `status.marketStatus`. */
    marketStatus?: boolean;
    /** The OHLC readout: readings tagged `field: 'ohlc'`. */
    chartValues?: boolean;
    /** Change over the hovered bar: readings tagged `field: 'change'`. */
    barChange?: boolean;
    /** Readings tagged `field: 'volume'`. */
    volume?: boolean;
    /** Change since the previous close, from `status.lastDayChange`. */
    lastDayChange?: boolean;
    /**
     * The source's own reading (untagged values). This is the scales-and-lines
     * "last value label" control, which lands here because the legend is what
     * draws that number on this row.
     */
    lastValueLabel?: boolean;
    /**
     * Plate behind the row's text, for legibility over candles. Off by default:
     * the row has never had one, and turning it on is a deliberate choice.
     */
    background?: boolean;
    /** Plate opacity, 0..1. Default 0.8, matching the hover plate. */
    backgroundOpacity?: number;
    /** Plate color. Defaults to the theme background. */
    backgroundColor?: string;
}
interface PaneLegendOptions {
    /** Stable id; buttons hit-test as `${id}::close` etc. */
    id: string;
    /** Bold source name, e.g. `RSI`. */
    title: string;
    /** Dimmed parameter summary after the title, e.g. `14 close`. */
    params?: string;
    /** Swatch color; omitted draws no swatch. */
    color?: string;
    /**
     * Color for the live value. Defaults to `color`, then the theme's text — so a
     * row can tint its reading (an up/down change) without being forced to show a
     * swatch in that same color.
     */
    valueColor?: string;
    /** Vertical slot on the pane (0 = topmost). */
    row?: number;
    /**
     * Which inline action buttons to draw, left to right. Each hit-tests as
     * `${id}::<action>`:
     *  - `up` / `down` — move this pane one slot (`::up` / `::down`)
     *  - `hide`        — toggle visibility (`::hide`)
     *  - `maximize`    — expand this pane to fill the chart (`::maximize`)
     *  - `close`       — remove the source, and its pane if it empties (`::close`)
     *
     * Defaults to `['up', 'down', 'hide', 'maximize', 'close']` for pane sources
     * and `['hide', 'close']` for overlays (pass explicitly to override).
     */
    actions?: readonly PaneLegendAction[];
    /** Rendered as hidden (dimmed, eye hollow). */
    hidden?: boolean;
    /** Rendered as maximized (the maximize glyph becomes restore). */
    maximized?: boolean;
    /** Text size in media px. Default 11. */
    font?: number;
    /** Left inset from the plot edge in media px. Default 8. */
    left?: number;
    /** Top inset in media px. Default 6. */
    top?: number;
    /** Per-field status-line switches. Patching merges field by field. */
    statusLine?: LegendStatusLineOptions;
    /** Host-supplied status-line data (logo, names, market state, day change). */
    status?: LegendStatusSource;
}
declare class PaneLegend implements IPrimitive {
    private _opts;
    private _host;
    private _values;
    /** Button geometry from the last draw, in media px, for hit-testing. */
    private _buttons;
    /** Right edge of the drawn row, in media px. */
    private _width;
    constructor(opts: PaneLegendOptions);
    attached(host: PrimitiveHost): void;
    detached(): void;
    zOrder(): ZOrder;
    autoscaleInfo(): null;
    /** A single live reading after the params (typically crosshair-driven). */
    setValue(text: string, color?: string): void;
    /** One reading per plot, each in its own color. */
    setValues(values: readonly LegendValue[]): void;
    setOptions(patch: Partial<PaneLegendOptions>): void;
    /** Resolve the host's status data for this frame; `{}` when it has none. */
    private _status;
    options(): PaneLegendOptions;
    draw(ctx: CanvasRenderingContext2D, rc: PrimitiveRenderContext): void;
    hitTest(x: number, y: number): PrimitiveHit | null;
}

/**
 * Vertical gradient across the band, graded between two prices rather than
 * two pixel rows.
 *
 * The stops are anchored in PRICE, not in pixels, because that is what the
 * shading is claiming: a band graded from its 70 level down to its 30 means
 * those levels, and a viewport-relative gradient would slide off them the
 * moment the pane is panned or the scale re-fits.
 */
interface FillGradient {
    /** Price the top stop sits at. Omitted: the band's own highest value. */
    topValue?: number;
    /** Price the bottom stop sits at. Omitted: the band's own lowest value. */
    bottomValue?: number;
    topColor: string;
    bottomColor: string;
}
interface IndicatorFillOptions {
    /** Fill colour where the first series is above the second. */
    colorUp: string;
    /** Fill colour where the second is above the first. */
    colorDown: string;
    /** 0..1. Defaults to 0.12 — a band must not drown the candles it sits behind. */
    opacity?: number;
    /**
     * Set to grade the band instead of flat-filling it, in place of
     * `colorUp`/`colorDown`. A point carrying its own `color` still overrides it.
     * Unset leaves the two-colour fill exactly as it was.
     */
    gradient?: FillGradient;
}
/** One bar's pair of values; `null` where either plot has no value yet. */
interface FillPoint {
    /** Logical index on the shared time axis (fractional is fine). */
    index: number;
    a: number | null;
    b: number | null;
    /**
     * Paints this bar onward in one colour, for a band shaded by something other
     * than which line leads: trend state, a regime, a third series. The run is
     * split at the bar where the colour changes, so it is per-bar and not merely
     * per-crossing. Most specific wins: this, then the gradient, then up/down.
     */
    color?: string;
}
declare class IndicatorFill implements IPrimitive {
    private _points;
    private _opts;
    private _host;
    private _visible;
    constructor(options: IndicatorFillOptions);
    attached(host: PrimitiveHost): void;
    detached(): void;
    /** Behind the series, so the lines and candles stay crisp on top of it. */
    zOrder(): ZOrder;
    /** The plots it spans already drive the scale; the fill must not widen it. */
    autoscaleInfo(): null;
    setPoints(points: readonly FillPoint[]): void;
    setOptions(patch: Partial<IndicatorFillOptions>): void;
    setVisible(on: boolean): void;
    draw(ctx: CanvasRenderingContext2D, rc: PrimitiveRenderContext): void;
}

/**
 * Indicator runtime (ARCHITECTURE.md §8). Turns an `IndicatorDescriptor` into
 * live chart objects: one series per plot, optional reference levels, an
 * optional fixed pane range — and recomputes them when the source data or the
 * settings change.
 *
 * It adds **no rendering code**. Every plot names a registered chart type, so
 * indicators draw through the same Family-A renderers as any other series.
 */

/** The slice of the chart the runtime needs. Keeps this module testable alone. */
interface IndicatorHost {
    /** Forget a disposed instance, including disposal through its public handle. */
    indicatorRemoved?(instanceId: string): void;
    /** Optional instrument identity and source-range notifications. */
    dataContext?(): Readonly<ChartDataContext> | undefined;
    subscribeDataChanges?(listener: (change: IndicatorDataChange) => void): () => void;
    /** Add the pane-legend row (name + inline up/down/hide/maximize/close). */
    addIndicatorLegend(opts: {
        id: string;
        title: string;
        params: string;
        color?: string;
        row: number;
        paneIndex: number;
    }): PaneLegend;
    removeIndicatorLegend(legend: PaneLegend): void;
    /** How many legends already sit on this pane, so rows stack. */
    legendRowsOn(paneIndex: number): number;
    addIndicatorSeries(type: string, paneIndex: number, style: Record<string, unknown> | undefined, priceScaleId: string | undefined, 
    /** Axis/crosshair formatting for the scale this plot maps to. */
    priceFormat?: PriceFormat): SeriesApi;
    /**
     * Add a reference level. One options object rather than seven positional
     * arguments: the list grew a width and a dash style in 1.7.1, and a call site
     * of seven bare values is where the next one gets passed in the wrong slot.
     */
    addIndicatorLevel(level: {
        price: number;
        color: string;
        /** Kept for hosts predating `lineStyle`; always `lineStyle === 'dashed'`. */
        dashed: boolean;
        lineWidth: number;
        lineStyle: IndicatorLineStyle;
        label: string;
        id: string;
    }, paneIndex: number): PriceLine;
    removeIndicatorLevel(line: PriceLine): void;
    /** Attach a band drawn behind the plots (an Ichimoku cloud). */
    addIndicatorFill(fill: IndicatorFill, paneIndex: number): void;
    removeIndicatorFill(fill: IndicatorFill): void;
    /**
     * Detach a signal-marker layer. There is no matching `add`: the layer comes
     * from `series.createMarkers()` on a plot's own series, so it already lands in
     * the right pane. Removing a series does not remove its primitives, hence this.
     */
    removeIndicatorMarkers(markers: SeriesMarkers): void;
    /** Attach a corner-pinned summary grid to a pane, and detach it again. */
    addIndicatorTable(paneIndex: number): ChartTable;
    removeIndicatorTable(table: ChartTable): void;
    /**
     * Attach an arbitrary primitive to a pane, and detach it again. Carries both
     * the descriptor's drawing layer and whatever a Tier-2 `attach` lifecycle
     * wants to paint, so those two do not need a host method each.
     *
     * Optional, like `timezone`, so a host predating it still satisfies this
     * interface: an indicator that draws simply draws nothing there.
     */
    addIndicatorPrimitive?(primitive: IPrimitive, paneIndex: number): void;
    removeIndicatorPrimitive?(primitive: IPrimitive): void;
    /**
     * Recompute whatever the host has marked stale, before a caller reads a value.
     *
     * Optional, like `timezone`, so a host predating it still satisfies this
     * interface: one that recomputes eagerly has nothing to flush.
     */
    flushIndicators?(): void;
    /** Bars of the primary price series — the calculation input. */
    sourceBars(): readonly Bar[];
    /** Index of a fresh pane for an indicator that wants its own. */
    nextPaneIndex(): number;
    /**
     * The chart's configured IANA zone. Optional so a host predating the option
     * still satisfies this interface; absent means the shipped default.
     *
     * A descriptor is handed bars and settings and never the chart, so this is
     * how the calendar an anchor resets on (a VWAP session, a seasonality month)
     * reaches the calculation. See `IndicatorInstance._descriptorSettings`.
     */
    timezone?(): string;
    /**
     * The instrument and timeframe on screen, when the host knows them. The
     * host can supply an explicit `dataContext` instead. Without either hook,
     * a descriptor sees `undefined` rather than a guessed identity.
     */
    symbol?(): string | undefined;
    interval?(): string | undefined;
    /** Chart wall clock in UTC seconds. Absent means the system clock. */
    now?(): number;
    /**
     * Publish an indicator's per-bar colours onto the **primary price series**,
     * or withdraw them with `null`. `owner` is the instance id: a host holds one
     * overlay at a time and only lets its current owner withdraw it, so a second
     * publisher taking over does not get cleared by the first one's teardown.
     *
     * Optional, like `timezone`: a host that does not implement it simply gives a
     * `barColors` descriptor nowhere to publish, and the indicator's own plots are
     * unaffected.
     */
    setBarColors?(colors: readonly (string | null)[] | null, owner: string): void;
    /** Emit on the chart's event bus (indicator alerts, and `attach`'s own events). */
    emit?(event: string, payload: unknown): void;
    /**
     * Tick size of the named pane's price scale, or undefined when none is set.
     * Optional so a host predating it still satisfies this interface.
     *
     * Per pane, and the panes genuinely differ: a pane that does not quote the
     * instrument has no tick to report. Pane 0 is the price pane, so it is the
     * one to ask for the instrument's own step.
     */
    tickSize?(paneIndex: number): number | undefined;
    /**
     * Write a number the way the price axis of that pane writes it.
     *
     * The legend sits inches from the axis and names the same quantity, so the
     * two disagreeing is the reading a user has to reconcile themselves. Deriving
     * the format here from a tick got that wrong twice over: a study pane carries
     * no tick at all, so a percentage read `0.618` beside an axis saying `0.62`,
     * and a price pane's tick alone misses the precision floor and the host's own
     * formatter, so a volume study read seven digits where its axis said `1.20M`.
     *
     * Asking the scale removes the second opinion. Optional so a host driving
     * this module alone still works, falling back to the magnitude ladder.
     */
    formatPrice?(paneIndex: number, value: number): string | undefined;
    /** Pin a pane's price scale to a fixed range, or release it with `null`. */
    setPaneRange(paneIndex: number, range: {
        min: number;
        max: number;
    } | null): void;
}
/** Public handle returned by `chart.addIndicator(...)`. */
interface IndicatorApi {
    /** External data state, or null for a study without a managed lifecycle. */
    dataStatus(): Readonly<IndicatorDataStatus> | null;
    /** Observe changes; immediately receives the current managed status, if any. */
    subscribeDataStatus(listener: (status: Readonly<IndicatorDataStatus>) => void): () => void;
    /** Retry external history when the descriptor supplies a retry action. */
    retryData(): void;
    /** Unique instance id (several instances of one indicator can coexist). */
    readonly id: string;
    /** The descriptor id, e.g. `'macd'`. */
    readonly indicatorId: string;
    /** Display name. */
    readonly name: string;
    /** Pane the indicator drew into. */
    readonly paneIndex: number;
    /** Current settings (a copy). */
    settings(): IndicatorSettings;
    /** Merge a settings patch, recompute, and restyle. */
    setSettings(patch: Readonly<IndicatorSettings>): void;
    /** The series backing one plot key, for direct styling. */
    series(plotKey: string): SeriesApi | undefined;
    /** Latest computed values (a reference — do not mutate). */
    values(): IndicatorValues;
    /** Whether the plots are drawn (the legend's eye toggle). */
    visible(): boolean;
    /** Show or hide every plot without removing the instance. */
    setVisible(on: boolean): void;
    /** This indicator's legend row, or null if it has none. */
    legend(): PaneLegend | null;
    /** Refresh the legend readings for a bar index; omit for the latest bar. */
    updateLegendValues(index?: number): void;
    /** Remove every series, level, and legend row this indicator created. */
    remove(): void;
}

/**
 * Serialisable chart state — the keystone the persistence-shaped features hang
 * off (saved layouts, templates, an objects panel, favourites, drawings).
 *
 * The rule that shapes this type: **the chart serialises what the chart owns.**
 * Series *data* is the application's — it knows the symbol, the timeframe, and
 * the feed — so `restoreState` never recreates series. It restores the things
 * the chart is the source of truth for (viewport, grid, panes, price scales,
 * indicators) and reports the series it saw so an app can rebuild them itself
 * and re-apply their styling.
 */

/** Bumped when the shape changes incompatibly; `restoreState` ignores unknown versions. */
declare const CHART_STATE_VERSION = 1;
interface PriceScaleState {
    marginTop: number;
    marginBottom: number;
    minMove: number;
    mode: PriceScaleMode;
    inverted: boolean;
    /** False when the user (or an indicator's fixed range) pinned the scale. */
    autoScale: boolean;
    /** The pinned range, present only when `autoScale` is false. */
    range?: {
        min: number;
        max: number;
    };
}
interface PaneState {
    /** Relative height weight among panes. */
    weight: number;
    priceScale: PriceScaleState;
}
/** A series descriptor — enough to rebuild the shell, never the data. */
interface SeriesState {
    type: string;
    style: SeriesStyle;
    paneIndex: number;
    priceScaleId: PriceScaleId;
}
interface IndicatorState {
    indicatorId: string;
    settings: IndicatorSettings;
    paneIndex: number;
    /** Omitted by older layouts, which restore the indicator as visible. */
    visible?: boolean;
}
interface ChartState {
    version: number;
    /** Visible logical range at save time. */
    viewport?: {
        from: number;
        to: number;
    };
    barSpacing?: number;
    grid?: {
        vertLines: boolean;
        horzLines: boolean;
    };
    crosshairMode?: 'normal' | 'magnet';
    panes?: PaneState[];
    /** Informational: `restoreState` does not recreate these (it has no data). */
    series?: SeriesState[];
    indicators?: IndicatorState[];
    /**
     * Opaque slot the drawing tier fills. The base engine round-trips it
     * untouched, so an app that persists state keeps drawings for free once the
     * tier is loaded.
     */
    drawings?: unknown;
}
/** What `restoreState` actually applied, so a caller can finish the job. */
interface RestoreReport {
    /** True when the payload was a recognised, applicable state object. */
    applied: boolean;
    /** Series descriptors found in the state — the app rebuilds these itself. */
    series: SeriesState[];
    /** Indicator instances recreated. */
    indicators: number;
    /** Set when the payload was rejected. */
    reason?: string;
}

/**
 * Crosshair state + magnet snapping (ARCHITECTURE.md §6). Pure helpers so the
 * snap logic is unit-testable; drawing lives in render/crosshair.ts.
 */

type CrosshairMode = 'normal' | 'magnet';

/**
 * Keyboard shortcuts (ARCHITECTURE.md §7). A small, framework-free shortcut
 * manager for the chart: a default keymap wired to real chart actions, combos
 * expressed as physical key codes (layout-independent), rebinding / disabling /
 * custom commands, an alternate preset, hover-vs-global scope, and optional
 * localStorage persistence. Pure and testable - `resolve(event)` and
 * `handleKey(combo)` map input to a command id without needing a real DOM.
 */
type ShortcutScope = 'hover' | 'global';
type ShortcutPreset = 'default' | 'alt';
interface KeymapEntry {
    command: string;
    label: string;
    /** Canonical combos that trigger this command. */
    combos: string[];
}
interface CustomShortcut {
    command: string;
    label?: string;
    combos: string | string[];
    onTrigger: () => void;
}
interface ShortcutManagerOptions {
    preset?: ShortcutPreset;
    /** Rebind (`string`/`string[]`) or unbind (`null`) a command, still listed. */
    overrides?: Record<string, string | string[] | null>;
    /** Commands to unbind entirely (still listed in `list()`). */
    disabledCommands?: string[];
    customShortcuts?: CustomShortcut[];
    /** `hover` fires while the pointer is over the chart (or it is focused); `global` always. */
    scope?: ShortcutScope;
    /** Persist rebinds/preset to localStorage. */
    persist?: boolean;
    storageKey?: string;
    /** Force platform (⌘ vs Ctrl). Auto-detected when omitted. */
    isMac?: boolean;
}
interface ShortcutTriggerEvent {
    command: string;
    combo: string;
    isCustom: boolean;
}
interface KeyLike {
    code?: string;
    key?: string;
    ctrlKey?: boolean;
    metaKey?: boolean;
    altKey?: boolean;
    shiftKey?: boolean;
}
/** Parse a combo string into ordered modifiers + a key code, or null if invalid. */
declare function parseCombo(combo: string): {
    mods: string[];
    key: string;
} | null;
/** Canonical form of a combo (ordered modifiers), or `''` when invalid. */
declare function normalizeCombo(combo: string): string;
declare function isValidCombo(combo: string): boolean;
/** Platform-aware display string, e.g. `Alt+KeyR` -> `⌥ R` (mac) or `Alt + R`. */
declare function formatCombo(combo: string, isMac?: boolean): string;
/** Build a canonical combo from a keyboard event (`Mod` = ⌘ on mac, Ctrl elsewhere). */
declare function eventToCombo(e: KeyLike, isMac?: boolean): string;
declare function isReservedCombo(combo: string): boolean;
/** The built-in commands and their default bindings. */
declare const DEFAULT_KEYMAP: KeymapEntry[];
/** Alternate preset - overrides a few default bindings. */
declare const ALT_PRESET: Record<string, string[]>;
/** The set of built-in command ids (everything in DEFAULT_KEYMAP). */
declare const BUILTIN_COMMANDS: ReadonlySet<string>;
interface ShortcutListItem {
    command: string;
    label: string;
    combos: string[];
    isCustom: boolean;
    isDisabled: boolean;
}
declare class ShortcutManager {
    scope: ShortcutScope;
    private readonly _isMac;
    private readonly _persist;
    private readonly _storageKey;
    private _preset;
    private _overrides;
    private _disabled;
    private readonly _custom;
    private _entries;
    private _reverse;
    private readonly _listeners;
    constructor(options?: ShortcutManagerOptions);
    private _presetCombos;
    private _effectiveCombos;
    private _rebuild;
    /** Resolve a keyboard event to a command id (or null). */
    resolve(event: KeyLike): string | null;
    /** Resolve a combo string to a command id (or null). */
    handleKey(combo: string): string | null;
    /** Run a custom command's handler (built-ins are executed by the chart). */
    runCustom(command: string): boolean;
    emitTrigger(command: string, combo?: string): void;
    on(cb: (e: ShortcutTriggerEvent) => void): () => void;
    setBinding(command: string, combo: string | string[]): boolean;
    disable(command: string): void;
    resetBinding(command: string): void;
    resetAll(): void;
    setPreset(preset: ShortcutPreset): void;
    addCustom(shortcut: CustomShortcut): void;
    list(): ShortcutListItem[];
    state(): {
        preset: ShortcutPreset;
        overrides: Record<string, string[]>;
        disabled: string[];
    };
    private _after;
    private _save;
    private _load;
    /** True when a key event targets a text field and should be ignored. */
    static shouldIgnore(target: unknown): boolean;
}

/**
 * Trading visualization API (ARCHITECTURE.md §9). A data-driven layer on top of
 * the chart: your app pushes exchange state (positions, orders, trades) and the
 * chart renders labelled price-line "pills" (with a cancel/close button and
 * drag-to-modify) plus trade-fill markers; user interaction is relayed back as
 * `trading:*` events for the app to send to the exchange. Original,
 * framework-free API.
 */

type PositionSide = 'long' | 'short';
type TradingOrderSide = 'buy' | 'sell';
type TradingOrderType = 'limit' | 'stop' | 'stop_limit';
type TradeMarkerVariant = 'chevron' | 'bubble' | 'count';
type TradingLineVariant = 'standard' | 'line-only';
type TradingLineStyle = 'solid' | 'dashed' | 'dotted';
interface TradingPosition {
    id: string;
    side: PositionSide;
    entryPrice: number;
    size: number;
    pnlText?: string;
    pnlPercent?: string;
    color?: string;
    readOnly?: boolean;
    variant?: TradingLineVariant;
}
interface TradingOrder {
    id: string;
    type: TradingOrderType;
    side: TradingOrderSide;
    price: number;
    size: number;
    parentId?: string;
    bracketRole?: 'tp' | 'sl';
    color?: string;
    lineStyle?: TradingLineStyle;
    lineWidth?: number;
    readOnly?: boolean;
    draggable?: boolean;
    variant?: TradingLineVariant;
}
interface TradingTrade {
    id: string;
    side: TradingOrderSide;
    price: number;
    size: number;
    /** Execution time in milliseconds. */
    timestamp: number;
    variant?: TradeMarkerVariant;
    color?: string;
    label?: string;
}
interface TradingSyncPayload {
    positions?: TradingPosition[];
    orders?: TradingOrder[];
    trades?: TradingTrade[];
}
interface TradingColors {
    long: string;
    short: string;
    order: string;
    tp: string;
    sl: string;
    buy: string;
    sell: string;
}
interface TradingSettings {
    longColor?: string;
    shortColor?: string;
    orderColor?: string;
    tpColor?: string;
    slColor?: string;
    buyColor?: string;
    sellColor?: string;
}
/** What the controller needs from the chart (the Chart implements this). */
interface TradingHost {
    addPrimitive(p: IPrimitive): void;
    removePrimitive(p: IPrimitive): void;
    subscribeClick(cb: (externalId: string) => void): void;
    subscribeDrag(onDrag: (externalId: string, price: number) => void, onDragEnd?: (externalId: string, price: number) => void): void;
    /** Optional: route trading events onto the chart's unified `chart.on(...)` bus. */
    emit?(event: string, payload: unknown): void;
}
declare const DEFAULT_TRADING_COLORS: TradingColors;
/** Self-contained trade-fill markers (chevron / bubble / count) over the plot. */
declare class TradeMarkersPrimitive implements IPrimitive {
    private _trades;
    private _colors;
    private _host;
    constructor(colors: TradingColors);
    attached(host: PrimitiveHost): void;
    detached(): void;
    zOrder(): ZOrder;
    autoscaleInfo(): null;
    setTrades(trades: TradingTrade[]): void;
    setColors(colors: TradingColors): void;
    draw(ctx: CanvasRenderingContext2D, rc: PrimitiveRenderContext): void;
}
declare class TradingController {
    private readonly _host;
    private readonly _positions;
    private readonly _orders;
    private readonly _trades;
    private readonly _listeners;
    private readonly _dragPrev;
    private _colors;
    private _markers;
    constructor(host: TradingHost);
    on(event: string, cb: (payload: unknown) => void): () => void;
    off(event: string, cb: (payload: unknown) => void): void;
    private _emit;
    setSettings(settings: TradingSettings): void;
    getSettings(): TradingColors;
    setPositions(positions: readonly TradingPosition[]): void;
    setOrders(orders: readonly TradingOrder[]): void;
    setTrades(trades: readonly TradingTrade[]): void;
    addTrade(trade: TradingTrade): void;
    upsertOrder(order: TradingOrder): void;
    removeOrder(id: string): void;
    syncState(payload: TradingSyncPayload): void;
    updatePositionPnl(id: string, unrealizedPnl: number, pnlText?: string, pnlPercent?: string): void;
    getPositions(): TradingPosition[];
    getOrders(): TradingOrder[];
    getTrades(): TradingTrade[];
    clear(): void;
    private _renderTrades;
    private _sync;
    private _sig;
    /** Info segment for a position: live P&L text (side/size live in badge/qty). */
    private _positionPill;
    private _positionOpts;
    private _orderOpts;
    private _onClick;
    private _onDrag;
    private _onDragEnd;
}

/**
 * Interactive value capture (ARCHITECTURE.md §7). A settings input that names a
 * price or a time is declarative and the host renders it, but the *value* can
 * come from pointing at the chart, and only the engine knows what is under the
 * cursor. So the host arms a pick ("the user is now choosing a price"), the next
 * click on the plot answers with one, and the pick disarms itself.
 *
 * Built on the `click` event the draw tier's placement mode already resolves
 * anchors from, rather than a second capture path: same pane resolution, same
 * on-demand autoscale, same payload.
 *
 * Placement mode is deliberately *not* armed while picking. A pick wants panning
 * left alone (scroll back to the bar you mean, then click it), and a drag emits
 * no click outside placement mode, so panning cannot answer the pick by
 * accident. It also keeps a pick from cancelling an active drawing tool.
 */
type PickKind = 'price' | 'time';
/**
 * The slice of the chart a pick needs. Structural, so `Chart` satisfies it with
 * nothing to cast and this module never imports the core (which imports this).
 */
interface PickHost {
    on(event: string, cb: (payload: unknown) => void): () => void;
    emit(event: string, payload: unknown): void;
    readonly dataLayer: {
        timeToIndexFloat(time: number): number;
        indexToTime(index: number): number | undefined;
    };
}
/**
 * Arm the next plot click to resolve to a price or a bar time and hand it to
 * `cb`. Returns a cancel function; calling it (or arming another pick on the
 * same chart) disarms without calling back. The chart emits `pick:start`
 * (`{ kind }`) and `pick:end` (`{ kind, value }`, `value` null when cancelled)
 * so a host can show its own cursor or hint while the pick is live.
 *
 * A time is snapped to the bar the click landed on, because a time between two
 * bars matches no bar and anything anchored to it would never line up. Clicking
 * past the last bar keeps the projected time, which is what a pick in the empty
 * right-hand space means.
 */
declare function beginPick(host: PickHost, kind: PickKind, cb: (value: number) => void): () => void;

/**
 * Event markers (ARCHITECTURE.md §8.2): Earnings / Dividend / Split badges in a
 * strip near the bottom of the plot. Time-anchored only (no price). Hover/click
 * carry an external id for tooltip wiring. Data source is an integration concern
 * (OpenAlgo has no corporate-actions calendar) — the renderer ships regardless.
 */

interface ChartEvent {
    time: number;
    type: 'earnings' | 'dividend' | 'split' | 'news' | string;
    label: string;
    color?: string;
    id?: string;
}
declare class EventMarkers implements IPrimitive {
    private _events;
    private _host;
    private _positions;
    attached(host: PrimitiveHost): void;
    detached(): void;
    zOrder(): ZOrder;
    setEvents(events: readonly ChartEvent[]): void;
    draw(ctx: CanvasRenderingContext2D, rc: PrimitiveRenderContext): void;
    hitTest(x: number, y: number): PrimitiveHit | null;
}

/**
 * Time navigator (ARCHITECTURE.md section 8): hover-revealed zoom, reset and
 * one-bar step controls just above the time axis.
 *
 * Invisible until the pointer nears the bottom of the chart, so a clean chart
 * stays clean. It fades in and out rather than snapping, which is what keeps it
 * from reading as a glitch when the cursor crosses the reveal band.
 *
 * Reveal is driven by an explicit `setPointer` from the chart, **not** by
 * `rc.hoverId`. Hover ids come from `bestHit`, which picks the nearest primitive
 * — so a drawing or an order line near the bottom of the chart would win the
 * hit and silently hide the controls. Pointer position is the honest input here;
 * hit-testing still owns the buttons themselves.
 */

/** Command each button runs. These are `Chart` shortcut command ids. */
type TimeNavigatorAction = 'zoomOut' | 'zoomIn' | 'resetScale' | 'panLeftBar' | 'panRightBar';
interface TimeNavigatorOptions {
    /** Prefix for hit ids. Lets a host run more than one. */
    id: string;
    /** Buttons, left to right. A `null` inserts a gap between groups. */
    buttons: readonly (TimeNavigatorAction | null)[];
    /** Button box size in media px. */
    size: number;
    /** Gap between buttons, and the wider gap a `null` produces. */
    gap: number;
    groupGap: number;
    /** Distance from the bottom of the plot to the bottom of the buttons. */
    bottomMargin: number;
    /**
     * Height of the reveal band above the plot bottom. The pointer anywhere in
     * this band brings the controls in.
     */
    revealHeight: number;
    /** Seconds the fade takes. 0 disables the animation. */
    fadeSeconds: number;
    /** Tooltip label overrides per action. */
    labels: Partial<Record<TimeNavigatorAction, string>>;
    /** Optional keyboard hint shown next to the label, e.g. `"Ctrl + −"`. */
    hints: Partial<Record<TimeNavigatorAction, string>>;
    /** Show the tooltip above the hovered button. */
    showTooltip: boolean;
    font: number;
    radius: number;
    zOrder: ZOrder;
}
declare const DEFAULT_TIME_NAVIGATOR_OPTIONS: TimeNavigatorOptions;
declare class TimeNavigator implements IPrimitive {
    private _opts;
    private _host;
    /** Button geometry from the last paint, in media px relative to the plot. */
    private _boxes;
    /** Pointer in plot-local media px, or null when it left the pane. */
    private _pointer;
    /** 0 hidden, 1 fully shown. Eased toward the target each frame. */
    private _opacity;
    private _lastFrameMs;
    private _now;
    constructor(opts?: Partial<TimeNavigatorOptions>, now?: () => number);
    attached(host: PrimitiveHost): void;
    detached(): void;
    zOrder(): ZOrder;
    options(): TimeNavigatorOptions;
    setOptions(patch: Partial<TimeNavigatorOptions>): void;
    /**
     * Tell the navigator where the pointer is, in plot-local media px. `null`
     * when it leaves. The chart calls this; hosts driving their own navigator
     * should too.
     */
    setPointer(p: {
        x: number;
        y: number;
    } | null): void;
    /** True when the pointer is inside the reveal band. */
    private _revealed;
    private _targetOpacity;
    /** Top of the reveal band, recomputed each paint from the plot height. */
    private _revealTop;
    /** Whether the fade is still running — the chart keeps painting while true. */
    animating(): boolean;
    draw(ctx: CanvasRenderingContext2D, rc: PrimitiveRenderContext): void;
    /** Which button the pointer is over, or null. */
    private _hoveredAction;
    private _button;
    private _tooltip;
    /**
     * Buttons hit-test only while visible, so a hidden navigator never steals a
     * click from the chart body underneath it.
     */
    hitTest(x: number, y: number): PrimitiveHit | null;
}

/**
 * Declarative chart-settings schema: the tabs and controls a host renders to
 * build the terminal's settings dialog, without hardcoding a list.
 *
 * WHY it reuses `IndicatorInput` rather than inventing a widget vocabulary: a
 * host that can already render the indicator settings form (built from
 * `indicatorStyleInputs`) can render this one with no new widget code. It adds
 * exactly one widget of its own, `colorPair`, because a bullish/bearish pair is
 * one row of the dialog and expressing it as two `color` inputs forces a host
 * into a section header plus two stacked rows: three times the height, for the
 * property a trader changes most.
 *
 * WHY read/write live on the same object as the input: the schema and the
 * accessors are one structure, so a control cannot drift from the option it
 * drives, and there is no second table to keep in step. That is also the rule
 * for what ships here: **every control maps to an option that actually changes
 * what is drawn or stored.** Controls this engine has no backing for are absent
 * rather than inert; a checkbox that does nothing is worse than one that is not
 * there.
 *
 * The tabs are our own five, not a reference terminal's seven. Alerts are not
 * here because the feature is not built, and corporate events are not here
 * because nothing in the engine sources them: an empty tab is worse than an
 * absent one.
 *
 * Keys are dotted paths (`symbol.upColor`, `canvas.grid.vertColor`), so a patch
 * is a flat `Record<string, value>` that survives JSON. They are a wire format
 * a host may have written down, so they stay put when the grouping above them
 * changes: a key names the option it writes, not the tab it is shown on.
 */

/**
 * Tabs of the settings dialog. Five groups, chosen so a trader finds a setting
 * without hunting: what the instrument is painted with, what the header reads
 * out, what the two axes do, what the surface around the data looks like, and
 * what the trade layer draws.
 */
type ChartSettingsTabId = 'price' | 'readout' | 'axes' | 'appearance' | 'trading';
/**
 * Two colours on one labelled row, with an optional switch in front of them:
 *
 *     [x] Borders   [up] [down]
 *
 * `key` identifies the row and is not itself a value. The value keys are
 * `up.key`, `down.key` and `enabled.key`, each an ordinary flat key of
 * `ChartSettingsValues`, so a host patches this row exactly the way it patches
 * a plain colour and nothing about read/apply has to know the widget exists.
 *
 * `enabled` is absent when the pair has no visibility flag behind it (a candle
 * body is always drawn), which is the difference between a row whose checkbox
 * does something and one whose checkbox would be a lie.
 */
interface ChartSettingsColorPairInput {
    key: string;
    type: 'colorPair';
    label: string;
    group?: string;
    /** Help text for the row, on the same terms as `IndicatorInput['tooltip']`. */
    tooltip?: string;
    enabled?: {
        key: string;
        default: boolean;
    };
    up: {
        key: string;
        label: string;
        default: string;
    };
    down: {
        key: string;
        label: string;
        default: string;
    };
}
/** Everything a host may be handed in `ChartSettingsTab.inputs`. */
type ChartSettingsInput = IndicatorInput | ChartSettingsColorPairInput;
interface ChartSettingsTab {
    id: ChartSettingsTabId;
    label: string;
    /** Controls in display order; `input.group` names the sub-heading. */
    inputs: ChartSettingsInput[];
}
type ChartSettingsValue = string | number | boolean;
/** Flat, JSON-safe snapshot of every control, keyed by the schema's dotted key. */
type ChartSettingsValues = Record<string, ChartSettingsValue>;
/**
 * The settings slice of a saved chart state. It is declared here rather than on
 * `ChartState` so this module owns its own persistence: `chart.getState()`
 * returns a `ChartState & ChartSettingsState`, which is still a `ChartState` to
 * every existing consumer, and `restoreState` reads it back.
 *
 * `events` stays in the saved state although the dialog no longer offers the
 * switches: the chart still owns `setEventOptions`, a host that feeds its own
 * corporate actions still sets them, and dropping the field would throw that
 * host's saved layout away.
 */
interface ChartSettingsState {
    navigation?: Partial<ChartNavigationOptions>;
    canvas?: CanvasOptions;
    statusLine?: LegendStatusLineOptions;
    watermark?: ChartWatermarkOptions;
    trading?: TradingSettings;
    events?: ChartEventOptions;
    /**
     * The axis-strip switches. Only the switches: `AxisChromeOptions.clock` is a
     * callback, which no JSON survives, and a host that supplied one supplies it
     * again when it builds the chart.
     */
    axisChrome?: Pick<AxisChromeOptions, 'sessionClock' | 'barCountdown'>;
}
/**
 * The settings dialog, described. Takes the chart because the Price tab depends
 * on the primary series type (a candle has borders, a line has a dash), because
 * the colour defaults come from the live theme, and because the timezone list
 * has to include whatever zone the chart is already in.
 */
declare function chartSettingsSchema(chart: Chart): ChartSettingsTab[];
/** Current value of every control in the schema, keyed the same way. */
declare function readChartSettings(chart: Chart): ChartSettingsValues;
/**
 * Apply a patch produced by the dialog. Only the keys present are written, so a
 * single changed control is a one-key object; unknown keys are ignored, which is
 * what lets a state saved by a newer build restore into an older one.
 */
declare function applyChartSettings(chart: Chart, patch: Readonly<Partial<ChartSettingsValues>>): void;

/**
 * Logo / brand watermark (ARCHITECTURE.md §8). Draws a small image (or an
 * already-decoded bitmap) faintly in a corner of the plot, the way charting
 * apps stamp a product/brand mark. Because it draws on the canvas it is captured
 * by `chart.takeScreenshot()`, and an optional `tint` recolors the opaque pixels
 * so a single-color logo reads on both dark and light themes.
 *
 * Pass a `src` (URL or data URI) or a preloaded `image` for custom artwork.
 * Without a source, the original OpenAlgo glyph draws without a network request.
 */

type WatermarkPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
interface LogoWatermarkOptions {
    /** Image URL or data URI. Ignored when `image` is provided. */
    src?: string;
    /** A preloaded image/bitmap to draw (skips loading). */
    image?: CanvasImageSource & {
        width: number;
        height: number;
    };
    /** Corner (or center) to anchor to. Default `bottom-right`. */
    position?: WatermarkPosition;
    /** Gap from the plot edges in px. Default `12`. */
    margin?: number;
    /** Rendered logo height in px; width follows the source aspect. Default `28`. */
    height?: number;
    /** 0..1. Default `0.7`. */
    opacity?: number;
    /** Recolor the opaque pixels to this color (e.g. a faint theme gray). */
    tint?: string;
    /** Layer order vs the series. Default `top`. */
    zOrder?: ZOrder;
    /**
     * Text revealed to the right of the mark on hover — "Chart by OpenAlgo".
     * The mark alone is what sits on the chart at rest; the wording is only
     * needed when someone looks at it, so it unrolls rather than occupying the
     * corner permanently. Omit for a plain, non-interactive mark.
     */
    label?: string;
    /** Hit-test id, so the chart can report hover. Default `watermark`. */
    id?: string;
    /** Reveal duration in seconds. Default 0.18. */
    revealSeconds?: number;
    /** Label colour. Defaults to `tint`, then the theme's text. */
    labelColor?: string;
    /** Label size in media px. Default 12. */
    fontSize?: number;
    /**
     * Rounded plate behind the mark and label. Without one the wording sits
     * straight on the candles and is unreadable wherever the chart is busy.
     * Defaults to a translucent form of the theme background; `'none'` omits it.
     */
    background?: string;
    /** Plate border. Defaults to the theme's axis line. `'none'` omits it. */
    borderColor?: string;
    /** Plate corner radius in media px. Default 6. */
    radius?: number;
    /**
     * Plate padding around the lockup, in media px. A number pads both axes;
     * `{ x, y }` pads them separately. Default `{ x: 7, y: 4 }`, which keeps the
     * revealed label clear of the plate edge.
     *
     * Use it to size the resting plate exactly: a 40px mark with `padding: 2.5`
     * sits in a 45x45 square. The plate widens as the label unrolls; the padding
     * is what stays constant.
     */
    padding?: number | {
        x: number;
        y: number;
    };
    /**
     * Where the mark points. A canvas cannot hold an anchor, so this only marks
     * it as clickable — the hit reports a pointer cursor, and the host opens
     * {@link href} from its own click handler.
     *
     * Given a bare URL, `href()` appends UTM parameters naming the page the chart
     * is embedded in, so the referral is attributable. Pass a URL that already
     * has a query string to compose your own and skip that entirely.
     */
    href?: string;
    /** `utm_medium` for the composed link. Default `oac-link`. */
    utmMedium?: string;
    /** `utm_campaign` for the composed link. Default `oac-chart`. */
    utmCampaign?: string;
}
/** Top-left placement (in media px) of a `w x h` logo within a `plotW x plotH` plot. */
declare function watermarkRect(position: WatermarkPosition, margin: number, w: number, h: number, plotW: number, plotH: number): {
    x: number;
    y: number;
    w: number;
    h: number;
};
declare class LogoWatermark implements IPrimitive {
    private _opts;
    /** 0..1 reveal progress, eased toward hover state each frame. */
    private _reveal;
    private _lastFrameMs;
    /** Label width in media px, measured once the font is known. */
    private _labelW;
    private readonly _now;
    private _host;
    private _img;
    private _ready;
    private _autoHeight;
    private _tintCanvas;
    private _tintKey;
    constructor(opts?: LogoWatermarkOptions);
    attached(host: PrimitiveHost): void;
    detached(): void;
    zOrder(): ZOrder;
    autoscaleInfo(): null;
    /** Live restyle. Pass a new `src`/`image` to swap the logo. */
    setOptions(patch: Partial<LogoWatermarkOptions>): void;
    /**
     * The mark's box, in media px. The label unrolls to its right, so the hit
     * area is the mark alone — hovering the revealed text keeps it open because
     * the pointer is still within the widened box below.
     */
    private _rect;
    private _builtin;
    /**
     * The link to open, with attribution appended. A caller who supplied their
     * own query string gets it back untouched.
     */
    href(): string | undefined;
    hitTest(x: number, y: number, rc: PrimitiveRenderContext): PrimitiveHit | null;
    draw(ctx: CanvasRenderingContext2D, rc: PrimitiveRenderContext): void;
    /**
     * The single colour the mark and its label share. Either option can set it;
     * they follow each other so the pair never renders in two shades.
     */
    private _ink;
    /** Ease the reveal toward the hover state, asking for frames while moving. */
    private _advanceReveal;
    /** Recolor the opaque logo pixels to `color` at (dw x dh) device px, cached. */
    private _tinted;
}

/**
 * A word stamped faintly across the plot, to say what mode the chart is in.
 *
 * The case it exists for is replay: a chart showing a past session looks exactly
 * like a chart showing the present one, and a trader who forgets which they are
 * looking at can read a live decision off history. The mark is large, centred
 * and static on purpose. It is not decoration and not a brand: it is the answer
 * to "am I looking at the market or a recording of it", and it has to be
 * readable without being looked for.
 *
 * Distinct from `LogoWatermark`, which is a small corner image with a hover
 * label. This one draws text, takes no interaction, and reports no hit, so it
 * never intercepts a click meant for the chart under it.
 */

interface TextWatermarkOptions {
    /** The word itself. Kept short: it is read at a glance, not studied. */
    text: string;
    /**
     * Cap height in px at the plot's natural size, scaled down on a narrow chart
     * so a long word never runs past the edges. Default 64.
     */
    fontSize?: number;
    /** 0..1. Default 0.08, which reads as present without competing with bars. */
    opacity?: number;
    /** Default a neutral grey that works on either theme. */
    color?: string;
    font?: string;
    /**
     * Below the series by default. A mode marker that covered the candles would
     * be worse than no marker, since the candles are what the mode is about.
     */
    zOrder?: ZOrder;
    id?: string;
}
declare class TextWatermark implements IPrimitive {
    private _host;
    private _opts;
    constructor(opts: TextWatermarkOptions);
    zOrder(): ZOrder;
    attached(host: PrimitiveHost): void;
    detached(): void;
    autoscaleInfo(): null;
    /** Never hit: the mark must not eat a click aimed at the chart beneath it. */
    hitTest(): null;
    setOptions(patch: Partial<TextWatermarkOptions>): void;
    draw(ctx: CanvasRenderingContext2D, rc: PrimitiveRenderContext): void;
}

/**
 * Top-level chart orchestrator (ARCHITECTURE.md §3.3). Owns the shared
 * DataLayer + time scale, the panes, the invalidate mask, and the render loop.
 * Phase 2 renders static candlesticks with price/time axes; pan/zoom (Phase 3)
 * and live data (Phase 4) build on this.
 */

/** What a wheel zoom holds still. */
type ZoomAnchor = 'cursor' | 'right';
/** What a double-click on a pane does. See {@link ChartOptions.doubleClick}. */
type DoubleClickAction = 'reset' | 'maximize' | 'none';
/**
 * The `dblclick` event. `paneIndex` is the pane under the pointer. A listener
 * that acts on the double-click itself (opening a text editor for the selected
 * drawing, say) sets `handled` to true, and the chart's own action is skipped
 * for that press.
 */
interface DoubleClickEvent {
    paneIndex: number;
    x: number;
    y: number;
    handled: boolean;
}

/** Optional background text. Blank text follows the chart's symbol and interval. */
interface ChartWatermarkOptions extends Partial<TextWatermarkOptions> {
    visible?: boolean;
}
/** Defensive branding snapshot emitted synchronously after setBranding as `branding:changed`. */
type BrandingChangedEvent = false | LogoWatermarkOptions;
/**
 * Which corporate-action / news markers the chart draws. Every type defaults to
 * on; an unlisted type is always drawn. Only filters the strip the chart owns
 * (`setEvents`), not an `EventMarkers` a host drives itself.
 */
interface ChartEventOptions {
    earnings?: boolean;
    dividend?: boolean;
    split?: boolean;
    news?: boolean;
}
/**
 * Chrome that lives on the axis strips rather than in the plot: a live clock in
 * the corner where the two axes meet, and a countdown to the current bar's close
 * inside the last-price tag.
 *
 * Both default to off. Neither is a thing a chart should start showing because
 * it upgraded, and a chart that sets none of this draws the axes it always drew.
 */
interface AxisChromeOptions {
    /**
     * Live clock in the corner between the price and time axes. `true` takes the
     * defaults; the object form is there for the one thing worth choosing, the
     * second row carrying the zone's offset from UTC.
     */
    sessionClock?: boolean | {
        showOffset?: boolean;
    };
    /** Second row in the last-price tag counting down to the bar's close. */
    barCountdown?: boolean;
    /**
     * Wall-clock UTC seconds. Both readings are times of day, so neither can use
     * `now`, which is a monotonic animation clock and not a calendar. Defaults to
     * the system clock; pass the feed's clock to keep a delayed or replayed chart
     * honest about what time its data thinks it is.
     */
    clock?: () => number;
}
/** Options for `Chart.exportSVG`. */
interface ExportSvgOptions {
    /**
     * Document width in media px. Absent means the live chart width. A different
     * size lays the chart out afresh for the export (the same bar spacing over a
     * wider or narrower plot, every scale re-measured for its new height) and
     * puts the live layout back before returning.
     */
    width?: number;
    /** Document height in media px. Absent means the live chart height. */
    height?: number;
    /**
     * Paint the theme background under the chart. Default true. Off, the
     * document has no ground of its own and takes the colour of whatever page
     * it is placed on, which is what an embedded figure usually wants.
     */
    background?: boolean;
    /**
     * The pixel ratio the paint runs at. Only 1 is accepted: SVG has no device
     * pixels, and a renderer asked for 2 would snap its hairlines to half-media-
     * pixel edges that scale as a blur. Named so the option reads the same as
     * the PNG path and a future scaled export has a place to land.
     */
    dpr?: 1;
}
/** Preferences for pointer panning and the view restored by reset. */
interface ChartNavigationOptions {
    /** Mouse and pen plot drags. Touch gestures retain two-axis panning. Default: both. */
    mousePan: 'horizontal' | 'both';
    /** Latest bars to show initially and on reset. 0 fits all loaded bars (default). */
    defaultVisibleBars: number;
}
interface ChartOptions {
    document?: Document;
    pixelRatio?: () => number;
    raf?: {
        schedule: RafScheduler;
        cancel?: RafCanceller;
    };
    /** Full palette; pass `lightTheme` (the default), `darkTheme`, or a custom ChartTheme. */
    theme?: ChartTheme;
    priceAxisWidth?: number;
    timeAxisHeight?: number;
    /** Initial horizontal scale configuration, including spacing limits for wide profiles. */
    timeScale?: Partial<TimeScaleOptions>;
    /** Saved navigation preferences, also exposed in the Axes settings tab. */
    navigation?: Partial<ChartNavigationOptions>;
    /**
     * Where indicator legend rows start inside **one** pane, in media px. A host
     * that draws its own overlay in a pane's top-left corner — an OHLC readout, a
     * symbol line, a trade panel — needs to push these clear of it, or the rows
     * land underneath and their settings / close buttons become invisible and
     * unclickable.
     *
     * It follows whichever pane currently renders at that corner, which is
     * normally pane 0 — but maximizing a lower pane parks the others at a
     * placeholder weight, so the maximized pane moves into the same corner and
     * inherits the offset. Every other pane keeps the default corner, because a
     * short lower pane would have its legend pushed off it entirely.
     *
     * Defaults to `{ top: 6, left: 8 }`.
     */
    legendOffset?: {
        top?: number;
        left?: number;
    };
    /**
     * Crosshair behaviour. 'normal' (default) — the cross follows the pointer
     * exactly. 'magnet' — the horizontal line snaps to the nearest O/H/L/C of the
     * bar under the cursor (price pane only).
     */
    crosshairMode?: CrosshairMode;
    /**
     * Optional chrome on the axis strips: the corner clock and the bar-close
     * countdown. Both are off unless asked for, so a chart that omits this block
     * draws the axes it always drew.
     */
    axisChrome?: AxisChromeOptions;
    /** Time source for kinetic animation (defaults to performance.now). */
    now?: () => number;
    /**
     * Ease a wheel zoom over a few frames instead of landing the whole step on
     * one. Default true, matching the inertial pan a flick already gets: a chart
     * that glides when panned and jumps when zoomed reads as two different
     * instruments. Off restores the single-frame step.
     */
    animZoom?: boolean;
    /** Ease automatic price ranges during navigation. Defaults to animZoom (true). */
    animAutoscale?: boolean;
    /**
     * What a wheel zoom holds still: the bar under the cursor, or the right edge
     * (the latest bar). Default `'cursor'`, which is what the chart has always
     * done. `'right'` keeps the most recent bar pinned while history stretches
     * away from it, which is what a live chart usually wants.
     */
    zoomAnchor?: ZoomAnchor;
    /**
     * What a double-click on a pane does. `'reset'` (the default, and what the
     * chart has always done) fits every loaded bar on screen and autoscales,
     * which also lands the viewport on the oldest bar and so wakes a history
     * loader. `'maximize'` gives the pane the whole stack, and a second
     * double-click puts the stack back, which is what a multi-pane terminal
     * usually wants from the gesture. `'none'` only emits the event. While a
     * tool is being placed a double-click finishes the shape whatever this says.
     */
    doubleClick?: DoubleClickAction;
    /** Enable OHLC-preserving conflation when zoomed out (§4.4). Default false. */
    conflate?: boolean;
    /** Conflation aggressiveness (default 1). */
    conflationFactor?: number;
    /**
     * Which backend paints the series. `'canvas2d'` (the default) is the 2D
     * path every chart has always drawn with. `'webgl2'` asks for the GPU
     * backend: it throws when the tier that registers it has not been imported
     * (a missing import is a mistake in the code), and on a device where that
     * tier finds no WebGL2 it falls back to `canvas2d` with one console warning
     * (a property of the machine the host should still hear about). `'auto'`
     * takes `webgl2` when it is registered and available on this device and
     * `canvas2d` otherwise, silently. Decided once, at construction; read what
     * was actually chosen from `rendererKind`. A GPU backend that loses its
     * context later moves the chart to `canvas2d` for the rest of the session
     * and emits 'renderer:fallback'.
     */
    renderer?: RendererChoice;
    /**
     * Build the backend directly, one call per pane, bypassing `renderer` and
     * the registry. For a host bringing its own backend, and for tests that
     * want to see what the pane asks a backend to paint. A factory that returns
     * null gets the 2D backend for that pane.
     */
    renderBackend?: RenderBackendFactory;
    /**
     * Grid lines: visibility (both default to true) plus per-axis colour, dash,
     * width and spacing. Unset colours/dashes fall through to the theme.
     */
    grid?: Partial<GridOptions>;
    /**
     * The settings dialog's Canvas block: grid, crosshair, scale text/lines and
     * plot margins. Every field is an override of the theme, so a later
     * `setTheme` still restyles anything the dialog did not touch.
     */
    canvas?: CanvasOptions;
    /** Per-field status-line switches applied to every pane legend on the chart. */
    statusLine?: LegendStatusLineOptions;
    /** Accessible label for the chart container (screen readers). */
    ariaLabel?: string;
    /**
     * Keyboard shortcuts. Pass a configured `ShortcutManager`, options to build
     * one, or `false` to disable keyboard control. Defaults to the built-in keymap.
     */
    shortcuts?: ShortcutManager | Partial<ShortcutManagerOptions> | false;
    /**
     * Custom price formatter for every pane's axis tick labels, the last-price
     * tag, and price-line labels. e.g. `(p) => '$' + p.toFixed(2)`. When omitted,
     * a tick-size-aware `toFixed` is used. Change it later via `setPriceFormatter`.
     */
    priceFormatter?: (price: number) => string;
    /**
     * Default price-scale options applied to every pane (tick size `minMove`,
     * `mode: 'linear' | 'logarithmic' | 'percentage' | 'indexed-to-100'`,
     * `inverted`, and top/bottom margins). `minMove` is the instrument's, so it
     * lands only on panes that quote it, see `setPriceScaleOptions`.
     * Tune a single pane later via `chart.panes()[n].priceScale.setOptions(...)`.
     */
    priceScale?: Partial<PriceScaleOptions>;
    /**
     * Custom time-axis and crosshair label formatter (receives UTC seconds). When
     * omitted, labels use IST (Indian market default). e.g. for UTC:
     * `(s) => new Date(s * 1000).toISOString().slice(11, 16)`.
     */
    timeFormatter?: (utcSeconds: number, tickMark?: TickMarkType) => string;
    /**
     * IANA zone the time axis and crosshair label in, e.g. 'America/New_York' or
     * 'Europe/London'. Defaults to 'Asia/Kolkata': a caller who passes nothing
     * gets exactly the labels the chart produced before this option existed.
     *
     * An IANA name and not a fixed offset, because a zone that observes DST is a
     * different offset in July than in January and a fixed one is silently wrong
     * for half the year. Change it at runtime with `setTimezone` when the terminal
     * moves between an NSE symbol and a US one. An explicit `timeFormatter`
     * outranks this: a host that formats its own labels has settled the question.
     *
     * Throws if the runtime does not recognise the name.
     */
    timezone?: string;
    /**
     * Hover-revealed zoom / step controls above the time axis, as terminals show.
     * `true` by default — they stay invisible until the pointer nears the bottom
     * of the chart. Pass `false` to drop them, or an options object to restyle.
     */
    timeNavigator?: boolean | Partial<TimeNavigatorOptions>;
    /** OpenAlgo corner mark by default. Pass false to hide it or options for custom branding. */
    branding?: boolean | LogoWatermarkOptions;
    /** Background text, off by default. Blank text follows setDataContext. */
    watermark?: boolean | ChartWatermarkOptions;
}
interface AddSeriesOptions {
    /** Target pane index (0 = price). Higher panes are created on demand. */
    paneIndex?: number;
    /** Style overrides merged onto the chart type's defaults. */
    style?: SeriesStyle;
    /**
     * Which price axis this series maps to. 'right' (default) and 'left' each draw
     * an axis and autoscale independently; '' is a hidden overlay scale (no axis)
     * for a volume histogram inside the price pane.
     */
    priceScaleId?: PriceScaleId;
    /**
     * Value formatting applied to this series' price scale (axis + crosshair tag):
     * `price` (tick-size precision), `volume` (compact 1.2K / 3.4M / 5.6B),
     * `percent` (a `%` suffix at a fixed precision), or a `custom` formatter.
     *
     * `percent` suffixes the value as it stands and does **not** scale it: a study
     * that already returns 0..100 reads `62.24%`, and one that returns a 0..1
     * fraction reads `0.62%`. Multiplying here would put the axis and the plotted
     * value into disagreement, which is the one thing a formatter must never do.
     */
    priceFormat?: PriceFormat;
}
/** Compact volume/number formatter (1.2K / 3.4M / 5.6B). */
declare function compactVolume(v: number): string;
/**
 * Emitted on every crosshair move (and `null` fields on pointer-leave) so a host
 * can render an OHLC legend / tooltip. `bar` is the hovered bar of the primary
 * price series; `point` is container-relative media px for positioning a
 * floating tooltip. See `subscribeCrosshairMove`.
 */
interface CrosshairMoveEvent {
    /** UTC seconds of the hovered bar, or null when off the data / pointer left. */
    time: number | null;
    /** Logical index under the cursor, or null. */
    index: number | null;
    /** Price under the cursor on the hovered pane, or null. */
    price: number | null;
    /** Hovered bar of the primary (first) price series, or null. */
    bar: Bar | null;
    /** Cursor position in container media px, or null on leave. */
    point: {
        x: number;
        y: number;
    } | null;
    /** Pane under the cursor, or null on leave. */
    paneIndex?: number | null;
    /**
     * True while a pointer is held. Placement mode swallows the pan path, so
     * this is the only way to tell a hover from a drag while it is still
     * happening. Absent on the all-null leave payload.
     */
    pressed?: boolean;
    /** Modifier keys held during the move. Absent on the leave payload. */
    modifiers?: PointerModifiers;
    /** Device behind the move. Absent on the leave payload. */
    pointerType?: PointerKind;
    /** Pressure as reported for the move (see `PointerSample`). Absent on the leave payload. */
    pressure?: number;
    /**
     * Every position the pointer passed through since the last move, in the
     * drag payload's space (container x, pane-local y), present only while
     * `pressed`. Placement mode never arms a drag, so a freehand stroke reads
     * its coalesced samples here.
     */
    samples?: PointerSample[];
}
/** Modifier keys held during a pointer gesture. */
interface PointerModifiers {
    shift: boolean;
    alt: boolean;
    ctrl: boolean;
    meta: boolean;
}
/** Device behind a pointer gesture. Anything the browser does not name reports as a mouse. */
type PointerKind = 'mouse' | 'touch' | 'pen';
/**
 * One position a pointer passed through during a drag, in the same media px
 * space as the payload's `point` (container x, pane-local y). `pressure` is
 * the pointer events convention: 0..1 from hardware that measures it, 0.5
 * while a button that cannot is held, 0 when nothing is known.
 */
interface PointerSample {
    x: number;
    y: number;
    pressure: number;
}
/**
 * What the engine reports about the physical pointer behind a gesture.
 * `crosshair:move`, `click`, `drag` and `drag:end` all carry these keys.
 */
interface PointerInfo {
    modifiers: PointerModifiers;
    pointerType: PointerKind;
    pressure: number;
}
/** Payload of the `click` event (`chart.on('click', ...)`). */
interface ChartClickEvent extends PointerInfo {
    /** `externalId` of the hit primitive, or null on empty plot. */
    id: string | null;
    /** Price under the press on that pane, or null off the plot. */
    price: number | null;
    /** UTC seconds under the press, interpolated between bars and past the right edge. */
    time: number;
    paneIndex: number;
    /** Press position: container media x, pane-local media y. */
    point: {
        x: number;
        y: number;
    };
    /** Set on the release half of a press-drag-release while a host is placing a shape. */
    viaDrag?: boolean;
    /**
     * The same state as `modifiers`, in the flat form the draw tier has read
     * since it shipped. `pressure` here is the pressure at the press, not the
     * release, which always reads 0.
     */
    shiftKey: boolean;
    ctrlKey: boolean;
    metaKey: boolean;
}
/** Payload of the `drag` event: a draggable primitive being moved. */
interface ChartDragEvent extends PointerInfo {
    id: string;
    price: number;
    time: number;
    paneIndex: number;
    /** Where the gesture was grabbed, so a delta starts at the press rather than the first move. */
    fromPrice: number;
    fromTime: number;
    /** Current pointer position: container media x, pane-local media y. */
    point: {
        x: number;
        y: number;
    };
    /**
     * Every position the pointer passed through since the previous `drag`,
     * oldest first, the last one at `point`. Browsers deliver moves at frame
     * rate and fold the positions between frames into the event; a freehand
     * stroke drawn from `point` alone is a polyline of frame-rate corners.
     */
    samples: PointerSample[];
}
/** Payload of the `drag:end` event: the release that finished a primitive drag. */
interface ChartDragEndEvent extends PointerInfo {
    id: string;
    price: number;
    time: number;
    paneIndex: number;
    /** Release position: container media x, pane-local media y. */
    point: {
        x: number;
        y: number;
    };
}
/**
 * What the pointer was over when the context menu was raised. The chart cannot
 * know which menu items an app wants, but it does know what was hit, which is
 * the part an app cannot work out for itself: a canvas gives it a pixel, not an
 * object. `primitive` is anything hit-testable that is not one of the named
 * kinds (a price line, an order pill, a marker).
 */
type ContextMenuTargetKind = 'drawing' | 'indicator' | 'legend' | 'primitive' | 'series' | 'price-scale' | 'time-scale' | 'empty';
interface ContextMenuTarget {
    kind: ContextMenuTargetKind;
    /** Hit-test id of the thing under the pointer, when there was one. */
    id: string | null;
    /** Indicator instance id, when `kind` is 'indicator'. */
    instanceId?: string;
    /** Series type, when `kind` is 'series'. */
    seriesType?: SeriesType;
    /** Which axis strip was hit, when `kind` is 'price-scale'. */
    side?: 'right' | 'left';
    /**
     * Which of the pane's scales that strip acts on, when `kind` is
     * 'price-scale': the side's own scale, or the hidden overlay scale ('') when
     * the side carries no series of its own and the pane's values are all on the
     * overlay. It is the argument the `priceAxis*` calls take.
     */
    scaleId?: PriceScaleId;
}
/** The four price-scale modes, in the order a menu lists them. */
declare const PRICE_SCALE_MODES: readonly PriceScaleMode[];
/**
 * What a host needs to render a menu over one price axis: which items are on,
 * and which of them mean anything on this axis. See `Chart.priceAxisState`.
 */
interface PriceAxisState {
    paneIndex: number;
    scaleId: PriceScaleId;
    /** Strip this scale is drawn in. The overlay scale reports 'right' and draws none. */
    side: 'right' | 'left';
    /** Some series on the pane maps to this scale. */
    active: boolean;
    /** Auto-fit: the range tracks the data rather than staying where it was put. */
    autoFit: boolean;
    inverted: boolean;
    mode: PriceScaleMode;
    /** False while the scale still sits on its 0..1 placeholder (nothing measured). */
    scaled: boolean;
    lockRatio: boolean;
    /** Whether `movePriceAxis` would do anything: something to move, and a free side. */
    movable: boolean;
}
/** Payload of the `contextmenu` event (`chart.on('contextmenu', ...)`). */
interface ContextMenuEvent {
    paneIndex: number;
    /** Cursor position in container media px, for placing the menu. */
    point: {
        x: number;
        y: number;
    };
    /** Price under the pointer on that pane, or null off the plot. */
    price: number | null;
    /** UTC seconds under the pointer, or null when there is no data. */
    time: number | null;
    /** Logical bar index under the pointer, or null off the plot. */
    index: number | null;
    target: ContextMenuTarget;
    /** Suppress the browser's own menu. Call it to show your own. */
    preventDefault(): void;
}
/**
 * Payload of the 'renderer:fallback' event: the chart has moved every pane
 * from a GPU backend to `canvas2d` for the rest of the session, because the
 * device's context was lost or turned out unusable. The frame that noticed
 * was already painted through 2D by the backend itself, so nothing went
 * blank; this is the host's cue to update anything that shows the renderer.
 */
interface RendererFallbackEvent {
    from: RenderBackendKind;
    to: 'canvas2d';
    reason: RendererFallbackReason;
}
declare class Chart {
    private readonly _container;
    private readonly _doc;
    private readonly _pixelRatio;
    private _theme;
    private readonly _panes;
    private readonly _loop;
    /** The frame scheduler, kept for the one-shot re-measure after construction. */
    private readonly _raf;
    private _remeasureHandle;
    private readonly _dataLayer;
    private readonly _timeScale;
    private readonly _priceAxisWidth;
    private readonly _timeAxisHeight;
    private _pending;
    private _resizeObserver;
    private _width;
    private _height;
    private _hasFitContent;
    private _crosshairMode;
    private _shortcuts;
    private _trading;
    private _pointerInside;
    private _keyTarget;
    private readonly _now;
    private readonly _conflate;
    private readonly _conflationFactor;
    /**
     * One backend per pane; see `ChartOptions.renderer` and `renderBackend`.
     * Replaced by the 2D factory after a session fallback, so a pane added
     * later matches the ones already on screen.
     */
    private _backendFactory;
    /**
     * The kind the first pane got. A factory may decline per pane, so this is
     * what the chart actually paints with rather than what was asked for.
     */
    private _rendererKind;
    /** What the `renderer` option asked for, so a decline can be reported once. */
    private readonly _requestedRenderer;
    private _gridVert;
    private _gridHorz;
    /** The Canvas option block: overrides of the theme, never a copy of it. */
    private readonly _canvas;
    /** Status-line switches pushed onto every pane legend, host-added ones included. */
    private readonly _statusLine;
    /** Axis-strip chrome switches. Empty is the shipped chart: neither drawn. */
    private readonly _axisChrome;
    /**
     * The corner clock's object form, kept across an off/on toggle. A switch that
     * turns the clock off must not also throw away the `showOffset` a host chose
     * for it: switching it back on would silently be a different clock, and
     * nothing on the switch could put the choice back.
     */
    private _sessionClockForm;
    /** Wall-clock UTC seconds for the two axis readings, injectable for tests. */
    private _wallClock;
    /**
     * Trade-layer colours held here rather than on the controller, so reading or
     * setting them never has to instantiate one. `chart.trading` hands them over
     * when the controller is finally created.
     */
    private readonly _tradingSettings;
    /** Chart-owned event strip (see `setEvents`), plus which types it draws. */
    private _events;
    private _eventMarkers;
    private _eventPane;
    private readonly _eventVisible;
    private _cursorPane;
    private _cursor;
    private _dragging;
    private readonly _navigation;
    private _dragStartX;
    private _dragStartY;
    private _lastDragY;
    /** Pointers whose gesture the missed-release recovery already ended. */
    private readonly _endedPointers;
    private readonly _pointers;
    private _pinch;
    private _pinchPane;
    private _liveRegion;
    private _dragStartOffset;
    private _lastDragX;
    private _lastDragT;
    private _dragVelocity;
    private _kineticHandle;
    private _kineticEpoch;
    private _zoomHandle;
    /** The glide in flight, so a second wheel tick folds into it (see ZoomGlide.add). */
    private _zoomGlide;
    private _zoomGlideStart;
    private _zoomGlideApplied;
    private readonly _animZoom;
    private readonly _animAutoscale;
    private _autoscaleTime;
    private _autoscaleFrames;
    private _navigationEpoch;
    private readonly _zoomAnchor;
    private readonly _doubleClick;
    private readonly _firstDataId;
    /** Handle + record of the primary price series (see `primarySeries`). */
    private _primary;
    private readonly _indicators;
    private _dataContext;
    /** Guards indicator recompute against re-entry via its own `series.setData`. */
    private _recomputing;
    private _indicatorsDirty;
    /** Instance id of the indicator whose colours are on the price bars, if any. */
    private _barColorOwner;
    private _barColors;
    /**
     * Each price bar's own colour, indexed like the series. The overlay overwrites
     * `Bar.color`, so a bar's own value is only readable the first time we touch
     * it, and removing the indicator has to put something back.
     */
    private readonly _barColorBase;
    /** Time of bar 0 when the snapshot was taken, to catch a replaced history. */
    private _barColorAnchor;
    /** Opaque drawing-tier payload, round-tripped through get/restoreState. */
    private _drawingState;
    /** Pane currently maximized, and the weights to restore when it un-maximizes. */
    private _maximizedPane;
    /** Legend rows per pane, so new ones stack below existing ones. */
    private readonly _legends;
    /** Pane holding the primary price series (only this pane gets magnet snapping). */
    private _firstPaneIndex;
    private _historyLoader;
    private _loadingHistory;
    private _clickCb;
    private _crosshairCb;
    private _pointerMoved;
    /** While true, pointer gestures place anchors instead of panning. */
    private _placementMode;
    /** Where indicator legend rows start inside a pane (see `legendOffset`). */
    private readonly _legendOffset;
    private _downPane;
    private _downX;
    private _downLocalY;
    /** Pressure at the press; a click reports this, since its release always reads 0. */
    private _downPressure;
    private _dragId;
    private _hoverId;
    /** Whether that primitive draws below the overlay, so leaving it must repaint the base. */
    private _hoverOnBase;
    private _overlayFrozen;
    private _dragCb;
    private _dragEndCb;
    private _axisDrag;
    /** The scale a price-axis drag is rescaling: either side's, whichever strip was grabbed. */
    private _axisDragScale;
    /** Active pane-divider drag: which boundary, and the weights/heights at grab time. */
    /** True once a primitive drag has actually moved — see the pointerup note. */
    private _dragMoved;
    /** Where the drag was grabbed, in data space, so deltas start at the press. */
    private _dragFrom;
    private _paneResize;
    private _axisStartCoord;
    private _axisStartMin;
    private _axisStartMax;
    private _axisStartSpacing;
    private _priceFormatter;
    private _priceScaleOptions;
    /**
     * The panes whose numbers are the instrument's price, which is what decides
     * whether a chart-wide `minMove` reaches them (see `_scalePatchFor`).
     *
     * Held by pane identity rather than by index, for the reason spelled out in
     * `_createSeries`: `removePane` splices the array and `movePane` swaps two
     * entries, so a pane's slot number is not the pane. Weak because a removed
     * pane is destroyed and nothing else keeps it alive.
     */
    private readonly _pricePanes;
    private _timeFormatter;
    private _timezone;
    private _leftAxisWidth;
    private _rightAxisWidth;
    private _timeNav;
    /** Pane the navigator is currently attached to, so it can follow the bottom. */
    private _timeNavPane;
    private _branding;
    private _brandingOptions;
    private _brandingPress;
    private _watermark;
    private _watermarkOptions;
    constructor(container: HTMLElement, options?: ChartOptions);
    /** Register a callback fired when the user pans near the left (oldest) edge. */
    setHistoryLoader(loader: () => void): void;
    /** Call after a history-paging load resolves to re-enable the trigger. */
    historyLoadComplete(): void;
    get dataLayer(): DataLayer;
    get timeScale(): TimeScale;
    /** Restore a saved logical range (e.g. preserve the user's zoom across a data reload). */
    setVisibleLogicalRange(range: LogicalRange): void;
    /** The current visible logical range. */
    getVisibleLogicalRange(): LogicalRange;
    /** Fit all bars into view (no-arg convenience; bar count from the data). */
    fitContent(): void;
    /** Current navigation preferences, safe to save as JSON. */
    navigationOptions(): Readonly<ChartNavigationOptions>;
    /** A new default bar count immediately restores that view without dropping history. */
    setNavigationOptions(patch: Partial<ChartNavigationOptions>): void;
    private _patchNavigation;
    private _fitDefaultView;
    /** The keyboard shortcut manager (null when shortcuts are disabled). */
    get shortcuts(): ShortcutManager | null;
    /**
     * The data-driven trading layer: push positions/orders/trades and the chart
     * renders pills + markers, emitting `trading:*` events on interaction. Created
     * on first access.
     */
    get trading(): TradingController;
    /**
     * Whether the trade layer exists yet. Reading `chart.trading` creates one,
     * and creating one claims the click/drag subscriptions, so anything that
     * merely inspects the chart (a settings dialog) asks this first.
     */
    hasTrading(): boolean;
    /**
     * Trade-layer colours, whether or not the controller has been created. Once
     * it exists it is the single answer (a host may set colours on it directly);
     * before that, the held patch is folded onto the defaults. The fold is needed
     * because the two shapes name a colour differently: the patch says
     * `longColor`, the resolved palette says `long`.
     */
    tradingSettings(): TradingColors;
    /**
     * Recolour the trade layer. Safe before it exists: the patch is held and
     * handed over the moment `chart.trading` builds the controller.
     */
    setTradingSettings(patch: TradingSettings): void;
    /** Add a series and return its data handle. */
    addSeries(type: SeriesType, options?: AddSeriesOptions): SeriesApi;
    /**
     * `claimPrimary` is false for series the chart creates on a caller's behalf
     * (indicator plots), so an indicator's line never becomes the price series
     * that drives the magnet crosshair and the OHLC legend.
     */
    private _createSeries;
    /**
     * The primary price series: the first one added, and the one the magnet
     * crosshair, the OHLC legend, the market-replay controller and a settings
     * dialog's Symbol tab all describe. Null until a price series exists.
     */
    primarySeries(): SeriesApi | null;
    /**
     * Type and live style of the primary series, for a settings dialog: the type
     * decides which controls apply (a candle has borders, a line has a dash), and
     * the style is the object `applyOptions` patches.
     */
    primarySeriesInfo(): {
        type: SeriesType;
        style: Readonly<SeriesStyle>;
    } | null;
    /**
     * Push a series' `precision` override onto the price scale it maps to.
     *
     * It rides the scale's *formatter* rather than `minMove` because minMove also
     * drives `snapToTick`: precision 0 would start snapping every price to whole
     * numbers. Going through the formatter covers the axis ticks, the last-value
     * tag, the crosshair label and the drawing-tool labels at once, since they all
     * call `priceScale.format`. Clearing it restores the chart-wide formatter.
     */
    private _applyPrecision;
    /** Add a horizontal price line (order/SL/TP/alert/level) to a pane. */
    addPriceLine(opts: PriceLineOptions, paneIndex?: number): PriceLine;
    /** Add an earnings/dividend/split event-marker strip to a pane. */
    addEventMarkers(paneIndex?: number): EventMarkers;
    /**
     * Hand the chart the corporate-action / news calendar and let it own the
     * strip. The difference from `addEventMarkers` is who filters: holding the
     * full list here is what lets `setEventOptions` (the settings dialog's Events
     * switches) turn a type off and back on without the host re-supplying data.
     */
    setEvents(events: readonly ChartEvent[], paneIndex?: number): void;
    /** Turn event types on/off. Unlisted types stay visible. */
    setEventOptions(patch: ChartEventOptions): void;
    eventOptions(): ChartEventOptions;
    private _syncEvents;
    /**
     * Add a registered indicator. Built-in descriptors live in the lazy
     * `openalgo-charts/indicators` tier — import it (or register your own with
     * `registerIndicator`) before calling this.
     *
     * `'onchart'` indicators overlay the price pane; `'pane'` indicators get a new
     * pane of their own unless `paneIndex` says otherwise. The returned handle
     * recomputes automatically whenever the source data changes.
     *
     * ```ts
     * import 'openalgo-charts/indicators';
     * const macd = chart.addIndicator('macd', { fastPeriod: 8 });
     * macd.setSettings({ fastPeriod: 12 });
     * macd.remove();
     * ```
     */
    addIndicator(indicatorId: string, settings?: Readonly<IndicatorSettings>, options?: {
        paneIndex?: number;
    }): IndicatorApi;
    /**
     * Give a repeated indicator its own colours. Three EMAs all in the
     * descriptor's default blue are indistinguishable on the chart *and* in the
     * legend, so the second and later instances rotate through a palette.
     *
     * Only fills colour keys the caller left unset, so an explicit colour always
     * wins, and the first instance is never touched — it keeps the colours the
     * descriptor chose.
     */
    private _distinctColors;
    /**
     * Every live indicator instance, in the order they were added.
     *
     * Flushes any pending recompute first. Indicator maths is deferred to the
     * frame, so a caller that updates a bar and reads a value back in the same
     * turn would otherwise see the previous tick's numbers.
     */
    indicators(): readonly IndicatorApi[];
    /** Remove one indicator instance by its handle id. Returns true if it existed. */
    removeIndicator(instanceId: string): boolean;
    private _forgetIndicator;
    /** Optional instrument identity supplied by the host, never inferred from bars. */
    getDataContext(): Readonly<ChartDataContext> | undefined;
    /** Clear the previous source bars before changing context, then load the new source. */
    setDataContext(context: ChartDataContext | undefined): void;
    /** Replace chart-owned branding. Manually attached primitives are independent. */
    setBranding(options: boolean | LogoWatermarkOptions): void;
    /** Host branding options, excluded from saved chart state. */
    brandingOptions(): false | LogoWatermarkOptions;
    /** Patch background text preferences. Boolean input changes visibility only. */
    setWatermarkOptions(options: boolean | ChartWatermarkOptions): void;
    /** JSON-safe preferences. Automatic text remains blank in this snapshot. */
    watermarkOptions(): Readonly<ChartWatermarkOptions>;
    private _syncWatermark;
    private _indicatorHost;
    /**
     * Take (or withdraw) the price bars' colour overlay on behalf of one
     * indicator instance.
     *
     * Only one overlay can be on the candles, so this is last writer wins. That is
     * deterministic rather than arbitrary: publishers run inside
     * `_flushIndicators`, in `addIndicator` order, so the same instance wins
     * every frame. Withdrawal is gated on ownership, or the first publisher's
     * teardown would wipe the second one's colours. If the *winner* is removed
     * while another publisher is still live, the bars go back to their own colours
     * until that publisher's next recompute.
     */
    private _setBarColors;
    /**
     * Republish the primary series with the overlay applied.
     *
     * The bars in the data layer are the **caller's own objects** (`setData` keeps
     * the references), so painting a colour onto them in place would reach back
     * into the host's array and outlive the indicator. Cloning the ones that
     * change is what keeps that from happening; unchanged bars are passed through,
     * and a pass where nothing changed writes nothing at all, which is the common
     * case on a live tick.
     */
    private _applyBarColors;
    /**
     * Mark every indicator stale after a source-data change, to be recomputed
     * once before the next paint.
     *
     * Recomputing straight from the data update instead costs a full pass over
     * every bar, for every indicator, for every tick. A busy symbol delivers ticks
     * in bursts far faster than the display refreshes, so most of those passes are
     * thrown away unseen: 50 ticks between two frames cost 50 recomputes per
     * indicator and blocked the main thread for over half a second on a ten
     * indicator chart. Deferring to the frame makes that one recompute, because
     * only the last one could ever have been shown.
     *
     * `flushIndicators` therefore has to run before anything that can observe a
     * value, which is the frame and the public `indicators()` accessor.
     */
    private _invalidateIndicators;
    /**
     * Recompute every stale indicator. Reentrant-guarded: an indicator writes its
     * plots with `series.setData`, which re-enters the same data-mutation path
     * that marked us dirty.
     */
    private _flushIndicators;
    /** Subscribe to clicks on hit-testable primitives (markers, events, lines). */
    subscribeClick(cb: (externalId: string) => void): void;
    /**
     * Subscribe to crosshair movement for an OHLC legend / tooltip. The callback
     * fires with the hovered bar of the primary price series on every move, and
     * with all-null fields when the pointer leaves the plot.
     */
    subscribeCrosshairMove(cb: (e: CrosshairMoveEvent) => void): void;
    /**
     * Subscribe to drags of draggable primitives (order / SL / TP lines, drawing
     * handles). Fires per move and on release.
     *
     * `time` is the UTC seconds under the cursor, interpolated between bars and
     * extrapolated past the right edge — so a two-axis drag (a trendline endpoint,
     * a projection) has a usable time even where the gapless axis has no bar.
     * Price-only consumers can simply ignore it.
     */
    subscribeDrag(onDrag: (externalId: string, price: number, time: number) => void, onDragEnd?: (externalId: string, price: number, time: number) => void): void;
    /**
     * Guarantee a pane's price scale has a real range before converting y↔price.
     * Autoscaling normally happens during paint, so every coordinate API — and
     * the price carried by click/drag events — used to answer with the default
     * 0..1 (or ±Infinity) until the first frame had run. Callers cannot be asked
     * to wait for a paint, so scale on demand.
     */
    private _ensureScaled;
    /** Container-relative x (media px) → UTC seconds on the (gapless) time axis. */
    private _xToTime;
    /** UTC seconds → container-relative x (media px). The inverse of `_xToTime`. */
    timeToCoordinate(time: number): number;
    /** Container-relative x (media px) → UTC seconds. */
    coordinateToTime(x: number): number;
    private readonly _listeners;
    /** Subscribe to a named chart event. Returns an unsubscribe function. */
    on(event: string, cb: (payload: unknown) => void): () => void;
    /** Subscribe to the next occurrence of an event, then auto-unsubscribe. */
    once(event: string, cb: (payload: unknown) => void): () => void;
    /** Remove one listener, or (when `cb` is omitted) every listener for an event. */
    off(event: string, cb?: (payload: unknown) => void): void;
    /** Dispatch a named event. Public so the lazy trade layer can route through it. */
    emit(event: string, payload: unknown): void;
    /** Emit a viewport event ('pan' | 'zoom') carrying the visible time + logical range. */
    private _emitViewport;
    /**
     * Emit a viewport event for a change whose kind is not known up front, and
     * only if the window actually moved.
     *
     * The gesture paths know exactly what happened (a wheel is a zoom, a drag is
     * a pan) and emit directly. The programmatic paths do not: restoring a saved
     * range, fitting content or pressing an arrow key can move the window, resize
     * it, or do nothing at all because the scale was already there or clamped.
     * The span is the discriminator a listener cares about, and the no-move check
     * matters because a linked grid would otherwise re-broadcast on every no-op.
     */
    private _emitViewportIfMoved;
    /** Public: attach any primitive (indicators, profiles, custom overlays) to a pane. */
    addPrimitive(primitive: IPrimitive, where?: number | PrimitivePlacement): void;
    /** The pane a chart anchor currently resolves to. */
    private _anchorTarget;
    /**
     * Move every chart-anchored primitive to the pane its anchor now names.
     *
     * Called after anything that changes which pane sits at an edge: a pane added,
     * removed, moved, or maximized. Maximize matters most and is the case a host
     * cannot easily handle itself: it HIDES the other panes, so a mark pinned to
     * pane 0 vanishes with it rather than merely sitting in the wrong place.
     */
    private _rehomeAnchored;
    /**
     * Map a price to a container-relative Y in media (CSS) px, for positioning DOM
     * overlays (order panels, tooltips) over a pane. Returns null if the pane
     * doesn't exist. The inverse is `coordinateToPrice`.
     */
    priceToCoordinate(price: number, paneIndex?: number): number | null;
    /** Map a container-relative media-px Y back to a price on a pane (inverse of priceToCoordinate). */
    coordinateToPrice(y: number, paneIndex?: number): number | null;
    /**
     * Grid lines at runtime: visibility of each axis, plus its colour, dash,
     * width and spacing. Omitted fields keep their current value. Repaints every
     * pane.
     */
    setGridOptions(opts: Partial<GridOptions>): void;
    /** Current grid options, visibility first (it is the one field always set). */
    gridOptions(): {
        vertLines: boolean;
        horzLines: boolean;
    } & Partial<GridOptions>;
    /**
     * The Canvas option block (grid, crosshair, scale text/lines, plot margins).
     * Each sub-block merges field by field, so setting one grid colour leaves the
     * rest of the grid alone.
     */
    setCanvasOptions(patch: CanvasOptions): void;
    /** The Canvas option block as it stands (theme fallbacks are not folded in). */
    canvasOptions(): CanvasOptions;
    /**
     * Price-scale options for every pane (mode, inverted, tick size, margins),
     * and the default new panes inherit.
     *
     * `scope` says how far a chart-wide setting reaches:
     *  - `'primary'` (default): each pane's right scale only. A mode change
     *    wants this: rebasing a volume overlay quotes percent change in lots.
     *  - `'axes'`: every scale that draws a ladder, so the left axis moves with
     *    the right. Plot margins want this.
     *  - `'all'`: the hidden overlay scales too. Almost nothing should: an
     *    overlay's margins are its creator's placement, see `Pane.axisScales`.
     *
     * `minMove` is the one field no scope carries onto a pane that does not quote
     * the instrument, whichever scope is asked for: see `_scalePatchFor`. Every
     * other field is a property of the axis and reaches exactly as far as `scope`
     * says.
     */
    setPriceScaleOptions(patch: Partial<PriceScaleOptions>, scope?: 'primary' | 'axes' | 'all'): void;
    /**
     * A chart-wide price-scale patch as one pane should receive it.
     *
     * Every field in it describes the axis, except `minMove`, which describes the
     * **instrument**: it is the step the symbol trades in, 0.05 on an NSE equity.
     * A pane that plots something else is quoted in its own units, so handing it
     * that step is not a coarse answer but an answer to a different question. It
     * shipped as one: a host setting the instrument's 0.10 tick chart-wide made
     * `PriceScale.precision` report one decimal on *every* pane, so a William VIX
     * Fix reading 0.61 was labelled "0.6" and an RSI ladder read "70.0, 50.0,
     * 30.0". Withheld, those axes fall back to inferring precision from the range
     * they actually cover, which is the reading their own numbers imply.
     *
     * Only the chart-wide setters filter. An axis named outright
     * (`setPriceAxisOptions`, a series' `priceFormat`) is the caller saying what
     * that one axis quotes, and is obeyed.
     */
    private _scalePatchFor;
    /**
     * Record that a pane quotes the instrument, and hand it the tick it was not
     * given while it did not.
     *
     * Pane 0 is one from birth. Any other pane starts out an indicator's, so a
     * host adding a second symbol to a pane of its own has to be able to promote
     * one after the fact, or the comparison would lose the tick-sized axis it has
     * always had.
     */
    private _claimPricePane;
    /** The primary pane's price-scale options (what the Scales tab reads). */
    priceScaleOptions(): PriceScaleOptions;
    /**
     * Put every pane's price axis back under autoscale, or pin it where it is.
     * `PriceScale.setAutoScale` alone changes nothing on screen until something
     * else asks for a frame; this re-measures and repaints.
     */
    setAutoScale(on: boolean): void;
    /**
     * State of one price axis, for a host rendering a menu over it: what is
     * currently on, and which items are worth offering. Null for a pane that does
     * not exist.
     *
     * `active` false is a scale no series maps to: the ladder on an empty chart,
     * or the side a menu was raised on before anything was plotted there. That is
     * a row to render disabled with its state visible, not one to leave out.
     */
    priceAxisState(paneIndex?: number, scaleId?: PriceScaleId): PriceAxisState | null;
    /**
     * Options for one pane's scale (mode, invert, tick size, margins) rather than
     * every pane's. The four modes are one field, so picking one drops the
     * previous by construction: a menu renders them as a single choice.
     */
    setPriceAxisOptions(paneIndex: number, scaleId: PriceScaleId, patch: Partial<PriceScaleOptions>): void;
    /**
     * Auto-fit one axis: its range tracks the data again, or stays where the user
     * left it. Turning it on releases any ratio lock on that axis, for the reason
     * given in `setAutoScale`.
     */
    setPriceAxisAutoFit(paneIndex: number, scaleId: PriceScaleId, on: boolean): void;
    /**
     * Pin one axis' price-per-bar ratio: zooming the time axis then rescales the
     * prices with it, so a trend drawn at 45 degrees stays at 45 degrees. The
     * axis goes manual, because auto-fit would re-fit the data every frame and
     * undo the ratio being held.
     *
     * Returns whether the axis is now in the state asked for. Locking fails on a
     * scale nothing has measured: there is no ratio to hold on an empty pane, or
     * on one whose series plot no values at all.
     */
    setPriceAxisLockRatio(paneIndex: number, scaleId: PriceScaleId, on: boolean): boolean;
    /**
     * Move a pane's price axis to the other strip, taking the series that map to
     * it and everything the axis was set to. Returns false when that side carries
     * nothing, or when the other side is already occupied: one strip draws one
     * axis (see `Pane.moveSeriesScale`), which is what `movable` reports.
     */
    movePriceAxis(paneIndex: number, from: 'right' | 'left', to: 'right' | 'left'): boolean;
    /** Measure one scale on demand, the way `_ensureScaled` does for the pane's right one. */
    private _ensureScaledFor;
    /**
     * Per-field status-line switches, applied to every pane legend on the chart:
     * the host's symbol row and the indicator rows alike, which is what makes one
     * switch mean the same thing everywhere. Merges field by field.
     */
    setStatusLineOptions(patch: LegendStatusLineOptions): void;
    statusLineOptions(): LegendStatusLineOptions;
    /**
     * Turn the axis-strip chrome on or off, and hand it a clock. Merges field by
     * field, so switching the countdown on leaves the corner clock alone.
     */
    setAxisChromeOptions(patch: AxisChromeOptions): void;
    /** The axis-chrome switches as they stand. */
    axisChromeOptions(): AxisChromeOptions;
    /** Crosshair behaviour ('normal' or 'magnet'). Set it via `applyOptions`. */
    crosshairMode(): CrosshairMode;
    /** The active palette. Swap it with `setTheme`. */
    theme(): ChartTheme;
    /**
     * Flatten every pane's base + overlay canvas into one opaque canvas (device
     * px). The chart renders as stacked layered canvases, so the browser's native
     * right-click "Save image" only captures the layer under the pointer (usually
     * the transparent crosshair overlay) — use this to export the full chart.
     */
    takeScreenshot(): HTMLCanvasElement;
    /**
     * The chart as a standalone SVG document: every pane's base and overlay
     * paint, in the order the DOM stacks them, run once into a serialising
     * context at pixel ratio 1. Text stays text (selectable, searchable) and
     * lines stay lines, so the file scales without the blur a PNG picks up.
     *
     * Nothing transient is in it: no crosshair, no hover state, no drag. What is
     * in it is exactly what the renderers, primitives and drawing tools draw,
     * because it is the same code drawing. A primitive that paints through a
     * call with no vector form (a bitmap logo, a shadow) is simply thinner in
     * the export; see `SvgContext` for the list.
     *
     * Returns the string only. Saving it is the host's job, the way
     * `downloadScreenshot` is the host-facing half of `takeScreenshot`:
     * `new Blob([svg], { type: 'image/svg+xml' })` and an anchor is all it takes.
     */
    exportSVG(options?: ExportSvgOptions): string;
    /** Chart-anchored primitives, re-homed by `_rehomeAnchored`. */
    private readonly _anchored;
    private _addPrimitive;
    /** Remove a primitive from whichever pane holds it. */
    removePrimitive(primitive: IPrimitive): void;
    /**
     * Renumber legend rows per pane in insertion order, so removing one closes
     * the gap instead of leaving a hole where it used to sit.
     */
    private _restackLegends;
    /**
     * Apply `legendOffset` to whichever pane currently renders at the chart's
     * top-left, rather than a fixed index.
     *
     * The offset describes a region of the *chart* the host has covered with its
     * own overlay — a symbol line, an OHLC readout. Normally that is pane 0, but
     * maximizing a lower pane parks the others at a placeholder weight, so the
     * maximized pane ends up rendering in that same corner. Pinning the offset to
     * pane 0 left it drawing its legend straight through the host's readout.
     *
     * Host-added legend rows are left alone: the host positions its own.
     */
    private _syncLegendOffsets;
    /** A host for the (lazy-loaded) trade layer to attach/detach its primitives on a pane. */
    tradeHost(paneIndex?: number): {
        addPrimitive(p: IPrimitive): void;
        removePrimitive(p: IPrimitive): void;
    };
    /** Apply one live bar; auto-scroll only on a genuine right-edge append. */
    private _updateBar;
    private _ensurePane;
    private _setData;
    /** History paging: merge older bars, preserving the viewport (§4.2). */
    private _prependData;
    /**
     * The render backend the chart is painting series with right now: what the
     * first pane was given, which is the `renderer` option unless its factory
     * declined (no WebGL2 on this device) and the 2D backend stood in, and
     * `canvas2d` from the moment a GPU backend degrades ('renderer:fallback').
     */
    get rendererKind(): RenderBackendKind;
    /** The name `rendererKind` shipped under; the same value. */
    get renderer(): RenderBackendKind;
    /** A backend for one more pane, with the 2D one standing in for a refusal. */
    private _newBackend;
    /**
     * Leave the GPU backend for good. Every pane is switched in the same call
     * so the chart never paints half its panes on each path, later panes get
     * the 2D factory, and the frame that noticed is repainted on the new
     * backends (the one just painted went through the old backend's own 2D
     * path, so nothing was blank in between).
     */
    private _fallbackToCanvas2d;
    private _addPane;
    /**
     * Set a custom price formatter for every pane's axis labels, last-price tag,
     * and price-line labels at runtime (e.g. switch to a currency format). Pass
     * null to restore the default tick-size-aware formatting.
     */
    setPriceFormatter(fn: ((price: number) => string) | null): void;
    /**
     * Set a custom time-axis + crosshair label formatter (UTC seconds -> string)
     * at runtime. Pass undefined to restore the IST default.
     */
    setTimeFormatter(fn: ((utcSeconds: number, tickMark?: TickMarkType) => string) | undefined): void;
    /** The IANA zone the chart labels time in. */
    timezone(): string;
    /**
     * Change the zone the time axis and crosshair label in, without rebuilding the
     * chart: a terminal switching from an NSE symbol to a US one needs exactly
     * this. Throws on a name the runtime does not recognise, rather than quietly
     * labelling in the old zone, because a chart showing the wrong hours is the
     * kind of wrong nobody notices until it costs money.
     */
    setTimezone(zone: string): void;
    /**
     * Turn pointer gestures into anchor placement instead of panning. A host arms
     * this while a drawing tool is active: a press no longer scrolls the chart, and
     * a press-drag-release is reported as two `click` events (press point, then
     * release point, the latter tagged `viaDrag`) so a two-point shape can be drawn
     * in one gesture. `DrawingController` drives this for you.
     */
    setPlacementMode(active: boolean): void;
    /**
     * Arm the next plot click to answer with a price or a bar time, handed to
     * `cb`. Returns a cancel function; arming another pick on this chart cancels
     * the pending one. `pick:start` and `pick:end` bracket it so a host can show
     * its own cursor while the pick is live. See `input/pick` for why this does
     * not touch placement mode.
     */
    beginPick(kind: PickKind, cb: (value: number) => void): () => void;
    /** Swap the palette at runtime (dark/light toggle) without recreating the chart. */
    setTheme(theme: ChartTheme): void;
    /**
     * Apply a subset of chart options at runtime (theme, grid, formatters,
     * crosshair mode) without recreating the chart.
     */
    applyOptions(opts: {
        theme?: ChartTheme;
        grid?: Partial<GridOptions>;
        canvas?: CanvasOptions;
        statusLine?: LegendStatusLineOptions;
        priceScale?: Partial<PriceScaleOptions>;
        priceFormatter?: ((price: number) => string) | null;
        timeFormatter?: ((utcSeconds: number, tickMark?: TickMarkType) => string) | undefined;
        timezone?: string;
        crosshairMode?: CrosshairMode;
    }): void;
    panes(): readonly Pane[];
    /**
     * Capture the chart's serialisable state: viewport, grid, crosshair mode,
     * pane weights and price scales, indicator instances, and a `drawings` slot
     * the drawing tier fills. JSON-safe.
     *
     * Series **data** is not captured — the app owns that (it knows the symbol,
     * the timeframe, and the feed). Series *descriptors* are, so an app that
     * rebuilds its own series can re-apply their styling and placement.
     */
    getState(): ChartState & ChartSettingsState & {
        timezone: string;
    };
    /**
     * Re-apply a state captured by `getState`. Restores grid, crosshair mode,
     * pane weights and price scales, indicators, and the viewport — everything
     * the chart is the source of truth for.
     *
     * It does **not** recreate series: the chart has no way to know their data.
     * The returned report lists the series descriptors it saw so the caller can
     * rebuild them (`addSeries(s.type, { paneIndex: s.paneIndex, style: s.style })`)
     * and then feed them.
     *
     * Restore the viewport *after* your data lands — logical ranges index bars, so
     * a range applied to an empty chart means nothing. Call `restoreState` again
     * (or `setVisibleLogicalRange`) once the series are populated.
     */
    restoreState(state: unknown): RestoreReport;
    /**
     * The opaque `drawings` slot in the chart state. The base engine only
     * round-trips it; the drawing tier reads and writes it.
     */
    drawingState(): unknown;
    setDrawingState(value: unknown): void;
    invalidate(build: (mask: InvalidateMask) => void): void;
    /**
     * Measure the container once more, a frame after construction.
     *
     * The size read in the constructor is only what the browser has resolved so
     * far. A chart created from a script that runs before the flex/grid layout
     * settles measures a pre-layout box, lays its panes into it, and then hears
     * the *same* stale contentRect from the ResizeObserver in that frame, so
     * nothing corrects it until an unrelated resize: the reported symptom is a
     * large empty band under the chart that a refresh makes go away.
     *
     * Only a real measurement is allowed to win. Zero or absent means a container
     * that is hidden or not in the document yet, and overwriting a size the host
     * applied by hand with that would be a worse bug than the one being fixed;
     * the ResizeObserver still picks such a container up when it appears.
     */
    private _remeasure;
    applySize(width: number, height: number): void;
    /**
     * Distribute height across panes by weight; sync the shared time-scale width.
     *
     * `geometryOnly` sizes the layout arithmetic (pane boxes, scale heights, the
     * time-scale width) and leaves the DOM and the canvases alone. The vector
     * export uses it to paint at a size that is not the screen's and then to put
     * the screen's back, without clearing a canvas or moving a flex box on the
     * way through.
     */
    private _relayout;
    /**
     * Reserve the chart-wide axis columns: a left one as soon as any pane has a
     * left price scale in use, and the right one unless every scale in use has
     * moved off it. A chart with nothing on any scale keeps its right column,
     * which is where an empty chart's ladder belongs; the columns are chart-wide
     * rather than per pane because the panes share one time axis and their plots
     * have to start and end at the same x.
     */
    private _recomputeAxisColumns;
    /**
     * The share of the chart a pane gets. While one pane is maximized it takes
     * everything and the rest take nothing, so they lay out at zero height and
     * are hidden outright rather than collapsed to a sliver. A sliver still
     * paints a strip of squeezed candles and a separator hairline above the very
     * pane the user asked to see on its own.
     *
     * Stored weights are never touched, so restoring is exact and `getState`
     * cannot persist a placeholder.
     */
    private _layoutWeight;
    /** First pane with a share of the chart: the one that sits against the top edge. */
    private _topPaneIndex;
    /** Last pane with a share of the chart: the one that owns the time axis. */
    private _bottomPaneIndex;
    private _weightTotal;
    /** Grab tolerance around a pane boundary, in media px. */
    private static readonly DIVIDER_GRAB;
    /**
     * Index of the pane whose *bottom* boundary is within grab range of `y`, or
     * null. Boundary `i` separates pane `i` from pane `i + 1`; the last pane's
     * bottom is the chart edge and is not draggable.
     */
    private _dividerAt;
    /**
     * Set a pane's relative height weight. Panes share the chart height in
     * proportion to their weights, so only the ratio matters.
     */
    setPaneWeight(index: number, weight: number): void;
    paneWeight(index: number): number;
    /**
     * Remove a pane, everything drawn in it, and any indicator that lives there.
     * Pane 0 (price) is never removable — removing it would leave the chart with
     * no time axis owner.
     *
     * Returns false when the index is out of range or is pane 0.
     */
    removePane(index: number): boolean;
    /**
     * Move a pane up or down one slot. Pane 0 (price) is pinned — it owns the
     * primary series and the shared price context — so a move that would displace
     * it is refused.
     */
    movePane(index: number, direction: -1 | 1): boolean;
    /**
     * Expand one pane to fill the chart, hiding the others. Calling it again (or
     * on another pane) puts the stack back exactly as it was, since the stored
     * weights were never disturbed.
     */
    maximizePane(index: number): boolean;
    /** The maximized pane index, or null when none is. */
    maximizedPane(): number | null;
    /**
     * Route a pane-legend button press. Ids look like `indicator:<instanceId>::close`.
     * Returns true when the id was ours and was handled.
     */
    private _handleLegendAction;
    /** Cumulative top + height of each pane, by weight (the source of truth for hit-testing). */
    private _paneLayout;
    /**
     * Keyboard hints for the navigator tooltips, read from the live keymap so a
     * rebind shows up in the tooltip instead of a stale hardcoded string. The
     * one-bar step buttons have no default binding, so they get no hint.
     */
    private _navHints;
    /**
     * Keep the navigator on the bottom pane — it belongs just above the time
     * axis, and adding or removing a pane moves which one that is.
     */
    private _syncTimeNavPane;
    /**
     * Push the pointer to the navigator and keep painting while it fades, so the
     * animation runs even when nothing else on the chart is changing.
     */
    private _feedTimeNav;
    private _renderContext;
    /**
     * The corner clock's options, or undefined when it is off. Built per frame so
     * a zone change reaches it without the pane holding a stale copy.
     */
    private _sessionClockOptions;
    /**
     * The countdown row's options, or undefined when it is off or there is
     * nothing to count. The interval is read back from the bars rather than
     * configured: the chart is never told its own timeframe, and a chart that
     * switched timeframe mid-session has to follow within a screen of bars.
     */
    private _barCountdownOptions;
    private _observeSize;
    private _onFrame;
    private _attachInput;
    private readonly _onPointerEnter;
    /**
     * The chart renders as stacked canvases, so the browser's right-click
     * "Save image as…" would capture only the topmost (transparent overlay)
     * layer — a blank image. Just before the native menu opens, composite the
     * clicked pane's base layer *beneath* its overlay bitmap so the saved image
     * is the visible chart, and freeze overlay repaints (live ticks repaint every
     * few hundred ms and would wipe the snapshot while the menu is open). The
     * freeze lifts on the next pointer/wheel/key input after the menu closes.
     * Apps that present their own menu (preventDefault on contextmenu) are
     * unaffected. Multi-pane note: the native save captures the clicked pane
     * only — use `downloadScreenshot()` for the full multi-pane composite.
     *
     * A listener on the `contextmenu` **chart** event takes over entirely: it is
     * told what was hit, and the snapshot is skipped, since the app is raising a
     * menu of its own instead of the browser's.
     */
    private readonly _onContextMenu;
    /** Build the `contextmenu` payload: where the pointer is, and what it is over. */
    private _contextMenuEvent;
    /**
     * Classify what the pointer is over. A canvas hands an app a pixel, not an
     * object, so this is the part it cannot work out for itself, and the part
     * that decides which menu items make sense.
     */
    private _contextTarget;
    /**
     * Which of a pane's scales an axis strip acts on. Normally the side's own
     * one, but a pane whose only values sit on the hidden overlay scale (a volume
     * pane, an indicator that plots against nothing else) has no series on either
     * side, and the overlay is the scale a menu raised there has to act on.
     */
    private _axisScaleId;
    /**
     * Which series the pointer sits on, if any. A pane is one bitmap, so "on the
     * candle" has to be recomputed rather than looked up: take each series'
     * autoscale extents for the bar under the cursor and test the band they span,
     * with a few px of slack so a 1px line is still a target.
     */
    private _seriesAt;
    /** Resume overlay repaints after the native context menu closes. */
    private _unfreezeOverlay;
    private _localPoint;
    /** Container media px to the pane under it and that pane's local y. */
    private _project;
    /**
     * Every position a drag passed through since the previous move event, in
     * the same space as the payload's `point`. The rect and layout are read once
     * for the batch: a fast stroke coalesces several positions per frame, and
     * each one going back to the DOM is layout work on the pointer path.
     */
    private _dragSamples;
    /**
     * Pointer facts for a click. Modifiers and device come from the release,
     * pressure from the press: a release always reads 0, which would leave the
     * field carrying nothing on any device.
     */
    private _clickInfo;
    private readonly _onPointerDown;
    private readonly _onPointerMove;
    private readonly _onPointerUp;
    /**
     * DOM pointerup entry point. Mirrors the primary-button guard in
     * `_onPointerDown`: a right-click (or any non-primary mouse button) fires
     * pointerdown *and* pointerup, but `_onPointerDown` ignores it — so the
     * down state (`_downX`/`_downLocalY`/`_downPane`/`_pointerMoved`) is never
     * refreshed and still holds the *previous* left-click. Letting a non-primary
     * pointerup through would re-run the click branch against that stale position
     * and replay the last click (e.g. re-firing a Buy/Sell button → a phantom
     * order). Touch and pen tip contact use button 0. The internal
     * recovery call from `_onPointerMove` invokes `_onPointerUp` directly, so it
     * bypasses this filter and still ends a drag when a button release is missed.
     */
    private readonly _onPointerUpNative;
    private readonly _onPointerCancel;
    private _brandingHit;
    private readonly _onPointerLeave;
    private readonly _onWheel;
    /** One zoom step, applied now. Shared by the instant path and each glide frame. */
    private _applyZoom;
    private _startZoomGlide;
    private _beginAutoscaleMotion;
    private _stopNavigationMotion;
    private _stopZoomGlide;
    /**
     * Restore the preferred visible bar count and re-enable
     * auto-scaling on every price axis (undoing any pan/zoom or manual axis drag).
     * Same as double-clicking the chart.
     */
    resetScale(): void;
    private readonly _onDblClick;
    private _beginPinch;
    private _updatePinch;
    private readonly _onKeyDown;
    /** Scope gating: hover keeps keys chart-local; global always acts. */
    private _shortcutsActive;
    /** Execute a built-in command; returns false for unknown (custom) commands. */
    private _runShortcut;
    /**
     * Composite the full chart (all panes + overlays) and trigger a PNG download.
     * This is what the screenshot keyboard shortcut runs; call it from a toolbar
     * button for a reliable "save image" — the browser's native right-click
     * "Save image as…" captures only the topmost (transparent overlay) canvas.
     */
    downloadScreenshot(filename?: string): void;
    /** Refresh the polite live-region summary screen readers announce. */
    private _updateAccessibleSummary;
    /**
     * Track the primitive under the pointer: apply its cursor hint to the
     * container and repaint on hover enter/leave so lines/pills can render
     * hover states (they read `hoverId` off the render context).
     */
    private _setHover;
    private _updateCursor;
    private _maybeLoadHistory;
    /**
     * Coast after a flick. Runs on the INJECTED scheduler, not the global
     * requestAnimationFrame: a host that supplies its own raf expects to own
     * every frame this chart schedules, and reaching past it also made the
     * glide untestable, which is why the missing pan event on each frame went
     * unnoticed until a browser drove it.
     */
    private _startKinetic;
    private _stopKinetic;
    /**
     * True once `destroy()` has run. Anything holding a chart it did not create
     * (a link group, a controller, a host cache) needs to know the object is a
     * corpse before it calls into it: inferring it from a side effect such as an
     * empty pane list works only for as long as nothing else can empty one.
     */
    get isDestroyed(): boolean;
    private _destroyed;
    destroy(): void;
}
/** Create a chart inside the given container element. */
declare function createChart(container: HTMLElement, options?: ChartOptions): Chart;

/**
 * Vector export.
 *
 * `SvgContext` implements the subset of `CanvasRenderingContext2D` the
 * renderers, primitives and drawing tools call, and serialises every call to
 * SVG. The chart's ordinary paint, run once into one of these instead of the
 * pane canvases, comes out as a standalone document: text stays text, lines
 * stay lines, and the file scales without the blur a PNG picks up.
 *
 * The subset is the one the test recorder (`tests/helpers/fake-ctx.ts`) already
 * had to cover for the same code paths, plus what the drawing tools add
 * (curves, ellipses, rounded rectangles). The op set is the contract: anything
 * that draws to a pane through a method not here does not reach the export.
 *
 * What is out of reach for a serialiser, and what it does about it:
 *
 * - `setTransform`, `resetTransform`, `getTransform`: a whole-matrix reset has
 *   no place in a document built from nested groups. `translate`, `scale` and
 *   `rotate` are supported and are what the paint code uses.
 * - `createRadialGradient`, `createConicGradient`, `createPattern`,
 *   `getImageData`, `putImageData`, `createImageData`, `strokeText`,
 *   `drawFocusIfNeeded`, `isPointInPath`, `isPointInStroke`, and `fill`,
 *   `stroke` or `clip` handed a `Path2D`.
 * - `drawImage` of anything that is not an `<img>` with a `src` or a canvas
 *   that can hand over a data URL.
 *
 * Each of these throws under `strict` (the tests run that way, so a renderer
 * that grows a new call fails loudly) and otherwise records its name in
 * `unsupported` and paints nothing, which is the right production answer: a
 * missing logo is a better export than a thrown one. Shadow, composite and
 * smoothing properties are accepted and ignored, since the one primitive that
 * sets a shadow is decoration on a button.
 *
 * `measureText` is approximate: there is no font engine here, so widths come
 * from a per-character table scaled by the font size (see `charWidth`). The
 * paint code uses it to size tag boxes and cull overlapping axis labels, both
 * of which tolerate a few percent.
 */
/** Options for an `SvgContext`. */
interface SvgContextOptions {
    /**
     * Throw on any call the serialiser cannot express. Off, the call is recorded
     * in `unsupported` and skipped.
     */
    strict?: boolean;
    /**
     * What `clearRect` paints. A canvas clears to transparent, which a document
     * that is appended to cannot do; when the export is opaque the honest stand-in
     * is the background colour. Absent, `clearRect` paints nothing.
     */
    background?: string;
}
/** A gradient handle: set it as `fillStyle` the way a canvas one is set. */
declare class SvgLinearGradient {
    readonly id: string;
    readonly x0: number;
    readonly y0: number;
    readonly x1: number;
    readonly y1: number;
    readonly stops: {
        offset: number;
        color: string;
    }[];
    constructor(id: string, x0: number, y0: number, x1: number, y1: number);
    addColorStop(offset: number, color: string): void;
    toString(): string;
}
/**
 * A 2D context that writes SVG. Construct one at the document's media size,
 * hand it (cast) to whatever paints, and read `toString()`.
 */
declare class SvgContext {
    readonly width: number;
    readonly height: number;
    fillStyle: string | SvgLinearGradient;
    strokeStyle: string | SvgLinearGradient;
    lineWidth: number;
    lineCap: CanvasLineCap;
    lineJoin: CanvasLineJoin;
    miterLimit: number;
    globalAlpha: number;
    font: string;
    textAlign: CanvasTextAlign;
    textBaseline: CanvasTextBaseline;
    shadowColor: string;
    shadowBlur: number;
    shadowOffsetX: number;
    shadowOffsetY: number;
    globalCompositeOperation: string;
    imageSmoothingEnabled: boolean;
    /**
     * Deliberately undefined: a primitive that wants an offscreen canvas asks the
     * context for its element, and the honest answer is that there is none.
     */
    readonly canvas: undefined;
    /** Names of the calls that could not be exported, first occurrence only. */
    readonly unsupported: string[];
    private readonly _out;
    private readonly _frames;
    private readonly _gradients;
    private readonly _clips;
    private _rootOpen;
    private _path;
    /** Whether the current subpath has a current point (a lone `arc` needs to know). */
    private _hasPoint;
    private _dash;
    private _ids;
    private readonly _strict;
    private readonly _background;
    private _fontCache;
    constructor(width: number, height: number, options?: SvgContextOptions);
    /** This context typed as the canvas one the paint code is written against. */
    asCanvasContext(): CanvasRenderingContext2D;
    save(): void;
    restore(): void;
    /**
     * Open an explicit `<g>` with the given attributes, optionally translated
     * and clipped to a rectangle in the group's own coordinates. The chart wraps
     * each pane in one so the export carries the same per-pane offset and clip
     * the DOM stacking gives the canvases. Balanced by `popGroup`.
     */
    pushGroup(attrs: Record<string, string | number>, options?: {
        translate?: {
            x: number;
            y: number;
        };
        clip?: {
            x: number;
            y: number;
            width: number;
            height: number;
        };
    }): void;
    popGroup(): void;
    translate(x: number, y: number): void;
    scale(x: number, y: number): void;
    rotate(angle: number): void;
    setLineDash(segments: number[]): void;
    getLineDash(): number[];
    beginPath(): void;
    closePath(): void;
    moveTo(x: number, y: number): void;
    lineTo(x: number, y: number): void;
    quadraticCurveTo(cx: number, cy: number, x: number, y: number): void;
    bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): void;
    rect(x: number, y: number, w: number, h: number): void;
    /**
     * The radii argument takes the forms the paint code uses: one number, or an
     * array of up to four (top-left, top-right, bottom-right, bottom-left, the
     * CSS order). Radii are scaled down together when they would overlap, as the
     * canvas does, so a pill shorter than its radius stays a pill.
     */
    roundRect(x: number, y: number, w: number, h: number, radii?: number | number[]): void;
    arc(x: number, y: number, r: number, a0: number, a1: number, ccw?: boolean): void;
    ellipse(x: number, y: number, rx: number, ry: number, rotation: number, a0: number, a1: number, ccw?: boolean): void;
    fill(rule?: CanvasFillRule | Path2D, _rule?: CanvasFillRule): void;
    stroke(path?: Path2D): void;
    clip(rule?: CanvasFillRule | Path2D): void;
    fillRect(x: number, y: number, w: number, h: number): void;
    strokeRect(x: number, y: number, w: number, h: number): void;
    clearRect(x: number, y: number, w: number, h: number): void;
    fillText(text: string, x: number, y: number): void;
    measureText(text: string): TextMetrics;
    createLinearGradient(x0: number, y0: number, x1: number, y1: number): SvgLinearGradient;
    /**
     * An `<img>` becomes an `<image>` of its `src`; a canvas becomes one of its
     * data URL. The nine-argument crop is a nested `<svg>` whose viewBox is the
     * source rectangle. Anything else (an `ImageBitmap`, a video frame) has no
     * URL to point at and is skipped.
     */
    drawImage(source: CanvasImageSource, ...args: number[]): void;
    setTransform(): void;
    resetTransform(): void;
    getTransform(): undefined;
    createRadialGradient(): undefined;
    createConicGradient(): undefined;
    createPattern(): null;
    getImageData(): undefined;
    putImageData(): void;
    createImageData(): undefined;
    strokeText(): void;
    drawFocusIfNeeded(): void;
    isPointInPath(): boolean;
    isPointInStroke(): boolean;
    /**
     * The document. Groups still open (a paint that ended inside a `save`) are
     * closed here without being popped, so the string is the same however many
     * times it is read.
     */
    toString(): string;
    private _snapshot;
    private _apply;
    /** Close every frame above index `i` and frame `i` itself, oldest last. */
    private _closeTo;
    /** Open a `<g>` that the enclosing frame (or the root) will close. */
    private _openGroup;
    private _clipId;
    private _rect;
    /** The `fill`/`stroke` attribute value for a style, or null for nothing visible. */
    private _paint;
    private _strokeAttrs;
    private _opacity;
    private _font;
    private _imageHref;
    private _unsupported;
}

type ChartObjectKind = 'source' | 'indicator' | 'drawing' | 'profile';
interface ChartObjectCapabilities {
    readonly select: boolean;
    readonly visibility: boolean;
    readonly lock: boolean;
    readonly remove: boolean;
    readonly settings: boolean;
    readonly focus: boolean;
}
/** One immutable row in a chart's object inventory. */
interface ChartObjectSnapshot {
    readonly id: string;
    readonly sourceId: string;
    readonly kind: ChartObjectKind;
    readonly name: string;
    readonly paneIndex: number;
    readonly visible: boolean;
    readonly locked?: boolean;
    readonly selected: boolean;
    readonly dataStatus?: Readonly<IndicatorDataStatus>;
    readonly capabilities: ChartObjectCapabilities;
}
/** State supplied by a host for an explicitly managed profile or source. */
interface ChartObjectDefinition {
    kind: ChartObjectKind;
    name: string;
    paneIndex?: number;
    visible?: boolean;
    locked?: boolean;
    selected?: boolean;
    dataStatus?: Readonly<IndicatorDataStatus>;
}
/** Actions are synchronous and offered only when their callback exists. */
interface ChartObjectProvider {
    id: string;
    get(): ChartObjectDefinition | null;
    subscribe?(listener: () => void): () => void;
    select?(): void;
    setVisible?(visible: boolean): void;
    setLocked?(locked: boolean): void;
    remove?(): void;
    openSettings?(): void;
    focus?(): void;
}
/** Structural contract keeps the base tier independent of drawing code. */
interface ChartObjectDrawing {
    id: string;
    tool: string;
    paneIndex: number;
    points: readonly {
        time: number;
        price: number;
    }[];
    visible?: boolean;
    locked?: boolean;
}
interface ChartObjectDrawingSource {
    drawings(): readonly ChartObjectDrawing[];
    get(id: string): ChartObjectDrawing | undefined;
    selection(): readonly string[];
    select(id: string | readonly string[] | null, additive?: boolean): void;
    update(id: string, patch: {
        visible?: boolean;
        locked?: boolean;
    }): void;
    remove(id: string): boolean;
}
interface ChartObjectsOptions {
    drawings?: ChartObjectDrawingSource;
    /** Opens the host's existing editor for a built-in object. */
    onSettings?(object: ChartObjectSnapshot): void;
}
/** Shared object operations for widgets and custom terminals. No DOM is created. */
declare class ChartObjects {
    private readonly _chart;
    private readonly _options;
    private readonly _off;
    private readonly _providers;
    private readonly _listeners;
    private _entries;
    private _rows;
    private _selected;
    private _destroyed;
    private _refreshing;
    private _pending;
    constructor(chart: Chart, options?: ChartObjectsOptions);
    /** Current immutable inventory, also refreshed for hosts with unsignalled provider state. */
    list(): readonly ChartObjectSnapshot[];
    get(id: string): ChartObjectSnapshot | undefined;
    /** Delivers current state immediately, then only inventory changes. */
    subscribe(listener: (objects: readonly ChartObjectSnapshot[]) => void): () => void;
    /** Provider IDs receive a custom: prefix and cannot replace built-in objects. */
    register(provider: ChartObjectProvider): () => void;
    /** Re-read explicitly registered host state without installing a polling timer. */
    refresh(): void;
    select(id: string | null, additive?: boolean): boolean;
    setVisible(id: string, on: boolean): boolean;
    setLocked(id: string, on: boolean): boolean;
    remove(id: string): boolean;
    openSettings(id: string): boolean;
    focus(id: string): boolean;
    private _act;
    private _read;
    private _focusDrawing;
    /** Detach this observer and its providers, leaving chart objects in place. */
    destroy(): void;
}

/** The color as rgba() with the given alpha (parse failure returns the input). */
declare function withAlpha(color: string, alpha: number): string;

/**
 * Re-exported, not reimplemented: one import path covers an indicator's colour
 * work, while the only colour parser in the engine stays in `pill.ts`. A second
 * copy here would cost base bytes and drift out of step with the first.
 */

declare function verticalGradient(ctx: CanvasRenderingContext2D, heightPx: number, topColor: string, bottomColor: string): CanvasGradient;
/**
 * Blend `low` to `high` in sRGB by where `value` sits in [min, max], clamped
 * outside. Heatmap plots and per-bar colouring call this once per bar, so it
 * allocates only the result string: no closure, no cache, no lookup table.
 *
 * The clamp is two comparisons rather than Math.min/Math.max because both are
 * false against a not-available value, which lands it on `low` instead of
 * poisoning the output with NaN. Canvas ignores an unparseable fillStyle and
 * silently keeps the previous one, so a bad string would bleed a neighbour's
 * colour across the bar rather than fail loudly.
 */
declare function fromGradient(value: number, min: number, max: number, low: string, high: string): string;

/**
 * Eased wheel zoom (ARCHITECTURE.md §3.2, §7). A wheel tick used to land its
 * whole zoom step on one frame, which reads as the chart jumping rather than
 * moving. This spreads the same step over a short exponential approach, the
 * counterpart to `KineticAnimation` (input/kinetic.ts) for the other half of the viewport.
 *
 *   applied(t) = base + (target − base) · (1 − e^(−t/tau))
 *
 * The work is done in LOG space and the caller exponentiates the per-frame
 * delta, because zoom composes multiplicatively: two 1.1x steps are 1.21x, not
 * 1.2x. Easing the multiplier directly would make the first half of a glide
 * cover more zoom than the second, and a glide interrupted midway would land on
 * a different scale than one left alone.
 *
 * Closed form, so it is deterministic and unit-testable with no Date or rAF
 * inside: the caller samples {@link ZoomGlide.appliedAt} each frame and zooms by
 * the delta since its previous sample.
 */
interface ZoomGlideOptions {
    /**
     * Time constant in ms. The glide covers ~63% of the distance remaining after
     * each rebase in one tau, and is cut off at `stopFraction`.
     */
    tau: number;
    /** Stop once this much of the remaining distance has been applied. */
    stopFraction: number;
    /**
     * Skip the animation for a step smaller than this, in log units. Below it the
     * glide is a handful of sub-pixel frames nobody can see, and scheduling them
     * costs more than the step is worth.
     */
    minLogStep: number;
}
declare const DEFAULT_ZOOM_GLIDE_OPTIONS: ZoomGlideOptions;
declare class ZoomGlide {
    /** Log-space zoom already applied at the last rebase: where the curve starts. */
    private _base;
    /** Log-space zoom to end on, measured from the glide's origin. */
    private _target;
    /** Elapsed-ms reading of the last rebase, so the curve restarts from there. */
    private _epoch;
    private readonly _tau;
    private readonly _duration;
    /** @param totalLogFactor Signed log-space zoom to cover, `Math.log(factor)`. */
    constructor(totalLogFactor: number, options?: Partial<ZoomGlideOptions>);
    /**
     * The fraction of a step to apply on the input event itself, before any
     * frame runs.
     *
     * A glide that starts at zero adds a frame of input latency to every wheel
     * tick, and leaves `barSpacing` reading its old value to anything that looks
     * synchronously after the event. Both are worse than the jump the easing was
     * meant to fix. The lead is exactly what the first frame would have applied
     * anyway (one 60fps frame of the curve), so the chart responds instantly and
     * the remainder still eases.
     */
    static leadFraction(options?: Partial<ZoomGlideOptions>): number;
    /** Whether a step this large is worth animating rather than applying at once. */
    static shouldAnimate(totalLogFactor: number, options?: Partial<ZoomGlideOptions>): boolean;
    /**
     * Fold another wheel tick into a glide already running.
     *
     * The target ACCUMULATES, so spinning the wheel fast covers the sum of its
     * notches rather than only the last one, and scrolling back the other way
     * genuinely reverses (five notches out after one notch in ends four notches
     * out, which is what the user asked for).
     *
     * The curve is rebased rather than merely retargeted: it restarts from what
     * has already been applied, at the current time. Without that, changing the
     * target changes `appliedAt` for times ALREADY sampled, so the next frame
     * computes a delta against a curve the caller never rode and the chart
     * jumps, most visibly when a reversal flips the target's sign. Rebasing does
     * not make a stream of ticks crawl, because each tick also pushes the target
     * further away: it is progress toward a FIXED target that resetting would
     * stall.
     *
     * @param appliedSoFar What the caller has already zoomed by, in log units.
     * @param elapsedMs    The clock reading this rebase happens at.
     */
    add(extraLogFactor: number, appliedSoFar: number, elapsedMs: number): void;
    /** Signed log-space zoom applied from the glide's origin up to `elapsedMs`. */
    appliedAt(elapsedMs: number): number;
    /** Where the glide ends: the accumulated total, from the origin. */
    get totalLogFactor(): number;
    get durationMs(): number;
    finished(elapsedMs: number): boolean;
}

/**
 * Generate up to ~`maxTicks` nicely-rounded tick values spanning [min, max].
 * Returns ascending values aligned to the chosen step (may sit slightly inside
 * the range). Returns a single midpoint when the range is degenerate.
 */
declare function niceTicks(min: number, max: number, maxTicks?: number): number[];
/** Decimal places implied by a price step / tick size (for label formatting). */
declare function precisionForStep(step: number): number;

/**
 * Candlestick renderer (ARCHITECTURE.md §6). Pure geometry helpers are split
 * out for unit testing; drawing happens in the bitmap (device-px) scope.
 */

interface CandleStyle {
    upColor: string;
    downColor: string;
    borderUpColor: string;
    borderDownColor: string;
    wickUpColor: string;
    wickDownColor: string;
    borderVisible: boolean;
    wickVisible: boolean;
    /**
     * Paint the body at all. Off leaves the candle as its outline and wick, which
     * is what a settings dialog's "Body" switch means.
     *
     * Distinct from `hollow`, which empties only the UP candles and is the
     * hollow-candle chart type. This empties both, and it is the one switch here
     * that can legitimately leave nothing drawn: with borders off as well, a
     * candle is reduced to its wick. That is two deliberate switches rather than
     * an accident, so it is honoured rather than second-guessed.
     */
    bodyVisible?: boolean;
    /** Draw up-candle bodies as outlines only (hollow candles). */
    hollow?: boolean;
    /**
     * "Color bars based on previous close": a bar is up when it closed above the
     * bar before it rather than above its own open. Body, border and wick all
     * follow the same verdict, so the candle never disagrees with itself.
     */
    colorByPreviousClose?: boolean;
    /** Per-bar body-width scale 0..1 (volume candles); 1 = full width. */
    widthScale?: (bar: Bar) => number;
}
declare const DEFAULT_CANDLE_STYLE: CandleStyle;
/**
 * Pure: optimal candle body width in device px for a given bar spacing. Leaves
 * a ~1px gap between candles, keeps a minimum of 1px, and matches odd/even
 * parity with the wick so the body stays symmetric about the (1px) wick.
 */
declare function optimalBarWidth(barSpacing: number, dpr: number): number;
/**
 * Level-of-detail tier for one candle.
 *
 * - `full`: the body (and any border) is distinguishable from the wick, so all
 *   of it is drawn.
 * - `wick`: the body would repaint exactly the pixels the wick already covered,
 *   so it is skipped. This is not an approximation: `optimalBarWidth` matches
 *   the body's odd/even parity to the wick's, which collapses the two to the
 *   same width and the same `x` once bars get tight, and the wick's high-low
 *   span always contains the body's open-close span. Same rect, same colour,
 *   twice the work.
 */
type CandleTier = 'full' | 'wick';
/**
 * Pure: whether a candle's body still shows once it is this narrow.
 *
 * Only returns `wick` when the body is provably invisible under the wick, so a
 * chart drawn at either tier is pixel-identical. Anything that could make the
 * body read differently - a hollow candle's outline, a border wide enough to
 * survive, a body colour that differs from the wick's, a hidden wick with
 * nothing to hide behind - stays `full`.
 *
 * `bodyW` is the per-bar width, so a volume candle whose `widthScale` has
 * narrowed it is judged on what it will actually draw.
 */
declare function candleTier(bodyW: number, wickW: number, style: CandleStyle): CandleTier;
/** Where one candle lands, in device px. Every field is an integer. */
interface CandleGeometry {
    /** Bar centre. */
    cx: number;
    /** Left edge of the body. */
    bodyX: number;
    /** Body width after any per-bar scale, never below 1. */
    bodyW: number;
    /** Left edge of the wick. */
    wickX: number;
    /** Wick width: 1 device px per whole unit of `dpr`. */
    wickW: number;
}
/**
 * Pure: the device-pixel rectangle geometry of one candle. This is the single
 * source of the snapping and parity rules, so a second backend rasterising
 * candles with its own primitives lands on the same pixels as `drawCandles`.
 *
 * `widthScale` is the per-bar body scale a volume candle applies (1 = the
 * full `optimalBarWidth`). It is clamped to 0.05..1: a zero-volume bar still
 * has to show a sliver of body, and nothing may grow past the gap.
 */
declare function candleGeometry(x: number, barSpacing: number, dpr: number, widthScale?: number): CandleGeometry;

/**
 * The shipped render backend: series painted by their registry renderer on the
 * pane's own 2D context. This is the path every chart took before the port
 * existed, so it is the reference the other backends are held to, pixel for
 * pixel (tests/e2e/render-parity.spec.ts).
 */

declare class Canvas2dBackend implements IRenderBackend {
    readonly kind = "canvas2d";
    private _canvas;
    private _ctx;
    mount(canvas: HTMLCanvasElement, ctx2d: CanvasRenderingContext2D | null): void;
    /**
     * Nothing to do: the pane's `CanvasLayer` owns the backing store and sized it
     * already. Re-sizing it here would clear a bitmap that was just painted.
     */
    resize(_widthPx: number, _heightPx: number, _dpr: number): void;
    /** The same clear `CanvasLayer.clearBitmap` does, so the op stream is unchanged. */
    beginFrame(clear: boolean): void;
    drawSeries(entry: RendererEntry, items: readonly DrawItem[], priceToY: (price: number) => number, barSpacing: number, dpr: number, style: SeriesStyle, rc: SeriesRenderContext): void;
    /** Every call above drew straight to the canvas; there is nothing to flush. */
    endFrame(): void;
    overlay2d(): CanvasRenderingContext2D | null;
    destroy(): void;
}

/**
 * Histogram / column renderer (ARCHITECTURE.md §6). Used for the volume pane.
 * Bars are drawn from a base value (0) up to each bar's close.
 */

interface HistogramStyle {
    color: string;
    /** Optional separate colors keyed by an up/down flag set on the bar's volume sign. */
    base: number;
}
declare const DEFAULT_HISTOGRAM_STYLE: HistogramStyle;

/**
 * Market replay: walk a historical session forward bar by bar so a trader can
 * practise on it, and so every indicator redraws exactly as it stood at that
 * past moment.
 *
 * Headless, in the spirit of `DrawingController` (src/draw/controller.ts): it
 * owns the playhead and the transitions and ships no DOM, so the host renders
 * its own transport bar, scrub slider and clock from `state()` and the events.
 *
 * The mechanic is deliberately boring. Replay feeds the chart a **prefix** of
 * the full bar array through the ordinary `series.setData` path, and that is
 * what makes indicators free: `Chart._setData` calls `_recomputeIndicators` for
 * the primary series, and `IndicatorInstance.recompute` re-reads the whole
 * history from `sourceBars()`. Shorten that history and every indicator, level,
 * fill, marker and legend reconstructs itself as it was at that bar, with no
 * replay-aware code anywhere in the indicator tier.
 */

/** Schedules a repeating callback and returns its canceller. Inject in tests. */
type ReplayScheduler = (cb: () => void, intervalMs: number) => () => void;
/**
 * The slice of the time scale replay saves and restores. Declared structurally
 * rather than as `TimeScale` so nothing here depends on the scale's shape
 * beyond the two numbers that *are* the viewport.
 */
interface ReplayViewport {
    readonly barSpacing: number;
    readonly rightOffset: number;
    setBarSpacing(value: number): void;
    setRightOffset(value: number): void;
}
/**
 * The slice of the chart this controller needs. `Chart` satisfies it; declaring
 * it structurally keeps the controller testable against a stub and free of a
 * circular import back into core.
 */
interface ReplayChartHost {
    emit(event: string, payload: unknown): void;
    readonly timeScale: ReplayViewport;
    /**
     * Optional. When the chart can name its own primary price series, `series`
     * may be omitted and replay drives that one.
     */
    primarySeries?(): SeriesApi | null;
}
/** Everything a transport bar and a clock need, in one object. */
interface ReplayState {
    /** 0-based index of the newest bar currently on the chart. */
    index: number;
    /** Bars in the replay set (the scrub bar's maximum is `total - 1`). */
    total: number;
    playing: boolean;
    /** Multiplier over `barMs`: 2 plays two bars per `barMs`. */
    speed: number;
    /**
     * The bar at `index`, the replay clock's "now". Null when there is no data.
     *
     * Under intra-bar replay this is the **partial** bar as it stands this step,
     * not the completed one, which is what makes it the right thing to drive a
     * host's own forming volume bar or an OHLC readout from.
     */
    bar: Bar | null;
    /**
     * Which step of the forming bar this is, 0-based, and how many it takes. Both
     * are 0 and 1 without `subBars`, so a transport that shows them needs no
     * special case for the plain mode.
     */
    subIndex: number;
    subSteps: number;
}
interface ReplayOptions {
    /**
     * The series replay drives. The first one owns the timeline; any others (a
     * volume histogram, a comparison line) are truncated to the same instant by
     * time, because the shared DataLayer merges *every* series onto one axis and
     * a series left at full length would drag future timestamps back onto it.
     *
     * Optional only if the host chart implements `primarySeries()`.
     */
    series?: SeriesApi | readonly SeriesApi[];
    /**
     * The full session. Defaults to the primary series' current data. Never
     * mutated, and never handed to the chart as-is: each frame gets its own slice.
     */
    bars?: readonly Bar[];
    /**
     * Finer-grained bars the displayed ones are built from: the 1-minute session
     * under a 5-minute chart. Given these, the playhead advances a **sub-bar** at
     * a time and the newest bar forms in front of the user the way a live one
     * does, instead of appearing complete. A 5-minute bar over 1-minute data
     * takes five steps.
     *
     * They must cover the same session as `bars` and be sorted by time; sub-bars
     * outside any displayed bucket are ignored. The last step of a bucket emits
     * the displayed bar **verbatim** rather than the aggregate, so a bucket always
     * closes on exactly the number the chart would have shown without this option,
     * whatever the two feeds disagree about in between.
     *
     * Only the first driven series forms partially. Followers are cut to completed
     * buckets, because the controller cannot know how to half-aggregate an
     * arbitrary one: a volume histogram is summed, not OHLC-merged. The partial
     * bar reaches the host as `ReplayState.bar` on every frame, so a host that
     * wants a growing volume bar writes it from there.
     */
    subBars?: readonly Bar[];
    /** Bar to open at (0-based). Default 0. */
    startIndex?: number;
    /** Wall-clock milliseconds per bar at speed 1. Default 1000. */
    barMs?: number;
    /** Initial speed multiplier. Default 1. */
    speed?: number;
    /** Called on every playhead move, after the chart has been updated. */
    onFrame?: (state: ReplayState) => void;
    /** Playback clock. Default `performance.now`. */
    now?: () => number;
    /** Playback timer. Default `setInterval`. */
    scheduler?: ReplayScheduler;
}
declare class ReplayController {
    private readonly _chart;
    private readonly _series;
    private readonly _bars;
    /** What each driven series held before replay took over, for `stop()`. */
    private readonly _restore;
    private readonly _view;
    private readonly _onFrame;
    private readonly _now;
    private readonly _schedule;
    private readonly _barMs;
    private readonly _startIndex;
    private readonly _subBars;
    /**
     * For each displayed bar, where its sub-bars start in `_subBars` and how many
     * there are. Built once: the alternative is a binary search per step, on a
     * path that runs on every played frame.
     *
     * A bucket with no sub-bars takes one step and shows the displayed bar, so a
     * gap in the finer feed costs that bar its formation, not its existence.
     */
    private readonly _subStart;
    private readonly _subCount;
    private readonly _intra;
    private _speed;
    private _index;
    /** Step within the forming bar, 0-based. Always 0 without `subBars`. */
    private _sub;
    private _playing;
    /** True once replay owns the chart's data; false before start and after stop. */
    private _active;
    private _cancel;
    private _interval;
    /** Clock reading the last advance was charged to; keeps playback drift-free. */
    private _lastAdvance;
    /**
     * Constructing the controller **enters replay**: it snapshots the chart's data
     * and viewport and immediately shows `startIndex`. That is the gesture a
     * replay button makes, and it means the snapshot is taken before anything has
     * moved, so `stop()` can put the user back exactly where they were.
     */
    constructor(chart: ReplayChartHost, options?: ReplayOptions);
    /**
     * Map every sub-bar onto the displayed bar whose bucket it falls in.
     *
     * The displayed bars' own times are the bucket starts, so one forward pass
     * over both sorted arrays does it. A sub-bar before the first displayed bar
     * belongs to no bucket and is dropped rather than folded into bar 0, which
     * would open that bar at a price the chart never showed.
     */
    private _buildBuckets;
    /** How many steps the bar at `index` takes. At least one, always. */
    private _steps;
    /**
     * Jump the playhead to a bar. Out-of-range values clamp to the session.
     *
     * A seek lands on a **complete** bar even under intra-bar replay: scrubbing to
     * a half-formed candle is not a position anyone asks for, and it would make
     * the same slider position mean different things on the way past.
     */
    seek(index: number): void;
    /**
     * Move `n` steps forward. Stops dead at the end of the session.
     *
     * A step is one displayed bar normally, and one sub-bar under intra-bar
     * replay, so the transport button means "advance the chart by the smallest
     * amount it can show" in both modes.
     */
    step(n?: number): void;
    /** Move `n` steps back. Stops dead at the first bar. */
    stepBack(n?: number): void;
    /**
     * Move the playhead `delta` steps, carrying across bar boundaries.
     *
     * Written as a walk rather than arithmetic on a flat step count because
     * buckets hold different numbers of sub-bars: a session with a gap, or a
     * partial first bucket, has no constant steps-per-bar to divide by.
     */
    private _advance;
    /**
     * Start (or re-speed) playback. Calling it on the last bar plays nothing and
     * reports `replay:end` instead of arming a timer that could never advance.
     */
    play(options?: {
        speed?: number;
    }): void;
    /** Halt playback, leaving the playhead (and the chart) where it is. */
    pause(): void;
    /**
     * Leave replay: every driven series gets its pre-replay data back and the
     * viewport is restored to the pixel, so a user who exits does not lose their
     * place. Safe to call twice; a later `seek`/`step`/`play` re-enters replay
     * from `startIndex`.
     */
    stop(): void;
    state(): ReplayState;
    /**
     * Put the chart at `index`. Every transition goes through here (seek, step
     * and each played frame alike), so arriving at a bar leaves the chart in the
     * same state however the user got there.
     */
    private _apply;
    /**
     * One timer tick. The number of bars owed comes from the clock, not from the
     * tick count, so a coarse or throttled timer still plays at the requested
     * speed, and a host may drive this from rAF instead with no change here.
     */
    private readonly _tick;
    /** True on the last step of the last bar, which is where playback stops. */
    private _atEnd;
    /** The session is over: stop the timer and tell the host once. */
    private _end;
    private _stopTimer;
}

/**
 * Aligning a second instrument onto the primary series' bars.
 *
 * The x-axis is a gapless logical index over the times the shared DataLayer
 * holds (ARCHITECTURE.md §4.1, §5.3), so two instruments do not share a bar
 * index and cannot be laid side by side by position. They are matched by
 * timestamp, and the two directions of mismatch get opposite answers:
 *
 * - **A comparison bar with no primary bar is dropped.** The DataLayer merges
 *   *every* series' times into one index space, so a time only the comparison
 *   has would mint a new logical index: a column the primary instrument has no
 *   candle for, inserted mid-chart, shifting every bar after it. That happens
 *   for real (a different exchange's holiday calendar, a 24/7 instrument next
 *   to an NSE one, a feed that emits a stray print), and warping the primary's
 *   own axis to accommodate a comparison is never the right trade. The print is
 *   counted in `dropped` so a host can say so rather than silently losing it.
 *
 * - **A primary bar with no comparison bar becomes whitespace**, which is a NaN
 *   bar the line renderer breaks across, so the comparison shows a *gap*. The
 *   alternative, carrying the last known value forward, draws a flat segment
 *   through a session the instrument never traded and, worse, in percentage
 *   mode it anchors the move on the far side of the gap to a print that does
 *   not exist. Omitting the bar entirely is worse still: the renderer would
 *   join the two sides with one straight line across the holiday.
 *
 * Matching is on the exact timestamp. Bar-open times are bucketed by the candle
 * builder (§10.2) and stored as UTC seconds (§4.0), so two instruments on the
 * same interval agree to the second; anything that does not agree is a
 * different interval, which no tolerance window could rescue.
 */

/** What one alignment pass did, for a host that wants to report coverage. */
interface ComparisonAlignment {
    /** Items handed to the comparison series: one per primary bar. */
    bars: number;
    /** Primary bars the comparison also traded (a value is drawn). */
    matched: number;
    /** Primary bars with no comparison print (drawn as a gap). */
    gaps: number;
    /** Comparison prints discarded for having no primary bar at that time. */
    dropped: number;
}
/**
 * Project `comparison` onto `primary`'s bars: one item per primary bar, in the
 * primary's order, so the result occupies exactly the logical indices the chart
 * already has and adds none of its own.
 *
 * Neither input is mutated and neither has to be sorted: matching goes through
 * a time map, which also collapses a repeated timestamp to its last item, the
 * same rule the DataLayer applies when it merges (`sortedUniqueByTime`).
 */
declare function alignToPrimary(primary: readonly Bar[], comparison: readonly SeriesDataItem[]): {
    items: SeriesDataItem[];
    alignment: ComparisonAlignment;
};

/**
 * Multi-symbol comparison: put a second instrument on the primary one's pane
 * and read them together (NIFTY against BANKNIFTY, a stock against its index).
 *
 * Headless, in the spirit of `DrawingController` (src/draw/controller.ts) and
 * `ReplayController`: it owns the series, the alignment and the scales, and
 * ships no DOM, so the host draws its own symbol chips and legend rows from
 * `list()`.
 *
 * Three decisions carry the design:
 *
 * 1. **The comparison never touches the primary's axis.** It goes on the pane's
 *    hidden overlay scale (`priceScaleId: ''`, see `Pane._scaleFor`), which
 *    autoscales on its own and draws no ticks, so a 46,000 instrument next to a
 *    22,000 one cannot compress the primary's candles or relabel its ladder.
 *
 * 2. **Comparability comes from the scale, not from the data.** The bars handed
 *    over are stored as the instrument's own prices, so the legend, the
 *    crosshair and any live update still speak in real prices. What makes the
 *    lines readable together is the pane mode: `percentage` and
 *    `indexed-to-100` give every scale its own baseline (the first *visible*
 *    bar, so panning re-bases), and `_mirror` then gives the overlay the same
 *    band of percent the primary's axis is showing. Without that mirror each
 *    scale would autoscale to its own data and a 1% mover would look exactly
 *    like a 10% mover, both filling the pane.
 *
 * 3. **Alignment is by timestamp** and lives in `./align`, which documents what
 *    happens in each direction of mismatch.
 *
 * Known limit: a pane has exactly *one* hidden overlay scale, so every
 * comparison on a pane shares one baseline. That is exactly right for one
 * comparison, which is the common case, and it is why a second comparison in
 * the same pane is quoted against the first instrument's price. Keyed overlay
 * scales in `Pane` are the fix; until then, put further instruments on their
 * own pane with `paneIndex`.
 */

/**
 * How the pane quotes prices while a comparison is on it. The two rebasing
 * modes are the reason the lines are comparable at all; `none` leaves the
 * pane's own mode alone, for a host that wants the raw overlay.
 */
type ComparisonMode = 'percentage' | 'indexed-to-100' | 'none';
interface ComparisonOptions {
    /** Instrument label, e.g. 'BANKNIFTY'. Carried on the handle for the host's UI. */
    symbol: string;
    /** The instrument's own bars. Aligned to the primary series, see `./align`. */
    bars: readonly SeriesDataItem[];
    /** Line colour shorthand; `style.color` wins if both are given. */
    color?: string;
    /** Style overrides merged onto the chart type's defaults. */
    style?: SeriesStyle;
    /** Renderer for the comparison. Default 'line'. */
    type?: SeriesType;
    /** Pane to draw on. Default 0, the price pane. */
    paneIndex?: number;
}
interface ComparisonControllerOptions {
    /** Pane mode applied while any comparison is on it. Default 'percentage'. */
    mode?: ComparisonMode;
}
/** What `addComparison` hands back: one instrument on the chart. */
interface ComparisonHandle {
    readonly symbol: string;
    /**
     * The series this comparison draws through, for style patches and markers.
     * Data set on it directly skips alignment (use `setBars`), and removing it
     * directly leaves the pane rebased with nothing on it (use `remove`).
     */
    readonly series: SeriesApi;
    readonly paneIndex: number;
    /** The hidden scale it maps to. Never the pane's own price axis. */
    priceScale(): PriceScale;
    /** How the last alignment against the primary's bars went. */
    alignment(): ComparisonAlignment;
    /** Replace the instrument's bars (a longer history, a refreshed fetch). */
    setBars(bars: readonly SeriesDataItem[]): void;
    /** Take this instrument off the chart. Safe to call twice. */
    remove(): void;
    /** Every comparison on this chart, in the order they were added. */
    list(): readonly ComparisonHandle[];
}
/**
 * The slice of a pane the controller reads. Declared structurally, like
 * `ReplayViewport`, so nothing here depends on `Pane` beyond the two members
 * that decide where a comparison can go.
 */
interface ComparisonPane {
    readonly priceScale: PriceScale;
    series(): readonly {
        readonly scaleId: string;
    }[];
}
/**
 * The slice of the chart this controller needs. `Chart` satisfies it; declaring
 * it structurally keeps the controller testable against a stub.
 */
interface ComparisonChartHost {
    addSeries(type: SeriesType, options: AddSeriesOptions): SeriesApi;
    panes(): readonly ComparisonPane[];
    addPrimitive(primitive: IPrimitive, paneIndex?: number): void;
    removePrimitive(primitive: IPrimitive): void;
    primarySeries(): SeriesApi | null;
    /** Only `length` is read: it changes exactly when the shared time axis does. */
    readonly dataLayer: {
        readonly length: number;
    };
}
declare class ComparisonController {
    private readonly _chart;
    private _mode;
    private readonly _panes;
    /** Insertion-ordered, and the handle is the key so `remove` is a lookup. */
    private readonly _items;
    /**
     * `dataLayer.length` as of the last alignment. Alignment depends only on the
     * primary's set of *times*, and that set is what the length counts, so this
     * is an O(1) staleness check for a per-frame hook (see `sync`).
     */
    private _alignedAt;
    /** Guards `realign` against re-entry through its own `setData` repaint. */
    private _realigning;
    constructor(chart: ComparisonChartHost, options?: ComparisonControllerOptions);
    /** Put an instrument on the chart alongside the primary series. */
    add(options: ComparisonOptions): ComparisonHandle;
    /** Take one instrument off. Returns false if it was already gone. */
    remove(handle: ComparisonHandle): boolean;
    /** Every comparison on the chart, in the order they were added. */
    list(): readonly ComparisonHandle[];
    /** Take them all off, putting every pane back the way it was found. */
    clear(): void;
    /**
     * Change the mode the panes are held in while comparisons are on them.
     * Panes that already have one switch immediately.
     */
    setMode(mode: ComparisonMode): void;
    get mode(): ComparisonMode;
    /**
     * Re-project every instrument onto the primary's current bars. Called for
     * free when the shared time axis changes (see `sync`); a host only needs it
     * after replacing the primary's data with a *different* set of the same
     * length, which the length check cannot see.
     */
    realign(): void;
    /**
     * Bring the overlay scales in line with the primary axis, re-aligning first
     * if the shared time axis has moved under us (a live bar, history paged in,
     * a replay step). Runs once per base paint through the per-pane hook.
     *
     * Re-aligning here writes series data mid-frame, which is safe because the
     * hook is a `bottom` primitive: it runs after the pane has autoscaled and
     * before any series is drawn, so the frame that notices the change is also
     * the frame that draws it. The repaint that write asks for lands on the next
     * frame, or re-enters this one on a host that runs frames synchronously,
     * which is what `realign`'s guard is for.
     */
    sync(): void;
    /** Remove every comparison and forget the chart. */
    destroy(): void;
    /**
     * Where a comparison can sit on a pane. The hidden overlay is the right
     * answer, but there is only one of it per pane and the volume histogram in
     * the price pane is usually already on it (that is what `priceScaleId: ''`
     * is best known for). Sharing it would autoscale price and volume together
     * and flatten both, so when it is taken the comparison goes to the left axis
     * instead: a visible second ladder is a far smaller surprise than an
     * invisible line at the bottom of the pane.
     */
    private _scaleIdFor;
    private _openPane;
    private _closePane;
    private _applyMode;
    private _restoreMode;
    /**
     * Give the overlay the same band of percent the primary axis is showing, so
     * equal moves land on equal pixels and the divergence between two
     * instruments is the thing you see.
     *
     * Both scales rebase against a baseline of their own (the first visible bar
     * on each), and a rebase maps price to the ratio `price / baseline`. So the
     * two scales agree exactly when their ranges hold the same ratios, which is
     * one multiplication: the primary's range times `baseline_overlay /
     * baseline_primary`. It holds for `indexed-to-100` and `percentage` alike,
     * since they are one ladder a hundred points apart.
     *
     * A null baseline means this scale is not rebasing (linear, logarithmic, or
     * a pane with nothing visible on it yet). Then there is no shared ladder to
     * join and the overlay keeps its own autoscale, which is what mode 'none'
     * asks for: two instruments each filling the pane, comparable in shape only.
     *
     * The overlay stays under autoscale throughout, even though the range it
     * measures is overwritten here every frame. That measurement is one pass over
     * bars the renderer is about to walk anyway, and paying for it buys the
     * failure mode we want: a chart that stops calling `sync` falls back to an
     * independently scaled overlay instead of freezing on a stale range.
     */
    private _mirror;
    private _primaryBars;
    private _align;
    /**
     * Ask for a full repaint after a mode change. The pane hands a rebasing scale
     * its baseline during the autoscale pass, so a `Light` repaint (all a
     * primitive's `requestUpdate` raises) would paint the new mode before it has
     * anything to quote against. `applyOptions` is the series handle's own route
     * to a Full invalidation, and an empty patch changes no style. Several of
     * them coalesce into one frame, so asking every comparison costs nothing.
     */
    private _repaint;
}
/**
 * The controller for a chart, created on first use. Use it to change the mode
 * for the whole chart, to list what is on it, or to clear it.
 */
declare function comparisonController(chart: ComparisonChartHost, options?: ComparisonControllerOptions): ComparisonController;
/**
 * Put an instrument on the chart next to the primary one:
 *
 * ```ts
 * const bn = addComparison(chart, { symbol: 'BANKNIFTY', bars, color: '#f0b90b' });
 * ```
 *
 * The pane switches to percentage while any comparison is on it and goes back
 * to the mode it had when the last one leaves.
 */
declare function addComparison(chart: ComparisonChartHost, options: ComparisonOptions): ComparisonHandle;

/**
 * Time alignment for chart linking: the one thing that makes a grid of charts
 * behave as a workspace instead of four charts that happen to move together.
 *
 * **The x-axis is a gapless logical index over each chart's own bars, so
 * logical index N is a different instant on every chart.** Two linked charts
 * normally hold different bar arrays: different symbols, different intervals,
 * different history depth, different holidays. Copying a logical index or a
 * logical range straight across looks perfect on two charts of the same symbol
 * and interval, and is wrong everywhere else, so nothing in this module ever
 * moves an index across a chart boundary. Every value is converted index ->
 * time on the sender and time -> index on the receiver, against that chart's
 * own data.
 *
 * The two conversions live here, apart from the group, because they are pure
 * and are the part worth reading twice.
 */

/**
 * The slice of `DataLayer` alignment reads. Declared structurally, in the
 * spirit of `ComparisonChartHost`, so the conversions can be tested against a
 * literal instead of a live chart.
 */
interface LinkDataLayer {
    /** Number of logical indices (distinct bar times). */
    readonly length: number;
    indexToTime(index: number): number | undefined;
    timeToIndex(time: number): number | undefined;
    indexToTimeFloat(index: number): number;
    timeToIndexFloat(time: number): number;
}
/**
 * What a follower does when the leader's instant falls between its bars.
 *
 * - `nearest` (default): show the crosshair on the last bar that had OPENED by
 *   the leader's instant. A hole inside the follower's history is a missing bar,
 *   not a missing instant, and snapping to a real bar reads as "this one lines
 *   up" where a line floating between two candles belongs to neither.
 *
 *   Deliberately not the closest bar by timestamp. A bar is stamped at its open
 *   and lasts until the next one opens, so past the halfway point of a daily bar
 *   the arithmetically nearest stamp is tomorrow's, and the follower would
 *   highlight a candle that did not exist yet at the leader's instant.
 * - `hide`: draw nothing unless the follower has a bar at exactly that time.
 *   For a workspace where a linked crosshair is a data claim.
 *
 * Both policies refuse to answer **outside** the follower's coverage: an
 * instant before its first bar or after its last one is not a gap in its data,
 * it is a period the chart does not cover at all, and pinning the crosshair to
 * the first or last bar there would assert an alignment that does not exist.
 */
type LinkMissingPolicy = 'nearest' | 'hide';
/**
 * Leader instant -> follower logical index, or null for "draw no crosshair".
 *
 * Returns an integer: a linked crosshair always sits on one of the follower's
 * own bars, never interpolated between them.
 */
declare function followerIndex(follower: LinkDataLayer, time: number, whenMissing?: LinkMissingPolicy): number | null;
/**
 * Leader visible range -> the follower range showing the same wall-clock window.
 *
 * Both ends go through the fractional conversions, so the window survives a
 * different bar interval (a daily follower under an hourly leader ends up with
 * a fraction of a bar visible, which is exactly right) and survives an end
 * landing in the empty margin to the right of the last bar, where `indexToTime`
 * has nothing to return.
 *
 * Returns null when the answer would be meaningless rather than guessing:
 * either chart empty, a single-bar follower (every time maps to index 0, so the
 * span collapses), or a non-finite endpoint.
 *
 * A follower whose history does not overlap the window at all is *not* refused.
 * `timeToIndexFloat` extrapolates at the edge bar spacing, so it scrolls into
 * its own empty margin and shows nothing, which is the truth. Clamping it back
 * onto its last bars would show the user a different period than the leader.
 */
declare function followerRange(leader: LinkDataLayer, follower: LinkDataLayer, range: LogicalRange): LogicalRange | null;

/**
 * Chart linking groups: a grid of charts that behaves as one workspace.
 *
 * Headless, in the spirit of `ComparisonController` and `ReplayController`. It
 * ships no DOM, so the host draws its own link badge / colour chips and decides
 * which charts belong to which group.
 *
 * Three channels sync, each switchable on its own because a user routinely
 * wants one without the others (mirror the cursor across four timeframes but
 * keep each zoom; or slave every chart's symbol but let each keep its own
 * window):
 *
 * - **crosshair**: hovering one chart marks the same instant on the others.
 * - **viewport**: panning or zooming one moves the others to the same window.
 * - **symbol**: changing the instrument on one changes it on the others.
 *
 * Four decisions carry the design.
 *
 * 1. **Everything crosses a chart boundary as a time, never as a logical
 *    index.** See `./align`. This is the whole difficulty of the feature: the
 *    naive version works perfectly on two charts of the same symbol and
 *    interval, which is how it would ship broken.
 *
 * 2. **A follower's crosshair is a primitive, not the chart's own crosshair.**
 *    The engine's crosshair belongs to the pointer inside that chart; a linked
 *    one is a second, weaker mark that must not fight it. See `./crosshair`.
 *
 * 3. **One re-entrancy guard covers all three channels.** A syncs B, B echoes
 *    back to A, and the pair either oscillates forever or blows the stack. Any
 *    member event that arrives *while the group is broadcasting* is an echo of
 *    that broadcast by definition (a human cannot pan two charts in one call
 *    stack), so it is dropped. The guard is deliberately group-wide rather than
 *    per channel: a symbol change that reloads data can move a viewport, and
 *    that second-order echo is the same bug wearing a different hat.
 *
 * 4. **The group never keeps a destroyed chart alive.** `Chart.destroy` sets
 *    `isDestroyed` and emits `'destroy'`, so a member is released the moment it
 *    dies rather than at the next channel event. A `LinkChart` that is not a
 *    `Chart` may report neither, so members are also probed by pane count
 *    before every use (pane 0 can never be removed by any other route) and
 *    dropped on the spot, which matters because `addPrimitive` on a destroyed
 *    chart would resurrect a pane.
 *
 * **The engine has no notion of a symbol**, and inventing one here would put an
 * instrument concept in a charting engine that deliberately does not have one.
 * So the host participates: it tells the group an instrument changed (by
 * emitting `'symbol'` on the chart's own event bus, or by calling `setSymbol`),
 * and it supplies the per-member `onSymbol` callback that actually loads the
 * new instrument's bars. A member without `onSymbol` broadcasts symbol changes
 * but never receives them, which is how a host pins one chart of a grid.
 */

/**
 * The slice of the chart a link group drives. `Chart` satisfies it; declaring
 * it structurally keeps the group testable against a stub, which is the only
 * practical way to prove the feedback guard (the engine's own programmatic
 * setters do not echo today, and the guard exists for the day they do and for
 * the host callbacks that echo right now).
 */
interface LinkChart {
    on(event: string, cb: (payload: unknown) => void): () => void;
    getVisibleLogicalRange(): LogicalRange;
    setVisibleLogicalRange(range: LogicalRange): void;
    readonly dataLayer: LinkDataLayer;
    /**
     * Set by `Chart`. Optional so the group stays testable against a stub and
     * usable by a host wrapping something that is not a `Chart`, but when it is
     * there it is the answer: an empty pane list is only ever an inference.
     */
    readonly isDestroyed?: boolean;
    /** Only the count is read: the fallback destruction probe. See `alive`. */
    panes(): readonly unknown[];
    addPrimitive(primitive: IPrimitive, paneIndex?: number): void;
    removePrimitive(primitive: IPrimitive): void;
}
interface LinkOptions {
    /** Mirror the hovered instant onto every other member. Default true. */
    crosshair?: boolean;
    /** Mirror pan and zoom as a wall-clock window. Default true. */
    viewport?: boolean;
    /** Mirror the instrument, via each member's `onSymbol`. Default false. */
    symbol?: boolean;
    /** What a follower does with an instant it has no bar for. Default 'nearest'. */
    whenMissing?: LinkMissingPolicy;
}
interface LinkMemberOptions {
    /** The instrument this chart is showing right now, if the host tracks one. */
    symbol?: string;
    /**
     * Load `symbol` into this chart. The group calls it; the host does the work
     * (fetch bars, `series.setData`). Omit to make the member symbol-read-only:
     * it still broadcasts its own changes, it just never follows anyone else's.
     */
    onSymbol?: (symbol: string, chart: LinkChart) => void;
}
/** Every option resolved, as `options()` reports them. */
type ResolvedLinkOptions = Required<LinkOptions>;
declare class LinkGroup {
    private readonly _members;
    private _options;
    /** True while the group is applying a change to followers. See decision 3. */
    private _broadcasting;
    private _symbol;
    private _destroyed;
    constructor(options?: LinkOptions);
    options(): ResolvedLinkOptions;
    /**
     * Flip switches at runtime. Turning `crosshair` off clears the linked lines
     * immediately rather than leaving the last one frozen on every follower;
     * turning `symbol` on makes the group agree on the instrument it already
     * knows, because a switch that only takes effect on the *next* change would
     * leave a linked grid visibly unlinked.
     *
     * `viewport` has no equivalent convergence: nothing in the group says which
     * member's window the others should have adopted, so it takes effect on the
     * next pan or zoom.
     */
    setOptions(patch: LinkOptions): void;
    members(): readonly LinkChart[];
    has(chart: LinkChart): boolean;
    /** The instrument the group has agreed on, or null if nobody declared one. */
    symbol(): string | null;
    /**
     * The member's own logical index its linked crosshair is marking, or null
     * when it is showing none (it is the chart being hovered, the leader's
     * instant falls outside its coverage, or crosshair sync is off).
     *
     * A host wanting the linked bar's OHLC reads it back with
     * `chart.dataLayer.indexToTime(...)`, the same way a native crosshair readout
     * does.
     */
    crosshairIndex(chart: LinkChart): number | null;
    /**
     * Put a chart in the group. Adding one twice updates its member options
     * instead of double-subscribing.
     *
     * A member joining a group that already has a symbol adopts it (when symbol
     * sync is on and it can follow), because joining a linked workspace is
     * exactly the moment a user expects the new chart to fall in line.
     */
    add(chart: LinkChart, member?: LinkMemberOptions): void;
    /** Take a chart out of the group. Safe to call twice, and after `destroy`. */
    remove(chart: LinkChart): void;
    /**
     * The host reporting an instrument change on one member: the imperative twin
     * of emitting `'symbol'` on that chart's event bus. Records it and, when
     * symbol sync is on, loads it into every other member that can follow.
     */
    setSymbol(chart: LinkChart, symbol: string): void;
    /** Unlink everything: no listeners, no linked crosshairs, no references. */
    destroy(): void;
    private _onCrosshair;
    private _onViewport;
    private _onSymbolEvent;
    private _applySymbol;
    /** Push the group's agreed symbol onto everyone who is not already on it. */
    private _convergeSymbol;
    /**
     * Run `apply` on every member except the originator, exactly once, with the
     * echo guard held. `onLeader` (optional) runs on the originator itself.
     *
     * Re-entrant calls return without doing anything, which is what breaks the
     * A -> B -> A loop: the inner call is always an echo of the outer one.
     */
    private _broadcast;
    /** Drop destroyed members, releasing the group's reference to them. */
    private _prune;
    private _find;
    private _release;
    /**
     * Point this member's linked crosshair at one of its own bars (or clear it),
     * keeping one primitive per pane so the line spans price, volume and
     * indicator panes the way the native global crosshair does.
     */
    private _setCrosshair;
    private _detachCrosshairs;
}
/** Create a link group. `group.add(chart)` puts a chart in it. */
declare function createLinkGroup(options?: LinkOptions): LinkGroup;

/**
 * The crosshair a linked chart shows for someone else's cursor.
 *
 * The engine's own crosshair is driven by the pointer that is inside that
 * chart, and there is exactly one of them per chart. A follower needs a second,
 * independent one, so it is a primitive rather than anything in the core: it
 * sits on the `top` z-order, which is the layer `Pane.paintTop` repaints for a
 * cursor move, so a linked crosshair costs the same overlay repaint the native
 * one does.
 *
 * Two deliberate differences from the native crosshair:
 *
 * - **Vertical line only.** The horizontal line marks a price, and the price
 *   under a cursor on another instrument is not a price on this one. On a grid
 *   of four symbols a mirrored price line would be a straight lie four times
 *   over. The vertical line marks an instant, and an instant is shared.
 * - **Drawn at reduced opacity**, in the follower's own crosshair colour, so it
 *   reads as a reflection of a cursor somewhere else rather than a second
 *   cursor in this chart.
 */

/** Opacity of a linked crosshair relative to the pane's own crosshair colour. */
declare const LINK_CROSSHAIR_ALPHA = 0.55;
declare class LinkCrosshair implements IPrimitive {
    private _index;
    private _host;
    attached(host: PrimitiveHost): void;
    detached(): void;
    zOrder(): ZOrder;
    /** The follower's own logical index to draw at; null draws nothing. */
    index(): number | null;
    /** Move (or clear) the line. Repaints only when something actually changed. */
    setIndex(index: number | null): void;
    draw(ctx: CanvasRenderingContext2D, rc: PrimitiveRenderContext): void;
}

/**
 * Live candle aggregation (ARCHITECTURE.md §10.2). The WS feed does not deliver
 * interval candles — LTP mode gives a tick price (+ last-traded-qty), Quote mode
 * gives a *cumulative day* volume. This builder buckets ticks into interval OHLC
 * with explicit volume, session-reset, and late-tick policies. Pure and
 * deterministic (no Date/rAF) so it is fully unit-testable.
 */

type VolumeMode = 'ltq-sum' | 'day-delta';
type LateTickPolicy = 'foldIntoBar' | 'dropOlderThanPrevBar';
interface CandleBuilderOptions {
    intervalSec: number;
    /** 'ltq-sum' accumulates last-traded-qty; 'day-delta' diffs cumulative day volume. */
    volumeMode: VolumeMode;
    lateTickPolicy: LateTickPolicy;
    /**
     * UTC-seconds of a known session open. Buckets align to it so e.g. 5-minute
     * bars start at 09:15, not at an arbitrary epoch floor. Defaults to 0 (epoch).
     */
    sessionAnchorSec: number;
}
declare const DEFAULT_CANDLE_BUILDER_OPTIONS: CandleBuilderOptions;
interface Tick {
    time: UTCSeconds;
    price: number;
    /** Last-traded quantity (LTP mode). */
    ltq?: number;
    /** Cumulative day volume (Quote mode). */
    cumDayVolume?: number;
}
interface CandleUpdate {
    bar: Bar;
    /** True when this tick started a new interval bar (append vs mutate-in-place). */
    isNew: boolean;
    /**
     * True while the bar's open, high, low and volume cover only the ticks this
     * builder has seen. A bar is provisional when it was opened from a tick
     * without the builder having streamed the bar before it: a cold start, or a
     * seed from an older bucket, both of which mean the trades between the
     * bucket's true open and the first tick seen were missed. The close is still
     * the latest price. An authoritative bar for the same bucket, from history,
     * corrects the rest through `reconcile`.
     */
    provisional?: boolean;
}
declare class CandleBuilder {
    private readonly _opts;
    private _current;
    private _cumAtBarStart;
    private _lastCum;
    private _hasCum;
    /** The current bar has received at least one tick, so a rollover from it sees the true open. */
    private _streamed;
    private _provisional;
    constructor(options?: Partial<CandleBuilderOptions>);
    /** Seed with the last historical bar so the first live tick continues it. */
    seed(lastBar: Bar, cumDayVolumeSoFar?: number): void;
    current(): Bar | null;
    /** Whether the current bar is provisional; see `CandleUpdate.provisional`. */
    isProvisional(): boolean;
    /**
     * Adopt an authoritative bar for the current bucket, typically the broker's
     * history for the bar that is still forming.
     *
     * A provisional bar takes the authoritative open, because its own is the
     * first tick this builder happened to see. Every bar takes the union of the
     * extremes, since both sides observed real prices, and the larger volume,
     * since volume inside a bar only grows. The close stays with the ticks: a
     * history snapshot was taken before the request went out, and a price that
     * jumps backwards on every repair is the one thing a live chart must not do.
     *
     * Returns the reconciled bar, or null when the builder holds no bar for that
     * bucket, in which case the caller decides whether to `seed` instead.
     */
    reconcile(authoritative: Bar): Bar | null;
    /** Bucket-start (bar-open) time for a tick, aligned to the session anchor. */
    bucketStart(time: UTCSeconds): UTCSeconds;
    /**
     * Feed one tick. Returns the affected bar (mutated current or a fresh one),
     * or `null` if the tick was dropped by the late-tick policy.
     */
    onTick(tick: Tick): CandleUpdate | null;
    private _foldInto;
    private _volumeForNewBar;
    private _volumeForSameBar;
}

/**
 * Free-standing shapes an indicator paints in its pane (ARCHITECTURE.md §8):
 * lines, boxes, labels and polylines anchored to time and price.
 *
 * One primitive holds the whole list rather than one primitive per shape. A
 * descriptor rebuilds its shapes on every recompute, so per-shape primitives
 * would mean attaching and detaching a dozen objects on every live tick, and
 * the pane would re-sort its z-order for each of them.
 *
 * Anchors are **times**, never logical indices: paging history in at the left
 * edge shifts every index, and a trendline pinned to an index would slide off
 * its pivots the moment it did.
 */

declare class IndicatorDrawings implements IPrimitive {
    private _items;
    private _host;
    private _visible;
    attached(host: PrimitiveHost): void;
    detached(): void;
    /** Over the series, under the crosshair: these are annotations on the data. */
    zOrder(): ZOrder;
    /**
     * A shape is drawn where the descriptor put it and never argues with the
     * scale. A projection reaching far above the data would otherwise squash the
     * study it annotates into a band a few pixels tall.
     */
    autoscaleInfo(): null;
    setItems(items: readonly IndicatorDrawing[]): void;
    setVisible(on: boolean): void;
    draw(ctx: CanvasRenderingContext2D, rc: PrimitiveRenderContext): void;
}

/**
 * Per-bar pane shading: one full-height column behind the data, in whatever
 * colour the descriptor gave that bar.
 *
 * A regime study answers "which state is the market in", and that is a property
 * of the whole bar rather than of a price. As a column it reads at a glance and
 * costs the price scale nothing, where a plot would need a value to sit at and
 * would drag the pane's autoscale around with it.
 *
 * What makes it affordable is the work skipped: everything outside the visible
 * range is dropped before anything is painted, and adjacent bars sharing a
 * colour become one rect instead of one rect each. A year of two-state shading
 * is a handful of fills, not one per bar per frame.
 */

declare class IndicatorBackground implements IPrimitive {
    private _colors;
    /** Time of `_colors[0]`'s bar. See `draw` for why this is a time, not an index. */
    private _anchor;
    private _host;
    private _visible;
    attached(host: PrimitiveHost): void;
    detached(): void;
    /** The same layer the bands use: behind the series, so the candles stay crisp. */
    zOrder(): ZOrder;
    /** Shading has no price of its own and must never widen the pane's range. */
    autoscaleInfo(): null;
    setColors(colors: readonly (string | null)[], bars: readonly Bar[]): void;
    setVisible(on: boolean): void;
    draw(ctx: CanvasRenderingContext2D, rc: PrimitiveRenderContext): void;
}

/**
 * Price-level family, built on the primitive API (ARCHITECTURE.md §8). A price
 * level is a horizontal line at a meaningful price **and** a matching tag on the
 * price axis, and the two halves toggle independently.
 *
 * WHY one options group per level instead of a list of lines and a list of
 * labels: the two halves of a level are one idea. Reference terminals split them
 * across separate menus, so a level's line and its label drift apart and a user
 * ends up with an axis tag for a line that is not drawn. Here `line` and `label`
 * are two flags on the same group, which cannot come apart.
 *
 * WHY the session comes from the bar gaps and never from a calendar midnight:
 * the overnight break is the only thing in the data that says where a trading
 * day ends, and a fixed midnight lands mid-session for half the world's
 * exchanges. `sessionStartFlags` already reads it back (and falls back to the
 * calendar only when the series shows no readable break, which is the right
 * answer for daily bars). That bug was fixed in 1.2.0; this file does not
 * reintroduce it.
 *
 * WHY levels with no data draw nothing rather than drawing at zero: extended
 * hours need a phase the historical feed does not carry, and bid/ask need a live
 * quote it does not carry either. A missing value is `null`, never `0`, so the
 * level stays inert and a host can render its control disabled with the state
 * still visible (`available(kind)`), which is what the UI standard asks for.
 *
 * WHY there is no `autoscaleInfo`: a previous close a gap away from the session
 * in view would stretch the range and flatten the bars the user is actually
 * looking at. A reference level that scrolls off the top is the lesser harm, and
 * it is what the last-price line already does.
 */

type PriceLevelKind = 'previousClose' | 'sessionHigh' | 'sessionLow' | 'lastPrice' | 'preMarketOpen' | 'preMarketClose' | 'postMarketOpen' | 'postMarketClose' | 'bid' | 'ask';
/** Every level, in the order a settings panel should list them. */
declare const PRICE_LEVEL_KINDS: readonly PriceLevelKind[];
/** One level's appearance. `line` and `label` are the two independent toggles. */
interface PriceLevelStyle {
    /** Draw the horizontal line across the plot. */
    line: boolean;
    /** Draw the matching tag on the price axis. */
    label: boolean;
    /** Line and tag colour. Unset falls through to the theme (see `defaultColor`). */
    color?: string;
    /** Line width in media px. Default 1. */
    lineWidth?: number;
    /** Line dash. Default per kind. */
    lineStyle?: CanvasLineStyle;
    /** Axis tag text. Default: the price, formatted by the scale. */
    text?: string;
    /**
     * Fraction of the plot width the line spans, measured from the price axis.
     * 1 = full width (default), the same meaning `PriceLine` gives it.
     */
    extentFromRight?: number;
}
/**
 * Which part of the trading day a bar belongs to. Only a host knows this: the
 * OHLC feed carries no phase, and guessing it from the clock would be wrong for
 * every exchange but the one guessed for.
 */
type MarketPhase = 'pre' | 'regular' | 'post';
/** Classify a bar into a market phase; null/undefined means "unknown". */
type MarketPhaseFn = (bar: Bar) => MarketPhase | null | undefined;
/** A live top-of-book quote. Either side may be absent. */
interface PriceLevelQuote {
    bid?: number | null;
    ask?: number | null;
}
interface PriceLevelsOptions {
    /** Per-level overrides, merged over the defaults. */
    levels?: Partial<Record<PriceLevelKind, Partial<PriceLevelStyle>>>;
    /** IANA zone for the calendar fallback when the bars show no session break. */
    timezone?: string;
    /** Extended-hours classifier. Absent leaves the four extended levels inert. */
    marketPhase?: MarketPhaseFn | null;
    /** Live quote, as a value or a callback read each frame. Absent leaves bid/ask inert. */
    quote?: PriceLevelQuote | (() => PriceLevelQuote | null | undefined) | null;
}
/** Each level's price for the current context, or null when it has no data. */
type PriceLevelValues = Record<PriceLevelKind, number | null>;
interface PriceLevelInput {
    bars: readonly Bar[];
    /**
     * UTC seconds at the right edge of the viewport: the session containing it is
     * "the session in view", and the level before it is its previous session.
     * Default (and anything past the last bar) anchors on the last bar.
     */
    anchorTime?: number;
    timezone?: string;
    marketPhase?: MarketPhaseFn | null;
    quote?: PriceLevelQuote | null;
}
/**
 * Every level's price for one viewport, or null where the data cannot say.
 *
 * Pure, so the levels are testable without a canvas, and callable by a host that
 * wants the numbers for a readout rather than for a line.
 */
declare function computePriceLevels(input: PriceLevelInput): PriceLevelValues;
/**
 * The last-price level as the series style already expresses it.
 *
 * That level is not duplicated here: `priceLineVisible` and `lastValueVisible`
 * are exactly this family's `line` and `label` under older names, and the pane
 * draws them. These two functions are the translation, so a host can present the
 * last price in the same shape as every other level and write the answer back to
 * the series it belongs to.
 */
declare function lastPriceLevelFromSeriesStyle(style: Pick<SeriesStyle, 'priceLineVisible' | 'lastValueVisible'>): Pick<PriceLevelStyle, 'line' | 'label'>;
/** The series-style patch a last-price level group means. */
declare function seriesStyleForLastPriceLevel(level: Pick<PriceLevelStyle, 'line' | 'label'>): Pick<SeriesStyle, 'priceLineVisible' | 'lastValueVisible'>;
declare class PriceLevels implements IPrimitive {
    private readonly _levels;
    private _timezone;
    private _phase;
    private _quote;
    private _values;
    private _host;
    constructor(options?: PriceLevelsOptions);
    attached(host: PrimitiveHost): void;
    detached(): void;
    zOrder(): ZOrder;
    /** One level's resolved style, for a host rendering its controls. */
    level(kind: PriceLevelKind): Readonly<PriceLevelStyle>;
    /** Patch one level. The two toggles move independently: neither implies the other. */
    setLevel(kind: PriceLevelKind, patch: Partial<PriceLevelStyle>): void;
    /** Patch several levels, plus the shared options, in one repaint. */
    setOptions(options: PriceLevelsOptions): void;
    /** Feed a live top-of-book quote; null clears it and the bid/ask levels go inert. */
    setQuote(quote: PriceLevelQuote | null): void;
    /**
     * Level prices as of the last frame. Values depend on the viewport, so they
     * are computed while drawing; before the first frame every level reads null.
     * A host that needs them without a chart calls {@link computePriceLevels}.
     */
    values(): Readonly<PriceLevelValues>;
    /**
     * Whether a level has data in the current context. False is the signal to
     * render its control disabled rather than to hide it: "no previous session
     * yet" is information, an absent checkbox is not.
     */
    available(kind: PriceLevelKind): boolean;
    draw(ctx: CanvasRenderingContext2D, rc: PrimitiveRenderContext): void;
}

/**
 * Dims everything from a bar onward, and draws the line where the cut falls.
 *
 * Two jobs, one shape. Picking a replay start means answering "from here, what
 * happens next?", and the honest way to ask it is to hide the answer: the bars
 * to the right of the cursor are greyed while the user chooses, so a start bar
 * is picked on what was known at the time rather than on the shape of what
 * followed. Once replay is running the same veil marks the part of the session
 * that has not been reached yet.
 *
 * The shade is drawn over the series rather than under it, because covering the
 * future is the entire point: a translucent wash still shows the shape faintly,
 * which is what tells a user there is more session there to walk into.
 */

interface ReplayShadeOptions {
    /**
     * The last bar left uncovered. Everything after it is dimmed. Null draws
     * nothing at all, which is how a host keeps one instance around across
     * entering and leaving the mode.
     */
    index: number | null;
    /** Wash colour over the covered bars. Default a dark, low-alpha neutral. */
    color?: string;
    /** The rule at the cut. Default a muted blue, the colour of a chosen thing. */
    lineColor?: string;
    lineWidth?: number;
    /** Draw the divider. Default true. */
    lineVisible?: boolean;
    zOrder?: ZOrder;
    id?: string;
}
declare class ReplayShade implements IPrimitive {
    private _opts;
    constructor(opts: ReplayShadeOptions);
    zOrder(): ZOrder;
    /** Takes no part in autoscale: it covers bars, it is not one. */
    autoscaleInfo(): null;
    /** Never hit, so the click that picks a bar reaches the chart. */
    hitTest(): null;
    setOptions(patch: Partial<ReplayShadeOptions>): void;
    draw(ctx: CanvasRenderingContext2D, rc: PrimitiveRenderContext): void;
}

/**
 * Inline Buy/Sell button panel (ARCHITECTURE.md §9). An on-chart trade
 * panel docked inside the plot: a SELL button (bid), a quantity chip, and a BUY
 * button (ask), drawn on the overlay canvas so it stays fixed while the chart
 * pans/zooms. Clicks hit-test to `${id}:sell` / `${id}:buy` / `${id}:qty`, which
 * the chart routes through `subscribeClick` — the app places the order. Prices
 * update cheaply on every tick (`setPrices` / `setMark`).
 */

interface BuySellButtonsOptions {
    /** Stable id prefix; hit-tests emit `${id}:sell` / `${id}:buy` / `${id}:qty`. Default `trade`. */
    id?: string;
    /** Corner to dock to. Default `top-left`. */
    position?: WatermarkPosition;
    /**
     * Gap from the plot edges in media px. A number applies to both axes; pass
     * `{ x, y }` to offset independently (e.g. clear an OHLC legend at the top).
     */
    margin?: number | {
        x: number;
        y: number;
    };
    /** Quantity shown in the centre chip (e.g. lots or absolute qty). */
    qty?: string | number;
    /** Buy button color (defaults to the theme `buy`). */
    buyColor?: string;
    /** Sell button color (defaults to the theme `sell`). */
    sellColor?: string;
    /** Button labels. Default `BUY` / `SELL`. */
    buyLabel?: string;
    sellLabel?: string;
    /** Show the price line above each label. Default true. */
    showPrices?: boolean;
    /**
     * Uniform size multiplier for the whole panel — box, gaps and type. Default 1.
     * A dense trading layout wants these smaller so they do not crowd the pane's
     * legend rows. Clamped to 0.6..1.5; below that the labels stop being legible.
     */
    scale?: number;
}
declare class BuySellButtons implements IPrimitive {
    private readonly _id;
    private readonly _position;
    private readonly _mx;
    private readonly _my;
    private readonly _scale;
    private readonly _btnW;
    private readonly _qtyW;
    private readonly _h;
    private readonly _buyLabel;
    private readonly _sellLabel;
    private readonly _showPrices;
    private _qty;
    private _buyColor?;
    private _sellColor?;
    private _bid;
    private _ask;
    private _host;
    private _sellRect;
    private _buyRect;
    private _qtyRect;
    constructor(options?: BuySellButtonsOptions);
    attached(host: PrimitiveHost): void;
    detached(): void;
    zOrder(): ZOrder;
    autoscaleInfo(): null;
    /** Distinct bid/ask (shows a spread on the two buttons). */
    setPrices(bid: number, ask: number): void;
    /** Single mark price shown on both buttons (when there is no bid/ask). */
    setMark(price: number): void;
    setQty(qty: string | number): void;
    setColors(buyColor?: string, sellColor?: string): void;
    private _origin;
    draw(ctx: CanvasRenderingContext2D, rc: PrimitiveRenderContext): void;
    private _fmt;
    private _drawButton;
    private _drawChip;
    /** Trace a rect rounded on the left or right pair of corners only. */
    private _roundedSide;
    hitTest(x: number, y: number, _rc: PrimitiveRenderContext): PrimitiveHit | null;
}

/**
 * Exponential moving average (ARCHITECTURE.md §8 — an indicator that validates
 * the series/extensibility model). Pure; the result is plotted as a `line`
 * series, demonstrating derived data on the shared time axis.
 */

/** EMA over a numeric series. Seeds from the first value; k = 2/(period+1). */
declare function ema(values: readonly number[], period: number): number[];
/**
 * EMA of bar closes as plottable bars (close = ema; O/H/L = ema), ready to feed
 * a `line` series via `series.setData(...)`.
 */
declare function emaSeries(bars: readonly Bar[], period: number): Bar[];

/**
 * Relative Strength Index — Wilder's RSI, matching `openalgo.rsi(close, 14)`.
 *
 * Uses Wilder smoothing (RMA): the first average gain/loss is the simple mean of
 * the first `period` deltas, then each subsequent average carries
 * `(prev*(period-1) + current)/period`. Warmup bars (before enough data) are NaN.
 */

/** Wilder RSI over a numeric series. Returns NaN for the first `period` slots. */
declare function rsi(values: readonly number[], period?: number): number[];
/**
 * RSI of bar closes as plottable bars (close = rsi). Warmup bars carry NaN so a
 * `line` series breaks cleanly before the first value (the renderer skips
 * non-finite points) instead of dropping to zero.
 */
declare function rsiSeries(bars: readonly Bar[], period?: number): Bar[];

/**
 * Average True Range — Wilder's ATR, matching `openalgo.atr(high, low, close, 14)`.
 * Shared by the Supertrend indicator. True range of the first bar is high-low.
 */
/** True range series. tr[0] = high[0]-low[0]; thereafter the classic 3-way max. */
declare function trueRange(high: readonly number[], low: readonly number[], close: readonly number[]): number[];
/** Wilder ATR. First value (SMA of the first `period` TRs) lands at index period-1; earlier slots NaN. */
declare function atr(high: readonly number[], low: readonly number[], close: readonly number[], period?: number): number[];

/**
 * Supertrend — matching `openalgo.supertrend(high, low, close, period=10, multiplier=3.0)`,
 * which returns (supertrend value, direction). Direction follows the OpenAlgo
 * convention: -1 = uptrend (line is support below price), +1 = downtrend (line
 * is resistance above price). ATR uses Wilder smoothing (see ./atr).
 */

interface SupertrendPoint {
    /** The Supertrend band value, or NaN during ATR warmup. */
    value: number;
    /** -1 = uptrend (bullish), +1 = downtrend (bearish). */
    direction: -1 | 1;
}
/** Supertrend value + direction per bar. Warmup bars carry value=NaN. */
declare function supertrend(bars: readonly Bar[], period?: number, multiplier?: number): SupertrendPoint[];
/**
 * Supertrend as two plottable `line` series for direction coloring: `up`
 * (uptrend / support, typically green) carries the value only while direction is
 * -1; `down` (downtrend / resistance, typically red) only while +1. The inactive
 * series carries NaN, so each renders as separate segments that swap at flips
 * (the line renderer breaks across non-finite points).
 */
declare function supertrendSeries(bars: readonly Bar[], period?: number, multiplier?: number): {
    up: Bar[];
    down: Bar[];
};

/**
 * Optional OHLC-preserving conflation / downsampling (ARCHITECTURE.md §4.4).
 * When zoomed far out, many bars map to sub-pixel widths; drawing them all is
 * wasted work. Conflation merges groups of bars into one, preserving candle
 * shape — open = first, close = last, high = max, low = min, volume = sum
 * (never a lossy average). Off by default; enabling it changes nothing until
 * bars fall below the pixel threshold.
 */

/**
 * How many source bars to merge per drawn bar. Returns 1 (no conflation) while
 * each bar is at least `minPx` wide; otherwise ceil(minPx / barWidthPx) scaled
 * by `factor` (higher = more aggressive smoothing).
 */
declare function conflationGroupSize(barSpacing: number, dpr: number, minPx?: number, factor?: number): number;
/** Merge a single group of bars into one OHLC-preserving bar (uses the first bar's time). */
declare function mergeBars(group: readonly Bar[]): Bar;
/** Conflate a bar series into groups of `groupSize` (identity when groupSize ≤ 1). */
declare function conflateBars(bars: readonly Bar[], groupSize: number): Bar[];
/** Conflate already-projected draw items: merge bars and place x at the group centre. */
declare function conflateItems<T extends {
    x: number;
    bar: Bar;
}>(items: readonly T[], groupSize: number): {
    x: number;
    bar: Bar;
}[];

/** Cancels a subscription. */
type UnsubscribeFn = () => void;
interface BarsRequest {
    symbol: string;
    exchange: string;
    /** Interval token, e.g. "1m", "5m", "1h", "D". */
    interval: string;
    from?: UTCSeconds;
    to?: UTCSeconds;
    /** Fetch authoritative history instead of a cached snapshot, when supported. */
    noCache?: boolean;
    /** Cancel this consumer's request. Existing feeds may ignore cancellation. */
    signal?: AbortSignal;
    /** Deadline in milliseconds, including response-body reading. */
    timeoutMs?: number;
    /** Preferred number of bars; a date-range feed may return a different count. */
    countBack?: number;
}
/** An optional provider page before an exclusive UTC-second anchor. */
interface BarsPageRequest extends BarsRequest {
    before: UTCSeconds;
    countBack: number;
}
/** Providers can distinguish an empty date window from exhausted history. */
interface BarsPage {
    bars: Bar[];
    hasMore?: boolean;
    /** Exclusive anchor for the next page, including pages without observations. */
    nextBefore?: UTCSeconds;
}
/** Optional context for continuing history and recovering an interrupted stream. */
interface BarSubscriptionOptions {
    /** Last historical time-bucketed bar, used as the live builder's starting point. */
    seedFrom?: Bar;
    /** Cumulative day volume at the seed snapshot, if the host knows it. */
    cumDayVolumeSoFar?: number;
    /**
     * The stream reconnected and may have missed data. Refresh authoritative
     * history, then resubscribe with its last bar as the seed. Older bars must
     * not be delivered through onBar, whose consumers commonly accept only tails.
     */
    onResync?: () => void;
}
/** What a live push knows about the bar beyond its values. */
interface LiveBarMeta {
    /**
     * The bar's open, high, low and volume cover only the ticks its builder saw:
     * it opened the bucket from a tick without having streamed the bar before
     * it. See `CandleUpdate.provisional`. A consumer holding history for the
     * same bucket keeps that open and widens the extremes rather than replacing
     * them.
     */
    provisional?: boolean;
}
/**
 * Broker-agnostic market-data source. The chart depends only on this.
 * `subscribeBars` is optional: a history-only feed (e.g. `OpenAlgoDataFeed`) omits
 * it, while a live feed (`OpenAlgoLiveDataFeed`, or your own) implements it.
 */
interface DataFeed {
    getBars(req: BarsRequest): Promise<Bar[]>;
    getBarsPage?(req: BarsPageRequest): Promise<BarsPage>;
    /** Read a closed-bar snapshot without initiating a network request. */
    getCachedBars?(req: BarsRequest): Promise<Bar[] | undefined>;
    subscribeBars?(req: BarsRequest, onBar: (bar: Bar, meta?: LiveBarMeta) => void, opts?: BarSubscriptionOptions): UnsubscribeFn;
    /**
     * `opts.depthLevel` requests a book depth (broker-dependent: 5/20/30/50).
     * Named on the interface so a caller holding a `DataFeed` can ask for one;
     * an implementation is free to ignore it and send the broker's default.
     */
    subscribeDepth?(req: BarsRequest, onDepth: (depth: MarketDepth) => void, opts?: {
        depthLevel?: number;
    }): UnsubscribeFn;
}
interface DepthLevel {
    price: number;
    qty: number;
    orders?: number;
}
/** Variable-depth book; `bids`/`asks` length = whatever the broker streams (5..200). */
interface MarketDepth {
    /** Exchange event timestamp in UTC seconds, when supplied by the feed. */
    timeSec?: UTCSeconds;
    bids: DepthLevel[];
    asks: DepthLevel[];
    ltp: number;
    ltq?: number;
}
type OrderSide$1 = 'BUY' | 'SELL';
type OrderType$1 = 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
interface PlaceOrder {
    symbol: string;
    exchange: string;
    side: OrderSide$1;
    type: OrderType$1;
    qty: number;
    price?: number;
    triggerPrice?: number;
    /** Idempotency token so a retried place never double-fills. */
    clientToken?: string;
}
/**
 * High-level broker trading source: place / modify / cancel plus subscriptions
 * to orders and positions. NOTE: the trade tier's `OrderEngine` uses the smaller
 * `OrderFeed` (`place` / `modify` / `cancel`, from `openalgo-charts/trade`), which
 * is what `OpenAlgoTradeFeed` implements. Implement `OrderFeed` for the engine's
 * write path; use `TradeFeed` for a higher-level broker abstraction.
 */
interface TradeFeed {
    placeOrder(o: PlaceOrder): Promise<{
        orderId: string;
    }>;
    modifyOrder(orderId: string, patch: Partial<PlaceOrder>): Promise<void>;
    cancelOrder(orderId: string): Promise<void>;
    subscribeOrders(cb: (orders: unknown[]) => void): UnsubscribeFn;
    subscribePositions(cb: (positions: unknown[]) => void): UnsubscribeFn;
}

/** Limits apply to each pool, whose identity belongs to one data feed. */
interface HistoryRequestPoolOptions {
    maxConcurrent?: number;
    timeoutMs?: number;
}
/**
 * Shares in-flight historical requests while each consumer owns its lifetime.
 * Higher priorities run first among queued work; active work is not preempted.
 */
declare class HistoryRequestPool {
    private readonly _feed;
    private readonly _max;
    private readonly _timeout;
    private readonly _jobs;
    private _active;
    private _draining;
    constructor(feed: DataFeed, options?: HistoryRequestPoolOptions);
    getBars(req: BarsRequest, priority?: number): Promise<Bar[]>;
    getBarsPage(req: BarsPageRequest, priority?: number): Promise<BarsPage>;
    private _request;
    private _remove;
    private _finish;
    private _drain;
}
/** Reuse one pool only for consumers of this exact feed instance. */
declare function sharedHistoryRequests(feed: DataFeed): HistoryRequestPool;

type DataLoadingStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'refreshing' | 'stale' | 'error';
type HistoryLoadingStatus = 'idle' | 'loading' | 'error' | 'exhausted' | 'limited';
type DataUpdateReason = 'load' | 'cache' | 'live' | 'refresh' | 'prepend' | 'resume' | 'state';
/** Display bars are held still while paused; bars() retains the live store. */
interface DataLoadingSnapshot {
    readonly request: Readonly<BarsRequest> | null;
    readonly bars: readonly Bar[];
    readonly status: DataLoadingStatus;
    readonly historyStatus: HistoryLoadingStatus;
    readonly hasMore: boolean | null;
    readonly error?: Error;
    readonly historyError?: Error;
    readonly reason: DataUpdateReason;
    readonly paused: boolean;
}
interface DataLoadingOptions {
    requestPool?: HistoryRequestPool;
    timeoutMs?: number;
    pageSize?: number;
    /** Date-window fallback for feeds without getBarsPage. Defaults to the load window. */
    pageWindowSec?: number;
    /** Empty windows inspected per gesture, without claiming permanent exhaustion. */
    maxEmptyPages?: number;
    maxBars?: number;
    /** Optional history repair cadence. Zero disables polling. */
    pollIntervalMs?: number;
    /**
     * Repair the tail when a bar closes, driven by the stream rather than the
     * clock. A pushed bar that opens a new bucket means the bar before it has
     * just closed, so one refresh runs `delayMs` later (default 2500 ms), long
     * enough for a broker's history to have published the close. Nothing fires
     * while the stream is quiet, so a closed market costs no requests. When the
     * reply still stops short of the bar that closed, the repair retries
     * `retries` times (default 2), `retryDelayMs` apart (default 5000 ms).
     * Off by default.
     */
    refreshOnBarClose?: boolean | {
        delayMs?: number;
        retries?: number;
        retryDelayMs?: number;
    };
    /**
     * Refresh at once when a pushed bar skips one or more whole buckets, which
     * is what a stream leaves behind after a dropped socket, a hidden tab or a
     * sleeping machine. Needs a fixed-length interval. Off by default.
     */
    refreshOnGap?: boolean;
    /**
     * How many bars back from the tail a refresh re-fetches. Unset re-fetches
     * the whole load window on every refresh, which is what polling always did;
     * a small number turns each repair into a tail request. A gap repair widens
     * the window to cover the gap. Needs a fixed-length interval; any other
     * interval keeps the whole window.
     */
    refreshWindowBars?: number;
    /** UTC seconds. */
    now?: () => number;
}
/**
 * Owns history, paging and live updates for one current instrument. Consumers
 * decide how to paint snapshots; no canvas, DOM or broker execution is owned here.
 */
declare class DataLoadingController {
    private readonly _feed;
    private readonly _pool;
    private readonly _options;
    private readonly _listeners;
    private _state;
    private _bars;
    private _scope;
    private _refreshAbort;
    private _pageAbort;
    private _loadWork;
    private _pageWork;
    private _unsubscribe;
    private _stream;
    private _generation;
    private _refreshId;
    private _before;
    private _buffer;
    private _poll;
    private _visible;
    private _destroyed;
    /** Seconds per bar of the current request, null when the interval is not fixed-length. */
    private _seconds;
    /** Bucket whose open is only the first tick a builder saw, until history covers it. */
    private _provisionalTime;
    private _repairTimer;
    private _repairRetries;
    private _pendingRepair;
    private readonly _barClose;
    constructor(feed: DataFeed, options?: DataLoadingOptions);
    getState(): DataLoadingSnapshot;
    bars(): readonly Bar[];
    subscribe(listener: (snapshot: DataLoadingSnapshot) => void): UnsubscribeFn;
    load(req: BarsRequest): Promise<readonly Bar[]>;
    private _load;
    refresh(): Promise<readonly Bar[]>;
    private _refresh;
    /**
     * Supply bars from an existing host subscription instead of subscribing twice.
     *
     * `meta.provisional` marks a bar whose open is only the first tick a builder
     * saw, see `CandleUpdate.provisional`. Pushed onto a bar history already
     * holds for that bucket, it keeps that bar's open and widens the extremes
     * instead of replacing them, so a repair that found the true open is not
     * undone by the next tick.
     */
    pushBar(value: Bar, meta?: LiveBarMeta): void;
    /** The stream opened a bucket: the one before it closed, and any between were skipped. */
    private _onNewBucket;
    private _scheduleRepair;
    /** Run a repair now, or queue one behind the refresh already in flight rather than aborting it. */
    private _requestRepair;
    private _clearRepairTimer;
    loadMore(): Promise<readonly Bar[]>;
    private _loadMore;
    setPaused(paused: boolean): void;
    setVisible(visible: boolean): void;
    destroy(): void;
    private _current;
    private _replaceWindow;
    private _limit;
    private _publish;
    private _startStream;
    private _release;
    private _clearPoll;
    private _schedulePoll;
    private _cancel;
}

/**
 * OpenAlgo REST adapter (ARCHITECTURE.md §10.0). The chart depends only on the
 * `DataFeed` interface; this is the only file that knows OpenAlgo's REST shape.
 *
 * History endpoint: POST `${baseUrl}/api/v1/history`.
 * The request fields and interval mapping are pinned by offline adapter
 * fixtures. Response timestamps accept epoch seconds, epoch milliseconds,
 * offset-qualified timestamps and unqualified IST date/time strings.
 */

interface OpenAlgoConfig {
    baseUrl: string;
    apiKey: string;
    /** Injectable fetch (defaults to global fetch); lets the adapter be tested offline. */
    fetchImpl?: typeof fetch;
}
interface HistoryRow {
    timestamp?: number | string;
    time?: number | string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
}
interface HistoryResponse {
    status?: string;
    message?: string;
    data?: HistoryRow[];
}
/** Pure: coerce a row timestamp (epoch s / epoch ms / IST string) to UTC seconds. */
declare function rowTimeToUtcSeconds(value: number | string): number;
/** Pure: map an OpenAlgo history response into sorted internal bars. */
declare function mapHistoryResponse(json: HistoryResponse): Bar[];
declare class OpenAlgoDataFeed implements DataFeed {
    private readonly _config;
    private readonly _fetch;
    constructor(config: OpenAlgoConfig);
    getBars(req: BarsRequest): Promise<Bar[]>;
}

/**
 * OpenAlgo WebSocket adapter (ARCHITECTURE.md §10, C2). Speaks the documented
 * OpenAlgo WS proxy protocol (default port 8765, or wss://host/ws in production):
 *
 *   1. authenticate: { action:'authenticate', api_key }
 *      server answers { type:'auth', status:'success' } (or a refusal)
 *   2. subscribe   : { action:'subscribe', symbol, exchange, mode }   mode 1=LTP 2=Quote 3=Depth
 *                    (Depth adds depth_level, e.g. 5/20/30/50)
 *   3. server pushes { type:'market_data', symbol, exchange, mode, data:{...} }
 *   4. heartbeat   : OpenAlgo's proxy pings at the protocol level, which a
 *      browser answers without telling JavaScript, so the client keeps its own
 *      watchdog and asks { action:'ping' } when the stream goes quiet. An
 *      application-level 'ping' frame, which some builds send, is ponged.
 *
 * Maps inbound LTP / Quote / Depth into typed callbacks the chart consumes
 * (candle builder, last price, DOM ladder). The socket is injectable so the
 * adapter is unit-testable with a fake socket and no network.
 *
 * Step 1 is a gate, not a formality. Nothing but the auth frame leaves the
 * socket until the server acknowledges: a proxy that drops pre-auth frames
 * otherwise leaves a chart that believes it is subscribed and is permanently
 * silent, which under a Buy button is the worst state this library can be in.
 */

type WsMode = 'LTP' | 'Quote' | 'Depth';
/**
 * Socket lifecycle reported by `onState`.
 *
 * 'open' means authenticated and carrying traffic, not merely TCP-connected:
 * the window between transport open and the auth acknowledgement still reads
 * as 'connecting', because nothing can be sent in it.
 */
type WsState = 'connecting' | 'open' | 'closed' | 'error' | 'reconnecting';
/** A non-market-data control frame (auth / subscribe ack, or a server error). */
interface WsControlMessage {
    type?: string;
    status?: string;
    message?: string;
    [k: string]: unknown;
}
/**
 * A warning the client raised about its own connection, delivered on the same
 * control channel. `type` is deliberately a value no server frame uses, so a
 * host can never mistake one for the other.
 */
interface WsClientWarning extends WsControlMessage {
    type: 'client_warning';
    /**
     * AUTH_TIMEOUT | AUTH_FAILED | AUTH_UNACKNOWLEDGED | RECONNECT_ABANDONED |
     * HEARTBEAT_DEAD | STREAM_RESYNC | SEQUENCE_GAP
     */
    code: string;
    message: string;
}
/** Minimal socket surface (the browser WebSocket satisfies this). */
interface SocketLike {
    send(data: string): void;
    close(): void;
    onopen: (() => void) | null;
    onclose: (() => void) | null;
    onerror?: (() => void) | null;
    onmessage: ((ev: {
        data: string;
    }) => void) | null;
    /** 1 === OPEN (browser WebSocket.OPEN). Used to gate sends. */
    readyState?: number;
}
type SocketFactory = (url: string) => SocketLike;
interface OpenAlgoWsConfig {
    url: string;
    apiKey: string;
    socketFactory?: SocketFactory;
    /**
     * Auto-reconnect after an unexpected close: re-authenticate and resubscribe
     * every active subscription, with jittered exponential backoff. Enabled by
     * default; `close()` is treated as intentional and never reconnects.
     */
    reconnect?: {
        enabled?: boolean;
        baseDelayMs?: number;
        maxDelayMs?: number;
        maxAttempts?: number;
        /** Full jitter on each delay (default true). Off gives the old lockstep timing. */
        jitter?: boolean;
        /** Injectable [0,1) source, so a test pins the delay instead of guessing it. */
        random?: () => number;
    };
    /** Handshake gating. Data frames wait for the server's answer to `authenticate`. */
    auth?: {
        /**
         * Require a positive acknowledgement (default true). Set false only for a
         * proxy build known to answer nothing: the connection then counts as
         * authenticated on transport open, and one AUTH_UNACKNOWLEDGED warning is
         * raised per connection so the missing guarantee is visible rather than
         * silently assumed.
         */
        requireAck?: boolean;
        /** Wait for the acknowledgement this long before failing the connection (default 5000). */
        ackTimeoutMs?: number;
    };
    /**
     * Liveness watchdog. After `timeoutMs` with no inbound frame the client asks
     * the far end a direct question and gives it `probeMs` to answer; only
     * silence to that counts as death, and the socket is then reconnected
     * (defaults 45000 and 5000; a `timeoutMs` of 0 disables the watchdog).
     */
    heartbeat?: {
        timeoutMs?: number;
        probeMs?: number;
    };
}
interface LtpEvent {
    symbol: string;
    exchange: string;
    ltp: number;
    ltq?: number;
    /** Cumulative day volume (Quote mode) — feeds the candle builder's day-delta mode. */
    volume?: number;
    timeSec: number;
}
/**
 * Real-time order lifecycle event from the `subscribe_orders` stream — fills,
 * partial fills, rejections, cancellations, pushed by the broker (or by the
 * sandbox engine in analyze mode).
 */
interface OrderUpdateEvent {
    orderId: string;
    symbol: string;
    exchange: string;
    action: 'BUY' | 'SELL';
    quantity: number;
    price: number;
    /** Undefined when the broker reports 0 (plain LIMIT/MARKET). */
    triggerPrice?: number;
    pricetype: string;
    product: string;
    /** Lowercase OpenAlgo status: open | trigger pending | complete | rejected | cancelled | ... */
    status: string;
    filledQuantity: number;
    pendingQuantity: number;
    averagePrice: number;
    /** Broker RMS/OMS text when rejected. */
    rejectionReason: string;
    /** 'live' for broker events, 'analyze' for sandbox events. */
    mode: string;
}
/**
 * Pure: build a subscribe message — `{ action, symbol, exchange, mode }`, where
 * `mode` is the numeric OpenAlgo data mode. Depth subscriptions may request a
 * book depth (broker-dependent: 5/20/30/50).
 *
 * The wire key the proxy reads is `depth`; 1.x sent `depth_level`, which the
 * proxy never read, so every request above the default was silently served
 * at five levels. Both keys go out: `depth` for the proxy, `depth_level` for
 * any consumer that learned the old name from this library.
 */
declare function formatSubscribe(mode: WsMode, symbol: string, exchange: string, depthLevel?: number): string;
declare function formatUnsubscribe(mode: WsMode, symbol: string, exchange: string): string;
/**
 * Pure: split the documented `SYMBOL.EXCHANGE` topic.
 *
 * Only that two-part form is accepted. Guessing at other separators would
 * misattribute a tick to the wrong instrument, and a wrong price on the right
 * chart is worse than no price at all.
 */
declare function parseTopic(topic: unknown): {
    symbol: string;
    exchange: string;
} | null;
/**
 * Pure: classify the server's answer to the handshake — 'ok', 'failed', or
 * null for a frame that is not about authentication at all.
 *
 * Absence of an error is never an acknowledgement, so 'ok' is only ever
 * returned for a frame that says so. An error frame counts as a refusal
 * because the handshake is the only thing outstanding when it arrives, and it
 * is recognised by `status: 'error'` as well as by `type: 'error'`: OpenAlgo's
 * proxy answers a bad key with `{ status:'error', code, message }` and no type
 * at all, so keying only on the type left the one refusal that matters
 * unclassified and retried on a timer until the key got rate limited.
 */
declare function classifyAuthAck(raw: unknown): 'ok' | 'failed' | null;
/**
 * Pure: the per-topic sequence number on an inbound frame, when the server
 * sends one.
 *
 * OpenAlgo's documented market_data frame carries no sequence, so the gap
 * detection built on this is inert against a stock proxy, and that is
 * deliberate: a client cannot see a silent drop on an unsequenced stream, and
 * claiming gap detection the wire does not support would be a lie in the UI.
 * A proxy that does number its frames gets the warnings for free.
 */
declare function readSequence(raw: unknown): number | undefined;
/**
 * Full-jitter backoff: attempt n waits somewhere in [ceiling/2, ceiling).
 *
 * Deterministic backoff has every client in a fleet reconnecting in the same
 * millisecond after a proxy restart, which knocks the recovering server back
 * down. `random` is a parameter so a test gets an exact number.
 */
declare function backoffDelayMs(attempt: number, opts: {
    baseDelayMs: number;
    maxDelayMs: number;
    jitter?: boolean;
}, random?: () => number): number;
/**
 * Pure: classify + normalise an inbound message into an LTP or Depth event.
 * Payload fields live under `data` per the protocol, but the parser also
 * tolerates a flat shape for resilience across broker adapters.
 *
 * The proxy puts identity on the envelope. Existing nested broker identity
 * takes precedence, with `topic` retained as the final fallback.
 */
declare function parseMessage(raw: unknown): {
    kind: 'ltp';
    event: LtpEvent;
} | {
    kind: 'depth';
    symbol: string;
    exchange: string;
    depth: MarketDepth;
} | null;
declare class OpenAlgoWsFeed {
    private readonly _config;
    private readonly _factory;
    private _sock;
    private _phase;
    /**
     * Guards every socket callback. A socket we have abandoned keeps its handlers
     * (a host may still hold the reference and fire them) but a stale one must
     * not schedule a second reconnect for an event we already handled.
     */
    private _epoch;
    private readonly _ltpCbs;
    private readonly _depthCbs;
    private readonly _stateCbs;
    private readonly _controlCbs;
    private readonly _orderCbs;
    private _ordersSubscribed;
    /**
     * Desired subscription state, keyed by mode:symbol:exchange, replayed in full
     * once each connection authenticates. This replaces the old frame queue on
     * purpose: a queue can hold two frames for one key (one queued, one replayed)
     * and grows without bound during a long outage, while desired state is
     * inherently deduplicated and bounded by the number of subscriptions.
     */
    private readonly _subs;
    /** Last sequence seen per topic. Only ever populated by a server that numbers frames. */
    private readonly _seq;
    private _userClosed;
    /** The server refused the key. Retrying that on a timer gets it blocked, so we do not. */
    private _fatal;
    private _everAuthed;
    private _attempts;
    private _reconnectTimer;
    private _authTimer;
    private _liveTimer;
    private readonly _rc;
    private readonly _auth;
    private readonly _hbTimeoutMs;
    private readonly _hbProbeMs;
    constructor(config: OpenAlgoWsConfig);
    /**
     * Open the socket. Also the deliberate way back from a refused key or an
     * earlier `close()`: both are user-intent states, and only user intent clears
     * them (design §5.2, FATAL -> CONNECTING on an explicit connect).
     */
    connect(): void;
    /** True once the handshake is acknowledged: the only time data frames go out. */
    isReady(): boolean;
    private _openSocket;
    /** Subscribe to socket lifecycle (connecting / open / closed / error). */
    onState(cb: (state: WsState) => void): () => void;
    /** Subscribe to control frames — auth / subscribe acks, server errors, client warnings. */
    onControl(cb: (msg: WsControlMessage) => void): () => void;
    private _emitState;
    private _emitControl;
    private _warn;
    /** A timer that never holds a Node event loop open. `unref` is absent in browsers. */
    private _later;
    /**
     * Transport open. Send the handshake and nothing else: the subscription
     * replay waits for the acknowledgement, because a proxy that discards
     * pre-auth frames would swallow it and leave the chart silent.
     */
    private _onOpen;
    private _onAuthenticated;
    private _onAuthFailed;
    /** A failure we detected ourselves: drop the socket and back off as if it had closed. */
    private _failConnection;
    private _onClose;
    /** Schedule a reconnect with jittered exponential backoff unless the user closed us. */
    private _maybeReconnect;
    /**
     * Send a data frame, or hold it back until the handshake is answered.
     *
     * Held frames are not queued: the caller's intent is already recorded in
     * `_subs` / `_ordersSubscribed`, and that is what gets replayed.
     */
    private _sendGated;
    /**
     * Restart the liveness watchdog. A TCP connection routinely stays open after
     * the far end is gone and `onclose` may never fire; left alone that shows a
     * connected badge over a frozen price. Any inbound frame counts, including a
     * ping or a control ack.
     */
    private _armLiveness;
    /**
     * Silence is not death, so ask before concluding one.
     *
     * OpenAlgo's proxy keeps the connection alive with protocol-level WebSocket
     * pings, which a browser answers itself and never surfaces to JavaScript, and
     * it broadcasts nothing else on a schedule. A quiet symbol out of hours
     * therefore produces no inbound frame at all, and a bare timeout would hang
     * up on a perfectly healthy socket and resubscribe every `timeoutMs` all
     * night. The proxy answers `{ action:'ping' }` with a pong, and a build that
     * does not know the action answers an error, which proves the far end is
     * there just as well: any reply at all rearms the watchdog through
     * `_dispatch`. Only silence to a direct question is death.
     */
    private _probeLiveness;
    private _clearTimer;
    /** Abandon the current socket: stale callbacks are disarmed by the epoch bump. */
    private _dropSocket;
    onLtp(cb: (e: LtpEvent) => void): () => void;
    onDepth(cb: (symbol: string, exchange: string, depth: MarketDepth) => void): () => void;
    subscribe(mode: WsMode, symbol: string, exchange: string, depthLevel?: number): void;
    unsubscribe(mode: WsMode, symbol: string, exchange: string): void;
    /** Subscribe to real-time order updates (fills / cancels / rejections). Account-level; replayed on reconnect. */
    onOrderUpdate(cb: (e: OrderUpdateEvent) => void): () => void;
    subscribeOrders(): void;
    unsubscribeOrders(): void;
    /**
     * Close intentionally. The instance is reusable afterwards: `connect()` opens
     * a fresh session.
     *
     * Bookkeeping is cleared with the socket because after this call nothing is
     * subscribed, and state that says otherwise is a lie a later reconnect would
     * act on. Event callbacks survive: the caller holds their unsubscribe
     * functions and never asked to drop them.
     */
    close(): void;
    /**
     * Gap check for a numbered stream. Returns false for a duplicate, which is
     * normal right after a resubscribe. Inert when the server sends no sequence,
     * which is the documented OpenAlgo case.
     */
    private _sequenceOk;
    private _dispatch;
}

interface PriceBand {
    lower: number;
    upper: number;
}
interface OrderConstraints {
    tickSize: number;
    priceBand?: PriceBand;
    /** Max quantity per single order (exchange freeze limit). */
    freezeQty?: number;
    /**
     * Contract lot size. When set, quantity must be a whole multiple of it: 100 on
     * a 75-lot future is rejected here rather than by the exchange.
     */
    lotSize?: number;
    /**
     * Set true only for a venue that genuinely trades fractions, such as crypto.
     * Absent means whole quantities, which is every Indian equity and F&O contract
     * and the reason fractional quantities are rejected by default: a fractional
     * quantity reaching those brokers is a defect, not a preference. A `lotSize`
     * grid still applies when this is true.
     */
    allowFractionalQty?: boolean;
}

/**
 * Trade-layer data model (ARCHITECTURE.md §9). Broker-agnostic shapes the
 * TradeFeed produces; the chart depends only on these, not on OpenAlgo's REST.
 */
type OrderSide = 'BUY' | 'SELL';
type OrderType = 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
/** Lifecycle states (§9.5). Phase 8 reconciles read-only; Phase 9 drives writes. */
type OrderStatus = 'pending' | 'working' | 'partial' | 'filled' | 'cancelled' | 'rejected';
type OrderRole = 'entry' | 'sl' | 'tp';
interface Order {
    id: string;
    symbol: string;
    side: OrderSide;
    type: OrderType;
    qty: number;
    filledQty: number;
    price: number;
    triggerPrice?: number;
    status: OrderStatus;
    /** Links SL/TP child orders to their position/entry. */
    parentId?: string;
    role?: OrderRole;
}
interface Position {
    symbol: string;
    /** Net signed quantity: positive = long, negative = short, 0 = flat. */
    netQty: number;
    avgPrice: number;
}

/**
 * Order engine (ARCHITECTURE.md §9.5): the chart-trading write path. Drives the
 * order state machine with: client-token idempotency, an arm/confirm gate,
 * pre-trade validation, rate-limited drag-modify, OCO linking, and analyzer
 * (sandbox) mode. Network-agnostic: it talks to an injected OrderFeed (the
 * FakeBroker simulates it in tests/demos).
 *
 * Two lifecycles are tracked per order and they are deliberately not merged:
 *
 *   state         the historical `ClientOrderState`. Existing consumers read it
 *                 and its meaning is unchanged, including the parts that are
 *                 optimistic (a resolved place() reads `working`).
 *   intent        what THIS client actually knows: submitted, ambiguous,
 *                 acknowledged, settled. A transport result never reaches past
 *                 SUBMITTED.
 *   brokerStatus  what the BROKER said. Undefined until an authoritative event
 *                 arrives, and written by nothing else.
 *
 * A resolved promise is not an order: it says the request left and an answer
 * came back, not that the exchange has anything. The v2 broker contract replaces
 * `state` outright with the two-field `OrderRow`; removing it here would break
 * every consumer of `ClientOrderState`, so the honest fields are added alongside
 * and the merge is deferred to v2.
 */

interface PlaceRequest {
    symbol: string;
    exchange?: string;
    side: OrderSide;
    type: OrderType;
    qty: number;
    price?: number;
    triggerPrice?: number;
    /** Product: CNC (delivery), NRML (F&O carry), MIS (intraday). Required by OpenAlgo. */
    product?: 'CNC' | 'NRML' | 'MIS';
    /** Idempotency token; a retry with the same token is never double-sent. */
    clientToken?: string;
}
/** Fields a modify may change. Whole-order feeds fill the rest from their cache. */
interface ModifyPatch {
    price?: number;
    triggerPrice?: number;
    qty?: number;
}
/**
 * The minimal broker write interface the `OrderEngine` drives: place / modify /
 * cancel. `OpenAlgoTradeFeed` implements this. Distinct from the base-tier
 * `TradeFeed` (a higher-level place + subscribe shape in `openalgo-charts`):
 * implement `OrderFeed` for the engine's write path.
 */
interface OrderFeed {
    place(req: PlaceRequest & {
        mode: TradeMode;
    }): Promise<{
        orderId: string;
    }>;
    modify(orderId: string, patch: ModifyPatch): Promise<void>;
    cancel(orderId: string): Promise<void>;
}
type TradeMode = 'live' | 'analyzer';

/**
 * OpenAlgo trade adapter (ARCHITECTURE.md §10.0). Implements the order engine's
 * OrderFeed over OpenAlgo REST (`/api/v1/placeorder`, `/modifyorder`,
 * `/cancelorder`) plus orderbook/positionbook fetches for reconciliation.
 *
 * Payloads match the local OpenAlgo docs: `placeorder` requires
 * strategy/symbol/action/exchange/pricetype/product/quantity; `modifyorder`
 * additionally requires the full order context, so we cache each order's context
 * (from place + the order book) and merge the patch on modify. Book responses
 * return string quantities/prices, which are decoded to numbers. Fetch is
 * injectable for offline tests; verify field names against your OpenAlgo build.
 *
 * Two guarantees live HERE rather than in `OrderEngine`, because the largest
 * consumer drives this class directly and never constructs the engine:
 *
 * - **Reading the book fails closed.** An unmappable enum or an unreadable
 *   number never becomes a tradable order. See `decodeOrder`.
 * - **The analyzer/live mode is checked, not claimed.** See `getServerMode`.
 */

/** How hard `place` checks the server's mode against the caller's. */
type ModeCheck = 'off' | 'auto' | 'always';
interface OpenAlgoTradeConfig {
    baseUrl: string;
    apiKey: string;
    /**
     * Instrument constraints for the advisory pre-trade check on `place`, looked
     * up per order. Return undefined when the instrument is unknown; the
     * universal checks below still apply.
     *
     * Optional because most of the value needs no configuration: a quantity that
     * is NaN, negative or fractional is wrong for every Indian instrument and is
     * rejected without knowing anything about the symbol. Supply this to add the
     * freeze limit and the lot grid, which do need instrument data.
     */
    constraints?: (symbol: string, exchange: string) => OrderConstraints | undefined;
    /**
     * Turn off the feed-level duplicate guard. Default false, i.e. the guard is
     * on. Only set true if a layer above already owns idempotency AND you have
     * read why that is usually the wrong call: see `_claimToken`.
     */
    disableIdempotency?: boolean;
    /** Strategy label sent with orders (OpenAlgo groups by strategy). */
    strategy?: string;
    /** Default product when a request doesn't specify one. */
    defaultProduct?: 'CNC' | 'NRML' | 'MIS';
    fetchImpl?: typeof fetch;
    /**
     * Mode guard on `place`. Default `'auto'`, which is described in full on
     * `_assertMode`. `'always'` checks both directions and refuses when the
     * server cannot be asked; `'off'` restores the pre-1.6 behaviour of trusting
     * the caller's `mode` outright.
     */
    verifyMode?: ModeCheck;
    /** How long a server-mode reading stays usable, in ms. Default 5000. */
    modeCacheMs?: number;
    /**
     * Called after an order book fetch that had to quarantine rows. Fail-closed
     * parsing drops nothing silently: a host that shows the book must be able to
     * tell the trader that part of it could not be read.
     */
    onDecodeIssue?: (snapshot: OrderBookSnapshot) => void;
    /** Clock, injectable so the mode cache is testable without real timers. */
    now?: () => number;
}
declare class OpenAlgoTradeFeed implements OrderFeed {
    private readonly _config;
    private readonly _fetch;
    private readonly _strategy;
    private readonly _defaultProduct;
    private readonly _ctx;
    /**
     * Client order ids this feed has put on the wire, and whether the outcome is
     * known. A claimed-but-unresolved entry blocks a repeat. See `_claimToken`.
     */
    private readonly _claimed;
    private readonly _verifyMode;
    private readonly _modeCacheMs;
    private readonly _now;
    private _mode?;
    private _modeAt;
    constructor(config: OpenAlgoTradeConfig);
    private _post;
    /**
     * Read the analyzer mode the SERVER is in.
     *
     * Analyzer mode is a server-side global in OpenAlgo: `get_analyze_mode()`
     * decides where every order goes, and it is flipped at
     * `POST /api/v1/analyzer/toggle`. It is not a per-order flag, there is no
     * mode field on the placeorder payload, and one added there would be read by
     * nothing. So this client never asserts a mode. It asks for the server's,
     * and `place` refuses when the answer disagrees with the caller's belief.
     *
     * Answers younger than `maxAgeMs` are reused, so a host that polls the books
     * (whose sandbox responses carry the mode already) never pays for this call.
     */
    getServerMode(maxAgeMs?: number): Promise<TradeMode>;
    /** The last server-mode reading, if one is still within `maxAgeMs`. */
    serverMode(maxAgeMs?: number): TradeMode | undefined;
    private _freshMode;
    /**
     * Refuse to send when the server's mode contradicts the caller's.
     *
     * The default is asymmetric because the two mistakes do not cost the same.
     * Believing you are on the sandbox while the server is live spends real
     * money, so `analyzer` demands a positive answer and probes for one when the
     * cache is cold. Believing you are live while the server is sandboxed is bad
     * but costs nothing, so `live` uses only what the cache already knows and
     * never adds a round trip to a real order. `verifyMode: 'always'` probes in
     * both directions.
     *
     * A caller that passes no mode at all is not checked: it has claimed nothing,
     * so there is nothing to contradict.
     */
    private _assertMode;
    /**
     * Advisory pre-trade quantity check, applied to EVERY order type.
     *
     * Advisory is the operative word: a user with devtools can call the broker
     * directly, so this cannot be a risk control. It is here because the broker's
     * RMS rejection arrives after a round trip and reads like a server error,
     * while this reads like the mistake it is, immediately.
     *
     * It lives in the feed rather than only in `OrderEngine` because the engine is
     * skippable. OpenAlgo's own terminal calls `place` directly and never
     * constructs an engine, so a guarantee reachable only through the engine is
     * not a guarantee for the largest consumer of this library.
     */
    private _assertQuantity;
    /**
     * Refuse a client order id this feed has already put on the wire.
     *
     * The costs are not symmetric, which is the whole argument. Holding a claim
     * too long costs one deliberate click after a banner. Releasing it too early
     * costs a doubled live position that nobody asked for, discovered later, quite
     * possibly on a leveraged intraday product.
     *
     * So a claim is released ONLY when the request provably never left. A non-ok
     * HTTP response, a timeout, an aborted socket: all of those mean the response
     * did not arrive, and say nothing whatsoever about whether the order did. Those
     * stay claimed and are reported as ambiguous.
     *
     * Enforcement note, because the boundary matters: this stops THIS FEED sending
     * the same id twice. It cannot make the broker deduplicate. Two browser tabs
     * are two feeds and two ledgers, and OpenAlgo's placeorder carries no client
     * order id field, so end-to-end idempotency is not available on this wire.
     * What is available, and what this delivers, is that a double-clicked button
     * or a retried promise does not become two orders.
     */
    private _claimToken;
    place(req: PlaceRequest & {
        mode: TradeMode;
    }): Promise<{
        orderId: string;
    }>;
    /**
     * Whether a client order id is known to have reached the broker.
     *
     * `'ambiguous'` is the one worth handling: the request left and the outcome is
     * unknown, so the order may be live. A host should say so and offer the order
     * book, not a retry button.
     */
    tokenState(token: string): 'unknown' | 'inflight' | 'sent' | 'ambiguous';
    /**
     * Release a claim after the host has established what really happened, for
     * instance by finding no such order in a freshly fetched book.
     *
     * Deliberately manual. Nothing in this library can safely decide on its own
     * that an ambiguous order did not reach the exchange.
     */
    releaseToken(token: string): void;
    modify(orderId: string, patch: {
        price?: number;
        triggerPrice?: number;
        qty?: number;
    }): Promise<void>;
    cancel(orderId: string): Promise<void>;
    /**
     * Fetch the order book, keeping the rows that could not be read.
     *
     * `getOrders` returns the first half of this. A host that renders the book
     * needs the second half too: "2 rows from the broker could not be read" is a
     * thing the trader must see, and a quietly shorter list is not.
     */
    getOrderBook(): Promise<OrderBookSnapshot>;
    /** Fetch the order book for reconciliation (maps to broker-agnostic orders). */
    getOrders(): Promise<DecodedOrder[]>;
    /** Fetch the position book for reconciliation. */
    getPositions(): Promise<Position[]>;
}
interface RawOrder {
    orderid?: string;
    symbol?: string;
    exchange?: string;
    action?: string;
    pricetype?: string;
    product?: string;
    quantity?: number | string;
    filled_quantity?: number | string;
    price?: number | string;
    trigger_price?: number | string;
    order_status?: string;
}
interface RawPosition {
    symbol?: string;
    quantity?: number | string;
    average_price?: number | string;
}
type OrderDecodeCode = 'MISSING' | 'NON_FINITE' | 'RANGE' | 'UNKNOWN_ENUM';
interface OrderDecodeIssue {
    /** Where it went wrong, e.g. `orders[3].action`. */
    path: string;
    code: OrderDecodeCode;
    /** What a readable value looks like, in words the trader can act on. */
    expected: string;
    /** The offending value, stringified and clipped. Never the whole payload. */
    got: string;
}
/** A book row that had no honest order form, kept for diagnosis. */
interface QuarantinedRow {
    issue: OrderDecodeIssue;
    raw: RawOrder;
}
interface OrderBookSnapshot {
    /** Rows that decoded, including any whose status is `unknown`. */
    orders: DecodedOrder[];
    quarantined: QuarantinedRow[];
}
/**
 * An order read from the book.
 *
 * Identical to `Order` except that `status` may be `unknown`: a broker status
 * this adapter cannot map is reported as unknown rather than asserted to be
 * working. Unknown is not terminal, so a later snapshot can still rescue the
 * row, and every consumer that gates on `status === 'working'` treats it as
 * untradable, which is the point.
 *
 * The member is widened here rather than in `OrderStatus` because widening the
 * shared union is a change to `src/trade/types.ts`, deferred to the v2 contract
 * work that owns that file.
 */
interface DecodedOrder extends Omit<Order, 'status'> {
    status: OrderStatus | 'unknown';
    /** The broker's own status text, kept verbatim whenever `status` is unknown. */
    rawStatus?: string;
}
type OrderDecodeResult = {
    ok: true;
    order: DecodedOrder;
} | {
    ok: false;
    issue: OrderDecodeIssue;
};
/**
 * Map a lowercase OpenAlgo order_status to the chart's status.
 *
 * An unrecognised status reads `unknown`. It used to read `working`, which
 * asserted that an order nobody could classify was live in the book and
 * draggable on the chart. OpenAlgo's own broker mappings emit the literal
 * string `unknown` when a broker sends a state they do not recognise, so this
 * default was reachable in production, not only from a malformed payload.
 */
declare function mapOrderStatus(s: string): OrderStatus | 'unknown';
/**
 * Decode one order book row, failing closed.
 *
 * The split follows what the field is for. Identity-bearing fields (id, symbol,
 * side, order type, quantity, prices) either read cleanly or the row is
 * quarantined: there is no substitute value that is safe to trade against, and
 * the old `action === 'SELL' ? 'SELL' : 'BUY'` turned a typo, a null and an
 * unrecognised broker enum alike into a BUY.
 *
 * Status is descriptive, so an unmappable one degrades to `unknown` and the row
 * is KEPT. Hiding an order that exists is worse than showing one nobody can
 * classify, which is the opposite trade-off from the identity fields and is
 * deliberate.
 */
declare function decodeOrder(r: RawOrder, path?: string): OrderDecodeResult;
/**
 * Total row mapper, kept for the published surface.
 *
 * Prefer `decodeOrder`, which says WHY a row could not be read instead of
 * handing back a placeholder. A row that fails an identity check has no honest
 * `Order` form, because `OrderSide` has no unknown member and so the
 * placeholder cannot say "side unreadable". It marks the whole record instead,
 * with `status: 'unknown'`, which is inert in every consumer: they all gate on
 * `status === 'working'` before drawing or acting on a row. The broker's own
 * word is passed through rather than replaced, because showing `FOO` is honest
 * and showing `BUY` is exactly the fail-open this replaced.
 *
 * `getOrders` does not use this: it quarantines such rows outright.
 */
declare function mapOrder(r: RawOrder): DecodedOrder;
declare function mapPosition(r: RawPosition): Position;

/**
 * Composed OpenAlgo live data feed (resolves audit V2-M1). Implements the full
 * `DataFeed` contract by combining history (REST), live ticks (WS), and a
 * per-subscription aggregator, so `subscribeBars()` actually delivers live
 * interval bars instead of being a no-op trap.
 */

interface OpenAlgoLiveConfig extends OpenAlgoConfig {
    /** WS proxy URL, e.g. ws://127.0.0.1:8765. */
    wsUrl: string;
    /**
     * Volume accounting for the live candle builder (default 'ltq-sum').
     *
     * 'day-delta' also selects the wire mode: a cumulative day volume only exists
     * on the Quote stream, so this feed subscribes Quote rather than LTP for it.
     */
    volumeMode?: VolumeMode;
    /**
     * Zone calendar intervals bucket in (default IST). Should be the chart's
     * configured timezone: a monthly bar opens at local midnight on the first,
     * and that instant differs by exchange.
     */
    timezone?: string;
    /**
     * Default book depth for `subscribeDepth`, broker-dependent (5/20/30/50).
     * Omitted leaves it to the broker, which is what this feed always did.
     * A per-call `opts.depthLevel` overrides it.
     */
    depthLevel?: number;
    /** Inject a custom socket (tests, React Native, non-browser runtimes). */
    socketFactory?: SocketFactory;
    /**
     * Socket policy, passed straight to `OpenAlgoWsFeed`. Present because the
     * handshake gate, the liveness watchdog and the backoff all have escape
     * hatches that were otherwise unreachable through this composed feed: a proxy
     * build that answers nothing needs `auth: { requireAck: false }`, and a host
     * with no way to say so would just see a chart that never receives a tick.
     */
    reconnect?: OpenAlgoWsConfig['reconnect'];
    auth?: OpenAlgoWsConfig['auth'];
    heartbeat?: OpenAlgoWsConfig['heartbeat'];
}
/**
 * Seconds per bar for a fixed-length interval code, e.g. `D` -> 86400,
 * `1m` -> 60, `1h` -> 3600.
 *
 * Throws `UnknownIntervalError` for a code nothing recognises, and a plain
 * error for a calendar or count-driven code, which has no seconds to give.
 * It used to answer 60 for both, which drew minute bars under whatever label
 * the caller thought it had asked for.
 *
 * Prefer `resolveInterval()` and `bucketStartOf()`: they cover every registered
 * code, not just the ones that happen to have a fixed length.
 */
declare function intervalToSeconds(interval: string): number;
declare class OpenAlgoLiveDataFeed implements DataFeed {
    private readonly _rest;
    private readonly _ws;
    private readonly _volumeMode;
    private readonly _timezone;
    private readonly _depthLevel;
    /** Wire mode ticks arrive on, decided once by `volumeMode`. */
    private readonly _tickMode;
    /** Reference counts per `mode:symbol:exchange`, so one consumer leaving cannot cut the rest off. */
    private readonly _subs;
    constructor(config: OpenAlgoLiveConfig);
    /**
     * Take a share in the remote subscription for this stream, subscribing only
     * if nobody held one, and hand back a release that unsubscribes remotely only
     * when the last holder lets go.
     *
     * Depth is negotiated upward: a consumer needing 20 levels re-subscribes
     * at 20 rather than living with the 5 an earlier one asked for. It is never
     * negotiated back down while consumers remain, because shrinking a book under
     * a consumer that is still reading it is the failure this method exists to
     * prevent, and the extra levels cost only bandwidth. The high-water mark is
     * per entry, so it resets when the last holder leaves.
     */
    private _acquire;
    getBars(req: BarsRequest): Promise<Bar[]>;
    /**
     * Live bars: WS tick -> aggregator -> onBar (mutated/append bar). The tick
     * stream is LTP, or Quote when `volumeMode` is 'day-delta' and the bar
     * therefore needs a cumulative day volume.
     *
     * Fixed intervals go through `CandleBuilder`, which carries the late-tick
     * policy; calendar, tick-count and volume intervals go through
     * `TickBarAggregator`, which is the one that knows those boundaries.
     *
     * Pass `opts.seedFrom` (the last history bar) to continue that bar's bucket
     * seamlessly instead of starting a fresh one, and `opts.cumDayVolumeSoFar` so
     * a `day-delta` builder diffs against the right baseline. Seeding applies to
     * time-bucketed intervals: a count-driven bar cannot resume a historical one.
     */
    subscribeBars(req: BarsRequest, onBar: (bar: Bar, meta?: LiveBarMeta) => void, opts?: BarSubscriptionOptions): UnsubscribeFn;
    /** A broker may omit the tick timestamp; never bucket at the epoch, use now. */
    private static _tickTime;
    private _candleReader;
    private _aggregatorReader;
    /**
     * Live book. `opts.depthLevel` requests a book depth (broker-dependent:
     * 5/20/30/50), falling back to the feed's configured default and then to
     * whatever the broker sends unasked, which is what this method always did.
     * The socket has accepted a depth level all along; only the composed feed had
     * no way to name one.
     */
    subscribeDepth(req: BarsRequest, onDepth: (depth: MarketDepth) => void, opts?: {
        depthLevel?: number;
    }): UnsubscribeFn;
    close(): void;
}

/** Schedules a repeating callback and returns an unsubscribe. Inject in tests. */
type FeedScheduler = (cb: () => void, intervalMs: number) => UnsubscribeFn;
/**
 * Deterministic, in-memory data feed for tests and demos. No network.
 * Generates a reproducible synthetic OHLC walk from a fixed seed so that
 * pixel-diff and unit tests are stable across runs (no Math.random / Date.now).
 */
declare class FakeDataFeed implements DataFeed {
    private readonly intervalSec;
    private readonly _schedule;
    constructor(intervalSec?: number, scheduler?: FeedScheduler);
    getBars(req: BarsRequest): Promise<Bar[]>;
    /**
     * Emit deterministic synthetic bars on the scheduler (default: a 1s
     * setInterval). This actually streams, so feature detection
     * (`if (feed.subscribeBars)`) is honest. Pass a manual scheduler to drive it
     * by hand in tests, and `opts.tickMs` to change the cadence.
     */
    subscribeBars(req: BarsRequest, onBar: (bar: Bar) => void, opts?: BarSubscriptionOptions & {
        tickMs?: number;
    }): UnsubscribeFn;
}
/** Pure, seeded synthetic bar generator (deterministic — no global randomness). */
declare function generateBars(startTime: number, count: number, intervalSec: number): Bar[];

/** Fixed-length bars: `seconds` each, aligned to `anchorSec` (default epoch). */
interface IntervalBucketing {
    mode: 'interval';
    seconds: number;
    anchorSec?: number;
}
/** A bar closes after `count` trades. */
interface TickCountBucketing {
    mode: 'ticks';
    count: number;
}
/** A bar closes after `perBar` traded quantity. */
interface VolumeBucketing {
    mode: 'volume';
    perBar: number;
}
/** Calendar periods, which are not a fixed number of seconds. */
type CalendarUnit = 'month' | 'quarter' | 'year';
/**
 * A bar spans `count` calendar units, opening at local midnight on the first
 * day of the period in `timezone`.
 *
 * `timezone` on the entry pins the code to one exchange's calendar; leaving it
 * off lets the bucket follow whatever zone the caller resolves in, which is the
 * chart's configured zone.
 */
interface CalendarBucketing {
    mode: 'calendar';
    unit: CalendarUnit;
    /** Periods per bar (default 1): `{ unit: 'month', count: 6 }` is a half-year. */
    count?: number;
    timezone?: string;
}
/** Every way this engine knows how to close a bar. */
type Bucketing = IntervalBucketing | TickCountBucketing | VolumeBucketing | CalendarBucketing;
/**
 * The three time-agnostic modes `TickBarAggregator` shipped with. Kept as a
 * distinct name because `FootprintAggregator` handles exactly these three.
 */
type TickTimeframe = IntervalBucketing | TickCountBucketing | VolumeBucketing;
/** A registered interval code and the rule that buckets it. */
interface IntervalDescriptor {
    /** The code a host passes as `BarsRequest.interval`, e.g. `5m`, `MN`, `T500`. */
    code: string;
    bucketing: Bucketing;
}
/** Thrown when a code matches neither a registered entry nor a built-in token. */
declare class UnknownIntervalError extends Error {
    readonly code: string;
    constructor(code: string);
}
/**
 * Register an interval code. Returns a disposer, so a host that adds codes for
 * one instrument can take them away again.
 *
 * A registered code shadows a built-in token of the same name: a host whose
 * `W` means "calendar week in the exchange's zone" rather than "604800 seconds
 * from the epoch" is entitled to say so.
 */
declare function registerInterval(descriptor: IntervalDescriptor): () => void;
/** Remove a registered code. Returns false if nothing was registered under it. */
declare function unregisterInterval(code: string): boolean;
/** Every registered code, in registration order. Built-in tokens are not listed. */
declare function registeredIntervals(): readonly IntervalDescriptor[];
/** Resolve a code, or null when nothing recognises it. */
declare function tryResolveInterval(code: string): IntervalDescriptor | null;
/** True when `code` resolves. For a host validating an interval picker's input. */
declare function isKnownInterval(code: string): boolean;
/**
 * Resolve a code, throwing `UnknownIntervalError` if nothing recognises it.
 *
 * Loud on purpose. The previous behaviour was a silent fall back to 60 seconds,
 * so a typo drew minute bars under a label claiming something else, and nothing
 * anywhere said so. A chart that refuses to open is a bug report; a chart
 * showing the wrong timeframe is a wrong trade.
 */
declare function resolveInterval(code: string): IntervalDescriptor;
/** True when bars close on the clock or the calendar rather than on trade flow. */
declare function isTimeBucketed(b: Bucketing): boolean;
/**
 * UTC seconds at which the bar containing `timeSec` opened.
 *
 * `zone` is the fallback for calendar buckets that did not pin their own, and
 * should be the chart's configured timezone. Count-driven bars have no time
 * bucket at all, so their bar simply opens at the tick that started it.
 */
declare function bucketStartOf(b: Bucketing, timeSec: number, zone?: string): number;
/**
 * UTC seconds at which the next bar opens, or null for count-driven bars, whose
 * close depends on trade flow rather than on the clock.
 *
 * The gap between this and `bucketStartOf` is the bar's real length: 28, 29, 30
 * or 31 days for a month, and an hour short of that across a spring forward.
 */
declare function nextBucketStart(b: Bucketing, timeSec: number, zone?: string): number | null;
/**
 * How a bar's length reads to a human: a count, and the unit it counts.
 *
 * `M` is months, so a quarter reads as 3 and a year as 12, keeping the token
 * grammar's rule that lower-case `m` is minutes and upper-case `M` is a month.
 * `tick` counts trades. `other` is a bucket with neither a clock length nor a
 * trade count, which today means volume, and is where a later count-driven
 * mode can land without silently changing what an existing unit means.
 */
interface IntervalParts {
    multiplier: number;
    unit: 's' | 'm' | 'h' | 'D' | 'W' | 'M' | 'tick' | 'other';
}
/**
 * Split a code into a count and a unit, or null when nothing recognises it.
 * For an indicator that knows its own interval and wants to reason about it,
 * rather than hard-coding the handful of codes its author happened to test on.
 *
 * Read off the bucketing rule, not off the code's spelling, so it answers for
 * a registered code the built-in grammar never parsed, and it answers
 * canonically: `120m` and `2h` are the same bar and both read as 2 h. The
 * coarsest unit that divides the length wins, which is also why a 90-second
 * bar reads as 90 s rather than as one and a half minutes.
 */
declare function intervalParts(code: string): IntervalParts | null;
/**
 * True when the bar is not a whole number of minutes long, so its labels need
 * second precision. `1s`, `15s` and `90s` all qualify; `5m` does not.
 */
declare function isSecondsInterval(code: string): boolean;
/**
 * True for a fixed-length bar shorter than a day: the ones that want a session
 * reset, such as a VWAP anchored to the day's open or an opening range.
 *
 * A calendar period is false because it is coarser, and a count-driven bar is
 * false because it has no clock length to compare, not because it is known to
 * be long. Ask `isTickInterval` or `intervalParts` for those.
 */
declare function isIntradayInterval(code: string): boolean;
/**
 * True for a bar exactly one day long, whether spelled `D`, `24h` or `1440m`.
 *
 * Deliberately not "daily or coarser": weekly and monthly answer false, so a
 * caller can branch on intraday, daily and coarser as three independent
 * questions instead of an ordered ladder where the wrong order swallows a case.
 */
declare function isDailyInterval(code: string): boolean;
/**
 * True for a bar that closes after N trades. Volume bars close on quantity, not
 * on trade count, so they answer false; `intervalParts` separates the two.
 */
declare function isTickInterval(code: string): boolean;

/**
 * Tick aggregation (ARCHITECTURE.md 10.2). Aggregates raw trade ticks into
 * bars on a chosen bucketing: clock interval, calendar period, tick count, or
 * traded volume. Incremental and deterministic, so it works live and is
 * unit-testable.
 *
 * This is the foundation for tick / volume timeframes and (with classified
 * bid/ask ticks) for the footprint aggregator. Tick-count and volume bars need
 * real trade ticks: OHLCV alone can't produce them.
 *
 * The bucketing rules themselves live in `./intervals`, which is also where a
 * host registers its own interval codes; this class just applies one.
 */

interface AggTick {
    time: number;
    price: number;
    qty: number;
}
interface BarUpdate {
    bar: Bar;
    isNew: boolean;
}
interface TickBarOptions {
    /**
     * Zone a calendar bucket resolves in when the bucketing did not pin its own.
     * Pass the chart's configured timezone: a month boundary is local midnight on
     * the first, and which instant that is depends on where the exchange is.
     */
    timezone?: string;
}
declare class TickBarAggregator {
    private readonly _tf;
    private readonly _zone;
    private _cur;
    private _count;
    constructor(tf: Bucketing, options?: TickBarOptions);
    current(): Bar | null;
    /**
     * Continue a historical bar instead of opening a fresh one on the first tick.
     * Time-bucketed modes only: a count-driven bar cannot be resumed, because the
     * trades that filled it were never counted here.
     */
    seed(lastBar: Bar): void;
    onTick(tick: AggTick): BarUpdate;
}

/**
 * Warm-load bar cache: a wrapper around ANY `DataFeed`, so a custom feed gets
 * the same behaviour as `OpenAlgoDataFeed`.
 *
 *     const feed = withBarCache(new OpenAlgoDataFeed(cfg), { ttlMs: 60_000 });
 *
 * The design decisions, all of which are load-bearing:
 *
 * **Key.** `symbol | exchange | interval`. The requested range is deliberately
 * NOT part of the key: one entry per series holds the widest set fetched so
 * far, and a narrower request is served by slicing it. Keying on the range
 * would miss on every pan and on every "same chart, one bar later" reload,
 * which is exactly the traffic warm-load is meant to remove.
 *
 * **Freshness.** Two independent gates, both of which must pass:
 *   1. `ttlMs` bounds absolute age.
 *   2. Nothing new can have closed. An entry is complete through `to`; the next
 *      bar closes at `to + 1 + intervalSec`, measured on the feed's own bar
 *      grid rather than on UTC midnight, so a daily Indian bar opening at 03:45
 *      UTC is judged against its own session, not against the wrong boundary.
 * The effect is what you want from a warm cache: a closed session stays usable
 * for the whole TTL, while a 1m chart is only reused inside the current minute.
 *
 * **The forming bar is never cached.** A bar whose close time is still in the
 * future keeps moving, and serving yesterday's snapshot of it to a live chart
 * is worse than not caching at all: the chart would paint a frozen candle and
 * have no way to know. So the trailing forming bar is dropped on store, and
 * coverage ends at the last CLOSED bar. A cache hit can therefore be short by
 * at most one bar, the one a live subscription re-supplies immediately, and is
 * never wrong about a bar it does return.
 *
 * **Bounds.** Capped on both entry count (`max`) and total cached bars
 * (`maxBars`), LRU-evicted. Entries alone do not bound memory (one intraday
 * series can be 100k bars); bar count is the honest proxy for bytes that can be
 * measured without serialising. Byte counting would mean stringifying every
 * entry on every write, which costs more than the cache saves.
 *
 * **Storage.** A bounded in-memory copy is always available. A host may inject
 * `storage` to persist through localStorage, IndexedDB, or another store, but
 * the engine will not choose one itself. Durable reads, writes, and deletes are
 * best effort so storage denial or quota exhaustion cannot block market data.
 * Store methods may return a promise. `CachedBars` is plain JSON so it
 * round-trips through `JSON.stringify` unchanged.
 *
 * **Opt-out.** `getBars({ ..., noCache: true })` always hits the network (and
 * refreshes the entry); `invalidate()` and `clear()` drop entries by hand.
 */

type MaybePromise<T> = T | Promise<T>;
/** One cached series. Plain JSON: safe to persist as-is. */
interface CachedBars {
    /** Persisted schema version. Missing means the compatible legacy schema. */
    version?: number;
    /** Closed bars only, ascending by time. */
    bars: Bar[];
    /** Coverage start: the `from` of the request that filled this entry. */
    from: UTCSeconds;
    /** Coverage end (inclusive): the last instant this entry is complete to. */
    to: UTCSeconds;
    /** Wall clock (ms) at store time, for TTL. */
    storedAt: number;
    /**
     * When the bar AFTER this entry's coverage closes, so freshness needs no
     * re-resolve. Null is impossible here: an entry whose bars have no knowable
     * close is never stored in the first place.
     */
    nextClose: UTCSeconds;
}
/**
 * Pluggable durable store. Sync or async operations are awaited and isolated
 * from the network result. The cache always keeps its own bounded memory copy.
 */
interface BarCacheStore {
    get(key: string): MaybePromise<CachedBars | undefined>;
    set(key: string, value: CachedBars): MaybePromise<void>;
    delete(key: string): MaybePromise<void>;
}
interface BarCacheOptions {
    /** Absolute age bound, ms. Default 5 minutes. */
    ttlMs?: number;
    /** Maximum entries before LRU eviction. Default 24. */
    max?: number;
    /** Maximum total cached bars before LRU eviction. Default 250_000. */
    maxBars?: number;
    /** Optional durable store. Bounded in-memory retention is always enabled. */
    storage?: BarCacheStore;
    /** Injectable clock (ms), for tests and for hosts with a server clock. */
    now?: () => number;
    /**
     * Interval token to seconds, for feeds with tokens this does not know
     * (tick, Renko, range bars). Return 0 to disable caching for that interval.
     */
    /**
     * Override how the cache decides when a bar closes. Return null for "unknown",
     * which makes the cache refuse to store the series rather than guess. Defaults
     * to {@link barCloseSec}, which asks the interval registry.
     */
    barCloses?: (interval: string, barStartSec: UTCSeconds) => number | null;
    /** IANA zone for calendar intervals. Defaults to the engine default. */
    timezone?: string;
}
/** A `BarsRequest` that can force a fresh fetch. */
interface CachedBarsRequest extends BarsRequest {
    /** Skip the cached entry, fetch, and replace it with the fresh result. */
    noCache?: boolean;
}
/** Counts what this instance is tracking, not what a persistent store holds. */
interface BarCacheStats {
    entries: number;
    bars: number;
    hits: number;
    misses: number;
    evictions: number;
}
/** Current persisted entry schema. Legacy entries without this field remain readable. */
declare const BAR_CACHE_VERSION = 1;
/**
 * Interval token to seconds. Case matters where it disambiguates: lowercase
 * The instant a bar starting at `barStartSec` closes, or null when that cannot
 * be known from the interval alone.
 *
 * This asks the interval registry rather than parsing the token itself. A second
 * parser here was the bug: it matched a fixed set of letter codes and returned
 * 60 seconds for anything else, so a host that registered its own code got a
 * cache that believed a new bar closed every minute. A tick-count series keyed
 * that way is served stale for up to a minute at a time, and a registered
 * calendar code was approximated at 30 days.
 *
 * Null means "no fixed close", and it is returned for three genuinely different
 * situations that all demand the same conservative answer:
 *
 *  - **tick and volume bars**, which close on trade flow. A 500-tick bar may run
 *    for a second or an hour, so nothing about elapsed time says whether the
 *    last bar is complete.
 *  - **an unregistered code.** Guessing 60 seconds is how the old parser turned
 *    a typo into a silently wrong cache.
 *
 * The caller must treat null as "cannot cache and cannot serve past coverage",
 * which is the safe direction: it refetches rather than serving something stale.
 */
declare function barCloseSec(interval: string, barStartSec: UTCSeconds, zone?: string): number | null;
declare function barCacheKey(req: BarsRequest): string;
declare class BarCache implements DataFeed {
    /** The wrapped feed, for callers that need something this wrapper does not forward. */
    readonly source: DataFeed;
    private readonly _backing;
    private readonly _memory;
    /** Keys whose durable value may still exist after a failed write or delete. */
    private readonly _tombstones;
    private readonly _writes;
    private readonly _ttlMs;
    private readonly _max;
    private readonly _maxBars;
    private readonly _now;
    private readonly _barCloses;
    private readonly _index;
    private _tick;
    private _hits;
    private _misses;
    private _evictions;
    constructor(feed: DataFeed, options?: BarCacheOptions);
    subscribeBars?: (req: BarsRequest, onBar: (bar: Bar, meta?: LiveBarMeta) => void, ...rest: unknown[]) => UnsubscribeFn;
    subscribeDepth?: (req: BarsRequest, onDepth: (depth: MarketDepth) => void, ...rest: unknown[]) => UnsubscribeFn;
    getBarsPage?: (req: BarsPageRequest) => Promise<BarsPage>;
    getBars(req: CachedBarsRequest): Promise<Bar[]>;
    /** Read any valid, TTL-retained closed overlap without initiating a source request. */
    getCachedBars(req: BarsRequest): Promise<Bar[] | undefined>;
    /**
     * Drop one series, or (with no argument) everything this cache knows of.
     * "Knows of" is literal with an injected persistent store: recency and size
     * are tracked in memory, so keys written by an earlier session are dropped
     * when they are next read and found expired, not by `clear()`. A store that
     * outlives the process is responsible for its own overall quota.
     */
    invalidate(req?: Pick<BarsRequest, 'symbol' | 'exchange' | 'interval'>): Promise<void>;
    clear(): Promise<void>;
    stats(): BarCacheStats;
    private _lookup;
    private _slice;
    private _put;
    private _drop;
    private _evict;
    private _remember;
    private _readEntry;
    private _validEntry;
    private _validBar;
    private _cloneEntry;
    private _writeBacking;
    private _deleteBacking;
    private _restoreLatestBacking;
}
/**
 * Wrap any `DataFeed` in a warm-load bar cache.
 *
 *     const feed = withBarCache(new OpenAlgoDataFeed(cfg), { ttlMs, max, storage });
 */
declare function withBarCache(feed: DataFeed, options?: BarCacheOptions): BarCache;

/**
 * Time conversions (ARCHITECTURE.md §4.0). Internal time is always UTC seconds.
 * Feed adapters convert broker formats here, at the edge:
 *   - REST history → IST date/time strings
 *   - WS feed      → epoch milliseconds
 * India observes no DST, so IST is a fixed UTC+5:30 offset.
 */
/** IST offset in seconds (UTC+5:30). */
declare const IST_OFFSET_SECONDS: number;
/** Epoch milliseconds → UTC seconds. */
declare function epochMsToUtcSeconds(ms: number): number;
/**
 * Parse an IST wall-clock date/time string to UTC seconds. Accepts
 * `YYYY-MM-DD`, `YYYY-MM-DD HH:MM[:SS]`, and the `T`-separated ISO variant.
 * Parsing is explicit (never relies on the host machine's locale/timezone).
 */
declare function istStringToUtcSeconds(input: string): number;
interface IstParts {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
    /** 0 = Sunday .. 6 = Saturday, in IST. */
    weekday: number;
}
/** UTC seconds → IST calendar parts (for axis labels / tick decisions). */
declare function utcSecondsToIstParts(utcSeconds: number): IstParts;
/** Format UTC seconds as an IST `HH:MM` clock label. */
declare function formatIstTime(utcSeconds: number): string;
/** Format UTC seconds as an IST `HH:MM:SS` clock label (sub-minute / tick timeframes). */
declare function formatIstTimeSeconds(utcSeconds: number): string;
/** Format UTC seconds as an IST `YYYY-MM-DD` date (for OpenAlgo history requests). */
declare function utcSecondsToIstDateString(utcSeconds: number): string;
/** Format UTC seconds as an IST `DD Mon` date label. */
declare function formatIstDate(utcSeconds: number): string;
/**
 * Crosshair time-tag label in IST, matching the reference style:
 * `Wed 21 May '26`, with ` HH:MM` appended for intraday (non-midnight) bars.
 */
declare function formatIstCrosshairLabel(utcSeconds: number): string;
/** True if the two UTC-second instants fall on different IST calendar days. */
declare function isNewIstDay(prevUtcSeconds: number, utcSeconds: number): boolean;
/**
 * The shipped default zone. A caller who passes no timezone gets exactly what
 * v1.2.0 produced; openalgo-charts is a general library that happens to ship an
 * Indian default, not an Indian library.
 */
declare const DEFAULT_TIMEZONE = "Asia/Kolkata";
/**
 * Calendar parts of an instant in some IANA zone. Structurally identical to
 * `IstParts`, which is now the special case rather than the assumption.
 */
type ZonedParts = IstParts;
/** Calendar periods the indicators and profiles anchor to. */
type ZonedPeriod = 'day' | 'week' | 'month' | 'quarter' | 'year';
/** True when the runtime recognises `zone` as an IANA zone name. */
declare function isValidTimezone(zone: string): boolean;
/** UTC seconds → calendar parts in `zone` (for axis labels / tick decisions). */
declare function utcSecondsToZonedParts(utcSeconds: number, zone?: string): ZonedParts;
/** Whole days since 1970-01-01, counted in `zone`. Allocation-free on a repeat. */
declare function zonedDayIndex(utcSeconds: number, zone?: string): number;
/**
 * Week number since the epoch, counted in `zone`, weeks starting Monday.
 * 1970-01-01 was a Thursday, hence the +3 before the divide.
 */
declare function zonedWeekIndex(utcSeconds: number, zone?: string): number;
/**
 * The zone's offset from UTC at this instant, in seconds. DST-correct: ask it
 * for a July instant and a January one in the same northern zone and the two
 * answers differ.
 */
declare function zoneOffsetSeconds(utcSeconds: number, zone?: string): number;
/** True if the two instants fall on different calendar days in `zone`. */
declare function isNewZonedDay(prevUtcSeconds: number, utcSeconds: number, zone?: string): boolean;
/** True if the two instants fall in different Monday-start weeks in `zone`. */
declare function isNewZonedWeek(prevUtcSeconds: number, utcSeconds: number, zone?: string): boolean;
/** True if the two instants fall in different calendar months in `zone`. */
declare function isNewZonedMonth(prevUtcSeconds: number, utcSeconds: number, zone?: string): boolean;
/** True if the two instants fall in different calendar quarters in `zone`. */
declare function isNewZonedQuarter(prevUtcSeconds: number, utcSeconds: number, zone?: string): boolean;
/** True if the two instants fall in different calendar years in `zone`. */
declare function isNewZonedYear(prevUtcSeconds: number, utcSeconds: number, zone?: string): boolean;
/** The boundary test for one period, for a caller that carries the period as data. */
declare function isNewZonedPeriod(prevUtcSeconds: number, utcSeconds: number, period: ZonedPeriod, zone?: string): boolean;
/**
 * Parse a wall-clock date/time string in `zone` to UTC seconds. Accepts the same
 * shapes as `istStringToUtcSeconds`: `YYYY-MM-DD`, `YYYY-MM-DD HH:MM[:SS]`, and
 * the `T`-separated ISO variant. Never consults the host machine's own zone.
 */
declare function zonedStringToUtcSeconds(input: string, zone?: string): number;
/**
 * Wall-clock components in `zone` → UTC seconds.
 *
 * Two passes because the offset we need is the one in force at the *answer*,
 * not at the guess: on a DST changeover day the first pass can land an hour out,
 * and the second pass corrects it. A wall time that a spring-forward skipped has
 * no exact answer; this settles on the instant one offset-step later, which is
 * the same choice `Date` makes.
 */
declare function zonedWallClockToUtcSeconds(year: number, month: number, day: number, hour?: number, minute?: number, second?: number, zone?: string): number;
/** UTC seconds of the local midnight opening this instant's day in `zone`. */
declare function startOfZonedDay(utcSeconds: number, zone?: string): number;
/** UTC seconds of the local midnight opening this instant's Monday in `zone`. */
declare function startOfZonedWeek(utcSeconds: number, zone?: string): number;
/** UTC seconds of the local midnight opening this instant's month in `zone`. */
declare function startOfZonedMonth(utcSeconds: number, zone?: string): number;
/** Format UTC seconds as an `HH:MM` clock label in `zone`. */
declare function formatZonedTime(utcSeconds: number, zone?: string): string;
/** Format UTC seconds as an `HH:MM:SS` clock label in `zone` (sub-minute timeframes). */
declare function formatZonedTimeSeconds(utcSeconds: number, zone?: string): string;
/** Format UTC seconds as a `DD Mon` date label in `zone`. */
declare function formatZonedDate(utcSeconds: number, zone?: string): string;
/** Format UTC seconds as a `YYYY-MM-DD` date in `zone`. */
declare function utcSecondsToZonedDateString(utcSeconds: number, zone?: string): string;
/** Crosshair time-tag label in `zone`, in the same style as the IST form. */
declare function formatZonedCrosshairLabel(utcSeconds: number, zone?: string): string;
/**
 * Bar indices that open a new trading session, read back from the timestamps.
 *
 * An exchange's overnight break is the widest recurring gap in an intraday
 * series, and it is the only thing in the bars themselves that says where one
 * trading day ends. Reading it back beats assuming a timezone: the same code
 * has to serve an exchange in Mumbai and one in New York, and a fixed midnight
 * lands mid-session for one of them. Getting it wrong splices the tail of one
 * session onto the head of the next across the overnight gap, which inflates
 * that period's high-low range and throws anything measured from it a long way
 * off.
 *
 * Returns null when the series shows no readable session break: a market that
 * never closes, bars already a day or coarser, or a feed whose only gaps are
 * weekends. The caller then falls back to a calendar rule, which is the right
 * answer in exactly those cases.
 */
declare function sessionStartIndices(times: readonly number[]): number[] | null;
/**
 * Per-bar flags marking the first bar of each trading session.
 *
 * Falls back to the calendar day in `zone` when the series has no readable
 * session break, which is the only answer available for daily bars and a
 * defensible one for a market that never closes. The zone defaults to IST, so a
 * caller that passes nothing gets exactly the old behaviour.
 */
declare function sessionStartFlags(times: readonly number[], zone?: string): boolean[];
/**
 * Per-bar flags marking the first bar of each calendar period, where `isNew`
 * decides what "period" means for two instants.
 *
 * The test runs on session opens rather than on every bar, so a session that
 * straddles the boundary is not cut in half: the last ninety minutes of a New
 * York Friday fall on a Saturday in IST, and testing bar to bar would start the
 * next week partway through Friday's session. With no readable sessions the
 * test runs bar to bar, which is the same thing when each bar is its own
 * session.
 */
declare function calendarPeriodFlags(times: readonly number[], isNew: (prevUtcSeconds: number, utcSeconds: number) => boolean): boolean[];
/** A trading window in local wall-clock terms, as parsed from a spec string. */
interface SessionSpec {
    /** Minutes from midnight, inclusive. */
    start: number;
    /** Minutes from midnight, exclusive. */
    end: number;
    /** Days the window opens on, 1..7 with 1 = Sunday. Absent means every day. */
    days?: readonly number[];
}
/**
 * Parse `"0915-1015"`, optionally with a day filter after a colon:
 * `"0930-1600:23456"` is Monday to Friday. Whitespace around the parts is
 * ignored. An end at or before the start is a window that runs past midnight.
 *
 * Returns null rather than throwing, because the spec is normally a string a
 * user typed into a settings field and a half-typed one arrives on every
 * keystroke.
 */
declare function parseSessionSpec(spec: string): SessionSpec | null;
/** True if this instant falls inside `spec` as read in `zone`. */
declare function inSessionAt(utcSeconds: number, spec: SessionSpec, zone?: string): boolean;
/**
 * Per-bar flags marking the bars inside `spec`. An unparseable spec string
 * marks nothing: a chart that keeps drawing beats one that dies on a stray
 * character, and the caller can check `parseSessionSpec` itself to tell an
 * empty window from a bad one.
 */
declare function sessionFlags(times: readonly number[], spec: string | SessionSpec, zone?: string): boolean[];

/** Clamp `value` into the inclusive range [min, max]. */
declare function clamp(value: number, min: number, max: number): number;
/** Linear interpolation between `a` and `b` by fraction `t` (0..1). */
declare function lerp(a: number, b: number, t: number): number;
/**
 * Round `value` to the nearest multiple of `step` (the instrument tick size).
 * Used for snapping dragged order/SL/TP prices to a valid tick. Returns
 * `value` unchanged when `step <= 0`.
 */
declare function roundToTick(value: number, step: number): number;

export { ALT_PRESET, type AddSeriesOptions, type AggTick, type AxisChromeOptions, type AxisStyle, BAR_CACHE_VERSION, BUILTIN_COMMANDS, type Bar, BarCache, type BarCacheOptions, type BarCacheStats, type BarCacheStore, type BarSubscriptionOptions, type BarUpdate, type BarsPage, type BarsPageRequest, type BarsRequest, type BrandingChangedEvent, type Bucketing, BuySellButtons, type BuySellButtonsOptions, CHART_STATE_VERSION, type CachedBars, type CachedBarsRequest, type CalendarBucketing, type CalendarUnit, CandleBuilder, type CandleBuilderOptions, type CandleGeometry, type CandleStyle, type CandleTier, type CandleUpdate, Canvas2dBackend, type CanvasLineStyle, type CanvasOptions, Chart, type ChartClickEvent, type ChartDataContext, type ChartDragEndEvent, type ChartDragEvent, type ChartEvent, type ChartEventOptions, type ChartNavigationOptions, type ChartObjectCapabilities, type ChartObjectDefinition, type ChartObjectDrawing, type ChartObjectDrawingSource, type ChartObjectKind, type ChartObjectProvider, type ChartObjectSnapshot, ChartObjects, type ChartObjectsOptions, type ChartOptions, type ChartSettingsColorPairInput, type ChartSettingsInput, type ChartSettingsState, type ChartSettingsTab, type ChartSettingsTabId, type ChartSettingsValue, type ChartSettingsValues, type ChartState, ChartTable, type ChartTableOptions, type ChartTheme, type ChartWatermarkOptions, type ComparisonAlignment, type ComparisonChartHost, ComparisonController, type ComparisonControllerOptions, type ComparisonHandle, type ComparisonMode, type ComparisonOptions, type ComparisonPane, type ContextMenuEvent, type ContextMenuTarget, type ContextMenuTargetKind, type CrosshairMoveEvent, type CrosshairOptions, type CrosshairStyle, type CustomShortcut, DEFAULT_CANDLE_BUILDER_OPTIONS, DEFAULT_CANDLE_STYLE, DEFAULT_CHART_TABLE_OPTIONS, DEFAULT_HISTOGRAM_STYLE, DEFAULT_KEYMAP, DEFAULT_PRICE_SCALE_OPTIONS, DEFAULT_THEME, DEFAULT_TIMEZONE, DEFAULT_TIME_NAVIGATOR_OPTIONS, DEFAULT_TIME_SCALE_OPTIONS, DEFAULT_TRADING_COLORS, DEFAULT_ZOOM_GLIDE_OPTIONS, type DataFeed, DataLayer, DataLoadingController, type DataLoadingOptions, type DataLoadingSnapshot, type DataLoadingStatus, type DataUpdateReason, type DecodedOrder, type DepthLevel, type DoubleClickAction, type DoubleClickEvent, type DrawAnchor, type DrawItem, EventMarkers, type ExportSvgOptions, FakeDataFeed, type FeedScheduler, type FillGradient, type FillPoint, type GridAxisStyle, type GridOptions, type GridStyle, type HistogramStyle, type HistoryLoadingStatus, HistoryRequestPool, type HistoryRequestPoolOptions, INDICATOR_LINE_STYLES, INDICATOR_PLOT_STYLES, INDICATOR_SOURCES, type IPrimitive, type IRenderBackend, IST_OFFSET_SECONDS, type IndexedBar, type IndicatorAlertContext, type IndicatorAlertPayload, type IndicatorAlertSpec, type IndicatorApi, type IndicatorAttachContext, IndicatorBackground, type IndicatorCalcContext, type IndicatorDataChange, type IndicatorDataStatus, type IndicatorDescriptor, type IndicatorDrawing, IndicatorDrawings, IndicatorFill, type IndicatorFillOptions, type IndicatorFillSpec, type IndicatorHost, type IndicatorInput, type IndicatorLevel, type IndicatorLevelContext, type IndicatorLineStyle, type IndicatorPlot, type IndicatorSettings, type IndicatorSource, type IndicatorState, type IndicatorStore, type IndicatorValues, type IntervalBucketing, type IntervalDescriptor, type IntervalParts, InvalidationLevel, type IstParts, type KeymapEntry, LINK_CROSSHAIR_ALPHA, type LateTickPolicy, type LegendField, type LegendStatusData, type LegendStatusLineOptions, type LegendStatusSource, type LegendTitleMode, type LegendValue, type LinePoint, type LinkChart, LinkCrosshair, type LinkDataLayer, LinkGroup, type LinkMemberOptions, type LinkMissingPolicy, type LinkOptions, type LiveBarMeta, type LogicalRange, LogoWatermark, type LogoWatermarkOptions, type LtpEvent, type MarkerPosition, type MarkerShape, type MarkerSize, type MarketDepth, type MarketPhase, type MarketPhaseFn, type MaybePromise, type ModeCheck, type OpenAlgoConfig, OpenAlgoDataFeed, type OpenAlgoLiveConfig, OpenAlgoLiveDataFeed, type OpenAlgoTradeConfig, OpenAlgoTradeFeed, type OpenAlgoWsConfig, OpenAlgoWsFeed, type OrderBookSnapshot, type OrderDecodeCode, type OrderDecodeIssue, type OrderDecodeResult, type OrderSide$1 as OrderSide, type OrderType$1 as OrderType, type OrderUpdateEvent, type OriginalTime, PRICE_LEVEL_KINDS, PRICE_SCALE_MODES, Pane, type PaneInvalidation, PaneLegend, type PaneLegendAction, type PaneLegendOptions, type PaneState, type PickHost, type PickKind, type PlaceOrder, type PlotMarginOptions, type PointerInfo, type PointerKind, type PointerModifiers, type PointerSample, type PositionSide, type PriceAxisState, type PriceFormat, type PriceLevelInput, type PriceLevelKind, type PriceLevelQuote, type PriceLevelStyle, type PriceLevelValues, PriceLevels, type PriceLevelsOptions, PriceLine, type PriceLineOptions, type PriceRange, PriceScale, type PriceScaleId, type PriceScaleMode, type PriceScaleOptions, type PriceScaleState, type PrimitiveAnchor, type PrimitiveHit, type PrimitiveHost, type PrimitivePlacement, type PrimitiveRenderContext, type QuarantinedRow, type RawOrder, type RenderBackendFactory, type RenderBackendKind, type RenderDevice, type RendererChoice, type RendererEntry, type RendererFallbackEvent, type RendererFallbackReason, type ReplayChartHost, ReplayController, type ReplayOptions, type ReplayScheduler, ReplayShade, type ReplayShadeOptions, type ReplayState, type ReplayViewport, type ResolvedLinkOptions, type RestoreReport, SCALE_FONT_MAX, SCALE_FONT_MIN, type ScaleCanvasOptions, type SeriesApi, type SeriesDataItem, type SeriesId, type SeriesMarker, SeriesMarkers, type SeriesRenderContext, type SeriesState, type SeriesStyle, type SeriesType, type SessionSpec, type ShortcutListItem, ShortcutManager, type ShortcutManagerOptions, type ShortcutPreset, type ShortcutScope, type ShortcutTriggerEvent, type Size, type SocketFactory, type SocketLike, type SupertrendPoint, SvgContext, type SvgContextOptions, SvgLinearGradient, type TableCell, type TablePosition, TextWatermark, type TextWatermarkOptions, type Tick, TickBarAggregator, type TickBarOptions, type TickCountBucketing, type TickMarkType, type TickTimeframe, TimeNavigator, type TimeNavigatorAction, type TimeNavigatorOptions, TimeScale, type TimeScaleOp, type TimeScaleOptions, type TradeFeed, type TradeMarkerVariant, TradeMarkersPrimitive, type TradingColors, TradingController, type TradingHost, type TradingLineStyle, type TradingLineVariant, type TradingOrder, type TradingOrderSide, type TradingOrderType, type TradingPosition, type TradingSettings, type TradingSyncPayload, type TradingTrade, type UTCSeconds, UnknownIntervalError, type UnsubscribeFn, VERSION, type VolumeBucketing, type VolumeMode, type WatermarkPosition, type Whitespace, type WsClientWarning, type WsControlMessage, type WsMode, type WsState, type ZOrder, type ZonedParts, type ZonedPeriod, type ZoomAnchor, ZoomGlide, type ZoomGlideOptions, addComparison, alignToPrimary, applyChartSettings, atr, autoscaleRange, backendDegradation, backoffDelayMs, barCacheKey, barCloseSec, beginPick, bestHit, bitmapSize, bucketStartOf, calendarPeriodFlags, candleGeometry, candleTier, chartSettingsSchema, clamp, classifyAuthAck, compactVolume, comparisonController, computePriceLevels, conflateBars, conflateItems, conflationGroupSize, createChart, createLinkGroup, createRenderBackend, darkTheme, dashPattern, decodeOrder, drawLabel, drawShape, effectiveMarkerPx, ema, emaSeries, epochMsToUtcSeconds, eventToCombo, followerIndex, followerRange, formatCombo, formatIstCrosshairLabel, formatIstDate, formatIstTime, formatIstTimeSeconds, formatSubscribe, formatUnsubscribe, formatZonedCrosshairLabel, formatZonedDate, formatZonedTime, formatZonedTimeSeconds, fromGradient, generateBars, getChartType, getIndicator, hasIndicator, inSessionAt, indicatorDefaults, indicatorStyleInputs, intervalParts, intervalToSeconds, isDailyInterval, isIntradayInterval, isKnownInterval, isNewIstDay, isNewZonedDay, isNewZonedMonth, isNewZonedPeriod, isNewZonedQuarter, isNewZonedWeek, isNewZonedYear, isRebasing, isReservedCombo, isSecondsInterval, isTickInterval, isTimeBucketed, isValidCombo, isValidTimezone, isWhitespace, istStringToUtcSeconds, lastPriceLevelFromSeriesStyle, lerp, lightTheme, mapHistoryResponse, mapOrder, mapOrderStatus, mapPosition, markerSizePx, mergeBars, nextBucketStart, niceTicks, normalizeCombo, optimalBarWidth, parseCombo, parseMessage, parseSessionSpec, parseTopic, plotStyleKeys, precisionForStep, readChartSettings, readSequence, registerChartType, registerIndicator, registerInterval, registerRenderBackend, registeredChartTypes, registeredIndicators, registeredIntervals, registeredRenderBackends, resolveCrosshairStyle, resolveGridStyle, resolveInterval, resolvePlotMargins, resolveRenderBackend, resolveScaleStyle, roundToTick, rowTimeToUtcSeconds, rsi, rsiSeries, seriesStyleForLastPriceLevel, sessionFlags, sessionStartFlags, sessionStartIndices, sharedHistoryRequests, snapToDevicePixel, sourceValue, sourceValues, startOfZonedDay, startOfZonedMonth, startOfZonedWeek, supertrend, supertrendSeries, tableOrigin, toBar, trueRange, tryResolveInterval, unregisterInterval, unregisterRenderBackend, utcSecondsToIstDateString, utcSecondsToIstParts, utcSecondsToZonedDateString, utcSecondsToZonedParts, version, verticalGradient, watermarkRect, withAlpha, withBarCache, zoneOffsetSeconds, zonedDayIndex, zonedStringToUtcSeconds, zonedWallClockToUtcSeconds, zonedWeekIndex };
