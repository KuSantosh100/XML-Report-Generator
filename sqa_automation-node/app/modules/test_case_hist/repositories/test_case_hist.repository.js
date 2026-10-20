const TestCaseHistRepo = require('test_case_hist/models/test_case_hist.model');
const mongoose = require('mongoose');

const TestCaseHistRepository = {
    getById: async (id) => {
        try {
            let testcases = await TestCaseHistRepo.findById(id).exec();
            return testcases;
        } catch (e) {
            throw (e);
        }
    },
    getByField: async (params) => {
        try {
            let testCases = await TestCaseHistRepo.findOne(params).populate('test_case_id').lean().exec();
            return testCases;
        } catch (e) {
            throw (e);
        }
    },
    save: async (data) => {
        try {
            let testCases = await TestCaseHistRepo.create(data);
            if (!testCases) {
                return null;
            }
            return testCases;
        } catch (e) {
            throw e;
        }
    },

};

module.exports = TestCaseHistRepository;