import { cleanup, fireEvent, render, screen } from "@solidjs/testing-library";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { Slider } from "./Slider";

// Auto-cleanup only hooks in when Vitest globals are enabled, which they aren't here.
afterEach(cleanup);

describe("Slider", () => {
  it("labels the range input and shows the current value", () => {
    render(() => <Slider label="Hue" max={360} value={50} onInput={() => {}} />);

    const input = screen.getByLabelText(/Hue/) as HTMLInputElement;
    expect(input.type).toBe("range");
    expect(input.min).toBe("0");
    expect(input.max).toBe("360");
    expect(input.value).toBe("50");
    expect(screen.getByText("50")).toBeInTheDocument();
  });

  it("reports input as a number, not the raw string", () => {
    const onInput = vi.fn();
    render(() => <Slider label="Hue" max={360} value={50} onInput={onInput} />);

    fireEvent.input(screen.getByLabelText(/Hue/), { target: { value: "120" } });

    expect(onInput).toHaveBeenCalledExactlyOnceWith(120);
  });
});
