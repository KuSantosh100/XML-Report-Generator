const isProd = process.env.NODE_ENV === 'prod';

module.exports = {
    jwtSecret: "MyS3cr3tK3Y",
    jwtSession: {
        session: false
    },
    PAGINATION_PERPAGE: 10,
    isProd,
    getPort: process.env.PORT || 1534,
    getAdminFolderName: process.env.ADMIN_FOLDER_NAME || 'admin',
    getApiFolderName: process.env.API_FOLDER_NAME || 'api',
    nonSecurePaths: ['/user/login', '/resetpassword', "/validatetoken",  "/user/forgotpassword", "/checkLive"],
}
