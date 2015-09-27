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
            thread_id: $('#data-div').attr('data-thread-id'),
            isNewThread: $('#data-div').attr('data-thread-id') < 0,
            to: JSON.parse($('#data-div').attr('data-thread-participants')),
        };
        socket.emit('send message', packet);
        $('#text-input').val('');
        $('#messageModal').modal('hide')
    });

    $('#messageModal').on('show.bs.modal', function (event) {
        var button = $(event.relatedTarget) // Button that triggered the modal
        var recipient = button.data('name') // Extract info from data-* attributes
        var modal = $(this)
        modal.find('.modal-title').text('New message to ' + recipient)
        modal.find('.modal-body input').val(recipient)
    })
});


