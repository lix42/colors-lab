import { type Component, createSignal } from "solid-js";
import { css } from "../styled-system/css";
import { Slider } from "./Slider";

const App: Component = () => {
  const [hue, setHue] = createSignal(50);
  const [saturation, setSaturation] = createSignal(50);
  const [lightness, setLightness] = createSignal(50);

  const color = () => `hsl(${hue()}deg ${saturation()}% ${lightness()}%)`;

  return (
    <main class={css({ maxW: "3xl", mx: "auto", px: "4" })}>
      <h1
        class={css({
          fontSize: "4xl",
          fontWeight: "bold",
          color: "green.700",
          textAlign: "center",
          py: "5",
        })}
      >
        Colors Lab
      </h1>
      <div class={css({ display: "flex", flexDirection: "column", gap: "4" })}>
        <div
          class={css({
            w: "48",
            h: "48",
            rounded: "lg",
            borderWidth: "1px",
            borderColor: "gray.200",
          })}
          style={{ "background-color": color() }}
        />
        <Slider label="Hue" max={360} value={hue()} onInput={setHue} />
        <Slider label="Saturation" max={100} value={saturation()} onInput={setSaturation} />
        <Slider label="Lightness" max={100} value={lightness()} onInput={setLightness} />
      </div>
    </main>
  );
};

export default App;
