exports.toObjectId = function (str) {
    var ObjectId = (require('mongoose').Types.ObjectId);
    return new ObjectId(str);
};
