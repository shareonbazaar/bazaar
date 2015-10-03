var Transaction = require('../models/Transaction');
var activities = require('../config/activities');

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
        var data = transactions.map(function (transaction) {
            return {
                partner: transaction._sender._id == req.user.id ? transaction._recipient : transaction._sender,
                date: dateString(transaction.timeSent),
                service: activities.getActivityLabelForName(transaction.service),
                amount: transaction.amount,
            }
        });
        res.render('users/transactions', {
            transactions: data,
            activity_list: activities.getAllActivityLabels(),
        });
  });
};


/**
 * POST /transactions
 * Add a transaction for current user
 */
exports.postTransaction = function(req, res) {
    var trans = new Transaction({
        amount: req.body.amount,
        review: {
            text: req.body.review,
            rating: req.body.rating,
        },
        timeSent: new Date(),
        service: req.body.service,
        _recipient: req.body.recipient,
        _sender: req.user.id,
    });
    trans.save(function (err) {
        var error = null;
        if (err) {
            error = err;
        }
        res.json({
            error: error,
        });
    });
};
