var express = require('express'),
    router = express.Router(),
    Campground = require('../models/campground'),
    Comment = require('../models/comment'),
    middleware = require('../middleware/index'),
    Notification = require("../models/notification"),
    Review = require("../models/review"),
    User = require('../models/user'),
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


router.get("/campgrounds", function (req, res) {
    var perPage = 8;
    var pageQuery = parseInt(req.query.page);
    var pageNumber = pageQuery ? pageQuery : 1;
    var noMatch = null;
    if (req.query.search) {
        const regex = new RegExp(escapeRegex(req.query.search), 'gi');
        Campground.find({ name: regex }).skip((perPage * pageNumber) - perPage).limit(perPage).exec(function (err, allCampgrounds) {
            Campground.countDocuments({ name: regex }).exec(function (err, count) {
                if (err) {
                    console.log(err);
                    res.redirect("back");
                } else {
                    if (allCampgrounds.length < 1) {
                        noMatch = "No campgrounds match that query, please try again.";
                    }
                    res.render("campgrounds/index.ejs", {
                        campgrounds: allCampgrounds,
                        current: pageNumber,
                        pages: Math.ceil(count / perPage),
                        noMatch: noMatch,
                        search: req.query.search
                    });
                }
            });
        });
    } else {
        // get all campgrounds from DB
        Campground.find({}).skip((perPage * pageNumber) - perPage).limit(perPage).exec(function (err, allCampgrounds) {
            Campground.countDocuments().exec(function (err, count) {
                if (err) {
                    console.log(err);
                } else {
                    res.render("campgrounds/index.ejs", {
                        campgrounds: allCampgrounds,
                        current: pageNumber,
                        pages: Math.ceil(count / perPage),
                        noMatch: noMatch,
                        search: false
                    });
                }
            });
        });
    }
});

router.post('/campgrounds', middleware.isLoggedIn, upload.single('campground[imageId]'), async (req, res) => {
    try {
        let result = await cloudinary.v2.uploader.upload(req.file.path, { folder: process.env.CAMPGROUNDIMAGEDIRECTORY }) //use_filename: true

        req.body.campground.imageURL = result.secure_url
        req.body.campground.imageId = result.public_id
        req.body.campground.author = {
            id: req.user._id,
            username: req.user.username
        }

        let campground = await Campground.create(req.body.campground)
        let user = await User.findById(req.user._id).populate('followers').exec();

        if (user.followers.length != 0) {
            let newNotification = {
                username: req.user.username,
                campgroundSlug: campground.slug
            }

            for (const follower of user.followers) {
                let notification = await Notification.create(newNotification);
                follower.notifications.push(notification);
                follower.save();
            }
        }

        res.redirect(`/campgrounds/${campground.slug}`);

    } catch (err) {
        req.flash('error', err.message);
        res.redirect('back');
    }

})

router.get('/campgrounds/new', middleware.isLoggedIn, (req, res) => {
    res.render('campgrounds/new.ejs')
})

router.get('/campgrounds/:slug', (req, res) => {
    Campground.findOne({ slug: req.params.slug }).populate('comments likes').populate({
        path: "reviews",
        options: { sort: { createdAt: -1 } }
    }).exec((err, foundCampground) => {
        if (err || !foundCampground) {
            req.flash('error', 'Campground not found')
            res.redirect('back')
        } else {
            res.render('campgrounds/show.ejs', { campground: foundCampground })

        }
    })
})

// note: foundCamp.author.id is an object
// req.user._id is a string
// both same id if the logged user own the camp
// to compare them use eqaul to determine if the logged own the camp

router.post("/campgrounds/:slug/like", middleware.isLoggedIn, function (req, res) {
    Campground.findOne({ slug: req.params.slug }, function (err, foundCampground) {
        if (err) {
            req.flash('error', "No Campground found")
            return res.redirect('/campgrounds')
        }

        // check if req.user._id exists in foundCampground.likes
        var foundUserLike = foundCampground.likes.some(function (like) {
            return like.equals(req.user._id);
        });

        if (foundUserLike) {
            // user already liked, removing like
            foundCampground.likes.pull(req.user._id);
        } else {
            // adding the new user like
            foundCampground.likes.push(req.user);
        }

        foundCampground.save(function (err) {
            if (err) {
                req.flash('error', err.message)
                return res.redirect("/campgrounds");
            }
            return res.redirect("/campgrounds/" + foundCampground.slug);
        });
    });
});


router.get('/campgrounds/:slug/edit', middleware.checkCampgroundOwnerShip, (req, res) => {

    Campground.findOne({ slug: req.params.slug }, (err, foundCampground) => {
        if (err) {
            req.flash('error', 'Campground not found')
            return res.redirect('back')
        }

        res.render('campgrounds/edit.ejs', { campground: foundCampground })

    })


})

router.put('/campgrounds/:slug', middleware.checkCampgroundOwnerShip, upload.single('campground[imageId]'), (req, res) => {
    Campground.findOne({ slug: req.params.slug }, async function (err, campground) {
        if (err) {
            req.flash("error", err.message);
            res.redirect("back");
        } else {
            if (req.file) {
                try {
                    await cloudinary.v2.uploader.destroy(campground.imageId);
                    var result = await cloudinary.v2.uploader.upload(req.file.path);
                    campground.imageId = result.public_id;
                    campground.imageURL = result.secure_url;
                } catch (err) {
                    req.flash("error", err.message);
                    return res.redirect("back");
                }
            }
            campground.name = req.body.campground.name;
            campground.price = req.body.campground.price;
            campground.description = req.body.campground.description;
            var updatedCamp = await campground.save();
            req.flash("success", "Successfully Updated!");
            res.redirect("/campgrounds/" + updatedCamp.slug);
        }
    });
})

router.delete('/campgrounds/:slug', middleware.checkCampgroundOwnerShip, async (req, res) => {
    try {
        var campground = await Campground.findOne({ slug: req.params.slug })
        await cloudinary.v2.uploader.destroy(campground.imageId)
        await Comment.deleteMany({ "_id": { $in: campground.comments } })
        await Review.deleteMany({ "_id": { $in: campground.reviews } })
        await campground.deleteOne()
        req.flash('success', 'Campground deleted successfully!');
        res.redirect('/campgrounds');
    } catch (err) {
        if (err) {
            req.flash("error", err.message);
            return res.redirect("back");
        }
    }
})



function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};

module.exports = router

/*
new version by lan to delete comments:
/models/campground.js

const Comment = require('./comment');
campgroundSchema.pre('remove', async function() {
	await Comment.remove({
		_id: {
			$in: this.comments
		}
	});
});

/routes/campgrounds.js

router.delete("/:id",async(req, res) => {
  try {
    let foundCampground = await Campground.findById(req.params.id);
    await foundCampground.remove();
    res.redirect("/campgrounds");
  } catch (error) {
    console.log(error.message);
    res.redirect("/campgrounds");
  }
});
*/
