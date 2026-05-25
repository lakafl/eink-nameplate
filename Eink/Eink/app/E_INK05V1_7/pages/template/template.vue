<template>
	<view class="page-container">
		<!-- 顶部区域 -->
		<view class="top-section">
			<text class="app-title">4.2英寸模板选择</text>
		</view>
		
		<!-- 模板选择区域 -->
		<view class="template-selection-area">
			<view class="template-option" @click="selectTemplate('moban.jpg', '/pages/edit/edit')">
				<view class="preview-wrapper">
					<image class="template-preview" src="/static/moban.jpg" mode="aspectFit"></image>
					<!-- 单位文字叠加 -->
					<view class="unit-text-overlay" :style="{ fontSize: unitOverlayFontSize + 'px', fontFamily: kaitiFont, fontWeight: 'bold' }">单位</view>
					<!-- 姓名文字叠加 -->
					<view class="name-text-overlay" :style="{ fontSize: nameOverlayFontSize + 'px', fontFamily: kaitiFont, fontWeight: 'bold' }">姓名</view>
					<!-- 职务文字叠加 -->
					<view class="position-text-overlay" :style="{ fontSize: positionOverlayFontSize + 'px', fontFamily: kaitiFont, fontWeight: 'bold' }">职务</view>
				</view>
			</view>
			
			<view class="template-option" @click="selectTemplate('moban2.jpg', '/pages/edit/edit2')">
				<view class="preview-wrapper">
					<image class="template-preview" src="/static/moban2.jpg" mode="aspectFit"></image>
					<view class="center-text-overlay" :style="{ fontSize: overlayFontSize + 'px', fontFamily: kaitiFont, fontWeight: 'bold' }">姓名</view>
				</view>
			</view>
			
			<view class="template-option" @click="selectTemplate('moban4.jpg', '/pages/edit/edit4')">
				<view class="preview-wrapper">
					<image class="template-preview" src="/static/moban4.jpg" mode="aspectFit"></image>
					<!-- 单位文字叠加 -->
					<view class="unit-text-overlay" :style="{ fontSize: unitOverlayFontSize + 'px', fontFamily: '楷体, KaiTi, STKaiti, 楷体_GB2312, cursive', fontWeight: 'bold' }">单位</view>
					<!-- 姓名文字叠加 -->
					<view class="name-text-overlay" :style="{ fontSize: nameOverlayFontSize + 'px', fontFamily: '楷体, KaiTi, STKaiti, 楷体_GB2312, cursive', fontWeight: 'bold' }">姓名</view>
					<!-- 职位文字叠加 -->
					<view class="position-text-overlay" :style="{ fontSize: positionOverlayFontSize + 'px', fontFamily: '楷体, KaiTi, STKaiti, 楷体_GB2312, cursive', fontWeight: 'bold' }">职位</view>
				</view>
			</view>
			
			<view class="template-option" @click="selectTemplate('moban3.jpg', '/pages/edit/edit3')">
				<view class="preview-wrapper">
					<image class="template-preview" src="/static/moban3.jpg" mode="aspectFit"></image>
					<!-- 单位文字叠加 -->
					<view class="unit-text-overlay" :style="{ fontSize: unitOverlayFontSize + 'px', fontFamily: kaitiFont, fontWeight: 'bold' }">单位</view>
					<!-- 姓名文字叠加 -->
					<view class="name-text-overlay" :style="{ fontSize: nameOverlayFontSize + 'px', fontFamily: kaitiFont, fontWeight: 'bold' }">姓名</view>
				</view>
			</view>
		</view>
		
		<!-- 底部返回按钮 -->
		<view class="bottom-button" @click="goToHome">
			<text class="button-text">主页</text>
		</view>
	</view>
</template>

