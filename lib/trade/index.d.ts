import { IPrimitive, PrimitiveHost, ZOrder, PrimitiveRenderContext, PrimitiveHit } from 'openalgo-charts';

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
/** A working order is one still live in the book (not terminal). */
declare function isWorking(o: Order): boolean;

/**
 * P&L and risk math (ARCHITECTURE.md §9.1). Pure functions — the hot path on
 * every LTP tick, and the part most worth unit-testing.
 */

/** Unrealized P&L for a position at the given last price. */
declare function unrealizedPnl(position: Position, ltp: number): number;
/** Unrealized P&L as a percentage of the entry notional. */
declare function unrealizedPnlPercent(position: Position, ltp: number): number;
/** Breakeven price (entry ± per-unit charges; charges default 0). */
declare function breakeven(position: Position, chargesPerUnit?: number): number;
/** Risk:reward for a bracket relative to entry. Returns null if risk is zero. */
declare function riskReward(entry: number, stop: number, target: number): number | null;
/** True if a stop/target is correctly placed for the side (long: SL<entry<TP). */
declare function bracketValid(side: 'BUY' | 'SELL', entry: number, stop: number, target: number): boolean;

/**
 * Working-order line (ARCHITECTURE.md §9.1). A horizontal dashed line at the
 * order price, colored by side, with a broker-style segmented pill group on the
 * line — [SIDE][qty][TYPE price ±LTP-distance][✕] — and a compact price tag on
 * the axis. Pending (un-acked) orders draw dimmed; partial fills show progress
 * (3/10). Hover thickens the line (hit-test `order:<id>`, ns-resize cursor for
 * drag-to-modify; the ✕ hit-tests as `order:<id>::close`).
 */

declare class WorkingOrderLine implements IPrimitive {
    private _order;
    private _ltp;
    private _host;
    private _group;
    private readonly _extent;
    /** Pre-drag price, self-captured on the first dragged frame (drag ghost). */
    private _ghost;
    constructor(order: Order, options?: {
        extentFromRight?: number;
    });
    attached(host: PrimitiveHost): void;
    detached(): void;
    zOrder(): ZOrder;
    get order(): Order;
    update(order: Order): void;
    setLtp(ltp: number): void;
    autoscaleInfo(): {
        min: number;
        max: number;
    };
    private _price;
    draw(ctx: CanvasRenderingContext2D, rc: PrimitiveRenderContext): void;
    hitTest(x: number, y: number, rc: PrimitiveRenderContext): PrimitiveHit | null;
}

/**
 * Position marker (ARCHITECTURE.md §9.1). A line at the average entry price
 * with a broker-style segmented pill group — [LONG|SHORT][qty][P&L (pct)][✕] —
 * a compact avg-price tag on the axis, and a shaded entry→LTP band colored by
 * P&L sign. Updates cheaply on every LTP tick. The ✕ hit-tests as
 * `position:<symbol>::close` (wire it to your square-off flow).
 */

declare class PositionMarker implements IPrimitive {
    private _position;
    private _ltp;
    private _host;
    private _group;
    private readonly _extent;
    constructor(position: Position, options?: {
        extentFromRight?: number;
    });
    attached(host: PrimitiveHost): void;
    detached(): void;
    zOrder(): ZOrder;
    get position(): Position;
    update(position: Position): void;
    setLtp(ltp: number): void;
    autoscaleInfo(): {
        min: number;
        max: number;
    };
    draw(ctx: CanvasRenderingContext2D, rc: PrimitiveRenderContext): void;
    hitTest(x: number, y: number, rc: PrimitiveRenderContext): PrimitiveHit | null;
}

/**
 * Bracket group (ARCHITECTURE.md §9.1). SL + Target lines tied to a position,
 * with theme-derived shaded risk/reward zones, rounded "SL/TP @ price" chips at
 * the left edge, and an R:R chip near entry — the core advanced-trade-management
 * visualisation. The SL/TP lines thicken on hover and are draggable (OCO modify).
 */

interface BracketState {
    symbol: string;
    side: OrderSide;
    entry: number;
    stop: number;
    target: number;
}
declare class BracketGroup implements IPrimitive {
    private _state;
    private _host;
    constructor(state: BracketState);
    attached(host: PrimitiveHost): void;
    detached(): void;
    zOrder(): ZOrder;
    get state(): BracketState;
    update(state: BracketState): void;
    autoscaleInfo(): {
        min: number;
        max: number;
    };
    draw(ctx: CanvasRenderingContext2D, rc: PrimitiveRenderContext): void;
    hitTest(x: number, y: number, rc: PrimitiveRenderContext): PrimitiveHit | null;
}

