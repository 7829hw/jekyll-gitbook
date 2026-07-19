require([
    'gitbook',
    'jquery'
], function(gitbook, $) {
    gitbook.events.on('page.change', function() {
        var back_to_top_button = ['<div class="back-to-top"><i class="fa fa-arrow-up"></i></div>'].join("");
        $(".page-wrapper").append(back_to_top_button)
        var is_mobile = $(document).width() <= 600;
        var scroll_targets = is_mobile ? $(window) : $('.book-body,.body-inner,.page-wrapper');
    
        $(".back-to-top").hide();

        $(".back-to-top").hover(function() {
            $(this).css('cursor', 'pointer').attr('title', 'Back to top');
        }, function() {
            $(this).css('cursor', 'auto');
        });
    
        scroll_targets.off('scroll.backToTop').on('scroll.backToTop', function () {
            var scroll_top = is_mobile ? $(window).scrollTop() : $(this).scrollTop();
            if (scroll_top > 100) {
                $('.back-to-top').fadeIn();
            } else {
                $('.back-to-top').fadeOut();
            }
        });

        $('.back-to-top').off('click.backToTop').on('click.backToTop', function () {
            var target = is_mobile ? $('html, body') : $('.book-body,.body-inner');
            target.stop().animate({
                scrollTop: 0
            }, 800);
            return false;
        });
    });
});