<script>
	export default {
		data() {
			return {
			overlayFontSize: 36,
			unitOverlayFontSize: 24,
			nameOverlayFontSize: 36,
			positionOverlayFontSize: 18,
			kaitiFont: 'STKaiti, KaiTi, 楷体, 楷体_GB2312, cursive'
			}
		},
		onLoad() {
		this.computeOverlayFont();
		},
		methods: {
		computeOverlayFont() {
			try {
				const sys = uni.getSystemInfoSync();
				const rpx2px = sys.windowWidth / 750;
				const maxCardWidthPx = 500 * rpx2px; // .template-option max-width
				const pagePaddingPx = 30 * rpx2px;   // 外层左右padding
				const cardPaddingPx = 20 * rpx2px;   // 卡片内padding
				const containerWidthPx = Math.min(maxCardWidthPx, sys.windowWidth - 2 * pagePaddingPx);
				const previewWidthPx = Math.max(0, containerWidthPx - 2 * cardPaddingPx);
				// 编辑页预览宽度≈ windowWidth（等宽于屏幕），编辑页基准字体100px
				const ratio = previewWidthPx > 0 ? (previewWidthPx / sys.windowWidth) : 0;
				
				// 模板2的姓名字体（100px基准）
				this.overlayFontSize = Math.max(12, Math.round(100 * ratio));
				
				// 模板1的字体大小计算
				// 单位字体：40px基准
				this.unitOverlayFontSize = Math.max(8, Math.round(40 * ratio));
				// 姓名字体：100px基准
				this.nameOverlayFontSize = Math.max(12, Math.round(100 * ratio));
				// 职务字体：50px基准
				this.positionOverlayFontSize = Math.max(10, Math.round(50 * ratio));
			} catch (e) {
				this.overlayFontSize = 36;
				this.unitOverlayFontSize = 24;
				this.nameOverlayFontSize = 36;
				this.positionOverlayFontSize = 30;
			}
		},
			goToHome() {
				uni.navigateBack({
					delta: 1,
					success: function(res) {
						('返回主页面成功');
					},
					fail: function(err) {
						('返回主页面失败:', err);
						// 如果返回失败，尝试直接跳转到主页面
						uni.reLaunch({
							url: '/pages/index/index'
						});
					}
				});
			},
			selectTemplate(templateName, editPageUrl) {
				// 保存选择的模板信息
				uni.setStorageSync('selected_template', templateName);
				
				uni.navigateTo({
					url: editPageUrl,
					success: function(res) {
						('跳转到编辑页面成功');
					},
					fail: function(err) {
						('跳转到编辑页面失败:', err);
						uni.showToast({
							title: '页面跳转失败',
							icon: 'none'
						});
					}
				});
			},
			onImageError(e) {
('图片加载失败:', e);
				uni.showToast({
					title: '图片加载失败',
					icon: 'none'
				});
			}
		}
	}
</script>

<style>
	.page-container {
		height: 100vh;
		display: flex;
		flex-direction: column;
		background-color: #f5f5f5;
	}

	/* 顶部区域样式 */
	.top-section {
		height: 15vh;
		background: linear-gradient(135deg, #87CEEB 0%, #B0E0E6 100%);
		border-radius: 0 0 30rpx 30rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.1);
	}

	.app-title {
		font-size: 48rpx;
		font-weight: bold;
		color: #ffffff;
		text-shadow: 0 2rpx 4rpx rgba(0, 0, 0, 0.2);
	}

	/* 模板选择区域样式 */
	.template-selection-area {
		flex: 1;
		padding: 40rpx 30rpx;
		display: flex;
		flex-direction: column;
		gap: 30rpx;
		align-items: center;
		overflow-y: auto;
		background-color: #f5f5f5;
	}

	.template-option {
		width: 100%;
		max-width: 500rpx;
		height: 400rpx;
		background-color: #ffffff;
		border-radius: 20rpx;
		padding: 20rpx;
		box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.15);
		transition: all 0.3s ease;
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.template-option:active {
		transform: scale(0.98);
		box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.2);
	}

	.template-preview {
		width: 100%;
		height: 360rpx;
		border-radius: 12rpx;
		background-color: #f8f9fa;
		object-fit: contain;
	}

.preview-wrapper {
	position: relative;
	width: 100%;
	height: 360rpx;
}

.center-text-overlay {
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
	pointer-events: none;
	user-select: none;
	font-weight: 600;
	color: rgba(255, 255, 255, 0.95);
	text-shadow: 0 2rpx 4rpx rgba(0, 0, 0, 0.35);
	font-size: 36rpx;
	letter-spacing: 2rpx;
}

