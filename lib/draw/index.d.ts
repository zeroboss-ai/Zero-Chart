import { PrimitiveRenderContext, IPrimitive, PrimitiveHost, ZOrder, PrimitiveHit, DataLayer } from 'openalgo-charts';

/**
 * The per-tool settings schema: what a host may show in a drawing's settings
 * dialog, expressed as dot paths into the drawing (`style.color`,
 * `text.fontSize`, `props.foo`, `zIndex`) with a control kind and a label.
 *
 * The rule the whole module exists for: a tool declares only fields its `draw`
 * actually reads. A schema is not a wish list. A host renders exactly what is
 * declared, so an entry with nothing behind it becomes a control that does
 * nothing, which is worse than no control at all.
 *
 * Pure: no DOM, no registry. The registry lookup (`drawingSettingsSchema`)
 * lives in tools.ts so this file has no import that could loop back here.
 */

type FieldKind = 'color' | 'number' | 'select' | 'lineStyle' | 'boolean' | 'text' | 'opacity' | 'levels';
/** The section a host groups a field under. */
type FieldGroup = 'line' | 'fill' | 'text' | 'levels' | 'behavior';
interface SettingsField {
    /**
     * Dot path into the drawing. Two segments under `style`, `text` or `props`
     * (`style.lineWidth`), or one of the top-level flags `locked`, `visible`,
     * `zIndex`.
     */
    path: string;
    label: string;
    kind: FieldKind;
    min?: number;
    max?: number;
    step?: number;
    /** For `select` and `lineStyle`: the values a host may offer. */
    options?: ReadonlyArray<{
        value: string;
        label: string;
    }>;
    group?: FieldGroup;
}
interface SettingsSchema {
    fields: SettingsField[];
    /**
     * The text *is* the drawing (a note, a callout, the text tool) rather than a
     * label on a shape, so a host should ask for it the moment the tool is
     * placed instead of waiting for a settings dialog.
     */
    textIsContent?: boolean;
}
declare const LINE_STYLE_OPTIONS: ReadonlyArray<{
    value: string;
    label: string;
}>;
declare const ALIGN_OPTIONS: ReadonlyArray<{
    value: string;
    label: string;
}>;
declare const VALIGN_OPTIONS: ReadonlyArray<{
    value: string;
    label: string;
}>;
declare const TEXT_POSITION_OPTIONS: ReadonlyArray<{
    value: string;
    label: string;
}>;
/**
 * Font stacks a host can offer. Values are real CSS stacks, so a drawing's
 * `text.fontFamily` needs no translation before it reaches `ctx.font`; a host
 * may still accept any stack the user types.
 */
declare const FONT_OPTIONS: ReadonlyArray<{
    value: string;
    label: string;
}>;
declare const COLOR_FIELD: SettingsField;
declare const LINE_WIDTH_FIELD: SettingsField;
declare const LINE_STYLE_FIELD: SettingsField;
/** Colour, width and dash: what every stroked tool reads through `applyStroke`. */
declare const LINE_FIELDS: readonly SettingsField[];
declare const FILL_FIELDS: readonly SettingsField[];
declare const EXTEND_FIELDS: readonly SettingsField[];
declare const SHOW_LABELS_FIELD: SettingsField;
declare const LEVEL_FIELDS: readonly SettingsField[];
/**
 * The face of any text a tool prints, including readouts it composes itself
 * (a fib level's ratio, a measure's chip, a horizontal line's price tag).
 * Tools that print nothing do not declare these.
 */
declare const FONT_FIELDS: readonly SettingsField[];
declare const TEXT_VALUE_FIELD: SettingsField;
/** The full surface of the text tool: content, face, layout, plate. */
declare const TEXT_FIELDS: readonly SettingsField[];
/**
 * A label attached to a shape: it sits inside or just above the outline, so
 * it has an alignment and a position but no plate of its own (the shape is
 * the plate) and wraps to the shape's width rather than a width of its own.
 */
declare const SHAPE_TEXT_FIELDS: readonly SettingsField[];
/**
 * An annotation's plate (note, balloon, comment, signpost, price note): always
 * drawn, so there is no `background` toggle, only its colour and opacity, plus
 * an optional border.
 */
declare const PLATE_TEXT_FIELDS: readonly SettingsField[];
/**
 * Build a schema from field lists and single fields. Later duplicates of a
 * path are dropped so a tool can layer a group over a shared list without
 * showing one control twice.
 */
declare function composeSettings(parts: ReadonlyArray<readonly SettingsField[] | SettingsField>, opts?: {
    textIsContent?: boolean;
}): SettingsSchema;
/** The value at a dot path, or `undefined` when unset or the path is not one the model has. */
declare function readDrawingSetting(d: Drawing, path: string): unknown;
/**
 * Every field of a schema read off a drawing, keyed by path. Absent values
 * are present as `undefined`, so a host can iterate the schema and render
 * each control in its "default" state rather than guessing.
 */
declare function readDrawingSettings(d: Drawing, schema: SettingsSchema): Record<string, unknown>;
/**
 * A raw control value made into what the field's kind stores, or `undefined`
 * when it cannot be. Form inputs hand back strings; a settings panel should
 * not have to know that `fontSize` is a number and `bold` a boolean.
 */
declare function coerceSettingValue(field: SettingsField, raw: unknown): unknown;
/**
 * Turn `{ 'style.color': '#f00', 'text.value': 'Hi', zIndex: 2 }` into the
 * partial a controller's `update` accepts. Bags come back whole
 * (`style: { ...d.style, color }`), so it does not matter whether the
 * controller merges or replaces them. A value of `undefined` removes the key,
 * which is how a host offers "reset to default".
 *
 * With a `schema`, each value is coerced to its field's kind and any path the
 * schema does not declare is dropped: a host can hand over its form state as
 * is. Without one, values are written verbatim. Paths the model has no home
 * for are ignored either way.
 */
declare function applyDrawingSettings(d: Drawing, patch: Record<string, unknown>, schema?: SettingsSchema): Partial<Drawing>;

/**
 * Drawing model (ARCHITECTURE.md section 8). A drawing is **plain data**: anchors
 * in `{ time, price }`, a style bag, a tool id. It serialises straight into
 * `ChartState.drawings` with no custom encoder, and a tool is a registry entry
 * exactly like a chart type or an indicator.
 *
 * Anchors are stored in *data* space, never pixels: the chart's time axis is
 * gapless (section 5.3), so a pixel anchor would slide the moment a weekend
 * collapsed or the user zoomed. `DataLayer.timeToIndexFloat` maps them back,
 * which also gives anchors between bars and to the right of the last one,
 * where trend projections and forecasts live.
 *
 * Version 2 of the model split the text fields out of the style bag into
 * {@link DrawingText}, made `levels` a list of {@link FibLevel} rather than bare
 * ratios, and gave every drawing a `zIndex`. A 1.9.x document is upgraded by
 * `migrateDrawings` on the way in; nothing downstream sees the old shape.
 */

/** One anchor, in data space. */
interface DrawingPoint {
    /** UTC seconds. May fall between bars, or past the last one. */
    time: number;
    price: number;
    /**
     * Pen pressure at this sample, 0..1, on a freehand stroke only. Absent means
     * the pointer events stand-in of 0.5, which is what a mouse reports and what
     * a stroke's width is calibrated to, so a mouse stroke stores nothing here.
     */
    pressure?: number;
}
/**
 * How new anchors snap to the bar under the cursor. `weak` snaps only when an
 * O/H/L/C sits within a few pixels of the pointer, so a click on empty space
 * lands where it was made; `strong` always takes the nearest of the four.
 */
type MagnetMode = 'off' | 'weak' | 'strong';
/**
 * The text a drawing carries, and how it is set. The text tool *is* this box;
 * a shape (rectangle, channel, callout) carries one as its label.
 *
 * Kept apart from {@link DrawingStyle} because the two answer different
 * questions: style is how the outline is stroked, text is what the label says
 * and how it is typeset. A purple rectangle with white bold text is one shape
 * with two colours, and a settings panel wants them on different tabs.
 */
interface DrawingText {
    /** Body text. `\n` starts a new line; see `wrap` for soft wrapping. */
    value: string;
    /** Falls back to `style.color`. */
    color?: string;
    /** Media px. Default 12. */
    fontSize?: number;
    /** CSS font stack. Defaults to the UI sans-serif stack. */
    fontFamily?: string;
    bold?: boolean;
    italic?: boolean;
    /** Horizontal alignment within the box. Default 'left'. */
    align?: 'left' | 'center' | 'right';
    /** Vertical placement within the box. Default 'top'. */
    valign?: 'top' | 'middle' | 'bottom';
    /** Soft-wrap at `wrapWidth` instead of running off the pane. */
    wrap?: boolean;
    /** Wrap width in media px. Default 220. */
    wrapWidth?: number;
    /** Draw a filled plate behind the text. */
    background?: boolean;
    backgroundColor?: string;
    /** Plate opacity, 0..1. Default 1: a text background is usually opaque. */
    backgroundOpacity?: number;
    /** Stroke a border around the plate. */
    border?: boolean;
    borderColor?: string;
    /**
     * Where a shape's label sits relative to the shape: `inside` the outline, or
     * `outside` just above it. Shapes only; the text tool is its own box.
     */
    position?: 'inside' | 'outside';
}
/** One level of a Fibonacci-family tool. */
interface FibLevel {
    /** The level as a fraction of the anchor span (0.618, 1.618, ...). */
    ratio: number;
    /** Stroke colour. Falls back to the conventional colour for the ratio. */
    color?: string;
    /** `false` hides the level without forgetting it. Default true. */
    enabled?: boolean;
    /** Printed instead of the ratio when set. */
    label?: string;
}
interface DrawingStyle {
    color?: string;
    lineWidth?: number;
    lineStyle?: 'solid' | 'dashed' | 'dotted';
    /** Fill the shape's interior (rectangle, ellipse, channel, position boxes). */
    fill?: boolean;
    fillColor?: string;
    /** 0..1. Defaults to 0.12. */
    fillOpacity?: number;
    /** Extend the line past its anchors. */
    extendLeft?: boolean;
    extendRight?: boolean;
    /** Draw level / price / ratio labels where the tool has them. */
    showLabels?: boolean;
    /** Fibonacci-family levels. Defaults per tool. */
    levels?: FibLevel[];
    /** Position tools: capital base and risk per trade, for the size readout. */
    accountSize?: number;
    risk?: number;
    /** Line tools: print the bar count, price change and angle at the midpoint. */
    showStats?: boolean;
    /** Brush: let pen pressure drive the stroke width. */
    pressure?: boolean;
}
interface Drawing {
    id: string;
    /** Registered tool id. */
    tool: string;
    points: DrawingPoint[];
    style: DrawingStyle;
    /** The label (or, for the text tool, the whole content). */
    text?: DrawingText;
    /**
     * Per-tool extras that do not belong on every drawing (a table's cells, a
     * callout's tail side). Keeps the base shape closed while a tool stays free
     * to carry what it needs. Must be JSON-safe: it is persisted verbatim.
     */
    props?: Record<string, unknown>;
    paneIndex: number;
    /** Locked drawings render but cannot be selected or dragged. */
    locked?: boolean;
    /** Default true. */
    visible?: boolean;
    /**
     * Paint order. Below zero paints under the series, at or above zero paints
     * over it. Ties break by array order, so two drawings at 0 paint in the
     * order they sit in the list.
     */
    zIndex: number;
    /** Epoch ms, set by the controller when the drawing is added. */
    createdAt?: number;
}
/**
 * What `DrawingController.add` accepts: a drawing minus the fields the
 * controller fills in. `zIndex` defaults to 0, `createdAt` to now, and an id is
 * minted unless one is supplied.
 */
