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

        var users = $('.profile-info .distance')

        $.map(users, function (obj) {
            var user_long = Number($(obj).attr('data-long'));
            var user_lat = Number($(obj).attr('data-lat'));
            var dist = distance(position.coords.longitude, position.coords.latitude,
                user_long, user_lat);
            if (!isNaN(dist)) {
                $(obj).html(Math.round(dist) + 'km');
            }
        });
    }


    $('body > .container-fluid').click(function () {
        $('.filter-options').removeClass('open');
    });

    $('.filter-options').click(function (event) {
        event.stopPropagation();
    });

    const MAX_SLIDER_VALUE = 50;
    var distance_slider = $('#distance-slider').bootstrapSlider({
        max: MAX_SLIDER_VALUE,
        min: 2,
        step: 2,
        value: MAX_SLIDER_VALUE,
        formatter: function (value) {
            if (value === 50) {
                $('#distance-label').addClass('inactive');
                return 'No distance filter';
            }
            $('#distance-label').removeClass('inactive');
            return value + ' km';
        }
    });
    $('.filter-button').click(function () {
        $('.filter-options').removeClass('open');

        var skill_names = $.map($.merge($('.category-filter .skill-select .selected'), $('.select2 .selected-skill')), function (obj) {
            return $(obj).attr('name');
        }).filter(function (item, pos, self) {
            return self.indexOf(item) == pos;
        });

        var slider_value = distance_slider.bootstrapSlider('getValue');
        $.ajax({
            url: '/users/search',
            data: {
                distance: slider_value == MAX_SLIDER_VALUE ? null : slider_value, // Distance in km in which to search
                request_type: $('.filter-options .service-type.selected').attr('name'),
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

    function autocompleteSelected (event, ui) {
        var skill_id = ui.item.value;
        var skill_name = ui.item.label;
        $('#skill-name-input').html('<div class="skill-label">Arabic</div>')
    }

    $("#skill-name-input").autocomplete({
        source: '/skills/list',
        select: autocompleteSelected,
        focus: function (event, ui) {event.preventDefault();}
    });

    $(".search-box").select2({
        placeholder: "Search for skills",
        minimumInputLength: 1,
        ajax: {
            url: '/skills/list',
            dataType: 'json',
            processResults: function (data, params) {
                return {
                    results: data
                }
            },
        },
        escapeMarkup: function (markup) { return markup; },
        templateResult: function (item) {
            return item.name;
        },
        templateSelection: function (item) {
            return '<span class="selected-skill" name=' + item.id + '>' + item.name + '</span>'
        },
    });

    $('select').on('select2:open', function () {
        $('.filter-options').addClass('open');
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
