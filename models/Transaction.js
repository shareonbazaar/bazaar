var mongoose = require('mongoose');
var User = require('../models/User');

var transactionSchema = new mongoose.Schema({
  amount: Number,
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

transactionSchema.post('save', function (transaction) {
    User.findById(transaction._sender, function (err, user) {
        user.coins -= transaction.amount;
        user.save();
    });
    User.findById(transaction._recipient, function (err, user) {
        user.coins += transaction.amount;
        user.save();
    });
});