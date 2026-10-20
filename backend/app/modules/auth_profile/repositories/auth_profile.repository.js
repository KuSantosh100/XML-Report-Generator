const AuthProfile = require('auth_profile/models/auth_profile.model');

const AuthProfileRepository = {

    getById: async (id) => {
        try {
            let AuthProfiles = await AuthProfile.findById(id).exec();
            return AuthProfiles;
        } catch (e) {
            throw (e);
        }
    },
    getByField: async (params) => {
        try {
            let AuthProfiles = await AuthProfile.findOne(params).lean().exec();
            return AuthProfiles;
        } catch (e) {
            throw (e);
        }
    },

    // updateById: async (data, id) => {
    //     try {
    //         let AuthProfiles = await AuthProfile.findByIdAndUpdate(id, data, {
    //                                         new: true,
    //                                         upsert: true
    //                                     }).exec();
    //         return AuthProfiles;
    //     } catch (e) {
    //         throw (e);
    //     }
    // },

    // getAll: async (req) => {
        
    //     try {
    //         var conditions = {};
    //         var and_clauses = [];

    //         and_clauses.push({
    //             "isDeleted": false
    //         });

    //         if (_.isObject(req.body) && _.has(req.body, 'query')) {
    //             and_clauses.push({
    //                 $or: [
    //                 {
    //                     'org_name': {
    //                         $regex: req.body.query,
    //                         $options: 'i'
    //                     }
    //                 },
    //                 {
    //                     'country': {
    //                     $regex: req.body.query,
    //                     $options: 'i'
    //                     }
    //                 }
    //             ]
    //             });
    //         }

    //         conditions['$and'] = and_clauses;

    //         var sortOperator = {
    //             "$sort": {}
    //         };

    //         if (_.has(req.body, 'sort_field')) {
    //             var sortField = req.body.sort_field;
    //             if (_.has(req.body, 'sort_order')) 
    //             {
    //                 if (req.body.sort_order == 'desc') 
    //                 {
    //                     var sortOrder = -1;
    //                 } else if (req.body.sort_order == 'asc') {
    //                     var sortOrder = 1;
    //                 }
    //             }
    //             else{
    //                 var sortOrder = 1;
    //             }

    //             sortOperator["$sort"][sortField] = sortOrder;
    //             sortOperator["$sort"]["_id"] = sortOrder;
    //         } else {
    //             sortOperator["$sort"]['_id'] = -1;
    //         }

    //         var aggregate = AuthProfile.aggregate([{
    //                 $match: conditions
    //             },
    //             sortOperator
    //         ]);

    //         let options = { page : req.body.page, limit : 5}

    //         let allAuthProfile = await AuthProfile.aggregatePaginate(aggregate, options);
    //         return allAuthProfile;
    //     } catch (e) {
    //         throw (e);
    //     }
    // },

    // getAllByField: async (params) => {
    //     try {
    //         let AuthProfiles = await AuthProfile.find(params).exec();
    //         return AuthProfiles;
    //     } catch (e) {
    //         throw (e);
    //     }
    // },



    // save: async (data) => {
    //     try {
    //         let cat = await AuthProfile.create(data);
    //         if (!cat) {
    //             return null;
    //         }
    //         return cat;
    //     } catch (e) {
    //         throw e;
    //     }
    // },

};

module.exports = AuthProfileRepository;