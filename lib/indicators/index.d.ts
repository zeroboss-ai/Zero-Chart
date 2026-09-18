import { IndicatorDescriptor, ChartDataContext, IndicatorSettings, Bar, IndicatorInput, IndicatorPlot, IndicatorLevel } from 'openalgo-charts';

declare const SMA: IndicatorDescriptor;
declare const WMA: IndicatorDescriptor;
declare const EMA: IndicatorDescriptor;
declare const BOLLINGER: IndicatorDescriptor;
declare const VWAP: IndicatorDescriptor;
declare const SUPERTREND: IndicatorDescriptor;
declare const PARABOLIC_SAR: IndicatorDescriptor;
declare const ICHIMOKU: IndicatorDescriptor;
/**
 * HalfTrend — a trend-following level that only moves against the trend once
 * the opposing side of the range genuinely gives way, so it holds flat through
 * noise where a moving average would wobble.
 *
 * Two state machines run at once. `trend` is what is drawn; `nextTrend` is which
 * flip is currently *armed*. While a down-flip is armed the indicator tracks the
 * running maximum of the `amplitude`-bar low; the flip only fires when the mean
 * high drops under that maximum **and** the bar closes below the previous bar's
 * low. The up-flip is the mirror. Requiring both a mean crossing and a close
 * beyond the prior bar's extreme is what keeps the level still.
 *
 * On a flip the new level starts from the level the other side ended on, which
 * is why the line steps rather than jumping to price. `channelDeviation` half-ATR
 * bands ride the level as a channel, and the flip bar is marked half an ATR
 * inside the channel.
 *
 * Original implementation written from the algorithm's published behaviour, per
 * ARCHITECTURE.md §0.1 — not ported from any third-party source.
 */
declare const HALFTREND: IndicatorDescriptor;

declare const RSI: IndicatorDescriptor;
declare const MACD: IndicatorDescriptor;
declare const STOCHASTIC: IndicatorDescriptor;
declare const ADX: IndicatorDescriptor;
declare const CCI: IndicatorDescriptor;
declare const MFI: IndicatorDescriptor;
declare const ATR: IndicatorDescriptor;
/**
 * CM Williams Vix Fix — a synthetic VIX from price alone.
 *
 * `wvf` is how far the current low sits below the highest close of the lookback,
 * as a percentage: a spike means capitulation. The signal is not the level but
 * the *breakout* — `wvf` piercing its own Bollinger upper band, or the top
 * percentile of its recent range — so the histogram carries two colours and the
 * bands are what it is measured against.
 */
declare const WILLIAMS_VIX_FIX: IndicatorDescriptor;

/**
 * Tier-1 volume indicators, computed from the chart's own OHLCV.
 * Part of the lazy `openalgo-charts/indicators` tier.
 */

declare const VOLUME: IndicatorDescriptor;
declare const OBV: IndicatorDescriptor;
declare const ADL: IndicatorDescriptor;

/**
 * The source is hard-coded to `close` in the reference (`source = close`,
 * not an `input`), so there is no source setting to expose.
 */
declare const ALMA: IndicatorDescriptor;
/**
 * `2 * ema - ema(ema)`. The second pass runs over a series that is already NaN
 * for its own warmup, which is what pushes the first plotted bar out to
 * `2 * length - 2`, see `emaOfGapped`.
 */
declare const DEMA: IndicatorDescriptor;
declare const HMA: IndicatorDescriptor;
declare const ENVELOPE: IndicatorDescriptor;
declare const DONCHIAN: IndicatorDescriptor;
/**
 * Two stacked extremes: an ATR-padded high/low band, then the running extreme of
 * *that* over `q` bars, which is what keeps each stop monotone through a pullback.
 * The second pass is NaN-strict (`extremeStrict`), so nothing prints until the
 * whole `q`-bar window is past the ATR warmup, bar `p + q - 2`.
 *
 * The long stop is padded off the lowest **low**, which is the published
 * definition and what the short stop mirrors. The reference implementation takes
 * both extremes over the high series (it never reads a low at all), so the two
 * long stops disagree by roughly the average high-low range while the short
 * stops agree to the last bit. Measured, deliberate, and left alone: matching it
 * would move a stop line for every existing user onto a reading that the
 * published definition of this stop contradicts.
 */
declare const CHANDE_KROLL_STOP: IndicatorDescriptor;
/**
 * The reference imports an external helper library and calls `an external `chandelier()` helper`, whose
 * body is not in the reference file. This is the published definition of that stop:
 * the highest high of the window pulled down by `mult` ATRs, and its mirror.
 */
declare const CHANDELIER_EXIT: IndicatorDescriptor;
/**
 * Bands centred on the regression **endpoint**, not on a moving average of price:
 * the fitted line's value at the newest bar of the window, pushed out by
 * `errors` standard errors, and only then smoothed. The middle plot is that
 * smoothed endpoint, so it is not the same line as a plain regression curve.
 * All three legs are smoothed independently, which is why the first bar of each
 * lands at `(periods - 1) + (averagePeriods - 1)`.
 */
declare const STANDARD_ERROR_BANDS: IndicatorDescriptor;
/**
 * Two independent legs, a mean of highs and a mean of lows, each with its own
 * length and its own plot-time displacement. Not a mean of the close with a
 * spread around it, and simple throughout: there is no smoothing method here.
 */
declare const MA_CHANNEL: IndicatorDescriptor;
/**
 * Hull Suite: one hull average plotted twice, the second copy displaced two
 * bars. The band is therefore the average against its own recent past rather
 * than a second study, and "the first plot is above the second" is exactly the
 * rising condition, which is what lets a plain two-colour fill carry the trend.
 *
 * Three variations are offered because they trade lag against smoothness
 * differently, and two quirks of the published definition are preserved rather
 * than tidied: the Thma branch is handed half the length the other two get, and
 * the intermediate lengths truncate while only the outer square root rounds.
 * Anyone reading this beside the study they already run needs the same line.
 *
 * Deliberately not offered, because nothing here could back them: a line
 * thickness input (`style.lineWidth` is static and there is no width settings
 * key), a band transparency input (`opacity` is a fixed number on the fill spec,
 * not a settings key), and a higher-timeframe mode (`calc` is handed the chart's
 * own bars and has no way to request another resolution).
 */
declare const HULL_SUITE: IndicatorDescriptor;
declare const OVERLAY_INDICATORS: readonly IndicatorDescriptor[];

/**
 * Aroon — how recently the window made its extreme, as a percentage of the
 * window.
 *
 * `highestbars` answers "how many bars back is the high" as a **negative
 * offset**, `0` meaning the current bar. The whole study is that offset mapped
 * onto 0..100, so the sign convention is load-bearing: a fresh high gives
 * `100 * (0 + length) / length` = exactly 100, and a high at the far edge of
 * the window gives 0. Note the window is `length + 1` bars, not `length` —
 * the reference counts the gaps between bars, not the bars.
 */
declare const AROON: IndicatorDescriptor;
/**
 * Aroon Oscillator — Aroon Up minus Aroon Down, so a single line through zero.
 *
 * The reference colours the *line* by sign and shades it to a hidden zero plot. This
 * library's line renderer has no per-bar colour (only histogram and column
 * honour `colorBy`), so the sign is carried by the band instead, which is what
 * actually reads on a chart. `zero` is a value column with no plot, exactly as
 * the reference `display.none` zero plot is: it exists only to give the fill a
 * second edge.
 */
