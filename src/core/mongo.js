const mongoose = require("mongoose");
require("dotenv").config();

const isMongoDbUrl = JSON.parse(
  process.env.IS_MONGODB_CLOUD_URL ? process.env.IS_MONGODB_CLOUD_URL : "false"
);
const uri = isMongoDbUrl
  ? process.env.MONGODB_CLOUD_URL
  : `mongodb://${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true, 
  useCreateIndex: true,
};
const connectWithDb = async (cb, em) => {
  const connectionResult = mongoose.connect("mongodb+srv://pfverser:ESdI5IrBlyhg0Sdi@cluster0.dmna9pi.mongodb.net/appdb?retryWrites=true&w=majority&appName=Cluster0", options);
  // eslint-disable-next-line no-console
  
  if (cb && em) cb(em);
};
module.exports = connectWithDb;