type DrawingInput = Omit<Drawing, 'id' | 'zIndex' | 'createdAt'> & {
    id?: string;
    zIndex?: number;
    createdAt?: number;
};
/** The fields `DrawingController.update` and `updateMany` can change. */
type DrawingPatch = Partial<Pick<Drawing, 'points' | 'style' | 'text' | 'props' | 'locked' | 'visible' | 'zIndex'>>;
/** The persisted shape's version; bumped when {@link Drawing} changes. */
declare const DRAWING_STATE_VERSION = 2;
/**
 * What `toJSON` returns and `ChartState.drawings` carries. Versioned so a 1.9.x
 * save (a bare `Drawing[]`) is recognisable and upgraded rather than misread.
 */
interface DrawingsDocument {
    version: 2;
    drawings: Drawing[];
}
/** A point mapped to the pane, in media px. */
interface ScreenPoint {
    x: number;
    y: number;
}
interface DrawContext {
    ctx: CanvasRenderingContext2D;
    rc: PrimitiveRenderContext;
    /** Anchors in **device** px, ready to stroke. */
    pts: ScreenPoint[];
    drawing: Drawing;
    style: Required<Pick<DrawingStyle, 'color' | 'lineWidth'>> & DrawingStyle;
    selected: boolean;
    /** Format a price the way the pane's axis does. */
    formatPrice(price: number): string;
}
interface HitContext {
    /** Anchors in **media** px, the same space as the incoming x/y. */
    pts: ScreenPoint[];
    drawing: Drawing;
    rc: PrimitiveRenderContext;
}
/** What {@link DrawingTool.expand} needs to size a default in chart units. */
interface ExpandContext {
    /** Seconds between adjacent bars, so a default can span a sane bar count. */
    barSeconds: number;
    /**
     * Bars currently on screen. A default sized in fixed bars is a hairline when
     * zoomed out and fills the pane when zoomed in, so size against this instead.
     */
    visibleBars: number;
    /**
     * Anchor to media px on the placing pane, and back. Present when the host
     * can map coordinates, absent otherwise. A default sized in pixels (a
     * position box 64 px of risk tall, 150 px wide) reads the same at every
     * zoom and on every instrument, which a price percentage cannot: 1% of a
     * 2.87 stock and 1% of an index are the same fraction and very different
     * boxes. Without the mapping a tool falls back to chart units.
     */
    toPixel?(p: DrawingPoint): ScreenPoint | null;
    fromPixel?(at: ScreenPoint): DrawingPoint | null;
}
interface DrawingTool {
    id: string;
    name: string;
    /**
     * Anchors the tool needs before it is complete. `0` means free-form: the
     * drawing finishes on double-click.
     */
    points: number;
    /**
     * Sample the cursor continuously while the pointer is held, and finish on
     * release: one press-drag-release gesture is one stroke. Brushes want this;
     * without it a `points: 0` tool collects a vertex per click, which is
     * polyline behaviour and never terminates on its own.
     */
    freehand?: boolean;
    /**
     * Hold Shift to snap the free end of a two-anchor tool to 45 degree steps
     * on screen, while placing and while dragging a handle. The line family
     * sets it; a tool whose second anchor is not the far end of a line (a
     * rectangle's opposite corner) leaves it off, since a locked diagonal is
     * not what Shift means there.
     */
    angleLock?: boolean;
    /**
     * Turn the anchors actually clicked into the full anchor set. Lets a tool drop
     * a complete, immediately editable default from fewer clicks: the position
     * tools place a 1:1 box off a single click, which the user then drags, rather
     * than demanding entry/target/stop be clicked in turn.
     *
     * The returned points become the drawing's anchors, so each one stays a
     * draggable handle.
     */
    expand?(clicked: readonly DrawingPoint[], ctx: ExpandContext): DrawingPoint[];
    /**
     * Keep the anchors consistent after one of them moves: a handle drag
     * (`handle` is its index) or a patch to `points` (`handle` is null). Returns
     * the anchors to store. The position tools use it to keep the stop and the
     * target on opposite sides of the entry, so dragging the stop up through
     * the entry of a long turns the trade into a short instead of piling both
     * levels on one side. Pure: the same input always yields the same output.
     */
    constrain?(points: readonly DrawingPoint[], handle: number | null): DrawingPoint[];
    /**
     * Keyboard shortcut that arms this tool, as `'Alt+T'` / `'Shift+Alt+F'`:
     * modifiers in `Ctrl`, `Alt`, `Shift` order, then a single key. Hosts render
     * it beside the tool's name in a palette and bind it with
     * `matchDrawingShortcut`; the library itself installs no listener, since only
     * the host knows whether the chart has focus or a dialog is open.
     */
    shortcut?: string;
    /** Merged under the caller's style when a drawing is created. */
    defaultStyle?: DrawingStyle;
    /**
     * Merged under the caller's text when a drawing is created. The text tool
     * uses it for its placeholder content and default size; a shape leaves it
     * unset so it carries no label until the user gives it one.
     */
    defaultText?: DrawingText;
    /**
     * The fields a settings panel offers for this tool. Every built-in declares
     * one; a custom tool without it gets the plain line fields.
     */
    settings?: SettingsSchema;
    draw(c: DrawContext): void;
    /**
     * Distance in media px from the cursor to the shape, or `null` for a miss.
     * Return `0` for "inside" so a filled region is grabbable anywhere.
     */
    distance(x: number, y: number, c: HitContext): number | null;
}

/**
 * Built-in drawing tools + the tool registry. Same philosophy as the chart-type
 * and indicator registries: a tool is a descriptor, the layer just runs it, and
 * `registerDrawingTool` makes a custom one first-class.
 *
 * `draw` receives anchors already in device px; `distance` receives them in
 * media px, the same space as the incoming cursor.
 *
 * Text lives in `drawing.text` (a `DrawingText`), never in the style bag: a
 * shape's outline colour and its label colour are two decisions, and a tool
 * that prints only a readout (a fib ladder, a measure chip) still reads its
 * face from there. Ladders read `FibLevel[]` and stroke each level in its own
 * colour, taken from the shared palette in levels.ts.
 *
 * Every tool declares `settings`: the fields a host may show for it. The
 * schema is a contract, not a wish list. A field is declared only when this
 * file reads it, because a control with nothing behind it is a defect.
 */

declare function registerDrawingTool(tool: DrawingTool): void;
declare function getDrawingTool(id: string): DrawingTool;
declare function hasDrawingTool(id: string): boolean;
declare function registeredDrawingTools(): DrawingTool[];
/** Keyboard event fields a shortcut is matched against. */
interface ShortcutEvent {
    key: string;
    altKey?: boolean;
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
}
/**
 * The id of the tool whose `shortcut` matches this key event, or `null`.
 *
 * Pure, so a host can bind one `keydown` listener and decide for itself when
 * shortcuts apply. The library installs no listener, because only the host
 * knows whether the chart has focus, a dialog is open, or the user is typing.
 *
 * Modifiers must match exactly: `Alt+T` will not fire for `Ctrl+Alt+T`, so a
 * tool shortcut cannot shadow a browser or host chord. `metaKey` (Cmd) is
 * treated as Ctrl, which is what a Mac user expects.
 */
declare function matchDrawingShortcut(e: ShortcutEvent): string | null;
/** Every registered tool that has a shortcut, as `id -> shortcut`. */
declare function drawingShortcuts(): Record<string, string>;
/**
 * The settings a host may show for a tool: the tool's own declaration, else
 * the line fields, which every stroked custom tool reads. This is a registry
 * lookup, which is why it lives here and not in schema.ts: that module stays
 * free of any import that could loop back into this one.
 */
declare function drawingSettingsSchema(toolId: string): SettingsSchema;
declare const TREND_LINE: DrawingTool;
declare const RAY: DrawingTool;
declare const EXTENDED_LINE: DrawingTool;
declare const ARROW: DrawingTool;
declare const HORIZONTAL_LINE: DrawingTool;
declare const HORIZONTAL_RAY: DrawingTool;
declare const VERTICAL_LINE: DrawingTool;
declare const CROSS_LINE: DrawingTool;
declare const RECTANGLE: DrawingTool;
declare const ELLIPSE: DrawingTool;
declare const PARALLEL_CHANNEL: DrawingTool;
declare const FIB_RETRACEMENT: DrawingTool;
declare const FIB_EXTENSION: DrawingTool;
declare const MEASURE: DrawingTool;
declare const LONG_POSITION: DrawingTool;
declare const SHORT_POSITION: DrawingTool;
declare const TEXT: DrawingTool;
/**
 * Path: click each vertex, double-click to finish, arrowhead on the last leg.
 * The arrow is what separates it from `polyline`: a path points somewhere.
 */
