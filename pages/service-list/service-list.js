import {listServices, cancelService, workService} from '../../api/service'
import {getCurrentActivities} from '../../api/activity'
import {getUserInfo} from '../../api/user'

const app = getApp()

Page({

  /**
   * 0 待编辑 self user
   * 1 待审核 all admin
   * 2 未签到 all admin
   * 3 待接单 all volunteer
   * 4 维修中 self volunteer
   * 5 已完成 all user
   * 6 活动中 all user
   */
  data: {
    menuValue: 0,
    menuOptions: [],
    serviceList: [],

    user: false,
    admin: false,
    volunteer: false
  },

  initMenu: function (){
    if(this.data.admin){  // 是管理员
      this.setData({
        menuValue: 1,
        menuOptions: [
          { text: '待编辑', value: 0 },
          { text: '待审核', value: 1 },
          { text: '未签到', value: 2 },
          { text: '待接单', value: 3 },
          { text: '维修中', value: 4 },
          { text: '已完成', value: 5 },
          { text: '活动中', value: 6 },
        ]
      })
    }else if(this.data.volunteer){  // 是志愿者
      this.setData({
        menuValue: 3,
        menuOptions: [
          { text: '待编辑', value: 0 },
          { text: '待接单', value: 3 },
          { text: '维修中', value: 4 },
          { text: '已完成', value: 5 },
          { text: '活动中', value: 6 },
        ]
      })
    }else{  // 是普通用户
      this.setData({
        menuValue: 6,
        menuOptions: [
          { text: '待编辑', value: 0 },
          { text: '活动中', value: 6 },
          { text: '已完成', value: 5 },
        ]
      })
    }
  },

  // 根据menuValue和用户权限把serviceList拼出来
  // 对于相同的menuValue, 用户权限不同看到的东西也是不一样的
  loadServices: async function(){
    let val = this.data.menuValue
    
    // 一个options就够
    if (0 <= val <= 5){
      let option = {}
      option.status = val
      option.closed = false
      if(this.data.user) {option.client = app.globalData.userId}
      if(val==0) {
        option.draft = true
        option.client = app.globalData.userId
      }
      else {option.draft = false}
      if(this.data.volunteer && val==3) {option.volunteer = app.globalData.userId}
      console.log('[loadservices] val=' + val + ' user='+ this.data.user + ' admin= ' + this.data.admin + ' volunteer=' + this.data.volunteer, option)
      let res = await listServices(option)
      console.log(res)
      this.setData({
        serviceList: res
      })
    }else if (val==6) {  // 活动中维修单需要多次请求

    }

  },

  goToDetail(event) {
    let id = event.currentTarget.dataset.id;
    wx.navigateTo({
      url: '/pages/service-detail/service-detail?id=' + id
    })
  },
  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: async function (options) {
    if(!app.globalData.userInfo){  // 避免userInfo不存在
      await getUserInfo()
    }
    this.setData({
      user: !app.globalData.userInfo.admin && !app.globalData.userInfo.volunteer,
      volunteer: !app.globalData.userInfo.admin && app.globalData.userInfo.volunteer,
      admin: app.globalData.userInfo.admin
    })
    this.initMenu()
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady: function () {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function () {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh: function () {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom: function () {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function () {

  }
})