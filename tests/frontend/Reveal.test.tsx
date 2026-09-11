import { afterEach, beforeEach, describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MockIntersectionObserver } from "./intersectionObserverMock";
import { Reveal } from "@/components/Reveal";

describe("Reveal", () => {
  beforeEach(() => {
    MockIntersectionObserver.clear();
  });

  afterEach(() => {
    MockIntersectionObserver.clear();
  });

  it("renders children inside the reveal wrapper", () => {
    render(
      <Reveal>
        <p>Content</p>
      </Reveal>,
    );
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("observes the wrapper element on mount", () => {
    render(
      <Reveal>
        <p>Hi</p>
      </Reveal>,
    );
    const instances = MockIntersectionObserver.allInstances();
    expect(instances.length).toBeGreaterThan(0);
    expect(instances[0]!.observe).toHaveBeenCalled();
  });

  it("adds the 'in' class to the wrapper when it becomes visible", () => {
    const { container } = render(
      <Reveal className="extra">
        <p>Hi</p>
      </Reveal>,
    );
    const el = container.querySelector("div");
    expect(el!.className).toBe("calm-reveal extra");

    const instances = MockIntersectionObserver.allInstances();
    instances[0]!.fire([{ isIntersecting: true }]);

    expect(el!.className).toContain("in");
  });

  it("adds the 'in' class at most once", () => {
    const { container } = render(
      <Reveal>
        <p>Hi</p>
      </Reveal>,
    );
    const el = container.querySelector("div");
    const instances = MockIntersectionObserver.allInstances();

    instances[0]!.fire([{ isIntersecting: true }]);
    instances[0]!.fire([{ isIntersecting: true }]);

    expect(el!.className.split(" ").filter((c) => c === "in")).toHaveLength(1);
  });

  it("disconnects the observer on unmount", () => {
    const { unmount } = render(
      <Reveal>
        <p>Bye</p>
      </Reveal>,
    );
    const instances = MockIntersectionObserver.allInstances();
    unmount();
    expect(instances[0]!.disconnect).toHaveBeenCalled();
  });
});