document.addEventListener("DOMContentLoaded", function(event) {
    var current_message = {
        thread_id: -1,
        message: '',
        recipient: {},
    };
    var user = local_user_data;
    if ($('#thread-list li').length > 0) {
        onThreadClicked.bind($('#thread-list li').first())();
    }

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

    function newThreadItem (data) {
        var image_uri = data.member.profile.picture || '/images/person_placeholder.gif';
        return '<li data-thread-id=' + data.thread_id + ' data-thread-participants='+ data.participant_ids + '>' +
                              '<div class="message-snippet"> ' +
                                  '<img src=' + image_uri + ' class="profile-pic">' +
                                  '<div class="snippet-text">' +
                                    '<div class="timestamp">' + serializeDate(new Date(data.timeSent)) + '</div>' +
                                    '<div class="sender">' + data.member.profile.name + '</div>' +
                                    '<div class="message-content">' + data.message + '</div>' +
                                  '</div>' +
                              '</div>' +
                          '</li>';
    }

    var socket = io();
    $('.message-form').submit(function () {
        var message_text = $('#text-input').val();
        if (!message_text) {
            return false;
        }
        var packet = {
            message: message_text,
            thread_id: current_message.thread_id,
            to: [current_message.recipient.id],
        };

        socket.emit('send message', packet);
        $('#text-input').val('');

        return false;
    });

    socket.on('new message', function (data) {
        console.log(JSON.stringify(data, null, 2))
        var match = $('#thread-list').find('[data-thread-id="' + data.thread._id + '"]');
        // If its a message for an existing thread, add it and set that thread to 'pending'
        if (match.length > 0) {
            var message_thread = match[0];
            $(message_thread).find('.message-content').html(data.message);
            var timestamp = new Date(data.timeSent);
            $(message_thread).find('.timestamp').html(serializeDate(timestamp));

            // If its a message for the current thread, make a new chat bubble and append it
            // otherwise just set that thread to be 'pending'
            if (data.thread._id == current_message.thread_id) {
                var new_element = newChatBubble(data);
                $('#conversation-list').append(new_element);
                $("#conversation-list").scrollTop($("#conversation-list")[0].scrollHeight);
                $.ajax({
                    url: '/_ackThread/' + data.thread._id,
                }).done();
                // return here because we don't want to update the unreadThreads
                // count if we are on the current thread.
                return;
            } else {
                $(message_thread).addClass('is-pending');
            }
        } else {
            var member = data.thread._participants.filter(function (person) {
                return person._id != user.id;
            })[0];
            var participant_ids = data.thread._participants.map(function (person) {
                return person._id;
            }).sort();
            var new_thread = newThreadItem({
                member: member,
                timeSent: data.timeSent,
                message: data.message,
                thread_id: data.thread._id,
                participant_ids: JSON.stringify(participant_ids),
            });
            $('#thread-list').prepend(new_thread);
            $('#thread-list li').first().click(onThreadClicked);
            if (current_message.thread_id < 0) {
                onThreadClicked.bind($('#thread-list li').first())();
            } else {
                $('#thread-list li').first().addClass('is-pending');
            }
        }
        $.ajax({
            url: '/_numUnreadThreads',
        }).done(function (data) {
            $('#thread-count').html(data.count);
        });
    });

    function setNodeText (node, new_text) {
        var text_node = node.contents()
            .filter( function () { return this.nodeType == 3; })
            .replaceWith(new_text);
    }

    function onThreadClicked (event) {
        $('#thread-list li').removeClass('is-active');
        $(this).removeClass('is-pending');
        $(this).addClass('is-active');
        var clicked_thread_id = $(this).attr('data-thread-id');
        current_message.thread_id = clicked_thread_id;
        var name = $(this).find('.sender').html();

        $('#conversation-header input').hide();
        $('#conversation-header h3').show();
        setNodeText($("#conversation-header h3"), name);

        $.ajax({
            url: '/_threadMessages/' + clicked_thread_id,
        }).done(function (data) {
            $('#conversation-list').empty();
            var conversation = data.map(function (message) {
                var chat = newChatBubble(message);
                $('#conversation-list').append(chat);
            });
            $("#conversation-list").scrollTop($("#conversation-list")[0].scrollHeight);
            $.ajax({
                url: '/_ackThread/' + clicked_thread_id,
            }).done(function (data) {
                $('#thread-count').html(data.count);
            });
        });

    }
    $('#thread-list li').click(onThreadClicked);

    $('#new-message-button').click(function () {
        $('#conversation-list').empty();

        var conversation_header = $('#conversation-header h3');
        conversation_header.hide();
         $('#thread-list li').removeClass('is-active');
        var input = $('#conversation-header input');
        input.val('');
        input.show();
        input.focus();

        $('#send-button').attr("disabled", true);
    });

    function autocompleteSelected (event, ui) {
        $('#conversation-header input').hide();
        $('#conversation-header h3').show();
        var participant_id = ui.item.value.id;
        var participant_pic = ui.item.value.pic;
        var participant_name = ui.item.label;
        var thread_matcher = JSON.stringify([participant_id, user.id].sort())
        var match = $('#thread-list').find("[data-thread-participants='" + thread_matcher + "']");
        // If we find a thread matching these participants, then just jump to that thread
        if (match.length > 0) {
            onThreadClicked.bind(match[0])();
        } else {
            // Otherwise, initialize the new thread
            setNodeText($('#conversation-header h3'), participant_name);
            current_message.thread_id = -1;
            current_message.recipient = {
                id: participant_id,
                name: participant_name,
                pic: participant_pic,
            };
        }
        $('#send-button').attr("disabled", false);
    }

    $("#name-input").autocomplete({
        source: '/users/list',
        select: autocompleteSelected,
        focus: function (event, ui) {event.preventDefault();}
    });

    $("#message-search").on('input', function () {
        var query = $("#message-search").val();
        $('#thread-list li').show();
        $('#thread-list li:not(:has(.sender:contains("' + query + '")))').hide();
    });

});
