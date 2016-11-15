var mongoose = require('mongoose');
var User = require('../models/User');
var Enums = require('../models/Enums');
const helpers = require('../controllers/helpers');

var transactionSchema = new mongoose.Schema({
  amount: Number,
  status: {
    type: String,
    enum: Object.keys(Enums.StatusType).map(function (key) { Enums.StatusType[key] }),
  },
  service: { type: mongoose.Schema.Types.ObjectId, ref: 'Skill' },
  request_type: {
    type: String,
    enum: Object.keys(Enums.RequestType).map(function (key) { Enums.RequestType[key] }),
  },
  _participants:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  _creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  loc : {
    type: {type: String},
    coordinates: { type: [], index: '2dsphere', get: helpers.NullInitialization }
  },
  placeName: String,
  happenedAt: Date,
}, { timestamps: true });

transactionSchema.index({loc: '2dsphere'});

module.exports = mongoose.model('Transaction', transactionSchema);
