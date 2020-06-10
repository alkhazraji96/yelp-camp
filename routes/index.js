var express = require('express'),
  router = express.Router(),
  passport = require('passport'),
  async = require('async'),
  nodemailer = require('nodemailer'),
  crypto = require('crypto'),
  User = require('../models/user'),
  middleware = require('../middleware/index'),
  Notification = require("../models/notification"),
  Campground = require('../models/campground'),
  multer = require('multer'),
  cloudinary = require('cloudinary')


var storage = multer.diskStorage({
  filename: function (req, file, callback) {
    callback(null, Date.now() + file.originalname);
  }
});
var imageFilter = function (req, file, cb) {
  // accept image files only
  if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
    return cb(new Error('Only image files are allowed!'), false);
  }
  cb(null, true);
};
var upload = multer({ storage: storage, fileFilter: imageFilter })

cloudinary.config({
  cloud_name: 'alkhz',
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});


router.get('/', (req, res) => {
  res.render('landing.ejs')
})

router.get('/register', (req, res) => {
  res.render('register.ejs', { page: 'register' })
})

router.post('/register', upload.single('imageId'), async (req, res) => {
  try {
    let result = await cloudinary.v2.uploader.upload(req.file.path, { folder: process.env.USERIMAGEDIRECTORY })

    var newUser = new User({
      firstname: req.body.firstname,
      lastname: req.body.lastname,
      username: req.body.username,
      email: req.body.email.toLowerCase(),
      bio: req.body.bio,
      imageId: result.public_id,
      imageURL:result.secure_url
  })

    var user = await User.register(newUser, req.body.password)

    passport.authenticate('local')(req, res, () => {
      req.flash('success', 'welcome to YelpCamp ' + user.username + '!')
      res.redirect('/campgrounds')
    })
  } catch (err) {
    req.flash('error', err.message)
    res.redirect('/register')
  }

})


router.get('/login', (req, res) => {
  res.render('login.ejs', { page: 'login' })
})

router.post('/login', (req, res, next) => {
  passport.authenticate('local', {
    successRedirect: '/campgrounds',
    failureRedirect: '/login',
    failureFlash: true,
    successFlash: "Welcome back to YelpCamp " + req.body.username + "!"
  })(req, res)
})

router.get('/logout', (req, res) => {
  req.logout()
  req.flash('success', 'Logged you out')
  res.redirect('/campgrounds')
})

router.get('/forgot', (req, res) => {
  res.render('forgot.ejs')
})

router.post('/forgot', function (req, res, next) {
  async.waterfall([
    function (done) {
      crypto.randomBytes(20, function (err, buf) {
        var token = buf.toString('hex');
        done(err, token);
      });
    },
    function (token, done) {
      User.findOne({ email: req.body.email }, function (err, user) {
        if (!user) {
          req.flash('error', 'No account with that email address exists.');
          return res.redirect('/forgot');
        }

        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

        user.save(function (err) {
          done(err, token, user);
        });
      });
    },
    function (token, user, done) {
      var smtpTransport = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
          user: process.env.GMAILUN,
          pass: process.env.GMAILPW
        }
      });
      var mailOptions = {
        to: user.email,
        from: 'YelpCamp Community',
        subject: 'Node.js Password Reset',
        text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
          'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
          'http://' + req.headers.host + '/reset/' + token + '\n\n' +
          'If you did not request this, please ignore this email and your password will remain unchanged.\n'
      };
      smtpTransport.sendMail(mailOptions, function (err) {
        req.flash('success', 'An e-mail has been sent to ' + user.email + ' with further instructions.');
        done(err, 'done');
      });
    }
  ], function (err) {
    if (err) return next(err);
    res.redirect('/forgot');
  });
});

router.get('/reset/:token', function (req, res) {
  User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function (err, user) {
    if (!user) {
      req.flash('error', 'Password reset token is invalid or has expired.');
      return res.redirect('/forgot');
    }
    res.render('reset.ejs', { token: req.params.token });
  });
});

router.post('/reset/:token', function (req, res) {
  async.waterfall([
    function (done) {
      User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function (err, user) {
        if (!user) {
          req.flash('error', 'Password reset token is invalid or has expired.');
          return res.redirect('back');
        }
        if (req.body.password === req.body.confirm) {
          user.setPassword(req.body.password, function (err) {
            user.resetPasswordToken = undefined;
            user.resetPasswordExpires = undefined;

            user.save(function (err) {
              req.logIn(user, function (err) {
                done(err, user);
              });
            });
          })
        } else {
          req.flash("error", "Passwords do not match.");
          return res.redirect('back');
        }
      });
    },
    function (user, done) {
      var smtpTransport = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
          user: process.env.GMAILUN,
          pass: process.env.GMAILPW
        }
      });
      var mailOptions = {
        to: user.email,
        from: 'YelpCamp Community',
        subject: 'Your password has been changed',
        text: 'Hello,\n\n' +
          'This is a confirmation that the password for your account ' + user.email + ' has just been changed.\n'
      };
      smtpTransport.sendMail(mailOptions, function (err) {
        req.flash('success', 'Success! Your password has been changed.');
        done(err);
      });
    }
  ], function (err) {
    res.redirect('/campgrounds');
  });
});

router.get('/users/:id', (req, res) => {
  User.findById(req.params.id, (err, foundUser) => {
    if (err) {
      req.flash('error', 'Profile not found')
      return res.redirect('/campgrounds')
    }
    Campground.find().where('author.id').equals(foundUser._id).exec((err, campgrounds) => {
      if (err) {
        req.flash('error', 'Profile not found')
        return res.redirect('/')
      }
      res.render('users/show.ejs', { user: foundUser, campgrounds: campgrounds })
    })
  })
})


router.get('/follow/:id', middleware.isLoggedIn, async function (req, res) {
  try {
    let user = await User.findById(req.params.id);
    user.followers.push(req.user._id);
    user.save();
    req.flash('success', 'Successfully followed ' + user.username + '!');
    res.redirect('/users/' + req.params.id);
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('back');
  }
});

router.get('/notifications', middleware.isLoggedIn, async function (req, res) {
  try {
    let user = await User.findById(req.user._id).populate({
      path: 'notifications',
      options: { sort: { "_id": -1 } } // sorting newest first to show
    }).exec();
    let allNotifications = user.notifications;
    res.render('notifications/index.ejs', { allNotifications: allNotifications });
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('back');
  }
});

router.get('/notifications/:id', middleware.isLoggedIn, async function (req, res) {
  try {
    let notification = await Notification.findById(req.params.id);
    notification.isRead = true;
    notification.save();
    res.redirect(`/campgrounds/${notification.campgroundSlug}`);
  } catch (err) {
    req.flash('error', err.message);
    res.redirect('back');
  }
});


module.exports = router

// try and catch with async

// router.put("/:id", upload.single('image'), function(req, res){
//     Campground.findById(req.params.id, async function(err, campground){
//         if(err){
//             req.flash("error", err.message);
//             res.redirect("back");
//         } else {
//             if (req.file) {
//               try {
//                   await cloudinary.v2.uploader.destroy(campground.imageId);
//                   var result = await cloudinary.v2.uploader.upload(req.file.path);
//                   campground.imageId = result.public_id;
//                   campground.image = result.secure_url;
//               } catch(err) {
//                   req.flash("error", err.message);
//                   return res.redirect("back");
//               }
//             }
//             campground.name = req.body.name;
//             campground.description = req.body.description;
//             campground.save();
//             req.flash("success","Successfully Updated!");
//             res.redirect("/campgrounds/" + campground._id);
//         }
//     });
// });