declare const PATH: DrawingTool;
/**
 * Brush: freehand ink. Press, drag, release. The anchors are the thinned
 * samples of the gesture and the spline between them is what is stroked, so
 * the ink stays a curve after the thinning that keeps a stroke small.
 */
declare const BRUSH: DrawingTool;
/**
 * Rotated rectangle: anchors 0 and 1 lay out one edge (and so the rotation),
 * and anchor 2 sets the depth perpendicular to it. An axis-aligned `rectangle`
 * cannot follow a trend channel; this can.
 */
declare const ROTATED_RECTANGLE: DrawingTool;
/**
 * Double curve: an S through three anchors. `curve` bends one way off a single
 * control; this mirrors that control about the midpoint so the second half bends
 * back, which is the shape a rounded top-then-bottom actually needs.
 */
declare const DOUBLE_CURVE: DrawingTool;
/**
 * Cyclic lines: vertical lines repeating at the interval the two anchors set,
 * for reading a rhythm forward off a measured swing.
 */
declare const CYCLIC_LINES: DrawingTool;
/**
 * Time cycles: semicircles of the anchors' width repeating along the axis, the
 * classic cycle-projection overlay.
 */
declare const TIME_CYCLES: DrawingTool;
/**
 * Sine line: a full wave between the anchors. The horizontal span is one
 * period, the vertical offset its amplitude.
 */
declare const SINE_LINE: DrawingTool;
/**
 * Price label: a pill of the anchored price with a tail pointing at the bar.
 * Reads its value off the anchor, so dragging it re-reads rather than going
 * stale the way a typed-in text would. Text, when given, replaces the price.
 */
declare const PRICE_LABEL: DrawingTool;
/**
 * Callout: a text bubble on its own anchor with a tail back to the point it
 * annotates, so the note can sit clear of the price action it refers to.
 */
declare const CALLOUT: DrawingTool;
/** Flag mark: a pennant on a pole at one anchor, for tagging a bar. */
declare const FLAG_MARK: DrawingTool;
/**
 * Note: a pin at the bar with its text to the upper right.
 *
 * The pin is the point being annotated and the plate is the annotation, which
 * is why the two are drawn as separate marks joined by a stem rather than as
 * one bubble: the reader needs to see exactly which bar is meant, and a bubble
 * wide enough to hold a sentence covers several.
 */
declare const NOTE: DrawingTool;
/**
 * Balloon: a speech bubble sitting above its anchor, tail pointing down.
 *
 * One anchor rather than the callout's two: a balloon is for saying something
 * *about this bar*, so letting the bubble be dragged away from what it labels
 * would only invite it to drift.
 */
declare const BALLOON: DrawingTool;
/**
 * Comment: a small square-cornered box with a tail off its bottom left.
 *
 * Deliberately plainer than the balloon: a chart that says something at every
 * other bar needs one of these marks to be quiet, and the shape is the only
 * thing distinguishing them once both are the user's own colour.
 */
declare const COMMENT: DrawingTool;
/**
 * Signpost: a post standing on the bar with its plate at the top.
 *
 * The one annotation anchored to *time* rather than to a level: the post is
 * vertical so the plate can clear the price action entirely while the foot
 * still names an exact bar. Useful for events, which happen at a moment and
 * not at a price.
 */
declare const SIGNPOST: DrawingTool;
/**
 * Price note: the anchored price, with the user's text under it.
 *
 * The price is read off the anchor rather than typed, so dragging the note
 * re-reads it. A typed price is a number that was true once, which on a chart
 * is worse than no number at all.
 */
declare const PRICE_NOTE: DrawingTool;
/**
 * Table: rows of text in a grid, anchored top-left.
 *
 * Cells come from the text: a newline starts a row and a pipe separates
 * columns, so a whole table is one editable string and survives `getState`
 * with no new shape in the drawing model. The first row is drawn as a header
 * because a table on a chart is nearly always labelled.
 */
declare const TABLE: DrawingTool;
/**
 * Measurers. `measure` reports price *and* time together; these two constrain it
 * to one axis, which is what you want when the other one is noise: sizing a
 * retracement without caring how long it took, or counting bars to an event
 * without caring where price went.
 */
declare const PRICE_RANGE: DrawingTool;
declare const DATE_RANGE: DrawingTool;
/**
 * Position forecast: project a move from an anchor. Two anchors give the
 * projected leg; the shape extends the same slope past the target as a dashed
 * cone, so the drawing says "if this continues" rather than just marking a line.
 */
declare const FORECAST: DrawingTool;
/**
 * Circle from centre + a radius handle. The radius is measured in *pixels*, so
 * it stays a circle on screen instead of the ellipse the two axes' differing
 * scales would otherwise produce.
 */
declare const CIRCLE: DrawingTool;
declare const TRIANGLE: DrawingTool;
/** Free-form polyline: click each vertex, double-click to finish. */
declare const POLYLINE: DrawingTool;
/** Arc through three anchors: the middle one is on the curve, not a handle. */
declare const ARC: DrawingTool;
/** Quadratic curve: the middle anchor is a control handle, off the curve. */
declare const CURVE: DrawingTool;
declare const ARROW_UP: DrawingTool;
declare const ARROW_DOWN: DrawingTool;
declare const ARROW_LEFT: DrawingTool;
declare const ARROW_RIGHT: DrawingTool;
/** Highlighter: the brush with a fat, translucent stroke. */
declare const HIGHLIGHTER: DrawingTool;
/** Fib channel: fib levels spread across a trend leg, parallel to it. */
declare const FIB_CHANNEL: DrawingTool;
/**
 * Fib time zone: vertical lines at Fibonacci multiples of the base leg's width.
 * Its levels count bars rather than divide a leg, so they carry no convention
 * colour and fall back to the drawing's own.
 */
declare const FIB_TIME_ZONE: DrawingTool;
/** Rays from the anchor at fib fractions of the leg: the speed resistance fan. */
declare const FIB_FAN: DrawingTool;
/**
 * Gann fan: rays from one anchor at the classic price/time angles. A level's
 * ratio is price per unit of time, so the 1x1 is 1, the 1x2 is 0.5 and the
 * 2x1 is 2; each angle keeps its own colour from the cycle palette.
 */
declare const GANN_FAN: DrawingTool;
/**
 * Gann box: the drawn rectangle divided at its levels on both axes, plus the
 * 1x1 diagonal. Ratio 0 is the first anchor's price and time, ratio 1 the
 * second's, so the box reads like a retracement laid over a date range.
 */
declare const GANN_BOX: DrawingTool;
declare const BUILTIN_DRAWING_TOOLS: readonly DrawingTool[];
/** Register every built-in tool. Idempotent; called on tier import. */
declare function registerBuiltinDrawingTools(): void;

/**
 * The shared level palette for the Fibonacci and Gann family.
 *
 * Every ladder tool (retracement, extension, channel, fan, time zone, the Gann
 * fan and box) strokes a list of ratios, and each ratio has a colour the eye
 * expects: 0.618 reads as one thing across every tool, not a different hue per
 * tool. Before this module each tool would have restated those colours, and
 * restated colours drift. This is the one statement; tools take their defaults
 * from it and hosts seed a newly added level from it.
 *
 * Pure: no DOM, no registry. Safe to import from a worker or a settings panel.
 */

/**
 * The colour of a ratio that is an anchor rather than a level (0, 1, 2, 3 are
 * where the measured leg starts and ends, or whole multiples of it) and of any
 * ratio the convention does not name. Neutral on purpose: it is the reference
 * the coloured levels are read against.
 */
declare const LEVEL_NEUTRAL = "#787b86";
/**
 * The conventional colour for a Fibonacci ratio. Anchors (0, 1, 2, 3) and any
 * ratio without a convention come back {@link LEVEL_NEUTRAL}, so a host can call
 * this for every new level and always get a usable colour.
 */
declare function levelColor(ratio: number): string;
/**
 * A short sequence of colours that stay distinguishable side by side, for
 * tools whose levels are positions rather than ratios: the angles of a Gann
 * fan, the repeats of a cycle. Index `i` wraps, so any count is safe.
 */
declare const CYCLE_PALETTE: readonly string[];
/** The `i`th cycle colour. Wraps in both directions; a negative index is fine. */
declare function cycleColor(i: number): string;
/** `0.618` as `61.8%`: the text a level prints when it carries no label. */
declare function formatRatio(ratio: number): string;
/**
 * The label for a Gann angle stored as a price-per-time ratio: `1` is the 1x1,
 * `0.5` the 1x2, `2` the 2x1. Ratios that are not clean reciprocals fall back
 * to the ratio itself, which is still true, just less idiomatic.
 */
declare function gannLabel(ratio: number): string;
/** A mutable copy of a default ladder, for a fresh drawing's own `style.levels`. */
declare function cloneLevels(levels: readonly FibLevel[]): FibLevel[];
/** Retracement and extension: the classic ladder, coloured by convention. */
declare const DEFAULT_FIB: readonly FibLevel[];
/** Speed fan: rays at the fractions of the leg. No 0 ray, it would be flat. */
declare const DEFAULT_FIB_FAN: readonly FibLevel[];
/** Gann box: quarters plus the golden pair, applied to both axes of the box. */
declare const DEFAULT_GANN_BOX: readonly FibLevel[];
/**
 * Gann fan: the classic angles as price-per-time ratios, 1x8 up to 8x1. These
 * are positions in a sequence rather than Fibonacci ratios, so they take the
 * cycle palette.
 */
declare const DEFAULT_GANN_FAN: readonly FibLevel[];
/**
 * Time zones count bars along the Fibonacci sequence, so `ratio` here is a
 * multiple of the anchor leg, not a fraction of it. No colour is set: there is
 * no convention for "the 13 line", so every zone takes the drawing's own colour
 * until the user gives one its own.
 */
declare const DEFAULT_FIB_TIME_ZONE: readonly FibLevel[];

