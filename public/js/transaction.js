document.addEventListener("DOMContentLoaded", function(event) {
    $('#submit-transaction').click(function () {
        var rating = 1;
        $('.rating span').each(function (i, obj) {
            if ($(obj).hasClass('selected')) {
                rating = 5 - i;
            }
        });
        $('.rating span').removeClass('selected');
        var data = {
            recipient: $('#recipient-id').val(),
            amount: $('#amount').val(),
            review: $('#review').val(),
            rating: rating,
            _csrf: $('#csrf_token').val(),
            service: $('#service').val(),
        }
        $.ajax({
            url: '/transactions',
            method: 'POST',
            data: data,
        }).done(function (data) {
            console.log(data)
        })
        $('#transactionModal').modal('hide')
        return false;
    });

    function autocompleteSelected (event, ui) {
        var user_id = ui.item.value.id;
        var user_pic = ui.item.value.pic;
        var user_name = ui.item.label;
        $('#recipient-name').val(user_name);
        $('#recipient-id').val(user_id);
        return false;
    }

    $("#recipient-name").autocomplete({
        source: '/users/list',
        select: autocompleteSelected,
        appendTo: '#transactionModal',
    });

    $('.rating span').click(function () {
        $('.rating span').removeClass('selected');
        $(this).addClass('selected');
    })
});
