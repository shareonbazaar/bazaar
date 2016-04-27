var async = require('async');

var Transaction = require('../models/Transaction');
var activities = require('../config/activities');
var Enums = require('../models/Enums');
var messageController = require('../controllers/message');


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
        })
        var proposed = transactions.filter(function (t) {
            return t.status === Enums.StatusType.PROPOSED && t._recipient._id.toString() === req.user.id.toString();
        });

        var proposed_ids = proposed.map(function (t) {return t._id.toString()});
        var rest = transactions.filter(function (t) {
            return proposed_ids.indexOf(t._id.toString()) < 0;
        });

        res.render('users/transactions', {
            proposed_transactions: proposed,
            other_transactions: rest,
        });
  });
};

function respondToAjax (res) {
    return function (err) {
        var error = null;
        if (err) {
            error = err;
        }
        res.json({
            error: error,
        });
    }
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
    }, respondToAjax(res));
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
                messageController.addMessageToThread(req.user.id, [trans._sender], req.body.message, callback);
            },
        ], respondToAjax(res));
};

/**
 * POST /transactions
 * Add a transaction for current user
 */
exports.postTransaction = function(req, res) {
    async.waterfall([
        function (callback) {
            var trans = new Transaction({
                amount: req.body.amount,
                timeSent: new Date(),
                service: req.body.service,
                _recipient: req.body.recipient,
                _sender: req.user.id,
                status: Enums.StatusType.PROPOSED,
            });
            trans.save(callback);
        },

        function (t, num, callback) {
            var message = "Hi! I would like to request an exchange of " + activities.getActivityLabelForName(req.body.service);
            messageController.addMessageToThread(req.user.id, [req.body.recipient], message, callback);
        },
    ], respondToAjax(res));
};
