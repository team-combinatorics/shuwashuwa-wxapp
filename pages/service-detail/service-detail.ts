import { completeServiceEvent, feedbackServiceEvent, getServiceEventCount, getServiceEventDetail, submitServiceEvent, createServiceEvent, saveServiceDraft, getServiceDraft } from '../../api_new/service';
import { getActivityList, getActivityTimeSlots } from '../../api_new/activity'

import { formatDate, formatTime } from '../../utils/date'
import { emitErrorToast } from '../../utils/ui'
import { auditServiceEvent, takeServiceEvent, cancelServiceEvent, returnServiceEvent } from '../../api_new/service'
import { getTemplateIDs, requestSubscription } from '../../api_new/subscription'
import type { ActivityInfo, ActivityQuery, TimeSlot } from '../../models/activity'
import type { ServiceAudit, ServiceComplete, ServiceEventDetail, ServiceFeedback, ServiceForm, ServiceQuery } from '../../models/service'
import { userStore } from '../../stores/user'
import { ensureUserInfo } from '../../utils/shuwashuwa'

import Notify from '../../miniprogram_npm/@vant/weapp/notify/notify'
import Dialog from '../../miniprogram_npm/@vant/weapp/dialog/dialog'
import Toast from '../../miniprogram_npm/@vant/weapp/toast/toast'
import WeValidator from '../../miniprogram_npm/we-validator/index'
import type { WeValidatorInstance, WeValidatorOptions, WeValidatorResult } from '../../models/weValidatorType';
import type { WechatEventType } from '../../models/wechatType';
import { deleteImage, uploadImage } from '../../api_new/file';
import { globalStore } from '../../stores/global';
import { getVolunteerId } from '../../api_new/volunteer';