declare const AROON_OSCILLATOR: IndicatorDescriptor;
/**
 * Awesome Oscillator — the gap between a fast and a slow midpoint average.
 *
 * The reference hard-codes 5 and 34 and exposes no inputs, so neither does this: the
 * two periods are the definition of the study, not a preference. Colour is the
 * second half of the signal — green while the histogram is building against the
 * previous bar, red while it is fading — and that is a per-bar decision, hence
 * `colorBy` on one column rather than two plots that would each carry holes.
 * On the first printed bar the previous value is `na`, and the reference `na <= 0` is
 * false, so it starts green.
 */
declare const AWESOME_OSCILLATOR: IndicatorDescriptor;
/**
 * Balance of Power — where the close finished inside the bar's range, relative
 * to where it opened. No smoothing and no inputs; the reference is one line.
 *
 * A zero-range bar makes this 0/0, which is `na` in the reference, so it draws a gap
 * rather than a spike.
 */
declare const BALANCE_OF_POWER: IndicatorDescriptor;
/**
 * Chande Momentum Oscillator — the same up/down split as RSI, but as a plain
 * ratio of summed moves instead of a Wilder average, so it swings the full
 * -100..100 rather than compressing towards the middle.
 *
 * `change` is `na` on the first bar, so the first published value is the one
 * backed by `length` real changes: index `length`, not `length - 1`. The sums
 * are therefore taken over the series from bar 1 onwards, which also keeps the
 * running total in `rollingSum` from ever touching a NaN — one NaN would poison
 * it for the rest of the series, because subtracting it back out when it leaves
 * the window does not undo it.
 */
declare const CHANDE_MOMENTUM: IndicatorDescriptor;
/**
 * Coppock Curve — a weighted average of two rates of change, one long and one
 * short. Both `roc` terms must have a value before the WMA has anything to
 * chew on, so the first print lands at `longRoCLength + wmaLength - 1`.
 */
declare const COPPOCK_CURVE: IndicatorDescriptor;
/**
 * Detrended Price Oscillator — price against a moving average taken from half a
 * cycle ago, which strips the trend and leaves the cycle.
 *
 * `barsback = period/2 + 1` indexes a series, so it has to be a whole number:
 * the reference integer division truncates, and this floors, which agrees for both odd
 * and even lengths (21 -> 11, 20 -> 11).
 *
 * The `centered` mode is the awkward one. the reference computes `close[barsback] - ma`
 * and then draws it with `offset = -barsback`, i.e. shifted back in time.
 * Plots here have no per-plot offset, so the shift is folded into the column
 * itself: the value drawn at bar `i` is the one the reference computed on bar
 * `i + barsback`, which reduces to `close[i] - ma[i + barsback]`. The picture
 * matches the reference platform exactly, including the fact that the centered line stops
 * `barsback` bars short of the right edge. The non-centered mode needs no such
 * trick and is implemented straight.
 */
declare const DPO: IndicatorDescriptor;
/**
 * Fisher Transform — squash the position of `hl2` inside its recent range into
 * -1..1, then run it through the inverse hyperbolic tangent so the tails
 * stretch out and turning points become sharp.
 *
 * Two recursions, each carrying two thirds / one half of the previous bar. The
 * clamp to +/-0.999 is not cosmetic: at exactly +/-1 the log blows up, so the
 * the reference `round_` is what keeps the series finite. Both recursions read the
 * previous bar through `nz`, so a missing previous value counts as 0 — which
 * happens on the first printed bar and again after any bar that produced `na`.
 * A flat window (`high_ == low_`) is not one of those: the range divide is
 * floored at 0.001, so the ratio is 0, the bar still prints, and both
 * recursions carry on.
 *
 * `Trigger` is simply `fish1[1]`, so it lags Fisher by exactly one bar.
 */
declare const FISHER_TRANSFORM: IndicatorDescriptor;
/**
 * The Connors "updown" streak: how many consecutive bars price has risen or
 * fallen, signed. An unchanged close resets it to 0; a rise continues a
 * positive run or starts a new one at +1; a fall mirrors that.
 *
 * Exported because it is the one piece of Connors RSI worth testing on its own
 * — the rest is three well-known series averaged.
 *
 * Bar 0 is deliberately -1, not 0. In the reference `close == close[1]` and
 * `close > close[1]` are both false against `na`, so the first bar falls into
 * the down branch with `nz(ud[1])` reading 0, which yields -1.
 */
declare function connorsStreak(values: readonly number[]): number[];
/**
 * Connors RSI — the mean of three unrelated readings of the same bar: how
 * overbought price is (a short RSI), how stretched the up/down streak is (an
 * RSI of the streak itself), and where today's one-bar return sits in its own
 * recent distribution (a percent rank).
 *
 * Averaging only works if all three have a value, and the percent rank is the
 * slow one: `roc(close, 1)` is `na` on bar 0, and `percentrank` compares
 * the current value against the previous `lenroc` of them, so the first
 * complete reading is at index `lenroc + 1` — 101 on defaults. Running the rank
 * over the series from bar 1 is what keeps that `na` out of the window.
 */
declare const CONNORS_RSI: IndicatorDescriptor;
declare const OSCILLATOR_INDICATORS: readonly IndicatorDescriptor[];

/**
 * Bollinger Bands %b: where the source sits inside its own bands, rescaled so
 * the lower band is 0 and the upper is 1. Unbounded on purpose: the reading
 * only becomes interesting once it leaves 0..1, which is why the pane declares
 * no fixed range.
 */
declare const BOLLINGER_PERCENT_B: IndicatorDescriptor;
/**
 * Bollinger BandWidth: the band spread as a percentage of the basis, so it is
 * comparable across instruments and across price levels.
 *
 * The two companion plots are rolling extremes **of the bandwidth itself**, not
 * of price: they turn "is this narrow?" from a judgement call into a comparison
 * against the last N bars of the same series.
 */
declare const BOLLINGER_BANDWIDTH: IndicatorDescriptor;
/**
 * BBTrend: a short and a long Bollinger set compared band for band. When the
 * short set's lower band has pulled further from the long set's lower band than
 * the two upper bands have separated, the short-term range is expanding
 * downward and the reading is negative; the reverse is positive. Normalised by
 * the short basis so it reads as a percentage.
 */
declare const BB_TREND: IndicatorDescriptor;
/**
 * Choppiness Index: how much ground the bar-by-bar travel covers compared with
 * the net range it produced. A market that retraces everything spends the full
 * `length` bars of true range inside one range and reads near 100; a trend
 * covers the same range in a fraction of the travel and reads low.
 *
 * the reference writes the numerator as `sum(atr(1), length)`. `atr(1)` is
 * `rma(tr, 1)`, which is the true range itself, so this is a plain rolling sum
 * of true range, including bar 0, where the reference true range is `high - low`.
 */
declare const CHOPPINESS_INDEX: IndicatorDescriptor;
/**
 * Historical Volatility: the annualised standard deviation of log returns.
 *
 * the reference derives the annualisation divisor from the chart's timeframe:
 * `per = timeframe.isintraday or (timeframe.isdaily and multiplier == 1) ? 1 : 7`.
 * A descriptor here is handed bars and settings and nothing else. It cannot
 * see the timeframe, and guessing one from bar spacing would silently change
 * the plot on a gappy or irregular series. So `per` is an input: leave it at 1
 * for intraday and daily charts, set it to 7 for weekly and above, which is
 * exactly the branch the reference takes.
 */
