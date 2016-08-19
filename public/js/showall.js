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
                $(obj).attr('data-content', Math.round(dist) + 'km away');
            }
        });
    }

    $('.grid').on('click', '.bookmark', function () {
        var image_uri = $(this).attr('src');
        if (image_uri.endsWith('inactive.svg')) {
            $(this).attr('src', '/images/bookmark_active.svg');
        } else {
            $(this).attr('src', '/images/bookmark_inactive.svg');
        }
        $.ajax({
            url: '/bookmark/' + $(this).attr('data-user-id'),
        }).done(function (response) {
            console.log(response);
        });
    });

    $('.search-box').click(function () {
        $('.filter-options').addClass('open');
    });

    $('body > .container-fluid').click(function () {
        $('.filter-options').removeClass('open');
    });

    $('.filter-options').click(function (event) {
        event.stopPropagation();
    });

    var distance_slider = $('#distance-slider').bootstrapSlider({
        formatter: function(value) {
            return (2 * value) + ' km';
        }
    });
    $('.filter-button').click(function () {
        $('.filter-options').removeClass('open');
        var skill_names = $.map($('.category-filter .skill-select .selected'), function (obj) {
            return $(obj).attr('name');
        });
        if (skill_names.length == 0) {
            var free_search_text = $('.search-box').val();
            skill_names = [free_search_text];
        }
        $.ajax({
            url: '/users/search',
            data: {
                service_type: '',
                distance: distance_slider.bootstrapSlider('getValue') * 2, // Distance in km in which to search
                skills: skill_names,
            },
        }).done(function (response) {
            $('.grid').masonry('remove', $('.grid').masonry('getItemElements'));
            // FIXME: don't know why masonry doesnt let me pass array to 'appended'
            // as suggested in docs. If we do 'appeneded' for each one, we get
            // different animation and might be slower?
            response.forEach(function (html) {
                var content = $(html);
                $('.grid').masonry().append(content).masonry('addItems', content);
            });
            $('.grid').masonry('layout');
        });
    });

    var previousScroll = 0;
    $(window).scroll(function(event){
       var scroll = $(this).scrollTop();
       if (scroll > previousScroll){
           $('.filter-options').removeClass('open');
       }
       previousScroll = scroll;
    });

    getLocation();
});
