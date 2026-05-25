#include "my_gxepd2.h"

#define CS_PIN      7    
#define DC_PIN      3   
#define RST_PIN     2   
#define BUSY_PIN    10  

GxEPD2_Display display(GxEPD2_750c(CS_PIN, DC_PIN, RST_PIN, BUSY_PIN));

//初始化墨水屏
void ink_screen_init() {
  display.init(115200);
  display.setRotation(1); 
  
  // 清屏
  display.fillScreen(WHITE);
  // display.display();
}

//画出框架
void draw_frame() {
  display.drawInvertedBitmap(0, 0, gImage_1, 384, 40, RED);
  display.fillRect(255, 40, 2, 600, RED);
  display.fillRect(0, 139, 384, 2, RED);
  display.fillRect(0, 239, 384, 2, RED);
  display.fillRect(0, 339, 384, 2, RED);
  display.fillRect(0, 439, 384, 2, RED);
  display.fillRect(0, 539, 384, 2, RED);

  display.display();
}

//显示状态
void display_status(uint8_t id, uint8_t index) {
  uint n = 65 + (id - 1) * 100;
    
  display.fillRect(270, n, 100, 50, WHITE); 
  // 根据index显示相应的图标
  switch(index) {
    case 1: display.drawInvertedBitmap(270, n, gImage_2, 100, 50, RED);     break;
    case 2: display.drawInvertedBitmap(270, n, gImage_3, 100, 50, BLACK);   break;
    case 3: display.drawInvertedBitmap(270, n, gImage_4, 100, 50, RED);     break;
    case 4: display.drawInvertedBitmap(270, n, gImage_5, 100, 50, BLACK);   break;
    case 5: display.drawInvertedBitmap(270, n, gImage_6, 100, 50, BLACK);   break;
    case 6: display.drawInvertedBitmap(270, n, gImage_7, 100, 50, BLACK);   break;
  }
  display.display();
}

//显示人名
void display_name(uint8_t id, unsigned char*data) {
  // 根据ID确定要更新的区域
  int16_t x = 28;
  int16_t y;
  switch(id) {
    case 1: y = 45;     break;
    case 2: y = 145;    break;
    case 3: y = 245;    break;
    case 4: y = 345;    break;
    case 5: y = 445;    break;
    case 6: y = 545;    break;
    default: return;
  } 
  // 显示姓名图片
  display.fillRect(x, y, 200, 70, WHITE);
  display.drawBitmap(x, y, data, 200, 70, BLACK);
}

//刷新函数
void ink_screen_refresh() {
  display.display();
}