declare const HISTORICAL_VOLATILITY: IndicatorDescriptor;
/**
 * Average Daily Range: the mean high-to-low range over `length` bars. "Daily"
 * is the reference platform's name for it; the calculation is per bar, whatever the chart
 * timeframe is.
 */
declare const AVERAGE_DAILY_RANGE: IndicatorDescriptor;
/**
 * Chop Zone: the slope of a 34-bar EMA, read as an angle and bucketed into a
 * nine-colour ladder from turquoise (steep rise) through yellow (flat) to dark
 * red (steep fall).
 *
 * The plot itself is a constant 1: every bar is the same height and all the
 * information is in the colour. That is not a stylistic choice we can improve
 * on: it is the study. The slope is made comparable across instruments by
 * `span`, which rescales it against the 30-bar range, so the angle means the
 * same thing on a 20-rupee stock and a 20000-point index.
 *
 * `angle` is returned as an unplotted column so `colorBy` can read it; the
 * ladder is a property of the bar, not of the value being plotted.
 */
declare const CHOP_ZONE: IndicatorDescriptor;
/**
 * Chaikin Volatility: the rate of change of a smoothed high-to-low range, so it
 * answers "is the bar getting wider?" rather than "how wide is it?".
 *
 * The smoother is an EMA, not an SMA: an average of ranges reacts to a single
 * wide bar for `periods` bars and then drops it in one step, which prints a
 * spurious second move on the rate of change. Zero is the neutral reading, and
 * a zero denominator (a period of perfectly flat bars) has no rate of change to
 * report, so it stays a gap rather than becoming Infinity.
 */
declare const CHAIKIN_VOLATILITY: IndicatorDescriptor;
/**
 * Standard Deviation: the population standard deviation of the close over
 * `periods` bars, scaled by `deviations` so it can be read as the same band
 * width a Bollinger set would draw.
 */
declare const STANDARD_DEVIATION: IndicatorDescriptor;
/**
 * Standard Error: the residual spread of the closes about the least-squares
 * line fitted through them, which is what makes it an *error* rather than a
 * deviation. Two degrees of freedom go into the fitted slope and intercept, so
 * the divisor is `length - 2` and the input cannot go below 3.
 */
declare const STANDARD_ERROR: IndicatorDescriptor;
declare const VOLATILITY_INDICATORS: readonly IndicatorDescriptor[];

/**
 * Built-in volume studies, ported to descriptor form.
 * Part of the lazy `openalgo-charts/indicators` tier.
 *
 * Each `calc` reproduces the published reference definition numerically, warmup gaps
 * included, so a plot here lines up bar for bar with the same study on
 * the reference platform. Where the published reference definitions differ from this library's own
 * helpers the reference-compatible variant in `./calc` is used: `smaSeededEma`, never the
 * base bundle's `ema`, because the two seed from different windows and would
 * disagree for the first `length` bars of every plot that touches them.
 */

/**
 * Chaikin Money Flow — the money-flow term summed over the window and
 * normalised by the volume traded in that same window, so the reading is a
 * bounded -1..+1 share of participation rather than a raw quantity.
 */
declare const CHAIKIN_MONEY_FLOW: IndicatorDescriptor;
/**
 * Chaikin Oscillator — a MACD of the A/D line.
 *
 * The two EMAs run over the *running total* of the money-flow term (the reference
 * `accdist`), not the per-bar term, so what the oscillator measures is
 * acceleration in accumulation rather than the flow itself.
 */
declare const CHAIKIN_OSCILLATOR: IndicatorDescriptor;
/**
 * Ease of Movement — how far the midpoint travelled per unit of volume, scaled
 * by the bar's range and by a divisor that only exists to bring the number into
 * a readable magnitude.
 */
declare const EASE_OF_MOVEMENT: IndicatorDescriptor;
/**
 * Elder Force Index — the bar's price change weighted by the volume behind it,
 * smoothed. Direction and conviction in one number: a large move on thin
 * volume scores less than a small move the whole market took part in.
 */
declare const ELDER_FORCE_INDEX: IndicatorDescriptor;
/**
 * Net Volume: the bar's own volume, signed by the direction its close took.
 *
 * There is no warmup gap. Bar 0 has no previous close, so neither the up test
 * nor the down test can hold and the reference falls through to its zero arm;
 * an unchanged close lands on that same arm later in the series. Blanking bar 0
 * instead would put a hole in a series that is defined on every other bar.
 */
declare const NET_VOLUME: IndicatorDescriptor;
/** Every the reference platform volume built-in in this module, in picker order. */
declare const FLOW_INDICATORS: readonly IndicatorDescriptor[];

/**
 * Kaufman's Adaptive Moving Average: an EMA whose smoothing constant is chosen
 * bar by bar from how *directed* the recent move was.
 *
 * The efficiency ratio divides the net distance travelled over `erLength` bars by
 * the total path walked to get there. A clean trend covers ground in a straight
 * line and scores near 1, which pulls the smoothing toward the fast alpha and the
 * average onto price; chop retraces itself, scores near 0, and the average all but
 * stops. Squaring the interpolated alpha is what makes that transition abrupt
 * rather than linear, so KAMA sits flat through noise instead of drifting.
 *
 * The reference delegates to `an external `kama()` helper`, whose body is not in the file, so
 * this follows Kaufman's published definition. It first prints at `erLength`, the
 * earliest bar where both legs of the ratio exist, seeded there on the source
 * itself, because there is no prior average to carry forward.
 */
declare const KAMA: IndicatorDescriptor;
/**
 * Keltner Channels: a moving average with volatility rails, where the rail width
 * is a range measure rather than a standard deviation. That is the whole point of
 * the study: Bollinger's bands widen on *dispersion of closes*, Keltner's on how
 * much ground each bar actually covers, so the two disagree exactly when a market
 * gaps or trends in one direction without spreading its closes out.
 *
 * Three rail sources are offered because they answer different questions. ATR (the
 * default) smooths the range over its own `atrlength`, so the rails breathe slowly.
 * True Range uses the raw bar, so a single wide bar throws the rails out on that
 * bar alone. Range is Wilder-smoothed high-minus-low over the channel `length`,
 * ignoring gaps entirely. Each has its own warmup, and the plotted band starts at
 * whichever of the rail and the basis is slower.
 */
declare const KELTNER_CHANNEL: IndicatorDescriptor;
/**
 * Least Squares Moving Average: the endpoint of a least-squares line fitted over
 * the last `length` bars, so unlike an SMA it has no lag against a straight trend:
 * fit a line to a line and you get the line back.
 *
 * `offset` steps back down that same fitted line rather than re-fitting, which is
 * why it can shift the plot without changing its shape. See the x-axis convention
 * on `linreg` in `./calc`: x is 0 at the oldest bar of the window.
 */
declare const LSMA: IndicatorDescriptor;
/**
 * Klinger Oscillator: volume signed by the direction of the typical price, then
 * read as a MACD-style spread of two EMAs. Signing is what separates it from a
 * plain volume study: a heavy bar only counts as accumulation if `hlc3` actually
 * rose, so churn at an unchanged price nets out instead of registering as force.
 *
 * Two chained warmups stack here. The slow leg cannot print before bar 54, so the
 * spread cannot either; the signal EMA then runs over a series that is `na` up to
 * that point and the reference re-seeds it from an SMA, pushing its first bar a further
 * `KLINGER_SIGNAL - 1` out. See `emaOfGapped`.
 */
