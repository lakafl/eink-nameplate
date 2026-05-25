#include <SPI.h>
#include "Display_EPD_W21_spi.h"
#include "Display_EPD_W21.h"
#include "Ap_29demo.h" 
#include <WiFi.h>
#include <PubSubClient.h>
#include <Preferences.h>

void MQTT_init();
void reconnect();
void memory_allocation_inital();
void callback(char* topic, byte* payload, unsigned int length);
void CharToHexRaw(const char *str, uint32_t index, uint32_t byte_count, uint8_t* output);
void ShowBitmap();
uint8_t hexf(uint8_t temp);
static void skip_spaces_and_quote(const char** p);
void dump_buf_hex(const uint8_t* buf, uint32_t start, uint32_t count, const char* name);

// ========== WiFi 配置状态机 ==========
void wifi_state_machine_init();
void wifi_state_machine_loop();
bool is_wifi_connected();  // WiFi 已连接时返回 true，用于 MQTT 等

#define MQTT_MAX_SIZE 10240 //10kB

int SCK_Pin = 4; 
int SDI_Pin = 3; 

// 定义存储数组 - 在堆中分配
uint8_t* bw = NULL;
uint8_t* rw = NULL;
uint32_t total_data_size = 48000;

// 设置JSON容量
const int JSON_CAPACITY = 5200;
char json_buffer[JSON_CAPACITY];

// WiFi 凭证由状态机从 BLE 指令或 NVS 读取，不再硬编码

// MQTT服务器配置
const char* mqtt_server = "47.93.223.154";  // 测试服务器
const int mqtt_port = 1883;
const char* mqtt_user = "Mqtt1";     // 如果有用户名
const char* mqtt_password = "123456789"; // 如果有密码

// 主题设置
const char* topic_sub = "esp32c3/sub";  // 订阅主题
const char* topic_pub = "esp32c3/pub";  // 发布主题

// 客户端ID（确保唯一性）
String clientId = "ESP32C3-supermini";

uint8_t receive_over = 0;  // 置 1 表示 bw+rw 全部接收完毕，可刷新屏幕

// 已接收数据末尾下标（用于判断是否收齐 48000 字节）
uint32_t bw_received_end = 0;  // 已收到的 bw 最大下标+1（即 [0, bw_received_end) 已收）
uint32_t rw_received_end = 0;  // 已收到的 rw 最大下标+1

// 创建对象
WiFiClient espClient;
PubSubClient client(espClient);

// ========== WiFi 配置状态机 ==========
enum WifiState {
  STATE_WAIT_CMD,      // 等待指令
  STATE_WIFI_SCAN,     // 正在扫描 WiFi
  STATE_WIFI_CONNECT,  // 正在连接 WiFi
  STATE_WIFI_CONNECTED // WiFi 已连接
};

#define BLE_DEVICE_NAME "ESP32C3_WiFi_Config"
#define BLE_CMD_BUF_SIZE 512
#define WIFI_CONNECT_TIMEOUT_MS 15000

static WifiState wifi_state = STATE_WAIT_CMD;
static ESP32_BleSerial BleSerial;
static Preferences preferences;
static char ble_cmd_buf[BLE_CMD_BUF_SIZE];
static size_t ble_cmd_len = 0;
static uint8_t auto_connect_tried = 0;  // 是否已尝试过 NVS 自动连接

// 辅助：从 JSON 中解析字符串字段 "key":"value"
static bool parse_json_str(const char* json, const char* key, char* out, size_t out_size) {
  char search[32];
  snprintf(search, sizeof(search), "\"%s\":", key);
  const char* p = strstr(json, search);
  if (!p) return false;
  p += strlen(search);
  while (*p == ' ') p++;
  if (*p != '"') return false;
  p++;
  size_t i = 0;
  while (i < out_size - 1 && *p && *p != '"') {
    if (*p == '\\' && *(p+1) == '"') { out[i++] = '"'; p += 2; continue; }
    out[i++] = *p++;
  }
  out[i] = '\0';
  return true;
}

static void ble_send(const char* s) {
  if (BleSerial.connected()) BleSerial.println(s);
}

