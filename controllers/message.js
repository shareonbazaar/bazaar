var _ = require('lodash');
var async = require('async');
var Message = require('../models/Message');
var Thread = require('../models/Thread');
var mongoose = require('mongoose');
var nodemailer = require('nodemailer');
var fs = require('fs');
var secrets = require('../config/secrets');


function toObjectId(str) {
    var ObjectId = (require('mongoose').Types.ObjectId);
    return new ObjectId(str);
};

function getThreadMessages (thread, callback, current_user_id) {
  return Message.find({'_thread': toObjectId(thread._id)})
    .populate('_sender')
    .exec(function (err, messages) {
        if (err) {
            callback(err, null);
        } else {
            var sorted_participants = thread._participants.sort(function (a, b) {
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
                _id: thread._id,
            });
        }
    });
}

/**
 * GET /messages
 * Show a user's messages.
 */
exports.showMessages = function(req, res) {
  Thread.find({'_participants': toObjectId(req.user.id)})
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
    var thread_id = req.params.id;
    Message.find({'_thread': toObjectId(thread_id)})
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

var email_template = fs.readFileSync('config/message_email.html', 'utf8');

exports.sendMessageEmail = function (sender, recipient, message, callback) {
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
      from: 'Bazaar Team <mailgun@mg.intrst.de>',
      subject: 'New message from ' + sender.profile.name,
      html: html_content,
    };
    transporter.sendMail(mailOptions, function (err) {
      callback(err);
    });
}
