const DISPLAY_SIZES = [
  { label: '7.5寸 (640×384)', width: 640, height: 384 },
  { label: '4.2寸 (400×300)', width: 400, height: 300 }
];

const TEMPLATES = [
  {
    id: 'classic',
    name: '经典红底',
    desc: '单位名 + 红底姓名 + 职务',
    preview: '#4285F4',
    fields: ['topText', 'centerText', 'bottomText']
  },
  {
    id: 'minimal',
    name: '简约黑白',
    desc: '纯文字排版，干净利落',
    preview: '#212121',
    fields: ['topText', 'centerText', 'bottomText']
  },
  {
    id: 'business',
    name: '双栏名片',
    desc: '左名右信息，商务风格',
    preview: '#34A853',
    fields: ['topText', 'centerText', 'bottomText']
  },
  {
    id: 'bold',
    name: '醒目红幅',
    desc: '满屏红底白字，视觉冲击',
    preview: '#EA4335',
    fields: ['topText', 'centerText', 'bottomText']
  }
];

App({
  globalData: {
    deviceId: '',
    deviceName: '',
    connected: false,
    displaySizes: DISPLAY_SIZES,
    displayIndex: 0,   // 默认 7.5寸
    templates: TEMPLATES,
    templateIndex: 0   // 默认经典红底
  },

  onLaunch() {
    wx.getSystemInfo({
      success: (res) => {
        this.globalData.systemInfo = res;
      }
    });
  }
});
