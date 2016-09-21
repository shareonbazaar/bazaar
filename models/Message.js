var mongoose = require('mongoose');

var messageSchema = new mongoose.Schema({
  message: String,
  timeSent: Date,
  _transaction: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
  _sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
});

module.exports = mongoose.model('Message', messageSchema);
