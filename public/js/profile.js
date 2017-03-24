document.addEventListener("DOMContentLoaded", function(event) { 

    $('#submit-skill-request').click(function () {
        var service = $('.skill-select div.selected').attr('name');
        if (!service) {
            $('.error-message').show();
            return false;
        }
        var data = {
            recipient: $('#request-recipient').attr('recipient'),
            _csrf: $('#csrf_token').val(),
            service: $('.skill-select div.selected').attr('name'),
            message: $('#message-text').val(),
            request_type: $('#requestModal .service-type.selected').attr('name'),
        };
        $.ajax({
            url: '/transactions',
            method: 'POST',
            data: data,
        }).done(function (data) {
            console.log(data);
        });
        $('#requestModal').modal('hide')
        return false;
    });

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

    $('#requestModal').on('show.bs.modal', function (event) {
        var button = $(event.relatedTarget) // Button that triggered the modal
        var id = button.data('id');
        var skills = button.data('skills');
        var interests = button.data('interests');
        var modal = $(this);
        modal.find('.modal-body #request-recipient').attr('recipient', id);
        modal.find('.modal-title').text('Request from ' + button.data('name'));
        $('.error-message').hide();
        $('#text-input').val('');
        $('#requestModal .service-type').off('click').click(function () {
            $('#requestModal .service-type').removeClass('selected');
            $(this).addClass('selected');

            $('#requestModal .skill-select').empty();
            var tags;
            if ($(this).attr('name') === 'receive') {
                tags = skills;
            } else if ($(this).attr('name') === 'give') {
                tags = interests;
            } else {
                var curr_user_skills = modal.find('.modal-body .my-skills').data('skills');
                var curr_user_interests = modal.find('.modal-body .my-skills').data('interests');
                tags = curr_user_skills.concat(curr_user_interests).filter(function (a) {
                    return skills.concat(interests).some(function (b) {
                        return a._id === b._id;
                    });
                });
            }

            tags.forEach(function (skill) {
                var option = '<div class="skill-label" name=' + skill._id + '>' + skill.label.en + '</div>';
                $('#requestModal .skill-select').append(option);
            });
        });
        ($('#requestModal .service-type')[0]).click();
    });


    // For edit profile page
    $('.submit-activities').click(function () {
        var id = $(this).attr('id');
        var section_name = '#' + id.slice('submit-'.length) + '-section';
        var selected = $(section_name +' .modal .skill-select .skill-label.selected');
        var names = $.map(selected, function (obj) {
            return $(obj).attr('name');
        });

        $(section_name + ' .activities-data').val(JSON.stringify(names));
        $(section_name + ' .modal').modal('hide');

        $(section_name + ' .user-activities').empty()
        $.map(selected, function (obj) {
            var label = $(obj).html();
            $(section_name + ' .user-activities').append('<div class="skill-label">' + label + '</li>');
        });
    });

    $('#profile-pic-input').change(function () {
        if (this.files && this.files[0]) {
            var reader = new FileReader();

            reader.onload = function (e) {
                $('#profile-img')
                    .attr('src', e.target.result)
                    .width(200);
            };

            reader.readAsDataURL(this.files[0]);
        }
    });

    $('.skill-select').on('click', '.skill-label', function () {
        if ($(this).parent().hasClass('unique')) {
            $(this).parent().find('.skill-label').removeClass('selected');
            $(this).addClass('selected');
        } else {
            if ($(this).hasClass('selected')) {
                $(this).removeClass('selected');
            } else {
                $(this).addClass('selected');
            }
        }
    });

    $('.service-type').click(function () {
        $('.service-type').removeClass('selected');
        $(this).addClass('selected');
    });

    $('.rating span').click(function () {
        $('.rating span').removeClass('selected');
        $(this).addClass('selected');
    });

    $('.form-group .radio').click(function () {
        $(this).siblings().removeClass('selected');
        $(this).addClass('selected');
        var name = $(this).attr('name');
        $('.' + name).val($(this).attr('value'));
    });
});


