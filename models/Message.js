var mongoose = require('mongoose');

var messageSchema = new mongoose.Schema({
  message: String,
  timeSent: Date,
  _thread: { type: mongoose.Schema.Types.ObjectId, ref: 'Thread' },
  _sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
});

module.exports = mongoose.model('Message', messageSchema);
