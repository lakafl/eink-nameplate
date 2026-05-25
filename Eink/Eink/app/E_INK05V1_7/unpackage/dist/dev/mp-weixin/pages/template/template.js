"use strict";
const common_vendor = require("../../common/vendor.js");
const common_assets = require("../../common/assets.js");
const _sfc_main = {
  data() {
    return {
      overlayFontSize: 36,
      unitOverlayFontSize: 24,
      nameOverlayFontSize: 36,
      positionOverlayFontSize: 18,
      kaitiFont: "STKaiti, KaiTi, 楷体, 楷体_GB2312, cursive"
    };
  },
  onLoad() {
    this.computeOverlayFont();
  },
  methods: {
    computeOverlayFont() {
      try {
        const sys = common_vendor.index.getSystemInfoSync();
        const rpx2px = sys.windowWidth / 750;
        const maxCardWidthPx = 500 * rpx2px;
        const pagePaddingPx = 30 * rpx2px;
        const cardPaddingPx = 20 * rpx2px;
        const containerWidthPx = Math.min(maxCardWidthPx, sys.windowWidth - 2 * pagePaddingPx);
        const previewWidthPx = Math.max(0, containerWidthPx - 2 * cardPaddingPx);
        const ratio = previewWidthPx > 0 ? previewWidthPx / sys.windowWidth : 0;
        this.overlayFontSize = Math.max(12, Math.round(100 * ratio));
        this.unitOverlayFontSize = Math.max(8, Math.round(40 * ratio));
        this.nameOverlayFontSize = Math.max(12, Math.round(100 * ratio));
        this.positionOverlayFontSize = Math.max(10, Math.round(50 * ratio));
      } catch (e) {
        this.overlayFontSize = 36;
        this.unitOverlayFontSize = 24;
        this.nameOverlayFontSize = 36;
        this.positionOverlayFontSize = 30;
      }
    },
    goToHome() {
      common_vendor.index.navigateBack({
        delta: 1,
        success: function(res) {
        },
        fail: function(err) {
          common_vendor.index.reLaunch({
            url: "/pages/index/index"
          });
        }
      });
    },
    selectTemplate(templateName, editPageUrl) {
      common_vendor.index.setStorageSync("selected_template", templateName);
      common_vendor.index.navigateTo({
        url: editPageUrl,
        success: function(res) {
        },
        fail: function(err) {
          common_vendor.index.showToast({
            title: "页面跳转失败",
            icon: "none"
          });
        }
      });
    },
    onImageError(e) {
      common_vendor.index.showToast({
        title: "图片加载失败",
        icon: "none"
      });
    }
  }
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return {
    a: common_assets._imports_0,
    b: $data.unitOverlayFontSize + "px",
    c: $data.kaitiFont,
    d: $data.nameOverlayFontSize + "px",
    e: $data.kaitiFont,
    f: $data.positionOverlayFontSize + "px",
    g: $data.kaitiFont,
    h: common_vendor.o(($event) => $options.selectTemplate("moban.jpg", "/pages/edit/edit")),
    i: common_assets._imports_0$1,
    j: $data.overlayFontSize + "px",
    k: $data.kaitiFont,
    l: common_vendor.o(($event) => $options.selectTemplate("moban2.jpg", "/pages/edit/edit2")),
    m: common_assets._imports_0$2,
    n: $data.unitOverlayFontSize + "px",
    o: $data.nameOverlayFontSize + "px",
    p: $data.positionOverlayFontSize + "px",
    q: common_vendor.o(($event) => $options.selectTemplate("moban4.jpg", "/pages/edit/edit4")),
    r: common_assets._imports_0$3,
    s: $data.unitOverlayFontSize + "px",
    t: $data.kaitiFont,
    v: $data.nameOverlayFontSize + "px",
    w: $data.kaitiFont,
    x: common_vendor.o(($event) => $options.selectTemplate("moban3.jpg", "/pages/edit/edit3")),
    y: common_vendor.o((...args) => $options.goToHome && $options.goToHome(...args))
  };
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/template/template.js.map