/**
 * Glyphs for the drawing tools and for host chrome, as path data.
 *
 * The engine ships no DOM, and this does not change that: an icon here is a
 * string of SVG path commands, not an element. The host still builds its own
 * toolbar, flyouts and rail; what it no longer has to do is draw every glyph
 * before it can show them. `icon-svg.ts` turns these into markup strings for a
 * host that wants the convenience; this file is the single source both of them
 * and every other surface read from.
 *
 * That was the real cost of leaving them out. Every adopter drew their own set,
 * each drifted on stroke weight, grid and visual density independently, and the
 * result read as sixty icons rather than as one set, however carefully any
 * single glyph was made. A shipped set is worth more than a better glyph.
 *
 * # Two tiers, one weight
 *
 * Tool glyphs live on a 24-unit grid and are shown at 24px in the rail. Host
 * chrome (undo, close, the settings tab rail) is shown at 16px beside them, and
 * a 24-grid glyph scaled to 16 lands its 2-unit stroke on 1.33 pixels, blurred
 * across two rows on every edge. So chrome has its own registry drawn on a
 * 16-unit grid with a 1.5 stroke. The two strokes are deliberately not in exact
 * proportion: a small glyph needs a slightly heavier relative stroke than a
 * large one to read as the same weight, and `tests/draw-icons.test.ts` holds
 * the chrome tier inside that band rather than at parity.
 *
 * # The grid
 *
 * Every glyph is authored to the same constraints, and `tests/draw-icons.test.ts`
 * enforces all of them mechanically, because a set of this size cannot be kept
 * consistent by review:
 *
 *  - **One viewBox per tier.** 24 by 24 for tools, 16 by 16 for chrome, so a
 *    host sets the size once per surface.
 *  - **A margin all round.** Live area 2 to 22 on the tool grid, 1 to 15 on the
 *    chrome grid. Without it, glyphs that happen to reach the edge look larger
 *    than their neighbours and the rail reads as ragged.
 *  - **Integer coordinates.** With `STROKE` of 2, an orthogonal edge centred on
 *    an integer covers exactly two device pixels at 1:1, which is what makes it
 *    crisp. Half-unit coordinates were the previous set's crispness bug: at a
 *    1.5 stroke on integers, nothing landed on a pixel boundary at any size.
 *  - **One stroke weight per tier.** Three different weights across identically
 *    sized boxes is the single most visible tell of a set assembled rather than
 *    drawn.
 *
 * # Rendering
 *
 * Tool glyphs are crispest at 24px, and at any integer multiple of it. At 18px
 * the 0.75 scale puts a 2-unit stroke on 1.5 device pixels and every edge is
 * anti-aliased across two rows: that is a host sizing choice, not something the
 * path data can fix. Prefer 24, or 12 with a heavier weight. Chrome glyphs are
 * drawn for 16px and its multiples.
 */
/** The viewBox every glyph is authored in. */
declare const ICON_VIEWBOX = "0 0 24 24";
/**
 * Stroke width in viewBox units. Paths carry no presentation attributes, so a
 * host that wants a lighter set overrides this once rather than editing glyphs.
 */
declare const ICON_STROKE = 2;
/**
 * The attribute bag a tier hands its host. Structural, so the markup builders
 * in `icon-svg.ts` take either tier's bag through one signature.
 */
interface IconAttrs {
    readonly viewBox: string;
    readonly fill: 'none';
    readonly stroke: 'currentColor';
    readonly strokeWidth: number;
    readonly strokeLinecap: 'round';
    readonly strokeLinejoin: 'round';
}
/** Attributes a host should apply to the `<svg>`, so every set matches. */
declare const ICON_ATTRS: {
    readonly viewBox: "0 0 24 24";
    readonly fill: "none";
    readonly stroke: "currentColor";
    readonly strokeWidth: 2;
    readonly strokeLinecap: "round";
    readonly strokeLinejoin: "round";
};
/**
 * Path data by tool id, plus a few keys a host toolbar needs that are not
 * themselves tools (`cursor`, the group headers).
 *
 * Values are the `d` attribute of one `<path>`. Multiple subpaths are joined
 * into the same string rather than split across elements, so a host renders one
 * node per glyph.
 */
declare const DRAWING_TOOL_ICONS: Readonly<Record<string, string>>;
/**
 * The glyph for a tool, or `undefined` when it has none.
 *
 * Undefined rather than a placeholder: a host that renders an empty box has a
 * visible gap to fix, while one handed a question mark ships it.
 */
declare function drawingToolIcon(toolId: string): string | undefined;
/** Every id this set covers, for a host building a palette from it. */
declare function drawingToolIconIds(): string[];
/** The viewBox every chrome glyph is authored in. */
declare const CHROME_ICON_VIEWBOX = "0 0 16 16";
/**
 * Chrome stroke width in viewBox units. Not the tool stroke scaled (that would
 * be 1.33): at 16px a glyph needs a touch more relative weight than at 24px to
 * read as the same line, and 1.5 is where the two rails match by eye.
 */
declare const CHROME_ICON_STROKE = 1.5;
/** Attributes a host should apply to the `<svg>` around a chrome glyph. */
declare const CHROME_ICON_ATTRS: {
    readonly viewBox: "0 0 16 16";
    readonly fill: "none";
    readonly stroke: "currentColor";
    readonly strokeWidth: 1.5;
    readonly strokeLinecap: "round";
    readonly strokeLinejoin: "round";
};
/**
 * Path data for host chrome: the buttons around the chart rather than the
 * tools in it. Same rules as the tool tier (one path per glyph, no presentation
 * attributes, integer coordinates) on the 16 grid with a 1..15 live area.
 *
 * The pair `cursor` / `magnet` / `text` also exist in the tool registry, at 24.
 * They are drawn twice on purpose: a rail button and a toolbar button are
 * different sizes, and the whole point of a second grid is not scaling one
 * drawing to both.
 */
declare const CHROME_ICONS: Readonly<Record<string, string>>;
/**
 * Chrome glyphs meant to be painted solid. Paths carry no presentation
 * attributes, so the fill is applied by the wrapper (`chromeIconSvg` does it,
 * a host with its own wrapper reads this set) and the registry stays pure.
 */
declare const CHROME_ICON_FILLED: ReadonlySet<string>;
/** The chrome glyph for an id, or `undefined` when there is none. */
declare function chromeIcon(id: string): string | undefined;
/** Every id the chrome tier covers. */
declare function chromeIconIds(): string[];

/** Prefix of every `<symbol id>` in the sprite, and of every `<use href>`. */
declare const ICON_SYMBOL_PREFIX = "oac-icon-";
/** Options shared by the inline builders. */
interface IconSvgOptions {
    /**
     * Width and height. A number is CSS pixels; a string is written verbatim, so
     * `'1em'` sizes the glyph with the surrounding text. Default: the grid's
     * native size (24 for tools, 16 for chrome), where the stroke is crispest.
     */
    size?: number | string;
    /** Stroke width in viewBox units. Default: the tier's `*_STROKE`. */
    stroke?: number;
    /** A class for the host's own styling. */
    className?: string;
}
/** Options for `toolCursor`. */
interface ToolCursorOptions {
    /** Cursor image size in CSS pixels. Default 20. Browsers reject images over 128. */
    size?: number;
    /** The pointer's active pixel, from the image's top-left. Default: the centre. */
    hotspot?: readonly [number, number];
    /** Glyph colour. Default white. */
    color?: string;
    /**
     * Halo colour. Default: black under a light `color`, white under a dark one,
     * judged from a hex colour. A non-hex `color` gets a black halo unless this
     * is set.
     */
    halo?: string;
    /** The keyword after the image, for a browser that will not take it. Default `crosshair`. */
    fallback?: string;
}
/**
 * A complete inline `<svg>` for one tool glyph, stroked in `currentColor`.
 *
 * ```ts
 * button.innerHTML = iconSvg('trend-line');
 * button.innerHTML = iconSvg('trend-line', { size: '1em' });
 * ```
 */
declare function iconSvg(id: string, opts?: IconSvgOptions): string;
/**
 * A complete inline `<svg>` for one chrome glyph, on the 16 grid. Glyphs in
 * `CHROME_ICON_FILLED` are painted solid as well as stroked.
 */
declare function chromeIconSvg(id: string, opts?: IconSvgOptions): string;
/**
 * One hidden `<svg>` of `<symbol>`s, for a host that shows many glyphs and
 * wants each path in the document once. Inject it once, then place glyphs with
 * `iconUse`. Symbols carry the path and viewBox only; stroke and fill inherit
 * from the `<svg>` around each `<use>`, so one sprite serves every weight.
 *
 * Default: every tool glyph. Repeated ids collapse to one symbol, since a
 * duplicate element id is an invalid document.
 */
declare function iconSprite(ids?: readonly string[]): string;
/** An `<svg>` that references a symbol from `iconSprite`. Same frame as `iconSvg`. */
declare function iconUse(id: string, opts?: IconSvgOptions): string;
/**
 * A CSS `cursor` value carrying the tool's glyph, for the canvas while that
 * tool is armed.
 *
 * The glyph is drawn twice: once in `halo`, one pixel wider on each side, and
 * once in `color` on top, so it reads on a light chart and a dark one without
 * the host choosing per theme. The value is `url("data:image/svg+xml,...") x y,
 * fallback`, ready for `canvas.style.cursor`.
 */
declare function toolCursor(id: string, opts?: ToolCursorOptions): string;

/**
 * A `DrawingLayer` renders the drawings of one pane and answers the chart's
 * hit-test. Anchors live in `{ time, price }`, so the layer maps them through
 * the *fractional* index helpers: the gapless axis means an anchor can sit
 * between bars (inside a collapsed weekend) or past the last one (a forward
 * projection), and whole-index lookups have nothing to return there.
 *
 * Each pane carries **two** layers, one at z-order `bottom` for drawings with a
 * negative `zIndex` (under the series) and one at `top` for the rest. The top
 * one takes over handles and hit-testing for the pair through `setBelow`, so a
 * shape parked under the candles still shows its grab handles above them and
 * a click lands on whatever the eye sees on top.
 *
 * Hit ids are `draw:<id>` for the body and `draw:<id>#<n>` for anchor `n`, so
 * the controller can tell "move the whole shape" from "move this handle".
 *
 * The hover ring, the magnet ring and the hover handles are all overlay
 * state: they change on every pointer move, so they must only ever cost the
 * top canvas. The layer that paints them is the one whose `requestUpdate`
 * the chart maps to the cursor tier, which is why the bottom layer of a pair
 * stores that state and asks for nothing.
 */

