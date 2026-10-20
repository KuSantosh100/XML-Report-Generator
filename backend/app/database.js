const mongoose = require('mongoose');

module.exports = async () => {
  try {
  //  await mongoose.connect('mongodb://' + process.env.DB_URL, {
  //  await mongoose.connect('mongodb://' + process.env.DB_HOST + ':' + process.env.DB_PORT + '/' + process.env.DB_DATABASE, {
 //   await mongoose.connect('mongodb://' + process.env.DB_HOSTS + '/' + process.env.DB_DATABASE + '?replicaSet=' + process.env.DB_REPSET, {
    //   auth: {
    //     username: process.env.DB_USERNAME,
    //     password: process.env.DB_PASSWORD
    //   }
    // });

    const clientOptions = { serverApi: { version: '1', strict: true, deprecationErrors: true } };

    await mongoose.connect(process.env.DB_URL, clientOptions);
    
    console.log('DB connected successfully');
    //mongoose.set('strictQuery', true);
    //mongoose.set('debug', true);
  //mongoose.set('bufferCommands', false);
  } catch (error) {
    console.error(error);
  }
}
