// FIXME: make these const variables
var async = require('async');

var Transaction = require('../models/Transaction');
var Message = require('../models/Message');
var Review = require('../models/Review');
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

exports.getReviews = function (req, res) {
    Review.find({'_transaction': req.params.id})
    .populate('_creator')
    .exec(function (err, reviews) {
        if (err) {
            res.json({error: err});
            return;
        }
        var curr_user_review = reviews.find((review) => review._creator._id == req.user.id);
        // If there is a review that is not ours, it must be another review about us
        var other_review = reviews.find((review) => review._creator._id != req.user.id);
        if (!curr_user_review) {
            res.json({curr_user_has_review: false});
            return;
        } else if (!other_review) {
            res.json({partner_has_review: false});
            return;
        } else {
            res.json({
                review: {
                    author: {
                        name: other_review._creator.profile.name,
                        picture: other_review._creator.profile.picture,
                        id: other_review._creator._id,
                    },
                    text: other_review.text,
                    rating: other_review.rating,
                    timestamp: moment(other_review.timeSent).startOf('day').fromNow(),
                }
            });
        }
    });
}

/**
 * GET /transactions
 * Show transactions for current user
 */
exports.showTransactions = function(req, res) {
  Transaction.find({$or: [{_creator: req.user.id}, {_participants: req.user.id}]})
    .sort('-timeSent')
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
            title: 'My Transactions',
            transactions: data,
            moment: moment,
            StatusType: Enums.StatusType,
        });
  });
};

/**
 * POST /submitReview
 * Add a review for a transaction
 */
exports.submitReview = function (req, res) {
    // FIXME: Add subject?
    var review = new Review({
        timeSent: new Date(),
        text: req.body.message,
        rating: req.body.rating,
        _transaction: req.body.t_id,
        _creator: req.user.id,
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
            function (err, data) {
                Transaction.findById(req.params.id, function (err, transaction) {
                    res.json({
                        status: transaction.status,
                    });
                });
            }
        );
    });
};

/**
 * POST /acceptRequest
 * Accept a request for an exchange.
 */
exports.postAccept = function (req, res) {
    // FIXME: Add condition that current user is not creator
    Transaction.findOneAndUpdate(
        {_id: req.body.id},
        {status: Enums.StatusType.ACCEPTED},
        {new: true},
        function (err, trans) {
            if (req.body.message) {
                messageController.addMessageToTransaction(req.user.id, req.body.message, trans._id, req, function () {});
            }
            res.json({
                id: trans._id,
                status: trans.status,
            });
        }
    );
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
                request_type: req.body.request_type,
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
              messageController.addMessageToTransaction(req.user.id, message, t._id, req, callback);
            } else {
              callback(null);
            }
        },
    ], helpers.respondToAjax(res));
};