/**
 * Trade controller (ARCHITECTURE.md §9.3) — read-only in Phase 8. The single
 * source of truth: it reconciles order/position book snapshots into on-chart
 * primitives (add/update/remove) and pushes LTP into them for live P&L. On a
 * reconnect, a fresh snapshot is diffed against current primitives, so vanished
 * orders are removed (STALE handling) with no special code path.
 */

/** Where the controller attaches/detaches its primitives (the chart implements this). */
interface TradeHost {
    addPrimitive(p: IPrimitive): void;
    removePrimitive(p: IPrimitive): void;
}
declare class TradeController {
    private readonly _host;
    private readonly _orderLines;
    private readonly _markers;
    private readonly _brackets;
    private readonly _ltp;
    constructor(host: TradeHost);
    /** Reconcile a full book snapshot. Idempotent — safe to call on every update or reconnect. */
    reconcile(orders: readonly Order[], positions: readonly Position[]): void;
    private _reconcileOrderLines;
    private _reconcilePositions;
    /**
     * Decide which brackets to draw, without touching the host. `covered` names the
     * exact orders those brackets account for; every other working order still
     * needs a line of its own.
     */
    private _planBrackets;
    private _applyBrackets;
    /** Push a last price; updates the live P&L / distance on bound primitives. */
    onLtp(symbol: string, ltp: number): void;
    /** Test/introspection helpers. */
    orderLineCount(): number;
    positionCount(): number;
    bracketCount(): number;
}

/**
 * Internal time is always **UTC seconds** (integer). Feed adapters convert
 * broker formats (IST strings, epoch ms) to this at the edge; see ARCHITECTURE.md §4.0.
 */
type UTCSeconds = number;

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

/**
 * Order state machine (ARCHITECTURE.md §9.5). Explicit client-side states with
 * a guarded transition table — no optimistic guesswork. Pure and fully testable.
 *
 *   pending_place ─ack→ working ─fill→ filled
 *                 ─reject→ rejected
 *   working/partial ─reject→ rejected     (the broker refusing one it accepted)
 *   working/partial ─submitModify→ modify_pending ─ack→ working / ─reject→ working
 *   working/partial ─submitCancel→ cancel_pending ─cancelled→ cancelled / ─reject→ working
 *   any non-terminal ─reconnectAbsent→ stale
 */
type ClientOrderState = 'pending_place' | 'working' | 'partial' | 'filled' | 'modify_pending' | 'cancel_pending' | 'rejected' | 'cancelled' | 'stale';
type OrderEvent = 'ack' | 'partialFill' | 'fill' | 'reject' | 'submitModify' | 'submitCancel' | 'cancelled' | 'reconnectAbsent';
declare function isTerminal(state: ClientOrderState): boolean;
/** Whether `event` is allowed from `state`. */
declare function canTransition(state: ClientOrderState, event: OrderEvent): boolean;
/** Apply `event`; returns the next state, or the same state if the event is invalid. */
declare function transition(state: ClientOrderState, event: OrderEvent): ClientOrderState;

interface PriceBand {
    lower: number;
    upper: number;
}
/**
 * Machine-readable rejection code. Four of these are spelled exactly as the v2
 * broker contract's `RejectCode` members so the eventual mapping is identity;
 * `QTY_INVALID` and `PRICE_INVALID` are local until v2's `reject.ts` lands, at
 * which point they fold into `CONTRACT_VIOLATION`. Every member is emitted by a
 * branch below: a code nothing can produce would be a label with nothing behind it.
 */
