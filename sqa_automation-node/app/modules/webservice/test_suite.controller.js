const test_suiteRepo = require('test_suite/repositories/test_suite.repository');
const projectRepo = require('project/repositories/project.repository');
const userRepo = require('user/repositories/user.repository');

const mongoose = require('mongoose');

class test_suiteController {
	constructor() { }
	//

	async test_suiteList(req, res) {
		try {
			let test_suite_data = await test_suiteRepo.getAll(req);
			if (!_.isEmpty(test_suite_data)) {
				res.status(200).send({ status: 200, data: test_suite_data, message: 'Test_suite data fetched successfully' });
			}
			else {
				res.status(201).send({ status: 201, data: [], message: 'Test_suite not available' });
			}
		}
		catch (error) {
			res.status(500).send({ status: 500, message: error.message });
		}
	};

	async insert(req, res) {
		try {
			if (!req.body.suite_name || !req.body.org_code || !req.body.project_code || !req.body.suite_id) {
				res.status(201).send({
					status: 201,
					data: {},
					message: 'project_code , Test_suite name , org_code, test_suite_id is required.'
				});
			}else if( req.user.role.role == "orgAdmin" && JSON.stringify(req.body.org_code) != JSON.stringify(req.user.org_code._id) ){
				res.status(201).send({ status: 201, data: "", message: 'Not authorized' });
			} 
			else {
				const projectData = await projectRepo.getByField({ _id: new mongoose.Types.ObjectId(req.body.project_code) });
				if (JSON.stringify(projectData.org_code._id) === JSON.stringify(req.body.org_code) ){

					let obj = {
						suite_name: req.body.suite_name,
						org_code: new mongoose.Types.ObjectId(req.body.org_code),
						project_code: new mongoose.Types.ObjectId(req.body.project_code),
						suite_id: req.body.suite_id
					};
					const test_suite = await test_suiteRepo.save(obj);
					if (!_.isEmpty(test_suite)) {
						res.status(200).send({ status: 200, data: test_suite, message: ' Test_suite added successfully' });
					}
					else {
						res.status(201).send({ status: 201, data: [], message: 'Something went wrong!' });
					}					
				}
				else {
					res.status(201).send({ status: 201, data: [], message: 'This project is not exist under this organisation' });
				}

			}
		}
		catch (error) {
			res.status(500).send({ status: 500, message: error.message });
		}
	};

	async delete(req, res) {
		try {

			if (!mongoose.isValidObjectId(req.body.id)){
				res.status(201).send({ status: 201, data: [], message: 'Not Valid Id' });
			}else {
				const t_testSuiteData = await test_suiteRepo.getById(new mongoose.Types.ObjectId(req.body.id));

				if(!_.isEmpty(t_testSuiteData) ) {
					if(req.user.role.role == "orgAdmin" && (JSON.stringify(t_testSuiteData.org_code) != JSON.stringify(req.user.org_code._id))){
						res.status(201).send({ status: 201, data: [], message: 'Not Authorized.' });
					}else {
						const testSuiteData = await test_suiteRepo.updateById({ isDeleted: true }, req.body.id);

						let testSuiteAll = await test_suiteRepo.getAll(req);

						if (!_.isEmpty(testSuiteData)) {
							res.status(200).send({ status: 200, data: testSuiteAll, delData: testSuiteData, message: 'Test suite deleted successfully' });
						} else {
							res.status(201).send({ status: 201, data: [], message: 'Something went wrong!' });
						}
					}
				}else{
					res.status(201).send({ status: 201, data: [], message: 'Something went wrong!' });
				}
			}
		} catch (e) {
			res.status(500).send({ status: 500, message: e.message });
		}
	}

