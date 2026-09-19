import { ShortcutListItem, ChartTheme, Chart, ChartObjects, ChartSettingsInput, ContextMenuEvent, IndicatorApi, ChartSettingsTabId, ChartSettingsValues, DataLoadingController, SeriesApi, RestoreReport, ChartOptions, DataFeed, DataLoadingOptions, Bar } from 'openalgo-charts';
import { DrawingController, MagnetMode, SettingsField } from 'openalgo-charts/draw';

/**
 * The widget keymap: one place every chord the shell, the rail and the
 * dialogs answer to is registered, resolved and listed.
 *
 * The engine has a `ShortcutManager` of its own for chart navigation (arrows,
 * zoom, fit) keyed on physical key codes, and the draw tier answers
 * `matchDrawingShortcut` and `keyToDrawingAction` from `e.key`. Neither knows
 * about the other, about the rail's focus, or about a dialog being open, so
 * the two collide silently: the tier's Alt+V arms a vertical line and the
 * engine's Alt+V toggles the vertical grid, and whichever listener ran first
 * won. This layer runs before both, in the capture phase, with scopes that
 * say where a chord applies, and it records every collision so the shortcuts
 * panel can show the truth rather than the intent.
 *
 * Bindings are written the way the draw tier writes them (`Alt+T`, `Mod+Z`,
 * `?`), from the key the event reports, not the physical code: a chord that
 * has to be read out to a user is a character, and `?` has no code that means
 * the same thing on every layout.
 *
 * The class touches no DOM until `attach`, and `handle` takes any object
 * with the key fields, so every rule is testable without a browser.
 */

/**
 * Where a binding applies. `global` always; `widget` while the pointer or the
 * focus is inside the widget; `chart` while either is on the chart itself;
 * `rail` while the focus is in the tool rail; `overlay` while a dialog or a
 * menu is open, when nothing else fires. The shell decides which are active
 * (see `setScopes`); they are tried narrowest first.
 */
type KeyScope = 'global' | 'widget' | 'chart' | 'rail' | 'overlay' | (string & {});
/** The event fields the keymap reads. A DOM `KeyboardEvent` satisfies it. */
interface KeyEventLike {
    key: string;
    code?: string;
    ctrlKey?: boolean;
    metaKey?: boolean;
    altKey?: boolean;
    shiftKey?: boolean;
    target?: unknown;
    preventDefault?(): void;
    stopPropagation?(): void;
}
/**
 * What runs for a chord. Return `false` to decline: the next binding on the
 * same chord (or the engine, or the browser) gets the key. Anything else
 * claims it, and the event is prevented and stopped.
 */
type KeyAction = (e: KeyEventLike) => boolean | void;
interface KeyBindingOptions {
    /** Shown in the shortcuts panel. Defaults to the chord itself. */
    label?: string;
    /** Section of the shortcuts panel. Default `Widget`. */
    group?: string;
    /** Gate read at key time; a false skips the binding without declining for others. */
    when?: () => boolean;
    /** Fire even when the focus is in a text field. Default false. */
    inText?: boolean;
    /** Keep out of the shortcuts panel (a binding that only exists to layer under another). */
    hidden?: boolean;
    /**
     * Declares that this binding shares its chord on purpose: it declines when
     * it does not apply, so an earlier widget binding or the engine's own
     * command on the same chord still fires. Without it a second registration
     * on a chord, or one on a chord the engine binds, is recorded as a conflict.
     */
    layered?: boolean;
}
interface KeyBinding {
    readonly id: number;
    /** Canonical chord, see `parseKeyCombo`. */
    readonly combo: string;
    readonly scope: KeyScope;
    readonly label: string;
    readonly group: string;
    readonly hidden: boolean;
    readonly inText: boolean;
    /** Shares its chord deliberately; see `KeyBindingOptions.layered`. */
    readonly layered: boolean;
    readonly action: KeyAction;
    readonly when?: () => boolean;
}
interface KeyConflict {
    readonly combo: string;
    readonly scope: KeyScope;
    /** Label of the binding that fires. */
    readonly kept: string;
    /** Label of the binding that never will while the kept one claims. */
    readonly shadowed: string;
    /** `widget` for two widget bindings, `chart` when the engine's own keymap loses the chord. */
    readonly source: 'widget' | 'chart';
}
/**
 * Canonical form of a chord (`'shift+alt+t'` -> `'Alt+Shift+t'`), or `''`
 * when the spec is not one. Letters are lower-cased and keep Shift; a symbol
 * or a digit drops it, because the character already says which key was
 * pressed with Shift held. Ctrl, Cmd and Meta all read as `Mod`.
 */
declare function parseKeyCombo(spec: string): string;
/** The canonical chord an event stands for, or `''` for a bare modifier press. */
declare function eventKeyCombo(e: KeyEventLike): string;
/** A chord as a user reads it: `Ctrl+Shift+Z`, or `Cmd+Shift+Z` on a Mac. */
declare function formatKeyCombo(combo: string, isMac?: boolean): string;
/**
 * The engine's code-based combo (`Alt+KeyV`, `Mod+Shift+KeyS`, `Equal`) in
 * this keymap's key-based form, so the two can be compared. Layout-specific
 * symbols are read as a US layout would produce them, which is what the
 * engine's own display does too.
 */
declare function fromChartCombo(combo: string): string;
/** The slice of the engine's shortcut manager the keymap reads. */
interface ChartShortcutSource {
    list(): ShortcutListItem[];
}
interface KeymapOptions {
    isMac?: boolean;
    /** The chart's shortcut manager, for conflict detection and the panel's Chart section. */
    chart?: ChartShortcutSource | null;
    /** Which scopes are active right now, narrowest first. Default: `['global']`. */
    scopes?: () => readonly KeyScope[];
}
interface KeymapGroup {
    readonly group: string;
    readonly rows: ReadonlyArray<{
        label: string;
        combo: string;
        display: string;
        shadowedBy?: string;
    }>;
}
declare class Keymap {
    private readonly _isMac;
    private readonly _chart;
    private _scopes;
    private readonly _bindings;
    private readonly _byCombo;
    private readonly _conflicts;
    private readonly _conflictListeners;
    private _detach;
    private _nextId;
    constructor(opts?: KeymapOptions);
    get isMac(): boolean;
    /** Replace the scope resolver. */
    setScopes(fn: () => readonly KeyScope[]): void;
    activeScopes(): readonly KeyScope[];
    /**
     * Bind a chord. Returns a disposer. Throws on a chord the grammar cannot
     * read, because a binding that can never fire is a defect at the call site,
     * not at key time.
     */
    register(binding: string, action: KeyAction, scope?: KeyScope, opts?: KeyBindingOptions): () => void;
    private _unregister;
    private _conflict;
    /** Be told when a registration collides with an earlier one. */
    onConflict(fn: (c: KeyConflict) => void): () => void;
    /**
     * Resolve and run the binding for an event. True when a binding claimed it,
     * in which case the event has been prevented and stopped.
     */
    handle(e: KeyEventLike): boolean;
    /**
     * Listen on `target` in the capture phase, so a claimed chord never reaches
     * the engine's own listener on the document. Returns the detacher; a second
     * call replaces the first.
     */
    attach(target: {
        addEventListener(t: string, fn: EventListener, opts?: boolean): void;
        removeEventListener(t: string, fn: EventListener, opts?: boolean): void;
    }): () => void;
    list(): readonly KeyBinding[];
    /** Every collision recorded so far: widget against widget, and widget against the engine's keymap. */
    conflicts(): readonly KeyConflict[];
    format(combo: string): string;
    /**
     * The bindings as the shortcuts panel shows them: the widget's own groups,
     * then the engine's chart commands, with any chord the widget claims first
     * marked as shadowed.
     */
    describe(): KeymapGroup[];
    destroy(): void;
}
/**
 * The shortcuts panel: every group from `keymap.describe()`, two columns,
 * closed by Escape or its button. Returns the closer.
 */