static char pending_save_ssid[64] = {0};
static char pending_save_pass[64] = {0};
static void set_pending_save(const char* ssid, const char* pass) {
  strncpy(pending_save_ssid, ssid ? ssid : "", sizeof(pending_save_ssid) - 1);
  strncpy(pending_save_pass, pass ? pass : "", sizeof(pending_save_pass) - 1);
}

static void save_wifi_credentials(const char* ssid, const char* pass) {
  preferences.begin("wifi", false);
  preferences.putString("ssid", ssid);
  preferences.putString("pass", pass);
  preferences.end();
  Serial.println("[NVS] WiFi 凭证已保存");
}

static void wifi_state_machine_init() {
  wifi_state = STATE_WAIT_CMD;
  BleSerial.begin(BLE_DEVICE_NAME);
  Serial.println("[BLE] 设备名: " BLE_DEVICE_NAME ", 等待手机连接...");

  // 检查 NVS 是否有保存的凭证，用于后续自动联网
  preferences.begin("wifi", true);
  String saved_ssid = preferences.getString("ssid", "");
  String saved_pass = preferences.getString("pass", "");
  preferences.end();

  if (saved_ssid.length() > 0) {
    Serial.println("[NVS] 检测到已保存的 WiFi 凭证，将在 loop 中尝试自动连接");
  }
}

#define SCAN_RESULT_BUF_SIZE 1024
static void do_scan_and_send() {
  int n = WiFi.scanComplete();
  if (n < 0) return;
  char buf[SCAN_RESULT_BUF_SIZE];
  int off = snprintf(buf, sizeof(buf), "{\"evt\":\"scan_result\",\"count\":%d,\"networks\":[", n);
  int max_n = (n > 15) ? 15 : n;
  for (int i = 0; i < max_n; i++) {
    int add = snprintf(buf + off, sizeof(buf) - off, "%s{\"ssid\":\"%s\",\"rssi\":%d}",
                       i > 0 ? "," : "", WiFi.SSID(i).c_str(), WiFi.RSSI(i));
    if (add < 0 || (size_t)(off + add) >= sizeof(buf)) break;
    off += add;
  }
  off += snprintf(buf + off, sizeof(buf) - off, "]}");
  ble_send(buf);
  Serial.printf("[BLE] 已返回 %d 个网络\n", max_n);
  wifi_state = STATE_WAIT_CMD;
}

static uint32_t connect_start_ms = 0;
static void do_connect(const char* ssid, const char* pass) {
  Serial.printf("[WiFi] 尝试连接: %s\n", ssid);
  set_pending_save(ssid, pass);
  connect_start_ms = millis();
  WiFi.begin(ssid, pass[0] ? pass : NULL);
  wifi_state = STATE_WIFI_CONNECT;
}

