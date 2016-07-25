var _ = require('lodash');
var async = require('async');
var mongoose = require('mongoose');
var nodemailer = require('nodemailer');
var passportSocketIo = require("passport.socketio");
var fs = require('fs');

var secrets = require('../config/secrets');
var Message = require('../models/Message');
var Thread = require('../models/Thread');
var Transaction = require('../models/Transaction');
var helpers = require('./helpers');

var io;
var socket_map;

exports.initSockets = function (server, store, cookieParser) {
    io = require('socket.io')(server);

    function onAuthorizeSuccess(data, accept){
      console.log('successful connection to socket.io');
      accept();
    }

    function onAuthorizeFail(data, message, error, accept){
      console.log('failed connection to socket.io:', message);
      if(error) {
        accept(new Error(message));
      }
    }

    //With Socket.io >= 1.0
    io.use(passportSocketIo.authorize({
      cookieParser: cookieParser,
      key:          'connect.sid',
      secret:       secrets.sessionSecret,
      store:        store,
      success:      onAuthorizeSuccess,
      fail:         onAuthorizeFail,
    }));

    socket_map = {};

    io.sockets.on('connection', function (socket) {
        socket_map[socket.request.user._id] = socket.id;
        socket.on('send message', function (data) {
            addMessageToTransaction(socket.request.user._id, data.message, data.t_id, function(){});
        });
    });

    io.sockets.on('disconnect', function (socket) {
        delete socket_map[socket.request.user._id];
    });
}

function addMessageToTransaction (sender_id, message_text, transaction_id, add_message_callback) {
    async.waterfall([
        function (callback) {
            var now = new Date();
            var new_msg = new Message({
                message: message_text,
                timeSent: now,
                _transaction: transaction_id,
                _sender: sender_id,
            });
            new_msg.save(callback);
        },

        function (message, num, callback) {
            Transaction.findOne({_id: message._transaction})
            .populate('_participants')
            .exec(function (err, transaction) {
                // Grab the full document of the sender. We need this
                // for sending socket info.
                var sender = transaction._participants.filter(function (user) {
                    return user._id.toString() == message._sender.toString();
                })[0];
                async.each(transaction._participants, function (user, each_user_callback) {
                    var isMe = (sender == user);

                    async.waterfall([
                        function (callback) {
                            // Increment unread message count
                            if (user.unreadThreads.indexOf(transaction.id) < 0) {
                                user.unreadThreads.push(transaction.id);
                            }
                            user.save(callback);
                        },

                        function (user, num, callback) {
                            // if recipient is online, ping him the message via socket.
                            // note we ping everyone - sender and recipients
                            if (socket_map[user._id]) {
                                io.to(socket_map[user._id]).emit('new message', {
                                    message: message.message,
                                    timeSent: message.timeSent,
                                    transaction: transaction,
                                    author: {
                                        name: sender.profile.name,
                                        pic: sender.profile.picture,
                                        id: sender._id,
                                        isMe: isMe,
                                    },
                                });
                            }
                            callback(null);
                        },

                        function (callback) {
                            // always send an e-mail to recipient other than me
                            // even if they are not online
                            if (isMe)
                                callback(null)
                            else
                                sendMessageEmail(sender, user, message.message, callback);
                        }
                    ], function (err, result) {
                        each_user_callback(err)
                    });
                }, callback);
            });
        }
    ], add_message_callback);
};

exports.addMessageToTransaction = addMessageToTransaction;

var email_template = fs.readFileSync('config/message_email.html', 'utf8');

function sendMessageEmail (sender, recipient, message, callback) {
    var transporter = nodemailer.createTransport({
      service: 'Mailgun',
      auth: {
        user: secrets.mailgun.user,
        pass: secrets.mailgun.password,
      },
    });

    var html_content = email_template.replace('{sender}', sender.profile.name);
    html_content = html_content.replace('{profile_pic}', sender.profile.picture);
    html_content = html_content.replace('{recipient}', recipient.profile.name);
    html_content = html_content.replace('{message}', message);

    var mailOptions = {
      to: recipient.email,
      from: 'Bazaar Team <team@shareonbazaar.eu>',
      subject: 'New message from ' + sender.profile.name,
      html: html_content,
    };
    transporter.sendMail(mailOptions, function (err) {
      callback(err);
    });
}

function getThreadMessages (transaction, callback, current_user_id) {
  return Message.find({'_transaction': helpers.toObjectId(transaction._id)})
    .sort('timeSent')
    .populate('_sender')
    .exec(function (err, messages) {
        if (err) {
            callback(err, null);
        } else {
            var sorted_participants = transaction._participants.sort(function (a, b) {
                if (a._id == current_user_id) {
                    return 1;
                }
                if (b._id == current_user_id) {
                    return -1;
                }
                return 0;
            });
            callback(null, {
                participants: sorted_participants,
                messages: messages,
                _id: transaction._id,
            });
        }
    });
}

/**
 * GET /messages
 * Show a user's messages.
 */
exports.showMessages = function(req, res) {
  Thread.find({'_participants': helpers.toObjectId(req.user.id)})
    .populate('_participants')
    .exec(function (err, threads) {
        var func = function (thread, callback) {
            getThreadMessages(thread, callback, req.user.id);
        }
        async.map(threads, func, function (err, threads_with_messages) {
            var sorted_threads = threads_with_messages.sort(function (a, b) {
                                    return b.messages.slice(-1)[0].timeSent - a.messages.slice(-1)[0].timeSent;
                                 });
            res.render('messages/showMessages', {
                threads: sorted_threads,
                user_data: {name: req.user.profile.name, id: req.user._id},
            });
        });
  })
};


/* *
 * Gets messages for a given thread id. Used on the messages page
 * for loading each thread when it is clicked.
*/
exports.getMessages = function(req, res) {
    var transaction_id = req.params.id;
    Message.find({'_transaction': helpers.toObjectId(transaction_id)})
    .sort('timeSent')
    .populate('_sender')
    .exec(function (err, messages) {
        res.json(messages.map(function (message) {
            return {
                message: message.message,
                timeSent: message.timeSent,
                author: {
                    name: message._sender.profile.name,
                    pic: message._sender.profile.picture,
                    id: message._sender._id,
                    isMe: (message._sender._id == req.user.id),
                },
            };
        }));
    });
};