declare function openShortcutsPanel(ctx: WidgetContext): () => void;

type ToastKind = 'info' | 'success' | 'error';
declare const TOAST_MS: Readonly<Record<ToastKind, number>>;
/** Newest at the bottom; beyond this many the oldest goes. */
declare const TOAST_MAX = 2;
/** How long the leave transition runs before the node is removed. */
declare const TOAST_LEAVE_MS = 160;
interface ToastOptions {
    /** Overrides the kind's stay. 0 keeps it up. */
    ms?: number;
}
interface ToastHandle {
    readonly node: HTMLElement;
    dismiss(): void;
}
interface Toaster {
    toast(message: string, kind?: ToastKind, opts?: ToastOptions): ToastHandle;
    /** Take every toast down now. */
    clear(): void;
    /** Number of toasts currently showing. */
    count(): number;
    destroy(): void;
}
/**
 * Mount the toast stack into `host` (an empty element the shell positions
 * over the chart). `doc` is the host's document unless given, for a fake DOM.
 */
declare function mountToasts(host: HTMLElement, doc?: Document): Toaster;

/**
 * Design tokens for the widget chrome, as CSS custom properties derived from
 * the chart theme in force.
 *
 * The engine's `ChartTheme` names a dozen colours for the canvas (background,
 * grid, axis text, the candle pair, the line colour). The rail, the top bar
 * and every dialog need perhaps thirty: panel and raised-panel greys, a soft
 * and a firm border, three text weights, an accent and its pressed tint. None
 * of those is worth a second palette a host has to keep in step with the
 * first, so every one is computed here from the theme, and switching the
 * chart's theme restyles the chrome in the same call.
 *
 * Pure: strings in, strings out. `applyTokens` is the one function that
 * touches an element, and it only writes `style.setProperty`.
 */

/** Every custom property carries this prefix, so a host stylesheet cannot collide with one. */
declare const TOKEN_PREFIX = "--oac-";
type WidgetThemeName = 'dark' | 'light';
/** Property name (with the prefix) to value. */
type WidgetTokens = Readonly<Record<string, string>>;
interface Rgba {
    r: number;
    g: number;
    b: number;
    a: number;
}
/**
 * Parse a CSS colour in the forms a theme uses: `#rgb`, `#rgba`, `#rrggbb`,
 * `#rrggbbaa`, `rgb()` and `rgba()`. Anything else (a named colour, `hsl()`)
 * is returned as null, and the caller falls back to a sensible neutral rather
 * than throwing: a theme with one exotic colour should still get chrome.
 */
declare function parseColor(input: string): Rgba | null;
/** Serialise: opaque colours as `#rrggbb`, translucent ones as `rgba()`. */
declare function formatColor(c: Rgba): string;
/** Relative luminance, 0 (black) to 1 (white), on the sRGB curve. */
declare function luminance(color: string): number;
/** Which of the two modes a theme is, judged from its background. */
declare function themeMode(theme: Pick<ChartTheme, 'background'>): WidgetThemeName;
/** Linear blend of `a` toward `b` by `t` (0 keeps `a`, 1 gives `b`). Alpha blends too. */
declare function mix(a: string, b: string, t: number): string;
/** The colour with its alpha replaced. */
declare function withAlpha(color: string, alpha: number): string;
/** The system UI stack every piece of chrome sets in text. */
declare const WIDGET_FONT = "ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", Roboto, sans-serif";
declare const WIDGET_MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
/** Layout measurements, in CSS pixels, shared by the stylesheet and the placement maths. */
declare const RAIL_WIDTH = 42;
declare const TOPBAR_HEIGHT = 40;
declare const STATUSLINE_HEIGHT = 24;
/**
 * Compute the token set for a theme.
 *
 * Every grey is the background stepped toward the opposite pole (white on a
 * dark theme, near-black on a light one), so a host theme with a blue-black
 * background gets blue-black panels rather than a neutral grey pasted onto
 * it. The accent is the theme's line colour, the up and down pair are the
 * candle colours, and text comes from the axis text colour lifted for
 * legibility: the axis is deliberately muted on the canvas, and a panel label
 * at that weight reads as disabled.
 */
declare function widgetTokens(theme: ChartTheme, mode?: WidgetThemeName): WidgetTokens;
/** Write a token set onto an element as inline custom properties. */
declare function applyTokens(el: HTMLElement, tokens: WidgetTokens): void;
/** `var(--oac-name)`, for code that builds inline style values from a token. */
declare const token: (name: string) => string;

/**
 * The contract between the widget shell and everything mounted inside it.
 *
 * `WidgetContext` is what the shell hands to the rail, the top bar, the
 * status line and every dialog: the chart and the drawing controller, the
 * root element, the theme in force, the keymap, a toast, an overlay opener
 * that positions, focus-traps and Escape-closes whatever it is given, and a
 * small event bus. A dialog module never reaches for the document on its own;
 * everything it needs to place itself or to hand focus back comes from here.
 *
 * The rest of this file is the furniture behind that contract: the bus, the
 * overlay stack, the tooltip, the storage wrapper and the dialog registry
 * through which the dialog tier makes its mount functions known.
 */

/** HTML-escape the four characters that matter in text and attribute values. */
declare const esc: (s: unknown) => string;
/** Create an element with a class and optional attributes. */
declare function h<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, className?: string, attrs?: Record<string, string>): HTMLElementTagNameMap[K];
/**
 * A glyph span. The markup is a string from the draw tier's icon builders,
 * so this is the one place `innerHTML` is written, and it only ever wraps a
 * trusted `<svg>` from the registry.
 */
declare function glyph(doc: Document, svg: string, kind: 'tool' | 'chrome'): HTMLSpanElement;
/** Whether a key event came from a text control, where chords stay out of the way. */
declare function inTextField(target: unknown): boolean;
/** Whether `n` can take focus: a control, enabled, and not under a `hidden`. */
declare function focusable(n: Element | null): n is HTMLElement;
declare const focusables: (root: Element) => HTMLElement[];
interface Box {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
}
interface Size {
    width: number;
    height: number;
}
/**
 * Where a panel of `size` goes beside `anchor` without leaving `bounds`: to
 * the right of it by `gap`, its top on the anchor's top, then pulled up (never
 * past `pad`) when it would run off the bottom, and flipped to the left only
 * when the right has no room at all. Coordinates are in whatever space the
 * anchor and the bounds share.
 */
