import type { Component } from "solid-js";
import { css } from "../styled-system/css";

export const Slider: Component<{
  label: string;
  max: number;
  value: number;
  onInput: (value: number) => void;
}> = (props) => {
  return (
    <label class={css({ display: "flex", alignItems: "center", gap: "3" })}>
      <span class={css({ w: "24", flexShrink: 0, color: "gray.700" })}>{props.label}</span>
      <input
        class={css({ flex: "1" })}
        type="range"
        min="0"
        max={props.max}
        value={props.value}
        onInput={(e) => props.onInput(Number(e.currentTarget.value))}
      />
      <span class={css({ w: "12", textAlign: "right", color: "gray.500" })}>{props.value}</span>
    </label>
  );
};
