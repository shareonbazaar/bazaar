$(document).ready(function() {
    $(function () {
        $('[data-toggle="popover"]').popover()
    });

    if ($('#email_editor').length > 0) {
        CKEDITOR.replace('email_editor');
    }
});
