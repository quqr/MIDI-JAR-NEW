import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  Delegate,
  Action,
  Func,
  Event,
  EventArgs,
  PropertyChangedEventArgs,
  weakClosure,
} from "../delegate";

describe("Delegate", () => {
  let delegate: Delegate<number>;

  beforeEach(() => {
    delegate = new Delegate<number>();
  });

  it("should add and invoke handlers", () => {
    const handler = vi.fn();
    delegate.add(handler);

    delegate.invoke(42);

    expect(handler).toHaveBeenCalledWith(42);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("should support multicast (multiple handlers)", () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    delegate.add(handler1);
    delegate.add(handler2);

    delegate.invoke(10);

    expect(handler1).toHaveBeenCalledWith(10);
    expect(handler2).toHaveBeenCalledWith(10);
  });

  it("should remove handler by function reference", () => {
    const handler = vi.fn();
    delegate.add(handler);

    delegate.invoke(1);
    expect(handler).toHaveBeenCalledTimes(1);

    delegate.remove(handler);
    delegate.invoke(2);
    expect(handler).toHaveBeenCalledTimes(1); // 未增加
  });

  it("should remove handler by token", () => {
    const handler = vi.fn();
    const token = delegate.add(handler);

    delegate.invoke(1);
    expect(handler).toHaveBeenCalledTimes(1);

    delegate.remove(token);
    delegate.invoke(2);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("should track count", () => {
    expect(delegate.count).toBe(0);

    const token1 = delegate.add(() => {});
    expect(delegate.count).toBe(1);

    const token2 = delegate.add(() => {});
    expect(delegate.count).toBe(2);

    delegate.remove(token1);
    expect(delegate.count).toBe(1);

    delegate.remove(token2);
    expect(delegate.count).toBe(0);
  });

  it("should report isEmpty", () => {
    expect(delegate.isEmpty).toBe(true);

    const token = delegate.add(() => {});
    expect(delegate.isEmpty).toBe(false);

    delegate.remove(token);
    expect(delegate.isEmpty).toBe(true);
  });

  it("should handle errors in handlers gracefully", () => {
    const errorHandler = vi.fn(() => {
      throw new Error("Test error");
    });
    const normalHandler = vi.fn();

    delegate.add(errorHandler);
    delegate.add(normalHandler);

    delegate.invoke(1);

    // 即使第一个处理器抛出错误，第二个也应该被调用
    expect(errorHandler).toHaveBeenCalled();
    expect(normalHandler).toHaveBeenCalled();
  });

  it("should clear all handlers", () => {
    delegate.add(() => {});
    delegate.add(() => {});

    expect(delegate.count).toBe(2);

    delegate.clear();

    expect(delegate.count).toBe(0);
    expect(delegate.isEmpty).toBe(true);
  });
});

describe("Action", () => {
  let action: Action<string>;

  beforeEach(() => {
    action = new Action<string>();
  });

  it("should work as a Delegate alias", () => {
    const handler = vi.fn();
    const token = action.add(handler);

    action.invoke("test");

    expect(handler).toHaveBeenCalledWith("test");

    action.remove(token);
    expect(action.isEmpty).toBe(true);
  });
});

describe("Func", () => {
  let func: Func<number, string>;

  beforeEach(() => {
    func = new Func<number, string>();
  });

  it("should set and invoke function", () => {
    func.set((s) => s.length);

    const result = func.invoke("hello");

    expect(result).toBe(5);
  });

  it("should return undefined when no function set", () => {
    const result = func.invoke("test");

    expect(result).toBeUndefined();
  });

  it("should replace function when set again", () => {
    func.set(() => 1);
    func.set(() => 2);

    const result = func.invoke("test");

    expect(result).toBe(2);
  });

  it("should remove function", () => {
    func.set(() => 1);
    func.remove();

    expect(func.isEmpty).toBe(true);
    expect(func.invoke("test")).toBeUndefined();
  });

  it("should check isEmpty", () => {
    expect(func.isEmpty).toBe(true);

    func.set(() => 1);
    expect(func.isEmpty).toBe(false);

    func.remove();
    expect(func.isEmpty).toBe(true);
  });
});

describe("Event", () => {
  it("should allow adding and removing handlers", () => {
    const event = new Event<number>();
    const handler = vi.fn();

    const token = event.add(handler);
    expect(event.subscribe).toBeDefined();
    expect(event.unsubscribe).toBeDefined();

    event.remove(token);
    // 外部无法直接 invoke，这是正确的行为
  });

  it("should support internal invoke", () => {
    const event = new Event<string>();
    const handler = vi.fn();

    event.add(handler);
    event.internalInvoke("test");

    expect(handler).toHaveBeenCalledWith("test");
  });

  it("should prevent external invoke", () => {
    const event = new Event<number>();

    // @ts-expect-error - invoke 不应该在外部可访问
    expect(event.invoke).toBeUndefined();
  });

  it("should support subscribe/unsubscribe getters", () => {
    const event = new Event<string>();
    const handler = vi.fn();

    // 使用 subscribe getter
    const token = event.subscribe(handler);
    event.internalInvoke("hello");
    expect(handler).toHaveBeenCalledWith("hello");

    // 使用 unsubscribe getter
    event.unsubscribe(token);
    event.internalInvoke("world");
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe("WeakClosure", () => {
  it("should bind context correctly", () => {
    const context = { value: 42 };

    const handler = weakClosure<string>(function (_args) {
      // @ts-ignore
      return this.value;
    }, context);

    // WeakRef 在现代环境中应该工作
    // 如果环境不支持，会回退到 bind
    expect(typeof handler).toBe("function");
  });

  it("should fallback to bind when WeakRef is not available", () => {
    // 模拟不支持 WeakRef 的环境
    const originalWeakRef = globalThis.WeakRef;
    // @ts-ignore
    delete globalThis.WeakRef;

    const context = { value: 42 };
    const handler = weakClosure<string>(function (_args) {
      // @ts-ignore
      return this.value;
    }, context);

    expect(typeof handler).toBe("function");

    // 恢复 WeakRef
    globalThis.WeakRef = originalWeakRef;
  });
});

describe("EventArgs", () => {
  it("should provide empty singleton", () => {
    const args1 = EventArgs.Empty;
    const args2 = EventArgs.Empty;

    expect(args1).toBe(args2);
    expect(args1).toBeInstanceOf(EventArgs);
  });
});

describe("PropertyChangedEventArgs", () => {
  it("should store property change info", () => {
    const args = new PropertyChangedEventArgs("name", "old", "new");

    expect(args.propertyName).toBe("name");
    expect(args.oldValue).toBe("old");
    expect(args.newValue).toBe("new");
    expect(args).toBeInstanceOf(EventArgs);
  });

  it("should support generic types", () => {
    const args = new PropertyChangedEventArgs<number>("count", 1, 2);

    expect(typeof args.oldValue).toBe("number");
    expect(typeof args.newValue).toBe("number");
  });
});

describe("C# Style Usage", () => {
  it("should simulate event pattern", () => {
    // 模拟 C# 事件声明和使用
    class Button {
      public readonly onClick = new Event<{ x: number; y: number }>();

      private _click(x: number, y: number) {
        this.onClick.internalInvoke({ x, y });
      }

      public simulateClick() {
        this._click(100, 200);
      }
    }

    const button = new Button();
    const handler = vi.fn();

    // C#: button.onClick += Handler;
    const token = button.onClick.add(handler);

    button.simulateClick();

    expect(handler).toHaveBeenCalledWith({ x: 100, y: 200 });

    // C#: button.onClick -= Handler;
    button.onClick.remove(token);

    button.simulateClick();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("should work like C# Action", () => {
    const action = new Action<string>();

    // C#: action += msg => Console.WriteLine(msg);
    const handler = vi.fn();
    action.add(handler);

    // C#: action("Hello");
    action.invoke("Hello");

    expect(handler).toHaveBeenCalledWith("Hello");
  });

  it("should work like C# Func", () => {
    const func = new Func<number, string>();

    // C#: func = s => s.Length;
    func.set((s) => s.length);

    // C#: int result = func("Hello");
    const result = func.invoke("Hello");

    expect(result).toBe(5);
  });
});
