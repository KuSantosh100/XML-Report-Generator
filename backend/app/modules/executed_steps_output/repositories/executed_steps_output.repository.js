const ExecutionStepsOutputModel = require('executed_steps_output/models/executed_steps_output.model');
const mongoose = require('mongoose');

const TestCaseStepsResultsRepository = {
    getAll: async (req) => {
        try {
            const testCaseSteps = await ExecutionStepsOutputModel.find({}).lean().exec();
            return testCaseSteps;
        } catch (error) {
            throw error;
        }
    },
    getAllByFields: async (query) => {
        try {
            const testCaseSteps = await ExecutionStepsOutputModel.find(query).lean().exec();
            return testCaseSteps;
        } catch (error) {
            throw error;
        }
    },
    getStepsByQueryWithProjection: async (query) => {
      try {
          const testCaseSteps = await ExecutionStepsOutputModel
              .find(query, {
                step_no: 1,
                actual_result: 1,
                status: 1,
                executed_time: 1,
                screenshots: 1,
                _id: 0 
              })
              .lean()
              .exec();
          return testCaseSteps;
      } catch (error) {
          throw error;
      }
    },
    save: async (data) => {
        try {
          let testCaseSteps = await ExecutionStepsOutputModel.create(data);
    
          if (!testCaseSteps) {
            return null;
          }
          return testCaseSteps;
        } catch (e) {
          console.log(e.message);
          throw e;
        }
      }

};

module.exports = TestCaseStepsResultsRepository;