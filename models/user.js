var mongoose = require('mongoose'),
    passportLocalMongoose = require('passport-local-mongoose')

var userSchema = new mongoose.Schema({
    username: { type: String, unique: true, required: true },
    password: String,
    imageURL: String,
    imageId: String,
    firstname: String,
    resetPasswordToken: String,
    lastname: String,
    bio: String,
    resetPasswordExpires: Date,
    email: { type: String, unique: true, required: true },
    isAdmin: { type: Boolean, default: false },
    notifications: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Notification'
        }
    ],
    followers: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    ]
})

userSchema.plugin(passportLocalMongoose)

module.exports = mongoose.model('User', userSchema)