/** Which side of the series a layer paints on. */
type DrawingLayerOrder = 'bottom' | 'top';
/** The pointer kinds the layer sizes its targets for. */
type DrawingPointerKind = 'mouse' | 'touch' | 'pen';
/**
 * Paint order: by `zIndex`, ties by array position. `Array.prototype.sort` is
 * stable, which is what makes the tie rule hold without a second key.
 */
declare function sortByZIndex(drawings: readonly Drawing[]): Drawing[];
declare class DrawingLayer implements IPrimitive {
    private readonly _order;
    /** In paint order. */
    private _drawings;
    private _host;
    private _selected;
    /** The drawing under the pointer, whether or not it is selected. */
    private _hovered;
    /** Where the next click will land while the magnet is pulling it. */
    private _snap;
    /** Anchors of the in-progress drawing, plus the live cursor point. */
    private _preview;
    /** The layer under this one, whose handles and hits this layer answers for. */
    private _below;
    /** The layer that has taken over this one's handles and hit-testing. */
    private _above;
    /** Sizes grab targets for the device last seen. */
    private _touch;
    constructor(order?: DrawingLayerOrder);
    attached(host: PrimitiveHost): void;
    detached(): void;
    zOrder(): ZOrder;
    /** Drawings overlay the price range; they never drive it. */
    autoscaleInfo(): null;
    setDrawings(drawings: readonly Drawing[]): void;
    setSelected(ids: readonly string[]): void;
    /**
     * The drawing under the pointer. Its handles paint at a lighter weight than
     * a selection's, as the hint that it can be grabbed. Repaints only from the
     * layer that paints handles: the adopted bottom layer keeps the id for its
     * own bookkeeping and asks for nothing, since its repaint costs the series.
     */
    setHovered(id: string | null): void;
    hovered(): string | null;
    /**
     * The point the magnet will snap the next click to, or null when it is not
     * pulling. Painted as a hollow ring so the user sees the anchor land before
     * committing to it.
     */
    setSnapPoint(point: DrawingPoint | null): void;
    snapPoint(): DrawingPoint | null;
    /**
     * Size the grab targets for the device in use. Touch doubles the radii; a
     * mouse or a pen keeps the desktop sizes. The render context may carry the
     * same fact (`pointerType`), and when it does that wins per call, so a
     * first touch on a fresh chart is already sized right.
     */
    setPointerType(kind: DrawingPointerKind | null | undefined): void;
    setPreview(drawing: Drawing | null): void;
    /**
     * Adopt the layer under this one. From then on this layer paints the handles
     * of both and answers `hitTest` for both, and the adopted layer paints bodies
     * only. Handles have to live up here: a selected drawing under the series
     * would otherwise have its handles buried under the candles, and a handle
     * you cannot see is a handle you cannot grab. Pass null to release.
     */
    setBelow(layer: DrawingLayer | null): void;
    /** Repaint for overlay-only state, from the layer that paints it. */
    private _requestOverlay;
    /** Whether targets are sized for a fingertip on this call. */
    private _isTouch;
    private _grabRadius;
    private _handleRadius;
    /** Map an anchor to media px on this pane. */
    private _project;
    private _points;
    /** Selected, unlocked drawings of this layer, in paint order. */
    private _handled;
    /**
     * The hovered drawing of this layer, when it is one that could be grabbed
     * and is not already showing selection handles.
     */
    private _hoverHandled;
    draw(ctx: CanvasRenderingContext2D, rc: PrimitiveRenderContext): void;
    private _drawingContext;
    private _drawContent;
    private _drawPlacementGuide;
    /**
     * Anchor handles. A hover shows them light (thin, translucent) as a hint
     * that the shape can be grabbed; a selection shows them at full weight.
     */
    private _drawHandles;
    /** The magnet ring: hollow, in the axis text colour, at the snap point. */
    private _drawSnapRing;
    hitTest(x: number, y: number, rc: PrimitiveRenderContext): PrimitiveHit | null;
    private _hitHandle;
    private _hitBody;
}

/**
 * Clipboard transfer for drawings: the layer between the drawing model and the
 * OS clipboard.
 *
 * Two things make this more than `JSON.stringify`:
 *
 * 1. **The OS clipboard is shared with everything else on the machine.** A
 *    paste can arrive from a spreadsheet, another application, or a hand-edited
 *    copy of our own payload. So the payload is written under a namespaced key
 *    and everything read back is validated field by field before it can reach
 *    the model. Foreign text is *not ours* and is ignored, never an exception
 *    the host has to catch on every Ctrl+V.
 * 2. **Clipboard access is async and permission-gated.** `navigator.clipboard`
 *    rejects when the document is not focused, the page is not secure, or the
 *    user denied the permission. Copy must still work inside the tab, so every
 *    write also lands in a module-level in-memory clipboard which is shared by
 *    every controller in the page. That is what makes chart-to-chart paste work
 *    with the permission denied, and it is why the memory store is a singleton
 *    rather than per-controller state.
 *
 * The payload body is a drawings document (`DrawingsDocument`), so a copy made
 * by a 1.9.x build (a version 1 body carrying the old style-bag text fields)
 * is upgraded by the same migration a saved layout goes through.
 */

/**
 * Top-level key of the JSON payload. Namespaced so a paste of arbitrary text,
 * or of JSON belonging to some other application, is recognisable as not ours
 * by looking at one property.
 */
declare const DRAWING_CLIPBOARD_KEY = "openalgo-charts/drawings";
/**
 * Payload format version. Tracks the model version, since the body *is* a
 * drawings document: version 1 carried 1.9.x drawings, version 2 carries the
 * split text and levelled fibs.
 */
declare const DRAWING_CLIPBOARD_VERSION: number;
/** The async slice of `navigator.clipboard` this module uses. */
interface ClipboardPort {
    writeText(text: string): Promise<void>;
    readText(): Promise<string>;
}
/** Test seam: drop whatever the in-memory clipboard is holding. */
declare function clearMemoryClipboard(): void;
/** `navigator.clipboard` when the browser exposes it, else null. */
declare function systemClipboard(): ClipboardPort | null;
/** Deep copy of the persisted fields, so a clone shares nothing with its source. */
declare function cloneDrawing(d: Drawing): Drawing;
/** Serialise drawings into the namespaced payload written to the clipboard. */
declare function encodeClipboardPayload(drawings: readonly Drawing[]): string;
/**
 * Validate one entry into a drawing with no id. Returns null for anything that
 * cannot be rendered: an unknown tool would throw inside the controller, and a
 * NaN anchor produces a drawing that can never be drawn or hit-tested again.
 * Accepts the 1.9.x shape too, lifting its text fields into `text`.
 */
declare function sanitizeDrawing(value: unknown): Omit<Drawing, 'id'> | null;
/**
 * Parse clipboard text into drawings, or null when the text is not ours or is
 * not usable. All-or-nothing on purpose: a payload with one corrupt entry is a
 * corrupt payload, and pasting the other nine silently would be worse than
 * pasting none.
 */
declare function decodeClipboardPayload(text: unknown): Omit<Drawing, 'id'>[] | null;
interface DrawingClipboardOptions {
    /** Where to read and write. Defaults to `navigator.clipboard` when present. */
    port?: ClipboardPort | null;
    /**
     * Keep a copy in the shared in-memory clipboard so copy and paste keep
     * working when the OS clipboard is unavailable or the permission is refused.
     * Default true. Set false to make a failed system write a failed copy, which
     * a host that must not silently lose cross-tab transfer may prefer.
     */
    fallbackToMemory?: boolean;
}
/**
 * The clipboard as the controller sees it: drawings in, drawings out, no
 * exceptions escaping. Every failure mode (no clipboard API, refused
 * permission, foreign text, corrupt payload) reduces to `false` or `null`.
 */
declare class DrawingClipboard {
    private _port;
    private _fallback;
    /** Why the last operation did not reach the OS clipboard, if it did not. */
    private _lastError;
    constructor(options?: DrawingClipboardOptions);
    /** Swap the port at runtime (a host granting permission later, or a test). */
    setPort(port: ClipboardPort | null): void;
    /**
     * Turn the in-memory backstop off or on. With it off, a refused system write
     * is a failed copy, which is what a host wants when a cut that cannot reach
     * the OS clipboard must not delete the drawing.
     */
    setFallbackToMemory(enabled: boolean): void;
    /**
     * Why the OS clipboard was not used by the last call, or null when it was.
     * Set on a successful copy too, when the payload reached memory but not the
     * system clipboard: that copy works in this tab and will not appear in
     * another, which is exactly what a host wants to be able to tell the user.
     */
    lastError(): string | null;
    /**
     * Write drawings out. Resolves true when the payload is retrievable by a
     * later `read()` (through the system clipboard, or through memory when the
     * fallback is on), false when it is not, so a caller doing a cut knows
     * whether it is safe to delete the original.
     */
    write(drawings: readonly Drawing[]): Promise<boolean>;
    /**
     * Read drawings back, or null when there is nothing of ours to paste. The
     * system clipboard wins when it holds our payload, so a copy made in another
     * tab beats a stale in-tab one; memory is consulted when the read fails or
     * returns something that is not ours. That last case can paste an older copy
     * after the user has copied unrelated text elsewhere, which is the deliberate
     * trade: losing the copy whenever a browser refuses the read half of the
     * permission would be the worse surprise.
     */
    read(): Promise<Omit<Drawing, 'id'>[] | null>;
}

/**
 * Drawing controller: the interaction and persistence layer over
 * `DrawingLayer`. It is **headless**: no DOM, no toolbar. A host sets the
 * active tool (from its own button, a shortcut, a command palette) and the
 * controller runs placement, selection, dragging, undo, and serialisation.
 *
 * It listens on the chart's event bus (`click`, `crosshair:move`, `drag`,
 * `drag:end`) rather than the single-slot `subscribeClick`/`subscribeDrag`
 * callbacks, so a host keeps using those for its own order lines.
 *
 * Selection is a list. Every method that edits takes the whole list into one
 * undo entry, so a multi-drag, a batch delete or a paste of ten shapes is one
 * Ctrl+Z, which is what the hand that did it expects.
 */

