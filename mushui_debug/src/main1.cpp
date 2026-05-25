/*************************************************************
  GDEW075Z09 (7.5" 640x384 三色) 硬件测试程序
  引脚：CS=7, DC=3, RST=2, BUSY=10, SCK=4, MOSI=5
  使用通用 GxEPD2_750c 模板，高度 384
 *************************************************************/

#include <GxEPD2_3C.h>
#include <Fonts/FreeMonoBold9pt7b.h>

// 引脚定义
#define BUSY_PIN   10
#define RST_PIN    2
#define DC_PIN     3
#define CS_PIN     7
#define SCK_PIN    4
#define SDI_PIN    5   // MOSI

// 屏幕对象：通用 7.5寸三色类，指定高度 384
GxEPD2_3C<GxEPD2_750c, 384> display(
  GxEPD2_750c(CS_PIN, DC_PIN, RST_PIN, -1)   // BUSY 暂时禁用，避免忙等
);

// 如果上面编译不通过，尝试用高度 480 并调整坐标（很少情况）
// GxEPD2_3C<GxEPD2_750c, 480> display(GxEPD2_750c(CS_PIN, DC_PIN, RST_PIN, -1));

void drawTest();

void setup() {
  Serial.begin(115200);
  delay(2000);
  Serial.println("\n\n===== GDEW075Z09 测试开始 =====");

  // 手动复位
  pinMode(RST_PIN, OUTPUT);
  digitalWrite(RST_PIN, LOW);
  delay(100);
  digitalWrite(RST_PIN, HIGH);
  delay(500);

  SPI.begin(SCK_PIN, -1, SDI_PIN, CS_PIN);
  Serial.println("SPI 已初始化");

  // 初始化（降速，禁用 busy）
  display.init(115200, true, 2, false);
  Serial.printf("屏幕尺寸: %dx%d\n", display.epd2.WIDTH, display.epd2.HEIGHT);

  display.setRotation(0);
  display.setFullWindow();
  drawTest();

  Serial.println("刷新指令已发送");
}

void loop() {}

void drawTest() {
  display.fillScreen(GxEPD_WHITE);

  display.setFont(&FreeMonoBold9pt7b);
  display.setTextColor(GxEPD_BLACK);
  display.setCursor(20, 30);
  display.println("GDEW075Z09 OK");
  
  display.setCursor(20, 60);
  display.println("640x384");
  
  display.setTextColor(GxEPD_RED);
  display.setCursor(20, 90);
  display.println("Red Color");
  
  display.setTextColor(GxEPD_BLACK);
  display.setCursor(20, 120);
  display.println("Pins:");
  display.setCursor(20, 150);
  display.printf("CS:%d DC:%d RST:%d BUSY:-1", CS_PIN, DC_PIN, RST_PIN);
  
  // 图形测试（适配窄屏）
  display.drawRect(20, 170, 130, 60, GxEPD_BLACK);
  display.drawRect(170, 170, 130, 60, GxEPD_RED);
  display.fillRect(320, 170, 110, 60, GxEPD_BLACK);
  display.fillRect(450, 170, 110, 60, GxEPD_RED);
  
  display.drawLine(0, 250, 640, 250, GxEPD_BLACK);
  display.drawLine(0, 254, 640, 254, GxEPD_RED);
  
  display.setCursor(20, 280);
  display.println("Red circle ->");
  display.fillCircle(580, 300, 25, GxEPD_RED);
  
  display.setCursor(20, 350);
  display.println("Test done!");

  display.display();
}