type ValidationCode = 'QTY_INVALID' | 'QTY_STEP' | 'QTY_FREEZE_LIMIT' | 'PRICE_INVALID' | 'PRICE_OUT_OF_BAND';
interface ValidationResult {
    ok: boolean;
    reason?: string;
    /** Machine-readable form of `reason`; present on every rejection. */
    code?: ValidationCode;
    /** Price after tick-size snapping (when applicable). */
    price?: number;
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
/** True if `price` lies within the inclusive band. */
declare function withinPriceBand(price: number, band: PriceBand): boolean;
/**
 * Validate a quantity on its own. Split out from `validateOrder` because a
 * market order has no price, and the freeze and lot limits must still apply to
 * it: routing quantity checks through the price path left them unreachable for
 * exactly the orders that are hardest to take back.
 */
declare function validateQuantity(qty: number, c: OrderConstraints): ValidationResult;
/**
 * Validate a price on its own, returning the tick-snapped value. Snapping is
 * unchanged; the only addition is rejecting a non-finite price, which otherwise
 * snaps to NaN and then passes an absent band as if it were a real level.
 */
declare function validatePrice(price: number, c: OrderConstraints): ValidationResult;
/**
 * Validate a price + qty against constraints. Snaps price to the tick size and
 * returns the snapped value; rejects out-of-band prices and bad quantities.
 *
 * `price` may be omitted for an order that has none (market), in which case only
 * the quantity is checked and no `price` comes back. Quantity is checked first,
 * so a request wrong in both ways reports the quantity, as it always has.
 */
declare function validateOrder(price: number | undefined, qty: number, c: OrderConstraints): ValidationResult;

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
type GateFn = (req: PlaceRequest) => boolean | Promise<boolean>;
/**
 * Client-owned lifecycle of an intent, kept apart from the broker's own view.
 *
 *   BLOCKED            never sent: validation failed, the gate declined, or the
 *                      feed proved the request never left
 *   SUBMITTING         in flight
 *   SUBMITTED          transport returned success. NOT an order yet.
 *   AMBIGUOUS          transport failed, or a fresh book does not mention it.
 *                      May or may not be live at the exchange. Absorbing until
 *                      the broker speaks.
 *   ACKNOWLEDGED       the broker has accounted for it
 *   MODIFY_SUBMITTING  a modify is in flight
 *   CANCEL_SUBMITTING  a cancel is in flight
 *   RECONCILING        our picture may be behind; a snapshot is being fetched
 *   SETTLED            the broker reported a final state
 */
type IntentState = 'BLOCKED' | 'SUBMITTING' | 'SUBMITTED' | 'AMBIGUOUS' | 'ACKNOWLEDGED' | 'MODIFY_SUBMITTING' | 'CANCEL_SUBMITTING' | 'RECONCILING' | 'SETTLED';
/**
 * What a feed throws when the request PROVABLY never left: it failed before the
 * socket was written (bad arguments, no context cached, offline, DNS). Only this
 * marker releases an idempotency token, because only this proves there is
 * nothing live to double up on. See the catch in `placeOrder`.
 */
interface PreflightFailure {
    readonly preflight: true;
}
/** True when a thrown value declares itself a pre-flight failure. */
declare function isPreflightFailure(err: unknown): boolean;
/** Extra fields for the one-click market order, which a chart button cannot otherwise set. */
interface MarketOrderOptions {
    exchange?: string;
    product?: 'CNC' | 'NRML' | 'MIS';
    /** Idempotency token, so a double-clicked button places one order, not two. */
    clientToken?: string;
}
interface ModifyOptions {
    /**
     * Explicit stop trigger. Omitted, the trigger follows the order type: SL-M
     * treats the dragged level as the trigger, SL carries its trigger at the
     * offset the order was placed with, and the rest have none.
     */
    triggerPrice?: number;
}
interface OrderEngineOptions {
    feed: OrderFeed;
    constraints: OrderConstraints;
    mode?: TradeMode;
    /** Armed = fire immediately; otherwise the gate must approve each order. */
    armed?: boolean;
    gate?: GateFn;
    minModifyIntervalMs?: number;
    now?: () => number;
    idGen?: () => string;
    /** Called when a drag-modify price fails validation (so the UI can snap back). */
    onValidationError?: (reason: string) => void;
    /**
     * How many settled orders stay readable before the oldest are dropped. A
     * trading session is a long-lived page and the per-order maps used to grow
     * for its whole life. 0 drops each order the moment it settles.
     */
    maxSettledOrders?: number;
}
interface PlaceResult {
    ok: boolean;
    clientId?: string;
    state?: ClientOrderState;
    /** Client-owned intent. `ok: true` means SUBMITTED, never acknowledged. */
    intent?: IntentState;
    reason?: string;
}
declare class OrderEngine {
    private readonly _feed;
    private readonly _constraints;
    private readonly _mode;
    private readonly _armed;
    private readonly _gate?;
    private readonly _minModifyMs;
    private readonly _now;
    private readonly _idGen;
    private readonly _onValidationError?;
    private readonly _maxSettled;
    private readonly _orders;
    private readonly _byBroker;
    private readonly _sentTokens;
    private readonly _lastModifyAt;
    private readonly _pendingModify;
    /** Settled client ids, oldest first: the eviction order for the maps above. */
    private readonly _settledIds;
    private _counter;
    constructor(opts: OrderEngineOptions);
    get mode(): TradeMode;
    state(clientId: string): ClientOrderState | undefined;
    /** Client-owned intent: what we did, as opposed to what the broker confirmed. */
    intentState(clientId: string): IntentState | undefined;
    /**
     * The broker's own last word. Undefined means the broker has said nothing
     * about this order yet, however far `state` has advanced on transport results.
     */
    brokerStatus(clientId: string): OrderStatus | undefined;
    placeOrder(req: PlaceRequest): Promise<PlaceResult>;
    /** One-click market order. Omitting `opts` is exactly the previous behaviour. */
    placeMarket(symbol: string, side: OrderSide, qty: number, opts?: MarketOrderOptions): Promise<PlaceResult>;
    /** Link two orders as OCO: when one fills/cancels, the other is cancelled. */
    linkOco(clientIdA: string, clientIdB: string): void;
    /**
     * Rate-limited modify (drag): coalesces to the latest, sends at most every
     * minModifyMs. An invalid price (tick/band/freeze) is NOT enqueued or sent:
     * it surfaces via `onValidationError` so the UI can snap the line back.
     */
    requestModify(clientId: string, price: number, opts?: ModifyOptions): void;
    /** Force-send any pending modify (e.g. on drag end). */
    commitModify(clientId: string): Promise<void>;
    /**
     * Turn a dragged level into a patch the broker can apply without losing a
     * field it already holds.
     */
    private _buildModifyPatch;
    private _validateTrigger;
    private _flushModify;
    cancelOrder(clientId: string): Promise<void>;
    /** Broker fill event (by broker id). Advances state and triggers OCO. */
    onFill(brokerId: string, full: boolean): void;
    /**
     * Authoritative state from the broker: an order-stream push or a poll of the
     * book. This is the ONLY input that writes `brokerStatus`; place, modify and
     * cancel resolving never do.
     */
    onBrokerUpdate(brokerId: string, status: OrderStatus): void;
    private _cancelOcoPeer;
    /**
     * Enter reconciliation: the connection dropped or a gap was seen, so our
     * picture may be behind. Nothing is concluded here; call `onReconnect` with
     * the fresh book to conclude anything. An AMBIGUOUS row is left alone, since
     * only the broker can take it out of that state.
     */
    beginReconcile(): void;
    /**
     * Apply a fresh order-book snapshot. Absence is not death: `state` still goes
     * to `stale` for existing consumers, but the intent becomes AMBIGUOUS, because
     * an order missing from one snapshot means our picture is incomplete, not that
     * the broker cancelled it. Such a row is never pruned. (v2 drops `stale`
     * entirely; that removal has to wait for the contract bump.)
     */
    onReconnect(presentBrokerIds: ReadonlySet<string>): void;
    /**
     * Terminal bookkeeping. Per-order scratch (throttle stamps, coalesced patches)
     * goes at once; the row itself survives so a host can still read the final
     * state, and only the oldest are evicted once `maxSettledOrders` is passed.
     *
     * Idempotency tokens are never pruned. They are the record of what this client
     * has put on the wire, and dropping one so a map stays small is the same
     * mistake as releasing it on a transport error.
     */
    private _settle;
}

/**
 * Deterministic in-memory broker simulator (ARCHITECTURE.md §11.1). Holds order
 * and position snapshots and notifies subscribers — lets the trade layer be
 * tested and demoed with zero network. Phase 9 extends it with the place/modify/
 * cancel state machine; Phase 8 uses it read-only (seed snapshots + emit LTP).
 */

declare class FakeBroker implements OrderFeed {
    private _orders;
    private _positions;
    private readonly _bookListeners;
    private readonly _ltpListeners;
    private readonly _depthListeners;
    private _idCounter;
    /** Set to a reason to make the next place() reject (test hook). */
    rejectNextPlace: string | null;
    onBook(cb: (orders: Order[], positions: Position[]) => void): void;
    onLtp(cb: (symbol: string, ltp: number) => void): void;
    /** Replace the current book snapshot and notify (simulates a poll / WS update / reconnect). */
    setBook(orders: Order[], positions: Position[]): void;
    emitLtp(symbol: string, ltp: number): void;
    onDepth(cb: (symbol: string, depth: MarketDepth) => void): void;
    emitDepth(symbol: string, depth: MarketDepth): void;
    /** Build a deterministic N-level synthetic book around `ltp` (demo/test helper). */
    static makeDepth(ltp: number, levels: number, tickSize?: number): MarketDepth;
    orders(): readonly Order[];
    positions(): readonly Position[];
    place(req: PlaceRequest & {
        mode: TradeMode;
    }): Promise<{
        orderId: string;
    }>;
    modify(orderId: string, patch: {
        price?: number;
        triggerPrice?: number;
        qty?: number;
    }): Promise<void>;
    cancel(orderId: string): Promise<void>;
    /** Simulate a fill for an order (test hook). */
    fill(orderId: string): void;
    private _notify;
}

/**
 * Depth-of-market ladder (ARCHITECTURE.md §9.4). Docked to the right of the
 * plot, price-aligned to the price scale. Depth-agnostic: it reads the level
 * count from the payload (5 / 20 / 30 / 50 / 200) at runtime. Viewport
 * virtualization keeps a deep book at 60 fps; price-bucket aggregation compacts
 * deep books; a size heatmap highlights resting liquidity; and it degrades
 * gracefully to nothing when no depth is available.
 *
 * Pure helpers (capability / aggregation / virtualization) are split out for
 * unit testing; the primitive draws on the top (overlay) canvas so frequent
 * depth updates only repaint the cheap overlay.
 */

type LadderTier = 'none' | 'compact' | 'deep';
/** Capability tier from the live payload — drives graceful degradation. */
declare function ladderCapability(depth: MarketDepth): LadderTier;
interface LadderRow {
    price: number;
    bidQty: number;
    askQty: number;
}
/**
 * Merge bids + asks into price rows, optionally bucketing every `groupBy` ticks
 * (price-step aggregation for deep books). Returns rows sorted high → low price.
 */
declare function buildRows(depth: MarketDepth, tickSize: number, groupBy?: number): LadderRow[];
/**
 * Virtualize: keep only rows whose y is inside the plot (± one row) and cap the
 * count to `maxRows` nearest the vertical centre (around the LTP). This is what
 * keeps a 200-level book cheap and readable.
 */
declare function visibleRows(rows: readonly LadderRow[], priceToY: (p: number) => number, plotHeight: number, rowHeight: number, maxRows: number): LadderRow[];
interface DomLadderOptions {
    tickSize: number;
    /** Strip width in media px. */
    width: number;
    /** Group every N ticks into one row (deep-book aggregation). */
    groupBy: number;
    /** Max rows drawn per frame (virtualization cap). */
    maxRows: number;
    rowHeight: number;
}
declare const DEFAULT_DOM_LADDER_OPTIONS: DomLadderOptions;
declare class DomLadder implements IPrimitive {
    private _opts;
    private _depth;
    private _host;
    private _rowHits;
    constructor(options?: Partial<DomLadderOptions>);
    attached(host: PrimitiveHost): void;
    detached(): void;
    zOrder(): ZOrder;
    setDepth(depth: MarketDepth): void;
    tier(): LadderTier;
    draw(ctx: CanvasRenderingContext2D, rc: PrimitiveRenderContext): void;
    hitTest(x: number, y: number, rc: PrimitiveRenderContext): PrimitiveHit | null;
}

declare const TRADE_TIER: "trade";

export { BracketGroup, type BracketState, type ClientOrderState, DEFAULT_DOM_LADDER_OPTIONS, DomLadder, type DomLadderOptions, FakeBroker, type GateFn, type IntentState, type LadderRow, type LadderTier, type MarketOrderOptions, type ModifyOptions, type ModifyPatch, type Order, type OrderConstraints, OrderEngine, type OrderEngineOptions, type OrderEvent, type OrderFeed, type OrderRole, type OrderSide, type OrderStatus, type OrderType, type PlaceRequest, type PlaceResult, type Position, PositionMarker, type PreflightFailure, type PriceBand, TRADE_TIER, TradeController, type TradeHost, type TradeMode, type ValidationCode, type ValidationResult, WorkingOrderLine, bracketValid, breakeven, buildRows, canTransition, isPreflightFailure, isTerminal, isWorking, ladderCapability, riskReward, transition, unrealizedPnl, unrealizedPnlPercent, validateOrder, validatePrice, validateQuantity, visibleRows, withinPriceBand };
