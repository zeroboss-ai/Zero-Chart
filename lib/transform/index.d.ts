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
 * Series transform pipeline (ARCHITECTURE.md §6A, Family B). A transform
 * re-buckets raw OHLC into a derived element series driven by price movement,
 * not the clock. Transforms are incremental (streaming) so live ticks extend
 * the series without recomputing history.
 *
 * Each derived element is a Bar carrying its source formation time. Because the
 * time scale is index-based, derived elements get uniform spacing automatically
 * (the "ordinal" axis); axis labels read each element's formation time. We only
 * post-process times to be strictly increasing so the shared DataLayer keeps
 * every element on its own logical index (no collisions when many elements form
 * within one source bar).
 */

interface ISeriesTransform {
    /** Reset to initial state (start of a fresh batch / re-subscribe). */
    reset(): void;
    /** Feed one source bar; return 0..n newly *completed* derived elements. */
    push(bar: Bar): Bar[];
    /** Optional: emit any in-progress element at end of data. */
    flush?(): Bar[];
}
/**
 * Make times strictly increasing (collisions bumped by +1s) so the DataLayer
 * assigns one logical index per element. Labels stay within a few seconds of
 * the real formation time.
 */
declare function ensureIncreasingTimes(bars: readonly Bar[]): Bar[];
/** Run a transform over a full batch of bars (history load). */
declare function runTransform(transform: ISeriesTransform, bars: readonly Bar[]): Bar[];

/**
 * Heikin Ashi (ARCHITECTURE.md §6A). 1:1 with input bars (keeps real times);
 * renders with the candlestick renderer.
 *   haClose = (o+h+l+c)/4
 *   haOpen  = first: (o+c)/2 ; else (prevHaOpen + prevHaClose)/2
 *   haHigh  = max(h, haOpen, haClose) ; haLow = min(l, haOpen, haClose)
 */

declare class HeikinAshiTransform implements ISeriesTransform {
    private _prevOpen;
    private _prevClose;
    reset(): void;
    push(bar: Bar): Bar[];
}

/**
 * Renko bricks (ARCHITECTURE.md §6A). Each fixed box-size move of the close
 * emits one brick. Renders with the candlestick renderer (brick = a body).
 * Simplified single-box step (no 2× reversal rule) — deterministic and
 * incremental for live updates.
 */

interface RenkoOptions {
    boxSize: number;
}
declare class RenkoTransform implements ISeriesTransform {
    private readonly _box;
    private _edge;
    constructor(options: RenkoOptions);
    reset(): void;
    push(bar: Bar): Bar[];
}

/**
 * Range bars (ARCHITECTURE.md §6A). A new bar completes when its high−low
 * reaches the configured range. Built from the close sequence; renders with the
 * candlestick renderer. Incremental: the in-progress bar is emitted by flush().
 */

interface RangeOptions {
    range: number;
}
declare class RangeBarsTransform implements ISeriesTransform {
    private readonly _range;
    private _cur;
    constructor(options: RangeOptions);
    reset(): void;
    push(bar: Bar): Bar[];
    flush(): Bar[];
}

/**
 * Line Break (ARCHITECTURE.md §6A). A new line forms only when the close breaks
 * beyond the extreme of the prior N lines (default 3). Renders with the
 * candlestick renderer (each line = a body). Incremental.
 */

interface LineBreakOptions {
    lines: number;
}
declare class LineBreakTransform implements ISeriesTransform {
    private readonly _n;
    private _lines;
    constructor(options?: LineBreakOptions);
    reset(): void;
    push(bar: Bar): Bar[];
}

/**
 * Point & Figure (ARCHITECTURE.md §6A). Columns of X (up) / O (down); a new
 * column starts only after a reversal of `reversal` boxes.
 *
 * Construction method (`method`):
 *  - `'hl'` (default, and what every desk means by P&F): each source bar's
 *    **high** extends an X column and its **low** extends an O column; the
 *    opposite extreme triggers the reversal test.
 *  - `'close'`: only the close is considered (the older, coarser variant).
 *
 * Box sizing (`mode`):
 *  - `'fixed'`   — a constant `boxSize` (the classic).
 *  - `'percent'` — `price × percent / 100`, re-resolved when each column opens.
 *  - `'atr'`     — `ATR(period) × multiplier` (Wilder), re-resolved per column.
 *
 * Each emitted column is a Bar spanning the column's price range, with up =
 * close ≥ open (X) and down = close < open (O). A column's `high` is the
 * **exclusive top edge** of its highest box, so `[low, high)` is exactly the
 * price span the glyph stack occupies. Every column also carries the `boxSize`
 * it was built with, so the renderer never needs to be told separately (which
 * is the only way variable-box modes can render correctly).
 */