/**
 * The slice of the chart this controller needs.
 *
 * Declared structurally rather than as `Chart` on purpose. Each tier ships its
 * own bundled `.d.ts`, so naming the class here made the draw tier re-declare
 * `Chart`, and because `Chart` has private members, TypeScript treats the two
 * declarations as *different* types. A TS consumer passing the chart from
 * `createChart()` got "separate declarations of a private property", which made
 * the tier unusable from TypeScript at all. An interface with no private
 * members is structural, so the real `Chart` satisfies it with nothing to cast.
 */
interface DrawingChartHost {
    /**
     * The event bus. The controller listens for `click`, `crosshair:move`,
     * `drag`, `drag:end` and `dblclick`, and for `hover` (`{ id }`, the hit id
     * under the pointer whenever it changes), which is what drives the hover
     * state: the chart has already hit-tested the move, so the controller
     * reads its answer rather than testing a second time. A host that never
     * emits `hover` has drawings that select and drag but do not light up.
     */
    on(event: string, handler: (payload: unknown) => void): () => void;
    emit(event: string, payload: unknown): void;
    addPrimitive(primitive: IPrimitive, paneIndex?: number): void;
    removePrimitive(primitive: IPrimitive): void;
    readonly dataLayer: DataLayer;
    getVisibleLogicalRange(): {
        from: number;
        to: number;
    } | null;
    drawingState(): unknown;
    setDrawingState(state: unknown): void;
    setPlacementMode?(active: boolean): void;
    /**
     * Optional, and used only to move a drawing by a fixed screen distance (a
     * paste offset, an arrow-key nudge, a multi-drag across panes). Going
     * through pixels rather than adding a price delta keeps the offset the same
     * visible nudge on a log scale as on a linear one, and the same on an RSI
     * pane as on the price pane. A host without them still gets the time half.
     */
    priceToCoordinate?(price: number, paneIndex?: number): number | null;
    coordinateToPrice?(y: number, paneIndex?: number): number | null;
    /**
     * Optional, the time-axis half of the same conversion. coordinateToTime also
     * keeps previews and freehand strokes active in empty space beyond the bars.
     * Without these methods a horizontal nudge assumes the default bar spacing.
     */
    timeToCoordinate?(time: number): number;
    coordinateToTime?(x: number): number;
    /**
     * Optional, and used only to keep a paste from a chart with more panes than
     * this one landing on a pane the user cannot see. Adding a primitive creates
     * the pane it names, so without this a drawing copied out of an indicator
     * pane would conjure an empty pane in a single-pane chart.
     */
    panes?(): readonly unknown[];
}
interface DrawingControllerOptions {
    /**
     * Snap new anchors to the O/H/L/C of the bar under the cursor. `'strong'`
     * always takes the nearest of the four; `'weak'` only when one sits within
     * a few pixels of the pointer, so a click on open space stays where it was
     * made. `true` means `'strong'` and `false` means `'off'`, which is what
     * the boolean meant before the modes existed. Default `'off'`. While a
     * tool is armed the layer paints a ring where the next click will land.
     */
    magnet?: boolean | MagnetMode;
    /** Style merged under every tool's own defaults. */
    defaultStyle?: DrawingStyle;
    /** Stay in the active tool after finishing a drawing. Default false. */
    stayInDrawingMode?: boolean;
    /** Undo depth. Default 50. */
    historyLimit?: number;
    /**
     * Where copy and paste move text. Defaults to `navigator.clipboard`; pass a
     * port to route through a host's own transfer, or `null` to stay in the
     * process-local clipboard entirely.
     */
    clipboard?: ClipboardPort | null;
    /**
     * Whether a refused or failing clipboard write still lands in the in-process
     * clipboard. Defaults to true, which is what makes copy and paste work between
     * two charts on a page where the browser has denied clipboard permission.
     *
     * Pass false for a host that would rather a failed copy be a failed copy: with
     * it off, `cut` leaves the drawing alone when the write does not land, so a
     * shape is never destroyed for a transfer that did not happen.
     */
    clipboardFallbackToMemory?: boolean;
    /**
     * How far a pasted or duplicated copy lands from its original, in bars along
     * time and in screen pixels down the price axis. A copy that lands exactly on
     * top of the original reads as nothing having happened. Defaults: 2 bars,
     * 16 px.
     */
    pasteOffsetBars?: number;
    pasteOffsetPixels?: number;
}
/** What `drawing:change` reports happened to the listed ids. */
type DrawingChangeKind = 'add' | 'update' | 'remove' | 'reorder';
declare class DrawingController {
    private readonly _chart;
    private _opts;
    private readonly _clipboard;
    private readonly _layers;
    private _drawings;
    private _tool;
    private _pending;
    private _pendingPane;
    /** Selected ids, in the order they were picked. The first is the primary. */
    private _selection;
    /** The drawing under the pointer, from the chart's own hit-test. */
    private _hovered;
    /**
     * Drawings that live under the series but are painted on the top layer for
     * the length of a drag. The top layer repaints on the cursor tier; the
     * bottom one costs the series every frame, which is the difference between
     * a drag that follows the hand and one that stutters through the candles.
     */
    private readonly _lifted;
    /** Shift as of the last pointer report: what angle lock reads mid-preview. */
    private _shift;
    /** The device behind the last pointer report, for target sizing. */
    private _pointerKind;
    /** Snapshots for undo/redo; each is a full drawing list (they are small). */
    private _undo;
    private _redo;
    /**
     * One gesture's starting state. `items` are ids rather than objects because
     * an undo mid-drag replaces every drawing object, and a stale reference
     * would move a shape that is no longer in the model.
     */
    private _dragStart;
    private readonly _off;
    private _lastCursor;
    /**
     * Bar under the cursor, carried by the crosshair event, with the time the
     * crosshair reported for it: the magnet lands anchors on that bar's values
     * at that bar's time.
     */
    private _lastBar;
    constructor(chart: DrawingChartHost, options?: DrawingControllerOptions);
    /** Arm a tool for placement, or pass null to return to the cursor. */
    setTool(toolId: string | null): void;
    /**
     * Ask the chart to stop panning and report gestures as anchor placement.
     * Guarded so a base bundle predating `setPlacementMode` still loads the tier.
     */
    private _setPlacementMode;
    activeTool(): string | null;
    setOptions(patch: DrawingControllerOptions): void;
    /** The snap mode in force, after the boolean form has been folded. */
    magnetMode(): MagnetMode;
    /**
     * The drawing under the pointer, selected or not, as the chart's hit-test
     * last reported it. What a host passes as `hasTarget` to the key mapping,
     * and what a context menu opens on.
     */
    hovered(): string | null;
    /** The clipboard behind copy / cut / paste, for a host reporting failures. */
    clipboard(): DrawingClipboard;
    /**
     * Every drawing, in list order. That is creation order until a z-order call
     * moves one; the list is the tie-break for equal `zIndex`, so it is also the
     * paint order within a band.
     */
    drawings(): readonly Drawing[];
    get(id: string): Drawing | undefined;
    /** Add a fully-specified drawing (import, or a host-authored one). */
    add(drawing: DrawingInput): Drawing;
    /**
     * Append one drawing without touching history or the layers. Split out so a
     * paste of several drawings is a single undo step rather than one per shape.
     */
    private _insert;
    private _mintId;
    update(id: string, patch: DrawingPatch): boolean;
    /**
     * Patch several drawings as one undo entry: a colour change across a
     * multi-selection is one edit to the user, so it is one Ctrl+Z too. Ids that
     * no longer exist are skipped; nothing is recorded when none exist.
     */
    updateMany(patches: ReadonlyArray<{
        id: string;
        patch: DrawingPatch;
    }>): void;
    private _applyPatch;
    remove(id: string): boolean;
    /** Delete several drawings as one undo entry. Unknown ids are ignored. */
    removeMany(ids: readonly string[]): void;
    /**
     * The delete shared by `remove`, `removeMany`, `cut` and `clear`. Returns
     * what went, and records nothing when nothing did.
     */
    private _removeIds;
    clear(): void;
    /**
     * Replace the selection, or with `additive` toggle each id into it (the
     * shift-click gesture). Ids that name nothing are ignored, so the selection
     * never refers to a drawing that is not there. Pass null to clear.
     */
    select(id: string | readonly string[] | null, additive?: boolean): void;
    /** The primary selection: the first id picked, or null. */
    selected(): string | null;
    /** Every selected id, in the order they were picked. */
    selection(): readonly string[];
    private _setSelection;
    private _emitChange;
    setZIndex(id: string, z: number): void;
    /** In front of every other drawing on its pane. Stays on its side of the series. */
    bringToFront(id: string): void;
    /** Behind every other drawing on its pane. Stays on its side of the series. */
    sendToBack(id: string): void;
    /** Under the series (`zIndex` -1). A no-op for a drawing already there. */
    sendBehindSeries(id: string): void;
    /** Over the series (`zIndex` 0). A no-op for a drawing already there. */
    bringAboveSeries(id: string): void;
    /** The other drawings sharing `d`'s pane and side of the series. */
    private _band;
    private _reorder;
    /**
     * Move drawings by a screen distance, `dx` right and `dy` down in media px,
     * as one undo entry. Pixels rather than data units so an arrow key moves a
     * shape the same visible amount on every pane and scale. Locked drawings
     * stay put.
     */
    nudge(ids: readonly string[], dxPx: number, dyPx: number): void;
    /**
     * Clone drawings, offset like a paste so the copies are visibly new, and
     * select the clones. One undo entry. Ids that name nothing are ignored.
     */
    duplicate(ids: readonly string[]): Drawing[];
    /**
     * Put drawings on the clipboard. Defaults to the selection; pass an id or a
     * list of ids to copy something else. Resolves false when there was nothing
     * to copy, or when the payload could not be stored anywhere.
     */
    copy(target?: string | readonly string[] | null): Promise<boolean>;
    /**
     * Copy, then delete. The delete happens **only** after the clipboard write
     * resolves successfully, so a refused write leaves the model exactly as it
     * was rather than destroying a drawing that went nowhere.
     */
    cut(target?: string | readonly string[] | null): Promise<boolean>;
    /**
     * Paste whatever is on the clipboard into this chart, offset from the
     * original so the copy is visibly a second object, and select the result.
     * Each pasted drawing is a fresh object with a fresh id, never a second
     * reference to the one copied, so editing the paste cannot alter its source
     * (or the clipboard).
     *
     * Anything that is not our payload (foreign text, a truncated or hand-edited
     * copy, a newer format) pastes nothing and resolves to an empty array: a
     * paste shortcut must not throw at the host because the user last copied a
     * spreadsheet cell.
     */
    paste(): Promise<Drawing[]>;
    /** Resolve an id list to live drawings; defaults to the selection. */
    private _targets;
    /** Fold a pane index from another chart onto a pane this one actually has. */
    private _clampPane;
    /** Nudge every anchor so a pasted copy is not hidden under its original. */
    private _offsetPoints;
    /**
     * Move a price down the screen by `px`. Done per anchor rather than as one
     * price delta so the move is a rigid *screen* translation, which is what the
     * eye expects and what keeps a shape's proportions on a log scale.
     */
    private _offsetPrice;
    /** Move a time right along the screen by `px`. */
    private _offsetTime;
    undo(): boolean;
    redo(): boolean;
    /** Drop selected ids the model no longer holds, after a history jump. */
    private _pruneSelection;
    canUndo(): boolean;
    canRedo(): boolean;
    /** Serialisable document, the same shape `ChartState.drawings` carries. */
    toJSON(): DrawingsDocument;
    /**
     * Replace every drawing. Accepts a {@link DrawingsDocument} or a 1.9.x bare
     * `Drawing[]`; both go through the migration, so an old save upgrades on
     * load. Clears the selection and history.
     */
    fromJSON(data: unknown): void;
    destroy(): void;
    private _onCrosshair;
    /** The chart's hit-test answer for the pointer position, whenever it changes. */
    private _onHover;
    private _setHovered;
    /** Remember the device behind a report and size the layers' targets for it. */
    private _notePointer;
    /**
     * The positions a pressed move passed through, as anchors, ending on the
     * move's own point. The samples carry pixels (container x, pane-local y);
     * the payload's point is the same position in its own space, so the gap
     * between the two is the pane's offset, and each sample maps back through
     * the host's converters. A host without them, or a payload without
     * samples, inks the one point the move reports.
     */
    private _coalesced;
    /** A pressure worth storing: finite, and not the mouse's stand-in. */
    private _pressureOf;
    /**
     * Let a tool turn the clicked anchors into its full set (the position tools
     * build a 1:1 box off one click). Identity for tools without the hook.
     */
    private _expand;
    /**
     * Bar spacing in seconds, read from the last gap in the data. A one-bar chart
     * has no gap to read, so fall back to a minute rather than answering zero and
     * producing zero-width defaults and invisible paste offsets.
     */
    private _barSeconds;
    private _isFreehand;
    /**
     * Append one sample to the stroke in progress. Points arriving closer than a
     * bar-eighth apart in time carry no shape and would bloat the saved drawing,
     * so they collapse into the last one: a pointer can fire far faster than the
     * stroke actually changes direction.
     */
    private _inkPoint;
    /** Commit `pts` as a drawing of the armed tool and leave placement. */
    private _commit;
    /**
     * Commit the stroke a freehand gesture built, if it has any extent. The
     * samples are thinned first: a pointer reports every few px, and a stroke
     * kept whole costs a time and price conversion per sample on every frame
     * and a row per sample in every save, for a curve the eye cannot tell from
     * the thinned one. Thinning happens in screen space, since the tolerance is
     * a pixel one; a host that cannot map to pixels keeps every sample.
     */
    private _finishFreehand;
    private _thinStroke;
    /**
     * End a variable-anchor shape (polyline, path) at the anchors placed so far.
     * Those tools declare `points: 0`, so nothing else can ever complete them;
     * without this they collected vertices forever. Bound to double-click, and
     * public so a host can offer Esc / Enter too. No-op when there is nothing
     * placeable, so a stray double-click costs nothing.
     */
    finish(): boolean;
    /**
     * Abandon whatever is being placed: the anchors so far are dropped and,
     * unless the controller stays in drawing mode, the tool is disarmed too, so
     * one Escape returns the chart to the cursor the way a finished shape
     * would. With nothing pending, an armed tool is simply disarmed. Returns
     * whether anything changed, so a host can let the key fall through when it
     * did nothing.
     */
    cancel(): boolean;
    /**
     * Remove the last anchor placed on a variable-anchor tool (polyline, path)
     * still being drawn: the Backspace of placement. A fixed-anchor tool has
     * nothing to pop, since its anchors commit the moment the last one lands,
     * and a freehand stroke is one gesture rather than a list. Returns whether
     * an anchor went.
     */
    popAnchor(): boolean;
    private _onClick;
    private _placePoint;
    /**
     * Where a click at `point` actually lands for the armed tool: on the 45
     * degree lock while Shift holds the free end of a line, else on the magnet
     * when it pulls, else where it was. The lock wins over the magnet because a
     * snapped price would bend the exact angle the lock exists to give.
     */
    private _aimPoint;
    /**
     * The free end of a two-anchor line under angle lock, or null when the lock
     * does not apply: no Shift, a tool without the flag, no anchor yet to
     * measure from, or a host that cannot map pixels (the lock is a screen
     * angle, so there is nothing to lock to in data space).
     */
    private _lockedPoint;
    /**
     * The nearest O/H/L/C of the hovered bar, at that bar's time, when the
     * magnet pulls; null when it does not. `strong` always pulls; `weak` only
     * within a few pixels, measured on screen so the pull is the same reach at
     * every zoom. Price panes only: an indicator pane's values are not prices.
     */
    private _snapPoint;
    private _onDrag;
    /** Apply one drag frame to the model, from the gesture's snapshot. */
    private _moveDrag;
    /** How far down the screen `to` is from `from` on one pane, in media px. */
    private _pixelDelta;
    /** An anchor in container media px, or null on a host without the mapping. */
    private _toPixel;
    /** The inverse of `_toPixel`. */
    private _fromPixel;
    /**
     * `free` projected onto the nearest 45 degree ray from `anchor`, all in
     * screen space: the angle the eye reads is the one on the canvas, and a log
     * scale or a tall pane would make a data-space angle anything but. The
     * projection rather than a rotation, so a level line still ends under the
     * pointer's x and a vertical one under its y; only the stray axis is
     * dropped. Null when the host cannot map pixels, or the two coincide.
     */
    private _lockAngle;
    private _onDragEnd;
    /**
     * The pair of layers for a pane, made on first use. The bottom one is added
     * first so a host that lists primitives sees them in paint order; the top one
     * adopts it so handles and hit-tests come from one place.
     */
    private _layerFor;
    /** Whether a drawing paints on the top layer: over the series, or lifted for a drag. */
    private _onTop;
    /** Push the current list into each pane's layers and into the chart state. */
    private _sync;
    /**
     * The per-frame half of a drag: only the top layers of the panes the
     * gesture touches are re-listed, so the repaint stays on the cursor tier.
     * Everything moving is on a top layer by then (anything under the series
     * was lifted when the gesture began), and the bottom layers have not
     * changed since, so re-listing them would cost a series repaint for
     * nothing.
     */
    private _syncDrag;
    /**
     * Mirror the in-progress anchors (plus the cursor) into the preview slot.
     * The cursor point goes through the same aim as a click would, so the
     * preview shows the locked angle or the snapped anchor before it lands.
     */
    private _syncPreview;
    /**
     * Show where the magnet will land the next click, or nothing. A ring only
     * while a click would place an anchor: a tool armed, not a brush (which
     * inks where the pointer is), and the pull actually applying at the cursor.
     * Angle lock bypasses the magnet, so it hides the ring too.
     */
    private _syncSnapRing;
    private _pushUndo;
}