static void wifi_state_machine_loop() {
  // 收集 BLE 指令（按行）
  while (BleSerial.available() && ble_cmd_len < BLE_CMD_BUF_SIZE - 1) {
    char c = BleSerial.read();
    if (c == '\n' || c == '\r') {
      if (ble_cmd_len > 0) {
        ble_cmd_buf[ble_cmd_len] = '\0';
        // 解析指令
        if (strstr(ble_cmd_buf, "\"cmd\":\"scan\"") || strstr(ble_cmd_buf, "\"cmd\": \"scan\"")) {
          if (wifi_state == STATE_WAIT_CMD) {
            wifi_state = STATE_WIFI_SCAN;
            WiFi.scanNetworks(true);  // 异步扫描
            ble_send("{\"evt\":\"scanning\"}");
          }
        } else if (strstr(ble_cmd_buf, "\"cmd\":\"connect\"") || strstr(ble_cmd_buf, "\"cmd\": \"connect\"")) {
          char ssid[64] = {0}, pass[64] = {0};
          if (parse_json_str(ble_cmd_buf, "ssid", ssid, sizeof(ssid)) && ssid[0]) {
            parse_json_str(ble_cmd_buf, "password", pass, sizeof(pass));
            if (wifi_state == STATE_WAIT_CMD || wifi_state == STATE_WIFI_CONNECT) {
              WiFi.disconnect();
              delay(100);
              do_connect(ssid, pass);
            }
          } else {
            // 尝试使用 NVS 保存的凭证
            preferences.begin("wifi", true);
            String s = preferences.getString("ssid", "");
            String p = preferences.getString("pass", "");
            preferences.end();
            if (s.length() > 0) {
              do_connect(s.c_str(), p.c_str());
            } else {
              ble_send("{\"evt\":\"connect_result\",\"success\":false,\"reason\":\"missing ssid\"}");
            }
          }
        } else if (strstr(ble_cmd_buf, "\"cmd\":\"status\"")) {
          char buf[128];
          const char* st = "unknown";
          if (wifi_state == STATE_WAIT_CMD) st = "wait_cmd";
          else if (wifi_state == STATE_WIFI_SCAN) st = "scanning";
          else if (wifi_state == STATE_WIFI_CONNECT) st = "connecting";
          else if (wifi_state == STATE_WIFI_CONNECTED) st = "connected";
          snprintf(buf, sizeof(buf), "{\"evt\":\"status\",\"state\":\"%s\",\"wifi\":%s,\"ip\":\"%s\"}",
                   st, WiFi.status() == WL_CONNECTED ? "true" : "false", WiFi.localIP().toString().c_str());
          ble_send(buf);
        }
        ble_cmd_len = 0;
      }
    } else {
      ble_cmd_buf[ble_cmd_len++] = c;
    }
  }
  if (ble_cmd_len >= BLE_CMD_BUF_SIZE - 1) ble_cmd_len = 0;

  // 状态：扫描完成
  if (wifi_state == STATE_WIFI_SCAN) {
    int n = WiFi.scanComplete();
    if (n >= 0) {
      do_scan_and_send();
      WiFi.scanDelete();
    }
  }

  // 状态：连接中
  if (wifi_state == STATE_WIFI_CONNECT) {
    if (WiFi.status() == WL_CONNECTED) {
      wifi_state = STATE_WIFI_CONNECTED;
      char buf[128];
      snprintf(buf, sizeof(buf), "{\"evt\":\"connect_result\",\"success\":true,\"ip\":\"%s\"}",
               WiFi.localIP().toString().c_str());
      ble_send(buf);
      Serial.println("[WiFi] 连接成功: " + WiFi.localIP().toString());
      if (pending_save_ssid[0]) save_wifi_credentials(pending_save_ssid, pending_save_pass);
    } else if (connect_start_ms > 0 && (millis() - connect_start_ms) > WIFI_CONNECT_TIMEOUT_MS) {
      connect_start_ms = 0;
      ble_send("{\"evt\":\"connect_result\",\"success\":false,\"reason\":\"timeout\"}");
      wifi_state = STATE_WAIT_CMD;
      Serial.println("[WiFi] 连接超时");
    }
  }

  // 自动连接：若有 NVS 凭证且尚未尝试
  if (wifi_state == STATE_WAIT_CMD && !auto_connect_tried) {
    preferences.begin("wifi", true);
    String s = preferences.getString("ssid", "");
    String p = preferences.getString("pass", "");
    preferences.end();
    if (s.length() > 0) {
      auto_connect_tried = 1;
      Serial.println("[NVS] 尝试自动连接已保存的 WiFi...");
      do_connect(s.c_str(), p.c_str());
    }
  }
}

bool is_wifi_connected() {
  return WiFi.status() == WL_CONNECTED;
}

void setup() 
{
  pinMode(0, INPUT);  //BUSY
  pinMode(2, OUTPUT); //RES 
  pinMode(1, OUTPUT); //DC   
  pinMode(21, OUTPUT); //CS   
  SPI.begin (SCK_Pin,99,SDI_Pin,99);
  Serial.begin(115200);
  memory_allocation_inital();
  wifi_state_machine_init();
  MQTT_init();
}

