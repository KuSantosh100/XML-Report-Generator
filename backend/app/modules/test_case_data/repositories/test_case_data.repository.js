const testData = require('test_case_data/models/test_case_data.model');
const mongoose = require('mongoose');

const TestDataRepository = {
    getCustomerTestKeys: async (params) => {
    //    console.log(params);
        try {
            let TestData = await testData.findOne(params).select({cust_keys: 1, _id:0}).exec();
            return TestData;
        } catch (e) {
            console.log("Exception while retrieving from test_data: "+e);
            throw (e);
        }
    },
    getAdditionalKeys: async (params) => {
        //    console.log(params);
            try {
                let TestData = await testData.findOne(params).select({cust_keys: 0, _id:0}).lean().exec();
                return TestData;
            } catch (e) {
                console.log("Exception while retrieving from test_data: "+e);
                throw (e);
            }
    },
    getByField: async (params) => {
        try {
            let TestData = await testData.findOne(params).exec();
            return TestData;
        } catch (e) {
            throw (e);
        }
    }
};

module.exports = TestDataRepository;