declare function placeBeside(anchor: Box, size: Size, bounds: Size, gap?: number, pad?: number): {
    left: number;
    top: number;
    side: 'left' | 'right';
};
/** A panel under `anchor`, left-aligned with it, flipped above when there is no room below. */
declare function placeBelow(anchor: Box, size: Size, bounds: Size, gap?: number, pad?: number): {
    left: number;
    top: number;
};
type TipSide = 'right' | 'left' | 'top' | 'bottom';
/** A tip centred on the anchor's edge, flipped across it when its side has no room. */
declare function placeTip(anchor: Box, size: Size, bounds: Size, side?: TipSide, gap?: number, pad?: number): {
    left: number;
    top: number;
};
/** An element's box in the coordinate space of `root` (the widget), not the viewport. */
declare function boxIn(root: HTMLElement, el: Element): Box;
type BusHandler<T = unknown> = (payload: T) => void;
/**
 * A tiny typed event bus. Handlers run in registration order; one that throws
 * does not stop the others, because a host's listener failing must not take
 * the shell's own bookkeeping with it.
 */
declare class WidgetBus<Events extends Record<string, unknown> = Record<string, unknown>> {
    private readonly _handlers;
    on<K extends keyof Events & string>(event: K, handler: BusHandler<Events[K]>): () => void;
    off<K extends keyof Events & string>(event: K, handler?: BusHandler<Events[K]>): void;
    emit<K extends keyof Events & string>(event: K, payload: Events[K]): void;
    clear(): void;
}
/** The three calls the widget makes on a store. `localStorage` satisfies it. */
interface StorageLike {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}
/** Every key the widget writes sits under this prefix, so a host on the same origin cannot collide. */
declare const STORAGE_PREFIX = "oac-widget:";
/**
 * Namespaced JSON storage that never throws: a private window, a full quota
 * or a blocked store all read as "nothing saved" and write as "not kept".
 */
declare class WidgetStorage {
    private readonly _store;
    private readonly _ns;
    constructor(namespace: string, store: StorageLike | null);
    key(name: string): string;
    get(name: string): unknown;
    /** True when the write landed. */
    set(name: string, value: unknown): boolean;
    remove(name: string): void;
    /** Whether writes can land at all. */
    get enabled(): boolean;
}
/** The page's `localStorage` when it exists and works, else null. */
declare function defaultStorage(): StorageLike | null;
/** What a dialog module's mount function returns. */
interface DialogHandle {
    close(): void;
}
/** The mount signature every dialog exports: `(ctx, anchor?) => { close }`. */
type DialogMount = (ctx: WidgetContext, anchor?: HTMLElement) => DialogHandle;
/**
 * The dialogs the shell knows how to ask for. Each is mounted by the dialog
 * tier and registered here; a shell built without one renders the control
 * that would open it disabled, with its state visible, rather than dead.
 */
type WidgetDialogName = 'settings' | 'indicatorPicker' | 'indicatorSettings' | 'drawingProperties' | 'contextMenu' | 'levelEditor' | 'textEditor';
/** Make a dialog's mount function known to every shell. Returns a disposer. */
declare function registerWidgetDialog(name: WidgetDialogName, mount: DialogMount): () => void;
/** Register several at once, from a module's exports. */
declare function registerWidgetDialogs(mounts: Partial<Record<WidgetDialogName, DialogMount>>): () => void;
/** Take a dialog out of the registry. False when nothing was registered under the name. */
declare function unregisterWidgetDialog(name: WidgetDialogName): boolean;
/** The registered mount for a dialog, or null. */
declare function widgetDialog(name: WidgetDialogName): DialogMount | null;
declare function registeredWidgetDialogs(): WidgetDialogName[];
interface OverlayOptions {
    /** The control the panel opens from; positions the panel and keeps a click on it from counting as outside. */
    anchor?: HTMLElement;
    /** Where the panel goes relative to the anchor. Default `below`; `center` ignores the anchor. */
    placement?: 'below' | 'beside' | 'center';
    /** A second element the panel should clear when placed beside (the rail, not just the button in it). */
    edge?: HTMLElement;
    /** Draw a scrim and refuse outside dismissal. Default false; `center` placement implies it. */
    modal?: boolean;
    /** Where focus lands: an element, `null` to leave focus where it is, or the first control (default). */
    initialFocus?: HTMLElement | null;
    /** Close on a press outside the panel and its anchor. Default: not modal. */
    dismissOnOutside?: boolean;
    /** Close on Escape. Default true. */
    dismissOnEscape?: boolean;
    /** Give focus back to the opener on close. Default true. */
    restoreFocus?: boolean;
    onClose?: () => void;
}
interface OverlayStack {
    open(el: HTMLElement, opts?: OverlayOptions): () => void;
    /** Close the newest overlay. False when nothing is open. */
    closeTop(): boolean;
    closeAll(): void;
    top(): HTMLElement | null;
    size(): number;
    /** The layer element overlays are appended to. */
    readonly layer: HTMLElement;
    destroy(): void;
}
/**
 * One stack per widget. Each module opens and closes its own panel; what none
 * of them can know is what else is open. The stack knows: Escape closes only
 * the newest thing, Tab stays inside it, a press outside closes a popover but
 * not a dialog, and focus goes back where it came from.
 */
declare function createOverlayStack(root: HTMLElement, doc: Document): OverlayStack;
interface TipSpec {
    title: string;
    /** The chord, shown in monospace after the title. */
    chord?: string;
    /** A second, muted line. */
    sub?: string;
    side?: TipSide;
}
/** A spec, or a function read at show time for a control whose label follows its state. */
type TipSource = TipSpec | (() => TipSpec | null);
interface TipController {
    /** Give `target` a hover label. `dwellMs` delays it; 0 shows on entry. */
    attach(target: HTMLElement, spec: TipSource, dwellMs?: number): void;
    /** Re-read a control's spec into its accessible name. */
    refreshLabel(target: HTMLElement): void;
    show(target: HTMLElement): void;
    hide(): void;
    /** The control the tip is up for, or null. */
    target(): HTMLElement | null;
    destroy(): void;
}
/** How long the pointer rests on a rail control before its label appears. */
declare const TIP_DWELL_MS = 600;
/**
 * One tip node per widget. A `title` waits about a second, cannot be styled
 * and cannot carry a second line, which is no use on a rail of near-identical
 * glyphs or on a bar of bare icons. Specs are read at show time, because a
 * group button stands for whichever tool was last picked from it.
 */
declare function createTipController(root: HTMLElement, layer: HTMLElement, doc: Document): TipController;
/** The events the shell publishes on `ctx.bus`. */
interface WidgetBusEvents {
    symbol: {
        symbol: string;
        exchange: string;
    };
    interval: {
        interval: string;
    };
    theme: {
        theme: WidgetThemeName;
        chartTheme: ChartTheme;
    };
    /** Something about the workspace changed: the chart type, a restored layout, a pane. */
    layout: {
        reason: string;
        chartType?: string;
    };
    /** The status line's transient message changed. */
    status: {
        text: string;
        kind: 'info' | 'error';
    };
    /** A keymap registration collided with another binding. */
    'keymap:conflict': {
        combo: string;
        kept: string;
        shadowed: string;
    };
    /** Bars finished loading, or failed to. */
    data: {
        symbol: string;
        interval: string;
        bars: number;
        error?: string;
    };
    [key: string]: unknown;
}
interface WidgetContext {
    readonly chart: Chart;
    readonly draw: DrawingController;
    /** Live inventory owned by the widget, optional for custom contexts. */
    readonly objects?: ChartObjects;
    /** The `.oac-widget` element every piece of chrome lives in. */
    readonly root: HTMLElement;
    readonly document: Document;
    /** `dark` or `light`, following the chart theme in force. */
    readonly theme: WidgetThemeName;
    /** The engine palette the chart is drawing with. */
    readonly chartTheme: ChartTheme;
    readonly keymap: Keymap;
    readonly bus: WidgetBus<WidgetBusEvents>;
    /** Per-widget persisted preferences; `enabled` is false when `persist` is off. */
    readonly storage: WidgetStorage;
    readonly locale: string | undefined;
    toast(message: string, kind?: ToastKind): ToastHandle;
    /**
     * Show `el` over the widget: positioned from `opts.anchor` (or centred as a
     * dialog), focus-trapped, closed by Escape and by a press outside. Returns
     * the closer.
     */
    openOverlay(el: HTMLElement, opts?: OverlayOptions): () => void;
    /** Put a transient message on the status line. */
    status(text: string, kind?: 'info' | 'error'): void;
    /** Hover labels for controls. */
    readonly tips: TipController;
    /** The overlay stack behind `openOverlay`, for a module that needs to ask what is open. */
    readonly overlays: OverlayStack;
    /** The current symbol and interval, for dialogs that name them. */
    symbol(): {
        symbol: string;
        exchange: string;
    };
    interval(): string;
}