/**
 * Keyboard editing for drawings, as a pure mapping from a key event to the
 * action it means. The engine installs no listener: only the host knows whether
 * the chart has focus, whether a dialog is open, or whether the user is typing
 * into a text box, so the host reads the event, asks this function, and calls
 * the matching `DrawingController` method itself.
 *
 * Modifiers must match exactly, the same rule `matchDrawingShortcut` applies:
 * a chord with an extra modifier belongs to the host or the browser, and an
 * editing action must never shadow it. `Meta` (Cmd) counts as `Ctrl`.
 */
/** The key-event fields the mapping reads. A DOM `KeyboardEvent` satisfies it. */
interface DrawingKeyEvent {
    key: string;
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
}
interface DrawingKeyContext {
    /** At least one drawing is selected. */
    hasSelection: boolean;
    /**
     * A drawing is under the pointer without being selected. Copy, cut,
     * duplicate and delete act on it when nothing is selected; nudge does not,
     * because moving something the user has not picked reads as a glitch.
     */
    hasTarget: boolean;
    /** The user is typing (a text box is open). Every key is theirs. */
    editingText: boolean;
    /**
     * A tool is armed. Escape, Enter and Backspace then belong to placement
     * (cancel, finish, drop the last anchor) rather than to the selection.
     */
    placing?: boolean;
}
type DrawingKeyAction = {
    type: 'undo';
} | {
    type: 'redo';
} | {
    type: 'copy';
} | {
    type: 'cut';
} | {
    type: 'paste';
} | {
    type: 'duplicate';
} | {
    type: 'delete';
}
/** Move the selection by a screen distance; `dx` right and `dy` down, in px. */
 | {
    type: 'nudge';
    dx: number;
    dy: number;
}
/** Placement, while a tool is armed: leave it, close the shape, drop the last anchor. */
 | {
    type: 'cancel';
} | {
    type: 'finish';
} | {
    type: 'popAnchor';
};
/** How far an arrow key moves the selection, plain and with Shift. */
declare const NUDGE_STEP_PX = 1;
declare const NUDGE_STEP_SHIFT_PX = 10;
declare function keyToDrawingAction(e: DrawingKeyEvent, ctx: DrawingKeyContext): DrawingKeyAction | null;

