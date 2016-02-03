$(document).ready(function() {
    $(function () {
        $('[data-toggle="popover"]').popover()
    });

    CKEDITOR.replace( 'email_editor' );
});
