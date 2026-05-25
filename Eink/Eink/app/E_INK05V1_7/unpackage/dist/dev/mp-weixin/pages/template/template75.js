"use strict";
const common_vendor = require("../../common/vendor.js");
const common_assets = require("../../common/assets.js");
const _sfc_main = {
  data() {
    return {};
  },
  onLoad() {
  },
  methods: {
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
    goToEdit() {
      common_vendor.index.navigateTo({
        url: "/pages/edit/edit75",
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
    a: common_assets._imports_0$4,
    b: common_vendor.o((...args) => $options.onImageError && $options.onImageError(...args)),
    c: common_vendor.o((...args) => $options.goToEdit && $options.goToEdit(...args)),
    d: common_vendor.o((...args) => $options.goToHome && $options.goToHome(...args))
  };
}
const MiniProgramPage = /* @__PURE__ */ common_vendor._export_sfc(_sfc_main, [["render", _sfc_render]]);
wx.createPage(MiniProgramPage);
//# sourceMappingURL=../../../.sourcemap/mp-weixin/pages/template/template75.js.map