declare const KLINGER_OSCILLATOR: IndicatorDescriptor;
/**
 * Know Sure Thing: four rate-of-change readings taken over lengthening horizons,
 * each smoothed, then summed with weights 1/2/3/4 so the slowest cycle dominates.
 * The point is that a single ROC is a statement about one horizon; KST asks
 * whether short, medium, and long momentum agree, and weights the answer toward
 * the horizon least likely to be noise.
 *
 * Every term carries its own warmup and the sum is only real once the slowest one
 * is. With the defaults that is bar 44, `roclen4 + smalen4 - 1`. The signal SMA
 * then runs over a series with that gap in front of it, so it starts `siglen - 1`
 * bars later again; `sma` in `./calc` refuses any window holding a warmup slot,
 * which is what makes both boundaries fall where the reference puts them.
 */
declare const KNOW_SURE_THING: IndicatorDescriptor;
/**
 * Linear Regression Slope: the gradient of the least-squares line fitted over the
 * last `periods` closes, in price per bar.
 *
 * It asks a different question from LSMA, which plots where that same line ends.
 * Dropping the level and keeping only the gradient is what lets the study say
 * that an advance is still an advance but no longer as steep, at a bar where
 * price itself is making a new high. Zero is the whole reading: above it the fit
 * rises, below it the fit falls.
 *
 * The x axis is unit-spaced and the reference scales the result by nothing, so
 * the answer is per bar rather than per window. Only that spacing matters: a
 * least-squares slope is unchanged by shifting x, so running x from 1 to
 * `periods` (the reference's own convention, newest bar highest) and running it
 * from 0 give the identical number.
 */
declare const LINREG_SLOPE: IndicatorDescriptor;
declare const ADAPTIVE_INDICATORS: readonly IndicatorDescriptor[];

/**
 * `close` is hard-coded in the reference (`sma(close, ...)`, not an
 * `input`), so there is no source setting to expose.
 *
 * The long length defaults to 26, not 21: the reference pairs 9 against 26. A
 * saved chart that never set the length explicitly draws a slower line now.
 */
declare const MA_CROSS: IndicatorDescriptor;
/**
 * McGinley Dynamic — an average whose smoothing constant is itself a function of
 * how far price has run from the line, so it tightens in a trend and loosens in
 * a range instead of lagging by a fixed number of bars.
 *
 * Recursive, and the reference seeds it from `ema(source, length)` for as long as its
 * own previous value is `na`: the first printed bar is therefore `length - 1`,
 * where the EMA first prints, and the recursion takes over from the bar after.
 * `close` is hard-coded in the reference (`source = close`), so there is no
 * source setting.
 */
declare const MCGINLEY_DYNAMIC: IndicatorDescriptor;
/**
 * Median — the nearest-rank 50th percentile of the source, banded by ATR and
 * shaded against its own EMA. The percentile is a real member of the window
 * rather than an interpolation (see `percentileNearestRank`), so on an
 * even-length window it is the upper of the two middles, not their mean.
 *
 * The EMA is chained onto the percentile series, so it inherits that series'
 * warmup and first prints at `2 * length - 2` — see `emaOfGapped`.
 */
declare const MEDIAN: IndicatorDescriptor;
/**
 * Moving Average Ribbon — four independent averages on one overlay, so the
 * spacing between them reads as trend strength and their order as trend
 * direction. Every lane picks its own kernel, source, and length.
 *
 * the reference hides a lane by setting `display.none` on the plot; here a hidden lane
 * returns an all-null column, which draws nothing and keeps autoscale clean.
 */
declare const MA_RIBBON: IndicatorDescriptor;
/**
 * Triple EMA — `3 * (ema1 - ema2) + ema3`, which cancels the lag of a linear
 * trend exactly rather than merely reducing it.
 *
 * Three chained EMAs, each running over a series that is already `na` for its
 * own warmup, so the first printed bar is `3 * length - 3` and not `length - 1`
 * — see `emaOfGapped`. `close` is hard-coded in the reference, so there is no
 * source setting.
 */
declare const TEMA: IndicatorDescriptor;
/**
 * Time Weighted Average Price — the running mean of the source since the anchor,
 * the volume-blind sibling of VWAP. Where VWAP asks what the average traded
 * price was, TWAP asks what the average quoted price was, so a thin bar counts
 * for exactly as much as a heavy one.
 *
 * Anchor substitution: the reference takes an `input.timeframe` (default `1D`) and resets
 * on `timeframe.change(anchor)`, which needs a resolution resolver a chart
 * library does not have. The `session` option resets on the exchange's own
 * trading day, read back from the bar gaps exactly as the VWAP descriptor
 * anchors, and `continuous` never resets. The option used to be labelled
 * "Session (IST day)"; it names no zone now because it hardcodes none.
 */
declare const TWAP: IndicatorDescriptor;
/**
 * Volume Weighted Moving Average — an SMA whose window is weighted by volume,
 * so the bars that actually traded set the level. Identical to an SMA when
 * volume is flat, and `na` on any window whose volume sums to zero, which is
 * what a feed with no volume produces.
 */
declare const VWMA: IndicatorDescriptor;
/**
 * Williams Alligator — three Wilder-smoothed medians of differing speed, each
 * displaced forward in time. The lines braid when the market has nothing to say
 * and fan out in order once a trend takes hold.
 *
 * the reference `smma` is `na(smma[1]) ? sma(src, length) : (smma[1] * (length - 1)
 * + src) / length`, which is Wilder's RMA to the letter, so `rma` reproduces it
 * exactly and first prints at `length - 1`.
 *
 * Lengths default to 21 / 13 / 8, not to Williams' original 13 / 8 / 5: the
 * reference runs the slower set, and the offsets 8 / 5 / 3 are shared by both,
 * so only the smoothing lengths move. A saved chart that never set them draws
 * three slower lines now.
 *
 * The three plots carry `offset = 8 / 5 / 3`. A plot offset is not available
 * per-plot here, so the displacement is applied to the values instead: the value
 * computed on bar `i` is returned in slot `i + offset`, which leaves `offset`
 * leading nulls and puts the shifted tail in the last `offset` slots. A line
 * therefore first prints at `length - 1 + offset`.
 */
declare const ALLIGATOR: IndicatorDescriptor;
/**
 * Smoothed Moving Average, Wilder's smoother over a plain price source. Its
 * alpha is `1 / length` where an EMA of the same length uses `2 / (length + 1)`,
 * so it lags further and turns only once a run of closes has genuinely shifted
 * the level, which is the point: it is the noise filter, not the fast line.
 *
 * The reference `smma` is the recursion `rma` already implements, seeded from
 * the simple average of the first `length` values, so it first prints at
 * `length - 1` and needs no code of its own here.
 */
declare const SMMA: IndicatorDescriptor;
/**
 * T3 Average, that generalised double average applied three times over. The
 * result reads as smooth as a long moving average while turning close to as
 * early as a short one, which no single exponential average of either length
 * does.
 *
 * Warmup is the thing to get right here, and it is deeper than the length
 * suggests. One layer is two chained averages, and the layers nest three deep,
 * so the longest term is six averages of averages. Each is chained onto a series
 * that is already `na` for its own warmup and so starts `length - 1` bars after
 * the one it reads (see `emaOfGapped`), which puts the first printed bar at
 * `6 * (length - 1)`: index 24 at the default length of 5, not index 4.
 *
 * Highlighting is a colour on one line, not a second plot: the line is
 * continuous either way and only its paint changes, so a break in the colour
 * must not become a break in the series.
 */
declare const T3: IndicatorDescriptor;
declare const AVERAGE_INDICATORS: readonly IndicatorDescriptor[];

