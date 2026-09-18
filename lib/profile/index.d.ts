import { ZOrder, IPrimitive, PrimitiveHost, PrimitiveRenderContext, PrimitiveHit } from 'openalgo-charts';

/**
 * Profile data model (ARCHITECTURE.md §6A, Family C). Price-bucketed
 * distributions: volume-at-price, time-at-price (TPO), and bid/ask footprint.
 */
interface VolumeProfileResult {
    /** Volume per price bucket, sorted high → low price. */
    buckets: {
        price: number;
        volume: number;
    }[];
    /** Point of control: price bucket with the most volume. */
    poc: number;
    /** Value-area high / low (the price band holding `valueAreaPercent` of volume). */
    vah: number;
    val: number;
    totalVolume: number;
}
interface TpoResult {
    buckets: {
        price: number;
        count: number;
    }[];
    poc: number;
    vah: number;
    val: number;
    /** Initial balance: price range of the first `ibPeriods` periods. */
    ib: {
        high: number;
        low: number;
    };
}
interface FootprintCell {
    price: number;
    bidVol: number;
    askVol: number;
}
interface FootprintBar {
    time: number;
    cells: FootprintCell[];
    /** Net delta = Σ(askVol − bidVol). */
    delta: number;
    /** Lowest/highest running trade delta within this bar, including initial zero.
     * Absent when only aggregated price rows are available. */
    minDelta?: number;
    maxDelta?: number;
    /** Effective ladder step: instrument tick size multiplied by rowTicks. */
    rowSize?: number;
    /** Actual traded prices, before ladder rounding. Absent for empty/legacy bars. */
    open?: number;
    high?: number;
    low?: number;
    close?: number;
    /** Number of classified trade records, not the number of occupied rows. */
    tradeCount?: number;
}
/** Bucket a price to the tick grid. */
declare function bucketPrice(price: number, step: number): number;
/** Inclusive list of bucket prices spanning [low, high]. */
declare function priceBuckets(low: number, high: number, step: number): number[];

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
 * Volume Profile (ARCHITECTURE.md §6A). Distributes each bar's volume across the
 * price buckets it spans, then derives the Point of Control and Value Area.
 * From OHLCV this is an approximation (uniform spread across the bar's range);
 * exact profiles need tick data. Pure + testable.
 */

interface VolumeProfileOptions {
    tickSize: number;
    /** Fraction of total volume contained in the value area (default 0.7). */
    valueAreaPercent: number;
}
declare function computeVolumeProfile(bars: readonly Bar[], tickSize: number, valueAreaPercent?: number): VolumeProfileResult;

/**
 * Volume Profile family (ARCHITECTURE.md §6A, Family C). Volume-at-price grouped
 * into sessions (composite / day / week / month), with a POC and Value Area per
 * session and an optional buy/sell split.
 *
 * The buy/sell split is an honest OHLCV approximation: a bar's whole volume is
 * attributed to buyers when it closed up (`close >= open`) and to sellers when it
 * closed down. True bid/ask delta needs classified trades - see the
 * [Footprint](./footprint.ts). Set `deltaFromBarDirection: false` to keep volume
 * un-split (buy/sell/delta all zero).
 *
 * Visible-range volume profile = pass the visible slice of bars with
 * `session: 'composite'`. Pure and deterministic.
 */

type VolumeProfileSession = 'composite' | 'day' | 'week' | 'month';
interface VolumeProfileFamilyOptions {
    /** Price bucket size. */
    tickSize: number;
    /** Session grouping. `composite` builds one profile over all bars. */
    session: VolumeProfileSession;
    /** Value-area fraction of total volume (0..1). */
    valueAreaPercent: number;
    /** Split each bar's volume into buy/sell by bar direction (close >= open => buy). */
    deltaFromBarDirection: boolean;
    /**
     * IANA zone the day / week / month buckets resolve on. Defaults to
     * `Asia/Kolkata`, so a caller who passes nothing gets what it always did.
     */
    timezone?: string;
}
declare const DEFAULT_VOLUME_PROFILE_FAMILY_OPTIONS: VolumeProfileFamilyOptions;
interface VolumeProfileLevel {
    price: number;
    volume: number;
    buyVolume: number;
    sellVolume: number;
    /** buyVolume - sellVolume. */
    delta: number;
}
interface VolumeProfileSessionResult {
    startTime: number;
    endTime: number;
    /** Price levels, sorted high -> low. */
    levels: VolumeProfileLevel[];
    /** Point of control (price with the most volume). */
    poc: number;
    vah: number;
    val: number;
    totalVolume: number;
    buyVolume: number;
    sellVolume: number;
    delta: number;
}
interface VolumeProfileFamilyResult {
    sessions: VolumeProfileSessionResult[];
    options: VolumeProfileFamilyOptions;
}
declare function computeVolumeProfileSessions(bars: readonly Bar[], options?: Partial<VolumeProfileFamilyOptions>): VolumeProfileFamilyResult;

/**
 * Volume Profile renderer (ARCHITECTURE.md §8, §6A). Draws the output of
 * `computeVolumeProfileSessions` as a horizontal volume histogram per session,
 * anchored at the session's left or right edge. Display modes: `total` (one bar),
 * `buySell` (buy vs sell split), and `delta` (net, colored by sign). POC and
 * Value Area are drawn as lines with labels, with an optional value-area fill and
 * dimming of rows outside the value area. A pane primitive that overlays the
 * price range (its `autoscaleInfo` reports its extent so a profile-only chart
 * still frames correctly).
 */

type VolumeDisplayMode = 'total' | 'buySell' | 'delta';
type VolumeProfileSide = 'left' | 'right';
interface VolumeProfilePrimitiveOptions {
    displayMode: VolumeDisplayMode;
    /** Anchor the bars at the session's left or right edge. */
    side: VolumeProfileSide;
    /** Maximum bar length in media px. */
    width: number;
    opacity: number;
    barColor: string;
    buyColor: string;
    sellColor: string;
    showPoc: boolean;
    pocColor: string;
    showPocLabel: boolean;
    showValueArea: boolean;
    vahColor: string;
    valColor: string;
    showValueAreaLabels: boolean;
    highlightValueArea: boolean;
    valueAreaFillColor: string;
    valueAreaFillOpacity: number;
    /** Opacity multiplier for rows outside the value area (1 = no dimming). */
    valueAreaOpacityDim: number;
    /** Show a price label at the session edge for the POC/value area. */
    labelSide: VolumeProfileSide;
    zOrder: ZOrder;
}
declare const DEFAULT_VOLUME_PROFILE_PRIMITIVE_OPTIONS: VolumeProfilePrimitiveOptions;
declare class VolumeProfile implements IPrimitive {
    private _result;
    private _opts;
    private _host;
    constructor(result?: VolumeProfileFamilyResult | null, opts?: Partial<VolumeProfilePrimitiveOptions>);
    attached(host: PrimitiveHost): void;
    detached(): void;
    zOrder(): ZOrder;
    autoscaleInfo(): {
        min: number;
        max: number;
    } | null;
    setData(result: VolumeProfileFamilyResult): void;
    setOptions(patch: Partial<VolumeProfilePrimitiveOptions>): void;
    draw(ctx: CanvasRenderingContext2D, rc: PrimitiveRenderContext): void;
    private _segments;
    private _drawSession;
}

/**
 * Time Price Opportunity / Market Profile (ARCHITECTURE.md §6A). Buckets
 * intraday bars into TPO periods and counts how many periods traded at each
 * price. Derives POC, Value Area, and the Initial Balance (first periods'
 * range). Derivable from OHLCV intraday bars. Pure + testable.
 */

declare function computeTpo(bars: readonly Bar[], periodBars: number, tickSize: number, valueAreaPercent?: number, ibPeriods?: number): TpoResult;

/**
 * Market Profile / TPO (Time Price Opportunity) — ARCHITECTURE.md §6A, Family C.
 *
 * Groups bars into sessions (day / week / month / composite), splits each
 * session into fixed-length time blocks ("periods", one letter each), and counts
 * how many periods traded at each price. Derives the Point of Control, Value
 * Area, Initial Balance, single prints, tails, range extension, day / open type
 * and the developing POC-VA track, plus volume at price.
 *
 * Pure and deterministic (no Date.now / Math.random), so it is fully
 * unit-testable and derivable from intraday OHLCV bars alone.
 */

type MarketProfileSession = 'day' | 'week' | 'month' | 'composite';
/**
 * A session window in minutes from local midnight. `end <= start` means the
 * window crosses midnight (an overnight session), which is why the test below is
 * a wrap-aware range check rather than a plain `>= start && < end`.
 *
 * "Local" is `zone` when the window names one, and `MarketProfileOptions.timezone`
 * otherwise. A window that names its own zone selects the same real instants
 * whatever the rest of the profile is read on.
 */
interface SessionWindow {
    /** Minutes from midnight, 0..1439. Equal start and end means all hours. */
    startMinute: number;
    endMinute: number;
    /** Shown on the chart when the renderer draws a session label. */
    name?: string;
    /**
     * IANA zone the two minute counts are written in. Omitted means "read them on
     * `MarketProfileOptions.timezone`", which is what a caller hand-writing a
     * window for their own market wants. This module is a pure calculation and is
     * never handed the chart, so a host that wants the two to agree passes
     * `chart.timezone()` into the options.
     */
    zone?: string;
}
/**
 * Named windows, each written in the clock of the market it belongs to.
 *
 * The zone is half the definition, not decoration. `us-regular` as a bare 1140
 * was unreadable as "09:30 New York", and it silently froze the US session at
 * whatever offset New York happened to have on the day the number was written,
 * so it opened an hour early for the five winter months. Written as 09:30 in
 * America/New_York it follows the exchange through both changeovers.
 *
 * The bands are the same partition of the day as before, re-expressed: London
 * and New York keep exactly the instants they selected under DST (where the old
 * numbers were right) and gain the hour the old numbers lost in winter.
 *
 * `all-hours` names no zone because it never reads one: an empty window
 * (`start === end`) short-circuits before any clock is consulted.
 */
declare const TRADING_HOURS: Record<string, SessionWindow>;
interface MarketProfileOptions {
    /** Instrument tick size — the finest price increment (Nifty: 0.1). */
    tickSize: number;
    /**
     * Ticks per TPO row, so row height is `tickSize * rowTicks`. This is the
     * multiplier a trader thinks in: 2-point rows on a 0.1-tick instrument is
     * `2 / 0.1 = 20`. Keeping it separate from `tickSize` means widening rows
     * never means lying about the instrument's real tick.
     */
    rowTicks: number;
    /** Session grouping. `composite` builds one profile over all bars. */
    session: MarketProfileSession;
    /** TPO period length in minutes — one letter per period. */
    blockMinutes: number;
    /** Value-area fraction of total TPOs (0..1). */
    valueAreaPercent: number;
    /** Number of opening periods that form the Initial Balance. */
    initialBalancePeriods: number;
    /** Restrict each session to this window. Bars outside it are dropped. */
    window?: SessionWindow;
    /**
     * IANA zone the session / day / week / month calendar resolves on. Defaults to
     * `Asia/Kolkata`, so a caller who passes nothing gets what it always did.
     *
     * A `window` that names its own zone overrides this for both the window test
     * and the bucketing, because a session must not be cut in half by the clock
     * someone happens to be reading the chart on.
     */
    timezone?: string;
    /**
     * Merge consecutive sessions into one profile (1 = off). With
     * `session: 'day'`, 5 gives a rolling weekly composite.
     */
    compositeSessions: number;
    /**
     * Minimum run of consecutive single prints that promotes a buying / selling
     * tail at a session extreme. 0 disables tail detection.
     */
    tailEdges: number;
}
declare const DEFAULT_MARKET_PROFILE_OPTIONS: MarketProfileOptions;
/**
 * Ticks per row for a desired row height — `rowTicksFor(2, 0.1)` is 20.
 * Saves callers from writing the division (and from off-by-one float dust).
 */
declare function rowTicksFor(rowSize: number, tickSize: number): number;
interface MarketProfileLevel {
    price: number;
    /** Distinct periods (TPOs) that traded at this price. */
    count: number;
    /** Period letters at this price, in period order (e.g. `"ABF"`). */
    letters: string;
    /** Period indices at this price — the renderer colours blocks from these. */
    periods: number[];
    /** Volume traded at this price (each bar's volume split across its range). */
    volume: number;
}
/** One time block within a session. */
interface MarketProfilePeriod {
    /** 0-based index within the session. */
    index: number;
    letter: string;
    /** UTC seconds covered by this block. */
    startTime: number;
    endTime: number;
    high: number;
    low: number;
    volume: number;
}
/** POC / value area as they stood at the close of each period. */
interface DevelopingValue {
    periodIndex: number;
    /** UTC seconds at which this snapshot became current. */
    time: number;
    poc: number;
    vah: number;
    val: number;
}
/**
 * Classic market-profile day types.
 * `normal` — a wide initial balance the rest of the day stays inside.
 * `normal-variation` — range extends to roughly 1.5-2x the initial balance.
 * `trend` — one-way extension, small IB relative to the range.
 * `double-distribution` — two separated high-volume nodes with a thin middle.
 * `neutral` — extension on both sides of the initial balance.
 */
type DayType = 'normal' | 'normal-variation' | 'trend' | 'double-distribution' | 'neutral';
/**
 * How the session opened.
 * `drive` — opens at an extreme and runs one way without looking back.
 * `test-drive` — probes one side first, then drives the other.
 * `rejection-reverse` — pushes one way, fails, reverses back through the open.
 * `auction` — rotates around the open with no conviction.
 */
type OpenType = 'drive' | 'test-drive' | 'rejection-reverse' | 'auction';
interface MarketProfileSessionResult {
    /** UTC seconds of the session's first and last bar. */
    startTime: number;
    endTime: number;
    /** Window name when one was applied — the renderer's session label. */
    label?: string;
    /** Price levels, sorted high -> low. */
    levels: MarketProfileLevel[];
    /** Point of control (price with the most TPOs). */
    poc: number;
    /** Value-area high / low. */
    vah: number;
    val: number;
    /** Session extremes. */
    high: number;
    low: number;
    /** The session's opening and closing trade price. */
    open: number;
    close: number;
    /** Number of periods (letters) in the session. */
    periods: number;
    /** Per-period detail, in order. */
    periodDetail: MarketProfilePeriod[];
    /** Initial balance — price range of the opening `initialBalancePeriods`. */
    initialBalance: {
        high: number;
        low: number;
    };
    /** How far price extended beyond the initial balance each way (0 when none). */
    rangeExtension: {
        up: number;
        down: number;
    };
    /** Prices that printed a single TPO away from the session extremes. */
    singlePrints: number[];
    /** Runs of single prints at the extremes, when `tailEdges` promotes them. */
    buyingTail: {
        high: number;
        low: number;
    } | null;
    sellingTail: {
        high: number;
        low: number;
    } | null;
    /** True when the session high / low printed more than one TPO (weak extreme). */
    poorHigh: boolean;
    poorLow: boolean;
    /** POC / VA after each period closed — the developing track. */
    developing: DevelopingValue[];
    dayType: DayType;
    openType: OpenType;
    /** Volume-weighted POC (most volume, as opposed to the most time). */
    volumePoc: number;
    /** Total traded volume in the session. */
    totalVolume: number;
}
interface MarketProfileResult {
    sessions: MarketProfileSessionResult[];
    options: MarketProfileOptions;
}
/** Period index -> TPO letter (`A`-`Z`, then `a`-`z`, then wraps). */
declare function tpoLetter(period: number): string;
/**
 * Wrap-aware window test, so an overnight session is one window, not two.
 *
 * `zone` is the chart's configured timezone and is only consulted when the
 * window does not name one of its own.
 */
declare function inWindow(utcSeconds: number, w: SessionWindow, zone?: string): boolean;
declare function computeMarketProfile(bars: readonly Bar[], options?: Partial<MarketProfileOptions>): MarketProfileResult;
/**
 * Prior-session levels no later session has traded back through — the "naked"
 * POC / VAH / VAL that so often act as magnets. Oldest first, each tagged with
 * the session it came from.
 */
declare function nakedLevels(result: MarketProfileResult): {
    time: number;
    price: number;
    kind: 'poc' | 'vah' | 'val';
}[];
/** Round a price onto the profile's row grid — handy for hit-testing. */
declare function rowOf(price: number, options: MarketProfileOptions): number;

/**
 * Market Profile / TPO renderer (ARCHITECTURE.md §8, §6A). Draws the output of
 * `computeMarketProfile` on-chart: per-session TPO letter columns, the Point of
 * Control / Value Area lines, Initial Balance, single prints and tails, poor
 * highs / lows, the developing POC-VA track, naked prior levels, day / open type
 * labels and an optional volume sub-profile.
 *
 * A pane primitive — it overlays the price range rather than driving it (though
 * `autoscaleInfo` reports its extent so a profile-only chart still frames).
 *
 * **Letters degrade to bricks automatically.** A TPO row is only as tall as the
 * price scale makes it, so at some zoom level a letter stops fitting. Rather
 * than clip glyphs or make the user toggle a setting, the renderer crossfades:
 * the block is always drawn and the letter fades in over `letterFade` px above
 * `minLetterHeight`, so zooming through the threshold reads as one continuous
 * change instead of a jump.
 */

/**
 * `auto` crossfades letters into bricks as rows get short (the default).
 * `compact` keeps high-contrast letters, using a pixel font in short rows.
 * The remaining modes pin the choice.
 */
type MpBlockDisplay = 'auto' | 'compact' | 'blocks+letters' | 'letters' | 'blocks';
/**
 * What drives a block's colour.
 * `period` — one hue per TPO period, so the session's shape over time is visible.
 * `valueArea` — inside vs outside the value area.
 * `count` / `volume` — heat by TPO count or traded volume at that row.
 * `uniform` — a single colour.
 */
type MpColorMode = 'period' | 'valueArea' | 'count' | 'volume' | 'uniform';
/** Default period palette — 12 hues that stay distinct on a dark background. */
declare const TPO_PERIOD_COLORS: readonly string[];
interface MarketProfilePrimitiveOptions {
    /** `auto` fades letters to bricks; `compact` preserves small pixel glyphs. */
    blockDisplay: MpBlockDisplay;
    /** Row height (px) below which a letter no longer fits and bricks take over. */
    minLetterHeight: number;
    /** Height (px) over which the letter fades in above `minLetterHeight`. */
    letterFade: number;
    /** Width of one TPO column in media px. */
    letterWidth: number;
    /** Letter font size in media px. Auto-shrinks to fit short rows. */
    font: number;
    colorMode: MpColorMode;
    /** Period palette for `colorMode: 'period'`. */
    periodColors: readonly string[];
    color: string;
    vaColor: string;
    opacity: number;
    /** Dim blocks outside the value area to this alpha (1 = no dimming). */
    outsideVaOpacity: number;
    zOrder: ZOrder;
    /** Draw each period in its own column slot instead of packing rows left. */
    split: boolean;
    /** Lowercase `o` beside each session's opening-price row. */
    showSessionOpen: boolean;
    sessionOpenColor: string;
    /** `#` beside the latest close, on the newest supplied session only. */
    showLastPrice: boolean;
    lastPriceColor: string;
    /** Gap in px between session profiles. */
    profileSpacing: number;
    showPoc: boolean;
    pocColor: string;
    pocThickness: number;
    showPocLabel: boolean;
    showValueArea: boolean;
    vahColor: string;
    valColor: string;
    showValueAreaLabels: boolean;
    fillValueArea: boolean;
    valueAreaFillColor: string;
    valueAreaFillOpacity: number;
    showInitialBalance: boolean;
    ibColor: string;
    showSinglePrints: boolean;
    singlePrintColor: string;
    /** Buying / selling tails, when the model promoted them (`tailEdges`). */
    showTails: boolean;
    buyTailColor: string;
    sellTailColor: string;
    /** Mark a session high / low that printed more than one TPO. */
    showPoorHighLow: boolean;
    poorColor: string;
    /** Extend untraded prior POC / VAH / VAL to the right edge. */
    showNakedLevels: boolean;
    nakedColor: string;
    /** Trace the POC / value area as they developed through the session. */
    showDevelopingPoc: boolean;
    developingPocColor: string;
    showDevelopingVa: boolean;
    developingVaColor: string;
    /** Per-level TPO count column, drawn just past the blocks. */
    showTpoCounts: boolean;
    countColor: string;
    /** Session label / day type / open type text above each profile. */
    showSessionLabel: boolean;
    showDayType: boolean;
    showOpenType: boolean;
    labelColor: string;
    showVolumeProfile: boolean;
    volumeProfileWidth: number;
    volumeProfileSide: 'left' | 'right';
    volumeColor: string;
    /** Print volume per row; compact mode uses pixel digits down to 5 physical px. */
    showVolumeValues: boolean;
}
declare const DEFAULT_MARKET_PROFILE_PRIMITIVE_OPTIONS: MarketProfilePrimitiveOptions;
/** Hover payload for a TPO row, for a host-drawn tooltip. */
interface MarketProfileHover {
    sessionIndex: number;
    price: number;
    level: MarketProfileLevel;
    session: MarketProfileSessionResult;
    isPoc: boolean;
    inValueArea: boolean;
    isSinglePrint: boolean;
}
declare class MarketProfile implements IPrimitive {
    private _result;
    private _opts;
    private _host;
    /** Session x-extents from the last paint, for hit-testing (media px). */
    private _boxes;
    private _rowH;
    private _rc;
    private readonly _sessionSplits;
    constructor(result?: MarketProfileResult | null, opts?: Partial<MarketProfilePrimitiveOptions>);
    attached(host: PrimitiveHost): void;
    detached(): void;
    zOrder(): ZOrder;
    options(): MarketProfilePrimitiveOptions;
    autoscaleInfo(): {
        min: number;
        max: number;
    } | null;
    setData(result: MarketProfileResult): void;
    setOptions(patch: Partial<MarketProfilePrimitiveOptions>): void;
    /** Effective display for an index in the current result; false if missing. */
    isSessionSplit(sessionIndex: number): boolean;
    /** Split/unsplit one session. Null restores its global default. */
    setSessionSplit(sessionIndex: number, split: boolean | null): boolean;
    private _sessionKey;
    /** Report the session under the pointer so a host can show a tooltip. */
    hitTest(x: number, y: number): PrimitiveHit | null;
    /**
     * Full hover payload for `(x, y)` in media px. `rc` defaults to the context of
     * the last paint, so a crosshair handler can just call `hoverAt(p.x, p.y)`.
     */
    hoverAt(x: number, y: number, rc?: PrimitiveRenderContext): MarketProfileHover | null;
    draw(ctx: CanvasRenderingContext2D, rc: PrimitiveRenderContext): void;
    /**
     * How opaque the letter is at this row height: 0 below the threshold, 1 well
     * above, linear between. The block stays visible throughout, so the change
     * reads as a fade rather than a swap.
     */
    private _letterAlpha;
    private _blockColor;
    private _drawSession;
    private _drawPriceMarker;
    private _drawVolume;
    /** Step-plot one developing series across the session. */
    private _drawDeveloping;
    /** Untraded prior POC / VAH / VAL, extended to the right edge. */
    private _drawNaked;
}

/**
 * Footprint & order flow (ARCHITECTURE.md §6A, Family C). Per-candle bid/ask
 * volume at each price, delta, and imbalance — plus cumulative delta and
 * stacked-imbalance detection across bars.
 *
 * DATA DEPENDENCY (honest): this needs trade-by-trade data classified bid/ask
 * (was each print at the bid or the ask?). OpenAlgo serves live depth + tick LTP
 * but does not store historical classified trades by default, so footprint is
 * either live-session-only or needs a tick-recorder backend. The computation
 * here is pure and broker-agnostic; feeding it is the integration step.
 */

interface ClassifiedTrade {
    price: number;
    qty: number;
    /** Whether the print hit the bid (sell-initiated) or the ask (buy-initiated). */
    side: 'bid' | 'ask';
}
/**
 * Build one bar's footprint from its classified trades.
 *
 * `rowTicks` is the same multiplier the market profile uses: rows are
 * `tickSize * rowTicks` tall, so a trader can widen bricks without pretending
 * the instrument has a coarser tick. Nifty at 0.1 with 2-point bricks is
 * `computeFootprint(t, trades, 0.1, 20)`.
 */
declare function computeFootprint(time: number, trades: readonly ClassifiedTrade[], tickSize: number, rowTicks?: number): FootprintBar;
interface Imbalance {
    price: number;
    side: 'buy' | 'sell';
}
/**
 * Diagonal imbalances compare ask at P with bid one row below, and bid at P
 * with ask one row above. Missing rows are never bridged or synthesized.
 * Supply rowSize for sparse ladders; legacy callers infer the minimum observed
 * gap, which cannot distinguish uniformly missing rows from a coarser grid.
 * Positive volume against a zero opposing volume is an imbalance; zero against
 * zero is not. threshold is the minimum dominant-side quantity (inclusive).
 */
declare function diagonalImbalances(cells: readonly FootprintCell[], ratio?: number, rowSize?: number, threshold?: number): Imbalance[];
/** Running cumulative delta across a sequence of footprint bars. */
declare function cumulativeDelta(bars: readonly FootprintBar[]): number[];
interface StackedImbalance {
    startPrice: number;
    endPrice: number;
    side: 'buy' | 'sell';
    count: number;
}
/** Runs of minStack+ adjacent diagonal imbalances, tracked independently per side. */
declare function stackedImbalances(cells: readonly FootprintCell[], ratio?: number, minStack?: number, rowSize?: number, threshold?: number): StackedImbalance[];

/**
 * Horizontal profile renderer (ARCHITECTURE.md §6A): volume-at-price / TPO-count
 * bars drawn sideways with POC + Value-Area lines. A pane primitive that
 * overlays the existing price range, so it does not drive autoscale.
 *
 * The footprint renderer lives in `footprint-primitive.ts`.
 */

interface ProfileLevel {
    price: number;
    value: number;
}
interface HorizontalProfileOptions {
    buckets: ProfileLevel[];
    poc: number;
    vah: number;
    val: number;
    /** Strip width in media px. */
    width: number;
    side: 'left' | 'right';
    barColor: string;
    vaColor: string;
}
declare class HorizontalProfile implements IPrimitive {
    private _opts;
    private _host;
    constructor(opts: HorizontalProfileOptions);
    attached(host: PrimitiveHost): void;
    detached(): void;
    zOrder(): ZOrder;
    autoscaleInfo(): null;
    setData(opts: HorizontalProfileOptions): void;
    draw(ctx: CanvasRenderingContext2D, rc: PrimitiveRenderContext): void;
}

/** Text coloring is independent of the footprint's background display mode. */
type FootprintTextColorMode = 'contrast' | 'side' | 'delta' | 'dominant' | 'imbalance' | 'volume';

/** Footprint columns, volume profiles and cluster ladders from classified trades. */

type FootprintStatRow = 'volume' | 'bidVolume' | 'askVolume' | 'delta' | 'minDelta' | 'maxDelta' | 'deltaPct' | 'cvd' | 'trades';
type FootprintDisplayMode = 'bidask' | 'delta' | 'volume';
type FootprintCellStyle = 'heatmap' | 'profile' | 'ladder';

interface FootprintOptions {
    /** Preferred full column width in media px, capped to the available bar slot. */
    cellWidth?: number;
    /** Fraction of the bar slot occupied by the column and candle. Default 0.9. */
    widthFactor: number;
    /** Effective price step (tickSize * rowTicks). Overrides bar.rowSize. */
    tickSize?: number;
    font: number;
    minTextHeight: number;
    textFade: number;
    displayMode: FootprintDisplayMode;
    /** Display quantities divided by this positive value; 1 shows raw units. Stats remain raw. */
    volumeDivisor: number;
    /** Intensity cells, volume-proportional bars, or square high-contrast cells. */
    cellStyle: FootprintCellStyle;
    /** Text comparisons are independent of the cell background. */
    textColorMode: FootprintTextColorMode;
    textColor?: string;
    buyTextColor?: string;
    sellTextColor?: string;
    imbalanceRatio: number;
    imbalanceThreshold: number;
    /** Adjacent same-side imbalance run length. 0 disables brackets. */
    stackedImbalances: number;
    statsRows: readonly FootprintStatRow[];
    /** Ordered rows for a separate table below the footprints. Empty disables it (default). */
    tableRows: readonly FootprintStatRow[];
    /** Fixed table label column width in media px. Default 150. */
    tableLabelWidth: number;
    statsRowHeight: number;
    /** Fixed pane footer or labeled cards beneath each bar. */
    statsPosition: 'bottom' | 'bar';
    /** Cumulative delta preceding the supplied bars, for a rolling window. */
    cvdOffset: number;
    /** Draw real OHLC if supplied; legacy bars show a neutral range line. */
    showCandle: boolean;
    showPoc: boolean;
    pocStyle: 'marker' | 'outline';
    showValueArea: boolean;
    /** Fraction of volume in the contiguous value area around the POC. */
    valueAreaPercent: number;
    valueAreaColor?: string;
    buyColor?: string;
    sellColor?: string;
    pocColor: string;
    radius: number;
}
declare const DEFAULT_FOOTPRINT_OPTIONS: FootprintOptions;
interface FootprintBarStats {
    time: number;
    volume: number;
    bidVolume: number;
    askVolume: number;
    delta: number;
    /** Intrabar running delta extremes, including initial zero; null without trade-path metadata. */
    minDelta: number | null;
    maxDelta: number | null;
    deltaPct: number;
    cvd: number;
    /** Null when a legacy input does not include an actual trade count. */
    trades: number | null;
    poc: number;
    vah: number;
    val: number;
}
interface FootprintHover {
    time: number;
    /** The exact bucket price; null over a statistics card/table. */
    price: number | null;
    cell: FootprintCell | null;
    stats: FootprintBarStats;
}
/** Three significant figures, preserving fractional quantities and suffix rollover. */
declare function compactVol(v: number): string;
declare class Footprint implements IPrimitive {
    private _bars;
    private _opts;
    private _host;
    private _stats;
    /** Only visible painted rows/cards are interactive, in media pixels. */
    private _cols;
    private _rc;
    private _inferredStep;
    constructor(opts?: Partial<FootprintOptions>);
    attached(host: PrimitiveHost): void;
    detached(): void;
    zOrder(): ZOrder;
    private _validateOptions;
    setBars(bars: readonly FootprintBar[]): void;
    setOptions(patch: Partial<FootprintOptions>): void;
    options(): FootprintOptions;
    stats(): readonly FootprintBarStats[];
    private _step;
    autoscaleInfo(): {
        min: number;
        max: number;
    } | null;
    private _recomputeStats;
    /** Price boundaries, not a minimum pixel size: tiny rows must never overlap. */
    private _bounds;
    draw(ctx: CanvasRenderingContext2D, rc: PrimitiveRenderContext): void;
    private _drawColumn;
    private _drawCandle;
    private _cell;
    private _drawCard;
    private _drawFooter;
    private _statColor;
    private _metric;
    private _statText;
    hitTest(x: number, y: number): PrimitiveHit | null;
    hoverAt(x: number, y: number, rc?: PrimitiveRenderContext): FootprintHover | null;
}

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
/**
 * The three time-agnostic modes `TickBarAggregator` shipped with. Kept as a
 * distinct name because `FootprintAggregator` handles exactly these three.
 */
type TickTimeframe = IntervalBucketing | TickCountBucketing | VolumeBucketing;

/**
 * Streaming footprint aggregator (ARCHITECTURE.md §6A, §9.4). Ingests classified
 * trade ticks (price, qty, bid/ask) and aggregates them into footprint bars on a
 * timeframe (interval / tick-count / volume) — the live orderflow pipeline.
 * Incremental: the current bar updates per tick; a new bar opens at the boundary.
 *
 * Requires classified bid/ask trade ticks. OpenAlgo doesn't store these by
 * default, so feed it from a live WS classifier or a tick-recorder backend.
 */

interface FootprintTick extends ClassifiedTrade {
    time: number;
}
interface FootprintUpdate {
    bar: FootprintBar;
    isNew: boolean;
}
declare class FootprintAggregator {
    private readonly _tf;
    private readonly _tickSize;
    private _time;
    private _cells;
    private _delta;
    private _minDelta;
    private _maxDelta;
    private _count;
    private _volume;
    private _open;
    private _lastTickTime;
    private _openPrice;
    private _high;
    private _low;
    private _close;
    /**
     * `rowTicks` widens each brick to `tickSize * rowTicks` — the same multiplier
     * the market profile uses, so an instrument's real tick stays honest while the
     * ladder stays readable. Nifty at 0.1 with 2-point bricks is `(tf, 0.1, 20)`.
     */
    constructor(tf: TickTimeframe, tickSize: number, rowTicks?: number);
    private _snapshot;
    current(): FootprintBar | null;
    private _intervalKey;
    /**
     * Ticks must arrive in timestamp order (equal timestamps are accepted).
     * Count/volume bars coalesce trades sharing their opening timestamp until
     * time advances, so chart time keys remain unique. Such bars may exceed the
     * requested count/volume; volume trades are never split between bars.
     */
    onTick(tick: FootprintTick): FootprintUpdate;
}

declare const PROFILE_TIER: "profile";

export { type ClassifiedTrade, DEFAULT_FOOTPRINT_OPTIONS, DEFAULT_MARKET_PROFILE_OPTIONS, DEFAULT_MARKET_PROFILE_PRIMITIVE_OPTIONS, DEFAULT_VOLUME_PROFILE_FAMILY_OPTIONS, DEFAULT_VOLUME_PROFILE_PRIMITIVE_OPTIONS, type DayType, type DevelopingValue, Footprint, FootprintAggregator, type FootprintBar, type FootprintBarStats, type FootprintCell, type FootprintCellStyle, type FootprintDisplayMode, type FootprintHover, type FootprintOptions, type FootprintStatRow, type FootprintTextColorMode, type FootprintTick, type FootprintUpdate, HorizontalProfile, type HorizontalProfileOptions, type Imbalance, MarketProfile, type MarketProfileHover, type MarketProfileLevel, type MarketProfileOptions, type MarketProfilePeriod, type MarketProfilePrimitiveOptions, type MarketProfileResult, type MarketProfileSession, type MarketProfileSessionResult, type MpBlockDisplay, type MpColorMode, type OpenType, PROFILE_TIER, type ProfileLevel, type SessionWindow, type StackedImbalance, TPO_PERIOD_COLORS, TRADING_HOURS, type TpoResult, type VolumeDisplayMode, VolumeProfile, type VolumeProfileFamilyOptions, type VolumeProfileFamilyResult, type VolumeProfileLevel, type VolumeProfileOptions, type VolumeProfilePrimitiveOptions, type VolumeProfileResult, type VolumeProfileSession, type VolumeProfileSessionResult, type VolumeProfileSide, bucketPrice, compactVol, computeFootprint, computeMarketProfile, computeTpo, computeVolumeProfile, computeVolumeProfileSessions, cumulativeDelta, diagonalImbalances, inWindow, nakedLevels, priceBuckets, rowOf, rowTicksFor, stackedImbalances, tpoLetter };
