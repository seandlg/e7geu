<script lang="ts">
  let {
    source,
    x,
    y,
    left,
    top,
    below = false,
  }: {
    source: HTMLCanvasElement;
    x: number;
    y: number;
    left: number;
    top: number;
    below?: boolean;
  } = $props();

  const sampleSize = 11;
  const cellSize = 11;
  const loupeSize = sampleSize * cellSize;
  let loupe = $state<HTMLCanvasElement>();

  $effect(() => {
    if (!loupe || source.width === 0 || source.height === 0) return;
    const context = loupe.getContext('2d');
    const sourceContext = source.getContext('2d', { willReadFrequently: true });
    if (!context || !sourceContext) return;

    const radius = Math.floor(sampleSize / 2);
    const sourceLeft = Math.max(0, x - radius);
    const sourceTop = Math.max(0, y - radius);
    const sourceRight = Math.min(source.width, x + radius + 1);
    const sourceBottom = Math.min(source.height, y + radius + 1);
    const pixels = sourceContext.getImageData(
      sourceLeft,
      sourceTop,
      sourceRight - sourceLeft,
      sourceBottom - sourceTop,
    );

    context.fillStyle = '#020617';
    context.fillRect(0, 0, loupeSize, loupeSize);
    for (let row = 0; row < pixels.height; row += 1) {
      for (let column = 0; column < pixels.width; column += 1) {
        const index = (row * pixels.width + column) * 4;
        const destinationX = (sourceLeft - (x - radius) + column) * cellSize;
        const destinationY = (sourceTop - (y - radius) + row) * cellSize;
        context.fillStyle = `rgb(${pixels.data[index]} ${pixels.data[index + 1]} ${pixels.data[index + 2]})`;
        context.fillRect(destinationX, destinationY, cellSize, cellSize);
      }
    }

    context.strokeStyle = 'rgb(255 255 255 / 0.2)';
    context.lineWidth = 1;
    for (let index = 1; index < sampleSize; index += 1) {
      const offset = index * cellSize + 0.5;
      context.beginPath();
      context.moveTo(offset, 0);
      context.lineTo(offset, loupeSize);
      context.moveTo(0, offset);
      context.lineTo(loupeSize, offset);
      context.stroke();
    }
    context.strokeStyle = '#fff';
    context.lineWidth = 3;
    context.strokeRect(radius * cellSize + 1.5, radius * cellSize + 1.5, cellSize - 3, cellSize - 3);
  });
</script>

<div
  class="pointer-events-none absolute z-20 overflow-hidden rounded-2xl border-3 border-white bg-slate-950 shadow-[0_8px_28px_rgb(0_0_0_/_0.65)]"
  style:left={`${left}%`}
  style:top={`${top}%`}
  style:transform={`translateX(${left < 20 ? '0' : left > 80 ? '-100%' : '-50%'}) ${below ? 'translateY(1.75rem)' : 'translateY(calc(-100% - 1.75rem))'}`}
  aria-hidden="true"
>
  <canvas bind:this={loupe} width={loupeSize} height={loupeSize} class="block h-[121px] w-[121px]"></canvas>
</div>
