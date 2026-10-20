const mongoose = require('mongoose');
const organisationRepo = require('organisation/repositories/organisation.repository');

class organisationController {
    constructor() {
        this.organisation = [];
    }

    /* @Method: create
	// @Description: organisation create
	*/
	async insert (req, res) {
		try {
			if(!req.body.org_name && !req.body.country)
			{
				res.status(201).send({ status: 201, data: {}, message: 'Organisation name and country is required.' });
			}
            else if (!req.body.org_name) {
                res.status(201).send({ status: 201, data: {}, message: 'Organisation name is required.' });
            }  
			else if (!req.body.country) {
                res.status(201).send({ status: 201, data: {}, message: 'country is required.' });
            }
			else {
                let obj = {
                    org_name : req.body.org_name,
                    country : req.body.country
                };
                const isAvailable = await organisationRepo.getByField({'org_name' : req.body.org_name, 'country' : req.body.country, isDeleted : false });
                
                if(_.isEmpty(isAvailable)){
                    const organisation = await organisationRepo.save(obj);
			        if (!_.isEmpty(organisation)) {
				        res.status(200).send({ status: 200, data: organisation, message: 'Organisations added successfully' });
		            }
			       else {
				    res.status(201).send({ status: 201, data: [], message: 'Something went wrong!' });
			      }
                
                }else{
				        res.status(201).send({ status: 201, data: [], message: 'organisation already exist' });

                }
                   
		    }
        }
        catch (error) {
			res.status(500).send({ status: 500, message: error.message });
		}
	};

    /* @Method: list
	 * @Description: organisation list
	*/
	async orgData (req, res) {
		try {
			const org_data = await organisationRepo.getAllByField({isDeleted: false});
			if (!_.isEmpty(org_data)) {
				res.status(200).send({ status: 200, data: org_data, message: 'Organisations data fetched successfully' });
			}
			else {
				res.status(201).send({ status: 201, data: [], message: 'Organisation not available' });
			}
		}
		catch (error) {
			res.status(500).send({ status: 500, message: error.message });
		}
	};

	/**
	 * @method: List organisations 
	 * @param req 
	 * @param res
	 * @description This method returns all organisations with pagination, this api can access only for superAdmin role.
	 */
	async orgDataPagi (req, res) {
		try {
			const org_data = await organisationRepo.getAll(req);
			if (!_.isEmpty(org_data)) {
				res.status(200).send({ status: 200, data: org_data, message: 'Organisation Data fetched successfully' });
			}
			else {
				res.status(201).send({ status: 201, data: [], message: 'Organisation not available' });
			}
		}
		catch (error) {
			res.status(500).send({ status: 500, message: error.message });
		}
	};

	/** 
	 * @Method: details
	 * @Description: organisation details
	*/
	async orgDetails (req, res) {
		try {
			
			if( req.user.org_code._id == req.params.id)
			{
				res.status(201).send({ status: 201, data: [], message: 'Not Valid Id' });
			}
			else{
				const org_data = await organisationRepo.getById(req.params.id);
				if (!_.isEmpty(org_data)) {
					res.status(200).send({ status: 200, data: org_data, message: 'Organisation data fetched successfully' });
				}
				else {
					res.status(201).send({ status: 201, data: [], message: 'Organisation not available' });
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
    async update (req, res) {
	try {
			let orgId = req.params.id;

			let validId = (new  mongoose.Types.ObjectId.isValid(req.params.id));

			if(validId === false)
			{
				res.status(201).send({ status: 201, data: [], message: 'Not Valid Id' });
			}
			else{
				const isExist = await organisationRepo.getById(orgId);

				if (!_.isEmpty(isExist)) {
					
					const org_data = await organisationRepo.updateById(req.body, orgId);

					req.body.orgUpdate = true;

				    let  dataWithPage = await organisationRepo.getAll(req);

					if(!_.isEmpty(org_data)){
					res.status(200).send({ status: 200, data: org_data, dataWithPage:dataWithPage, message: 'Organisation data updated successfully' });
					}else{
					res.status(201).send({ status: 201, data: [], message: 'Something is wrong!' });
					}
				}
				else {
					res.status(201).send({ status: 201, data: [], message: 'Organisation not available' });
				}
			}
		}
		catch (error) {
			res.status(500).send({ status: 500, message: error.message });
		}
	};

	/**
	 * @method : To delete organisation(which will be a soft delete) 
	 * @param req 
	 * @param res 
	 */
	async delete (req, res) {
		try {

			let validId = (new mongoose.Types.ObjectId.isValid(req.body.id));

			if(validId === false)
			{
				res.status(201).send({ status: 201, data: [], message: 'Not valid ID' });
			}
			else
			{
				const organisation = await organisationRepo.updateById({isDeleted : true} , req.body.id , req);

				let orgall = await organisationRepo.getAll(req)


				if (!_.isEmpty(organisation)) {
					res.status(200).send({ status: 200, data: orgall, delData:organisation, message: 'Organisations deleted successfully' });
				}
				else {
				res.status(201).send({ status: 201, data: [], message: 'Something went wrong!' });
				}
			}
			
			
        }
        catch (error) {
			res.status(500).send({ status: 500, message: error.message });
		}
	};
}

module.exports = new organisationController();