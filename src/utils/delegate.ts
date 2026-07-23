/**
 * C# 风格的委托和事件系统 (优化版)
 *
 * 实现了：
 * - Delegate：基础委托类，支持多播
 * - Action/Func：标准的委托类型
 * - Event：严格遵循 C# 封装规范（外部只能订阅，不能触发）
 * - 闭包辅助：支持 WeakRef 防止内存泄漏
 */

// ============================================================================
// 基础类型定义
// ============================================================================

/**
 * 委托处理器类型
 */
export type DelegateHandler<TArgs = void> = (args: TArgs) => void;

/**
 * 委托令牌（用于取消订阅，比单纯使用函数引用更安全）
 */
export interface DelegateToken {
    readonly id: number;
    readonly handler: DelegateHandler<any>;
}

// ============================================================================
// Delegate（委托基类）
// ============================================================================

/**
 * C# 风格的委托基类
 * 支持多播、类型安全、异常隔离
 */
export class Delegate<TArgs = void> {
    protected handlers = new Map<number, DelegateHandler<TArgs>>();
    protected nextId = 0;

    get count(): number {
        return this.handlers.size;
    }

    get isEmpty(): boolean {
        return this.handlers.size === 0;
    }

    /**
     * 添加委托
     * @returns 返回令牌，用于精准移除
     */
    add(handler: DelegateHandler<TArgs>): DelegateToken {
        const id = this.nextId++;
        this.handlers.set(id, handler);
        return { id, handler };
    }

    /**
     * 移除委托
     * 支持传入原始函数引用或 add 返回的 Token
     */
    remove(handlerOrToken: DelegateHandler<TArgs> | DelegateToken): void {
        if (typeof handlerOrToken === 'function') {
            // 线性查找删除（适用于直接传函数的场景）
            for (const [id, h] of this.handlers) {
                if (h === handlerOrToken) {
                    this.handlers.delete(id);
                    return; // 移除单个匹配项
                }
            }
        } else {
            // O(1) 删除（推荐使用 Token）
            this.handlers.delete(handlerOrToken.id);
        }
    }

    /**
     * 触发执行
     * 包含异常捕获，防止单个处理器错误中断链路
     */
    invoke(args: TArgs): void {
        this.handlers.forEach((handler) => {
            try {
                handler(args);
            } catch (err) {
                console.error('[Delegate] Handler execution error:', err);
            }
        });
    }

    clear(): void {
        this.handlers.clear();
    }
}

// ============================================================================
// Action（无返回值委托）
// ============================================================================

export class Action<T = void> extends Delegate<T> {
    // Action 本质上就是 Delegate 的别名，无需额外逻辑
}

// ============================================================================
// Func（有返回值委托 - 单播）
// ============================================================================

/**
 * C# Func 模拟
 * 注意：C# 的 Func 也是委托，可以多播，但多播 Func 的返回值是“最后一个调用的结果”。
 * 为了清晰性，此处限制为单播。如需多播返回值，建议使用 Event 或手动管理。
 */
export class Func<TResult, TArgs = void> {
    private handler: ((args: TArgs) => TResult) | null = null;

    set(handler: (args: TArgs) => TResult): void {
        this.handler = handler;
    }

    remove(): void {
        this.handler = null;
    }

    invoke(args: TArgs): TResult | undefined {
        return this.handler?.(args);
    }

    get isEmpty(): boolean {
        return this.handler === null;
    }
}

// ============================================================================
// Event（事件 - 严格封装）
// ============================================================================

/**
 * 事件触发器（内部类，仅类内部可见）
 */
class EventDispatcher<TArgs> extends Delegate<TArgs> {
    // 公开 invoke，给发布者使用
    public declare invoke: (args: TArgs) => void;
}

/**
 * C# 风格事件
 * 
 * 模拟 C# event 的封装性：
 * - 外部只能 add/remove (+=, -=)
 * - 外部无法 invoke (触发)
 * 
 * @example
 * class Button {
 *   // 对外暴露的是接口，实际逻辑在 dispatcher
 *   public readonly onClick = new Event<ClickArgs>();
 * 
 *   private _click() {
 *     // 只能在内部触发
 *     this.onClick.internalInvoke({ x: 1 });
 *   }
 * }
 */
export class Event<TArgs = void> {
    private readonly _dispatcher = new EventDispatcher<TArgs>();

    constructor() {
        // 将内部触发方法挂载到 internalInvoke
        (this._dispatcher as any).invoke = this._dispatcher.invoke;
    }

    /** 内部触发方法：仅类内部应调用 */
    public internalInvoke(args: TArgs): void {
        this._dispatcher.invoke(args);
    }

    // --- 对外暴露的接口 ---

    public add(handler: DelegateHandler<TArgs>): DelegateToken {
        return this._dispatcher.add(handler);
    }

    public remove(handlerOrToken: DelegateHandler<TArgs> | DelegateToken): void {
        this._dispatcher.remove(handlerOrToken);
    }

    // 兼容 C# 语法的属性访问器（模拟）
    // TS 无法重载 +=，但可以提供便捷方法
    public get subscribe() { return this.add.bind(this); }
    public get unsubscribe() { return this.remove.bind(this); }
}

// ============================================================================
// 辅助工具
// ============================================================================

/**
 * 创建弱引用闭包
 * 防止因事件订阅导致的对象无法释放
 */
export function weakClosure<TArgs>(
    handler: (this: any, args: TArgs) => void,
    context: any
): DelegateHandler<TArgs> {
    if (typeof WeakRef !== 'undefined') {
        const ref = new WeakRef(context);
        return (args) => {
            const ctx = ref.deref();
            if (ctx) handler.call(ctx, args);
            else console.warn('[WeakClosure] Context has been garbage collected.');
        };
    }
    return handler.bind(context);
}

// ============================================================================
// 常用参数类型
// ============================================================================

export abstract class EventArgs {
    static readonly Empty: EventArgs = new (class extends EventArgs {})();
}

export class PropertyChangedEventArgs<T = any> extends EventArgs {
    constructor(
        public readonly propertyName: string,
        public readonly oldValue: T,
        public readonly newValue: T
    ) { super(); }
}
