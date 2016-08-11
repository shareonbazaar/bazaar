document.addEventListener("DOMContentLoaded", function(event) { 

    $('#submit-skill-request').click(function () {
        var data = {
            recipient: $('#request-recipient').attr('recipient'),
            _csrf: $('#csrf_token').val(),
            service: $('.skill-select div.selected').attr('name'),
            message: $('#message-text').val(),
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

    $('#requestModal').on('show.bs.modal', function (event) {
        var button = $(event.relatedTarget) // Button that triggered the modal
        var id = button.data('id');
        var skills = button.data('skills');
        var modal = $(this);
        modal.find('.modal-body #request-recipient').attr('recipient', id);
        modal.find('.modal-title').text('Request for ' + button.data('name'));
        $('#text-input').val('');
        $('.skill-select').empty();
        skills.forEach(function (skill) {
            var option = '<div class="skill-label" name=' + skill.name + '>' + skill.label + '</div>';
            $('.skill-select').append(option);
        });
    });


    // For account page
    $('.submit-activities').click(function () {
        var id = $(this).attr('id');
        var section_name = '#' + id.slice('submit-'.length) + '-section';
        var selected = $(section_name +' .modal input.activity-checkbox:checked');
        var names = $.map(selected, function (obj) {
            return $(obj).attr('name');
        });

        $(section_name + ' .activities-data').val(JSON.stringify(names));
        $(section_name + ' .modal').modal('hide');

        $(section_name + ' .user-activities').empty()
        $.map(selected, function (obj) {
            var label = $(obj).attr('data-label');
            $(section_name + ' .user-activities').append('<li>' + label + '</li>');
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
        if ($(this).hasClass('selected')) {
            $(this).removeClass('selected');
        } else {
            $(this).addClass('selected');
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
});


