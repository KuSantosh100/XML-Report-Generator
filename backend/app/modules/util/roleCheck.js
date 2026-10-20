const APIValidation = {

    superAdmin: (req, res, next) =>{
        if(req.user.role.role == "superAdmin"){
            //console.log(req.path+"=============================================>"+JSON.stringify(req.user, null, 4));
            next();
        }else{
        res.status(201).send({ status: 201, data: "", message: 'Not Authorized' });
        }
    },
    validRole: (req, res, next) =>{
        if(req.user.role.role == "superAdmin" || req.user.role.role == "orgAdmin"){
            next();
        }else{
        res.status(201).send({ status: 201, data: "", message: 'Not Authorized.....' });
        }
    },
    orgList: (req, res, next) =>{
        
        if(req.user.role.role == "superAdmin" ){
            next();
        }else{
        res.status(200).send({ status: 200, data: [req.user.org_code], message: 'Organisation data fetched successfully' });
        }
    },
    validOrg: (req, res, next) =>{
        if(req.user.role.role == "superAdmin" ||  req.user.org_code._id == req.path.split('/').pop()){
              next();
        }else{
        res.status(201).send({ status: 201, data: "", message: 'Not matching with user org.' });
        }
    }
}

module.exports = APIValidation;