type PointFigureMethod = 'hl' | 'close';
type PointFigureBoxMode = 'fixed' | 'percent' | 'atr';
interface PointFigureOptions {
    /** Box size for `mode: 'fixed'`. Required unless another mode is chosen. */
    boxSize?: number;
    /** Boxes of counter-move needed to start a new column. Default 3. */
    reversal?: number;
    /** Which prices drive the column. Default `'hl'`. */
    method?: PointFigureMethod;
    /** How the box size is resolved. Default `'fixed'`. */
    mode?: PointFigureBoxMode;
    /** Box as a percentage of price, for `mode: 'percent'` (e.g. `0.5` = 0.5%). */
    percent?: number;
    /** ATR lookback for `mode: 'atr'`. Default 14. */
    atrPeriod?: number;
    /** ATR multiplier for `mode: 'atr'`. Default 1. */
    atrMultiplier?: number;
}
/** A P&F column. Carries the box size it was built with (modes vary it). */
interface PointFigureColumn extends Bar {
    /** Price height of one box in this column — one X or O glyph. */
    boxSize: number;
    /** Number of boxes (glyphs) stacked in this column. */
    boxes: number;
}
declare class PointFigureTransform implements ISeriesTransform {
    private readonly _reversal;
    private readonly _method;
    private readonly _mode;
    private readonly _fixedBox;
    private readonly _percent;
    private readonly _atrMult;
    private readonly _atr;
    /** Box size of the column currently forming. */
    private _box;
    /** +1 X, -1 O, 0 = no column established yet. */
    private _dir;
    /** Column bounds as integer box indices under `_box`. */
    private _top;
    private _bot;
    private _time;
    constructor(options: PointFigureOptions);
    /** The fixed box size, for `mode: 'fixed'`. NaN in variable modes. */
    get boxSize(): number;
    reset(): void;
    /**
     * Box size for a column opening at `price`. Falls back to the last valid box,
     * then to 1% of price, then to 1 — so a degenerate ATR/price never throws or
     * emits a zero-height column.
     */
    private _resolveBox;
    private _column;
    push(bar: Bar): Bar[];
    flush(): Bar[];
}

/**
 * Kagi (ARCHITECTURE.md §6A). A continuous line that reverses direction only
 * after a move of at least `reversal`. Turning points are emitted as vertices.
 * Line thickness (yang/yin) is encoded in `volume` (1 = thick, 0 = thin) using
 * a simplified rule: thick once the line exceeds the previous up-turn (higher
 * shoulder), thin once it falls below the previous down-turn (lower waist).
 * The kagi renderer connects vertices with a stepped line of varying width.
 */

interface KagiOptions {
    reversal: number;
}
declare class KagiTransform implements ISeriesTransform {
    private readonly _reversal;
    private _dir;
    private _ext;
    private _prevShoulder;
    private _prevWaist;
    private _thick;
    constructor(options: KagiOptions);
    reset(): void;
    push(bar: Bar): Bar[];
    flush(): Bar[];
}

/**
 * Symbol arithmetic: a chart of `NIFTY1!/NSE:RELIANCE`, `(A+B)/2`, `1/GOLD`.
 *
 * Two halves, deliberately separate. `parseExpression` turns a string into an
 * AST and, crucially, tells the caller which symbols it needs *before* any data
 * is fetched, so a host can resolve and load exactly those legs.
 * `evaluateExpression` then folds the legs into one synthetic bar series.
 *
 * The engine does no fetching. A host owns symbol resolution and history, the
 * same way `addComparison` takes bars rather than a symbol.
 *
 * ## Why the high and low are approximations
 *
 * A bar says where a market opened, closed, and how far it travelled, but not
 * *when* it was at each price. For `A/B` the true high of the ratio needs the
 * instant A was highest relative to B, and two OHLC bars do not record that.
 *
 * So the extremes are computed by interval arithmetic: each leg contributes
 * `[low, high]`, every operator maps intervals to intervals, and the result's
 * interval is the range the expression *could* have covered. That bound is
 * guaranteed to contain the truth and is usually wider than it, because it
 * assumes the legs hit their extremes at the worst possible moments. Open and
 * close need no such trick: they are read from the legs' own opens and closes,
 * which are simultaneous by definition, and so are exact.
 *
 * One consequence worth knowing: an interval cannot tell that two mentions of
 * the same symbol move together, so `A/A` bounds to `[low/high, high/low]`
 * rather than collapsing to 1. That is the classic dependency problem, and it
 * is why `ohlc: 'close'` (a line from exact closes) is the default.
 */