Page({
    data: {
        // 维修单详情
        draft: true,
        activityId: 0,
        activityName: "",
        boughtTime: "",
        brand: "",
        computerModel: "",
        cpuModel: "",
        graphicsModel: "",
        hasDiscreteGraphics: false,
        imageList: [] as string[],
        laptopType: "",
        problemDescription: "",
        problemType: "",
        serviceEventId: 0,
        timeSlot: 0,
        startTime: "",
        endTime: "",
        underWarranty: true,
        formID: 0,
        status: 0,
        userId: -1,
        volunteerId: -1,

        /** 管理员回复 */
        descriptionAdvice: "",
        problemSummary: "",
        /** 用户反馈 */
        feedback: "",
        /** 志愿者反馈 */
        repairingResult: "",

        serviceLoading: false,
        
        // 活动列表
        activityList: [] as ActivityInfo[],
        activityNames: [] as string[],
        activityShow: false,
        activityLoading: false,

        // 时间段
        timeslotList: [] as TimeSlot[],
        timeslotServiceCount: {} as { [key: number]: number },
        timeslotNames: [] as string[],
        timeslotShow: false,
        timeslotLoading: false,

        // 选择购买年月
        calenderShow: false,
        calenderMinDate: Date.now() - 1000 * 60 * 60 * 24 * 365 * 10, // 十年前
        calenderMaxDate: Date.now(),
        calenderCurrDate: null,
        boughtMonth: "",

        pcTypes: ['二合一/平板', '轻薄本', '游戏本', '台式机', 'Mac'],
        typeShow: false,

        problemTypes: ['软件相关', '硬件相关', '我不清楚'],
        problemShow: false,

        imagesToUpload: [] as Record<string, string | boolean>[],

        /** 维修单权限 */
        disableEdit: true,
        editable: false,
        auditable: false,
        workable: false,
        canUserFeedback: false,
        canVolunteerFeedback: false,

        /** 模板ID */
        tmplIDs: [] as string[],
        templateLoading: false,

        submitLoading: false,

        /** 显示帮助 */
        showHelp: false,
        /** 显示须知 */
        showNotice: false,

        /* 我的志愿者ID */
        myVolunteerId: -1,
    },

    /** 表单验证 */
    serviceValidator: null as null | WeValidatorInstance,
    feedbackValidator: null as null | WeValidatorInstance,
    auditValidator: null as null | WeValidatorInstance,

    /** 创建维修单 */
    createServiceEventAsync: async function () {
        this.setData({ serviceLoading: true })
        try {
            const res = await createServiceEvent()
            if (!res) {
                emitErrorToast('创建维修单失败')
                return
            }
            console.log('createServiceEventAsync', res)
            const lastForm = res.serviceForms[res.serviceForms.length - 1]
            this.setData({
                ...res,
                ...lastForm,
            })
            // 允许编辑
            this.setData({
                disableEdit: false,
                editable: true,
            })
        } catch (e) {
            console.error(e)
        } finally {
            this.setData({ serviceLoading: false })
        }
    },

    /** 获取维修单信息 */
    getServiceEventDetailAsync: async function () {
        this.setData({ serviceLoading: true })
        try {
            /** 从this.data.serviceEventId 读取serviceId */
            const res = await getServiceEventDetail(this.data.serviceEventId)
            if (!res) {
                emitErrorToast('获取维修单信息失败')
                return
            }
            console.log('getServiceEventDetail', res)
            const lastForm = res.serviceForms[res.serviceForms.length - 1]
            this.setData({
                ...res,
                ...lastForm,
            })

            // 处理一些中间变量
            this.setData({
                boughtMonth: this.data.boughtTime ? this.data.boughtTime.split('-').slice(0, 2).join('-') : ''
            })

            // 加载images, 避免填写完成后图片加载两遍
            this.setData({
                imagesToUpload: []
            })
            if (this.data.imageList) {
                for (let imagePath of this.data.imageList) {
                    const { imagesToUpload = [] } = this.data;
                    imagesToUpload.push({
                        name: imagePath,
                        thumb: globalStore.backendUrl + '/img/100_' + imagePath,
                        url: globalStore.backendUrl + '/img/' + imagePath,
                        isImage: true
                    });
                    this.setData({ 
                        imagesToUpload,
                    })
                }
            }
            // 更新按钮状态
            this.updateComponentStates()
        } catch (e) {
            console.error(e)
        } finally {
            this.setData({ serviceLoading: false })
        }
    },

    /** 获取进行中活动 */
    getIncomingActivitiesAsync: async function () {
        this.setData({
            activityLoading: true
        })
        try {
            const query: ActivityQuery = {
                endLower: formatDate(new Date()),
            }
            const res = await getActivityList(query)
            if (!res) {
                emitErrorToast('获取活动列表失败')
                return
            }
            this.setData({
                activityList: res,
            })
        } catch (e) {
            console.error(e)
        } finally {
            this.setData({
                activityLoading: false
            })
        }
    },

    /** 获取活动时间段 */
    getActivityTimeSlotsAsync: async function () {
        this.setData({ timeslotLoading: true })
        try {
            const res = await getActivityTimeSlots(this.data.activityId)
            if (!res) {
                emitErrorToast('获取活动时间段失败')
                return
            }
            this.setData({
                timeslotList: res,
            })
        } catch (e) {
            console.error(e)
        } finally {
            this.setData({ timeslotLoading: false })
        }
    },

    /** 获取活动时间段维修单数 */
    getActivityTimeSlotsServiceCountAsync: async function (timeSlot: number) {
        this.setData({ timeslotLoading: true })
        try {
            const query: ServiceQuery = {
                activity: this.data.activityId,
                timeSlot: timeSlot,
                draft: false,
                closed: false
            }
            const count = await getServiceEventCount(query)
            console.log('getActivityTimeSlotsServiceCount', timeSlot, count)
            this.setData({
                [`timeslotServiceCount.${timeSlot}`]: count,
            })
        } catch (e) {
            emitErrorToast(e)
        } finally {
            this.setData({ timeslotLoading: false })
        }
    },

    /** 获取模板ID */
    getTemplateIdsAsync: async function () {
        this.setData({ templateLoading: true})
        try {
            const res = await getTemplateIDs()
            if (!res) {
                emitErrorToast('获取模板ID失败')
                return
            }
            console.log('getTemplateIds', res)
            this.setData({
                tmplIDs: res
            })
        } catch (e) {
            console.error(e)
        }
        finally {
            this.setData({ templateLoading: false })
        }
    },

    /** 提交维修单 */
    submitServiceAsync: async function () {
        this.setData({ submitLoading: true })
        try {
            // 如果维修单不存在，先创建维修单
            if (this.data.serviceEventId == -1) {
                const newService = await createServiceEvent()
                if (!newService) {
                    emitErrorToast('创建维修单失败')
                    return
                }
                this.setData({
                    serviceEventId: newService.id,
                })
            }
            await submitServiceEvent(this.data as ServiceForm)
            console.log('submitServiceAsync', this.data)
        } catch (e: any) {
            emitErrorToast(e)
        } finally {
            this.setData({ submitLoading: false })
        }
    },

    /** 删除当前维修单 */
    cancelServiceAsync: async function () {
        this.setData({ submitLoading: true })
        try {
            await cancelServiceEvent(this.data.serviceEventId)
        } catch (e: any) {
            emitErrorToast(e)
        } finally {
            this.setData({ submitLoading: false })
        }
    },

    /** 提交审核 */
    auditServiceAsync: async function (result: boolean) {
        this.setData({ submitLoading: true })
        try {
            const audit: ServiceAudit = {
                message: this.data.descriptionAdvice,
                problemSummary: this.data.problemSummary,
                result: result,
                serviceFormId: this.data.formID,
                serviceEventId: this.data.serviceEventId
            }
            console.log(audit)
            await auditServiceEvent(audit)
        } catch (e: any) {
            emitErrorToast(e)
        } finally {
            this.setData({ submitLoading: false })
        }
    },

    /** 志愿者接单 */
    takeServiceAsync: async function () {
        this.setData({ submitLoading: true })
        try {
            await takeServiceEvent(this.data.serviceEventId)
        } catch (e: any) {
            emitErrorToast(e)
        } finally {
            this.setData({ submitLoading: false })
        }
    },

    /** 志愿者退回维修单 */
    returnServiceAsync: async function () {
        this.setData({ submitLoading: true })
        try {
            await returnServiceEvent(this.data.serviceEventId)
        } catch (e: any) {
            emitErrorToast(e)
        } finally {
            this.setData({ submitLoading: false })
        }
    },

    /** (志愿者) 提交反馈 */
    completeServiceAsync: async function () {
        this.setData({
            submitLoading: true
        })
        try {
            const complete: ServiceComplete = {
                message: this.data.repairingResult,
                serviceEventId: this.data.serviceEventId
            }
            await completeServiceEvent(complete)
        } catch (e: any) {
            emitErrorToast(e)
        } finally {
            this.setData({
                submitLoading: false
            })
        }
    },

    /** (用户) 提交反馈 */
    feedbackServiceAsync: async function () {
        this.setData({
            submitLoading: true
        })
        try {
            const complete: ServiceFeedback = {
                message: this.data.feedback,
                serviceEventId: this.data.serviceEventId
            }
            await feedbackServiceEvent(complete)
        } catch (e: any) {
            emitErrorToast(e)
        } finally {
            this.setData({
                submitLoading: false
            })
        }
    },

    /** 更新按钮状态 */
    updateComponentStates: async function () {
        const userId = userStore.user?.userid as number
        const isAdmin = userStore.user?.admin as boolean
        const isVolunteer = userStore.user?.volunteer as boolean

        /* 获取管理员ID */
        if (isVolunteer && this.data.myVolunteerId === -1) {
            try {
                this.setData({
                    myVolunteerId: Number(await getVolunteerId())
                })
            } catch (e) {
                emitErrorToast(e)
            }
        }

        this.setData({
            /** 没有签到前可编辑维修单 */
            editable: (this.data.serviceEventId == -1) || (this.data.userId === userId && [0, 1, 2].includes(this.data.status)),
            /** 管理员可审核非自己发起的维修单 */
            auditable: this.data.status === 1 && isAdmin && this.data.userId != userId,
            /** 志愿者可接单 */
            workable: this.data.status === 3 && isVolunteer,
            /** 草稿维修单默认开启编辑 */
            disableEdit: this.data.status !== 0,
            /** 用户可反馈 */
            canUserFeedback: userStore.user?.userid === this.data.userId && this.data.status === 5,
            /** 志愿者可反馈 */
            canVolunteerFeedback: isVolunteer && this.data.myVolunteerId === this.data.volunteerId && this.data.status === 4
        })
        console.log('updateComponentStates', this.data)
    },


    /** 点击修改按钮 */
    onEditClick: function () {
        this.setData({
            disableEdit: false,
        })
    },

    /** 显示帮助信息 */
    onShowHelpPopup: function () {
        this.setData({
            showHelp: true
        })
    },

    /** 隐藏帮助信息 */
    onHideHelpPopup: function () {
        this.setData({
            showHelp: false
        })
    },

    /** 显示须知 */
    onShowNoticePopup: function () {
        this.setData({
            showNotice: true
        })
    },

    /** 隐藏须知 */
    onHideNoticePopup: async function () {
        this.setData({
            showNotice: false
        })
        // 弹出订阅提示
        await this.getTemplateIdsAsync()
        await requestSubscription(this.data.tmplIDs)
    },

    /** 点击提交按钮 */
    onSubmit: async function () {
        if (!this.serviceValidator?.checkData(this.data)) return;
        // 弹出活动前须知
        if (this.data.editable){
            this.onShowNoticePopup()
        }
        // 提交并加载活动
        await this.submitServiceAsync()
        this.getServiceEventDetailAsync()
        this.setData({
            disableEdit: true,
        })
    },

    /** 点击删除按钮 */
    onCancel: async function () {
        try {
            await Dialog.confirm({
                title: "取消维修",
                message: "当前维修单将无法恢复，您确定要取消维修吗？"
            })
            await this.cancelServiceAsync()
            // 删除后返回上一页
            wx.navigateBack()
        } catch (e) {
            return
        }
    },

    /** 保存编辑中的维修单草稿 */
    onSave: function () {
        // 如果维修单已经提交了，则不能保存草稿
        if (this.data.draft === false) return;
        saveServiceDraft(this.data)
    },

    /** 点击审核通过按钮 */
    onAuditPass: async function () {
        if (!this.auditValidator?.checkData(this.data)) return;
        await this.auditServiceAsync(true)
        Notify({type: 'success', message: '审核成功'})
        this.getServiceEventDetailAsync() // 刷新维修单
    },

    /** 点击审核不通过按钮 */
    onAuditFail: async function () {
        if (!this.auditValidator?.checkData(this.data)) return;
        await this.auditServiceAsync(false)
        Notify({type: 'success', message: '审核成功'})
        this.getServiceEventDetailAsync() // 刷新维修单
    },

    /** 点击接单按钮 */
    onTake: async function () {
        await this.takeServiceAsync()
        this.getServiceEventDetailAsync() // 刷新维修单
    },

    /** 点击退回按钮 */
    onReturn: async function () {
        await this.returnServiceAsync()
        this.getServiceEventDetailAsync() // 刷新维修单
        Notify({ type: 'success', message: '维修单已退回' })
    },

    /** 点击完成维修 */
    onComplete: async function () {
        if(!this.feedbackValidator?.checkData({ message: this.data.repairingResult })) return;
        await this.completeServiceAsync()
        this.getServiceEventDetailAsync() // 刷新维修单
        Notify({ type: 'success', message: '维修单已完成' })
    },

    /** 用户提交反馈 */
    onFeedBack: async function () {
        if(!this.feedbackValidator?.checkData({ message: this.data.repairingResult })) return;
        await this.completeServiceAsync()
        this.getServiceEventDetailAsync() // 刷新维修单
        Notify({ type: 'success', message: '反馈成功' })
    },

    /** 打开活动菜单 */
    activityClick: async function () {
        if (this.data.disableEdit) return // 无法编辑

        this.setData({ activityShow: true })
        await this.getIncomingActivitiesAsync()
        const activityNames = this.data.activityList.map((activity) => activity.activityName)
        this.setData({ activityNames })
    },

    /** 选择活动 */
    activityConfirm: async function (event: WechatEventType) {
        const { picker, value, index } = event.detail;
        this.setData({
            activityName: value,
            activityId: this.data.activityList[index].id,
            activityShow: false
        });
    },

    /** 关闭活动菜单 */
    activityClose: async function () {
        this.setData({ activityShow: false });
    },

    /** 打开时间段菜单 */
    timeslotClick: async function () {
        if (this.data.disableEdit) {
            return
        }
        if (!this.data.activityName) {
            Notify({ type: 'danger', message: '请先选择活动' })
            return
        }

        this.setData({ timeslotShow: true })

        // 加载timeslot 感谢pjy
        await this.getActivityTimeSlotsAsync()
        // 加载timeSlot的维修单数
        for (let item of this.data.timeslotList) {
            await this.getActivityTimeSlotsServiceCountAsync(item.timeSlot)
        }

        const timeslotNames = this.data.timeslotList.map(timeslot => {
            const count = this.data.timeslotServiceCount[timeslot.timeSlot]
            const startMonthTime = timeslot.startTime.substring(5)
            const endMonthTime = timeslot.endTime.substring(5)
            return `${startMonthTime} - ${endMonthTime} (${count}已预约)`
        })

        this.setData({ timeslotNames })
    },

    /** 选择时间段 */
    timeslotConfirm: async function (event: WechatEventType) {
        const { picker, value, index } = event.detail;
        this.setData({
            startTime: this.data.timeslotList[index].startTime,
            endTime: this.data.timeslotList[index].endTime,
            timeSlot: this.data.timeslotList[index].timeSlot,
            timeslotShow: false
        });
    },

    /** 关闭时间段菜单 */
    timeslotClose: async function () {
        this.setData({
            timeslotShow: false
        });
    },

    /** 打开日期选择菜单 */
    calenderClick() {
        if (this.data.disableEdit) {
            return
        }
        this.setData({
            calenderShow: true
        })
        console.log(this.data)
    },

    /** 选择日期 */
    calenderConfirm: function (event: WechatEventType) {
        let currDate = new Date(event.detail)
        // 将currDate做了神奇的处理，输出年月
        this.setData({
            calenderShow: false,
            boughtTime: formatTime(currDate).split(' ')[0],
            boughtMonth: formatTime(currDate).split(' ')[0].split('-').slice(0, 2).join('-')
        });
    },

    /** 关闭日期选择菜单 */
    calenderClose: function () {
        this.setData({
            calenderShow: false
        });
    },

    /** 有无独立显卡 */
    gpuSwitch: function (event: WechatEventType) {
        this.setData({
            hasDiscreteGraphics: Boolean(event.detail),
        })
        if (event.detail) {
            this.setData({
                graphicsModel: '',
            })
        } else {
            this.setData({
                graphicsModel: '没有独立显卡',
            })
        }
    },

    /** 是否在保修期内 */
    warrantySwitch: function (event: WechatEventType) {
        this.setData({
            underWarranty: Boolean(event.detail),
        })
    },

    /** 打开类型菜单 */
    typeClick: function () {
        if (this.data.disableEdit) { return }
        this.setData({ typeShow: true })
    },

    /** 选择笔记本类型 */
    typeConfirm: function (event: WechatEventType) {
        const { picker, value, index } = event.detail;
        this.setData({
            laptopType: value,
            typeShow: false
        })
    },

    /** 关闭类型菜单 */
    typeClose: function () {
        this.setData({
            typeShow: false
        })
    },

    /** 打开问题菜单 */
    problemClick: function () {
        if (this.data.disableEdit) {
            return
        }
        this.setData({
            problemShow: true
        })
    },
    
    /** 选择问题 */
    problemConfirm: function (event: WechatEventType) {
        const { picker, value, index } = event.detail;
        this.setData({
            problemType: value,
            problemShow: false
        })
    },

    /** 关闭问题菜单 */
    problemClose: function () {
        this.setData({
            problemShow: false
        })
    },

    /** 上传图片 */
    uploadConfirm: async function (event: WechatEventType) {
        const imagesChosen = event.detail.file
        if (typeof (imagesChosen) == 'undefined' || !imagesChosen) {
            throw { "errCode": 40000, "errMsg": "[uploadConfirm] event.detail contains no file" }
        }
        for (let image of imagesChosen) {
            let res = await uploadImage(image.url)
            // 更新imagesToUpload
            const { imagesToUpload } = this.data;
            imagesToUpload.push({ ...image, url: globalStore.backendUrl + '/img/' + res });
            this.setData({ imagesToUpload });
            console.log(imagesToUpload)
            // 更新imageList
            const { imageList = [] } = this.data;
            imageList.push(res);
            this.setData({ imageList });
        }
    },

    /** 删除图片 */
    uploadCancel: async function (event: WechatEventType) {
        if (this.data.disableEdit) return;
        const imageToDelete = event.detail.index
        const { imagesToUpload } = this.data;
        imagesToUpload.splice(imageToDelete, 1)
        this.setData({ imagesToUpload });
        // 更新imageList
        const { imageList = [] } = this.data;
        await deleteImage(imageList[imageToDelete])  // 删除图片
        imageList.splice(imageToDelete, 1)
        this.setData({ imageList });
    },

    /** 图片大小超出限制 */
    uploadOversize: function () {
        Notify({ type: 'danger', message: '图片大小超出限制' })
    },

    /** 初始化表单验证 */
    initValidator: function () {
        const showMsgNotify = (data: WeValidatorResult) => {
            console.log('service validator message:', data)
            Notify({ type: 'danger', message: data.msg })
        }

        this.serviceValidator = new WeValidator({
            onMessage: showMsgNotify,
            rules: {
                activityId: { required: true },
                boughtTime: { required: true },
                brand: { required: true, maxlength: 15 },
                computerModel: { required: true, maxlength: 30 },
                cpuModel: { maxlength: 30 },
                hasDiscreteGraphics: { required: true },
                graphicsModel: { maxlength: 30 },
                laptopType: { required: true },
                problemDescription: { required: true, maxlength: 200 },
                problemType: { required: true },
                serviceEventId: { required: true },
                timeSlot: { required: true },
                underWarranty: { required: true },
            },
            messages: {
                activityId: { required: '请选择活动' },
                boughtTime: { required: '请选择购买时间(不用很精确)' },
                brand: { required: '请填写品牌' , maxlength: '品牌不能超过15字'},
                computerModel: { required: '请填写型号' , maxlength: '型号不能超过30字'},
                cpuModel: { maxlength: 'CPU型号不能超过30字'},
                hasDiscreteGraphics: { required: 'Switch状态为null' },
                graphicsModel: { maxlength: '显卡型号不能超过30字'},
                laptopType: { required: '请选择电脑类型' },
                problemDescription: { required: '请填写故障描述' , maxlength: '故障描述不能超过200字'},
                problemType: { required: '请选择故障类型' },
                serviceEventId: { required: 'serviceEventIdError' },
                timeSlot: { required: '请选择时段' },
                underWarranty: { required: 'Switch状态为null' },
            },
        }) as unknown as WeValidatorInstance

        this.auditValidator = new WeValidator({
            onMessage: showMsgNotify,
            rules: {
                descriptionAdvice: { required: true },
                problemSummary: { required: true },
            },
            messages: {
                descriptionAdvice: { required: '请填写审核消息' },
                problemSummary: { required: '请填写故障' },
            },
        }) as unknown as WeValidatorInstance

        this.feedbackValidator = new WeValidator({
            onMessage: showMsgNotify,
            rules: {
                message: { required: true },
            },
            messages: {
                message: { required: '请填写反馈消息' },
            }
        }) as unknown as WeValidatorInstance
    },

    /**
     * 生命周期函数--监听页面加载
     */
    onLoad: async function (options: Record<string, string>) {
        /** 微信神奇的'undefined' */
        if (typeof options !== 'undefined' && typeof options.id !== 'undefined' && options.id !== 'undefined') {
            this.setData({
                serviceEventId: Number(options.id)
            })
        }

        if (this.data.serviceEventId == -1) {
            /** 创建维修单 */
            try {
                const draft = getServiceDraft()
                if (draft) {
                    console.log('draft:', draft)
                    Notify({ type: 'success', message: '使用上次编辑的草稿' })
                    this.setData({
                        ...draft
                    })
                } else {
                    throw { "errCode": 40000, "errMsg": "draft is null" }
                }
            } catch (e) {
                console.log(e)
            }
        } else {
            /** 读取维修单 */
            await this.getServiceEventDetailAsync()
        }
        
        /** 设置维修单权限 */
        ensureUserInfo().then(() => {
            this.updateComponentStates()
        }) 
    },

    /**
     * 生命周期函数--监听页面初次渲染完成
     */
    onReady: function () {
        this.initValidator()
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
        this.onSave()
    },

    /**
     * 生命周期函数--监听页面卸载
     */
    onUnload: function () {
        this.onSave()
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