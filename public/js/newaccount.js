document.addEventListener("DOMContentLoaded", function (event) {
    function resizePanel() {
        width = $(window).width();
        height = $(window).height();

        mask_height = height * $('.item').length;
            
        $('#debug').html(width  + ' ' + height + ' ' + mask_height);
        
        $('#wrapper, .item').css({width: width, height: height});
        $('#mask').css({width: width, height: mask_height});
        var current = $('a.selected').attr('href');
        if (!current) {
            current = '#item1';
        }
        $('#wrapper').scrollTo(current, 0);
    }

    $('a.nav-link').click(function () {
        $('a.nav-link').removeClass('selected');
        $(this).addClass('selected');
        
        current = $(this);
        $('#wrapper').scrollTo($(this).attr('href'), 800);      
        
        return false;
    });

    $('#finished').click(function (event) {
        var skill_names = $.map($('#item2 .activity-selected'), function (obj) {
            return $(obj).attr('name');
        });

        var interest_names = $.map($('#item3 .activity-selected'), function (obj) {
            return $(obj).attr('name');
        });

        var status = $('.status-selected').attr('name');

        $('#hidden-form #skills').val(JSON.stringify(skill_names));
        $('#hidden-form #interests').val(JSON.stringify(interest_names));
        $('#hidden-form #status').val(status);
        $('#hidden-form').submit();
        return false;
    })

    $('.status').click(function () {
        $('.status').removeClass('status-selected');
        $(this).addClass('status-selected');
    });
    
    $('.activity').click(function () {
        if ($(this).hasClass('activity-selected')) {
            $(this).removeClass('activity-selected');
        } else {
            $(this).addClass('activity-selected');
        }
    });

    $(window).resize(function () {
        resizePanel();
    });
})