const mongoose = require("mongoose");

const stockSchema = mongoose.Schema({
  name: String,
  ipAddresses: [String],
  likes: Number
})

module.exports = mongoose.model("Stock", stockSchema);