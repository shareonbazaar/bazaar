$(document).ready(function() {
    $(function () {
        $('[data-toggle="popover"]').popover()
    })
    var currentThread = $('#thread-list li').first();
    currentThread.addClass('is-active');
    $("#conversation-list").scrollTop($("#conversation-list")[0].scrollHeight);

    function newChatBubble (message) {
        var klass = message.author.isMe ? 'myself' : 'other-person';
        var chat = '<div class="message-details {who}">'.replace('{who}', klass) +
                        '<div class="author">{author}</div>'.replace('{author}', message.author.name) +
                        '<div class="comment">{comment}</div>'.replace('{comment}', message.message) +
                    '</div>';
        return chat;
    }

    var socket = io();
    $('.message-form').submit(function () {
        if (typeof currentThread.attr('data-thread-id') === 'undefined'
            || !$('#text-input').val()) {
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

    socket.on('new message', function (data) {
        if (currentThread.attr('data-thread-id') == -1) {
            currentThread.attr('data-thread-id', data.thread_id);
        }

        if (data.thread_id == currentThread.attr('data-thread-id')) {
            var new_element = newChatBubble(data);
            $('#conversation-list').append(new_element);
            $("#conversation-list").scrollTop($("#conversation-list")[0].scrollHeight);
        } else {
            var pending_thread = $('#thread-list li[data-thread-id="' + data.thread_id + '"]');
            pending_thread.addClass('is-pending');
            pending_thread.find('.message-content').html(data.message);
            var timestamp = new Date(data.timeSent);
            pending_thread.find('.timestamp').html(timestamp.getHours() + ':' + ('0'+ timestamp.getMinutes()).slice(-2));
        }
    });


    function onThreadClicked (event) {
        currentThread.removeClass('is-active');
        currentThread = $(this);
        currentThread.addClass('is-active');
        currentThread.removeClass('is-pending');
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
                                  '<img src="/images/person_placeholder.gif" class="profile-pic">' +
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
        input.val('');
        input.show();
        input.focus();
    });
    $('#thread-list li').click(onThreadClicked);

    function autocompleteSelected (event, ui) {
        $('#conversation-header input').hide();
        $('#conversation-header h3').show();
        var participant_string = JSON.stringify([ui.item.value]);
        var match = $('#thread-list').find("[data-thread-participants='" + participant_string + "']");
        // If we find a thread matching these participants, then just jump to that thread
        if (match.length > 0) {
            $('#thread-list li').first().remove(); // Remove the New Message thread
            onThreadClicked.bind(match[0])();
        } else {
            // Otherwise, initialize the new thread
            currentThread = $('#thread-list li').first();
            currentThread.find('.sender').html(ui.item.label);
            currentThread.attr('data-thread-participants', participant_string);
        }
    }

    $("#name-input").autocomplete({
        source: '/users/list',
        select: autocompleteSelected,
    });

    $("#message-search").on('input', function () {
        var query = $("#message-search").val();
        $('#thread-list li').show();
        $('#thread-list li:not(:has(.sender:contains("' + query + '")))').hide();
    });

    $('#exampleModal').on('show.bs.modal', function (event) {
        var button = $(event.relatedTarget) // Button that triggered the modal
        var recipient = button.data('name') // Extract info from data-* attributes
        var modal = $(this)
        modal.find('.modal-title').text('New message to ' + recipient)
        modal.find('.modal-body input').val(recipient)
    })
});