void loop() 
{
  wifi_state_machine_loop();

  // 串口命令：b=查看 bw 前 128 字节，r=查看 rw，d=同时查看 bw 和 rw
  if (Serial.available()) {
    char c = Serial.read();
    if (c == 'b' || c == 'B') {
      dump_buf_hex(bw, 0, 128, "bw");
    } else if (c == 'r' || c == 'R') {
      dump_buf_hex(rw, 0, 128, "rw");
    } else if (c == 'd' || c == 'D') {
      dump_buf_hex(bw, 0, 128, "bw");
      dump_buf_hex(rw, 0, 128, "rw");
    }
  }

  // 仅 WiFi 已连接时保持 MQTT
  if (is_wifi_connected()) {
    if (!client.connected()) reconnect();
    client.loop();
  }

  if (receive_over == 1) {
    ShowBitmap();
    receive_over = 0;
    bw_received_end = 0;
    rw_received_end = 0;
  }
}


void ShowBitmap()
{
  //Full screen refresh, fast refresh, and partial refresh demostration.
	EPD_Init(); //Full screen refresh initialization.
	EPD_WhiteScreen_ALL(gImage_BW1,gImage_RW1); //To Display one image using full screen refresh.
	EPD_DeepSleep(); //Enter the sleep mode and please do not delete it, otherwise it will reduce the lifespan of the screen.
}

void MQTT_init()
{
  client.setBufferSize(MQTT_MAX_SIZE);
  // 配置MQTT
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);

  // 设置保持连接
  client.setKeepAlive(60);
}

void Wifi_conected()
{
   WiFi.begin(ssid, password);
    Serial.print(WiFi.status());

    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }

    Serial.println("");
    Serial.println("WiFi connected");
    Serial.println("IP address: ");
    Serial.println(WiFi.localIP());
}

// 跳过空格和可选的一个双引号（兼容 Python json.dumps 的 "key": "value" 格式）
static void skip_spaces_and_quote(const char** p) {
  const char* s = *p;
  while (*s == ' ') s++;
  if (*s == '"') s++;
  *p = s;
}

// MQTT回调：手动解析 JSON，兼容 "type": "bw"（冒号后带空格）及 "data": "[0xFF,0xFF,...]"
void callback(char* topic, byte* payload, unsigned int length) 
{  
  if (length >= JSON_CAPACITY) {
    Serial.printf("消息过长: %u > %d\n", length, JSON_CAPACITY);
    return;
  }

  memcpy(json_buffer, payload, length);
  json_buffer[length] = '\0';

  const char* type_key = strstr(json_buffer, "\"type\":");
  const char* index_key = strstr(json_buffer, "\"index\":");
  const char* data_key = strstr(json_buffer, "\"data\":");

  if (!type_key || !index_key || !data_key) {
    Serial.println("JSON格式错误: 缺少 type/index/data");
    return;
  }

  const char* type_val = type_key + 7;  // 指向冒号后
  skip_spaces_and_quote(&type_val);
  int is_rw = (type_val[0] == 'r' && type_val[1] == 'w');
  int is_bw = (type_val[0] == 'b' && type_val[1] == 'w');
  if (!is_rw && !is_bw) {
    Serial.println("JSON格式错误: type 应为 bw 或 rw");
    return;
  }

  const char* index_val = index_key + 8;
  uint32_t index = (uint32_t)atoi(index_val);

  const char* data = data_key + 8;
  skip_spaces_and_quote(&data);

  // 约定：data 为纯十六进制字符串，每字节 2 个字符，无分隔符，如 "FFFFFFFF..." 表示 1000 字节 0xFF
  uint32_t data_len = (uint32_t)strlen(data);
  if (data_len < 2 || (data_len % 2) != 0) {
    Serial.println("JSON格式错误: data 长度必须为偶数（每字节2个十六进制字符）");
    return;
  }
  uint32_t byte_count = data_len / 2;
  if (byte_count > 1000) byte_count = 1000;  // 单包最多 1000 字节
  CharToHexRaw(data, index, byte_count, is_rw ? rw : bw);

  // 更新已接收末尾下标，用于判断是否全部收齐
  uint32_t end = index + byte_count;
  if (is_rw) {
    if (end > rw_received_end) rw_received_end = end;
  } else {
    if (end > bw_received_end) bw_received_end = end;
  }
  if (bw_received_end >= total_data_size && rw_received_end >= total_data_size) {
    receive_over = 1;
    Serial.println("[DONE] bw + rw 全部接收完毕");
  }

  // 正常接收反馈：串口打印 + 可选 MQTT 发布（便于上位机统计）
  const char* type_str = is_rw ? "rw" : "bw";
  Serial.printf("[OK] 收到 %s[%lu:%lu] %lu 字节\n", type_str, (unsigned long)index, (unsigned long)(index + byte_count), (unsigned long)byte_count);

  static char ack_buf[48];
  int n = snprintf(ack_buf, sizeof(ack_buf), "{\"ack\":\"%s\",\"index\":%lu}", type_str, (unsigned long)index);
  if (n > 0 && (size_t)n < sizeof(ack_buf) && client.connected()) {
    client.publish(topic_pub, (const uint8_t*)ack_buf, (unsigned int)n, false);
  }
}

