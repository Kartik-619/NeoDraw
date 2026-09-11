import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";
import { MockIntersectionObserver } from "./intersectionObserverMock";

export const navigationMocks = {
  push: vi.fn(),
  pathname: { current: "/" },
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigationMocks.push }),
  usePathname: () => navigationMocks.pathname.current,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={typeof href === "string" ? href : "#"} {...rest}>
      {children}
    </a>
  ),
}));

Object.defineProperty(window, "localStorage", {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
  writable: true,
});

Object.defineProperty(window, "IntersectionObserver", {
  value: MockIntersectionObserver,
  writable: true,
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

export const clipboardMocks = {
  writeText: vi.fn().mockResolvedValue(undefined),
  readText: vi.fn().mockResolvedValue(""),
};

Object.defineProperty(navigator, "clipboard", {
  value: clipboardMocks,
  configurable: true,
});

export * from "./intersectionObserverMock";