/* 模板1的文字叠加样式 */
.unit-text-overlay {
	position: absolute;
	top: 10.67%; /* 32px / 300px = 10.67% */
	left: 50%;
	transform: translate(-50%, -50%);
	pointer-events: none;
	user-select: none;
	font-weight: 600;
	color: rgba(0, 0, 0, 0.9); /* 单位文字使用黑色 */
	text-shadow: 0 1rpx 2rpx rgba(255, 255, 255, 0.8);
	letter-spacing: 1rpx;
}

.name-text-overlay {
	position: absolute;
	top: 55%; /* 165px / 300px = 55% */
	left: 50%;
	transform: translate(-50%, -50%);
	pointer-events: none;
	user-select: none;
	font-weight: 600;
	color: rgba(255, 255, 255, 0.95); /* 姓名文字使用白色 */
	text-shadow: 0 2rpx 4rpx rgba(0, 0, 0, 0.35);
	letter-spacing: 2rpx;
}

/* 当前位置的第3项（现在为模板4）的文字叠加样式 */
.template-option:nth-child(3) .unit-text-overlay {
	top: 1%; /* 对应模板4编辑页面的位置 */
	left: 5%; /* 靠左对齐 */
	color: rgba(0, 0, 0, 0.9); /* 模板4单位文字使用黑色 */
	text-shadow: 0 1rpx 2rpx rgba(255, 255, 255, 0.8);
	transform: none; /* 取消居中变换 */
}

.template-option:nth-child(3) .name-text-overlay {
	top: 50%; /* 中心位置 */
	color: rgba(255, 255, 255, 0.95); /* 模板4姓名文字使用白色 */
	text-shadow: 0 2rpx 4rpx rgba(0, 0, 0, 0.35);
}

.template-option:nth-child(3) .position-text-overlay {
	top: 82%; /* 对应模板4编辑页面的位置 */
	right: 1%; /* 靠右对齐 */
	left: auto; /* 取消左定位 */
	color: rgba(0, 0, 0, 0.9); /* 模板4职位文字使用黑色 */
	text-shadow: 0 1rpx 2rpx rgba(255, 255, 255, 0.8);
	transform: none; /* 取消居中变换 */
	text-align: right; /* 文字右对齐 */
}

/* 当前位置的第4项（现在为模板3）的文字叠加样式 */
.template-option:nth-child(4) .unit-text-overlay {
	top: 10%; /* 对应模板3编辑页面的位置 */
	color: rgba(255, 255, 255, 0.95); /* 模板3单位文字使用白色 */
	text-shadow: 0 2rpx 4rpx rgba(0, 0, 0, 0.35);
}

.template-option:nth-child(4) .name-text-overlay {
	top: 60%; /* 对应模板3编辑页面的位置 */
	color: rgba(0, 0, 0, 0.9); /* 模板3姓名文字使用黑色 */
	text-shadow: 0 1rpx 2rpx rgba(255, 255, 255, 0.8);
}

.position-text-overlay {
	position: absolute;
	top: 86.67%; /* 260px / 300px = 86.67% */
	left: 50%;
	transform: translate(-50%, -50%);
	pointer-events: none;
	user-select: none;
	font-weight: bold; /* 职务文字使用粗体 */
	color: rgba(255, 255, 255, 0.95); /* 职务文字使用白色 */
	text-shadow: 0 2rpx 4rpx rgba(0, 0, 0, 0.35);
	letter-spacing: 1rpx;
}

	/* 底部按钮样式 */
	.bottom-button {
		height: 8vh;
		background: linear-gradient(135deg, #87CEEB 0%, #B0E0E6 100%);
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 20rpx 20rpx 0 0;
		box-shadow: 0 -4rpx 12rpx rgba(0, 0, 0, 0.1);
		transition: all 0.3s ease;
	}

	.bottom-button:active {
		background: linear-gradient(135deg, #7BC4E8 0%, #A8D8E6 100%);
		transform: translateY(2rpx);
	}

	.button-text {
		font-size: 36rpx;
		font-weight: 600;
		color: #ffffff;
		text-shadow: 0 2rpx 4rpx rgba(0, 0, 0, 0.2);
	}
</style>

