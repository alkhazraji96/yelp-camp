var express = require("express");
var router = express.Router();
var Campground = require("../models/campground");
var Review = require("../models/review");
var middleware = require("../middleware");

// Reviews Index
router.get("/campgrounds/:slug/reviews", function (req, res) {
    Campground.findOne({ slug: req.params.slug }).populate({
        path: "reviews",
        options: { sort: { createdAt: -1 } } // sorting the populated reviews array to show the latest first
    }).exec(function (err, campground) {
        if (err || !campground) {
            req.flash("error", err.message);
            return res.redirect("back");
        }
        res.render("reviews/index.ejs", { campground: campground });
    });
});

// Reviews New
router.get("/campgrounds/:slug/reviews/new", middleware.isLoggedIn, middleware.checkReviewExistence, function (req, res) {
    // middleware.checkReviewExistence checks if a user already reviewed the campground, only one review per user is allowed
    Campground.findOne({ slug: req.params.slug }, function (err, campground) {
        if (err) {
            req.flash("error", err.message);
            return res.redirect("back");
        }
        res.render("reviews/new.ejs", { campground: campground });

    });
});

// Reviews Create
router.post("/campgrounds/:slug/reviews", middleware.isLoggedIn, middleware.checkReviewExistence, async (req, res) => {
    try {
        //lookup campground using ID
        var campground = await Campground.findOne({ slug: req.params.slug }).populate("reviews").exec()

        var newReview = new Review({
            rating: Number(req.body.rating),
            text: req.body.text
        })

        var review = await Review.create(newReview)
        //add author username/id and associated campground to the review
        review.author.id = req.user._id;
        review.author.username = req.user.username;
        review.campground = campground;
        //save review
        await review.save();
        campground.reviews.push(review);
        // calculate the new average review for the campground
        campground.rating = calculateAverage(campground.reviews);
        //save campground
        await campground.save();
        req.flash("success", "Your review has been successfully added.");
        res.redirect('/campgrounds/' + req.params.slug);
    } catch (err) {
        req.flash("error", err.message);
        return res.redirect("back");
    }

});

// Reviews Edit
router.get("/campgrounds/:slug/reviews/:review_id/edit", middleware.checkReviewOwnership, async function (req, res) {

    Review.findById(req.params.review_id, function (err, foundReview) {
        if (err) {
            req.flash("error", err.message);
            return res.redirect("back");
        }
        res.render("reviews/edit.ejs", { campground_slug: req.params.slug, review: foundReview });
    });

});

// Reviews Update
router.put("/campgrounds/:slug/reviews/:review_id", middleware.checkReviewOwnership, function (req, res) {
    var newUpdatedReview = new Object ({
        rating: req.body.rating,
        text: req.body.text
    })

    Review.findByIdAndUpdate(req.params.review_id, newUpdatedReview, { new: true }, function (err, updatedReview) {
        if (err) {
            req.flash("error", err.message);
            return res.redirect("back");
        }
        Campground.findOne({ slug: req.params.slug }).populate("reviews").exec(function (err, campground) {
            if (err) {
                req.flash("error", err.message);
                return res.redirect("back");
            }
            // recalculate campground average
            campground.rating = calculateAverage(campground.reviews);
            //save changes
            campground.save();
            req.flash("success", "Your review was successfully edited.");
            res.redirect('/campgrounds/' + campground.slug);
        });
    });
});


// Reviews Delete
router.delete("/campgrounds/:slug/reviews/:review_id", middleware.checkReviewOwnership, async function (req, res) {

    try {
        await Review.findByIdAndRemove(req.params.review_id)
        var campground = await Campground.findOneAndUpdate({ slug: req.params.slug }, { $pull: { reviews: req.params.review_id } }, { new: true }).populate("reviews").exec()

    } catch (err) {
        req.flash("error", err.message);
        return res.redirect("back");
    }
    // recalculate campground average
    campground.rating = calculateAverage(campground.reviews);
    //save changes
    campground.save();
    req.flash("success", "Your review was deleted successfully.");
    res.redirect("/campgrounds/" + req.params.slug);
});

function calculateAverage(reviews) {
    if (reviews.length === 0) {
        return 0;
    }
    var sum = 0;
    reviews.forEach(function (element) {
        sum += element.rating;
    });
    return sum / reviews.length;
}

module.exports = router;