// 重新连接MQTT
void reconnect() 
{
  while (!client.connected()) {
    Serial.print("尝试连接MQTT服务器...");
    
    if (client.connect(clientId.c_str(), mqtt_user, mqtt_password)) {
      Serial.println("连接成功");
      
      // 订阅主题
      client.subscribe(topic_sub);
      Serial.print("已订阅主题: ");
      Serial.println(topic_sub);
      
      // 发布连接成功消息
      String connectMsg = "ESP32C3已连接，客户端ID: " + clientId;
      client.publish(topic_pub, connectMsg.c_str());
    } else {
      Serial.print("连接失败，rc=");
      Serial.print(client.state());
      Serial.println(" 5秒后重试...");
      delay(5000);
    }
  }
}

// 格式：纯十六进制字符串 "FF00AB..."，每字节 2 个字符，无分隔符（与 Python 发送端约定一致）
void CharToHexRaw(const char *str, uint32_t index, uint32_t byte_count, uint8_t* output)
{
  for (uint32_t i = 0; i < byte_count; i++) {
    uint32_t off = i * 2;
    output[index + i] = (hexf((uint8_t)str[off]) << 4) | hexf((uint8_t)str[off + 1]);
  }
}
uint8_t hexf(uint8_t temp)
{
  uint8_t temp2;
  if(temp >= 'A' && temp <= 'Z'){
    temp += 32;
  }
  switch (temp)
  {
    case '0':temp2 = 0;break;
    case '1':temp2 = 1;break;
    case '2':temp2 = 2;break;
    case '3':temp2 = 3;break;
    case '4':temp2 = 4;break;
    case '5':temp2 = 5;break;
    case '6':temp2 = 6;break;
    case '7':temp2 = 7;break;
    case '8':temp2 = 8;break;
    case '9':temp2 = 9;break;
    case 'a':temp2 = 10;break;
    case 'b':temp2 = 11;break;
    case 'c':temp2 = 12;break;
    case 'd':temp2 = 13;break;
    case 'e':temp2 = 14;break;
    case 'f':temp2 = 15;break;
  }
  return temp2;
}

// 将 bw/rw 指定区间以十六进制打印到串口，便于核对数据是否正确
void dump_buf_hex(const uint8_t* buf, uint32_t start, uint32_t count, const char* name)
{
  if (buf == NULL) {
    Serial.printf("%s: (NULL)\n", name);
    return;
  }
  if (start + count > total_data_size) {
    count = total_data_size - start;
  }
  Serial.printf("--- %s [%lu:%lu] 共 %lu 字节 ---\n", name, (unsigned long)start, (unsigned long)(start + count), (unsigned long)count);
  for (uint32_t i = 0; i < count; i += 16) {
    Serial.printf("%04lx: ", (unsigned long)(start + i));
    for (uint32_t j = 0; j < 16 && (i + j) < count; j++) {
      Serial.printf("%02X ", buf[start + i + j]);
    }
    Serial.println();
  }
  Serial.println("---");
}

void memory_allocation_inital()
{
  // 动态分配内存
    bw = (uint8_t*)malloc(total_data_size * sizeof(uint8_t));
    rw = (uint8_t*)malloc(total_data_size * sizeof(uint8_t));

    for(int i=0;i<total_data_size;i++){
      bw[i] = 0;
      rw[i] = 0;
    }
}