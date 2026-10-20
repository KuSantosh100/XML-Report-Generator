const appInfoModel = require('app_info/models/app_info.model');
const mongoose = require('mongoose');

const appInfoRepository = {
    getAll: async (req) => {
        try {
            const appInfo = await appInfoModel.find({}).lean().exec();
            return appInfo;
        } catch (error) {
            throw error;
        }
    },
    getByField: async (query) => {
        try {
            const appInfo = await appInfoModel.findOne(query).lean().exec();
            return appInfo;
        } catch (error) {
            throw error;
        }
    },
    create: async (data) => {
        try {
            const appInfo = new appInfoModel(data);
            const savedAppInfo = await appInfo.save();
            return savedAppInfo;
        } catch (error) {
            throw error;
        }
    },
    update: async (id, data) => {
        try {
            const updatedAppInfo = await appInfoModel.findByIdAndUpdate(id, data, { new: true }).lean().exec();
            return updatedAppInfo;
        } catch (error) {
            throw error;
        }
    },
    delete: async (id) => {
        try {
            const deletedAppInfo = await appInfoModel.findByIdAndDelete(id).lean().exec();
            return deletedAppInfo;
        } catch (error) {
            throw error;
        }
    }

};

module.exports = appInfoRepository;