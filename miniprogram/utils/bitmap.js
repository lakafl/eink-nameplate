// Bitmap renderer for nameplate layout
// Renders text to 1-bit bitmaps compatible with GxEPD2

const EPD_WIDTH  = 640;
const EPD_HEIGHT = 384;
const LAYER_SIZE = EPD_WIDTH * EPD_HEIGHT / 8; // 30720 bytes

// Convert canvas ImageData to 1-bit GxEPD2-compatible bitmap
// format: each byte = 8 horizontal pixels, MSB = leftmost pixel
function imageDataToBitmap(imageData, width, height) {
  const pixels = imageData.data;
  const bytesPerRow = Math.ceil(width / 8);
  const bitmap = new ArrayBuffer(bytesPerRow * height);
  const view = new Uint8Array(bitmap);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const pixelIdx = (y * width + x) * 4;
      const r = pixels[pixelIdx];
      const g = pixels[pixelIdx + 1];
      const b = pixels[pixelIdx + 2];
      // Black pixel = bit 1, White pixel = bit 0
      const isBlack = (r < 128 && g < 128 && b < 128);

      if (isBlack) {
        const byteIdx = y * bytesPerRow + Math.floor(x / 8);
        const bitIdx = 7 - (x % 8); // MSB first
        view[byteIdx] |= (1 << bitIdx);
      }
    }
  }

  return bitmap;
}

// Render nameplate layout on offscreen canvas
// Returns { blackData, redData } as ArrayBuffers
async function renderNameplate(topText, centerText, bottomText) {
  return new Promise((resolve, reject) => {
    try {
      // Calculate row heights (same as Python gen_font.py)
      const unit = Math.floor(EPD_HEIGHT / 7);
      const hTop = unit;           // ~54px
      const hBottom = unit;        // ~54px
      const hCenter = EPD_HEIGHT - hTop - hBottom; // ~276px

      // Use push/draw/reserve pattern with shared canvas
      const query = wx.createSelectorQuery();
      query.select('#renderCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res || !res[0] || !res[0].node) {
            reject(new Error('Canvas node not found, add <canvas id="renderCanvas"> to page'));
            return;
          }

          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');

          canvas.width = EPD_WIDTH;
          canvas.height = EPD_HEIGHT;

          // Clear white background
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, EPD_WIDTH, EPD_HEIGHT);

          // --- Top row: black text, left-aligned ---
          if (topText) {
            ctx.fillStyle = '#000000';
            const fontSize = Math.floor(hTop * 0.7);
            ctx.font = `${fontSize}px sans-serif`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(topText, 10, 5);
          }

          // --- Center row: red background, white text, centered ---
          if (centerText) {
            // Red background
            ctx.fillStyle = '#FF0000';
            ctx.fillRect(0, hTop, EPD_WIDTH, hCenter);

            // White centered text
            ctx.fillStyle = '#FFFFFF';
            const fontSize = Math.floor(hCenter * 0.6);
            ctx.font = `bold ${fontSize}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(centerText, EPD_WIDTH / 2, hTop + hCenter / 2);
          }

          // --- Bottom row: black text, right-aligned ---
          if (bottomText) {
            ctx.fillStyle = '#000000';
            const fontSize = Math.floor(hBottom * 0.7);
            ctx.font = `${fontSize}px sans-serif`;
            ctx.textAlign = 'right';
            ctx.textBaseline = 'bottom';
            ctx.fillText(bottomText, EPD_WIDTH - 10, EPD_HEIGHT - 5);
          }

          // Extract image data
          const imageData = ctx.getImageData(0, 0, EPD_WIDTH, EPD_HEIGHT);
          const pixels = imageData.data;

          // Convert to black and red bitmaps
          // Black bitmap: R<128 && G<128 && B<128
          // Red bitmap:  R>127 && G<128 && B<128 (red pixels or red background)
          const bytesPerRow = Math.ceil(EPD_WIDTH / 8);
          const blackBuf = new Uint8Array(LAYER_SIZE);
          const redBuf   = new Uint8Array(LAYER_SIZE);

          for (let y = 0; y < EPD_HEIGHT; y++) {
            for (let x = 0; x < EPD_WIDTH; x++) {
              const idx = (y * EPD_WIDTH + x) * 4;
              const r = pixels[idx];
              const g = pixels[idx + 1];
              const b = pixels[idx + 2];

              const byteIdx = y * bytesPerRow + Math.floor(x / 8);
              const bit = 1 << (7 - (x % 8));

              // Classify pixel
              if (r < 128 && g < 128 && b < 128) {
                // Black pixel
                blackBuf[byteIdx] |= bit;
              } else if (r > 127 && g < 128 && b < 128) {
                // Red pixel
                redBuf[byteIdx] |= bit;
              }
              // White: neither bit set
            }
          }

          resolve({
            blackData: blackBuf.buffer,
            redData: redBuf.buffer,
            dimensions: { width: EPD_WIDTH, height: EPD_HEIGHT, hTop, hCenter, hBottom }
          });
        });
    } catch (e) {
      reject(e);
    }
  });
}

// Simpler synchronous version using wx.createCanvasContext (legacy API)
// This version works without the new Canvas 2D API
function renderNameplateLegacy(ctx, topText, centerText, bottomText) {
  const unit = Math.floor(EPD_HEIGHT / 7);
  const hTop = unit;
  const hBottom = unit;
  const hCenter = EPD_HEIGHT - hTop - hBottom;

  // Clear
  ctx.setFillStyle('#FFFFFF');
  ctx.fillRect(0, 0, EPD_WIDTH, EPD_HEIGHT);

  // Top: black, left-aligned
  if (topText) {
    ctx.setFillStyle('#000000');
    ctx.setFontSize(Math.floor(hTop * 0.7));
    ctx.setTextAlign('left');
    ctx.setTextBaseline('top');
    ctx.fillText(topText, 10, 5);
  }

  // Center: red background, white text
  if (centerText) {
    ctx.setFillStyle('#FF0000');
    ctx.fillRect(0, hTop, EPD_WIDTH, hCenter);
    ctx.setFillStyle('#FFFFFF');
    ctx.setFontSize(Math.floor(hCenter * 0.6));
    ctx.setTextAlign('center');
    ctx.setTextBaseline('middle');
    ctx.fillText(centerText, EPD_WIDTH / 2, hTop + hCenter / 2);
  }

  // Bottom: black, right-aligned
  if (bottomText) {
    ctx.setFillStyle('#000000');
    ctx.setFontSize(Math.floor(hBottom * 0.7));
    ctx.setTextAlign('right');
    ctx.setTextBaseline('bottom');
    ctx.fillText(bottomText, EPD_WIDTH - 10, EPD_HEIGHT - 5);
  }

  ctx.draw(false, () => {
    // Drawing complete - caller should then use wx.canvasGetImageData
  });

  return { hTop, hCenter, hBottom };
}

module.exports = {
  EPD_WIDTH,
  EPD_HEIGHT,
  LAYER_SIZE,
  imageDataToBitmap,
  renderNameplate,
  renderNameplateLegacy
};