/**
 * Momentum: the rawest reading there is, today's price against the price `len`
 * bars ago. No smoothing, no normalisation, so the scale is the instrument's
 * own and only the sign and the slope carry meaning.
 */
declare const MOMENTUM: IndicatorDescriptor;
/**
 * Rate Of Change: the same comparison as Momentum, expressed as a percentage of
 * the older price so readings are comparable across instruments and across time.
 *
 * A zero reference price makes the ratio undefined, which is drawn upstream as a
 * gap rather than as an infinite spike; the `roc` helper already returns NaN.
 */
declare const ROC: IndicatorDescriptor;
/**
 * Percentage Price Oscillator: MACD rewritten as a percentage of the slow
 * average, so the histogram of a 20 dollar stock and a 2000 dollar index can be
 * read on the same axis.
 *
 * Both the oscillator and its signal take a selectable EMA/SMA shape, and the
 * signal is a MA of the PPO rather than of price, so it inherits the PPO's own
 * warmup on top of its own: on defaults the oscillator prints from bar 25 and
 * the signal and histogram from bar 33.
 */
declare const PPO: IndicatorDescriptor;
/**
 * TRIX: the one-bar rate of change of a triple-smoothed log price.
 *
 * Working in logs is what makes the output a pure percentage rate (scaled by
 * 10000, so a reading of 100 is one percent per bar) independent of price
 * level, and three EMAs in series strip nearly everything that is not the
 * underlying trend, which is why it crosses zero so cleanly and so late.
 *
 * That lateness is the cost: each EMA starts `length - 1` bars after its input,
 * and `change` adds one more, so the first print is at `3 * length - 2`
 * (bar 52 on the default 18).
 */
declare const TRIX: IndicatorDescriptor;
/**
 * True Strength Index: the double-smoothed one-bar change divided by the
 * double-smoothed size of that change.
 *
 * Dividing by the smoothed magnitude is what bounds the study to -100..100 and
 * makes it read as "what fraction of recent movement went one way": a run of
 * unbroken up bars gives exactly +100 because the numerator and denominator are
 * then the same series.
 */
declare const TSI: IndicatorDescriptor;
/**
 * SMI Ergodic Indicator: Blau's Ergodic, which is TSI plotted against its own
 * EMA signal. Same maths as True Strength Index, different default lengths (20
 * and 5 rather than 25 and 13), so it turns much faster.
 *
 * The source script draws no horizontal lines here, and none are declared:
 * adding a zero line would be a nicer chart but a different one.
 */
declare const SMI_ERGODIC_INDICATOR: IndicatorDescriptor;
/**
 * SMI Ergodic Oscillator: the gap between the Ergodic and its signal, drawn as
 * a histogram. The same relationship the Indicator shows as two lines, reduced
 * to the one number that crosses zero.
 */
declare const SMI_ERGODIC_OSCILLATOR: IndicatorDescriptor;
/**
 * Stochastic Momentum Index: Stochastic measured from the *midpoint* of the
 * range instead of from its low.
 *
 * That single change is what re-centres the study on zero and lets it say which
 * half of the range price is in, rather than only how high in it. Both the
 * distance from the midpoint and the range itself are double-smoothed before
 * being divided, which is why the reading is far steadier than a raw %K.
 *
 * A bare `highest(lengthK)` / `lowest(lengthK)` upstream defaults to `high` and
 * `low`, not to the source of the surrounding expression, so the window really
 * is a high/low range and not a close-only one.
 */
declare const SMI: IndicatorDescriptor;
declare const STRENGTH_INDICATORS: readonly IndicatorDescriptor[];

/**
 * Negative Volume Index — the price path compounded across only the bars where
 * volume fell.
 */
declare const NVI: IndicatorDescriptor;
/**
 * Positive Volume Index — the same construction as NVI over the complementary
 * set of bars, the ones where volume rose.
 */
declare const PVI: IndicatorDescriptor;
/**
 * Price Volume Trend — a running total of each bar's percentage price change
 * weighted by the volume behind it.
 *
 * The distinction from On-Balance Volume is the weighting: OBV adds the whole
 * bar's volume on any up close, so a 0.1 percent drift and a 5 percent gap
 * count the same. PVT scales the contribution by how far price actually moved.
 */
declare const PVT: IndicatorDescriptor;
/**
 * Percentage Volume Oscillator — MACD's construction applied to volume instead
 * of price, expressed as a percentage of the slow average.
 *
 * The percentage normalisation is the point: raw volume differences are not
 * comparable across symbols or across a decade of one symbol, whereas "the fast
 * average is 12 percent above the slow one" is.
 */
declare const PVO: IndicatorDescriptor;
/**
 * Mass Index — how much the range is expanding relative to its own recent
 * expansion, summed over a window.
 *
 * The ratio of a 9-bar EMA of the range to a 9-bar EMA of *that* is near 1 while
 * volatility is steady and rises as the range widens, so the sum reads as
 * "volatility has been building for a while" rather than "this bar was wide".
 * The nested EMA is the parity trap in this file: its input is already `na` for
 * the first 8 bars, and the reference reseeds past that rather than propagating it, which
 * is why the plot starts two warmups plus a window deep.
 */
declare const MASS_INDEX: IndicatorDescriptor;
/**
 * Ulcer Index — the root-mean-square percentage drawdown from the window's
 * running high.
 *
 * Standard deviation treats an upside surprise as risk; this only counts the
 * distance below the recent peak, and squaring before averaging makes one deep
 * drawdown weigh more than several shallow ones. The reading is therefore a
 * measure of how uncomfortable holding the instrument was, not of how much it
 * moved, and it is 0 on any series that only rises.
 */
declare const ULCER_INDEX: IndicatorDescriptor;
/** Every descriptor in this module, in picker order. */
declare const INDEX_INDICATORS: readonly IndicatorDescriptor[];

/**
 * Stochastic RSI — where RSI sits inside its own recent range, which turns a
 * slow-moving oscillator into a fast one.
 *
 * The reference passes `rsi1` in as all three arguments of `stoch`, so the window
 * is the RSI's high and low rather than price's, and every warmup adds to the
 * one before it: 14 bars for the RSI, 14 more before the stochastic window is
 * full of real RSI values, then two SMAs. First `K` lands at index 29 on the
 * defaults and `D` two bars later.
 */
declare const STOCHASTIC_RSI: IndicatorDescriptor;
/**
 * Williams Percent Range — the distance from the window's high down to the
 * close, as a percentage of the window. The sign convention is the whole point:
 * a close at a fresh window high is exactly 0 and one at the window low is
 * exactly -100, so the scale runs -100..0 rather than 0..100.
 *
 * The high and low come from `high` and `low` (the reference single-argument
 * `highest`/`lowest`), while the numerator reads the `source` input, so
 * the three do not have to agree.
 */
declare const WILLIAMS_PERCENT_R: IndicatorDescriptor;
/**
 * Ultimate Oscillator — buying pressure over true range, measured across three
 * horizons at once and weighted 4:2:1 so the fast window leads without the
 * slower two losing their vote.
 *
 * `high_`/`low_` reach back to the previous close, so bar 0 has no value: the reference
 * `max(high, na)` is `na`, and that bar contributes to neither sum. Summing
 * from bar 1 is what keeps it out — `rollingSum` keeps a running total, and one
 * NaN in a running total never comes back out. With the default 28-bar window
 * the first print is therefore at index 28, not 27.
 */
