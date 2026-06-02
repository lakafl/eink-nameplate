from PIL import Image, ImageFont, ImageDraw

FONT_PATH = "simhei.ttf" 
WIDTH = 640
HEIGHT = 384

def generate():
    unit = HEIGHT // 7
    h1, h3 = unit, unit
    h2 = HEIGHT - h1 - h3

    # GxEPD2 逻辑：我们在屏幕上直接绘图，所以生成透明背景的位图最方便
    # 这里生成三个局部位图
    img1 = Image.new('1', (WIDTH, h1), 1)
    img2 = Image.new('1', (WIDTH, h2), 1)
    img3 = Image.new('1', (WIDTH, h3), 1)

    # 第一行：左对齐黑字
    draw1 = ImageDraw.Draw(img1)
    f1 = ImageFont.truetype(FONT_PATH, int(h1*0.7))
    draw1.text((10, 5), "西南大学", font=f1, fill=0)

    # 第二行：居中白字（背景我们在CPP里画红色的矩形）
    draw2 = ImageDraw.Draw(img2)
    f2 = ImageFont.truetype(FONT_PATH, int(h2*0.6))
    tw2, th2 = draw2.textbbox((0,0), "黄铄恩", font=f2)[2:4]
    draw2.text(((WIDTH-tw2)//2, (h2-th2)//2), "黄铄恩", font=f2, fill=0) # 这里先用0，CPP画时反向

    # 第三行：右对齐黑字
    draw3 = ImageDraw.Draw(img3)
    f3 = ImageFont.truetype(FONT_PATH, int(h3*0.7))
    tw3 = draw3.textbbox((0,0), "学生", font=f3)[2]
    draw3.text((WIDTH-tw3-10, 5), "学生", font=f3, fill=0)

    def to_c(img, name):
        data = []
        for y in range(img.height):
            for x in range(0, img.width, 8):
                byte = 0
                for bit in range(8):
                    if x+bit < img.width:
                        if img.getpixel((x+bit, y)) == 0: # 如果是黑色
                            byte |= (1 << (7-bit))
                data.append(f"0x{byte:02x}")
        return f"const unsigned char {name}[] PROGMEM = {{\n  " + ",".join(data) + "\n};\n"

    with open("data.h", "w", encoding="utf-8") as f:
        f.write(to_c(img1, "bmp_top"))
        f.write(to_c(img2, "bmp_center"))
        f.write(to_c(img3, "bmp_bottom"))

generate()