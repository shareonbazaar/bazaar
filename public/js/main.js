$(document).ready(function() {
    $(function () {
        $('[data-toggle="popover"]').popover()
    });

    if ($('#email_editor').length > 0) {
        CKEDITOR.replace('email_editor');
    }

    $("#menu-toggle").click(function(e) {
        e.preventDefault();
        $("#sidebar-wrapper").toggleClass("toggled");
    });

    var grid = $('.grid').masonry({
        gutter: 20,
        itemSelector: '.grid-item',
        columnWidth: 300,
        fitWidth: true,
    });

    grid.imagesLoaded().progress(function () {
        grid.masonry('layout');
    });
});
