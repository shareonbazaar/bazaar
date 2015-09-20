var _ = require('lodash');
var async = require('async');
var Message = require('../models/Message');
var Thread = require('../models/Thread');
var mongoose = require('mongoose');

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
            var other_participants = thread._participants.filter(function (user) {
                return user._id != current_user_id;
            });
            callback(null, {
                participants: other_participants,
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
            res.render('messages/showMessages', {
                threads: threads_with_messages
            });
        });
  })
};

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