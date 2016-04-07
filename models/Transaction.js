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
  review: {
      text: { type: String, default: '' },
      rating: Number,
  },
  service: String,
  _recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  _sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
});

module.exports = mongoose.model('Transaction', transactionSchema);