	async test_suiteDetails(req, res) {
		try {

			if (!mongoose.isValidObjectId(req.params.id)){
				res.status(201).send({ status: 201, data: [], message: 'Not Valid Id' });
			}else {
				const t_testSuiteData = await test_suiteRepo.getByFieldNoIcon({_id: new mongoose.Types.ObjectId(req.params.id)});;
				//console.log("getByFieldNoIcon......"+JSON.stringify(t_testSuiteData, null, 4));
				//console.log(JSON.stringify(t_testSuiteData.org_code) +" != "+ JSON.stringify(req.user.org_code._id))

				if(!_.isEmpty(t_testSuiteData) ) {
					if(req.user.role.role == "orgAdmin" && (JSON.stringify(t_testSuiteData.org_code._id) != JSON.stringify(req.user.org_code._id))){
						res.status(201).send({ status: 201, data: [], message: 'Not Authorized.' });
					}else {
						if (!_.isEmpty(t_testSuiteData)) {
							res.status(200).send({ status: 200, data: t_testSuiteData, message: 'Test_suite data fetched successfully' });
						}
						else {
							res.status(201).send({ status: 201, data: [], message: 'Test_suite not available' });
						}
					}
				}else{
					res.status(201).send({ status: 201, data: [], message: 'No data found.' });
				}
			}
		}
		catch (error) {
			res.status(500).send({ status: 500, message: error.message });
		}
	};

	/**
	 * @Method: Update
	 */
	async update(req, res) {
		try {
			if (!mongoose.isValidObjectId(req.params.id)){
				res.status(201).send({ status: 201, data: [], message: 'Not Valid Id' });
			}else{
				let test_suite_data = await test_suiteRepo.getById(new mongoose.Types.ObjectId(req.params.id));
				if (!_.isEmpty(test_suite_data)) {
					if(req.user.role.role == "orgAdmin" && (JSON.stringify(test_suite_data.org_code) != JSON.stringify(req.user.org_code._id)) ){
						res.status(201).send({ status: 201, data: "", message: 'Not authorized' });
					}else{
						if (_.has(req.body, 'org_code')) {
							req.body.org_code = new mongoose.Types.ObjectId(req.body.org_code);
						}
						if (_.has(req.body, 'project_code')) {
							req.body.project_code = new mongoose.Types.ObjectId(req.body.project_code);
						}
						const test_suitedata = await test_suiteRepo.updateById(req.body, new mongoose.Types.ObjectId(req.params.id));
		
						req.body.testSuitUpdate = true;
		
						let dataWithPage = await test_suiteRepo.getAll(req);
						if (!_.isEmpty(test_suitedata)) {
							res.status(200).send({ status: 200, data: test_suitedata, dataWithPage: dataWithPage, message: 'Data updated successfully' });
						} else {
							res.status(201).send({ status: 201, data: [], message: 'Something is wrong!' });
						}
					}
				}else {
					res.status(201).send({ status: 201, data: [], message: 'Test_suite not available' });
				}
			}
		}
		catch (error) {
			res.status(500).send({ status: 500, message: error.message });
		}
	}

	/**
	 *  @Method: list
		 @param {Description} list 
	 */
	async test_suiteData(req, res) {
		try {
			let qry_param = {  "status" : 'Active', "isDeleted" :  false };

			if (req.user.role.role == "orgAdmin") {
				qry_param = { "org_code" :  new mongoose.Types.ObjectId(req.user.org_code._id) ,
								"isDeleted" :  false,
								"status" : 'Active'
							};
			}
	
			const test_suite_data = await test_suiteRepo.getAllByField(qry_param);
			if (!_.isEmpty(test_suite_data)) {
				res.status(200).send({ status: 200, data: test_suite_data, message: 'Test_suite data fetched successfully' });
			}
			else {
				res.status(201).send({ status: 201, data: [], message: 'Test_suite not available' });
			}
		}
		catch (error) {
			res.status(500).send({ status: 500, message: error.message });
		}
	};

	/***
	 *  @Method: listOne
	 * @param {Description} listOne
	 */
	async listOne(req, res) {
		try {
			let suitData = await test_suiteRepo.getByProject({
				"project_code": new mongoose.Types.ObjectId(req.params.project_code),
				"isDeleted": false,
				"status" : 'Active'
			});
			//console.log(JSON.stringify(suitData, null, 4));
			if (!_.isEmpty(suitData) && JSON.stringify(suitData[0].org_code) == JSON.stringify(req.user.org_code._id)) {
				res.status(200).send({ status: 200, data: suitData, message: 'Test_suite cata fetched successfully' });
			} else {
				res.status(201).send({ status: 201, data: [], message: 'There are no data at this moment.' });

			}
		} catch (e) {
			res.status(500).send({ status: 500, message: e.message });
		}
	};

}

module.exports = new test_suiteController();