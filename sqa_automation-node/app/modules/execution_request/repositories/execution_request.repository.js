const ExecutionReqModel = require('execution_request/models/execution_request.model');
const mongoose = require('mongoose');

const ExecutionReqRepository = {
    getByField: async (params) => {
        try {
          let exeReqData = await ExecutionReqModel.find(params).sort({ createdAt: -1 }).lean().exec();
            return exeReqData;
        } catch (error) {
            throw error;
        }
    },
    updateByField: async (filter, data) => {
            try {
                let exeReqData = await ExecutionReqModel.updateOne(filter,{ $set: data } ).exec();
                return exeReqData;
            } catch (e) {
                throw (e);
            }
    },  
    updateById: async (id, data) => {
        try {
            let Executions = await ExecutionReqModel.findByIdAndUpdate(id, data, {
                new: true,
                upsert: true
            }).exec();
            return Executions;
        } catch (e) {
            throw (e);
        }
    },
    save: async (data) => {
        try {
          let exeReqData = await ExecutionReqModel.create(data);
    
          if (!exeReqData) {
            return null;
          }
          return exeReqData;
        } catch (e) {
          console.log(e.message);
          throw e;
        }
    }

};

module.exports = ExecutionReqRepository;