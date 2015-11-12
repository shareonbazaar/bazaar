document.addEventListener("DOMContentLoaded", function(event) {

    /** Converts numeric degrees to radians */
    if (typeof(Number.prototype.toRad) === "undefined") {
        Number.prototype.toRad = function() {
            return this * Math.PI / 180;
        }
    }

    function distance (lon1, lat1, lon2, lat2) {
        var R = 6371; // Radius of the earth in km
        var dLat = (lat2-lat1).toRad();  // Javascript functions in radians
        var dLon = (lon2-lon1).toRad(); 
        var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1.toRad()) * Math.cos(lat2.toRad()) * 
              Math.sin(dLon/2) * Math.sin(dLon/2); 
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
        var d = R * c; // Distance in km
        return d;
    }

    function getLocation () {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(showPosition);
        } else { 
            console.log("Geolocation is not supported by this browser.");
        }
    }

    function showPosition (position) {
        var data = {
            longitude: position.coords.longitude,
            latitude: position.coords.latitude,
            _csrf: $('#csrf_token').val(),
        };
        $.ajax({
            url: '/location',
            method: 'POST',
            data: data,
        }).done(function (response) {
            console.log(response);
        });

        var users = $('.profile-info .profile-pic')

        $.map(users, function (obj) {
            var user_long = Number($(obj).attr('data-long'));
            var user_lat = Number($(obj).attr('data-lat'));
            var dist = distance(position.coords.longitude, position.coords.latitude,
                user_long, user_lat);
            if (!isNaN(dist)) {
                $(obj).attr('data-original-title', $(obj).attr('data-original-title') + ' (' + Math.round(dist) + 'km)');
            }
        });
    }

    $("#user-search").on('input', function () {
        var query = $("#user-search").val();
        $('.user-list .col-md-4').each(function () {
            var content = $(this).find('.profile-pic').attr('data-content').substr("Skills:".length);
            if (content.toLowerCase().indexOf(query.toLowerCase()) >= 0) {
                $(this).show();
            } else {
                $(this).fadeOut();
            }
        });
    });

    getLocation();
});
