const test_caseRepo = require('test_case/repositories/test_case.repository');
const mongoose = require('mongoose');
const userRepo = require('user/repositories/user.repository');
const test_suiteRepo = require('test_suite/repositories/test_suite.repository');

class test_caseController {
  constructor() { }

  async test_caseDataAdvance (req, res) {
	try {
		let caseData = await test_caseRepo.getAll(req);
		if (caseData) {
			res.status(200).send({ status: 200, data: caseData, message: 'Test Case data fetched successfully' });
		} else {
			res.status(201).send({ status: 201, data: [], message: 'Test Case not available' });
		}
	  } catch (error) {
		res.status(500).send({ status: 500, message: error.message });
	}
};

  /* @Method: create
   * @Description: test_case create
   */
  async insert (req, res) {
	try {
		if (!req.body.test_case_name || !req.body.test_suite_code || !req.body.release_no) {
			res.status(201).send({status: 201, data: {}, message: 'test Case name test_suite_code release_no is required.' });
		} else if( req.user.role.role == "orgAdmin" && JSON.stringify(req.body.org_code) != JSON.stringify(req.user.org_code._id) ){
			res.status(201).send({ status: 201, data: "", message: 'Not authorized' });
		} else {

			let suitData = await test_suiteRepo.getById(new mongoose.Types.ObjectId(req.body.test_suite_code));
			//console.log("---------->"+JSON.stringify(suitData, null, 4));
			if (_.isEmpty(suitData)) {
				return{ status: 201, data: [], message: req.body.test_suite_code + ' test suite does not exists.' };
			}
			let obj = {
				test_case_name : req.body.test_case_name,
				test_suite_code : suitData._id,
				tag_id : req.body.tag_id,
				release_no : req.body.release_no,
				release_date : req.body.release_date,
				requirement_no: req.body.requirement_no,
				description: req.body.description,
				test_case_id: req.body.test_case_id,
				org_code: suitData.org_code
			};
			const test_case = await test_caseRepo.save(obj);
			if (!_.isEmpty(test_case)) {
				res.status(200).send({ status: 200, data: test_case, message: 'Test Case added successfully' });
			}
			else {
				return{ status: 201, data: [], message: 'Something went wrong!' };
			}  
		}
	}
	catch (error) {
		console.log("Exception at test_case.controller.insert "+error);
		res.status(500).send({ status: 500, message: error.message });
	}
};

  /**
   * @Method: Update
   */
  async update (req, res) {
	try {

		if (!mongoose.isValidObjectId(req.params.id)){
			res.status(201).send({ status: 201, data: [], message: 'Not Valid Id' });
		}else{
			const test_case_data = await test_caseRepo.getByField({_id: req.params.id});
			if (!_.isEmpty(test_case_data)) {
				if(req.user.role.role == "orgAdmin" && (JSON.stringify(test_case_data.test_suite_code.org_code) != JSON.stringify(req.user.org_code._id)) ){
					res.status(201).send({ status: 201, data: [], message: 'Not Authorized' });
				}else{
					if (_.has(req.body, 'test_suite_code')) {
						req.body.test_suite_code = new mongoose.Types.ObjectId(req.body.test_suite_code);
					}
					const test_casedata = await test_caseRepo.updateById(req.body, req.params.id);
					req.body.testCaseUpdate = true;
					let dataWithPage = await test_caseRepo.getAll(req);
					if(!_.isEmpty(dataWithPage)){
						res.status(200).send({ status: 200, data: test_casedata, dataWithPage:dataWithPage, message: 'Test Case data updated successfully' });
					}else{
						res.status(201).send({ status: 201, data: [], message: 'Something is wrong!' });
					}
				}
			}else {
				res.status(201).send({ status: 201, data: [], message: 'Test Case not available' });
			}
		}
	}
	catch (error) {
		console.log("Error test_case.controller.update :"+error);
		res.status(500).send({ status: 500, message: error.message });
	}
};

async test_caseDetails(req, res) {
	try {

		if (!mongoose.isValidObjectId(req.params.id)){
			res.status(201).send({ status: 201, data: [], message: 'Not Valid Id' });
		}else{
			const test_case_data = await test_caseRepo.getByField({_id: req.params.id});
			if (!_.isEmpty(test_case_data)) {
				if(req.user.role.role == "orgAdmin" && (JSON.stringify(test_case_data.test_suite_code.org_code) != JSON.stringify(req.user.org_code._id)) ){
					res.status(201).send({ status: 201, data: [], message: 'Not Authorized' });
				}else{
					res.status(200).send({ status: 200, data: test_case_data, message: 'Test Case fetched successfully.' });
				}
			}else{
				res.status(201).send({ status: 201, data: {}, message: 'Test Case not available' });
			}
		}
	}
	catch (error) {
		console.log("Exception at test_case.controller.test_caseDetails"+error);
		res.status(500).send({ status: 500, message: error.message });
	}
};

async delete(req, res) {
	try {

		if (!mongoose.isValidObjectId(req.body.id)){
			res.status(201).send({ status: 201, data: [], message: 'Not Valid Id' });
		}else{
			const test_case_data = await test_caseRepo.getByField({_id: req.body.id});
			if (!_.isEmpty(test_case_data)) {
				if(req.user.role.role == "orgAdmin" && (JSON.stringify(test_case_data.test_suite_code.org_code) != JSON.stringify(req.user.org_code._id)) ){
					res.status(201).send({ status: 201, data: [], message: 'Not Authorized' });
				}else{
					const test_casedata = await test_caseRepo.updateById({isDeleted : true} , req.body.id);
					let dataWithPage = await test_caseRepo.getAll(req);
					if(!_.isEmpty(dataWithPage)){
						res.status(200).send({ status: 200, data: dataWithPage, delData:test_casedata, message: 'Test Case data deleted successfully' });
					}else{
						res.status(201).send({ status: 201, data: [], message: 'Something is wrong!' });
					}
				}
			}else {
				res.status(201).send({ status: 201, data: [], message: 'Test Case not available' });
			}
		}
	  } catch (e) {
		console.log("Error test_case.controller.delete :"+e);
		res.status(500).send({ status: 500, message: e.message });
	  }
};


/**
 * @Method: listOne
 * @param {Description} listOne
 */
	 async listOne (req, res) {
		try {

			let suitData = await test_suiteRepo.getById(new mongoose.Types.ObjectId(req.params.test_suite_code));
			//console.log("---------->"+JSON.stringify(suitData, null, 4));

			if(!_.isEmpty(suitData) && JSON.stringify(suitData.org_code) == JSON.stringify(req.user.org_code._id)){
				let caseData = await test_caseRepo.getAllByField({
					"test_suite_code": new mongoose.Types.ObjectId(req.params.test_suite_code),
					"isDeleted": false,
					"status" : 'Active'
				  });
				  //console.log(caseData)
				  if (caseData) {
					res.status(200).send( { status: 200, data: caseData, "message": "Data fetched successfully." });
				  } else {
					res.status(201).send( { status: 201, data: {}, message: `There are no data at this moment.` });
				  }
			}else{
				res.status(201).send( { status: 201, data: {}, message: `Something went wrong!!!.` });
			}
		  } catch (e) {
			console.log("Error test_case.controller.listOne :"+e);
			res.status(500).send( { status: 500, message: e.message });
		  }
	};




}

module.exports = new test_caseController();