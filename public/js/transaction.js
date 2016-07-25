document.addEventListener("DOMContentLoaded", function (event) {

    $('#submit-acceptance').click(function () {
        var data = {
            id: $('#request-id').attr('request-id'),
            _csrf: $('#csrf_token').val(),
            message: $('#text-input').val(),
        };
        $.ajax({
            url: '/acceptRequest',
            method: 'POST',
            data: data,
        }).done(function (data) {
            console.log(data);
        })
        $('#acceptModal').modal('hide')
        return false;
    });

    $('.reject').click( function () {
        $(this).closest('.request-info').hide('slide',{direction:'right'},1000);
        $.ajax({
            url: '/rejectRequest/' + $(this).closest('.request-info').data('id'),
            method: 'GET',
        }).done(function (data) {
            console.log(data);
        });
    });

    function newChatBubble (message) {
        var klass = message.author.isMe ? 'myself' : 'other-person';
        var chat = '<div class="message-details {who}">'.replace('{who}', klass) +
                        '<div class="comment">{comment}</div>'.replace('{comment}', message.message) +
                        '<div class="author">{author}</div>'.replace('{author}', message.author.name) +
                    '</div>';
        return chat;
    }

    function serializeDate (date) {
        return date.getHours() + ':' + ('0'+ date.getMinutes()).slice(-2)
    }

    var socket = io();
    $('.message-form').submit(function () {
        var message_text = $(this).find('.text-input').val();
        if (!message_text) {
            return false;
        }
        var packet = {
            message: message_text,
            t_id: $(this).closest('.request-info').data('id'),
        };

        socket.emit('send message', packet);
        $('#text-input').val('');

        return false;
    });

    socket.on('new message', function (data) {
        var match = $('.transaction-table').find('[data-id="' + data.transaction._id + '"]');
        // If its a message for an existing thread, add it and set that thread to 'pending'
        if (match.length > 0) {
            var request = match[0];

            // If its a message for the current thread, make a new chat bubble and append it
            // otherwise just set that thread to be 'pending'
            var new_element = newChatBubble(data);
            $(request).find('.conversation').append(new_element);
            $(request).find('.conversation').scrollTop($(request).find('.conversation')[0].scrollHeight);

            return;
        } else {
            console.log("Couldn't find transaction with id " + data.transaction._id);
        }
    });

    $('.see-more').click(function () {
        var type = $(this).attr('href');
        if (type.indexOf('proposed') >= 0)
            return;
        var request_info = $(this).closest('.request-info');
        $.ajax({
            url: '/_transactionMessages/' + $(request_info).data('id'),
        }).done(function (response) {
            $(request_info).find('.conversation').empty();
            response.data.map(function (message) {
                var chat = newChatBubble(message);
                $(request_info).find('.conversation').append(chat);
            });
            $(request_info).find('.conversation').scrollTop($(request_info).find('.conversation')[0].scrollHeight);
            // $.ajax({
            //     url: '/_ackThread/' + clicked_thread_id,
            // }).done(function (data) {
            //     $('#thread-count').html(data.count);
            // });
        });
    })

    $('#acceptModal').on('show.bs.modal', function (event) {
        var button = $(event.relatedTarget) // Button that triggered the modal
        var id = button.closest('.request-info').data('id');
        var skill_label = button.closest('.request-info').find('.content em').html();
        var modal = $(this);
        modal.find('.modal-body #request-id').attr('request-id', id);
        modal.find('.modal-body .statement').html('Get ready for ' + skill_label);
    });

    $('.confirm').click(function () {
        $.ajax({
            url: '/confirmExchange/' + $(this).data('id'),
            method: 'GET',
        }).done(function (data) {
            console.log(data);
        });
    });

    $('.exchange-type').click(function () {
        $('.exchange-type').removeClass('selected');
        $(this).addClass('selected');
        var index = $('.exchange-type').index($(this));
        $('.transaction-table').hide();
        $('.transaction-table').eq(index).fadeIn();
    });
});
