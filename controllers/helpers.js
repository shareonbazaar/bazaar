// Give coordinates a default value if they don't exist
exports.NullInitialization = function (coordinates) {
    if (typeof coordinates === 'undefined' || coordinates.length < 2) {
        return [null, null];
    }
    return coordinates;
}

exports.toObjectId = function (str) {
    var ObjectId = (require('mongoose').Types.ObjectId);
    return new ObjectId(str);
};

exports.respondToAjax = function (res) {
    return function (err, data) {
        var error = null;
        if (err) {
            error = err;
        }
        res.json({
            error: error,
            data: data,
        });
    }
};
