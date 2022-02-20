import { getServiceEventList, cancelServiceEvent, createServiceEvent } from '../../api_new/service'
import { checkUserInfo, ensureUserInfo } from '../../utils/shuwashuwa'

import Dialog from '../../miniprogram_npm/@vant/weapp/dialog/dialog'
import type { ServiceEvent, ServiceQuery } from '../../models/service'
import { emitErrorToast } from '../../utils/ui';
import { globalStore } from '../../stores/global';
import { ActivityInfo } from '../../models/activity';
import { getActivityList } from '../../api_new/activity';

type MenuOption = { text: string, value: number };

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
        /** 活动查询参数 */
        query: { draft: false, closed: false } as ServiceQuery,
        serviceList: [] as ServiceEvent[],
        serviceListLoading: false,

        /** 活动列表 */
        activityList: [] as ActivityInfo[],
        activityListLoading: false,
        activityOptions: [] as MenuOption[],

        /** 状态列表 */
        statusOptions: [] as MenuOption[],
        statusSelected: -1,

        activeNames: ['1'],
        pageLoading: false,

        addIconSrc: '/res/icons/addOrder.png',

        btnx: wx.getSystemInfoSync().windowWidth * 0.75,
        btny: wx.getSystemInfoSync().windowHeight - 90,
    },

    /** 获取维修单列表 */
    getServiceListAsync: async function () {
        this.setData({
            serviceListLoading: true,
        })
        try {
            console.log('getServiceListAsync', this.data.query)
            const serviceList = await getServiceEventList(this.data.query)
            if (!serviceList) {
                emitErrorToast('获取活动列表失败')
            }
            console.log('service list refreshed', serviceList)
            this.setData({
                serviceList,
            })
        } catch (e: any) {
            emitErrorToast(e)
        } finally {
            this.setData({
                serviceListLoading: false,
            })
        }
    },

    /** 获取活动列表 */
    getActivityListAsync: async function () {
        this.setData({
            activityListLoading: true,
        })
        try {
            const activityList = await getActivityList({});
            console.log('activity list refreshed', activityList)
            if (!activityList) {
                emitErrorToast('获取活动列表失败')
                return
            }
            // reverse sort
            activityList.sort((a, b) => b.id - a.id)  
            // compute menu options
            const activityOptions = activityList.map(activity => ({
                text: activity.activityName,
                value: activity.id,
            }))
            this.setData({
                activityList,
                activityOptions,
            })
        } catch (e: any) {
            emitErrorToast(e)
        } finally {
            this.setData({
                activityListLoading: false,
            })
        }
    },

    /** 更新活动 */
    setActivity: function (event: any) {
        const activityId = event.detail
        console.log('setActivity', activityId)
        const newQuery = Object.assign(this.data.query, { activity: activityId })
        this.setData({
            query: newQuery,
        })
        this.getServiceListAsync()
    },

    /** 更新维修单状态 */
    setStatus: function (event: any) {
        const status = event.detail
        console.log('setStatus', status)

        let newQuery: ServiceQuery = this.data.query;
        if(status === -1){
            const _clone = Object.assign({}, newQuery)
            delete _clone.status
            newQuery = _clone
        } else {
            newQuery = Object.assign(this.data.query, { status: status })
        }
        this.setData({
            query: newQuery,
        })
        this.getServiceListAsync()
    },

    /** 初始化状态选项 */
    initStatusOptions: function () {
        const statusOptions = [
            { text: '全部', value: -1 },
            { text: '待填写', value: 0 },
            { text: '待审核', value: 1 },
            { text: '待签到', value: 2 },
            { text: '待接单', value: 3 },
            { text: '维修中', value: 4 },
            { text: '已完成', value: 5 },
        ]
        this.setData({
            statusOptions,
            statusSelected: -1,
        })
    },

    // 左滑删除
    onClose(event: any) {
        const { position, instance } = event.detail;
        switch (position) {
            case 'left':
            case 'cell':
                instance.close();
                break;
            case 'right':
                Dialog.confirm({
                    title: "取消维修",
                    message: "您确定要取消当前维修吗？此操作不可逆。"
                }).then(async () => {
                    // console.log(res)
                    const serviceEventId = event.currentTarget.dataset.id
                    await cancelServiceEvent(serviceEventId)
                    instance.close()
                    this.getServiceListAsync()
                })
                break;
        }
    },

    mapStatusToIcon: function (status: number) {
        if (status == 0) {
            return '/pages/service-list/rejectedOrder.png'
        }
        if (status == 1) {
            return '/pages/service-list/verifyingOrder.png'
        }
        else {
            return '/pages/service-list/comfirmedOrder.png'
        }
    },

    loadServicebyVal: async function (val) {
        let option = {}
        option.status = val
        option.closed = 'false'
        if (this.data.user) { option.client = app.globalData.userId }
        if (val === 0) {
            option.draft = 'true'
            option.client = app.globalData.userId
        }
        else { option.draft = 'false' }
        // 只是志愿者不是管理员，不能看到别人的维修单
        if ((this.data.volunteer && !this.data.admin) && (val === 4 || val == 5)) {
            option.volunteer = app.globalData.volunteerId
        }
        console.log('[loadservices] val=' + val + ' user=' + this.data.user + ' admin= ' + this.data.admin + ' volunteer=' + this.data.volunteer, option)
        let res = await listServices(option)
        let i = 0
        for (i = 0; i < res.length; i++) {
            let serviceEventId = res[i].serviceEventId
            let r_ = await getService(serviceEventId)
            let problemType = r_.serviceForms[r_.serviceForms.length - 1].problemType
            res[i].problemType = problemType
            if (res[i].status === 0) {
                res[i].iconPath = '/pages/service-list/rejectedOrder.png'
            }
            else if (res[i].status === 1) {
                res[i].iconPath = '/pages/service-list/verifyingOrder.png'
            }
            else {
                res[i].iconPath = '/pages/service-list/comfirmedOrder.png'
            }
        }
        return res
    },

    goToDetail: async function (event: any) {
        this.setData({
            addIconSrc: '/res/icons/addOrderTouched.png'
        })
        wx.vibrateShort({
            type: 'medium',
            success: (res) => { },
        })
        if (!await checkUserInfo()) return;
        let id = event.currentTarget.dataset.id;
        wx.navigateTo({
            url: '/pages/service-detail/service-detail?id=' + id
        })
    },

    /**
     * 生命周期函数--监听页面加载
     */
    onLoad: async function (options: Record<string, string>) {
        this.setData({  // 注意,这里的定义修改了
            addIconSrc: '/res/icons/addOrder.png',
            btnx: wx.getSystemInfoSync().windowWidth * 0.75,
            btny: wx.getSystemInfoSync().windowHeight - 90,
        })
        this.initStatusOptions()
    },

    /**
     * 生命周期函数--监听页面初次渲染完成
     */
    onReady: function () {

    },

    /**
     * 生命周期函数--监听页面显示
     */
    onShow: async function () {
        this.initStatusOptions()

        // 保证用户信息存在
        await ensureUserInfo()
        
        // 读取参数
        const params = globalStore.getAndUnsetTabParams() as ServiceQuery
        console.log('[onShow] params=', params)
        if (params) { // tab参数不为空
            this.setData({
                query: params
            })
        }

        // 获取活动列表
        this.getActivityListAsync()
        // 获取维修单列表
        this.getServiceListAsync()
    
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
        this.getServiceListAsync()
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

    },

    onChangeURL: async function (event) {
        let url = event.currentTarget.dataset.url;
        wx.navigateTo({
            url: url,
        })
    }
})