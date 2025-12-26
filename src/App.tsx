import { type Component, createMemo, createSignal } from "solid-js";

const App: Component = () => {
  const [hue, setHue] = createSignal(50);
  const [saturation, setSaturation] = createSignal(50);
  const [lightness, setLightness] = createSignal(50);

  const color = createMemo(
    () => `hsl(${hue()}deg, ${saturation()}%, ${lightness()}%)`,
  );

  return (
    <main class="max-w-screen-md mx-auto">
      <h1 class="text-4xl text-green-700 text-center py-5">Colors Lab</h1>
      <div>
        <div class="w-50 h-50" style={{ "background-color": color() }} />
        <label>
          <span>Hue</span>
          <input
            type="range"
            min="0"
            max="360"
            value={hue()}
            onInput={(e) => setHue(Number(e.target.value))}
          />
        </label>
        <label>
          <span>Saturation</span>
          <input
            type="range"
            min="0"
            max="100"
            value={saturation()}
            onInput={(e) => setSaturation(Number(e.target.value))}
          />
        </label>
        <label>
          <span>Lightness</span>
          <input
            type="range"
            min="0"
            max="100"
            value={lightness()}
            onInput={(e) => setLightness(Number(e.target.value))}
          />
        </label>
      </div>
    </main>
  );
};

export default App;