declare const MAGNET_MODES: readonly MagnetMode[];
interface RailGroupItem {
    head?: string;
    tool?: string;
}
interface RailGroup {
    id?: string;
    title?: string;
    items?: RailGroupItem[];
    sep?: boolean;
}
/**
 * Rail groups. Only registered tools are shown, so a build that predates a
 * tool leaves a gap rather than a dead row. Names come from the descriptors,
 * not from here: the rail cannot spell a tool differently from the registry.
 */
declare const RAIL_GROUPS: readonly RailGroup[];
/** A tool's display name from the registry, or the id itself for one the registry lacks. */
declare const toolName: (id: string | null) => string;
interface RailPrefs {
    favorites: string[];
    magnet: MagnetMode;
    stay: boolean;
    /** Group id to the tool its button stands for. */
    last: Record<string, string>;
}
interface RailOptions {
    /** Restrict the rail to these tool ids. Default: every registered tool the groups know. */
    tools?: readonly string[];
    /** Pins to start with when nothing is stored. */
    favorites?: readonly string[];
    /**
     * The element the armed tool's cursor goes on: the chart container. The
     * cursor rides a custom property the stylesheet reads, not the inline
     * cursor, which the engine owns for its own hover hints.
     */
    cursorTarget?: HTMLElement;
}
interface RailHandle {
    readonly el: HTMLElement;
    /** Reflect the armed tool on the buttons. The controller's `draw:tool` event drives it; a host may call it too. */
    sync(tool: string | null): void;
    /** Re-read the controller for the controls block (selection, history). */
    refresh(): void;
    prefs(): RailPrefs;
    restorePrefs(prefs: unknown): void;
    magnetMode(): MagnetMode;
    setMagnetMode(mode: MagnetMode): void;
    /** off -> weak -> strong -> off. Returns the new mode. */
    cycleMagnet(): MagnetMode;
    stayMode(): boolean;
    setStayMode(on: boolean): void;
    favorites(): string[];
    isFavorite(id: string): boolean;
    toggleFavorite(id: string, on?: boolean): void;
    /** The double-click hold: one tool kept armed until something leaves it. */
    setDrawLock(on: boolean): void;
    drawLocked(): boolean;
    setFavToolbarActive(on: boolean): void;
    /** Open a group's flyout beside its button. */
    openGroup(groupId: string, viaKeyboard?: boolean): void;
    closeFlyout(): void;
    flyoutOpen(): boolean;
    destroy(): void;
}
/** Storage key the preferences live under. */
declare const RAIL_PREFS_KEY = "rail";
/**
 * A tool's glyph as a `<use>` into the sprite. A tool the tier has no glyph
 * for (a host-registered one) gets its initial instead of a throw, so one
 * custom tool cannot blank the rail.
 */
declare function toolGlyph(doc: Document, id: string): HTMLElement;
/** Validate a stored preference object field by field, dropping what this build cannot honour. */
declare function sanitizeRailPrefs(raw: unknown, groups: readonly RailGroup[], toolsOf: (g: RailGroup) => string[]): RailPrefs;
declare function mountRail(ctx: WidgetContext, host: HTMLElement, opts?: RailOptions): RailHandle;

/** One hit from a host's symbol search. */
interface SymbolMatch {
    symbol: string;
    exchange?: string;
    /** Long name, shown muted after the symbol. */
    name?: string;
}
/** A host's symbol lookup, called as the user types. Sync or async. */
type SymbolSearch = (query: string) => Promise<readonly SymbolMatch[]> | readonly SymbolMatch[];
/** Milliseconds of quiet before the search callback runs. */
declare const SEARCH_DEBOUNCE_MS = 150;
/** Labels for the built-in chart types; anything else is read from its id. */
declare const CHART_TYPE_LABELS: Readonly<Record<string, string>>;
declare function chartTypeLabel(id: string): string;
/**
 * The chart types a primary series can be: every registered renderer that
 * declares itself a price series. A volume histogram is registered too and
 * would draw, but it is not a chart type anyone picks for the instrument.
 */
declare function chartTypeChoices(): string[];
/**
 * A pill label for an interval code: minutes and hours keep their lower-case
 * unit (`5m`, `1h`), days and weeks read as a capital (`D`, `W`, `2W`), and
 * anything else (a registered calendar code) is upper-cased as written.
 */
declare function intervalLabel(code: string): string;
interface MenuRow {
    label: string;
    sub?: string;
    /** Shown at the right edge, for a chord. */
    key?: string;
    /** Marks the row as the current choice. */
    on?: boolean;
    disabled?: boolean;
    danger?: boolean;
    onSelect: () => void;
}
interface MenuOptions {
    /** A search box at the top with this placeholder; rows filter as the user types. */
    find?: string;
    ariaLabel?: string;
}
/**
 * A popup menu under `anchor`. Rows are buttons; a `{ head }` string starts a
 * group. Returns the closer. Exported for the dialog tier, whose context menu
 * and pickers want the same shape.
 */
declare function openMenu(ctx: WidgetContext, anchor: HTMLElement, rows: ReadonlyArray<MenuRow | string>, opts?: MenuOptions): () => void;
interface TopbarState {
    symbol: string;
    exchange: string;
    interval: string;
    chartType: string;
    theme: WidgetThemeName;
}
interface TopbarOptions {
    intervals: readonly string[];
    /** Show the indicators button. Default true. */
    indicators?: boolean;
    search?: SymbolSearch;
    /** The current facts, read on every refresh. */
    state: () => TopbarState;
    onSymbol(symbol: string, exchange?: string): void;
    onInterval(code: string): void;
    onChartType(id: string): void;
    onTheme(next: WidgetThemeName): void;
    /** Open the settings dialog from `anchor`. Return false when no dialog is registered. */
    onSettings(anchor: HTMLElement): boolean;
    onIndicators(anchor: HTMLElement): boolean;
    /** A text control for the host's object inventory, omitted without a handler. */
    onObjects?(anchor: HTMLElement): boolean;
    settingsAvailable(): boolean;
    indicatorsAvailable(): boolean;
}
interface TopbarHandle {
    readonly el: HTMLElement;
    /** Repaint every control from `state()`. */
    refresh(): void;
    /** Put the caret in the symbol box, text selected. */
    focusSymbol(): void;
    destroy(): void;
}
/** Hand `text` to the browser as a file. False when the runtime has no way to (no `Blob`, no object URLs). */
declare function downloadText(doc: Document, filename: string, text: string, mime: string): boolean;
/** `SYMBOL-5m-2026-01-31-09-15` with the characters a filename cannot carry removed. */
declare function captureName(symbol: string, interval: string, now?: Date): string;
declare function mountTopbar(ctx: WidgetContext, host: HTMLElement, opts: TopbarOptions): TopbarHandle;

