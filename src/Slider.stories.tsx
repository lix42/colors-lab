import { fn } from "storybook/test";
import type { Meta, StoryObj } from "storybook-solidjs-vite";
import { Slider } from "./Slider";

const meta = {
  title: "Components/Slider",
  component: Slider,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    label: { control: "text", description: "Text shown to the left of the track" },
    max: { control: { type: "number" }, description: "Upper bound of the range input" },
    value: { control: { type: "number" }, description: "Current value (controlled)" },
  },
  args: {
    onInput: fn(),
  },
} satisfies Meta<typeof Slider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: "Hue",
    max: 360,
    value: 50,
  },
};

// Value pinned at the bounds — checks the thumb position and that the
// right-hand number column stays aligned at single- and multi-digit widths.
export const AtMin: Story = {
  args: {
    label: "Lightness",
    max: 100,
    value: 0,
  },
};

export const AtMax: Story = {
  args: {
    label: "Hue",
    max: 360,
    value: 360,
  },
};

// A label longer than the fixed `w: "24"` column — verifies it doesn't push
// the track out of alignment with the other rows.
export const LongLabel: Story = {
  args: {
    label: "Perceived Lightness",
    max: 100,
    value: 72,
  },
};
