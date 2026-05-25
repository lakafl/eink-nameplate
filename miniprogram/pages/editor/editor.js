const ble = require('../../utils/ble');

// ============================================================
// Helpers
// ============================================================

function wrapText(ctx, text, maxWidth) {
  if (!text) return [''];
  const lines = [];
  let cur = '';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\n') {
      lines.push(cur);
      cur = '';
      continue;
    }
    const test = cur + ch;
    if (ctx.measureText(test).width > maxWidth && cur.length > 0) {
      lines.push(cur);
      cur = ch;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines.length > 0 ? lines : [''];
}

// ============================================================
// Template renderers
// ============================================================

const Renderers = {

  // 经典红底
  classic(ctx, w, h, top, center, bottom, scales) {
    const unit    = Math.floor(h / 7);
    const hTop    = unit;
    const hBottom = unit;
    const hCenter = h - hTop - hBottom;
    const pad     = Math.round(w * 0.016);

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);

    // 单位 — 顶部左对齐，预留 90% 宽度换行
    if (top) {
      ctx.fillStyle = '#000000';
      const fs = Math.floor(hTop * 0.7 * (scales.topScale || 1));
      ctx.font = `bold ${fs}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const maxW = w - pad * 2;
      const lines = wrapText(ctx, top, maxW);
      const lineH = Math.round(fs * 1.25);
      const totalH = lines.length * lineH;
      const startY = hTop > totalH ? Math.round((hTop - totalH) / 2) : 2;
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], pad, startY + i * lineH);
      }
    }

    // 姓名 — 红色区域居中
    if (center) {
      ctx.fillStyle = '#FF0000';
      ctx.fillRect(0, hTop, w, hCenter);
      ctx.fillStyle = '#FFFFFF';
      const fs = Math.floor(hCenter * 0.6 * (scales.centerScale || 1));
      ctx.font = `bold ${fs}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const maxW = w - pad * 2;
      const lines = wrapText(ctx, center, maxW);
      const lineH = Math.round(fs * 1.25);
      const totalH = lines.length * lineH;
      const startY = hTop + Math.round((hCenter - totalH) / 2) + Math.round(lineH / 2);
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], w / 2, startY + i * lineH);
      }
    }

    // 职务 — 底部右对齐
    if (bottom) {
      ctx.fillStyle = '#000000';
      const fs = Math.floor(hBottom * 0.7 * (scales.bottomScale || 1));
      ctx.font = `bold ${fs}px sans-serif`;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      const maxW = w - pad * 2;
      const lines = wrapText(ctx, bottom, maxW);
      const lineH = Math.round(fs * 1.25);
      const totalH = lines.length * lineH;
      const startY = Math.round(h * 0.987) - totalH + lineH;
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], Math.round(w * 0.984), startY + i * lineH);
      }
    }
  },

  // 简约黑白
  minimal(ctx, w, h, top, center, bottom, scales) {
    const pad = Math.round(w * 0.06);
    const midY = h / 2;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);

    // 单位 — 顶部居中
    if (top) {
      ctx.fillStyle = '#1a1a1a';
      const fs = Math.floor(h * 0.07 * (scales.topScale || 1));
      ctx.font = `bold ${fs}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const maxW = w - pad * 2;
      const lines = wrapText(ctx, top, maxW);
      const lineH = Math.round(fs * 1.3);
      const totalH = lines.length * lineH;
      const startY = Math.max(Math.round(h * 0.04), Math.round(h * 0.08) - Math.round(totalH / 2));
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], w / 2, startY + i * lineH);
      }
    }

    // 姓名 — 大号居中 + 装饰线
    if (center) {
      ctx.fillStyle = '#000000';
      const fs = Math.floor(h * 0.22 * (scales.centerScale || 1));
      ctx.font = `bold ${fs}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const maxW = w - pad * 2;
      const lines = wrapText(ctx, center, maxW);
      const lineH = Math.round(fs * 1.25);
      const totalH = lines.length * lineH;
      const startY = midY - Math.round(totalH / 2) + Math.round(lineH / 2);
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], w / 2, startY + i * lineH);
      }

      // 装饰线
      const txtW = Math.min(ctx.measureText(lines[0]).width, maxW);
      const lineY = startY + totalH + Math.round(fs * 0.3);
      if (lineY < h - 20) {
        ctx.strokeStyle = '#999999';
        ctx.lineWidth = Math.max(1, Math.round(h / 300));
        ctx.beginPath();
        ctx.moveTo(w / 2 - Math.min(txtW / 2 + 40, w * 0.3), lineY);
        ctx.lineTo(w / 2 + Math.min(txtW / 2 + 40, w * 0.3), lineY);
        ctx.stroke();
      }
    }

    // 职务 — 底部居中
    if (bottom) {
      ctx.fillStyle = '#3a3a3a';
      const fs = Math.floor(h * 0.06 * (scales.bottomScale || 1));
      ctx.font = `bold ${fs}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      const maxW = w - pad * 2;
      const lines = wrapText(ctx, bottom, maxW);
      const lineH = Math.round(fs * 1.3);
      const totalH = lines.length * lineH;
      const endY = Math.round(h * 0.94);
      for (let i = lines.length - 1; i >= 0; i--) {
        ctx.fillText(lines[i], w / 2, endY - (lines.length - 1 - i) * lineH);
      }
    }
  },

  // 双栏名片
  business(ctx, w, h, top, center, bottom, scales) {
    const splitX = Math.round(w * 0.42);
    const pad    = Math.round(w * 0.03);

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);

    // 分隔线
    ctx.strokeStyle = '#AAAAAA';
    ctx.lineWidth = Math.max(1, Math.round(h / 300));
    ctx.beginPath();
    ctx.moveTo(splitX, Math.round(h * 0.08));
    ctx.lineTo(splitX, Math.round(h * 0.92));
    ctx.stroke();

    // 左栏 — 姓名
    if (center) {
      ctx.fillStyle = '#000000';
      const fs = Math.floor(h * 0.2 * (scales.centerScale || 1));
      ctx.font = `bold ${fs}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const maxW = splitX - pad * 2;
      const lines = wrapText(ctx, center, maxW);
      const lineH = Math.round(fs * 1.25);
      const totalH = lines.length * lineH;
      const startY = Math.round((h - totalH) / 2) + Math.round(lineH / 2);
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], splitX / 2, startY + i * lineH);
      }
    }

    // 右栏 — 单位 + 职务
    const rightX  = splitX + pad;
    const rightW  = w - rightX - pad;

    if (top) {
      ctx.fillStyle = '#111111';
      const fs = Math.floor(h * 0.09 * (scales.topScale || 1));
      ctx.font = `bold ${fs}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const lines = wrapText(ctx, top, rightW);
      const lineH = Math.round(fs * 1.3);
      const startY = Math.round(h * 0.22);
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], rightX, startY + i * lineH);
      }
    }

    if (bottom) {
      ctx.fillStyle = '#3a3a3a';
      const fs = Math.floor(h * 0.07 * (scales.bottomScale || 1));
      ctx.font = `bold ${fs}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const lines = wrapText(ctx, bottom, rightW);
      const lineH = Math.round(fs * 1.3);
      // 放在右栏下半部分
      const topLines = top ? wrapText(ctx, top, rightW) : [];
      const topFs    = Math.floor(h * 0.09 * (scales.topScale || 1));
      const topEndY  = Math.round(h * 0.22) + topLines.length * Math.round(topFs * 1.3) + Math.round(h * 0.04);
      const startY   = Math.max(topEndY, Math.round(h * 0.45));
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], rightX, startY + i * lineH);
      }
    }
  },

  // 醒目红幅
  bold(ctx, w, h, top, center, bottom, scales) {
    const pad = Math.round(w * 0.05);
    ctx.fillStyle = '#CC0000';
    ctx.fillRect(0, 0, w, h);

    // 单位
    if (top) {
      ctx.fillStyle = '#FFFFFF';
      const fs = Math.floor(h * 0.07 * (scales.topScale || 1));
      ctx.font = `bold ${fs}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const maxW = w - pad * 2;
      const lines = wrapText(ctx, top, maxW);
      const lineH = Math.round(fs * 1.3);
      const totalH = lines.length * lineH;
      const startY = Math.round(h * 0.06);
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], w / 2, startY + i * lineH);
      }
    }

    // 姓名 — 大字居中
    if (center) {
      ctx.fillStyle = '#FFFFFF';
      const fs = Math.floor(h * 0.28 * (scales.centerScale || 1));
      ctx.font = `bold ${fs}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const maxW = w - pad * 2;
      const lines = wrapText(ctx, center, maxW);
      const lineH = Math.round(fs * 1.2);
      const totalH = lines.length * lineH;
      const startY = Math.round((h - totalH) / 2) + Math.round(lineH / 2);
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], w / 2, startY + i * lineH);
      }
    }

    // 职务
    if (bottom) {
      ctx.fillStyle = '#FFFFFF';
      const fs = Math.floor(h * 0.06 * (scales.bottomScale || 1));
      ctx.font = `bold ${fs}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      const maxW = w - pad * 2;
      const lines = wrapText(ctx, bottom, maxW);
      const lineH = Math.round(fs * 1.3);
      const totalH = lines.length * lineH;
      const endY = Math.round(h * 0.94);
      for (let i = lines.length - 1; i >= 0; i--) {
        ctx.fillText(lines[i], w / 2, endY - (lines.length - 1 - i) * lineH);
      }
    }
  }
};

// ============================================================
// Page
// ============================================================

Page({
  data: {
    topText: '西南大学',
    centerText: '姓名',
    bottomText: '学生',
    bleReady: false,
    sending: false,
    progress: 0,
    statusMsg: '',
    statusType: 'info',
    // 尺寸
    displaySizes: [],
    displayIndex: 0,
    epdWidth: 640,
    epdHeight: 384,
    // 模板
    templates: [],
    templateIndex: 0,
    templateId: 'classic',
    // 字号缩放
    topScale: 1.0,
    centerScale: 1.0,
    bottomScale: 1.0
  },

  _canvas: null,
  _ctx: null,
  _drawTimer: null,

  onLoad() {
    const app = getApp();
    const sizes = app.globalData.displaySizes || [];
    const sIdx  = app.globalData.displayIndex || 0;
    const cur   = sizes[sIdx] || { width: 640, height: 384 };
    const tmpls = app.globalData.templates || [];
    const tIdx  = app.globalData.templateIndex || 0;
    const tpl   = tmpls[tIdx] || { id: 'classic' };

    this.setData({
      bleReady: ble.isConnected(),
      displaySizes: sizes,
      displayIndex: sIdx,
      epdWidth:  cur.width,
      epdHeight: cur.height,
      templates: tmpls,
      templateIndex: tIdx,
      templateId: tpl.id
    });

    ble.setDisplayConfig(cur.width, cur.height);

    if (!ble.isConnected()) {
      this.setData({ statusMsg: '未连接设备，请先返回连接', statusType: 'error' });
    }
  },

  onReady() {
    this.initCanvas();
  },

  onUnload() {
    if (this._drawTimer) clearTimeout(this._drawTimer);
  },

  // ---- Display size ----
  onSizeChange(e) {
    const idx = parseInt(e.detail.value);
    const app = getApp();
    const sizes = app.globalData.displaySizes;
    const cur = sizes[idx];

    app.globalData.displayIndex = idx;
    ble.setDisplayConfig(cur.width, cur.height);

    this.setData({
      displayIndex: idx,
      epdWidth:  cur.width,
      epdHeight: cur.height
    });
    this.initCanvas();
  },

  // ---- Template ----
  onTemplateChange(e) {
    const idx = parseInt(e.detail.value);
    const app = getApp();
    const tmpls = app.globalData.templates;
    const tpl = tmpls[idx];

    app.globalData.templateIndex = idx;
    this.setData({ templateIndex: idx, templateId: tpl.id });

    if (this._ctx) this.drawPreview();
  },

  // ---- Font scale sliders ----
  onTopScaleChange(e)    { this.setData({ topScale: parseFloat(e.detail.value) });    this.scheduleDraw(); },
  onCenterScaleChange(e) { this.setData({ centerScale: parseFloat(e.detail.value) }); this.scheduleDraw(); },
  onBottomScaleChange(e) { this.setData({ bottomScale: parseFloat(e.detail.value) }); this.scheduleDraw(); },

  // ---- Canvas ----
  initCanvas() {
    const { epdWidth, epdHeight } = this.data;
    const query = wx.createSelectorQuery();
    query.select('#editCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0] || !res[0].node) {
          console.error('[Editor] Canvas node not available');
          this.setData({ statusMsg: 'Canvas 不可用，请重试', statusType: 'error' });
          return;
        }
        this._canvas = res[0].node;
        this._ctx = this._canvas.getContext('2d');
        this._canvas.width  = epdWidth;
        this._canvas.height = epdHeight;
        this.drawPreview();
      });
  },

  // ---- Input handlers ----
  onTopInput(e)    { this.setData({ topText: e.detail.value });    this.scheduleDraw(); },
  onCenterInput(e) { this.setData({ centerText: e.detail.value }); this.scheduleDraw(); },
  onBottomInput(e) { this.setData({ bottomText: e.detail.value }); this.scheduleDraw(); },

  scheduleDraw() {
    if (this._drawTimer) clearTimeout(this._drawTimer);
    this._drawTimer = setTimeout(() => this.drawPreview(), 100);
  },

  // ---- Draw preview ----
  drawPreview() {
    if (!this._ctx) return;
    const { templateId, topText, centerText, bottomText, epdWidth, epdHeight, topScale, centerScale, bottomScale } = this.data;
    const render = Renderers[templateId];
    if (render) {
      render(this._ctx, epdWidth, epdHeight, topText, centerText, bottomText, {
        topScale, centerScale, bottomScale
      });
    }
  },

  // ---- Extract bitmap ----
  extractBitmap() {
    const ctx = this._ctx;
    const { epdWidth, epdHeight } = this.data;
    const layerSize = epdWidth * epdHeight / 8;

    if (this._canvas.width !== epdWidth || this._canvas.height !== epdHeight) {
      this._canvas.width  = epdWidth;
      this._canvas.height = epdHeight;
      this.drawPreview();
    }

    const imageData = ctx.getImageData(0, 0, epdWidth, epdHeight);
    const pixels = imageData.data;
    if (!pixels || pixels.length !== epdWidth * epdHeight * 4) {
      throw new Error(`ImageData 尺寸异常: ${pixels ? pixels.length : 0}`);
    }

    const bytesPerRow = Math.ceil(epdWidth / 8);
    const blackBuf = new Uint8Array(layerSize);
    const redBuf   = new Uint8Array(layerSize);

    for (let y = 0; y < epdHeight; y++) {
      for (let x = 0; x < epdWidth; x++) {
        const idx     = (y * epdWidth + x) * 4;
        const r       = pixels[idx];
        const g       = pixels[idx + 1];
        const b       = pixels[idx + 2];
        const byteIdx = y * bytesPerRow + Math.floor(x / 8);
        const bit     = 1 << (7 - (x % 8));
        if (r < 128 && g < 128 && b < 128)       blackBuf[byteIdx] |= bit;
        else if (r > 127 && g < 128 && b < 128)  redBuf[byteIdx] |= bit;
      }
    }

    return { blackData: blackBuf.buffer, redData: redBuf.buffer };
  },

  // ---- Send ----
  async sendToDevice() {
    if (this.data.sending) return;
    if (!ble.isConnected()) { this.setData({ statusMsg: '未连接设备', statusType: 'error' }); return; }
    if (!this._ctx) { this.setData({ statusMsg: 'Canvas 未就绪', statusType: 'error' }); return; }

    this.setData({ sending: true, progress: 0, statusMsg: '正在渲染...', statusType: 'info' });
    try {
      this.drawPreview();
      await ble.sleep(500);
      const { blackData, redData } = this.extractBitmap();
      this.setData({ statusMsg: '正在传输...', statusType: 'info' });
      await ble.sendBitmap(blackData, redData, (p) => {
        this.setData({ progress: p.percent, statusMsg: `传输图层 ${p.layer + 1}... ${p.percent}%` });
      });
      this.setData({ sending: false, progress: 100, statusMsg: '发送完成！屏幕正在刷新...', statusType: 'success' });
      wx.showToast({ title: '发送成功', icon: 'success' });
    } catch (e) {
      console.error('[Editor] Send failed:', e);
      const msg = typeof e === 'string' ? e : (e.errMsg || e.message || '发送失败');
      this.setData({ sending: false, progress: 0, statusMsg: '发送失败: ' + msg, statusType: 'error' });
      wx.showModal({
        title: '发送失败', content: msg + '\n\n是否重新连接设备？',
        confirmText: '重新连接', cancelText: '稍后再试',
        success: (res) => {
          if (res.confirm) { ble.disconnect(); getApp().globalData.connected = false; wx.navigateBack(); }
        }
      });
    }
  },

  goBack() {
    ble.disconnect();
    getApp().globalData.connected = false;
    wx.navigateBack();
  }
});
