export default defineAppConfig({
  pages: [
    'pages/catalog/index',
    'pages/popular/index',
    'pages/search/index',
    'pages/awards/index',
    'pages/favorites/index',
    'pages/cultivar-detail/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    backgroundColor: '#f5efe6',
    navigationBarBackgroundColor: '#f5efe6',
    navigationBarTitleText: '日本枫树',
    navigationBarTextStyle: 'black'
  },
  tabBar: {
    color: '#6f655b',
    selectedColor: '#8f2f2a',
    backgroundColor: '#fffdf8',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/catalog/index',
        text: '首页',
        iconPath: 'assets/tabbar/home.png',
        selectedIconPath: 'assets/tabbar/home-active.png'
      },
      {
        pagePath: 'pages/popular/index',
        text: '流行',
        iconPath: 'assets/tabbar/popular.png',
        selectedIconPath: 'assets/tabbar/popular-active.png'
      },
      {
        pagePath: 'pages/awards/index',
        text: 'RHS 获奖',
        iconPath: 'assets/tabbar/award.png',
        selectedIconPath: 'assets/tabbar/award-active.png'
      },
      {
        pagePath: 'pages/favorites/index',
        text: '收藏',
        iconPath: 'assets/tabbar/favorite.png',
        selectedIconPath: 'assets/tabbar/favorite-active.png'
      }
    ]
  }
})