type FormKind = 'boolean' | 'number' | 'color' | 'text' | 'multiline' | 'select' | 'opacity' | 'colorPair' | 'custom';
/** One row of a generated form, whatever schema it came from. */
interface FormControl {
    /** The flat key `onChange` reports. A `colorPair` reports its halves' keys instead. */
    key: string;
    kind: FormKind;
    label: string;
    /** Sub-heading the row sits under; consecutive rows with one group share a header. */
    group?: string;
    /** Help text; rendered as a hover affordance beside the label. */
    tooltip?: string;
    min?: number;
    max?: number;
    step?: number;
    /** `select` only. Absent means free-form: the control becomes a text box. */
    options?: readonly {
        label: string;
        value: string;
    }[];
    /** `colorPair` only: the switch (optional) and the two swatches. */
    pair?: {
        enabled?: {
            key: string;
        };
        up: {
            key: string;
            label: string;
        };
        down: {
            key: string;
            label: string;
        };
    };
    /** `custom` only: what the dialog renders in the control column. */
    custom?: string;
}
type FormValues = Readonly<Record<string, unknown>>;
interface FormOptions {
    values: FormValues;
    /** Every edit, with the value in the control's declared type. */
    onChange(key: string, value: unknown): void;
    /**
     * Why a control, or one option of a select, cannot act right now, or null
     * when it can. Drawn disabled with the reason as its title, never hidden: a
     * greyed row is information, an absent one is a mystery.
     */
    unavailable?(key: string, option?: string): string | null;
    /** Prefix for element ids, so two forms in one document never share one. */
    idPrefix: string;
    /**
     * Emit colour and slider edits on `input` as well as `change`, for a dialog
     * that previews live. Off, a colour is one edit when the picker closes and a
     * slider one edit on release, which is what a per-edit undo history wants.
     */
    live?: boolean;
    /** Renders the control column of a `custom` row. Null skips the row. */
    custom?(control: FormControl, row: HTMLElement): HTMLElement | null;
}
interface FormHandle {
    el: HTMLElement;
    /** Re-read `values` into every control the user is not currently in. */
    sync(values: FormValues): void;
    /** Every control's current value, keyed the way `onChange` reports it. */
    values(): Record<string, unknown>;
    /** Focus the first enabled control. */
    focusFirst(): boolean;
}
/**
 * Chart-settings and indicator inputs. `source` becomes a select over the
 * canonical price sources; a `colorPair` keeps its two or three keys.
 */
declare function controlsFromInputs(inputs: readonly ChartSettingsInput[]): FormControl[];
/**
 * Draw-tier fields. `lineStyle` is a select with a fixed option list, an
 * `opacity` is a slider read in percent, `levels` is left to the dialog (the
 * level editor is its own surface), and the text tool's content is the one
 * multi-line box.
 */
declare function controlsFromFields(fields: readonly SettingsField[]): FormControl[];
/** What every mount function returns: the shell's `DialogHandle` plus the node and a liveness probe. */
interface PanelHandle {
    el: HTMLElement;
    close(): void;
    isOpen(): boolean;
}
/**
 * Render `controls` into `host` (emptied first). Rows sit under small
 * uppercase group headers; a boolean sits in the switch column in front of its
 * label; everything else sits in the control column on the right.
 */
declare function renderForm(host: HTMLElement, controls: readonly FormControl[], opts: FormOptions): FormHandle;

/** What the menu asks a host to do when an order row is picked. */
interface OrderRequest {
    side: 'BUY' | 'SELL';
    type: 'MARKET' | 'LIMIT' | 'SL';
    /** The price under the pointer; null for a market order raised off the plot. */
    price: number | null;
    paneIndex: number;
}
interface MenuItem {
    kind?: 'item';
    label: string;
    /** Chrome icon id, or inline SVG markup starting with `<svg`. */
    icon?: string;
    /** Chord hint, shown at the right. */
    chord?: string;
    /** A switch (tick) or one option of a choice (dot). */
    mark?: 'check' | 'radio';
    on?: boolean;
    disabled?: boolean;
    /** Why a disabled row is disabled; an empty greyed row reads as a bug. */
    note?: string;
    danger?: boolean;
    /** Keep the menu up after running (a switch the user may flip twice). */
    keepOpen?: boolean;
    /** Stable id, for tests and for a host that wants to find a row. */
    id?: string;
    run?(): void;
}
type MenuEntry = MenuItem | {
    kind: 'separator';
} | {
    kind: 'header';
    label: string;
};
interface ContextMenuHooks {
    /** Order entry. Without it no trade rows are drawn: the engine places no orders itself. */
    onOrder?(order: OrderRequest): void;
    /** Alert creation hook. Triggered when user picks 'Add alert on SYMBOL at PRICE...' */
    onAlert?(alert: {
        symbol: string;
        price: number;
        paneIndex: number;
    }): void;
    /** Extra rows a host appends, built per event. */
    items?(e: ContextMenuEvent): MenuEntry[];
}
interface ContextMenuOptions {
    /** The chart's event. Without one the menu is the chart-level menu at the anchor. */
    event?: ContextMenuEvent;
    hooks?: ContextMenuHooks;
}
/**
 * Every row the menu shows for `e`, in order. Pure apart from the closures:
 * nothing is rendered, so a test (or a host building its own menu) can read
 * the list.
 */
declare function contextMenuEntries(ctx: WidgetContext, e: ContextMenuEvent, hooks?: ContextMenuHooks): MenuEntry[];
/**
 * Show the menu for `opts.event` at the pointer, or the chart-level menu below
 * `anchor` when no event is given.
 */
declare function mountContextMenu(ctx: WidgetContext, anchor?: HTMLElement, opts?: ContextMenuOptions): PanelHandle;
/**
 * Wire the chart's `contextmenu` event to the menu. Returns the unsubscriber.
 * The browser's own menu is suppressed only once ours is up, so a host that
 * detaches this gets the native one back.
 */
declare function attachContextMenu(ctx: WidgetContext, hooks?: ContextMenuHooks): () => void;

interface DrawingPropertiesOptions {
    /** The drawings to edit; they become the selection. Default: the current selection. */
    ids?: readonly string[];
    /** Runs once when the dialog is gone. */
    onClose?(): void;
}
/**
 * Open the properties dialog for the selection, below `anchor` when there is
 * one (a toolbar button), else beside the drawing.
 */
declare function mountDrawingProperties(ctx: WidgetContext, anchor?: HTMLElement, opts?: DrawingPropertiesOptions): PanelHandle;

interface IndicatorPickerOptions {
    /** Runs after each instance is added, with its handle. */
    onAdd?(inst: IndicatorApi): void;
    /** Close the picker after the first add. Default false. */
    closeOnAdd?: boolean;
}
/**
 * Open the picker below `anchor` (the toolbar's Indicators button), or centred
 * when there is none.
 */
declare function mountIndicatorPicker(ctx: WidgetContext, anchor?: HTMLElement, opts?: IndicatorPickerOptions): PanelHandle;

