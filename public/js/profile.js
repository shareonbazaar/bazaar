document.addEventListener("DOMContentLoaded", function(event) { 

    var current_message = {
        thread_id: -1,
        message: '',
        recipient: {},
    };
    var socket = io();

    $('#submit-profile-message').click(function () {
        var packet = {
            message: $('#text-input').val(),
            to: [$('#message-data-div').attr('recipient')],
        };
        socket.emit('send message', packet);
        $('#text-input').val('');
        $('#messageModal').modal('hide')
    });

    $('#submit-skill-request').click(function () {
        var packet = {
            message: "You have received a request for " + $('#skill-select option:selected').text(),
            to: [$('#request-data-div').attr('recipient')],
        };
        socket.emit('send message', packet);
        $('#requestModal').modal('hide');
    });

    $('#messageModal').on('show.bs.modal', function (event) {
        var button = $(event.relatedTarget) // Button that triggered the modal
        var id = button.data('id')
        var modal = $(this)
        modal.find('.modal-title').text('New message to ' + button.data('name'));
        modal.find('.modal-body input').val(button.data('name'));
        modal.find('.modal-body #message-data-div').attr('recipient', id);
    });

    $('#requestModal').on('show.bs.modal', function (event) {
        var button = $(event.relatedTarget) // Button that triggered the modal
        var id = button.data('id');
        var skills = button.data('skills');
        var modal = $(this);
        modal.find('.modal-body #request-data-div').attr('recipient', id);
        modal.find('.modal-title').text('Choose a skill to request from ' + button.data('name'));
        skills.forEach(function (skill) {
            var option = '<option name=' + skill.name + '>' + skill.label + '</option>';
            $('#skill-select').append(option);
        });
    });

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
    })
});


