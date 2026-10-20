const { application } = require('express');
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const AppInfoSchema = new Schema({
    application_name: { type: String, default: '' },
    console_version: { type: Number, default: '' },
    test_framework_name: { type: String, default: '' },
    test_framework_version: { type: Number, default: '' }
});


module.exports = mongoose.model('app_info', AppInfoSchema);