type IndicatorSettingsTab = 'inputs' | 'style';
interface IndicatorSettingsOptions {
    /**
     * The instance to edit. Without it the dialog reads `data-instance-id` off
     * the anchor (a legend row's gear), and failing that edits the chart's only
     * indicator; with several and no id it declines with a toast.
     */
    instanceId?: string;
    tab?: IndicatorSettingsTab;
    /** Runs after every write, including a revert. */
    onChange?(inst: IndicatorApi): void;
    /** Runs once when the dialog is gone; `committed` is false after Cancel or Escape. */
    onClose?(committed: boolean): void;
}
declare function mountIndicatorSettings(ctx: WidgetContext, anchor?: HTMLElement, opts?: IndicatorSettingsOptions): PanelHandle;

interface LevelEditorOptions {
    /** The drawings to edit. Default: the controller's selection. */
    ids?: readonly string[];
}
/**
 * Open the editor for the selected ladder drawings, below `anchor` when there
 * is one (the properties dialog's button), else beside the selection.
 */
declare function mountLevelEditor(ctx: WidgetContext, anchor?: HTMLElement, opts?: LevelEditorOptions): PanelHandle;

interface SettingsDialogOptions {
    /** The tab to open on. Default: the first tab with a control in it. */
    tab?: ChartSettingsTabId;
    /**
     * Why a control, or one option of a select, cannot act in this host right
     * now, or null. A host that draws its own trade chrome knows whether there
     * is a position to recolour; the engine does not.
     */
    unavailable?(key: string, option?: string): string | null;
    /** Runs after every write, including a revert, for state a host keeps outside the schema. */
    onApply?(patch: Readonly<Partial<ChartSettingsValues>>): void;
    /** Runs once when the dialog is gone; `committed` is false after Cancel or Escape. */
    onClose?(committed: boolean): void;
}
/**
 * Open the chart settings dialog, centred over the widget. `anchor` is
 * accepted for the registry's uniform signature and not used: a dialog this
 * size is not a popover.
 */
declare function mountSettingsDialog(ctx: WidgetContext, _anchor?: HTMLElement, opts?: SettingsDialogOptions): PanelHandle;

interface TextEditorOptions {
    /** The drawing to edit. Default: the one selected drawing. */
    id?: string;
    /** Runs once after the box is gone; `committed` is true when the text changed. */
    onDone?(committed: boolean): void;
}
interface TextEditorHandle extends PanelHandle {
    commit(): void;
    cancel(): void;
}
/**
 * Open the editor over the drawing. `anchor` is accepted for the registry's
 * uniform signature and not used: the box sits where the text is painted.
 */
declare function mountTextEditor(ctx: WidgetContext, _anchor?: HTMLElement, opts?: TextEditorOptions): TextEditorHandle;

/** The seven mounts under the names the shell's registry knows them by. */
declare const WIDGET_DIALOGS: {
    settings: typeof mountSettingsDialog;
    indicatorPicker: typeof mountIndicatorPicker;
    indicatorSettings: typeof mountIndicatorSettings;
    drawingProperties: typeof mountDrawingProperties;
    contextMenu: typeof mountContextMenu;
    levelEditor: typeof mountLevelEditor;
    textEditor: typeof mountTextEditor;
};
/**
 * The rules the dialogs add to the widget stylesheet. Scoped under
 * `.oac-widget` and coloured only through tokens, like the shell's own; the
 * generic furniture (`.oac-dialog__*`, `.oac-btn`, the form controls) is the
 * shell's and is not restated here.
 */
declare const DIALOG_CSS: string;

type MobileMode = 'auto' | 'always' | 'never';
interface MobileOptions {
    mode?: MobileMode;
    container: HTMLElement;
    intervals: readonly string[];
    topbar: boolean;
    rail: RailHandle | null;
    tools?: readonly string[];
    indicators: boolean;
    search?: SymbolSearch;
    state(): TopbarState;
    onSymbol(symbol: string, exchange?: string): void;
    onInterval(code: string): void;
    onChartType(id: string): void;
    onTheme(): void;
    onSettings(anchor: HTMLElement): boolean;
    onIndicators(anchor: HTMLElement): boolean;
    onObjects(anchor: HTMLElement): boolean;
    onProperties(anchor: HTMLElement): boolean;
    settingsAvailable(): boolean;
    indicatorsAvailable(): boolean;
}
interface MobileHandle {
    readonly el: HTMLElement;
    active(): boolean;
    refresh(): void;
    destroy(): void;
}
/** Mount the narrow widget controls against the same chart and controllers as the desktop chrome. */
declare function mountMobile(ctx: WidgetContext, opts: MobileOptions): MobileHandle;

/**
 * The widget shell: a chart with its chrome, built in one call.
 *
 * `createWidget(container, options)` puts a `.oac-widget` root into the
 * container with a top bar, a stage (the tool rail beside the chart) and a
 * status line, creates the chart and the drawing controller inside it, wires
 * the keymap, the overlay stack and the toasts, and hands every mounted piece
 * one `WidgetContext`. A host that wants the chart alone still has the engine;
 * this is for the host that wants the terminal.
 *
 * Three decisions worth recording:
 *
 * - **The shell owns the theme, the symbol and the interval; the chart owns
 *   everything else.** The engine has no instrument concept, so symbol and
 *   interval live here, drive the feed from here, and are published on the bus
 *   as `symbol` and `interval` for a host (or a link group) to follow.
 * - **Persisted state is validated field by field and applied to the dataset
 *   it was captured on.** A viewport is a range of bar indices and means
 *   nothing on different bars, so a saved layout landing on another symbol
 *   keeps its indicators, drawings and panes and drops its view.
 * - **Every chord goes through one keymap in the capture phase.** The rail,
 *   the editing keys and the tool chords register there with a scope, so a
 *   dialog being open or the focus being in the rail is decided once, not in
 *   every listener.
 */

