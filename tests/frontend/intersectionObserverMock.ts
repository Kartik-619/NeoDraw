import { vi } from "vitest";

export class MockIntersectionObserver {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
  takeRecords = vi.fn(() => []);

  private static instances: MockIntersectionObserver[] = [];
  static allInstances(): MockIntersectionObserver[] {
    return MockIntersectionObserver.instances;
  }
  static clear(): void {
    MockIntersectionObserver.instances = [];
  }

  constructor(public callback: IntersectionObserverCallback, _options?: IntersectionObserverInit) {
    MockIntersectionObserver.instances.push(this);
  }

  fire(entries: Partial<IntersectionObserverEntry>[]): void {
    this.callback(entries as IntersectionObserverEntry[], this as unknown as IntersectionObserver);
  }
}