const testData = require('safety_test_data/models/safety_test_data.model');
const mongoose = require('mongoose');

const SafetyTestDataRepository = {
    save: async (data) => {
        try {
          let td = await testData.create(data);
    
          if (!td) {
            return null;
          }
          return td;
        } catch (e) {
          console.log(e.message);
          throw e;
        }
      },

      // updateById: async (data, id) => {
      //   try {
      //     let td = await testData.findByIdAndUpdate(id, data, {
      //       new: true,
      //       upsert: true
      //     }).exec();
    
      //     td.save();
      //     return td;
      //   } catch (e) {
      //     throw e;
      //   }
      // },

      updateByField: async (filter, data) => {
        try {
          let td = await testData.findOneAndUpdate(filter, data, {
                new: true,
                upsert: true
               }).exec();
    
         // td.save();
          return td;
        } catch (e) {
          throw e;
        }
      },

      getById: async (id) => {
        try {
          let Records = await testData.findById(id).exec();
          return Records;
        } catch (e) {
          throw e;
        }
      },

      getRule: async (params) => {
        try {
          let Records = await testData.find(params).exec();
          return Records;
        } catch (e) {
          console.log(e);
          throw e;
        }
      },

      getTestCases: async (params) => {
        try {
          let Records = await testData.aggregate( 
            [
             {"$match" : { rule_set_id : params.rule_set_id , vault_id : params.vault_id } }, 
             {"$group": { "_id": { tag_id: "$tag_id", test_case_name: "$test_case_name" } } },
             {"$project" : {_id:0,  tag_id: "$_id.tag_id", test_case_name: "$_id.test_case_name"}}

            ]
        );
       // console.log("Records "+JSON.stringify(Records, null, 4));
          return Records;
        } catch (e) {
          console.log(e);
          throw e;
        }
      }
};

module.exports = SafetyTestDataRepository;