/** The intervals offered when the host names none: the registry's codes are appended. */
declare const DEFAULT_INTERVALS: readonly string[];
/** Bars asked of the feed per load when the host names no lookback. */
declare const DEFAULT_LOOKBACK_BARS = 500;
/** Debounce on writing the persisted layout, because drags fire per frame. */
declare const SAVE_DEBOUNCE_MS = 250;
/** The storage entry the layout lives under. */
declare const STATE_KEY = "state";
declare const WIDGET_STATE_VERSION = 1;
interface WidgetOptions extends Omit<ChartOptions, 'theme'> {
    /** Where bars come from. Without one the chart shows what the host sets on `widget.series` itself. */
    feed?: DataFeed;
    /** Shared history, paging and recovery options. `now` here uses UTC seconds. */
    loading?: DataLoadingOptions;
    symbol?: string;
    /** Exchange passed to the feed with the symbol. Default `''`. */
    exchange?: string;
    /** Interval code the registry knows (a built-in token or one passed to `registerInterval`). Default `1d`. */
    interval?: string;
    /** The interval pills, each a known code. Default: `DEFAULT_INTERVALS` plus every registered code. */
    intervals?: readonly string[];
    /** Primary series type. Default `candlestick`. Must be a registered chart type. */
    chartType?: string;
    /** `dark` (default), `light`, or a full `ChartTheme`; the chrome derives its palette from it. */
    theme?: WidgetThemeName | ChartTheme;
    /** The drawing rail. `false` hides it; an object restricts its tools or seeds its pins. Default on. */
    rail?: boolean | RailOptions;
    topbar?: boolean;
    statusline?: boolean;
    /** Narrow controls. Auto activates at 640 CSS px or less, or for a coarse primary pointer. Default auto. */
    mobile?: MobileMode;
    /**
     * Keep the layout, the rail preferences, the symbol, the interval and the
     * theme between visits. `true` uses one shared namespace; a string names one,
     * so two widgets on a page keep separate layouts. Default off.
     */
    persist?: boolean | string;
    /** The store behind `persist`. Default: the page's `localStorage`. */
    storage?: StorageLike | null;
    /** BCP 47 tag for the numbers on the status line. Default: the runtime's. */
    locale?: string;
    /** Show the Indicators button. Default true. */
    indicators?: boolean;
    /** Symbol lookup for the top bar's box, called as the user types. */
    symbolSearch?: SymbolSearch;
    /** How many bars a load asks the feed for. Default `DEFAULT_LOOKBACK_BARS`. */
    lookbackBars?: number;
    /** Clock for the load window and the capture filename. Default `Date.now`. */
    now?: () => number;
    /** Order entry from the right-click menu. Without it the menu draws no trade rows. */
    onOrder?: (order: OrderRequest) => void;
    /** Alert creation from the right-click menu. */
    onAlert?: (alert: {
        symbol: string;
        price: number;
        paneIndex: number;
    }) => void;
    /** Host CSP nonce for the widget and dialog stylesheet, assigned before insertion. */
    styleNonce?: string;
}
type WidgetChartState = ReturnType<Chart['getState']>;
/** What `getState` returns and `restoreState` takes. JSON-safe. */
interface WidgetState {
    version: typeof WIDGET_STATE_VERSION;
    symbol: string;
    exchange: string;
    interval: string;
    chartType: string;
    theme: WidgetThemeName;
    chart: WidgetChartState;
    rail: RailPrefs | null;
}
interface WidgetRestoreReport {
    applied: boolean;
    reason?: string;
    /** The engine's own report for the chart half, when it was reached. */
    chart?: RestoreReport;
}
type WidgetEventName = 'symbol' | 'interval' | 'theme' | 'layout' | 'data' | 'status';
interface Widget {
    /** Managed data owner, or null when the host supplies series data directly. */
    readonly dataController: DataLoadingController | null;
    readonly chart: Chart;
    readonly draw: DrawingController;
    /** Shared inventory and supported actions for drawings, indicators and registered profiles. */
    readonly objects: ChartObjects;
    /** The `.oac-widget` element. */
    readonly root: HTMLElement;
    /** What every mounted piece was handed; a host mounting its own panel wants the same. */
    readonly context: WidgetContext;
    /** The primary series, replaced by `setChartType`. */
    readonly series: SeriesApi;
    symbol(): string;
    exchange(): string;
    interval(): string;
    chartType(): string;
    theme(): WidgetThemeName;
    setSymbol(symbol: string, exchange?: string): void;
    setInterval(code: string): void;
    setChartType(id: string): void;
    setTheme(theme: WidgetThemeName | ChartTheme): void;
    /** Open the settings dialog. False when the dialog tier has not registered one. */
    openSettings(): boolean;
    openIndicatorPicker(): boolean;
    /** Open the searchable object inventory. False after destruction. */
    openObjects(): boolean;
    getState(): WidgetState;
    restoreState(state: unknown): WidgetRestoreReport;
    /** Load (or reload) bars from the feed for the current symbol and interval. */
    reload(): Promise<void>;
    on<K extends WidgetEventName>(event: K, cb: (payload: WidgetBusEvents[K]) => void): () => void;
    off<K extends WidgetEventName>(event: K, cb?: (payload: WidgetBusEvents[K]) => void): void;
    destroy(): void;
    readonly isDestroyed: boolean;
}
/**
 * The saved chart state without what describes the old view: the viewport
 * and every pinned price range go, the indicators, drawings and pane weights
 * stay. For a layout about to land on a different dataset.
 */
declare function stripView(state: WidgetChartState): WidgetChartState;
/** Resolve a theme option to the engine palette and the chrome mode. */
declare function resolveTheme(t: WidgetThemeName | ChartTheme | undefined): {
    theme: ChartTheme;
    name: WidgetThemeName;
};
/** The window the feed is asked for: `lookback` bars back from now, or five years for a non-time bucketing. */
declare function loadWindow(interval: string, lookback: number, nowSec: number): {
    from: number;
    to: number;
};
/**
 * Build a widget inside `container`: an element, or a selector (or id)
 * resolved against `options.document` or the page.
 */
declare function createWidget(container: HTMLElement | string, options?: WidgetOptions): Widget;

interface ObjectsPanelOptions {
    /** Overrides the widget's inventory for a custom host. The caller owns it. */
    objects?: ChartObjects;
    /** Runs once for either programmatic or overlay dismissal. */
    onClose?: () => void;
}
/** Open a searchable inventory backed by the host's live object model. */
declare function mountObjectsPanel(ctx: WidgetContext, anchor?: HTMLElement, opts?: ObjectsPanelOptions): PanelHandle;
/** Append beside the shared widget and dialog styles when mounting this panel. */
declare const OBJECTS_PANEL_CSS = "\n.oac-widget .oac-objects { width: 440px; min-width: 0; }\n.oac-widget .oac-objects .oac-dialog__body { display: flex; flex-direction: column; gap: 8px; overflow: hidden; }\n.oac-widget .oac-objects__find { width: 100%; min-width: 0; flex: none; }\n.oac-widget .oac-objects__list { min-height: 0; overflow: auto; overscroll-behavior: contain; padding: 2px; }\n.oac-widget .oac-objects__row { display: flex; flex-direction: column; gap: 4px; padding: 6px; margin-bottom: 4px;\n  border: 1px solid var(--oac-bd-soft); border-radius: 6px; min-width: 0; }\n.oac-widget .oac-objects__row.is-selected { border-color: var(--oac-acc); background: var(--oac-elev); }\n.oac-widget .oac-objects__summary { display: flex; flex-direction: column; align-items: flex-start; justify-content: center;\n  gap: 2px; width: 100%; min-width: 0; height: auto; padding: 3px 4px; text-align: left; white-space: normal; }\n.oac-widget .oac-objects__name { font-weight: 600; overflow-wrap: anywhere; }\n.oac-widget .oac-objects__meta, .oac-widget .oac-objects__status { font-size: 11px; color: var(--oac-mut); overflow-wrap: anywhere; }\n.oac-widget .oac-objects__status[data-state=\"error\"] { color: var(--oac-danger); }\n.oac-widget .oac-objects__actions { display: flex; flex-wrap: wrap; gap: 3px; }\n.oac-widget .oac-objects__actions .oac-btn { height: 26px; padding: 0 6px; font-size: 11px; }\n.oac-widget .oac-objects__count { color: var(--oac-mut); font-size: 11px; }\n";

/**
 * The status line: one row under the chart with the engine's status-line
 * fields in HTML, so a host that turns the on-canvas legend off still has a
 * readout, and a screen reader has text to read.
 *
 * The fields are the legend's: the symbol and interval (the title), the O/H/L/C
 * of the bar under the pointer (chart values), the change over that bar (bar
 * change), its volume, and the bar's time in the chart's zone. Each follows
 * the same switch the settings dialog flips on the chart
 * (`chart.statusLineOptions()`), so turning off "chart values" there empties
 * the O/H/L/C here too. A transient message slot at the right takes what the
 * shell has to say (a load in progress, a magnet change, a saved layout).
 *
 * It listens to `crosshair:move`, which the engine emits on the cursor tier;
 * the handler writes text only when a value changed, so an idle pointer
 * touches nothing.
 */