declare const ULTIMATE_OSCILLATOR: IndicatorDescriptor;
/**
 * Relative Vigor Index — the bar's body over its range, on the theory that a
 * rising market closes near its high. Both halves are smoothed by `swma`
 * (the fixed 4-bar 1/2/2/1 kernel) before being summed, so a single wide bar
 * cannot swing the reading on its own.
 *
 * Warmup stacks: 3 bars for the `swma`, `length` more for the sum (index 12 on
 * the defaults), then 3 more for the signal's own `swma`.
 *
 * The reference `offset` input displaces both plots. The library has no per-plot
 * offset, so it is a real shift of the columns instead — see `shifted`.
 */
declare const RELATIVE_VIGOR_INDEX: IndicatorDescriptor;
/**
 * Relative Volatility Index — RSI's arithmetic applied to volatility instead of
 * price: how much of the recent standard deviation arrived on up bars.
 *
 * Two details are easy to get wrong. The `length` input is the standard
 * deviation's window only; the smoothing length is a hard-coded 14 in the reference
 * and stays 14 whatever `length` is set to. And the two smoothed series are not
 * clean: `change(src) <= 0 ? 0 : stddev` yields a real `0` on down bars but
 * `na` on up bars while the standard deviation is still warming up, so the EMA's
 * seed has to wait for a 14-bar window with no holes in it. That makes the first
 * printed bar `length + 12` on a one-way market rather than a fixed index.
 */
declare const RELATIVE_VOLATILITY_INDEX: IndicatorDescriptor;
/**
 * Woodies CCI — a 14-bar CCI drawn twice, as a colour-coded histogram and as a
 * line, with a fast "turbo" CCI over the top. The pair is the method: the turbo
 * line crossing the slow one is the trigger, and the histogram's colour says
 * whether the trend is established enough to take it.
 *
 * The colour is a five-bar state, not a level — `cci14[5] .. cci14[1]` all on
 * one side of zero — so it belongs to `colorBy` rather than to a second plot.
 * Note the fallback branch: with no established run, the reference paints a negative
 * reading teal and a positive one red, which is the opposite of the run colours.
 * That is what the built-in ships, and parity beats tidiness here.
 */
declare const WOODIES_CCI: IndicatorDescriptor;
/**
 * Pring's Special K: twelve rates of change from twelve different horizons, each
 * smoothed and weighted, added into one line. Short-, intermediate- and
 * long-term momentum in a single reading, which is why its turns are read as
 * complete-cycle signals rather than as entries.
 *
 * Every term has to have a value before the sum does, so the slowest one sets
 * the warmup; the reference itself refuses to run on a chart with fewer than 725
 * bars.
 */
declare const SPECIAL_K: IndicatorDescriptor;
declare const RANGE_INDICATORS: readonly IndicatorDescriptor[];

/**
 * Vortex Indicator: how much of the window's total travel was spent reaching up
 * versus reaching down.
 *
 * Both movement terms straddle a bar boundary (`high` against the previous
 * `low`), so bar 0 has no term at all: it is missing there, and so is any
 * rolling-sum window containing it. Summing from bar 1 and shifting the answer
 * forward one bar is how that hole stays out of the running total, and it is why
 * the first printed value lands at index `length` rather than at `length - 1`
 * like the denominator does.
 */
declare const VORTEX: IndicatorDescriptor;
/**
 * Volatility Stop: a trailing stop an ATR multiple away from the running
 * extreme of the source, which flips side when price closes through it.
 *
 * The recursion is the whole study, so it is reproduced term for term. Three
 * details are load-bearing:
 *   - while the ATR is still warming there is no band to scale, and the formula
 *     falls back to the bar's own true range, unmultiplied, so the stop exists
 *     from bar 0;
 *   - the stop only ever ratchets *towards* price in the live direction, which
 *     is what makes it a stop rather than a band;
 *   - a flip resets the running extreme to the current source and recomputes the
 *     stop from it, so the level jumps once and then resumes ratcheting.
 *
 * The published study draws one cross-style plot whose colour switches with the
 * trend. This library has no per-bar line colour, so the level is split across
 * two null-gated plots exactly as Supertrend and HalfTrend do, and the crosses
 * are stood in for by markers-only dots (as Parabolic SAR does).
 */
declare const VOLATILITY_STOP: IndicatorDescriptor;
/**
 * Trend Strength Index: the correlation between price and the passage of time.
 *
 * A perfectly straight rising line correlates +1 with the bar index and a
 * straight fall correlates -1, so the reading is "how close to a straight line
 * has this been", not "how fast". Being a correlation it is bounded to -1..1,
 * hence the declared range.
 *
 * Pearson correlation is invariant under shifting either input, so counting the
 * position within the supplied bars, rather than from the start of all history,
 * changes nothing.
 *
 * The published study paints gradient fills between the line and zero, which
 * this library cannot express (a fill needs two plot edges and one flat colour).
 * The two colour inputs it spends on those gradients tint the +1 / -1 bands here
 * instead, so they still mean bullish and bearish.
 */
declare const TREND_STRENGTH_INDEX: IndicatorDescriptor;
/**
 * Williams Fractals: the pivot highs and lows the alligator is built around.
 *
 * The study is entirely shapes: two of them, and not one line. A descriptor
 * still needs a series for the marker layer to hang off,
 * so `fractals` is declared and returns an all-null column: it draws nothing and
 * contributes nothing to autoscale, it exists to own the markers. The two signal
 * columns beside it carry the price each shape is anchored to, which is what
 * makes the markers testable without re-deriving them.
 *
 * A fractal at bar `p` is only known at bar `p + n`, which is why the study
 * draws it `n` bars back. The columns follow that: the signal sits on the
 * candidate bar, and the last `n` bars can never carry one, being unconfirmed.
 */
declare const WILLIAMS_FRACTALS: IndicatorDescriptor;
/**
 * RSI Divergence Indicator: the RSI, plus a labelled plate wherever a fresh RSI
 * pivot disagrees with the price pivot beside it.
 *
 * Four signal classes, each comparing the newest oscillator pivot with the one
 * before it and the price at both:
 *   - regular bullish: oscillator higher low against a lower price low;
 *   - hidden bullish: oscillator lower low against a higher price low;
 *   - regular bearish: oscillator lower high against a higher price high;
 *   - hidden bearish: oscillator higher high against a lower price high.
 *
 * The bookkeeping is all "the previous pivot", said three ways: a pivot low of
 * the oscillator fires on the bar that *confirms* it, `lbR` bars after it
 * happened; the value-when lookup reads a series as it stood at the pivot before
 * this one; and the range gate counts the bars since that previous pivot,
 * rejecting pairs closer together than `rangeLower` or further apart than
 * `rangeUpper`. The gate counts from the found flag delayed one bar, so the
 * pivot being confirmed right now is not counted as its own predecessor.
 *
 * Every comparison is fed a missing value until a second pivot exists, and those
 * comparisons are false, so nothing fires before then without an explicit guard.
 *
 * Not reproduced: the four connector plots, which join consecutive pivot
 * readings and go transparent when the divergence does not hold. They need a
 * line drawn between two isolated points and a per-bar line colour, neither of
 * which this library's line renderer has. The labels carry the same information.
 */
