var mongoose = require('mongoose');
var User = require('../models/User');
var Enums = require('../models/Enums');

var transactionSchema = new mongoose.Schema({
  amount: Number,
  status: {
    type: String,
    enum: Object.keys(Enums.StatusType).map(function (key) { Enums.StatusType[key] }),
  },
  timeSent: Date,
  service: String,
  request_type: {
    type: String,
    enum: Object.keys(Enums.RequestType).map(function (key) { Enums.RequestType[key] }),
  },
  _participants:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  _creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
});

module.exports = mongoose.model('Transaction', transactionSchema);
