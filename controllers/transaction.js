var async = require('async');

var Transaction = require('../models/Transaction');
var Message = require('../models/Message');
var activities = require('../config/activities');
var Enums = require('../models/Enums');
var messageController = require('../controllers/message');
var helpers = require('./helpers');
var moment = require('moment');


function dateString (date) {
    return [date.getDate(), date.getMonth() + 1, date.getFullYear()].join('/');
}

function getMessagesForTransaction (t_id, user_id, callback) {
    Message.find({'_transaction': t_id})
    .sort('timeSent')
    .populate('_sender')
    .exec(function (err, messages) {
        if (err) {
          callback(err);
        } else {
            callback(null, messages.map(function (message) {
                return {
                    message: message.message,
                    timeSent: message.timeSent,
                    author: {
                        name: message._sender.profile.name,
                        pic: message._sender.profile.picture,
                        id: message._sender._id,
                        isMe: (message._sender._id == user_id),
                    },
                };
            }));
        }
    });
}

exports.getMessages = function (req, res) {
    getMessagesForTransaction(req.params.id, req.user.id, helpers.respondToAjax(res));
}

/**
 * GET /transactions
 * Show transactions for current user
 */
exports.showTransactions = function(req, res) {
  Transaction.find({$or: [{_creator: req.user.id}, {_participants: req.user.id}]})
    .populate('_creator')
    .populate('_participants')
    .exec(function (err, transactions) {
        transactions.forEach(function (t) {
            t.service_label = activities.getActivityLabelForName(t.service);
        });
        var data = transactions.reduce(function (map, t) {
            if (t.status === Enums.StatusType.PROPOSED) {
                map.proposed.push(t);
            } else if (t.status === Enums.StatusType.ACCEPTED) {
                map.upcoming.push(t);
            } else if (t.status === Enums.StatusType.REJECTED) {
              // Don't show rejected exchanges
            } else {
                map.complete.push(t);
            }
            return map;
        }, {
          'proposed': [],
          'upcoming': [],
          'complete': [],
        });

        res.render('users/transactions', {
            transactions: data,
            moment: moment,
        });
  });
};

/**
 * POST /submitReview
 * Add a review for a transaction
 */

exports.submitReview = function (req, res) {
    var review = new Review({
      text: req.body.message,
      rating: req.body.rating,
      _creator: req.user.id,
      timeSent: new Date(),
      _exchange: req.body.t_id,
    });

    review.save(helpers.respondToAjax(res));
};

/**
 * GET /confirmExchange
 * Confirm that an exchange happened.
 */
exports.confirmExchange = function (req, res) {
    // FIXME: Add condition that current user is creator or participant
    Transaction.findById(req.params.id, function (err, transaction) {
        var partner_acknowledged_status, me_acknowledged_status;
        if (req.user.id.toString() == transaction._creator.toString()) {
            partner_acknowledged_status = Enums.StatusType.RECIPIENT_ACK;
            me_acknowledged_status = Enums.StatusType.SENDER_ACK;
        } else {
            partner_acknowledged_status = Enums.StatusType.SENDER_ACK;
            me_acknowledged_status = Enums.StatusType.RECIPIENT_ACK;
        }
        // The bulkWrite approach here ensures that avoid race conditions vis-a-vis
        // the updating of the 'status' field. See http://bit.ly/1pFiOVS
        Transaction.collection.bulkWrite(
            [
               { "updateOne": {
                   "filter": {
                       "_id": helpers.toObjectId(transaction.id),
                       "status": partner_acknowledged_status,
                   },
                   "update": {
                       "$set": { "status": Enums.StatusType.COMPLETE }
                   }
               }},
               { "updateOne": {
                   "filter": {
                       "_id": helpers.toObjectId(transaction.id),
                       "status": Enums.StatusType.ACCEPTED,
                   },
                   "update": {
                       "$set": { "status": me_acknowledged_status }
                   }
               }}
            ],
            { "ordered": false },
            helpers.respondToAjax(res)
        );
    });
};

/**
 * POST /acceptRequest
 * Accept a request for an exchange.
 */
exports.postAccept = function (req, res) {
    // FIXME: Add condition that current user is not creator
    async.waterfall([
            function (callback) {
                Transaction.findOneAndUpdate(
                    {_id: req.body.id},
                    {status: Enums.StatusType.ACCEPTED},
                    callback);
            },

            function (trans, callback) {
                messageController.addMessageToTransaction(req.user.id, req.body.message, trans._id, callback);
            },
        ], helpers.respondToAjax(res));
};

/**
 * POST /rejectRequest
 * Accept a request for an exchange.
 */
exports.rejectRequest = function (req, res) {
    // FIXME: Add condition that current user is not creator
    Transaction.findOneAndUpdate(
      {_id: req.params.id,
        _participants: req.user.id},
      {
        status: Enums.StatusType.REJECTED,
      }, helpers.respondToAjax(res));
};

/**
 * POST /cancelRequest
 * Accept a request for an exchange.
 */
exports.cancelRequest = function (req, res) {
    Transaction.findOneAndUpdate(
      {_id: req.params.id,
        _creator: req.user.id},
      {
        status: Enums.StatusType.CANCELLED,
      }, helpers.respondToAjax(res));
};

/**
 * POST /transactions
 * Add a transaction for current user. This is the initial
 * request so status is PROPOSED.
 */
exports.postTransaction = function (req, res) {
    async.waterfall([
        function (callback) {
            var trans = new Transaction({
                timeSent: new Date(),
                service: req.body.service,
                _participants: [req.body.recipient, req.user.id],
                amount: 1,
                _creator: req.user.id,
                status: Enums.StatusType.PROPOSED,
            });
            trans.save(callback);
        },

        function (t, num, callback) {
            var message = req.body.message;
            if (message) {
              messageController.addMessageToTransaction(req.user.id, message, t._id, callback);
            } else {
              callback(null);
            }
        },
    ], helpers.respondToAjax(res));
};
