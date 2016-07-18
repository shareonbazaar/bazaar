var async = require('async');

var Transaction = require('../models/Transaction');
var activities = require('../config/activities');
var Enums = require('../models/Enums');
var messageController = require('../controllers/message');
var helpers = require('./helpers');


function dateString (date) {
    return [date.getDate(), date.getMonth() + 1, date.getFullYear()].join('/');
}

/**
 * GET /transactions
 * Show transactions for current user
 */
exports.showTransactions = function(req, res) {
  Transaction.find({$or: [{_sender: req.user.id}, {_recipient: req.user.id}]})
    .populate('_sender')
    .populate('_recipient')
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
        });
  });
};

/**
 * POST /reviews
 * Add a review for a transaction
 */

exports.postReview = function (req, res) {
    Transaction.findOneAndUpdate({_id: req.body.id}, {
        review: {
            text: req.body.review,
            rating: req.body.rating,
        },
    }, helpers.respondToAjax(res));
};

/**
 * GET /confirmExchange
 * Confirm that an exchange happened.
 */
exports.confirmExchange = function (req, res) {
    console.log(req.params.id)
    Transaction.findById(req.params.id, function (err, transaction) {
        if (req.user.id.toString() !== transaction._sender.toString()
            && req.user.id.toString() !== transaction._recipient.toString()) {
            res.json({
                error: "You cannot make updates to a transaction to which you are not party.",
            });
            return;
        }

        var partner_acknowledged_status, me_acknowledged_status;
        if (req.user.id.toString() == transaction._sender.toString()) {
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
    async.waterfall([
            function (callback) {
                Transaction.findOneAndUpdate(
                    {_id: req.body.id},
                    {status: Enums.StatusType.ACCEPTED},
                    callback);
            },

            function (trans, callback) {
                messageController.addMessageToTransaction(req.user.id, [trans._sender], req.body.message, callback);
            },
        ], helpers.respondToAjax(res));
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
                _recipient: req.body.recipient,
                _sender: req.user.id,
                status: Enums.StatusType.PROPOSED,
            });
            trans.save(callback);
        },

        function (t, num, callback) {
            var message = req.body.message;
            if (message) {
              messageController.addMessageToThread(req.user.id, [req.body.recipient], message, callback);
            } else {
              callback(null);
            }
        },
    ], helpers.respondToAjax(res));
};