/**
 * The 1.9.x to 2.0 drawing migration.
 *
 * Hosts persist `toJSON()` verbatim, and a 1.9.x host has done so for a long
 * time: a bare `Drawing[]` per pane in local storage, for a great many users.
 * Version 2 moved every text field out of the style bag, made `levels` a list
 * of {@link FibLevel} rather than bare ratios, and gave each drawing a
 * `zIndex`. Reading an old save through the new types would lose the text and
 * the levels silently, and the user would open 2.0 to a chart with holes in
 * it. This is the one place the old shape is understood, so nothing
 * downstream needs to.
 *
 * Rules, in the order of what they protect:
 *
 * - A drawing that can be rendered is kept. An optional field with the wrong
 *   type is dropped on its own; only an entry with no usable tool, anchors or
 *   pane is dropped, because it could never be drawn again anyway. The
 *   clipboard is stricter (a paste is all-or-nothing) and gates before it
 *   calls this.
 * - Ids and array order survive. The list order is the paint order, and a
 *   host may hold ids of its own against the drawings.
 * - Unknown fields are dropped, so the style bag stays closed and a stray key
 *   never reaches the model.
 * - An unregistered tool is not a reason to drop anything: a plugin tool may
 *   register after the layout is restored. This module never consults the
 *   registry, which also keeps it pure.
 * - Garbage yields an empty document. This runs on the load path, where an
 *   exception would take the whole chart down with it.
 *
 * Idempotent on a version 2 document, so a host can call it on every load.
 */

/**
 * Upgrade saved drawings to the current document shape. Accepts a 1.9.x
 * `Drawing[]` or a {@link DrawingsDocument}. Every field is validated, the
 * 1.9.x text keys are lifted out of the style bag into `text`, bare level
 * ratios become coloured levels, and array order is kept. An entry that could
 * never be rendered is dropped; anything unparseable yields an empty document
 * rather than an error.
 */
declare function migrateDrawings(input: unknown): DrawingsDocument;

/**
 * Hit-test geometry for the drawing tier. Everything works in media px and
 * returns a distance, so `DrawingLayer` can pick the nearest shape under the
 * cursor with one comparison rather than each tool inventing its own tolerance.
 */

/** Distance from a point to a line segment. */
declare function distToSegment(px: number, py: number, a: ScreenPoint, b: ScreenPoint): number;
/** Distance to an infinite line through `a` and `b`. */
declare function distToLine(px: number, py: number, a: ScreenPoint, b: ScreenPoint): number;
/** Distance to a polyline's nearest segment. */
declare function distToPolyline(px: number, py: number, pts: readonly ScreenPoint[]): number;
/** Normalised rect corners from two opposite anchors. */
declare function rectOf(a: ScreenPoint, b: ScreenPoint): {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
};
/**
 * The axis-aligned box around any number of points. What a shape's label is
 * laid out against when the shape itself is not a rectangle (a triangle, a
 * rotated rectangle, a circle's centre plus radius).
 */
declare function boundsOf(pts: readonly ScreenPoint[]): {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
};
/**
 * Distance to a rectangle: 0 anywhere inside when `filled`, otherwise the
 * distance to the nearest edge. An unfilled rect must stay grabbable only by
 * its outline, or it would swallow every click in its interior.
 */
declare function distToRect(px: number, py: number, a: ScreenPoint, b: ScreenPoint, filled: boolean): number;
/**
 * Distance to an axis-aligned ellipse inscribed in the box `a`..`b`. Uses the
 * normalised radius, scaled back by the smaller semi-axis: exact enough for a
 * grab tolerance and far cheaper than the true closest-point solve.
 */
declare function distToEllipse(px: number, py: number, a: ScreenPoint, b: ScreenPoint, filled: boolean): number;
/** Clamp a segment's endpoints out to the plot edges, keeping its slope. */
declare function extendSegment(a: ScreenPoint, b: ScreenPoint, width: number, left: boolean, right: boolean): [ScreenPoint, ScreenPoint];

/**
 * Ramer-Douglas-Peucker thinning. Keeps the first and last points and, between
 * them, only those that pull the stroke more than `epsilonPx` away from the
 * chord of their kept neighbours; every dropped point lies within `epsilonPx`
 * of the returned polyline. Kept points come back at their exact input
 * coordinates, in input order. An `epsilonPx` that is not positive returns a
 * copy. The result never aliases its input, so a caller may mutate it.
 */
declare function rdpSimplify(points: ReadonlyArray<ScreenPoint>, epsilonPx: number): ScreenPoint[];
/**
 * Appends a Catmull-Rom spline through `points` to the current path as cubic
 * beziers: one `moveTo`, then a `bezierCurveTo` per segment that ends exactly
 * on the next point. The caller owns `beginPath` and `stroke`, so the same
 * spline can also outline a filled ribbon. Two points degrade to a straight
 * `lineTo`; fewer emit nothing.
 *
 * `tension` scales the tangent at each point: 0.5 is the classic spline and 0
 * collapses every segment to a straight line. Values outside 0..1 are clamped,
 * since past 1 the tangents grow long enough for a segment to fold back on
 * itself.
 */
declare function catmullRom(ctx: CanvasRenderingContext2D, points: ReadonlyArray<ScreenPoint>, tension?: number): void;
/**
 * A line width scaled by pointer pressure. Pressure 0.5, which a mouse
 * reports while a button is down, returns `baseWidth` unchanged, so a stroke
 * drawn without a pen is the width the user configured. A pen sweeps the
 * width from `baseWidth * (1 - range)` at no pressure to
 * `baseWidth * (1 + range)` at full pressure. Pressure and `range` are
 * clamped to 0..1, and a pressure that is not a number (a synthetic event)
 * counts as 0.5.
 */
declare function pressureWidth(baseWidth: number, pressure: number, range?: number): number;

/** Channels, pitchforks and dedicated line tools. Geometry stays in media pixels. */

declare const ADVANCED_LINE_TOOLS: readonly DrawingTool[];

/** Screen-space curves and price/time constructions for advanced drawings. */

declare const ADVANCED_GEOMETRY_TOOLS: readonly DrawingTool[];

/** Labeled price patterns with shared paint and hit geometry. */

/** Pattern drawing descriptors. Registration is owned by the draw-tier catalog. */
declare const PATTERN_DRAWING_TOOLS: readonly DrawingTool[];

declare const DRAW_TIER: "draw";

export { ADVANCED_GEOMETRY_TOOLS, ADVANCED_LINE_TOOLS, ALIGN_OPTIONS, ARC, ARROW, ARROW_DOWN, ARROW_LEFT, ARROW_RIGHT, ARROW_UP, BALLOON, BRUSH, BUILTIN_DRAWING_TOOLS, CALLOUT, CHROME_ICONS, CHROME_ICON_ATTRS, CHROME_ICON_FILLED, CHROME_ICON_STROKE, CHROME_ICON_VIEWBOX, CIRCLE, COLOR_FIELD, COMMENT, CROSS_LINE, CURVE, CYCLE_PALETTE, CYCLIC_LINES, type ClipboardPort, DATE_RANGE, DEFAULT_FIB, DEFAULT_FIB_FAN, DEFAULT_FIB_TIME_ZONE, DEFAULT_GANN_BOX, DEFAULT_GANN_FAN, DOUBLE_CURVE, DRAWING_CLIPBOARD_KEY, DRAWING_CLIPBOARD_VERSION, DRAWING_STATE_VERSION, DRAWING_TOOL_ICONS, DRAW_TIER, type DrawContext, type Drawing, type DrawingChangeKind, type DrawingChartHost, DrawingClipboard, type DrawingClipboardOptions, DrawingController, type DrawingControllerOptions, type DrawingInput, type DrawingKeyAction, type DrawingKeyContext, type DrawingKeyEvent, DrawingLayer, type DrawingLayerOrder, type DrawingPatch, type DrawingPoint, type DrawingPointerKind, type DrawingStyle, type DrawingText, type DrawingTool, type DrawingsDocument, ELLIPSE, EXTENDED_LINE, EXTEND_FIELDS, type ExpandContext, FIB_CHANNEL, FIB_EXTENSION, FIB_FAN, FIB_RETRACEMENT, FIB_TIME_ZONE, FILL_FIELDS, FLAG_MARK, FONT_FIELDS, FONT_OPTIONS, FORECAST, type FibLevel, type FieldGroup, type FieldKind, GANN_BOX, GANN_FAN, HIGHLIGHTER, HORIZONTAL_LINE, HORIZONTAL_RAY, type HitContext, ICON_ATTRS, ICON_STROKE, ICON_SYMBOL_PREFIX, ICON_VIEWBOX, type IconAttrs, type IconSvgOptions, LEVEL_FIELDS, LEVEL_NEUTRAL, LINE_FIELDS, LINE_STYLE_FIELD, LINE_STYLE_OPTIONS, LINE_WIDTH_FIELD, LONG_POSITION, MEASURE, type MagnetMode, NOTE, NUDGE_STEP_PX, NUDGE_STEP_SHIFT_PX, PARALLEL_CHANNEL, PATH, PATTERN_DRAWING_TOOLS, PLATE_TEXT_FIELDS, POLYLINE, PRICE_LABEL, PRICE_NOTE, PRICE_RANGE, RAY, RECTANGLE, ROTATED_RECTANGLE, SHAPE_TEXT_FIELDS, SHORT_POSITION, SHOW_LABELS_FIELD, SIGNPOST, SINE_LINE, type ScreenPoint, type SettingsField, type SettingsSchema, type ShortcutEvent, TABLE, TEXT, TEXT_FIELDS, TEXT_POSITION_OPTIONS, TEXT_VALUE_FIELD, TIME_CYCLES, TREND_LINE, TRIANGLE, type ToolCursorOptions, VALIGN_OPTIONS, VERTICAL_LINE, applyDrawingSettings, boundsOf, catmullRom, chromeIcon, chromeIconIds, chromeIconSvg, clearMemoryClipboard, cloneDrawing, cloneLevels, coerceSettingValue, composeSettings, cycleColor, decodeClipboardPayload, distToEllipse, distToLine, distToPolyline, distToRect, distToSegment, drawingSettingsSchema, drawingShortcuts, drawingToolIcon, drawingToolIconIds, encodeClipboardPayload, extendSegment, formatRatio, gannLabel, getDrawingTool, hasDrawingTool, iconSprite, iconSvg, iconUse, keyToDrawingAction, levelColor, matchDrawingShortcut, migrateDrawings, pressureWidth, rdpSimplify, readDrawingSetting, readDrawingSettings, rectOf, registerBuiltinDrawingTools, registerDrawingTool, registeredDrawingTools, sanitizeDrawing, sortByZIndex, systemClipboard, toolCursor };
