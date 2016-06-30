document.addEventListener("DOMContentLoaded", function(event) {

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

    $('#acceptModal').on('show.bs.modal', function (event) {
        var button = $(event.relatedTarget) // Button that triggered the modal
        var id = button.data('id');
        var modal = $(this);
        modal.find('.modal-body #request-id').attr('request-id', id);
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
