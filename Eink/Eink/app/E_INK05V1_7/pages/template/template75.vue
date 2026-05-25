<template>
	<view class="page-container">
		<!-- 顶部区域 -->
		<view class="top-section">
			<text class="app-title">SWU_EPAPER</text>
		</view>
		
		<!-- 模板图片区域 -->
		<view class="template-area">
			<image class="template-image" src="/static/moban75.jpg" mode="aspectFit" @error="onImageError" @click="goToEdit"></image>
		</view>
		
		<!-- 底部返回按钮 -->
		<view class="bottom-button" @click="goToHome">
			<text class="button-text">HOMEpage</text>
		</view>
	</view>
</template>

<script>
	export default {
		data() {
			return {
				
			}
		},
		onLoad() {

		},
		methods: {
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
			goToEdit() {
				uni.navigateTo({
					url: '/pages/edit/edit75',
					success: function(res) {
						('跳转到7.5英寸编辑页面成功');
					},
					fail: function(err) {
						('跳转到7.5英寸编辑页面失败:', err);
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

	/* 模板图片区域样式 */
	.template-area {
		flex: 1;
		padding: 40rpx 30rpx;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.template-image {
		width: 100%;
		max-width: 600rpx;
		height: 400rpx;
		border-radius: 20rpx;
		box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.15);
		background-color: #ffffff;
		object-fit: contain;
		cursor: pointer;
		transition: all 0.3s ease;
	}

	.template-image:active {
		transform: scale(0.98);
		box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.2);
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


