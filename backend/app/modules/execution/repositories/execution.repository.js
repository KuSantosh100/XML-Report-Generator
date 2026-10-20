const Execution = require('execution/models/execution.model');
const perPage = config.PAGINATION_PERPAGE;


const ExecutionRepository = {

    delete: async (id) => {
        try {
            let Executions = await Execution.findById(id);
            if (Executions) {
                let ExecutionDelete = await Execution.deleteOne({
                    _id: id
                }).exec();
                return ExecutionDelete;
            } else {
                return null;
            }
        } catch (e) {
            throw (e);
        }
    },
	getAllByFields: async (params) => {
        try {
            let Executions = await Execution.find(params).sort({ 'createdAt' : 'desc'}).exec();
            return Executions;
        } catch (e) {
            throw (e);
        }
    },

    updateById: async (data, id) => {
        try {
            let Executions = await Execution.findByIdAndUpdate(id, data, {
                new: true,
                upsert: true
            }).exec();
            return Executions;
        } catch (e) {
            throw (e);
        }
    },

    getByIdDetail: async (id) => {
        try {
            let Executions = await Execution.findById(id)
            .populate("vault", "_id, vault_name")
            .populate("test_case_id")            
            .exec();
            return Executions;
        } catch (e) {
            throw (e);
        }
    },

    getById: async (id) => {
        try {
            let Executions = await Execution.findById(id)
            .exec();
            return Executions;
        } catch (e) {
            throw (e);
        }
    },

    save: async (data) => {
        try {
            let Executions = await Execution.create(data);
            if (!Executions) {
                return null;
            }
            return Executions;
        } catch (e) {
            throw e;
        }
    },

};

module.exports = ExecutionRepository;