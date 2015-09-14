$(document).ready(function() {
    var currentThread = $('#thread-list li').first();

    function newChatBubble (message) {
        var klass = message.author.isMe ? 'myself' : 'other-person';
        var chat = '<div class="message-details {who}">'.replace('{who}', klass) +
                        '<div class="author">{author}</div>'.replace('{author}', message.author.name) +
                        '<div class="comment">{comment}</div>'.replace('{comment}', message.message) +
                    '</div>';
        return chat;
    }

    var socket = io();
    $('form').submit(function () {
        if (typeof currentThread.attr('data-thread-id') === 'undefined') {
            return false;
        }
        var packet = {
            message: $('#text-input').val(),
            thread_id: currentThread.attr('data-thread-id'),
            isNewThread: currentThread.attr('data-thread-id') < 0,
            to: JSON.parse(currentThread.attr('data-thread-participants')),
        };
        socket.emit('send message', packet);
        $('#text-input').val('');
        return false;
    });
    socket.on('new message', function (data) {
        console.log("got message " + JSON.stringify(data))
        if (currentThread.attr('data-thread-id') == -1) {
            currentThread.attr('data-thread-id', data.thread_id);
        }

        if (data.thread_id == currentThread.attr('data-thread-id')) {
            var new_element = newChatBubble(data);
            $('#conversation-list').append(new_element);
            $("#conversation-list").scrollTop($("#conversation-list")[0].scrollHeight);
        }
    });


    function onThreadClicked (event) {
        currentThread.removeClass('is-active');
        currentThread = $(this);
        currentThread.addClass('is-active');
        $.ajax({
            url: '/_threadMessages/' + currentThread.attr('data-thread-id'),
        }).done(function (data) {
            $('#conversation-list').empty();
            var conversation = data.map(function (message) {
                var chat = newChatBubble(message);
                $('#conversation-list').append(chat);
            });
        })
    }

    $('#new-message-button').click(function () {
        $('#conversation-list').empty();
        var new_thread = '<li data-thread-id=-1>' +
                              '<div class="message-snippet"> ' +
                                  '<img src="/images/palestinian-man-smiling.jpg" class="profile-pic">' +
                                  '<div class="snippet-text">' +
                                    '<div class="timestamp">13:07</div>' +
                                    '<div class="sender">New Message</div>' +
                                    '<div class="message-content"></div>' +
                                  '</div>' +
                              '</div>' +
                          '</li>';
        $('#thread-list').prepend(new_thread);
        $('#thread-list li').first().click(onThreadClicked);

        var conversation_header = $('#conversation-header h3');
        conversation_header.hide();

        var input = $('#conversation-header input');
        input.show();
        input.focus();
    });
    $('#thread-list li').click(onThreadClicked);

    function autocompleteSelected (event, ui) {
        $('#conversation-header input').hide();
        $('#conversation-header h3').show();
        currentThread = $('#thread-list li').first();
        currentThread.find('.sender').html(ui.item.label);
        currentThread.attr('data-thread-participants', JSON.stringify([ui.item.value]));
    }

    $("#name-input").autocomplete({
        source: '/users/list',
        select: autocompleteSelected,
    });
});