declare const RSI_DIVERGENCE: IndicatorDescriptor;
/**
 * Consolidation and Breakout: a mother bar's range, the inside bars that keep it
 * alive, and the bar that finally leaves it.
 *
 * This one is a state machine rather than a formula. A single index is carried
 * from bar to bar: the bar whose high and low currently define the range. Every
 * later bar whose *body* (open to close, wicks ignored) sits inside that range
 * extends the consolidation, and the first body to escape it becomes the new
 * mother.
 *
 * The two reads of that index straddle the reassignment, and that ordering is
 * the study:
 *   - the breakout tests read the range as it stood *before* this bar could
 *     claim it, which is what makes a breakout a statement about the old range;
 *   - the plotted range and the inside-bar tint read it *after*, so a bar that
 *     breaks out is already the new mother and is correctly left untinted.
 * One bar therefore both fires a marker and opens the next consolidation.
 * Collapsing the two into one read shifts every signal by a bar, which still
 * looks plausible on a chart, so `tests/study-consolidation.test.ts` pins the
 * breaking bar itself.
 *
 * Bar 1 is excluded from the inside test by the definition: with the carried
 * index seeded at 0, bar 1 would otherwise be measured against a range that has
 * had no chance to be broken.
 *
 * Not reproduced: the thickness control the published definition puts on the two
 * range lines. `style.lineWidth` is static here and no settings key stands
 * behind it, so the control would move nothing. The lines are fixed at 2.
 */
declare const CONSOLIDATION_BREAKOUT: IndicatorDescriptor;
declare const SIGNAL_INDICATORS: readonly IndicatorDescriptor[];

declare const CPR: IndicatorDescriptor;
declare const ALPHATREND: IndicatorDescriptor;
declare const RANGE_ANALYSIS: IndicatorDescriptor;
declare const STUDY_INDICATORS: readonly IndicatorDescriptor[];

declare const WAVETREND: IndicatorDescriptor;
declare const WAVETREND_INDICATORS: readonly IndicatorDescriptor[];

declare const SEASONALITY: IndicatorDescriptor;
declare const SEASONALITY_INDICATORS: readonly IndicatorDescriptor[];

/**
 * Pure calculation helpers shared by the Tier-1 indicator descriptors
 * (`openalgo-charts/indicators`). Every function returns an array the same
 * length as its input, with `NaN` in warmup slots — the line renderer breaks
 * across non-finite points and autoscale skips them, so a warmup gap draws as
 * nothing rather than as a spike to zero.
 *
 * `ema`, `rsi`, `atr`, `trueRange`, and `supertrend` are NOT re-implemented
 * here — they ship in the base bundle and the tier imports them from it.
 */
/** Simple moving average. First value lands at index `period - 1`. */
declare function sma(values: readonly number[], period: number): number[];
/** Linearly weighted moving average (most recent bar carries weight `period`). */
declare function wma(values: readonly number[], period: number): number[];
/**
 * Wilder's smoothing (RMA): seed with the SMA of the first `period` values,
 * then `(prev * (period - 1) + v) / period`. The basis of RSI, ATR, and ADX.
 */
declare function rma(values: readonly number[], period: number): number[];
/** Rolling population standard deviation over `period`. */
declare function stdev(values: readonly number[], period: number): number[];
/** Rolling maximum over `period` bars. */
declare function highest(values: readonly number[], period: number): number[];
/** Rolling minimum over `period` bars. */
declare function lowest(values: readonly number[], period: number): number[];
/** NaN → null, so a warmup slot serialises as an explicit gap. */
declare function nulls(values: readonly number[]): (number | null)[];
/**
 * the reference `ema`: seeded with the **SMA of the first `period` values**, NaN
 * before that. The base bundle's `ema` seeds from `values[0]` and emits from
 * index 0 instead, so the two disagree for roughly the first `period` bars and
 * converge after. Anything reproducing a reference platform plot needs this one.
 */
declare function smaSeededEma(values: readonly number[], period: number): number[];
/** the reference `change(src, n)`: `src - src[n]`. NaN for the first `n` bars. */
declare function change(values: readonly number[], n?: number): number[];
/** the reference `roc`: `100 * (src - src[n]) / src[n]`. NaN for the first `n` bars. */
declare function roc(values: readonly number[], n: number): number[];
/**
 * the reference `dev`: mean **absolute** deviation from the SMA over `period` — not
 * a standard deviation. CCI's 0.015 constant is calibrated against this.
 */
declare function dev(values: readonly number[], period: number): number[];
/**
 * the reference `percentrank`: the percentage of the **previous** `period` values
 * that are less than or equal to the current one. The current bar is the
 * subject of the comparison, not part of the window, so the first answer lands
 * at index `period`.
 */
declare function percentRank(values: readonly number[], period: number): number[];
/** the reference `alma`: Gaussian-weighted MA, `offset` 0..1 and `sigma` > 0. */
declare function alma(values: readonly number[], period: number, offset: number, sigma: number): number[];
/** the reference `vwma`: `sma(src * volume, len) / sma(volume, len)`. */
declare function vwma(values: readonly number[], volumes: readonly number[], period: number): number[];
/**
 * the reference `highestbars` / `lowestbars`: the **offset** to the extreme bar
 * in the window, `0` for the current bar and `-(period - 1)` for the oldest.
 * Aroon is built entirely out of these, and the sign convention is why.
 */
declare function highestBars(values: readonly number[], period: number): number[];
declare function lowestBars(values: readonly number[], period: number): number[];
/** the reference `sum`: rolling sum over `period` bars. NaN during warmup. */
declare function rollingSum(values: readonly number[], period: number): number[];
/** the reference `cum`: running total from the first bar. Non-finite terms count as 0. */
declare function cumulative(values: readonly number[]): number[];
/**
 * the reference `linreg`: the least-squares regression line fitted over the last
 * `period` values, evaluated `offset` bars back from its right-hand end.
 *
 * x runs 0 (oldest bar in the window) to period-1 (current bar), so the value
 * at the current bar is `intercept + slope * (period - 1)`. A positive `offset`
 * steps back down that line, which is how LSMA's offset input shifts the plot
 * without recomputing the fit.
 */
declare function linreg(values: readonly number[], period: number, offset?: number): number[];
/** the reference `swma`: the fixed 4-bar symmetrically weighted average, 1/2/2/1 over 6. */
declare function swma(values: readonly number[]): number[];
/**
 * the reference `stoch(source, high, low, length)`. Note the three series are
 * independent: Stochastic RSI passes the RSI in for all three, which is why
 * this cannot just take bars.
 */
declare function stoch(source: readonly number[], high: readonly number[], low: readonly number[], period: number): number[];
/**
 * the reference `percentile_nearest_rank`. The nearest-rank method returns an
 * actual member of the window rather than interpolating between two, so a
 * 50th percentile over an even-length window is the upper of the two middles,
 * not their mean. That difference is visible on Median's default length of 3.
 */
declare function percentileNearestRank(values: readonly number[], period: number, percentage: number): number[];
/** the reference `correlation`: Pearson correlation of two series over `period`. */
declare function correlation(a: readonly number[], b: readonly number[], period: number): number[];
/** the reference `cci`: `(src - sma) / (0.015 * dev)`, where `dev` is the mean absolute deviation. */
declare function cci(values: readonly number[], period: number): number[];
/**
 * the reference `pivothigh` / `pivotlow`. A pivot is confirmed `right` bars
 * after it happens, so the answer lands on the confirming bar and refers to the
 * value `right` bars back. Comparisons are strict on both sides, so a tie is
 * not a pivot.
 */