interface StatuslineOptions {
    /** BCP 47 tag for number formatting. Default: the runtime's. */
    locale?: string;
}
interface StatuslineHandle {
    readonly el: HTMLElement;
    /** Put a transient message at the right. `error` tints it. */
    setMessage(text: string, kind?: 'info' | 'error'): void;
    /** The title: symbol, optional exchange, and the interval code. */
    setSymbol(symbol: string, exchange: string, interval: string): void;
    /** Show a bar's readings; null clears them (the pointer left and there is no last bar). */
    setBar(bar: Bar | null, time: number | null): void;
    /** Re-read the chart's switches and repaint. */
    refresh(): void;
    destroy(): void;
}
/**
 * Decimals a price is printed with: the price scale's own, so the row agrees
 * with the axis, floored at two so a reading a trader compares against a level
 * survives the comparison (the same floor the engine puts under a study pane).
 */
declare const MIN_PRICE_DIGITS = 2;
declare function priceDigits(chart: Chart): number;
declare function mountStatusline(ctx: WidgetContext, host: HTMLElement, opts?: StatuslineOptions): StatuslineHandle;

/**
 * The widget stylesheet: one `<style>` per document, every rule scoped under
 * `.oac-widget`, every colour a token from `tokens.ts`.
 *
 * Nothing here names a colour twice or reaches outside the widget root. A
 * host page keeps its own cascade, and two widgets on one page share the one
 * sheet while carrying their own token values inline, so one can be dark and
 * the other light.
 *
 * The rules follow the craft standard in CLAUDE.md: styled scrollbars on
 * every scrolling surface, no browser-default checkbox, select or colour
 * input, small square swatches, dense rows, muted uppercase section heads.
 * The dialog modules mount inside `.oac-widget`, so they inherit all of it.
 */
/** Id of the injected `<style>`; one per document. */
declare const WIDGET_STYLE_ID = "oac-widget-css";
declare const WIDGET_CSS: string;
/**
 * Put the stylesheet into `doc` once. Safe to call per widget: the second
 * call leaves a populated sheet untouched. An empty server-rendered sheet
 * is filled in place, preserving its nonce. `extra` is appended to the
 * shell's rules when filling the sheet; the dialog modules hand theirs in
 * here, so the page still carries one sheet. `nonce` authorizes the style
 * element under CSP; the host controls its style-attribute policy separately.
 */
declare function injectWidgetStyles(doc: Document, extra?: string, nonce?: string): HTMLStyleElement;

/**
 * Widget tier (opt-in: "openalgo-charts/widget").
 *
 * The chart with its chrome: a top bar (symbol, intervals, chart type,
 * indicators, capture, settings, theme), the drawing rail, a status line, a
 * keymap and the dialogs, in one call. It is the one tier that ships DOM,
 * because a toolbar is DOM; the engine underneath still ships none.
 *
 * ```ts
 * import { createWidget } from 'openalgo-charts/widget';
 *
 * const widget = createWidget('#chart', {
 *   feed, symbol: 'RELIANCE', exchange: 'NSE', interval: '5m',
 *   theme: 'dark', persist: true,
 * });
 * widget.on('symbol', ({ symbol }) => document.title = symbol);
 * ```
 *
 * Importing this module imports the draw tier, so every built-in drawing tool
 * is registered. The dialog modules register their mount functions through
 * `registerWidgetDialogs`; a shell built without them renders the buttons that
 * would open them disabled, with their state visible.
 */
declare const WIDGET_TIER: "widget";

export { type Box, type BusHandler, CHART_TYPE_LABELS, type ChartShortcutSource, type ContextMenuHooks, type ContextMenuOptions, DEFAULT_INTERVALS, DEFAULT_LOOKBACK_BARS, DIALOG_CSS, type DialogHandle, type DialogMount, type DrawingPropertiesOptions, type FormControl, type FormHandle, type FormKind, type FormOptions, type IndicatorPickerOptions, type IndicatorSettingsOptions, type IndicatorSettingsTab, type KeyAction, type KeyBinding, type KeyBindingOptions, type KeyConflict, type KeyEventLike, type KeyScope, Keymap, type KeymapGroup, type KeymapOptions, type LevelEditorOptions, MAGNET_MODES, MIN_PRICE_DIGITS, type MenuEntry, type MenuItem, type MenuOptions, type MenuRow, type MobileHandle, type MobileMode, type MobileOptions, OBJECTS_PANEL_CSS, type ObjectsPanelOptions, type OrderRequest, type OverlayOptions, type OverlayStack, type PanelHandle, RAIL_GROUPS, RAIL_PREFS_KEY, RAIL_WIDTH, type RailGroup, type RailGroupItem, type RailHandle, type RailOptions, type RailPrefs, type Rgba, SAVE_DEBOUNCE_MS, SEARCH_DEBOUNCE_MS, STATE_KEY, STATUSLINE_HEIGHT, STORAGE_PREFIX, type SettingsDialogOptions, type Size, type StatuslineHandle, type StatuslineOptions, type StorageLike, type SymbolMatch, type SymbolSearch, TIP_DWELL_MS, TOAST_LEAVE_MS, TOAST_MAX, TOAST_MS, TOKEN_PREFIX, TOPBAR_HEIGHT, type TextEditorHandle, type TextEditorOptions, type TipController, type TipSide, type TipSource, type TipSpec, type ToastHandle, type ToastKind, type ToastOptions, type Toaster, type TopbarHandle, type TopbarOptions, type TopbarState, WIDGET_CSS, WIDGET_DIALOGS, WIDGET_FONT, WIDGET_MONO, WIDGET_STATE_VERSION, WIDGET_STYLE_ID, WIDGET_TIER, type Widget, WidgetBus, type WidgetBusEvents, type WidgetChartState, type WidgetContext, type WidgetDialogName, type WidgetEventName, type WidgetOptions, type WidgetRestoreReport, type WidgetState, WidgetStorage, type WidgetThemeName, type WidgetTokens, applyTokens, attachContextMenu, boxIn, captureName, chartTypeChoices, chartTypeLabel, contextMenuEntries, controlsFromFields, controlsFromInputs, createOverlayStack, createTipController, createWidget, defaultStorage, downloadText, esc, eventKeyCombo, focusable, focusables, formatColor, formatKeyCombo, fromChartCombo, glyph, h, inTextField, injectWidgetStyles, intervalLabel, loadWindow, luminance, mix, mountContextMenu, mountDrawingProperties, mountIndicatorPicker, mountIndicatorSettings, mountLevelEditor, mountMobile, mountObjectsPanel, mountRail, mountSettingsDialog, mountStatusline, mountTextEditor, mountToasts, mountTopbar, openMenu, openShortcutsPanel, parseColor, parseKeyCombo, placeBelow, placeBeside, placeTip, priceDigits, registerWidgetDialog, registerWidgetDialogs, registeredWidgetDialogs, renderForm, resolveTheme, sanitizeRailPrefs, stripView, themeMode, token, toolGlyph, toolName, unregisterWidgetDialog, widgetDialog, widgetTokens, withAlpha };
