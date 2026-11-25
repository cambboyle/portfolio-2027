import { makeLayer } from "./asciiRing";

/**
 * A transparent canvas over the whole page that does not catch the mouse, for effects that float above the content
 * (the cursor trail, the comet). It follows the window's size. Call `destroy` to remove it.
 */
export function createOverlay() {
  let layer = makeLayer(innerWidth, innerHeight, null);
  document.body.append(layer.canvas);
  const onResize = () => {
    const next = makeLayer(innerWidth, innerHeight, null);
    layer.canvas.replaceWith(next.canvas);
    layer = next;
  };
  addEventListener("resize", onResize);
  return {
    get ctx() {
      return layer.ctx;
    },
    get width() {
      return innerWidth;
    },
    get height() {
      return innerHeight;
    },
    clear() {
      layer.ctx.clearRect(0, 0, innerWidth, innerHeight);
    },
    destroy() {
      removeEventListener("resize", onResize);
      layer.canvas.remove();
    },
  };
}