declare function pivotHigh(values: readonly number[], left: number, right: number): number[];
declare function pivotLow(values: readonly number[], left: number, right: number): number[];
/** the reference `barssince`: bars elapsed since `cond` was last true, NaN before the first. */
declare function barsSince(cond: readonly boolean[]): number[];
/**
 * the reference `valuewhen(cond, source, occurrence)`: the value of `source` the
 * n-th most recent time `cond` was true, counting the current bar. Occurrence 0
 * is the latest.
 */
declare function valueWhen(cond: readonly boolean[], source: readonly number[], occurrence: number): number[];

/**
 * Tier-2 contract — indicators whose data is **not** derived from the chart's
 * OHLCV: open interest, cumulative volume delta, PCR, an external analytics
 * feed. Where a Tier-1 descriptor is a pure `calc(bars, settings)`, a Tier-2
 * descriptor owns a fetch / subscribe / merge lifecycle and its own series.
 *
 * `createTier2Indicator` wraps that lifecycle into an ordinary
 * `IndicatorDescriptor`, so the chart runtime, the settings model, panes,
 * levels, and removal all work identically — there is no second runtime.
 *
 * The alignment rule is deliberate and worth knowing: external points carry
 * their own timestamps, which rarely match bar times. Each bar takes the most
 * recent external point **at or before** that bar's time (last-known-value,
 * never interpolated and never forward-looking), and bars before the first
 * point are `null`.
 */

/** One external observation: a timestamp plus a value per plot key. */
interface Tier2Point {
    /** UTC seconds. */
    time: number;
    values: Readonly<Record<string, number | null>>;
}
interface Tier2Context {
    /** Host identity when supplied. Indicator settings remain independent. */
    dataContext?: Readonly<ChartDataContext>;
    /** Cancelled when this request is obsolete or the instance is removed. */
    signal?: AbortSignal;
    settings: Readonly<IndicatorSettings>;
    /** The chart's current source bars — use for the requested time window. */
    bars: readonly Bar[];
    /** UTC seconds of the first and last source bar (0 when there are none). */
    from: number;
    to: number;
}
interface Tier2Descriptor {
    id: string;
    name: string;
    category?: string;
    placement: 'onchart' | 'pane';
    inputs: readonly IndicatorInput[];
    plots: readonly IndicatorPlot[];
    /** A host/provider can explicitly decline data it cannot supply. */
    supports?(ctx: Tier2Context): boolean;
    /** Load the series for the current window. */
    fetch(ctx: Tier2Context): Promise<readonly Tier2Point[]>;
    /**
     * Optional live subscription. Call `push` with each incoming point; return an
     * unsubscribe function.
     */
    subscribe?(ctx: Tier2Context, push: (point: Tier2Point) => void): () => void;
    /**
     * Settings keys that invalidate the fetched data when they change (symbol,
     * exchange, resolution). Changing anything else only re-runs alignment.
     */
    refetchOn?: readonly string[];
    levels?(settings: Readonly<IndicatorSettings>): readonly IndicatorLevel[];
    range?(settings: Readonly<IndicatorSettings>): {
        min: number;
        max: number;
    } | null;
}
/**
 * Wrap a Tier-2 descriptor as a normal `IndicatorDescriptor`.
 *
 * ```ts
 * export const OPEN_INTEREST = createTier2Indicator({
 *   id: 'open-interest', name: 'Open Interest', placement: 'pane',
 *   inputs: [{ key: 'symbol', type: 'text', label: 'Symbol', default: '' }],
 *   plots: [{ key: 'oi', type: 'line', title: 'OI' }],
 *   refetchOn: ['symbol'],
 *   fetch: async ({ settings, from, to }) => loadOi(settings.symbol, from, to),
 * });
 * registerIndicator(OPEN_INTEREST);
 * ```
 */
declare function createTier2Indicator(d: Tier2Descriptor): IndicatorDescriptor;

declare const INDICATORS_TIER: "indicators";
/** Every built-in descriptor, in picker order. */
declare const BUILTIN_INDICATORS: readonly IndicatorDescriptor[];
/**
 * Register every built-in indicator. Called as a side effect on import, and
 * exported so bundlers that aggressively tree-shake a bare side-effect import
 * can call it explicitly. Idempotent.
 */
declare function registerBuiltinIndicators(): void;

export { ADAPTIVE_INDICATORS, ADL, ADX, ALLIGATOR, ALMA, ALPHATREND, AROON, AROON_OSCILLATOR, ATR, AVERAGE_DAILY_RANGE, AVERAGE_INDICATORS, AWESOME_OSCILLATOR, BALANCE_OF_POWER, BB_TREND, BOLLINGER, BOLLINGER_BANDWIDTH, BOLLINGER_PERCENT_B, BUILTIN_INDICATORS, CCI, CHAIKIN_MONEY_FLOW, CHAIKIN_OSCILLATOR, CHAIKIN_VOLATILITY, CHANDELIER_EXIT, CHANDE_KROLL_STOP, CHANDE_MOMENTUM, CHOPPINESS_INDEX, CHOP_ZONE, CONNORS_RSI, CONSOLIDATION_BREAKOUT, COPPOCK_CURVE, CPR, DEMA, DONCHIAN, DPO, EASE_OF_MOVEMENT, ELDER_FORCE_INDEX, EMA, ENVELOPE, FISHER_TRANSFORM, FLOW_INDICATORS, HALFTREND, HISTORICAL_VOLATILITY, HMA, HULL_SUITE, ICHIMOKU, INDEX_INDICATORS, INDICATORS_TIER, KAMA, KELTNER_CHANNEL, KLINGER_OSCILLATOR, KNOW_SURE_THING, LINREG_SLOPE, LSMA, MACD, MASS_INDEX, MA_CHANNEL, MA_CROSS, MA_RIBBON, MCGINLEY_DYNAMIC, MEDIAN, MFI, MOMENTUM, NET_VOLUME, NVI, OBV, OSCILLATOR_INDICATORS, OVERLAY_INDICATORS, PARABOLIC_SAR, PPO, PVI, PVO, PVT, RANGE_ANALYSIS, RANGE_INDICATORS, RELATIVE_VIGOR_INDEX, RELATIVE_VOLATILITY_INDEX, ROC, RSI, RSI_DIVERGENCE, SEASONALITY, SEASONALITY_INDICATORS, SIGNAL_INDICATORS, SMA, SMI, SMI_ERGODIC_INDICATOR, SMI_ERGODIC_OSCILLATOR, SMMA, SPECIAL_K, STANDARD_DEVIATION, STANDARD_ERROR, STANDARD_ERROR_BANDS, STOCHASTIC, STOCHASTIC_RSI, STRENGTH_INDICATORS, STUDY_INDICATORS, SUPERTREND, T3, TEMA, TREND_STRENGTH_INDEX, TRIX, TSI, TWAP, type Tier2Context, type Tier2Descriptor, type Tier2Point, ULCER_INDEX, ULTIMATE_OSCILLATOR, VOLATILITY_INDICATORS, VOLATILITY_STOP, VOLUME, VORTEX, VWAP, VWMA, WAVETREND, WAVETREND_INDICATORS, WILLIAMS_FRACTALS, WILLIAMS_PERCENT_R, WILLIAMS_VIX_FIX, WMA, WOODIES_CCI, alma, barsSince, cci, change, connorsStreak, correlation, createTier2Indicator, cumulative, dev, highest, highestBars, linreg, lowest, lowestBars, nulls, percentRank, percentileNearestRank, pivotHigh, pivotLow, registerBuiltinIndicators, rma, roc, rollingSum, sma, smaSeededEma, stdev, stoch, swma, valueWhen, vwma, wma };