/** A parsed expression, with the symbols it needs. */
interface SymbolExpression {
    /** The source, as typed. */
    readonly source: string;
    /** Distinct symbols, in first-seen order. The first is the default time grid. */
    readonly symbols: readonly string[];
    /** Opaque syntax tree. */
    readonly ast: ExpressionNode;
}
interface EvaluateOptions {
    /**
     * `'close'` (default) evaluates only the closes, giving a flat bar whose four
     * values are equal: exact, and honest about what two OHLC bars can support.
     * `'interval'` additionally bounds the high and low as described above.
     */
    ohlc?: 'close' | 'interval';
    /**
     * The leg whose bars define the time grid. Defaults to the first symbol.
     * Every other leg is matched to it by timestamp; a bar with no match on some
     * leg produces a gap rather than a guess.
     */
    primary?: string;
}
/**
 * The syntax tree behind a parsed expression. Exported so the type of
 * `SymbolExpression.ast` has a name; a host builds one with `parseExpression`,
 * never by hand.
 */
type ExpressionNode = {
    k: 'num';
    v: number;
} | {
    k: 'sym';
    name: string;
} | {
    k: 'neg';
    a: ExpressionNode;
} | {
    k: 'bin';
    op: '+' | '-' | '*' | '/' | '^';
    a: ExpressionNode;
    b: ExpressionNode;
} | {
    k: 'fn';
    name: ExpressionFunctionName;
    args: ExpressionNode[];
};
/** The functions an expression may call. */
type ExpressionFunctionName = 'abs' | 'sqrt' | 'ln' | 'log' | 'log10' | 'exp' | 'min' | 'max' | 'pow';
declare class ExpressionError extends Error {
    readonly position: number;
    constructor(message: string, position: number);
}
/**
 * Parse `source` into an expression and the symbols it needs.
 *
 * ```ts
 * const e = parseExpression('NIFTY1!/NSE:RELIANCE');
 * e.symbols; // ['NIFTY1!', 'NSE:RELIANCE'] -> fetch exactly these
 * ```
 *
 * Throws `ExpressionError` with the offending character's index, so a search
 * box can underline it. A bare symbol parses too, which lets one code path
 * handle both an ordinary chart and a synthetic one.
 */
declare function parseExpression(source: string): SymbolExpression;
/** True when `source` is a single plain symbol, needing no arithmetic. */
declare function isPlainSymbol(source: string): boolean;
/**
 * Fold the legs into one synthetic series.
 *
 * `legs` maps each symbol in `expr.symbols` to its bars. A symbol with no
 * entry, or a bar the primary has and a leg does not, yields no output bar: the
 * series gaps there rather than carrying a stale price forward, because a
 * ratio against yesterday's close is a number that was never true.
 *
 * ```ts
 * const e = parseExpression('NIFTY1!/NSE:RELIANCE');
 * const bars = evaluateExpression(e, { 'NIFTY1!': a, 'NSE:RELIANCE': b });
 * chart.addSeries('line').setData(bars);
 * ```
 *
 * `volume` is deliberately absent from the result. The volume of a ratio is not
 * a quantity anyone traded, and picking one leg's would be arbitrary.
 */
declare function evaluateExpression(expr: SymbolExpression, legs: Readonly<Record<string, readonly Bar[]>>, options?: EvaluateOptions): Bar[];

declare const TRANSFORM_TIER: "transform";
/**
 * Register the Family-B custom renderers (point-figure, kagi). Called as a side
 * effect when this tier is imported, and also exported so consumers whose
 * bundler aggressively tree-shakes a bare `import 'openalgo-charts/transform'`
 * can call it explicitly. Idempotent.
 *
 * (Heikin Ashi / Renko / Range / Line Break render as a 'candlestick' series and
 * need no new type — only P&F and Kagi have custom renderers.)
 */
declare function registerTransformChartTypes(): void;

export { type EvaluateOptions, ExpressionError, type ExpressionFunctionName, type ExpressionNode, HeikinAshiTransform, type ISeriesTransform, type KagiOptions, KagiTransform, type LineBreakOptions, LineBreakTransform, type PointFigureBoxMode, type PointFigureColumn, type PointFigureMethod, type PointFigureOptions, PointFigureTransform, RangeBarsTransform, type RangeOptions, type RenkoOptions, RenkoTransform, type SymbolExpression, TRANSFORM_TIER, ensureIncreasingTimes, evaluateExpression, isPlainSymbol, parseExpression, registerTransformChartTypes, runTransform };
